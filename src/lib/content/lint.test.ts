// @vitest-environment node
import { describe, expect, it } from "vitest";

import { bodyProblems, claimProblems, wordCount } from "@/lib/content/lint";

const rules = {
  knownPaths: new Set(["/contact", "/process", "/services/ai-agents"]),
  minWords: 5,
  maxWords: 200,
};

const good = "## A heading\n\nSome plain prose that says something useful about the work.\n";

describe("claimProblems: unverifiable claims stay out (this practice has no published results yet)", () => {
  it.each([
    "Ho 10 anni di esperienza nel settore",
    "More than 12 years of experience",
    "Oltre 50 clienti soddisfatti",
    "Over 30 projects delivered",
    "Riduciamo i costi del 40 %",
    "Up to 100% faster",
    "Garantiamo il risultato",
    "We guarantee results",
    "Una soluzione conforme al GDPR",
    "A fully GDPR compliant platform",
    "Certified ISO 27001",
    "Una tecnologia rivoluzionaria",
    "State-of-the-art models",
    "An all'avanguardia platform",
    "A magic solution",
    "TODO write this",
    "Lorem ipsum dolor",
    "Hello {{name}}",
  ])("flags: %s (negative)", (text) => {
    expect(claimProblems(text).length, text).toBeGreaterThan(0);
  });

  it.each([
    "Test automatici, accessibilità e prestazioni controllati prima di ogni rilascio.",
    "I work with startups, SMEs and enterprises in Italy and the European Union.",
    "Uso l'AI dove i dati sono disordinati e lo dico quando non serve.",
    "Four phases, each with clear deliverables.",
    "Una o due conversazioni per chiarire gli obiettivi.",
    "Lavoro con le API ufficiali nel rispetto dei termini d'uso.",
  ])("lets ordinary, verifiable wording through: %s", (text) => {
    expect(claimProblems(text)).toEqual([]);
  });

  it("names what it found", () => {
    expect(claimProblems("Garantiamo 10 anni di esperienza")).toEqual(
      expect.arrayContaining([
        "contains a guarantee",
        "contains a number of years of experience",
      ]),
    );
  });
});

describe("wordCount", () => {
  it("counts words, not markup or link targets", () => {
    expect(wordCount("## Title\n\nOne [two three](/contact) four.")).toBe(5); // Title, One, two, three, four
  });

  it("ignores punctuation-only tokens", () => {
    expect(wordCount("a - b — c")).toBe(3);
  });
});

describe("bodyProblems", () => {
  it("accepts clean Markdown", () => {
    expect(bodyProblems(good, rules)).toEqual([]);
  });

  it("accepts known internal links and https links", () => {
    const body = `${good}\nSee [contact](/contact), [the agents](/services/ai-agents) and [the docs](https://example.eu/docs).\n`;

    expect(bodyProblems(body, rules)).toEqual([]);
  });

  it.each([
    ["an empty body", "", /empty/],
    ["a body that does not start with a heading", "Plain text first.\n\n## Then a heading\n\nwords words words words words", /start with a ##/],
    ["an h1 (the page renders it)", "## A\n\n# Big\n\nwords words words words words", /only ## headings/],
    ["an h3", "## A\n\n### Small\n\nwords words words words words", /only ## headings/],
    ["curly braces", "## A\n\nwords {value} words words words", /MDX/],
    ["an angle bracket", "## A\n\nwords <b>bold</b> words words", /MDX/],
    ["an import", "## A\n\nimport x from 'y'\n\nwords words words words", /import or export/],
    ["a link to an unknown page", "## A\n\nsee [x](/nowhere) words words words", /unknown or unpublished/],
    ["a link to an unpublished draft", "## A\n\nsee [x](/work/instagram-lead-agent) words words words", /unknown or unpublished/],
    ["an http link", "## A\n\nsee [x](http://example.eu) words words words", /neither internal nor https/],
    ["a javascript: link", "## A\n\nsee [x](javascript:alert) words words words", /neither internal nor https/],
    ["a link with no text", "## A\n\nsee [](/contact) words words words words", /no text/],
    ["too few words", "## A\n\nshort", /too short/],
    ["a guarantee", "## A\n\nGarantiamo il risultato in ogni caso words words", /guarantee/],
  ])("rejects %s (negative)", (_name, body, expected) => {
    expect(bodyProblems(body, rules).join(" | ")).toMatch(expected);
  });

  it("rejects too many words", () => {
    expect(bodyProblems(`## A\n\n${"word ".repeat(300)}`, rules).join(" ")).toMatch(/too long/);
  });
});
