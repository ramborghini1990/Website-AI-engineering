// @vitest-environment node
import { describe, expect, it } from "vitest";

import {
  buildCsp,
  cspHeaderName,
  generateNonce,
  securityHeaders,
  TURNSTILE_ORIGIN,
  type CspOptions,
} from "@/lib/security/csp";

const NONCE = "bm9uY2UtZm9yLXRlc3Rz"; // synthetic

const base: CspOptions = {
  nonce: NONCE,
  development: false,
  turnstile: false,
  enforcing: true,
};

/** `directive("a b; c d", "a")` -> ["b"]. Undefined when the directive is absent. */
function directive(csp: string, name: string): string[] | undefined {
  const found = csp
    .split(";")
    .map((part) => part.trim().split(/\s+/))
    .find(([first]) => first === name);
  return found?.slice(1);
}

describe("buildCsp: the strict baseline", () => {
  const csp = buildCsp(base);

  it("scripts need the nonce and `strict-dynamic`; there is no unsafe-inline or unsafe-eval for scripts", () => {
    const script = directive(csp, "script-src");

    expect(script).toContain(`'nonce-${NONCE}'`);
    expect(script).toContain("'strict-dynamic'");
    expect(script).not.toContain("'unsafe-inline'");
    expect(script).not.toContain("'unsafe-eval'");
  });

  it("style elements need the nonce; only style ATTRIBUTES may be inline", () => {
    expect(directive(csp, "style-src")).toEqual(["'self'", `'nonce-${NONCE}'`]);
    expect(directive(csp, "style-src-attr")).toEqual(["'unsafe-inline'"]);
  });

  it.each([
    ["default-src", ["'self'"]],
    ["object-src", ["'none'"]],
    ["base-uri", ["'none'"]],
    ["form-action", ["'self'"]],
    ["frame-ancestors", ["'none'"]],
    ["frame-src", ["'none'"]],
    ["font-src", ["'self'"]],
    ["connect-src", ["'self'"]],
    ["img-src", ["'self'", "data:", "blob:"]],
  ])("%s is %j by default", (name, expected) => {
    expect(directive(csp, name)).toEqual(expected);
  });

  it("allows no third-party origin, no wildcard and no plain http", () => {
    expect(csp).not.toMatch(/https?:\/\//);
    expect(csp).not.toMatch(/\*/);
    expect(csp).not.toMatch(/\shttp:/);
    expect(csp).not.toContain("challenges.cloudflare.com");
  });

  it("upgrades insecure requests when enforcing in production", () => {
    expect(csp).toContain("upgrade-insecure-requests");
  });

  it("is a single header line with no characters that could split or extend it", () => {
    expect(csp).not.toMatch(/[\r\n]/);
    expect(csp.endsWith(";")).toBe(false);
  });
});

describe("buildCsp: optional origins are added only where they are needed", () => {
  it("Turnstile: script-src and frame-src only", () => {
    const csp = buildCsp({ ...base, turnstile: true });

    expect(directive(csp, "script-src")).toContain(TURNSTILE_ORIGIN);
    expect(directive(csp, "frame-src")).toEqual([TURNSTILE_ORIGIN]);
    for (const name of [
      "default-src",
      "connect-src",
      "img-src",
      "style-src",
      "font-src",
    ]) {
      expect(directive(csp, name), name).not.toContain(TURNSTILE_ORIGIN);
    }
  });

  it("booking origin: frame-src only, and Turnstile stays next to it", () => {
    const booking = "https://cal.eu";
    const csp = buildCsp({ ...base, bookingOrigin: booking });

    expect(directive(csp, "frame-src")).toEqual([booking]);
    for (const name of [
      "default-src",
      "script-src",
      "connect-src",
      "img-src",
      "style-src",
      "font-src",
      "form-action",
    ]) {
      expect(directive(csp, name), name).not.toContain(booking);
    }
    expect(
      directive(
        buildCsp({ ...base, turnstile: true, bookingOrigin: booking }),
        "frame-src",
      ),
    ).toEqual([TURNSTILE_ORIGIN, booking]);
  });

  it("without a booking origin frame-src stays 'none' (negative)", () => {
    expect(directive(buildCsp(base), "frame-src")).toEqual(["'none'"]);
    expect(
      directive(buildCsp({ ...base, bookingOrigin: undefined }), "frame-src"),
    ).toEqual(["'none'"]);
  });

  it("analytics origin: script-src and connect-src only", () => {
    const csp = buildCsp({ ...base, analyticsOrigin: "https://plausible.io" });

    expect(directive(csp, "script-src")).toContain("https://plausible.io");
    expect(directive(csp, "connect-src")).toContain("https://plausible.io");
    for (const name of [
      "default-src",
      "frame-src",
      "img-src",
      "style-src",
      "font-src",
    ]) {
      expect(directive(csp, name), name).not.toContain("https://plausible.io");
    }
  });

  it("nothing is added when nothing is configured (the baseline test above)", () => {
    expect(buildCsp({ ...base, analyticsOrigin: undefined })).toBe(
      buildCsp(base),
    );
  });

  it("report-uri is added only when given", () => {
    expect(buildCsp(base)).not.toContain("report-uri");
    expect(
      buildCsp({ ...base, reportUri: "https://reports.example.eu/csp" }),
    ).toContain("report-uri https://reports.example.eu/csp");
  });
});

describe("buildCsp: development and report-only", () => {
  const dev = buildCsp({ ...base, development: true });

  it("development adds eval (React's debugging), inline styles and websockets, nothing else", () => {
    expect(directive(dev, "script-src")).toContain("'unsafe-eval'");
    expect(directive(dev, "style-src")).toContain("'unsafe-inline'");
    expect(directive(dev, "connect-src")).toEqual(["'self'", "ws:", "wss:"]);
  });

  it("production NEVER contains unsafe-eval, ws: or a script unsafe-inline (negative)", () => {
    for (const enforcing of [true, false]) {
      const csp = buildCsp({ ...base, enforcing });

      expect(csp).not.toContain("'unsafe-eval'");
      expect(csp).not.toMatch(/\bwss?:/);
      expect(directive(csp, "script-src")).not.toContain("'unsafe-inline'");
    }
  });

  it("development never upgrades requests (http://localhost would break)", () => {
    expect(dev).not.toContain("upgrade-insecure-requests");
  });

  it("a report-only policy omits upgrade-insecure-requests (browsers ignore it there and warn)", () => {
    expect(buildCsp({ ...base, enforcing: false })).not.toContain(
      "upgrade-insecure-requests",
    );
  });
});

describe("generateNonce", () => {
  it("is 16 random bytes in base64 (128 bits)", () => {
    const nonce = generateNonce();

    expect(nonce).toMatch(/^[A-Za-z0-9+/]{22}==$/);
    expect(atob(nonce)).toHaveLength(16);
  });

  it("is unique per call: 1000 draws, no repeat", () => {
    expect(new Set(Array.from({ length: 1000 }, generateNonce)).size).toBe(
      1000,
    );
  });

  it("cannot break out of the CSP value (no quote, semicolon, space or newline)", () => {
    for (let i = 0; i < 200; i++)
      expect(generateNonce()).not.toMatch(/['"; \r\n,]/);
  });
});

describe("cspHeaderName", () => {
  it("enforce blocks, report-only observes, off sends nothing", () => {
    expect(cspHeaderName("enforce")).toBe("Content-Security-Policy");
    expect(cspHeaderName("report-only")).toBe(
      "Content-Security-Policy-Report-Only",
    );
    expect(cspHeaderName("off")).toBeNull();
  });
});

describe("securityHeaders", () => {
  const production = Object.fromEntries(securityHeaders({ production: true }));
  const development = Object.fromEntries(
    securityHeaders({ production: false }),
  );

  it("sets the fixed headers", () => {
    expect(production).toMatchObject({
      "X-Content-Type-Options": "nosniff",
      "Referrer-Policy": "strict-origin-when-cross-origin",
      "X-Frame-Options": "DENY",
      "Cross-Origin-Opener-Policy": "same-origin",
    });
  });

  it("denies camera, microphone and geolocation", () => {
    for (const feature of ["camera", "microphone", "geolocation"]) {
      expect(production["Permissions-Policy"]).toContain(`${feature}=()`);
    }
  });

  it("HSTS: two years, subdomains, preload, in production only", () => {
    expect(production["Strict-Transport-Security"]).toBe(
      "max-age=63072000; includeSubDomains; preload",
    );
    expect(development["Strict-Transport-Security"]).toBeUndefined();
  });

  it("every value is a single line (no header injection)", () => {
    for (const [name, value] of securityHeaders({ production: true })) {
      expect(name + value).not.toMatch(/[\r\n]/);
    }
  });
});
