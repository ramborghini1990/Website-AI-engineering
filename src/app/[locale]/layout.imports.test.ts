// @vitest-environment node
// Keeps the root layout light (P4.7). Everything the layout imports is hydrated
// on EVERY page, so a heavy provider added here costs every route's
// Lighthouse budget (LCP, TBT, script weight; lighthouserc.json). The numbers
// that justify each rule are in docs/state/tasks/P4.7.md.
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const source = readFileSync(
  fileURLToPath(new URL("./layout.tsx", import.meta.url)),
  "utf8",
);
const imports = [...source.matchAll(/^import .*? from "([^"]+)";?$/gm)].map(
  (m) => m[1],
);

describe("the root layout stays light", () => {
  it("does not import the Radix Tooltip provider (no page uses a tooltip)", () => {
    expect(imports).not.toContain("@/components/ui/tooltip");
    expect(source).not.toMatch(/<TooltipProvider/);
  });

  it("loads the Toaster lazily, never eagerly", () => {
    expect(imports).toContain("@/components/ui/lazy-toaster");
    expect(imports).not.toContain("@/components/ui/toaster");
    expect(imports).not.toContain("@/components/ui/toast");
  });

  it("imports no other Radix component or UI-kit overlay", () => {
    for (const path of imports) {
      expect(path, path).not.toMatch(
        /@radix-ui\/|\/ui\/(dialog|sheet|select|tabs|checkbox|label)$/,
      );
    }
  });

  it("imports no motion engine (GSAP and Lenis load after idle, from the provider)", () => {
    for (const path of imports) {
      expect(path, path).not.toMatch(/^(gsap|lenis|motion)(\/|$)/);
    }
  });

  it("renders the banner in the server HTML for a visitor who must choose", () => {
    expect(imports).toContain("@/lib/consent/server");
    expect(source).toMatch(/hasNoValidConsent\(\)/);
    expect(source).toMatch(
      /<ConsentBanner\s+initiallyUndecided=\{consentUndecided\}/,
    );
  });
});
