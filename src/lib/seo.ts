import type { Metadata } from "next";

import { routing, type Locale } from "@/i18n/routing";

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
