// @vitest-environment node
import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { TURNSTILE_ORIGIN } from "@/lib/security/csp";
import proxy, { config } from "@/proxy";

// The proxy reads the validated server env. Replaced here so these tests are
// independent of the machine's real environment (CLAUDE.md §11).
const mocked = vi.hoisted(
  (): { env: Record<string, unknown>; isDevelopment: boolean } => ({
    env: {},
    isDevelopment: false,
  }),
);
vi.mock("@/lib/env", () => ({
  get env() {
    return mocked.env;
  },
  get isDevelopment() {
    return mocked.isDevelopment;
  },
}));

beforeEach(() => {
  mocked.env = { NODE_ENV: "production", CSP_MODE: "report-only" };
  mocked.isDevelopment = false;
});

function request(path: string, acceptLanguage?: string) {
  return new NextRequest(`http://localhost${path}`, {
    headers: acceptLanguage ? { "accept-language": acceptLanguage } : {},
  });
}

/** Next anchors the matcher; same semantics as a plain anchored RegExp here. */
const matcher = new RegExp(`^${config.matcher}$`);

/** The nonce Next will hand to the app: request header overrides travel as `x-middleware-request-*`. */
const appNonce = (response: Response) =>
  response.headers.get("x-middleware-request-x-nonce");

describe("proxy: locale redirect", () => {
  it.each([
    ["en-US,en;q=0.9", "/en"],
    ["it-IT,it;q=0.9,en;q=0.5", "/it"],
    ["fr-FR,fr;q=0.9", "/it"], // unsupported language falls back to the default
    [undefined, "/it"], // no header at all
  ])("sends / to the right locale for Accept-Language %s", (header, target) => {
    const response = proxy(request("/", header));

    expect(response.status).toBe(307);
    expect(new URL(response.headers.get("location") ?? "").pathname).toBe(
      target,
    );
  });

  it("keeps the rest of the path when adding the locale", () => {
    const response = proxy(request("/services/ai", "en-GB,en;q=0.8"));

    expect(new URL(response.headers.get("location") ?? "").pathname).toBe(
      "/en/services/ai",
    );
  });

  it("does not redirect a path that already has a locale", () => {
    const response = proxy(request("/it/services", "en-US"));

    expect(response.headers.get("location")).toBeNull();
    expect(response.status).toBe(200);
  });

  it("never sets a cookie (no locale cookie, nothing stored about the visitor)", () => {
    for (const path of ["/", "/it", "/en/x", "/foo"]) {
      const response = proxy(request(path, "en-US"));
      expect(response.headers.get("set-cookie"), path).toBeNull();
    }
  });
});

describe("proxy: security headers", () => {
  it.each(["/it", "/en/services", "/", "/foo"])(
    "sets the fixed headers on %s, redirects included",
    (path) => {
      const response = proxy(request(path, "en-US"));

      expect(response.headers.get("x-content-type-options")).toBe("nosniff");
      expect(response.headers.get("x-frame-options")).toBe("DENY");
      expect(response.headers.get("referrer-policy")).toBe(
        "strict-origin-when-cross-origin",
      );
      expect(response.headers.get("cross-origin-opener-policy")).toBe(
        "same-origin",
      );
      expect(response.headers.get("permissions-policy")).toContain("camera=()");
      expect(response.headers.get("strict-transport-security")).toContain(
        "max-age=63072000",
      );
    },
  );

  it("omits HSTS outside production", () => {
    mocked.env = { NODE_ENV: "development", CSP_MODE: "report-only" };

    expect(
      proxy(request("/it")).headers.get("strict-transport-security"),
    ).toBeNull();
  });
});

describe("proxy: Content Security Policy", () => {
  it("report-only (the default): the policy is reported, not enforced", () => {
    const response = proxy(request("/it"));

    expect(
      response.headers.get("content-security-policy-report-only"),
    ).toContain("script-src");
    expect(response.headers.get("content-security-policy")).toBeNull();
  });

  it("enforce: the policy is enforced, not merely reported", () => {
    mocked.env = { NODE_ENV: "production", CSP_MODE: "enforce" };

    const response = proxy(request("/it"));

    expect(response.headers.get("content-security-policy")).toContain(
      "upgrade-insecure-requests",
    );
    expect(
      response.headers.get("content-security-policy-report-only"),
    ).toBeNull();
  });

  it("off: no CSP and no nonce, the other headers stay", () => {
    mocked.env = { NODE_ENV: "production", CSP_MODE: "off" };

    const response = proxy(request("/it"));

    expect(response.headers.get("content-security-policy")).toBeNull();
    expect(
      response.headers.get("content-security-policy-report-only"),
    ).toBeNull();
    expect(appNonce(response)).toBeNull();
    expect(response.headers.get("x-content-type-options")).toBe("nosniff");
  });

  it("the nonce in the header is the nonce the app receives (so Next can stamp it on scripts)", () => {
    const response = proxy(request("/it"));

    const csp =
      response.headers.get("content-security-policy-report-only") ?? "";
    const nonce = appNonce(response);
    expect(nonce).toMatch(/^[A-Za-z0-9+/]{22}==$/);
    expect(csp).toContain(`'nonce-${nonce ?? ""}'`);
  });

  it("the app also receives the policy itself in the REQUEST headers, under the same header name", () => {
    const response = proxy(request("/it"));

    expect(
      response.headers.get(
        "x-middleware-request-content-security-policy-report-only",
      ),
    ).toBe(response.headers.get("content-security-policy-report-only"));
  });

  it("every request gets a fresh nonce", () => {
    const nonces = Array.from({ length: 50 }, () =>
      appNonce(proxy(request("/it"))),
    );

    expect(new Set(nonces).size).toBe(50);
  });

  it("a client-supplied x-nonce or CSP header cannot replace ours (negative)", () => {
    const hostile = new NextRequest("http://localhost/it", {
      headers: {
        "x-nonce": "attacker-nonce",
        "content-security-policy-report-only": "script-src *",
      },
    });

    const response = proxy(hostile);

    expect(appNonce(response)).not.toBe("attacker-nonce");
    expect(
      response.headers.get("content-security-policy-report-only"),
    ).not.toContain("*");
    expect(
      response.headers.get(
        "x-middleware-request-content-security-policy-report-only",
      ),
    ).not.toContain("script-src *");
  });

  it("adds the Turnstile origin only when both Turnstile keys are configured", () => {
    const csp = () =>
      proxy(request("/it")).headers.get(
        "content-security-policy-report-only",
      ) ?? "";

    expect(csp()).not.toContain(TURNSTILE_ORIGIN);

    mocked.env = {
      NODE_ENV: "production",
      CSP_MODE: "report-only",
      NEXT_PUBLIC_TURNSTILE_SITE_KEY: "k",
    };
    expect(csp()).not.toContain(TURNSTILE_ORIGIN); // half a configuration is not "configured"

    mocked.env = {
      NODE_ENV: "production",
      CSP_MODE: "report-only",
      NEXT_PUBLIC_TURNSTILE_SITE_KEY: "k",
      TURNSTILE_SECRET_KEY: "s",
    };
    expect(csp()).toContain(TURNSTILE_ORIGIN);
  });

  it("adds the analytics origin and the report collector only when configured", () => {
    mocked.env = {
      NODE_ENV: "production",
      CSP_MODE: "report-only",
      NEXT_PUBLIC_PLAUSIBLE_ORIGIN: "https://plausible.io",
      CSP_REPORT_URI: "https://reports.example.eu/csp",
    };

    const csp =
      proxy(request("/it")).headers.get(
        "content-security-policy-report-only",
      ) ?? "";

    expect(csp).toContain("https://plausible.io");
    expect(csp).toContain("report-uri https://reports.example.eu/csp");
  });

  it("development: the policy allows what `next dev` needs, production does not", () => {
    mocked.isDevelopment = true;
    mocked.env = { NODE_ENV: "development", CSP_MODE: "report-only" };
    expect(
      proxy(request("/it")).headers.get("content-security-policy-report-only"),
    ).toContain("'unsafe-eval'");

    mocked.isDevelopment = false;
    mocked.env = { NODE_ENV: "production", CSP_MODE: "report-only" };
    expect(
      proxy(request("/it")).headers.get("content-security-policy-report-only"),
    ).not.toContain("'unsafe-eval'");
  });

  it("a redirect still carries the policy and the fixed headers", () => {
    const response = proxy(request("/", "en-US"));

    expect(response.status).toBe(307);
    expect(
      response.headers.get("content-security-policy-report-only"),
    ).toContain("default-src 'self'");
    expect(response.headers.get("x-frame-options")).toBe("DENY");
  });
});

describe("proxy: matcher", () => {
  it.each([
    "/",
    "/it",
    "/en",
    "/it/services",
    "/foo",
    "/en/_dev/ui",
    "/_dev/ui",
  ])("runs on page path %s", (path) => {
    expect(matcher.test(path), path).toBe(true);
  });

  it.each([
    "/_next/static/chunks/app.js",
    "/_next/image",
    "/api/inquiry",
    "/trpc/x",
    "/_vercel/insights/script.js",
    "/favicon.ico",
    "/next.svg",
    "/robots.txt",
    "/sitemap.xml",
    "/.well-known/security.txt",
    "/it/opengraph-image.png",
  ])("skips %s (static asset or internal route)", (path) => {
    expect(matcher.test(path), path).toBe(false);
  });
});
