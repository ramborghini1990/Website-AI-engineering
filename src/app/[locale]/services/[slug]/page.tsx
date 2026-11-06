import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getLocale, getTranslations } from "next-intl/server";

import { JsonLd } from "@/components/content/json-ld";
import { ServiceDetail } from "@/components/services/service-detail";
import { business } from "@/lib/business";
import { siteUrl } from "@/lib/env";
import { demoFor } from "@/lib/content/demo-link";
import { getServices, getWork } from "@/lib/content/read";
import { isPageAvailable } from "@/lib/navigation";
import { localeAlternates } from "@/lib/seo";
import { serviceJsonLd } from "@/lib/structured-data";

/** The service for this URL, or null (an unknown slug is a 404, never an error page). */
async function findService(slug: string) {
  const locale = await getLocale();
  const entry = getServices(locale).find(
    (candidate) => candidate.slug === slug,
  );
  return { locale, entry: entry ?? null };
}

export async function generateMetadata({
  params,
}: PageProps<"/[locale]/services/[slug]">): Promise<Metadata> {
  const { slug } = await params;
  const { locale, entry } = await findService(slug);
  if (entry === null) return {};
  return {
    // Child segment: the layout's `title.template` appends the brand.
    title: entry.data.seoTitle,
    description: entry.data.description,
    alternates: localeAlternates(locale, `/services/${entry.slug}`),
  };
}

/**
 * /services/<slug> (P2.3): one service from `content/services/<locale>/<slug>.mdx`
 * with its structured data. The demo is linked only when that work entry is
 * published AND its page exists; today neither is true, so no demo link renders
 * (docs/CONTENT.md: a demo is never advertised before it exists).
 */
export default async function ServicePage({
  params,
}: PageProps<"/[locale]/services/[slug]">) {
  const { slug } = await params;
  const { locale, entry } = await findService(slug);
  if (entry === null) notFound();

  const demo = demoFor(
    entry.data.demo,
    getWork(locale),
    isPageAvailable("work"),
  );

  const nav = await getTranslations("nav.items");
  const services = await getTranslations("services");

  return (
    <>
      <JsonLd
        data={serviceJsonLd({
          origin: siteUrl.origin,
          locale,
          slug: entry.slug,
          service: entry.data,
          business,
          breadcrumb: { home: nav("home"), services: services("title") },
        })}
      />
      <ServiceDetail service={entry.data} body={entry.body} demo={demo} />
    </>
  );
}
