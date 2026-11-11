import type { DemoEngine } from "@/lib/demos/types";
import {
  extractField,
  type DocText,
  type FieldResult,
} from "@/lib/demos/docintel/extract";
import type { DocumentSpec } from "@/lib/demos/docintel/fixtures";

/**
 * The simulation engine of the document-intelligence demo (`DemoEngine`, P3.3).
 * It streams one extracted field at a time, in the order the fixtures list
 * them, so the page can show the document being read. Deterministic: the same
 * document always gives the same fields. No network, no model, no upload: it
 * only ever reads the sample documents bundled with the page.
 */
export const docIntelEngine: DemoEngine<
  { spec: DocumentSpec; document: DocText },
  FieldResult
> = {
  id: "doc-intel",
  mode: "simulation",
  async *run({ spec, document }) {
    const pageOf = (section: string) =>
      spec.sections.find((s) => s.id === section)?.page ?? 1;
    for (const field of spec.fields) {
      // A real pipeline would await OCR and a model here; the yield keeps the same shape.
      await Promise.resolve();
      yield extractField(field, document, pageOf(field.section));
    }
  },
};
