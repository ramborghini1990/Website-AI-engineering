import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getLocale } from "next-intl/server";

import { WorkDetail } from "@/components/work/work-detail";
import { getServices, getWork } from "@/lib/content/read";
import { pageMetadata } from "@/lib/seo";

/**
 * The PUBLISHED entry for this URL, or null. `getWork()` leaves drafts out, so
 * a draft or planned entry is a 404 even though its file exists: it is never
 * rendered, never linked, never in the metadata.
 */
async function findWork(slug: string) {
  const locale = await getLocale();
  const entry = getWork(locale).find((candidate) => candidate.slug === slug);
  return { locale, entry: entry ?? null };
}

export async function generateMetadata({
  params,
}: PageProps<"/[locale]/work/[slug]">): Promise<Metadata> {
  const { slug } = await params;
  const { locale, entry } = await findWork(slug);
  if (entry === null) return {};
  return pageMetadata({
    locale,
    path: `/work/${entry.slug}`,
    ogKey: `work/${entry.slug}`,
    title: entry.data.seoTitle,
    description: entry.data.description,
  });
}

/** /work/<slug> (P2.4): one published demo or case study, from `content/work/<locale>/<slug>.mdx`. */
export default async function WorkEntryPage({
  params,
}: PageProps<"/[locale]/work/[slug]">) {
  const { slug } = await params;
  const { locale, entry } = await findWork(slug);
  if (entry === null) notFound();

  const service = getServices(locale).find(
    (candidate) => candidate.slug === entry.data.service,
  );

  return (
    <WorkDetail
      work={entry.data}
      body={entry.body}
      service={
        service ? { slug: service.slug, title: service.data.title } : null
      }
    />
  );
}
