// @vitest-environment node
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

import en from "../../../messages/en.json";
import it_ from "../../../messages/it.json";
import { WINDOW_DAYS, products, supplierIds } from "./business/fixtures";
import { documentIds, documents } from "./docintel/fixtures";
import { demoFacts } from "./facts";
import { fixtures } from "./instagram/fixtures";
import { prospects } from "./linkedin/fixtures";
import { interactiveDemos } from "./registry";

/**
 * The badges on the work cards: every count equals a fixture, every quality is
 * in an explicit table (each one backed by a sentence of the demo's page, cited
 * in facts.ts), and a slug that is not an interactive demo has no facts.
 */

const countOf = (slug: string, key: string) =>
  demoFacts(slug).counts.find((entry) => entry.key === key)?.count;

describe("facts.ts never types a count in", () => {
  it("has no numeric literal after `count:` (a hard-coded 12 would pass until the fixtures change)", () => {
    const source = readFileSync(
      fileURLToPath(new URL("./facts.ts", import.meta.url)),
      "utf8",
    );
    expect(source).not.toMatch(/count:\s*-?\d/);
    expect(source).not.toMatch(/count:\s*\w+\.length\s*[-+*]/);
  });
});

describe("demoFacts counts come from the fixtures", () => {
  it("instagram: the sample inbox", () => {
    expect(demoFacts("instagram-lead-agent").counts).toEqual([
      { key: "messages", count: fixtures.length },
    ]);
  });

  it("linkedin: the sample prospects", () => {
    expect(demoFacts("linkedin-assisted-outreach").counts).toEqual([
      { key: "prospects", count: prospects.length },
    ]);
  });

  it("document intelligence: documents, fields and the fields flagged for a person", () => {
    const fields = documentIds.flatMap((id) => documents[id].fields);
    expect(countOf("document-intelligence-demo", "documents")).toBe(
      documentIds.length,
    );
    expect(countOf("document-intelligence-demo", "fields")).toBe(fields.length);
    expect(countOf("document-intelligence-demo", "flagged")).toBe(
      fields.filter((field) => field.review !== undefined).length,
    );
    // the page says each document has something for a person to look at
    expect(
      countOf("document-intelligence-demo", "flagged"),
    ).toBeGreaterThanOrEqual(documentIds.length);
  });

  it("business: products, suppliers and days of history", () => {
    expect(demoFacts("business-management-app").counts).toEqual([
      { key: "products", count: products.length },
      { key: "suppliers", count: supplierIds.length },
      { key: "days", count: WINDOW_DAYS },
    ]);
  });

  it("no count is zero (a badge of '0 ...' would be noise)", () => {
    for (const slug of interactiveDemos) {
      for (const { key, count } of demoFacts(slug).counts) {
        expect(count, `${slug} ${key}`).toBeGreaterThan(0);
      }
    }
  });
});

describe("demoFacts qualities", () => {
  const expected = {
    "instagram-lead-agent": ["synthetic", "humanApproval"],
    "linkedin-assisted-outreach": ["synthetic", "humanApproval"],
    "document-intelligence-demo": ["synthetic", "humanApproval", "noNetwork"],
    "business-management-app": ["synthetic", "inBrowser", "noServerWrites"],
  } as const;

  it.each(Object.entries(expected))("%s", (slug, qualities) => {
    expect(demoFacts(slug).qualities).toEqual(qualities);
  });

  it("has facts for every interactive demo", () => {
    expect(Object.keys(expected).sort()).toEqual([...interactiveDemos].sort());
    for (const slug of interactiveDemos) {
      const { counts, qualities } = demoFacts(slug);
      expect(counts.length + qualities.length, slug).toBeGreaterThan(1);
    }
  });
});

describe("a slug that is not an interactive demo has no facts (negative)", () => {
  it.each([
    "fixture-case-study",
    "not-a-demo",
    "",
    "constructor",
    "__proto__",
    "../instagram-lead-agent",
  ])("%j", (slug) => {
    expect(demoFacts(slug)).toEqual({ counts: [], qualities: [] });
  });
});

describe("the badge messages", () => {
  const PLURAL =
    // The space before the last brace keeps "}}" out of the copy: the claims lint reads it as an unfilled template marker.
    /^\{count, plural, one \{[^{}]*#[^{}]*\} other \{[^{}]*#[^{}]*\} \}$/;
  const used = interactiveDemos.flatMap((slug) => demoFacts(slug).counts);

  for (const [locale, messages] of Object.entries({ it: it_, en })) {
    it(`${locale}: every count has an ICU plural with a "one" and an "other" branch`, () => {
      const counts = messages.work.facts.counts as Record<string, string>;
      for (const { key } of used) {
        expect(counts[key], `${locale} counts.${key}`).toMatch(PLURAL);
      }
    });

    it(`${locale}: every quality used has a message, and no message is unused`, () => {
      const qualities = messages.work.facts.qualities as Record<string, string>;
      const usedQualities = new Set(
        interactiveDemos.flatMap((slug) => demoFacts(slug).qualities),
      );
      expect(Object.keys(qualities).sort()).toEqual([...usedQualities].sort());
      expect(Object.keys(messages.work.facts.counts).sort()).toEqual(
        [...new Set(used.map(({ key }) => key))].sort(),
      );
    });
  }
});
