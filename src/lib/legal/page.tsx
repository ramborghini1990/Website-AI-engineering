import "server-only";

import type { Metadata } from "next";
import { getLocale } from "next-intl/server";

import { LegalDocument } from "@/components/legal/legal-document";
import { business } from "@/lib/business";
import { legalPaths, type LegalKey } from "@/lib/legal/documents";
import { getLegalDocument } from "@/lib/legal/read";
import { localeAlternates } from "@/lib/seo";

/**
 * What the four legal pages share. Metadata comes from the document's own
 * frontmatter (title and description in the language of the page); canonical and
 * hreflang as for every page. There is no generated share image for these pages
 * on purpose: they are reference texts, not something to share, so the card
 * carries no picture (and they are not in the sitemap).
 */
export async function legalMetadata(key: LegalKey): Promise<Metadata> {
  const locale = await getLocale();
  const { data } = getLegalDocument(locale, key);
  const alternates = localeAlternates(locale, legalPaths[key]);
  const full = `${data.seoTitle} | ${business.brand.name}`;

  return {
    title: data.seoTitle,
    description: data.description,
    alternates,
    openGraph: {
      type: "website",
      siteName: business.brand.name,
      title: full,
      description: data.description,
      url: alternates.canonical as string,
    },
  };
}

export async function LegalPage({ docKey }: { docKey: LegalKey }) {
  const locale = await getLocale();
  const { data, body } = getLegalDocument(locale, docKey);
  return <LegalDocument current={docKey} data={data} body={body} />;
}
