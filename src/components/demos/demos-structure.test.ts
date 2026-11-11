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
/** The only demo file allowed to touch browser storage (P3.4): one IndexedDB database, client-only. */
const BUSINESS_STORAGE = "src/lib/demos/business/storage.ts";

describe("the demo code is a closed simulation", () => {
  it("finds the files it is meant to guard", () => {
    const names = production.map(norm);
    expect(names).toEqual(
      expect.arrayContaining([
        "src/lib/demos/instagram/analyze.ts",
        "src/lib/demos/instagram/engine.ts",
        "src/components/demos/instagram/instagram-demo.tsx",
        "src/components/demos/demo-shell.tsx",
        "src/lib/demos/linkedin/qualify.ts",
        "src/lib/demos/linkedin/engine.ts",
        "src/lib/demos/linkedin/state.ts",
        "src/components/demos/linkedin/linkedin-demo.tsx",
        "src/lib/demos/docintel/extract.ts",
        "src/lib/demos/docintel/engine.ts",
        "src/lib/demos/docintel/state.ts",
        "src/components/demos/docintel/docintel-demo.tsx",
        "src/lib/demos/business/model.ts",
        "src/lib/demos/business/engine.ts",
        BUSINESS_STORAGE,
        "src/components/demos/business/business-demo.tsx",
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

  it("stores nothing in the browser and reads no secret or environment (the one exception is the back-office demo's IndexedDB file, below)", () => {
    for (const file of production) {
      expect(code(file), file).not.toMatch(
        /localStorage|sessionStorage|document\.cookie|process\.env|server-only/,
      );
      if (norm(file) !== BUSINESS_STORAGE) {
        expect(code(file), file).not.toMatch(/indexedDB|\bIDB[A-Z]/);
      }
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
    for (const engine of [
      "src/lib/demos/instagram/engine.ts",
      "src/lib/demos/linkedin/engine.ts",
      "src/lib/demos/docintel/engine.ts",
      "src/lib/demos/business/engine.ts",
    ]) {
      expect(code(engine), engine).toContain('mode: "simulation"');
    }
    for (const file of production) {
      expect(code(file), file).not.toMatch(/mode:\s*"live"/);
    }
  });
});

describe("the LinkedIn outreach demo (P3.2) touches no platform and automates nothing", () => {
  const linkedin = production.filter((file) => /[\\/]linkedin[\\/]/.test(file));

  it("finds its files", () => {
    expect(linkedin.length).toBeGreaterThanOrEqual(8);
  });

  it("names no LinkedIn address or API, and uses no scraping, crawling or browser-automation tool", () => {
    // The network calls themselves (fetch, XHR, sockets, beacons) are already banned for all demo code above.
    for (const file of production) {
      expect(code(file), file).not.toMatch(
        /linkedin\.com|licdn\.com|voyager|puppeteer|playwright|selenium|cheerio|jsdom|headless|\bcrawl|\bwebdriver/i,
      );
    }
  });

  it("has no way to approve or schedule several prospects at once: approval takes one id", () => {
    const state = code("src/lib/demos/linkedin/state.ts");

    expect(state).toMatch(/type:\s*"approve";\s*id:\s*string\s*\}/);
    expect(state).not.toMatch(
      /approveAll|scheduleAll|ids:\s*string\[\]|setInterval|setTimeout/,
    );
    for (const file of linkedin) {
      expect(code(file), file).not.toMatch(
        /approveAll|scheduleAll|sendAll|bulk[A-Z]|setInterval/,
      );
    }
  });
});

describe("the document intelligence demo (P3.3) takes no file and no free text from the visitor", () => {
  const docintel = production.filter((file) => /[\\/]docintel[\\/]/.test(file));

  it("finds its files", () => {
    expect(docintel.length).toBeGreaterThanOrEqual(10);
  });

  it("has no upload surface: no file input, drop zone, file reader, object URL or drag handler", () => {
    // Uploads are disabled in v1: the visitor may only choose a bundled document and one of its questions.
    for (const file of docintel) {
      expect(code(file), file).not.toMatch(
        /type=["']file["']|type:\s*["']file["']|showOpenFilePicker|FileReader|\bFile\s*\(|\bBlob\s*\(|createObjectURL|dataTransfer|onDrop|onDragOver|\baccept=|webkitdirectory/,
      );
    }
  });

  it("has no free-text surface: no textarea, text input, search box or editable region", () => {
    for (const file of docintel) {
      expect(code(file), file).not.toMatch(
        /<textarea|<Textarea|<input|<Input\b|contentEditable|contenteditable|type=["'](?:text|search|url|email)["']/,
      );
    }
  });

  it("reads only the bundled sample documents, from the messages", () => {
    for (const file of docintel) {
      expect(code(file), file).not.toMatch(
        /\bimport\s*\(|require\(|readFile|fs\/promises|from ["']node:/,
      );
    }
  });
});

describe("the back-office demo (P3.4) keeps its data in the browser and nowhere else", () => {
  const business = production.filter((file) => /[\\/]business[\\/]/.test(file));

  it("finds its files", () => {
    expect(business.length).toBeGreaterThanOrEqual(12);
  });

  it("uses IndexedDB in exactly one file, the storage module, and only there", () => {
    const users = business.filter((file) => /indexedDB/.test(code(file)));

    expect(users.map(norm)).toEqual([BUSINESS_STORAGE]);
  });

  it("the storage module opens one database of its own, and validates what it reads back", () => {
    const storage = code(BUSINESS_STORAGE);

    expect(storage.match(/indexedDB\.open\(/g)).toHaveLength(1);
    expect(storage).toContain('"demo-business-suite"');
    expect(storage).toMatch(/schema\.safeParse/);
    // no way to list or touch other databases of the origin
    expect(storage).not.toMatch(/indexedDB\.databases|deleteDatabase/);
  });

  it("takes no text from the visitor: no text input, textarea, file input or editable region", () => {
    for (const file of business) {
      expect(code(file), file).not.toMatch(
        /<textarea|<Textarea|<input|<Input\b|contentEditable|contenteditable|type=["'](?:text|search|url|email|file|number)["']/,
      );
    }
  });

  it("draws its charts as plain SVG: no chart library and no raw HTML", () => {
    for (const file of business) {
      expect(code(file), file).not.toMatch(
        /from ["'](?:recharts|d3|chart\.js|victory|nivo|@nivo|visx|@visx)/,
      );
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
