// @vitest-environment node
import { readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

import robots from "@/app/robots";
import sitemap from "@/app/sitemap";
import { resolveOgContent } from "@/lib/og/content";

/**
 * "Complete coverage of canonical URLs and localized alternates" (P2.6) as a
 * gate: every public page under src/app/[locale] gets its metadata from
 * `pageMetadata` (canonical, hreflang, Open Graph, Twitter, share image), so a
 * new page cannot ship without them. The only exceptions are listed here, each
 * with its reason.
 */

const appDir = path.join(process.cwd(), "src/app/[locale]");

function pages(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const full = path.join(dir, name);
    if (statSync(full).isDirectory()) return pages(full);
    return name === "page.tsx" ? [full] : [];
  });
}

const EXEMPT: Record<string, string> = {
  "[...rest]/page.tsx": "renders the 404",
  "dev-tools/fx/page.tsx": "development only, 404 in production",
  "dev-tools/motion/page.tsx": "development only, 404 in production",
  "dev-tools/ui/page.tsx": "development only, 404 in production",
  "dev-tools/work/page.tsx": "development only, 404 in production",
  "contact/thanks/page.tsx": "a confirmation: noindex, not a landing page",
};

const relative = (file: string) =>
  path.relative(appDir, file).replace(/\\/g, "/");

describe("every public page declares its SEO metadata through pageMetadata", () => {
  const all = pages(appDir).map((file) => ({
    name: relative(file),
    code: readFileSync(file, "utf8"),
  }));

  it("finds the pages it is meant to guard", () => {
    const names = all.map((page) => page.name);

    expect(names).toEqual(
      expect.arrayContaining([
        "page.tsx",
        "services/page.tsx",
        "services/[slug]/page.tsx",
        "work/page.tsx",
        "work/[slug]/page.tsx",
        "contact/page.tsx",
      ]),
    );
  });

  it("each page either calls pageMetadata (or legalMetadata, the legal pages' twin without a share image) or is a listed exception", () => {
    for (const page of all) {
      if (Object.keys(EXEMPT).includes(page.name)) continue;
      expect(page.code, page.name).toMatch(/\b(?:page|legal)Metadata\(/);
    }
  });

  it("legalMetadata gives the legal pages canonical + hreflang through localeAlternates, and the four legal routes use it", () => {
    const shared = readFileSync(
      path.join(process.cwd(), "src/lib/legal/page.tsx"),
      "utf8",
    );
    expect(shared).toContain("localeAlternates(");
    for (const route of ["privacy", "cookie-policy", "legal", "terms"]) {
      const page = all.find((entry) => entry.name === `${route}/page.tsx`);
      expect(page?.code, route).toContain("legalMetadata(");
    }
  });

  it("the exceptions that stay out of search engines say so", () => {
    const thanks = all.find((page) => page.name === "contact/thanks/page.tsx");

    expect(thanks?.code).toMatch(/robots:\s*\{\s*index:\s*false/);
    for (const dev of all.filter((page) =>
      page.name.startsWith("dev-tools/"),
    )) {
      expect(dev.code, dev.name).toMatch(/index:\s*false/);
    }
  });

  it("every static share-image key a page uses resolves to a real card (a typo would 404 the image)", () => {
    for (const page of all) {
      const key = /ogKey:\s*"([a-z/-]+)"/.exec(page.code)?.[1];
      if (key === undefined) continue;
      for (const locale of ["it", "en"] as const) {
        expect(
          resolveOgContent(locale, key.split("/"), "example.test"),
          `${page.name} ${locale}`,
        ).not.toBeNull();
      }
    }
  });
});

describe("the metadata routes of the real site", () => {
  it("the sitemap has entries for both languages of every page", () => {
    const entries = sitemap();
    const urls = entries.map((entry) => entry.url);

    expect(entries.length).toBeGreaterThanOrEqual(14);
    expect(urls.filter((url) => url.includes("/it")).length).toBe(
      urls.filter((url) => url.includes("/en")).length,
    );
    for (const entry of entries) {
      expect(Object.keys(entry.alternates?.languages ?? {}).sort()).toEqual([
        "en",
        "it",
        "x-default",
      ]);
    }
  });

  it("robots is crawlable here (no deployment variable) and names the sitemap", () => {
    const result = robots();

    expect(JSON.stringify(result.rules)).toContain('"allow":"/"');
    expect(result.sitemap).toMatch(/\/sitemap\.xml$/);
  });
});
