import { z } from "zod";

/**
 * The four legal documents (P4.2), in both languages, under
 * `content/legal/<locale>/<key>.mdx`. Italian is authoritative (the English text
 * is a courtesy translation: `legal.authoritative` in the messages says so).
 *
 * Each file is a version of the document: its `version` and `updated` date are
 * shown on the page, so a visitor and a reviewer can tell which text applied
 * when. Change the text → bump both (a test fails if `updated` is in the future
 * or the version has no form `YYYY-MM-vN`).
 *
 * `status: "draft"` shows a visible notice that the text is awaiting review by
 * a qualified professional (CLAUDE.md §11, blocker B4). Flip it to `published`
 * only after that review.
 */
export const legalKeys = [
  "privacy",
  "cookie-policy",
  "legal",
  "terms",
] as const;
export type LegalKey = (typeof legalKeys)[number];

/** Locale-less paths (the i18n `Link` adds `/it` or `/en`). */
export const legalPaths = {
  privacy: "/privacy",
  "cookie-policy": "/cookie-policy",
  legal: "/legal",
  terms: "/terms",
} as const satisfies Record<LegalKey, string>;

const text = (min: number, max: number) => z.string().trim().min(min).max(max);

export const legalSchema = z.strictObject({
  /** The page heading (h1). */
  heading: text(8, 80),
  /** The opening paragraph under the heading. */
  lead: text(40, 320),
  seoTitle: text(12, 52),
  description: text(80, 160),
  /** `YYYY-MM-vN`: month of the text and its revision in that month. */
  version: z.string().regex(/^\d{4}-(0[1-9]|1[0-2])-v[1-9]\d*$/),
  /** The day this version of the text was written or last changed. */
  updated: z.iso.date(),
  status: z.enum(["draft", "published"]),
});

export type LegalFrontmatter = z.infer<typeof legalSchema>;

/**
 * Generated blocks a document can ask for with a line of its own,
 * `[[table:<name>]]`, so the lists that must not drift (what is stored in the
 * browser, who receives data) are printed from the registry and never typed.
 */
export const legalTableNames = [
  "storage",
  "third-parties",
  "processors",
  "business",
] as const;
export type LegalTableName = (typeof legalTableNames)[number];

export type LegalSegment =
  { kind: "markdown"; body: string } | { kind: "table"; name: LegalTableName };

const MARKER = /^\[\[table:([a-z-]+)\]\]$/;

/** Splits a body at its table markers. An unknown marker name is an error, never printed as text. */
export function splitLegalBody(body: string): LegalSegment[] {
  const segments: LegalSegment[] = [];
  let buffer: string[] = [];
  const flush = () => {
    if (buffer.join("").trim() !== "") {
      segments.push({ kind: "markdown", body: buffer.join("\n") });
    }
    buffer = [];
  };

  for (const line of body.replace(/\r\n/g, "\n").split("\n")) {
    const match = MARKER.exec(line.trim());
    if (match === null) {
      buffer.push(line);
      continue;
    }
    const name = match[1] as LegalTableName;
    if (!(legalTableNames as readonly string[]).includes(name)) {
      throw new Error(`Unknown legal table marker: ${name}`);
    }
    flush();
    segments.push({ kind: "table", name });
  }
  flush();
  return segments;
}

/** The tables each document must print, so none can be dropped by an edit. */
export const requiredTables: Record<LegalKey, readonly LegalTableName[]> = {
  privacy: ["business", "processors"],
  "cookie-policy": ["storage", "third-parties", "processors"],
  legal: ["business"],
  terms: [],
};
