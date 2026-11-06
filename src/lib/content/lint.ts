/**
 * Editorial checks that a schema cannot express. They return a list of
 * problems (empty = fine) so a test can name every one.
 *
 * The claims rule exists because this is a one-person practice with no
 * published results yet (docs/CONTENT.md): copy must not state numbers of
 * clients, years or results, guarantees, compliance or hype that nobody has
 * verified. It is a safety net for the writer, not proof that copy is true.
 */

const PLACEHOLDERS: ReadonlyArray<[string, RegExp]> = [
  [
    "a placeholder word (TODO, TBD, lorem ...)",
    /\b(?:TODO|TBD|FIXME|lorem|ipsum|XXX)\b/i,
  ],
  ["an unfilled template marker", /\{\{|\}\}|\[\s*\.\.\.\s*\]/],
];

const CLAIMS: ReadonlyArray<[string, RegExp]> = [
  ["a number of years of experience", /\b\d+\s?\+?\s*(?:anni|years)\b/i],
  [
    "a number of clients or projects",
    /\b(?:oltre|più di|over|more than)\s+\d+\s+(?:client|progett|project|aziend|compan)/i,
  ],
  ["a percentage result (100 %, 40 % faster ...)", /\b\d{1,3}\s?%/],
  ["a guarantee", /garanti|\bguarantee/i],
  [
    "a compliance or certification claim",
    /\bcompliant\b|conform[ei] al(?:l')? ?(?:gdpr|ai act|regolamento)|\bgdpr[- ]ready\b|\bISO\s?\d{4,5}\b/i,
  ],
  [
    "hype wording",
    /rivoluzion|all['’]avanguardia|state[- ]of[- ]the[- ]art|cutting[- ]edge|best[- ]in[- ]class|game[- ]?changer|\bmagic/i,
  ],
];

/** Problems with unverifiable claims or placeholders in `text`. */
export function claimProblems(text: string): string[] {
  return [...PLACEHOLDERS, ...CLAIMS]
    .filter(([, pattern]) => pattern.test(text))
    .map(([label]) => `contains ${label}`);
}

/** Words of Markdown prose (headings and links count as the words they show). */
export function wordCount(body: string): number {
  return body
    .replace(/\[([^\]]*)\]\([^)]*\)/g, "$1")
    .split(/\s+/)
    .filter((word) => /[\p{L}\p{N}]/u.test(word)).length;
}

export type BodyRules = {
  /** Internal paths a link may point at (locale-less). */
  knownPaths: ReadonlySet<string>;
  minWords: number;
  maxWords: number;
};

/**
 * Rules for an MDX body that a page will render under its own h1:
 * only `##` headings, none skipped, plain Markdown that MDX will not mistake
 * for code (`{ }` start an expression, `<` a tag), known internal links.
 */
export function bodyProblems(body: string, rules: BodyRules): string[] {
  const problems: string[] = [];
  const lines = body.split("\n");

  if (body.trim() === "") return ["the body is empty"];

  const first = lines.find((line) => line.trim() !== "") ?? "";
  if (!first.startsWith("## "))
    problems.push("the body must start with a ## heading");

  for (const line of lines) {
    const heading = /^(#{1,6})\s/.exec(line);
    if (heading && heading[1] !== "##") {
      problems.push(
        `only ## headings are allowed (the page renders the h1): "${line.slice(0, 40)}"`,
      );
    }
  }

  if (/[{}<>]/.test(body)) {
    problems.push("contains { } < or >, which MDX reads as code or markup");
  }
  if (/^\s*(?:import|export)\s/m.test(body))
    problems.push("contains an import or export");

  // Markdown that the renderer (markdown.ts) does not implement: better a
  // failing check than text that silently renders as something else.
  const unsupported: ReadonlyArray<[string, RegExp]> = [
    ["a numbered list", /^\s*\d+[.)]\s/m],
    ["a bullet other than '- '", /^\s*[*+]\s/m],
    ["a quote or table", /^\s*[>|]/m],
    ["a code span or fence", /`/],
    ["an image", /!\[/],
    ["a horizontal rule", /^\s*(?:-{3,}|\*{3,}|_{3,})\s*$/m],
  ];
  for (const [label, pattern] of unsupported) {
    if (pattern.test(body))
      problems.push(`uses ${label}, which the renderer does not support`);
  }

  for (const match of body.matchAll(/\[([^\]]*)\]\(([^)]*)\)/g)) {
    const target = match[2];
    const internal = target.startsWith("/");
    if (internal && !rules.knownPaths.has(target)) {
      problems.push(`links to an unknown or unpublished page: ${target}`);
    } else if (!internal && !target.startsWith("https://")) {
      problems.push(`has a link that is neither internal nor https: ${target}`);
    }
    if (match[1].trim() === "")
      problems.push(`has a link with no text: ${target}`);
  }

  const words = wordCount(body);
  if (words < rules.minWords)
    problems.push(
      `is too short: ${String(words)} words (minimum ${String(rules.minWords)})`,
    );
  if (words > rules.maxWords)
    problems.push(
      `is too long: ${String(words)} words (maximum ${String(rules.maxWords)})`,
    );

  problems.push(...claimProblems(body));
  return problems;
}
