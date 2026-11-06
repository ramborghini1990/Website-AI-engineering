// @vitest-environment node
import { readdirSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

/**
 * Executable form of "FX code must not bloat pages that do not use it"
 * (ROADMAP P1.6): the part of an FX component that a page imports must stay
 * small, and everything heavy sits behind `next/dynamic`.
 */

const dir = fileURLToPath(new URL(".", import.meta.url));
const files = readdirSync(dir).filter(
  (name) => /\.tsx?$/.test(name) && !/\.test\.tsx?$/.test(name),
);
const read = (name: string) => readFileSync(`${dir}${name}`, "utf8");

const isMotion = (name: string) => name.endsWith(".motion.tsx");
const wrappers = files.filter((name) => !isMotion(name));
const motions = files.filter(isMotion);

/** Import specifiers of static `import ... from "x"` statements (dynamic `import()` is not listed). */
function staticImports(source: string): string[] {
  return [
    ...source.matchAll(/^\s*import\s[^;]*?from\s+["']([^"']+)["']/gm),
  ].map((match) => match[1]);
}

const HEAVY = [
  "gsap",
  "@gsap/react",
  "lenis",
  "@/lib/motion/gsap",
  "@/lib/motion/use-motion",
];

describe("FX code splitting", () => {
  it("finds the components it is meant to guard", () => {
    expect(motions.sort()).toEqual([
      "magnetic-button.motion.tsx",
      "scroll-pinned-section.motion.tsx",
      "spotlight-card.motion.tsx",
      "text-reveal.motion.tsx",
    ]);
    expect(wrappers).toEqual(
      expect.arrayContaining([
        "gradient-mesh.tsx",
        "magnetic-button.tsx",
        "marquee.tsx",
        "scroll-pinned-section.tsx",
        "spotlight-card.tsx",
        "text-reveal.tsx",
      ]),
    );
  });

  it.each(wrappers)(
    "%s never statically imports GSAP, Lenis or useMotion",
    (name) => {
      const imports = staticImports(read(name));
      for (const heavy of HEAVY) expect(imports).not.toContain(heavy);
      for (const specifier of imports) {
        expect(specifier, `${name} imports a motion module`).not.toMatch(
          /\.motion$/,
        );
      }
    },
  );

  it.each(motions)(
    "%s is a default export (what next/dynamic loads) and uses useMotion",
    (name) => {
      const source = read(name);
      expect(source).toMatch(/export default function/);
      expect(source).toContain("useMotion(");
      expect(source.startsWith('"use client"')).toBe(true);
    },
  );

  it.each(motions)(
    "%s is reached only through next/dynamic with ssr:false",
    (name) => {
      const stem = name.replace(".motion.tsx", "");
      const owner = read(`${stem}.tsx`);
      expect(owner).toMatch(
        new RegExp(
          `dynamic\\(\\s*\\(\\) => import\\("@/components/fx/${stem}\\.motion"\\)`,
        ),
      );
      expect(owner).toMatch(/ssr: false/);
    },
  );

  it("the motion chunks are mounted only behind useFxReady", () => {
    for (const name of wrappers.filter((file) =>
      read(file).includes("Motion"),
    )) {
      if (name === "use-fx-ready.ts") continue;
      // `ready ? <XMotion` or, where a component can also run without JS, `ready && cond ? <XMotion`
      expect(read(name), name).toMatch(/ready (?:&& [^?]+ )?\? <\w+Motion/);
    }
  });

  it("the CSS-only components are server components with no client JavaScript", () => {
    for (const name of ["marquee.tsx", "gradient-mesh.tsx"]) {
      const source = read(name);
      expect(source, name).not.toMatch(/["']use client["']/);
      expect(source, name).not.toMatch(
        /\buse(State|Effect|Ref|Layout|Motion|Gsap)/,
      );
    }
  });

  it("nothing in the FX folder animates a layout property", () => {
    const layout = /\b(width|height|top|left|right|bottom|margin|padding)\s*:/;
    for (const name of motions) {
      // only the vars passed to gsap are interesting; the motion files hold nothing else
      const source = read(name)
        .replace(/\/\*[\s\S]*?\*\//g, "")
        .replace(/\/\/.*$/gm, "");
      expect(source, name).not.toMatch(layout);
    }
  });
});
