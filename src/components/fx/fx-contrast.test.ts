// @vitest-environment node
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

import {
  meshOpacity,
  spotlightSurfaceOpacity,
} from "@/components/fx/fx-tokens";

/**
 * The FX layers are translucent accent colour behind or over text. This proves
 * the text stays at WCAG 2.2 AA (4.5:1) on the WORST tinted background, for the
 * real tokens of both themes, so axe's "incomplete" result on gradients does
 * not leave contrast unproven.
 */

const css = readFileSync(
  fileURLToPath(new URL("../../app/globals.css", import.meta.url)),
  "utf8",
);

type Rgb = readonly [number, number, number];
type Palette = Record<string, Rgb>;

function parse(source: string): Palette {
  const palette: Palette = {};
  for (const m of source.matchAll(/--color-([a-z0-9-]+):\s*#([0-9a-f]{6});/g)) {
    const n = parseInt(m[2], 16);
    palette[m[1]] = [(n >> 16) & 255, (n >> 8) & 255, n & 255];
  }
  return palette;
}

const lightStart = css.indexOf(":root.light {");
const dark = parse(css.slice(0, lightStart));
const light = parse(css.slice(lightStart, css.indexOf("}", lightStart)));

/** `top` painted over `bottom` with the given alpha (sRGB, like the browser). */
function over(top: Rgb, bottom: Rgb, alpha: number): Rgb {
  return [0, 1, 2].map((i) =>
    Math.round(top[i] * alpha + bottom[i] * (1 - alpha)),
  ) as unknown as Rgb;
}

function luminance([r, g, b]: Rgb): number {
  const [lr, lg, lb] = [r, g, b].map((c) => {
    const s = c / 255;
    return s <= 0.04045 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * lr + 0.7152 * lg + 0.0722 * lb;
}

function contrast(a: Rgb, b: Rgb): number {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
}

const THEMES = [
  ["dark", dark],
  ["light", light],
] as const;

/**
 * Text roles that can sit on the mesh. `accent` text is included on purpose:
 * it is the colour the blobs are made of, so it is the pair most likely to fail.
 */
const TEXT = ["text", "text-secondary", "text-muted", "accent"] as const;
const AA = 4.5;

function colour(palette: Palette, name: string): Rgb {
  if (!(name in palette)) throw new Error(`token missing: ${name}`);
  return palette[name];
}

describe("GradientMesh keeps text at AA", () => {
  // Two blobs at their peak on top of each other: the blobs are far apart, so
  // the layout never stacks all three, and each fades to nothing at its edge.
  const strongestPair = 1 - (1 - meshOpacity.a) * (1 - meshOpacity.b);

  it.each(THEMES)(
    "%s theme: every text colour on page background and surfaces under the strongest overlap",
    (_name, palette) => {
      const accent = colour(palette, "accent");
      const failures: string[] = [];
      for (const surface of ["bg", "surface-1", "surface-2"]) {
        const tinted = over(accent, colour(palette, surface), strongestPair);
        for (const text of TEXT) {
          const ratio = contrast(colour(palette, text), tinted);
          if (ratio < AA)
            failures.push(`${text} on ${surface}+mesh: ${ratio.toFixed(2)}`);
        }
      }
      expect(failures).toEqual([]);
    },
  );

  it("the check is not vacuous: a much stronger mesh would fail", () => {
    // 30 % accent over the light background must break at least one text role,
    // otherwise the assertion above could never catch a regression.
    const accent = colour(light, "accent");
    const tinted = over(accent, colour(light, "bg"), 0.3);
    const worst = Math.min(
      ...TEXT.map((text) => contrast(colour(light, text), tinted)),
    );
    expect(worst).toBeLessThan(AA);
  });
});

describe("SpotlightCard glow keeps text at AA", () => {
  it.each(THEMES)(
    "%s theme: every text colour on surface-2 under the glow at its peak",
    (_name, palette) => {
      const tinted = over(
        colour(palette, "accent"),
        colour(palette, "surface-2"),
        spotlightSurfaceOpacity,
      );
      const failures: string[] = [];
      for (const text of TEXT) {
        const ratio = contrast(colour(palette, text), tinted);
        if (ratio < AA) failures.push(`${text}: ${ratio.toFixed(2)}`);
      }
      expect(failures).toEqual([]);
    },
  );

  it.each(THEMES)(
    "%s theme: the lit border (accent) is a visible edge, at least 3:1 against surface-2",
    (_name, palette) => {
      expect(
        contrast(colour(palette, "accent"), colour(palette, "surface-2")),
      ).toBeGreaterThanOrEqual(3);
    },
  );
});
