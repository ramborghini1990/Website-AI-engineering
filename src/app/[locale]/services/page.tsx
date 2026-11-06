import type { Metadata } from "next";
import { getLocale, getTranslations } from "next-intl/server";

import { ServicesIndex } from "@/components/services/services-index";
import { getServices } from "@/lib/content/read";
import { localeAlternates } from "@/lib/seo";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("metadata.services");
  const locale = await getLocale();
  return {
    // Child segment: the layout's `title.template` appends the brand.
    title: t("title"),
    description: t("description"),
    alternates: localeAlternates(locale, "/services"),
  };
}

/** /services (P2.3): the four services from the content collection. */
export default async function ServicesPage() {
  const locale = await getLocale();
  return <ServicesIndex services={getServices(locale)} />;
}
