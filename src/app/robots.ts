import type { MetadataRoute } from "next";

import { env, siteUrl } from "@/lib/env";
import { buildRobots } from "@/lib/robots";

/**
 * /robots.txt. `VERCEL_ENV` is unset on a laptop and in CI (crawlable, so the
 * tests can read the real rules) and "production" or "preview" on Vercel: only
 * production is indexable.
 */
export default function robots(): MetadataRoute.Robots {
  return buildRobots({
    origin: siteUrl.origin,
    indexable: env.VERCEL_ENV === undefined || env.VERCEL_ENV === "production",
  });
}
