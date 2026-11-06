import type { Metadata } from "next";
import { getLocale, getTranslations } from "next-intl/server";

import { WorkIndex } from "@/components/work/work-index";
import { getWork } from "@/lib/content/read";
import { filterOptions, parseWorkFilters } from "@/lib/content/work-filter";
import { localeAlternates } from "@/lib/seo";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("metadata.work");
  const locale = await getLocale();
  return {
    // Child segment: the layout's `title.template` appends the brand.
    title: t("title"),
    description: t("description"),
    // A filtered view (`?kind=demo`) has the same canonical URL as the index.
    alternates: localeAlternates(locale, "/work"),
  };
}

/**
 * /work (P2.4): the PUBLISHED demos and case studies (`getWork()` leaves
 * drafts out), filterable by type, sector and technology through the query
 * string. Today every entry is a draft, so the page shows its empty state.
 */
export default async function WorkPage({
  searchParams,
}: PageProps<"/[locale]/work">) {
  const locale = await getLocale();
  const entries = getWork(locale);
  const filters = parseWorkFilters(await searchParams, filterOptions(entries));

  return <WorkIndex entries={entries} filters={filters} />;
}
