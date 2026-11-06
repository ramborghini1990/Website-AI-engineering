import type { MetadataRoute } from "next";

import { siteUrl } from "@/lib/env";
import { buildSitemap } from "@/lib/sitemap";
import { sitemapPages } from "@/lib/sitemap-pages";

/** /sitemap.xml: every public page in both languages, with its hreflang alternates. */
export default function sitemap(): MetadataRoute.Sitemap {
  return buildSitemap(siteUrl.origin, sitemapPages());
}
