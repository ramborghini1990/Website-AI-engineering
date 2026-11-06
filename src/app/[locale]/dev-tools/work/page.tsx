import type { Metadata } from "next";

import { WorkDetail } from "@/components/work/work-detail";
import { WorkIndex } from "@/components/work/work-index";
import { workSchema } from "@/lib/content/schemas";
import { filterOptions, parseWorkFilters } from "@/lib/content/work-filter";

export const metadata: Metadata = {
  title: "Work UI (dev)",
  robots: { index: false, follow: false },
};

/**
 * Dev-only fixtures for the Work pages. Every real entry is a draft today, so
 * the production /work shows its empty state; this page renders the same
 * components with SYNTHETIC published entries (two demos, one consented case
 * study) so the filters, the cards and the detail template are checked in a
 * browser (e2e/work-gallery.spec.ts). Nothing here describes a real client.
 */
const fixtures = [
  {
    slug: "fixture-lead-agent",
    data: workSchema.parse({
      title: "Fixture demo: an agent that sorts incoming messages",
      summary:
        "A synthetic demo entry used only to test the work index, its filters and its cards.",
      seoTitle: "Fixture demo for tests",
      description:
        "A synthetic demo entry used only to test the work index, its filters, its cards and the detail template in a browser.",
      kind: "demo",
      status: "live",
      draft: false,
      clientConsent: false,
      sector: "Fixture sector A",
      stack: ["TypeScript", "Claude API"],
      service: "ai-agents",
    }),
  },
  {
    slug: "fixture-document-demo",
    data: workSchema.parse({
      title: "Fixture demo: reading sample documents",
      summary:
        "A second synthetic demo entry in another sector, so a filter has something to choose.",
      seoTitle: "Second fixture demo for tests",
      description:
        "A second synthetic demo entry in another sector, used only to test the filters of the work index in a browser.",
      kind: "demo",
      status: "live",
      draft: false,
      clientConsent: false,
      sector: "Fixture sector B",
      stack: ["TypeScript", "PostgreSQL"],
      service: "document-intelligence",
    }),
  },
  {
    slug: "fixture-case-study",
    data: workSchema.parse({
      title: "Fixture case study with a consenting client",
      summary:
        "A synthetic case study: the client name and the results appear only because the fixture says consent was given.",
      seoTitle: "Fixture case study for tests",
      description:
        "A synthetic case study used only to test that a consenting client and its results are shown on the work pages.",
      kind: "project",
      status: "live",
      draft: false,
      clientConsent: true,
      client: "Fixture Client S.r.l.",
      sector: "Fixture sector A",
      outcomes: [{ label: "Fixture metric", value: "A synthetic value" }],
      stack: ["Next.js", "TypeScript"],
      service: "web-applications",
      publishedAt: "2026-01-15",
    }),
  },
];

const BODY =
  "## Fixture heading\n\nThis body is rendered by the same Markdown renderer as the real entries, with a [link to the services](/services).\n\n- a list item\n- another list item\n";

export default async function WorkDevPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const query = await searchParams;
  const detail = typeof query.detail === "string" ? query.detail : undefined;
  const entry = fixtures.find((fixture) => fixture.slug === detail);

  if (entry) {
    return (
      <WorkDetail
        work={entry.data}
        body={BODY}
        service={{ slug: entry.data.service, title: "The related service" }}
      />
    );
  }
  return (
    <WorkIndex
      entries={fixtures}
      filters={parseWorkFilters(query, filterOptions(fixtures))}
      basePath="/_dev/work"
      entryHref={(slug) => `/_dev/work?detail=${slug}`}
    />
  );
}
