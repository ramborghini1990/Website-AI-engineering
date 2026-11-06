import type { MetadataRoute } from "next";

/**
 * robots.txt as a pure function. A production site is crawlable except for the
 * development tools (which are a 404 outside `next dev`; listing them keeps a
 * crawler from even trying). Any other deployment (a Vercel preview) disallows
 * everything: a preview must never be indexed next to the real site.
 *
 * The confirmation page (`/contact/thanks`) is NOT disallowed on purpose: it
 * carries `noindex`, and a crawler that may not fetch a page can never see that
 * tag. Nothing links to it.
 */
export function buildRobots(options: {
  origin: string;
  indexable: boolean;
}): MetadataRoute.Robots {
  if (!options.indexable) {
    return { rules: [{ userAgent: "*", disallow: "/" }] };
  }
  return {
    rules: [
      {
        userAgent: "*",
        allow: "/",
        disallow: ["/*/_dev/", "/*/dev-tools/"],
      },
    ],
    sitemap: `${options.origin.replace(/\/+$/, "")}/sitemap.xml`,
  };
}
