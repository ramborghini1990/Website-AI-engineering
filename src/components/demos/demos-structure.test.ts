// @vitest-environment node
import { readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

import { routing } from "@/i18n/routing";
import { getWork } from "@/lib/content/read";
import { interactiveDemos } from "@/lib/demos/registry";

/**
 * "Simulation mode by default, zero external API cost" (P3.1) as a gate: the
 * demo code makes no request, stores nothing, reads no secret, calls no model
 * and renders nothing as HTML. A live mode (P3.0 budget guard) will be a
 * separate, reviewed addition; until then none of this may appear here.
 */

const root = process.cwd();
const walk = (dir: string): string[] =>
  readdirSync(path.join(root, dir)).flatMap((name) => {
    const rel = path.join(dir, name);
    return statSync(path.join(root, rel)).isDirectory() ? walk(rel) : [rel];
  });
const production = ["src/components/demos", "src/lib/demos"]
  .flatMap(walk)
  .filter(
    (file) => /\.(ts|tsx)$/.test(file) && !/\.test\.(ts|tsx)$/.test(file),
  );
const code = (file: string) =>
  readFileSync(path.join(root, file), "utf8")
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/^\s*\/\/.*$/gm, "");
const norm = (file: string) => file.replace(/\\/g, "/");

describe("the demo code is a closed simulation", () => {
  it("finds the files it is meant to guard", () => {
    const names = production.map(norm);
    expect(names).toEqual(
      expect.arrayContaining([
        "src/lib/demos/instagram/analyze.ts",
        "src/lib/demos/instagram/engine.ts",
        "src/components/demos/instagram/instagram-demo.tsx",
        "src/components/demos/demo-shell.tsx",
      ]),
    );
  });

  it("makes no network request: no fetch, XMLHttpRequest, WebSocket, EventSource or beacon", () => {
    for (const file of production) {
      expect(code(file), file).not.toMatch(
        /\bfetch\s*\(|XMLHttpRequest|WebSocket|EventSource|sendBeacon/,
      );
    }
  });

  it("stores nothing in the browser and reads no secret or environment", () => {
    for (const file of production) {
      expect(code(file), file).not.toMatch(
        /localStorage|sessionStorage|document\.cookie|indexedDB|process\.env|server-only/,
      );
    }
  });

  it("calls no AI model and imports no SDK or server module", () => {
    for (const file of production) {
      expect(code(file), file).not.toMatch(
        /@anthropic-ai|anthropic|openai|@\/lib\/(?:env|inquiry|db|email|security)/i,
      );
    }
  });

  it("renders nothing as HTML: no dangerouslySetInnerHTML, innerHTML or document.write", () => {
    for (const file of production) {
      expect(code(file), file).not.toMatch(
        /dangerouslySetInnerHTML|innerHTML|insertAdjacentHTML|document\.write/,
      );
    }
  });

  it("declares itself a simulation, and no engine is live", () => {
    expect(code("src/lib/demos/instagram/engine.ts")).toContain(
      'mode: "simulation"',
    );
    for (const file of production) {
      expect(code(file), file).not.toMatch(/mode:\s*"live"/);
    }
  });
});

describe("interactive demos belong to published work entries", () => {
  it("every demo in the registry is a published work entry in every language", () => {
    for (const locale of routing.locales) {
      const published = getWork(locale).map((entry) => entry.slug);
      for (const slug of interactiveDemos) {
        expect(published, `${locale}/${slug}`).toContain(slug);
      }
    }
  });

  it("each is a demo (not a client project): it states it is a simulation", () => {
    for (const locale of routing.locales) {
      for (const slug of interactiveDemos) {
        const entry = getWork(locale).find((work) => work.slug === slug);
        expect(entry?.data.kind).toBe("demo");
        expect(entry?.data.clientConsent).toBe(false);
      }
    }
  });
});
