import type { Metadata } from "next";

import { routing, type Locale } from "@/i18n/routing";
import { business } from "@/lib/business";

/**
 * canonical + hreflang for a page, as relative paths: Next resolves them
 * against `metadataBase` (src/app/[locale]/layout.tsx), which is built from
 * `siteUrl`. `pathname` is the path WITHOUT the locale prefix ("/" for home).
 * `x-default` points at the default locale.
 */
export function localeAlternates(
  locale: Locale,
  pathname = "/",
): NonNullable<Metadata["alternates"]> {
  if (!pathname.startsWith("/")) {
    throw new Error(`pathname must start with "/": ${pathname}`);
  }
  const tail = pathname === "/" ? "" : pathname;
  const languages: Record<string, string> = {};
  for (const l of routing.locales) languages[l] = `/${l}${tail}`;
  languages["x-default"] = `/${routing.defaultLocale}${tail}`;

  return { canonical: `/${locale}${tail}`, languages };
}

/** Open Graph / Twitter image size (the 1.91:1 large-card format every network accepts). */
export const OG_SIZE = { width: 1200, height: 630 } as const;

/** `og:locale` values: language and region the page is written for. */
const OG_LOCALE: Record<Locale, string> = { it: "it_IT", en: "en_GB" };

/**
 * Path of the generated share image for a page (`src/app/[locale]/og/...`).
 * `key` is `home`, `services`, `services/<slug>`, `work`, `work/<slug>` or
 * `contact`; the route refuses anything that is not a real, published page.
 */
export function ogImagePath(locale: Locale, key: string): string {
  return `/${locale}/og/${key}`;
}

/**
 * Everything a public page says to search engines and social networks, in one
 * place so no page can forget part of it: title, description, canonical URL,
 * hreflang alternates (with `x-default`), and the Open Graph and Twitter cards
 * with the page's own generated image. URLs are relative: Next resolves them
 * against `metadataBase` (src/app/[locale]/layout.tsx).
 *
 * `title` is the page part only; the brand is appended. A page in the same
 * segment as the layout (Home) must set `absolute`, because the layout's
 * `title.template` only applies to child segments.
 */
export function pageMetadata(input: {
  locale: Locale;
  /** The path WITHOUT the locale prefix ("/" for home). */
  path: string;
  /** Key of the share image, see `ogImagePath`. */
  ogKey: string;
  title: string;
  description: string;
  absolute?: boolean;
}): Metadata {
  const { locale, path, ogKey, title, description } = input;
  const full = `${title} | ${business.brand.name}`;
  const alternates = localeAlternates(locale, path);
  const image = ogImagePath(locale, ogKey);

  return {
    title: input.absolute === true ? { absolute: full } : title,
    description,
    alternates,
    openGraph: {
      type: "website",
      siteName: business.brand.name,
      title: full,
      description,
      url: alternates.canonical as string,
      locale: OG_LOCALE[locale],
      alternateLocale: routing.locales
        .filter((other) => other !== locale)
        .map((other) => OG_LOCALE[other]),
      images: [{ url: image, ...OG_SIZE, alt: full }],
    },
    twitter: {
      card: "summary_large_image",
      title: full,
      description,
      images: [{ url: image, alt: full }],
    },
  };
}
