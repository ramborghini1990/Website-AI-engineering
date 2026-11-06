// @vitest-environment node
import { describe, expect, it } from "vitest";

import { routing } from "@/i18n/routing";
import { getServices, getWork } from "@/lib/content/read";
import { sitemapPages } from "@/lib/sitemap-pages";

describe("sitemapPages (the real site)", () => {
  const paths = sitemapPages().map((page) => page.path);

  it("lists the pages that exist: home, services, work and contact", () => {
    expect(paths).toEqual(
      expect.arrayContaining(["/", "/services", "/work", "/contact"]),
    );
  });

  it("lists every service detail page, in both languages' common set", () => {
    const slugs = getServices("it").map((service) => service.slug);

    expect(slugs.length).toBeGreaterThanOrEqual(4);
    for (const slug of slugs) expect(paths).toContain(`/services/${slug}`);
  });

  it("leaves out pages that are not built yet: no process and no about (negative)", () => {
    expect(paths).not.toContain("/process");
    expect(paths).not.toContain("/about");
  });

  it("leaves out the confirmation page, the dev tools and anything private (negative)", () => {
    for (const path of paths) {
      expect(path).not.toMatch(/thanks|dev-tools|_dev|\/og\//);
    }
  });

  it("lists no work entry that is a draft (negative): every one of them is today", () => {
    const published = routing.locales.flatMap((locale) =>
      getWork(locale).map((entry) => entry.slug),
    );

    for (const path of paths.filter((p) => p.startsWith("/work/"))) {
      expect(published).toContain(path.replace("/work/", ""));
    }
    expect(paths.filter((p) => p.startsWith("/work/"))).toHaveLength(
      new Set(published).size,
    );
  });

  it("has no duplicate path", () => {
    expect(new Set(paths).size).toBe(paths.length);
  });

  it("every path starts with a slash and has no locale prefix", () => {
    for (const path of paths) {
      expect(path).toMatch(/^\//);
      expect(path).not.toMatch(/^\/(?:it|en)(?:\/|$)/);
    }
  });
});
