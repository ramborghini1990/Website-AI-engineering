// @vitest-environment node
import { readdirSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

/**
 * CLAUDE.md §7 / ROADMAP P1.2: no raw colour values in components. Colours
 * come from the semantic tokens in globals.css (bg-bg, text-text, ...).
 *
 * Because globals.css removes Tailwind's default palette, classes such as
 * `bg-zinc-50` or `text-white` no longer generate any CSS. They would fail
 * silently, so they are rejected here too.
 */

const srcRoot = fileURLToPath(new URL("./", import.meta.url));

const RAW_COLOR = [
  // #rgb, #rgba, #rrggbb, #rrggbbaa (not part of a word, an entity like &#39; or an anchor id)
  /(?<![\w&])#(?:[0-9a-fA-F]{8}|[0-9a-fA-F]{6}|[0-9a-fA-F]{3,4})(?![\w-])/g,
  // colour functions
  /\b(?:rgba?|hsla?|hwb|oklab|oklch)\(/g,
  // Tailwind default-palette classes (palette is cleared, so they generate nothing)
  /\b(?:bg|text|border|ring|fill|stroke|from|via|to|outline|decoration|divide|accent|caret|shadow)-(?:slate|gray|zinc|neutral|stone|red|orange|amber|yellow|lime|green|emerald|teal|cyan|sky|blue|indigo|violet|purple|fuchsia|pink|rose)-\d{2,3}\b/g,
  /\b(?:bg|text|border|ring|fill|stroke|outline|decoration|divide)-(?:white|black)\b/g,
];

/** Every raw-colour match in `source`. */
function findRawColors(source: string): string[] {
  return RAW_COLOR.flatMap((pattern) => source.match(pattern) ?? []);
}

/** Component and app source files; globals.css (the token source) and tests are exempt. */
function sourceFiles(): string[] {
  return readdirSync(srcRoot, { recursive: true, encoding: "utf8" })
    .map((p) => p.replace(/\\/g, "/"))
    .filter((p) => /\.(?:tsx?|css|mdx?)$/.test(p))
    .filter((p) => !/\.test\.(?:tsx?)$/.test(p))
    .filter((p) => p !== "app/globals.css");
}

describe("no raw colours in components", () => {
  it("scans a non-empty set of source files", () => {
    const files = sourceFiles();
    expect(files).toContain("app/page.tsx");
    expect(files).toContain("app/layout.tsx");
    expect(files).not.toContain("app/globals.css");
  });

  it("finds no hex, rgb()/hsl()/oklch() or default-palette classes in src", () => {
    const violations = sourceFiles().flatMap((file) =>
      findRawColors(readFileSync(srcRoot + file, "utf8")).map(
        (match) => `${file}: ${match}`,
      ),
    );
    expect(violations).toEqual([]);
  });
});

describe("raw colour scanner (negative cases)", () => {
  it.each([
    ['className="bg-[#ff0000]"', "#ff0000"],
    ['className="text-[#fff]"', "#fff"],
    ['className="text-[#ffffff80]"', "#ffffff80"],
    ['style={{ color: "rgb(1, 2, 3)" }}', "rgb("],
    ['const c = "hsl(200 50% 50%)"', "hsl("],
    ['const c = "oklch(0.7 0.1 200)"', "oklch("],
    ['className="bg-zinc-50"', "bg-zinc-50"],
    ['className="dark:text-red-500"', "text-red-500"],
    ['className="text-white"', "text-white"],
    ['className="border-black"', "border-black"],
  ])("flags %s", (source, expected) => {
    expect(findRawColors(source)).toContain(expected);
  });

  it("does not flag semantic tokens, entities, anchors or ordinary words", () => {
    const clean = [
      'className="bg-bg text-text border-border-strong text-accent/40"',
      'className="bg-surface-2 shadow-popover rounded-sm"',
      "&#39;quoted&#39; and &#x27;",
      '<a href="#main-content">skip</a>',
      '<a href="#faq">faq</a>',
      "const colour = background;",
    ].join("\n");
    expect(findRawColors(clean)).toEqual([]);
  });
});
