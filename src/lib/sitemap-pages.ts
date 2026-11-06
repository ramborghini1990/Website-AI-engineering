import "server-only";

import { routing } from "@/i18n/routing";
import { getServices, getWork } from "@/lib/content/read";
import { pageKeys, pagePaths, type PageKey } from "@/lib/content/site-map";
import { resolveInternalPath } from "@/lib/navigation";
import type { SitemapPage } from "@/lib/sitemap";

/**
 * Which pages the sitemap lists. Only pages that EXIST and are PUBLIC:
 * - a page that is not built yet (Process, About) is left out, like its links;
 * - a service is listed when it exists in every language (so no entry points at
 *   a 404 in the other one);
 * - a work entry only when it is published in every language: a draft is
 *   neither linked nor listed, and its URL is a 404 (docs/CONTENT.md);
 * - the confirmation page, the dev tools and the 404 are never listed.
 */

const STATIC: Record<
  PageKey,
  Pick<SitemapPage, "changeFrequency" | "priority">
> = {
  home: { changeFrequency: "weekly", priority: 1 },
  services: { changeFrequency: "monthly", priority: 0.8 },
  work: { changeFrequency: "weekly", priority: 0.6 },
  process: { changeFrequency: "monthly", priority: 0.6 },
  about: { changeFrequency: "yearly", priority: 0.5 },
  contact: { changeFrequency: "yearly", priority: 0.7 },
};

/** Slugs present in every language, in the first language's order. */
function common<T extends { slug: string }>(
  perLocale: ReadonlyArray<readonly T[]>,
): T[] {
  const [first = [], ...rest] = perLocale;
  return first.filter((entry) =>
    rest.every((others) => others.some((other) => other.slug === entry.slug)),
  );
}

export function sitemapPages(): SitemapPage[] {
  const pages: SitemapPage[] = [];

  for (const key of pageKeys) {
    const path = pagePaths[key];
    if (resolveInternalPath(path).kind !== "page") continue;
    pages.push({ path, ...STATIC[key] });
  }

  const services = common(routing.locales.map((locale) => getServices(locale)));
  for (const { slug } of services) {
    pages.push({
      path: `/services/${slug}`,
      changeFrequency: "monthly",
      priority: 0.7,
    });
  }

  const work = common(routing.locales.map((locale) => getWork(locale)));
  for (const { slug, data } of work) {
    pages.push({
      path: `/work/${slug}`,
      changeFrequency: "monthly",
      priority: 0.5,
      ...(data.publishedAt !== undefined
        ? { lastModified: data.publishedAt }
        : {}),
    });
  }

  return pages;
}
