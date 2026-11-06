import { readdirSync, readFileSync, statSync } from "node:fs";
import { gzipSync } from "node:zlib";
import path from "node:path";

import { expect, test, type Page } from "@playwright/test";

import { waitForHydration } from "./support/motion";

/**
 * "JS for FX not in the initial bundle of pages that don't use it, and never
 * loaded when it cannot run" (ROADMAP P1.6), proven on the PRODUCTION build.
 *
 *  - Pages that do not use the FX library (the 404) get none of its code.
 *  - Home (P2.2) uses it. Its small wrappers (markup, a ref) are expected, but
 *    the GSAP motion modules load only AFTER the browser is idle, and never
 *    under reduced motion.
 */

/** Strings only the FX components contain (attribute names are kept by the minifier). */
const FX_MARKERS = [
  "data-fx-word",
  "data-fx-spot",
  "data-fx-magnet",
  "data-fx-step",
  "data-fx-progress",
];

/**
 * Strings only the MOTION modules contain: they query the markup with attribute
 * selectors (`[data-fx-word]`), which the wrappers never do (they only set the
 * attribute).
 */
const MOTION_MARKERS = [
  "[data-fx-word]",
  "[data-fx-magnet]",
  "[data-fx-spot=",
  "[data-fx-progress-track]",
  "[data-fx-step]",
];

const PAGES_WITHOUT_FX = ["/it/non-esiste", "/en/does-not-exist"];
const HOME = ["/it", "/en"];

function walk(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const full = path.join(dir, name);
    return statSync(full).isDirectory() ? walk(full) : [full];
  });
}

/** Built chunks that contain any of `markers`, with their sizes. */
function chunksOnDisk(markers: string[]) {
  const root = path.join(process.cwd(), ".next", "static");
  return walk(root)
    .filter((file) => file.endsWith(".js"))
    .map((file) => ({ file, source: readFileSync(file, "utf8") }))
    .filter(({ source }) => markers.some((marker) => source.includes(marker)))
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

const containing = async (
  scripts: ReturnType<typeof recordScripts>,
  markers: string[],
) => {
  const hits: string[] = [];
  for (const script of scripts) {
    const body = await script.body;
    if (markers.some((marker) => body.includes(marker))) hits.push(script.url);
  }
  return hits;
};

test.describe("controls: the build contains the code these tests look for", () => {
  test("FX code and, separately, motion modules exist in the production build", ({}, testInfo) => {
    const fx = chunksOnDisk(FX_MARKERS);
    const motion = chunksOnDisk(MOTION_MARKERS);

    expect(fx.length).toBeGreaterThan(0);
    expect(motion.length).toBeGreaterThan(0);
    testInfo.annotations.push({
      type: "motion chunks",
      description: `${motion.map((c) => c.name).join(", ")}: ${String(motion.reduce((s, c) => s + c.raw, 0))} B raw, ${String(motion.reduce((s, c) => s + c.gzip, 0))} B gzip`,
    });
  });
});

test.describe("pages that do not use the FX library get none of it", () => {
  for (const route of PAGES_WITHOUT_FX) {
    test(`${route}: no FX script at load or after idle`, async ({ page }) => {
      const scripts = recordScripts(page);
      await page.goto(route);
      await waitForHydration(page);
      // Lenis (on every page) starts after idle: by then every post-idle chunk was requested too.
      await expect
        .poll(() =>
          page.evaluate(() =>
            document.documentElement.classList.contains("lenis"),
          ),
        )
        .toBe(true);
      await page.waitForTimeout(1000);

      expect(scripts.length).toBeGreaterThan(0);
      expect(await containing(scripts, FX_MARKERS)).toEqual([]);
    });
  }
});

test.describe("Home uses the FX library, and loads its motion only when it can run", () => {
  for (const route of HOME) {
    test(`${route}: before the browser is idle no motion module is loaded (the page is already complete and readable)`, async ({
      page,
    }) => {
      // The browser never reports idle: only what loads without it is requested.
      await page.addInitScript(() => {
        window.requestIdleCallback = () => 0;
        window.cancelIdleCallback = () => undefined;
      });
      const scripts = recordScripts(page);
      await page.goto(route);
      await waitForHydration(page);
      await page.waitForTimeout(2500);

      expect(scripts.length).toBeGreaterThan(0);
      expect(await containing(scripts, MOTION_MARKERS)).toEqual([]);
      // The wrappers ARE there (the markup needs them): this is what the page shipped.
      await expect(page.locator("[data-fx-word]").first()).toBeVisible();
    });

    test(`${route}: once idle, the motion modules arrive (control: the check above can fail)`, async ({
      page,
    }) => {
      const scripts = recordScripts(page);
      await page.goto(route);
      await waitForHydration(page);

      await expect
        .poll(async () => (await containing(scripts, MOTION_MARKERS)).length, {
          timeout: 15_000,
        })
        .toBeGreaterThan(0);
    });
  }

  test.describe("under reduced motion", () => {
    test.use({ reducedMotion: "reduce" });

    for (const route of HOME) {
      test(`${route}: no motion module is ever downloaded, not even after idle`, async ({
        page,
      }) => {
        const scripts = recordScripts(page);
        await page.goto(route);
        await waitForHydration(page);
        await page.waitForTimeout(3500); // well past the idle callback's 2 s timeout

        expect(scripts.length).toBeGreaterThan(0);
        expect(await containing(scripts, MOTION_MARKERS)).toEqual([]);
        // and the engine (GSAP + Lenis) is not loaded either
        expect(await containing(scripts, ["ScrollTrigger"])).toEqual([]);
      });
    }
  });
});
