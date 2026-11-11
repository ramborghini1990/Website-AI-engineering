import type {
  DocumentSpec,
  FieldSpec,
  QuestionSpec,
  Review,
  Unit,
} from "@/lib/demos/docintel/fixtures";

/**
 * The rules of the document-intelligence simulation (P3.3). Given the text of a
 * sample document, a field is READ by finding its evidence in its section and
 * parsing it; a question is ANSWERED only from fields already read, and every
 * answer points back to the exact sentence, section and page it came from.
 * Pure and deterministic: no network, no model, nothing random. A value that
 * cannot be found or parsed is reported as missing, never guessed.
 */

type DocSection = { id: string; page: number; text: string };
export type DocText = { sections: readonly DocSection[] };

export type Value =
  | { kind: "text"; text: string }
  | { kind: "date"; iso: string }
  | { kind: "money"; cents: number }
  | { kind: "number"; n: number; unit?: Unit }
  | { kind: "percent"; n: number };

/** read: found and parsed. review: found, but the original is unclear. missing: not found or not parseable. */
type FieldStatus = "read" | "review" | "missing";

export type FieldResult = {
  id: string;
  status: FieldStatus;
  review: Review | null;
  value: Value | null;
  /** The characters the value was read from, exactly as in the document. */
  raw: string | null;
  section: string;
  page: number;
  /** Offsets of the evidence inside its section's text. */
  start: number;
  end: number;
};

/** Where `evidence` sits in `text`: its first occurrence, or null. */
export function locate(
  text: string,
  evidence: string,
): { start: number; end: number } | null {
  if (evidence === "") return null;
  const start = text.indexOf(evidence);
  return start === -1 ? null : { start, end: start + evidence.length };
}

const MONEY = /^€\s?(\d{1,3}(?:\.\d{3})*),(\d{2})$/;
const DATE = /^(\d{2})\/(\d{2})\/(\d{4})$/;

/** Parse the raw characters as the field's kind. Null when they do not fit. */
export function parseValue(spec: FieldSpec, raw: string): Value | null {
  switch (spec.kind) {
    case "text": {
      const text = raw.trim();
      return text === "" ? null : { kind: "text", text };
    }
    case "money": {
      const match = MONEY.exec(raw);
      if (match === null) return null;
      const euros = Number(match[1].replaceAll(".", ""));
      return { kind: "money", cents: euros * 100 + Number(match[2]) };
    }
    case "date": {
      const match = DATE.exec(raw);
      if (match === null) return null;
      const [day, month, year] = [match[1], match[2], match[3]].map(Number) as [
        number,
        number,
        number,
      ];
      const probe = new Date(Date.UTC(year, month - 1, day));
      // Rejects 31/02 and the like: the date must survive the round trip.
      if (
        probe.getUTCFullYear() !== year ||
        probe.getUTCMonth() !== month - 1 ||
        probe.getUTCDate() !== day
      ) {
        return null;
      }
      return {
        kind: "date",
        iso: `${match[3]}-${match[2]}-${match[1]}`,
      };
    }
    case "number":
      return /^\d+$/.test(raw)
        ? { kind: "number", n: Number(raw), unit: spec.unit }
        : null;
    case "percent": {
      const match = /^(\d{1,3})%$/.exec(raw);
      return match === null ? null : { kind: "percent", n: Number(match[1]) };
    }
  }
}

/** Read one field from the document. Never throws: a problem is a `missing` result. */
export function extractField(
  spec: FieldSpec,
  document: DocText,
  page: number,
): FieldResult {
  const base = {
    id: spec.id,
    section: spec.section,
    page,
    review: spec.review ?? null,
  };
  const section = document.sections.find((s) => s.id === spec.section);
  const at = section ? locate(section.text, spec.evidence) : null;
  const value = at === null ? null : parseValue(spec, spec.evidence);
  if (section === undefined || at === null || value === null) {
    return {
      ...base,
      status: "missing",
      value: null,
      raw: null,
      start: 0,
      end: 0,
    };
  }
  return {
    ...base,
    status: spec.review === undefined ? "read" : "review",
    value,
    raw: spec.evidence,
    start: at.start,
    end: at.end,
  };
}

/** The whole line of a section's text that contains offset `at`: the exact sentence to quote. */
export function lineAt(text: string, at: number): string {
  const from = text.lastIndexOf("\n", at - 1) + 1;
  const next = text.indexOf("\n", at);
  return text.slice(from, next === -1 ? text.length : next).trim();
}

const centsOf = (result: FieldResult | undefined): number | null =>
  result?.value?.kind === "money" ? result.value.cents : null;

/** Do the parts add up to the total? "unavailable" when a figure was not read. */
export function sumCheck(
  spec: DocumentSpec,
  results: readonly FieldResult[],
): "ok" | "mismatch" | "unavailable" | null {
  if (spec.sumCheck === undefined) return null;
  const find = (id: string) => results.find((r) => r.id === id);
  const parts = spec.sumCheck.parts.map((id) => centsOf(find(id)));
  const total = centsOf(find(spec.sumCheck.total));
  if (total === null || parts.some((part) => part === null)) {
    return "unavailable";
  }
  const sum = parts.reduce<number>((acc, part) => acc + (part ?? 0), 0);
  return sum === total ? "ok" : "mismatch";
}

type Citation = {
  section: string;
  page: number;
  /** The exact sentence in the document. */
  quote: string;
  /** The fields this sentence supports. */
  fields: string[];
};

export type Answer =
  | { status: "answered"; citations: Citation[]; needsCheck: boolean }
  | { status: "notFound" };

/**
 * Answer a question from the fields already read. A question with no fields, or
 * with a field that was not read, is `notFound`: the demo says it cannot find
 * it rather than guess. Citations are derived from the evidence, one per
 * sentence, in document order.
 */
export function answerQuestion(
  question: QuestionSpec,
  results: readonly FieldResult[],
  document: DocText,
): Answer {
  if (question.fields.length === 0) return { status: "notFound" };
  const used = question.fields.map((id) => results.find((r) => r.id === id));
  if (used.some((r) => r === undefined || r.status === "missing")) {
    return { status: "notFound" };
  }
  const citations: Citation[] = [];
  for (const result of used) {
    if (result === undefined) continue;
    const text =
      document.sections.find((s) => s.id === result.section)?.text ?? "";
    const quote = lineAt(text, result.start);
    const existing = citations.find(
      (c) => c.section === result.section && c.quote === quote,
    );
    if (existing === undefined) {
      citations.push({
        section: result.section,
        page: result.page,
        quote,
        fields: [result.id],
      });
    } else {
      existing.fields.push(result.id);
    }
  }
  const order = (c: Citation) =>
    document.sections.findIndex((s) => s.id === c.section);
  citations.sort((a, b) => order(a) - order(b));
  return {
    status: "answered",
    citations,
    needsCheck: used.some((r) => r?.status === "review"),
  };
}

/** Tallies for the summary line. `checked` counts only flagged fields the person marked. */
export function tally(
  results: readonly FieldResult[],
  checked: readonly string[],
): { read: number; review: number; missing: number; checked: number } {
  return {
    read: results.filter((r) => r.status === "read").length,
    review: results.filter((r) => r.status === "review").length,
    missing: results.filter((r) => r.status === "missing").length,
    checked: results.filter(
      (r) => r.status === "review" && checked.includes(r.id),
    ).length,
  };
}
