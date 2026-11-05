import { describe, expect, it } from "vitest";

import { resolveSiteUrl } from "@/lib/env-schema";

describe("resolveSiteUrl", () => {
  it("prefers an explicit NEXT_PUBLIC_SITE_URL over everything", () => {
    const url = resolveSiteUrl({
      NEXT_PUBLIC_SITE_URL: "https://www.example.eu",
      VERCEL_ENV: "production",
      VERCEL_PROJECT_PRODUCTION_URL: "prod.vercel.app",
      VERCEL_URL: "deploy-123.vercel.app",
    });
    expect(url.origin).toBe("https://www.example.eu");
  });

  it("uses the Vercel production domain only on production deployments", () => {
    const base = {
      VERCEL_PROJECT_PRODUCTION_URL: "prod.vercel.app",
      VERCEL_URL: "deploy-123.vercel.app",
    };
    expect(resolveSiteUrl({ ...base, VERCEL_ENV: "production" }).origin).toBe(
      "https://prod.vercel.app",
    );
    expect(resolveSiteUrl({ ...base, VERCEL_ENV: "preview" }).origin).toBe(
      "https://deploy-123.vercel.app",
    );
  });

  it("falls back to localhost when nothing is configured", () => {
    expect(resolveSiteUrl({}).origin).toBe("http://localhost:3000");
  });

  it("treats blank values as unset", () => {
    expect(
      resolveSiteUrl({ NEXT_PUBLIC_SITE_URL: "   ", VERCEL_URL: "" }).origin,
    ).toBe("http://localhost:3000");
  });

  it("fails loudly on an invalid explicit URL instead of emitting wrong hreflang (negative)", () => {
    expect(() => resolveSiteUrl({ NEXT_PUBLIC_SITE_URL: "not a url" })).toThrow(
      /not a valid absolute URL/,
    );
  });
});
