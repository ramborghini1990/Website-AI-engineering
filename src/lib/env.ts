/**
 * Minimal stand-in for the validated env module (CLAUDE.md §6: environment is
 * read only here). P1.7 replaces this file with the Zod server/client schemas;
 * keep the exported names so callers do not change.
 */

/** True only under `next dev`. Production builds and tests are never "development". */
export const isDevelopment = process.env.NODE_ENV === "development";

type SiteUrlEnv = {
  NEXT_PUBLIC_SITE_URL?: string | undefined;
  VERCEL_ENV?: string | undefined;
  VERCEL_PROJECT_PRODUCTION_URL?: string | undefined;
  VERCEL_URL?: string | undefined;
};

const present = (value: string | undefined) =>
  value !== undefined && value.trim() !== "" ? value.trim() : undefined;

/**
 * Absolute origin of the site, used for canonical and hreflang URLs.
 * Order: explicit NEXT_PUBLIC_SITE_URL, then Vercel's production domain (only
 * on production deployments), then the per-deployment Vercel URL (previews),
 * then localhost. Throws on an invalid explicit value: a wrong origin in
 * hreflang would silently hurt SEO, so failing the build is better.
 */
export function resolveSiteUrl(env: SiteUrlEnv): URL {
  const explicit = present(env.NEXT_PUBLIC_SITE_URL);
  if (explicit !== undefined) {
    try {
      return new URL(explicit);
    } catch {
      throw new Error("NEXT_PUBLIC_SITE_URL is not a valid absolute URL");
    }
  }

  const production = present(env.VERCEL_PROJECT_PRODUCTION_URL);
  if (env.VERCEL_ENV === "production" && production !== undefined) {
    return new URL(`https://${production}`);
  }

  const deployment = present(env.VERCEL_URL);
  if (deployment !== undefined) return new URL(`https://${deployment}`);

  return new URL("http://localhost:3000");
}

export const siteUrl = resolveSiteUrl({
  NEXT_PUBLIC_SITE_URL: process.env.NEXT_PUBLIC_SITE_URL,
  VERCEL_ENV: process.env.VERCEL_ENV,
  VERCEL_PROJECT_PRODUCTION_URL: process.env.VERCEL_PROJECT_PRODUCTION_URL,
  VERCEL_URL: process.env.VERCEL_URL,
});
