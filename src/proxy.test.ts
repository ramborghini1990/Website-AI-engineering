// @vitest-environment node
import { NextRequest } from "next/server";
import { describe, expect, it } from "vitest";

import proxy, { config } from "@/proxy";

function request(path: string, acceptLanguage?: string) {
  return new NextRequest(`http://localhost${path}`, {
    headers: acceptLanguage ? { "accept-language": acceptLanguage } : {},
  });
}

/** Next anchors the matcher; same semantics as a plain anchored RegExp here. */
const matcher = new RegExp(`^${config.matcher}$`);

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
