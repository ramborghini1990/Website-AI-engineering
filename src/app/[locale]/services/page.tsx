import type { Metadata } from "next";
import { getLocale, getTranslations } from "next-intl/server";

import { ServicesIndex } from "@/components/services/services-index";
import { getServices } from "@/lib/content/read";
import { pageMetadata } from "@/lib/seo";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("metadata.services");
  const locale = await getLocale();
  return pageMetadata({
    locale,
    path: "/services",
    ogKey: "services",
    title: t("title"),
    description: t("description"),
  });
}

/** /services (P2.3): the four services from the content collection. */
export default async function ServicesPage() {
  const locale = await getLocale();
  return <ServicesIndex services={getServices(locale)} />;
}
