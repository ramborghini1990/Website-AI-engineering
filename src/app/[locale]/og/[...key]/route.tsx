import { ImageResponse } from "next/og";

import { routing } from "@/i18n/routing";
import { siteUrl } from "@/lib/env";
import { OgCard } from "@/lib/og/card";
import { resolveOgContent } from "@/lib/og/content";
import { OG_SIZE } from "@/lib/seo";

/**
 * /[locale]/og/<page key>: the Open Graph and Twitter share image of a page, in
 * its language (P2.6). The path alone decides what is drawn, and only for real,
 * public pages (`resolveOgContent`): a query string is ignored, an unknown or
 * draft page is a 404.
 *
 * The CDN may keep an image for a day and serve a stale one while it refreshes,
 * so a changed title reaches the cards without waiting for a year-long cache.
 */
export async function GET(
  _request: Request,
  context: RouteContext<"/[locale]/og/[...key]">,
) {
  const { locale, key } = await context.params;
  const language = routing.locales.find((candidate) => candidate === locale);
  if (language === undefined) return new Response(null, { status: 404 });

  const content = resolveOgContent(language, key, siteUrl.host);
  if (content === null) return new Response(null, { status: 404 });

  return new ImageResponse(
    <OgCard
      eyebrow={content.eyebrow}
      title={content.title}
      footer={content.footer}
      locale={language}
    />,
    {
      ...OG_SIZE,
      headers: {
        "Cache-Control":
          "public, max-age=0, s-maxage=86400, stale-while-revalidate=604800",
      },
    },
  );
}
