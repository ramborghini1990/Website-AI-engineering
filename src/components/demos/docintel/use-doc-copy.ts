import { useTranslations } from "next-intl";

import type { DocText } from "@/lib/demos/docintel/extract";
import { documents, type DocumentId } from "@/lib/demos/docintel/fixtures";

type Values = Record<string, string | number>;

/**
 * Access to `demos.docIntel` where the key is built from a document, section,
 * field or question id. Those ids come from the fixtures, not from the visitor,
 * and a test checks that every key exists in both languages, so the one cast
 * here is covered where the compiler cannot see it.
 */
export function useDocCopy() {
  const t = useTranslations("demos.docIntel");

  const text = (key: string, values?: Values): string =>
    t(key as never, values as never);

  /** The text of a sample document in the page's language: the input of the extraction rules. */
  const docText = (id: DocumentId): DocText => ({
    sections: documents[id].sections.map((section) => ({
      id: section.id,
      page: section.page,
      text: text(`docs.${id}.sections.${section.id}.text`),
    })),
  });

  return { text, docText };
}
