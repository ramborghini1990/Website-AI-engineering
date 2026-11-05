import { defineRouting } from "next-intl/routing";

/**
 * Locale routing (decision D4: Italian default, English a full translation).
 *
 * - `localePrefix: "always"`: /it/... and /en/...; "/" redirects by Accept-Language.
 * - `localeCookie: false`: next-intl would set a `NEXT_LOCALE` cookie. We do not
 *   need to remember anything: the URL carries the choice. No cookie means one
 *   less storage item to document and no state about the visitor (GDPR data
 *   minimisation). Revisit only if a persistent preference is wanted, and then
 *   list the cookie in the cookie policy (P4.2).
 * - `alternateLinks: false`: hreflang is emitted once, in the HTML metadata
 *   (src/lib/seo.ts), not duplicated as a `Link` response header.
 */
export const routing = defineRouting({
  locales: ["it", "en"],
  defaultLocale: "it",
  localePrefix: "always",
  localeCookie: false,
  alternateLinks: false,
});

export type Locale = (typeof routing.locales)[number];
