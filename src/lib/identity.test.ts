// @vitest-environment node
import { readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

/**
 * Identity guard. The earlier placeholder business name was wrong (this is an
 * independent practice), and the brand is still a placeholder token: a name
 * that is not final must live in ONE place (`src/lib/business.ts`). Two checks:
 *
 *  1. The retired name appears nowhere in the repository's text files.
 *  2. The current brand token is not copied into messages or components.
 */

const ROOT = fileURLToPath(new URL("../../", import.meta.url));
const SKIP_DIRS = new Set([
  "node_modules",
  ".next",
  ".git",
  ".vercel",
  "test-results",
  "playwright-report",
  "coverage",
]);
const TEXT = /\.(ts|tsx|mts|mjs|js|json|md|yml|yaml|css|html|txt|example)$/;
/** History of the project; it records the correction itself. */
const HISTORY = new Set(["PROJECT_STATE.md"]);
/** pnpm lockfiles are generated. */
const GENERATED = new Set(["pnpm-lock.yaml"]);

function walk(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    if (SKIP_DIRS.has(name)) return [];
    const full = path.join(dir, name);
    return statSync(full).isDirectory() ? walk(full) : [full];
  });
}

const files = walk(ROOT)
  .filter((file) => TEXT.test(file) || path.basename(file).startsWith(".env"))
  .filter(
    (file) =>
      !HISTORY.has(path.basename(file)) && !GENERATED.has(path.basename(file)),
  )
  .map((file) => ({
    file: path.relative(ROOT, file),
    text: readFileSync(file, "utf8"),
  }));

// Built from pieces so this file does not contain the word it forbids.
const RETIRED = new RegExp(["inam", "biente"].join(""), "i");

describe("the retired business name", () => {
  it("scans a meaningful set of files (not vacuous)", () => {
    expect(files.length).toBeGreaterThan(100);
    const names = files.map((f) => f.file.replaceAll("\\", "/"));
    for (const expected of [
      "messages/it.json",
      "messages/en.json",
      "docs/DESIGN.md",
      "CLAUDE.md",
      "src/lib/business.ts",
    ]) {
      expect(names).toContain(expected);
    }
  });

  it("appears in no source, message, doc, test or config file", () => {
    const offenders = files
      .filter(({ text }) => RETIRED.test(text))
      .map(({ file }) => file);

    expect(offenders).toEqual([]);
  });

  it("negative control: the pattern does match the word, in any case", () => {
    const word = ["INAM", "BIENTE"].join("");
    expect(RETIRED.test(word)).toBe(true);
    expect(RETIRED.test(word.toLowerCase())).toBe(true);
    expect(RETIRED.test("AI Solutions & Engineering")).toBe(false);
  });
});

describe("the brand token lives in one place", () => {
  const BRAND = "AI Solutions & Engineering";
  const isTest = (file: string) => /\.test\.tsx?$/.test(file);

  it("is written in src/lib/business.ts only, among the code and the messages", () => {
    const copies = files
      .filter(({ file }) => /^(src|messages)[\\/]/.test(file) && !isTest(file))
      .filter(({ text }) => text.includes(BRAND))
      .map(({ file }) => file.replaceAll("\\", "/"));

    expect(copies).toEqual(["src/lib/business.ts"]);
  });

  it("messages use the {brand} variable where the name appears", () => {
    for (const locale of ["it", "en"]) {
      const text = readFileSync(
        path.join(ROOT, "messages", `${locale}.json`),
        "utf8",
      );
      expect(text, locale).toContain("{brand}");
    }
  });
});
