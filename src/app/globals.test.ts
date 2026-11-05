// @vitest-environment node
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

/**
 * Executable form of docs/DESIGN.md §2: reads the REAL tokens from
 * globals.css and checks them against WCAG 2.2 AA (1.4.3 text 4.5:1,
 * 1.4.11 non-text 3:1), against the approved token table, and against the
 * duplicated light block.
 */

const css = readFileSync(
  fileURLToPath(new URL("./globals.css", import.meta.url)),
  "utf8",
);
const designDoc = readFileSync(
  fileURLToPath(new URL("../../docs/DESIGN.md", import.meta.url)),
  "utf8",
);

// ---------------------------------------------------------------------------
// helpers
// ---------------------------------------------------------------------------

type Tokens = Record<string, string | undefined>;
type Pair = readonly [foreground: string, background: string, minimum: number];

/** Body of the first `{ ... }` block opened by `header` (include the `{`), braces balanced. */
function blockBody(source: string, header: string): string {
  const start = source.indexOf(header);
  if (start === -1) throw new Error(`block not found: ${header}`);
  const open = start + header.length - 1;
  let depth = 0;
  for (let i = open; i < source.length; i++) {
    if (source[i] === "{") depth++;
    if (source[i] === "}") depth--;
    if (depth === 0) return source.slice(open + 1, i);
  }
  throw new Error(`unbalanced block: ${header}`);
}

/** Top-level `--name: value;` declarations of a block body (nested blocks ignored). */
function declarations(body: string): Tokens {
  let depth = 0;
  let topLevel = "";
  for (const ch of body) {
    if (ch === "{") depth++;
    if (depth === 0) topLevel += ch;
    if (ch === "}") depth--;
  }
  const out: Tokens = {};
  for (const m of topLevel.matchAll(/(--[a-z0-9-]+)\s*:\s*([^;]+);/g)) {
    out[m[1]] = m[2].replace(/\s+/g, " ").trim();
  }
  return out;
}

/** Names whose values differ between two token sets. */
function differingNames(a: Tokens, b: Tokens): string[] {
  const names = new Set([...Object.keys(a), ...Object.keys(b)]);
  return [...names].filter((name) => a[name] !== b[name]).sort();
}

function luminance(hex: string): number {
  const n = parseInt(hex.slice(1), 16);
  const [r, g, b] = [(n >> 16) & 255, (n >> 8) & 255, n & 255].map((c) => {
    const s = c / 255;
    return s <= 0.04045 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

function contrast(a: string, b: string): number {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
}

const TEXT_AA = 4.5; // WCAG 1.4.3, normal text
const UI_AA = 3; // WCAG 1.4.11, UI components and focus indicators

const SURFACES = ["bg", "surface-1", "surface-2", "surface-3"] as const;
const onSurfaces = (fg: string, minimum: number): Pair[] =>
  SURFACES.map((bg) => [fg, bg, minimum]);

/** Pairs from docs/DESIGN.md §2.2 and §2.3. */
const PAIRS: readonly Pair[] = [
  ...onSurfaces("text", TEXT_AA),
  ...onSurfaces("text-secondary", TEXT_AA),
  ...onSurfaces("text-muted", TEXT_AA),
  ...onSurfaces("accent", TEXT_AA),
  ["accent-hover", "bg", TEXT_AA],
  ["on-accent", "accent", TEXT_AA],
  ["on-accent", "accent-hover", TEXT_AA],
  ["trace", "bg", TEXT_AA],
  ["trace", "surface-2", TEXT_AA],
  ["success", "bg", TEXT_AA],
  ["success", "surface-2", TEXT_AA],
  ["warning", "bg", TEXT_AA],
  ["warning", "surface-2", TEXT_AA],
  ["danger", "bg", TEXT_AA],
  ["danger", "surface-2", TEXT_AA],
  ["border-strong", "bg", UI_AA],
  ["border-strong", "surface-1", UI_AA],
  ["border-strong", "surface-2", UI_AA],
  ["focus", "bg", UI_AA],
  ["focus", "surface-2", UI_AA],
  ["accent", "bg", UI_AA], // filled button boundary
];

const COLOR_TOKENS = [
  "bg",
  "surface-1",
  "surface-2",
  "surface-3",
  "border-subtle",
  "border-strong",
  "text",
  "text-secondary",
  "text-muted",
  "accent",
  "accent-hover",
  "on-accent",
  "trace",
  "success",
  "warning",
  "danger",
  "focus",
] as const;

/** One readable line per pair that misses its threshold (or whose token is missing). */
function failingPairs(theme: Tokens): string[] {
  const failures: string[] = [];
  for (const [fg, bg, minimum] of PAIRS) {
    const fgValue = theme[`--color-${fg}`];
    const bgValue = theme[`--color-${bg}`];
    if (fgValue === undefined || bgValue === undefined) {
      failures.push(`${fg} on ${bg}: token missing`);
      continue;
    }
    const ratio = contrast(fgValue, bgValue);
    if (ratio < minimum) {
      failures.push(
        `${fg} on ${bg}: ${ratio.toFixed(2)}:1 < ${String(minimum)}:1`,
      );
    }
  }
  return failures;
}

// ---------------------------------------------------------------------------
// real tokens
// ---------------------------------------------------------------------------

const darkTheme = declarations(blockBody(css, "@theme static {"));
const lightClassBlock = declarations(blockBody(css, ":root.light {"));
const lightTheme: Tokens = { ...darkTheme, ...lightClassBlock };
const lightMediaBlock = declarations(
  blockBody(
    blockBody(css, "@media (prefers-color-scheme: light) {"),
    ":root:not(.dark) {",
  ),
);

describe("design tokens in globals.css", () => {
  it("define every semantic colour as a 6-digit hex in both themes", () => {
    for (const theme of [darkTheme, lightTheme]) {
      for (const name of COLOR_TOKENS) {
        expect(theme[`--color-${name}`], name).toMatch(/^#[0-9a-f]{6}$/);
      }
    }
  });

  it("meet WCAG 2.2 AA in the dark theme (text 4.5:1, UI 3:1)", () => {
    expect(failingPairs(darkTheme)).toEqual([]);
  });

  it("meet WCAG 2.2 AA in the light theme (text 4.5:1, UI 3:1)", () => {
    expect(failingPairs(lightTheme)).toEqual([]);
  });

  it("keep the system-preference light block identical to the .light class block", () => {
    expect(differingNames(lightMediaBlock, lightClassBlock)).toEqual([]);
  });

  it("override every colour and every shadow in the light theme", () => {
    for (const name of COLOR_TOKENS) {
      expect(lightClassBlock[`--color-${name}`], name).toBeDefined();
    }
    for (const shadow of ["popover", "modal", "glow-accent"]) {
      expect(lightClassBlock[`--shadow-${shadow}`], shadow).toBeDefined();
    }
  });

  it("declare color-scheme so native controls follow each theme", () => {
    expect(css).toMatch(/:root\s*\{[^}]*color-scheme:\s*dark;/);
    expect(blockBody(css, ":root.light {")).toMatch(/color-scheme:\s*light;/);
  });

  it("keep body copy at 16px or more on the smallest viewport", () => {
    const min = /clamp\(\s*([\d.]+)rem/.exec(darkTheme["--text-base"] ?? "");
    expect(Number(min?.[1]) * 16).toBeGreaterThanOrEqual(16);
  });

  it("match the approved token table in docs/DESIGN.md", () => {
    const documented = new Map<string, readonly [string, string]>();
    for (const m of designDoc.matchAll(
      /^\| `([a-z0-9-]+)` \| `(#[0-9A-Fa-f]{6})` \| `(#[0-9A-Fa-f]{6})` \|/gm,
    )) {
      documented.set(m[1], [m[2].toLowerCase(), m[3].toLowerCase()]);
    }
    for (const name of COLOR_TOKENS) {
      const row = documented.get(name);
      expect(row, `${name} missing from docs/DESIGN.md §2.1`).toBeDefined();
      expect(darkTheme[`--color-${name}`], `${name} (dark)`).toBe(row?.[0]);
      expect(lightTheme[`--color-${name}`], `${name} (light)`).toBe(row?.[1]);
    }
  });
});

// ---------------------------------------------------------------------------
// negative tests: the guards themselves must be able to fail
// ---------------------------------------------------------------------------

describe("contrast guard (negative cases)", () => {
  it("computes known reference ratios", () => {
    expect(contrast("#000000", "#ffffff")).toBeCloseTo(21, 5);
    expect(contrast("#777777", "#ffffff")).toBeCloseTo(4.48, 2); // the classic just-failing grey
  });

  it("reports a text pair that falls below 4.5:1", () => {
    const broken: Tokens = { ...darkTheme, "--color-text-muted": "#4a505b" };
    expect(failingPairs(broken).join("\n")).toContain("text-muted on bg");
  });

  it("reports a control boundary that falls below 3:1", () => {
    const broken: Tokens = {
      ...lightTheme,
      "--color-border-strong": "#d6d1c3",
    };
    expect(failingPairs(broken).join("\n")).toContain("border-strong on bg");
  });

  it("reports a missing token instead of passing silently", () => {
    const incomplete: Tokens = { ...darkTheme };
    delete incomplete["--color-focus"];
    expect(failingPairs(incomplete)).toContain("focus on bg: token missing");
  });

  it("detects drift between the class block and the media block", () => {
    const drifted: Tokens = { ...lightMediaBlock, "--color-bg": "#ffffff" };
    expect(differingNames(drifted, lightClassBlock)).toEqual(["--color-bg"]);
  });
});
