import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getLocale, getMessages } from "next-intl/server";

import { BusinessSection } from "@/components/demos/business/business-section";
import { DocintelSection } from "@/components/demos/docintel/docintel-section";
import { InstagramSection } from "@/components/demos/instagram/instagram-section";
import { LinkedinSection } from "@/components/demos/linkedin/linkedin-section";
import { WorkDetail } from "@/components/work/work-detail";
import { getServices, getWork } from "@/lib/content/read";
import { isInteractiveDemo } from "@/lib/demos/registry";
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

  // An entry with an interactive demo shows it (simulation: nothing is requested from a server).
  const messages = await getMessages();
  let demo = null;
  if (isInteractiveDemo(entry.slug)) {
    switch (entry.slug) {
      case "business-management-app":
        demo = (
          <BusinessSection
            locale={locale}
            messages={{
              demos: {
                shell: messages.demos.shell,
                business: messages.demos.business,
              },
            }}
          />
        );
        break;
      case "document-intelligence-demo":
        demo = (
          <DocintelSection
            locale={locale}
            messages={{
              demos: {
                shell: messages.demos.shell,
                docIntel: messages.demos.docIntel,
              },
            }}
          />
        );
        break;
      case "linkedin-assisted-outreach":
        demo = (
          <LinkedinSection
            locale={locale}
            messages={{
              demos: {
                shell: messages.demos.shell,
                linkedin: messages.demos.linkedin,
              },
            }}
          />
        );
        break;
      case "instagram-lead-agent":
        demo = (
          <InstagramSection
            locale={locale}
            messages={{
              demos: {
                shell: messages.demos.shell,
                instagram: messages.demos.instagram,
              },
            }}
          />
        );
        break;
    }
  }

  return (
    <WorkDetail
      work={entry.data}
      body={entry.body}
      demo={demo}
      service={
        service ? { slug: service.slug, title: service.data.title } : null
      }
    />
  );
}
