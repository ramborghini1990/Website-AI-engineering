import type { MetadataRoute } from "next";

import { routing } from "@/i18n/routing";

/**
 * The sitemap as a pure function of the pages (`src/app/sitemap.ts` supplies
 * them). Every page appears once per language, and each entry lists ALL its
 * language versions (hreflang), `x-default` included, so a crawler that finds
 * one version learns the others. The alternates are the same ones the page
 * itself declares (`localeAlternates` in `seo.ts`); the e2e test crawls both and
 * checks they agree.
 *
 * `changeFrequency` and `priority` are hints: Google says it ignores them, other
 * crawlers may use them. `lastModified` is set only when a real date exists
 * (a published project's date); a file's modification time is the deploy time
 * on a CI checkout, which would be a false statement.
 */

export type SitemapPage = {
  /** Path without the locale prefix ("/" for home). */
  path: string;
  changeFrequency: NonNullable<
    MetadataRoute.Sitemap[number]["changeFrequency"]
  >;
  priority: number;
  /** ISO date, only when it is known. */
  lastModified?: string;
};

export function buildSitemap(
  origin: string,
  pages: readonly SitemapPage[],
): MetadataRoute.Sitemap {
  const base = origin.replace(/\/+$/, "");
  const url = (locale: string, path: string) =>
    `${base}/${locale}${path === "/" ? "" : path}`;

  return pages.flatMap((page) => {
    const languages: Record<string, string> = {};
    for (const locale of routing.locales)
      languages[locale] = url(locale, page.path);
    languages["x-default"] = url(routing.defaultLocale, page.path);

    return routing.locales.map((locale) => ({
      url: url(locale, page.path),
      ...(page.lastModified !== undefined
        ? { lastModified: page.lastModified }
        : {}),
      changeFrequency: page.changeFrequency,
      priority: page.priority,
      alternates: { languages },
    }));
  });
}
