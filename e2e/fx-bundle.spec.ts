import { readdirSync, readFileSync, statSync } from "node:fs";
import { gzipSync } from "node:zlib";
import path from "node:path";

import { expect, test, type Page } from "@playwright/test";

import { waitForHydration } from "./support/motion";

/**
 * "JS for FX not in the initial bundle of pages that don't use it" (ROADMAP
 * P1.6), proven on the PRODUCTION build: the FX code exists in the build (the
 * dev showcase is compiled into it), and none of it reaches the pages that do
 * not import it, not even after the browser has gone idle.
 */

const PAGES = ["/it", "/en", "/it/non-esiste"];

/** Strings that only the FX components contain (attribute names are kept by the minifier). */
const MARKERS = [
  "data-fx-word",
  "data-fx-spot",
  "data-fx-magnet",
  "data-fx-step",
  "data-fx-progress",
];

function walk(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const full = path.join(dir, name);
    return statSync(full).isDirectory() ? walk(full) : [full];
  });
}

/** Built chunks that contain FX code, with their sizes. */
function fxChunksOnDisk() {
  const root = path.join(process.cwd(), ".next", "static");
  return walk(root)
    .filter((file) => file.endsWith(".js"))
    .map((file) => ({ file, source: readFileSync(file, "utf8") }))
    .filter(({ source }) => MARKERS.some((marker) => source.includes(marker)))
    .map(({ file, source }) => ({
      name: path.basename(file),
      raw: Buffer.byteLength(source),
      gzip: gzipSync(source).length,
    }));
}

function recordScripts(page: Page) {
  const scripts: Array<{ url: string; body: Promise<string> }> = [];
  page.on("response", (response) => {
    if (response.request().resourceType() === "script") {
      scripts.push({
        url: response.url(),
        body: response.text().catch(() => ""),
      });
    }
  });
  return scripts;
}

test.describe("FX code stays out of pages that do not use it", () => {
  test("control: the production build does contain the FX code (so absence below means something)", ({}, testInfo) => {
    const chunks = fxChunksOnDisk();

    expect(chunks.length).toBeGreaterThan(0);
    const raw = chunks.reduce((sum, chunk) => sum + chunk.raw, 0);
    const gzip = chunks.reduce((sum, chunk) => sum + chunk.gzip, 0);
    testInfo.annotations.push({
      type: "fx chunks",
      description: `${chunks.map((c) => c.name).join(", ")}: ${String(raw)} B raw, ${String(gzip)} B gzip`,
    });
  });

  for (const route of PAGES) {
    test(`${route}: no FX script is downloaded, at load or after idle`, async ({
      page,
    }) => {
      const fxNames = new Set(fxChunksOnDisk().map((chunk) => chunk.name));
      const scripts = recordScripts(page);
      await page.goto(route);
      await waitForHydration(page);
      // Lenis (which IS on every page) starts after idle: by then every
      // post-idle chunk has been requested too.
      await expect
        .poll(() =>
          page.evaluate(() =>
            document.documentElement.classList.contains("lenis"),
          ),
        )
        .toBe(true);
      await page.waitForTimeout(1000);

      expect(scripts.length).toBeGreaterThan(0);
      const offenders: string[] = [];
      for (const script of scripts) {
        const name = path.basename(new URL(script.url).pathname);
        const body = await script.body;
        if (
          fxNames.has(name) ||
          MARKERS.some((marker) => body.includes(marker))
        )
          offenders.push(script.url);
      }
      expect(offenders).toEqual([]);
    });
  }
});
