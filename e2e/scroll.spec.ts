import { expect, test, type Page } from "@playwright/test";

import {
  layoutShift,
  trackLayoutShift,
  waitForHydration,
} from "./support/motion";

/**
 * The motion system on the PRODUCTION build: what real visitors download.
 * The engine (GSAP + Lenis) must stay out of the initial bundle, must start
 * without shifting anything, and must never even load under reduced motion.
 */

const PAGES = ["/it", "/en", "/it/non-esiste"];

/** Every JavaScript response the page receives, with its text. */
function recordScripts(page: Page) {
  const scripts: Array<{ url: string; body: Promise<string>; atMs: number }> =
    [];
  const start = Date.now();
  page.on("response", (response) => {
    if (response.request().resourceType() === "script") {
      scripts.push({
        url: response.url(),
        body: response.text().catch(() => ""),
        atMs: Date.now() - start,
      });
    }
  });
  return scripts;
}

const containsEngine = async (scripts: ReturnType<typeof recordScripts>) => {
  const hits: string[] = [];
  for (const script of scripts) {
    if ((await script.body).includes("ScrollTrigger")) hits.push(script.url);
  }
  return hits;
};

test.describe("layout shift with Lenis starting up", () => {
  for (const path of PAGES) {
    test(`${path}: CLS stays below 0.05 through load, idle start-up and a settle`, async ({
      page,
    }, testInfo) => {
      await trackLayoutShift(page);
      await page.goto(path);
      await waitForHydration(page);
      await expect
        .poll(
          () =>
            page.evaluate(() =>
              document.documentElement.classList.contains("lenis"),
            ),
          {
            timeout: 10_000,
          },
        )
        .toBe(true);
      await page.waitForTimeout(1000);

      const cls = await layoutShift(page);
      testInfo.annotations.push({
        type: `CLS ${path}`,
        description: cls.toFixed(4),
      });
      expect(cls).toBeLessThan(0.05);
    });
  }
});

test.describe("the engine is lazy", () => {
  test("is not in the initial scripts, and arrives after the page is interactive", async ({
    page,
  }) => {
    const scripts = recordScripts(page);
    await page.goto("/it", { waitUntil: "load" });
    await waitForHydration(page);
    const initialCount = scripts.length;
    expect(
      await containsEngine(scripts),
      "GSAP/ScrollTrigger in the initial bundle",
    ).toEqual([]);

    await expect
      .poll(
        () =>
          page.evaluate(() =>
            document.documentElement.classList.contains("lenis"),
          ),
        {
          timeout: 10_000,
        },
      )
      .toBe(true);

    const hits = await containsEngine(scripts);
    expect(
      hits.length,
      "the engine chunk should have been fetched after load",
    ).toBeGreaterThan(0);
    expect(scripts.length).toBeGreaterThan(initialCount);
  });
});

test.describe("reduced motion", () => {
  test.use({ reducedMotion: "reduce" });

  test("never loads GSAP or Lenis, and the page scrolls natively", async ({
    page,
  }) => {
    const scripts = recordScripts(page);
    await page.goto("/it");
    await waitForHydration(page);

    await page.waitForTimeout(3000); // well past the idle timeout that would start Lenis

    expect(
      await page.evaluate(() =>
        document.documentElement.classList.contains("lenis"),
      ),
    ).toBe(false);
    expect(
      await containsEngine(scripts),
      "the engine was downloaded despite reduced motion",
    ).toEqual([]);
  });
});

test.describe("changing the preference on a live page", () => {
  test("starts and stops Lenis without a reload", async ({ page }) => {
    await page.goto("/it");
    await waitForHydration(page);
    const lenis = () =>
      page.evaluate(() => document.documentElement.classList.contains("lenis"));
    await expect.poll(lenis, { timeout: 10_000 }).toBe(true);

    await page.emulateMedia({ reducedMotion: "reduce" });
    await expect.poll(lenis).toBe(false);

    await page.emulateMedia({ reducedMotion: "no-preference" });
    await expect.poll(lenis, { timeout: 10_000 }).toBe(true);
  });
});

test.describe("hosting", () => {
  test("the dev-only motion test page is a 404 in production", async ({
    request,
  }) => {
    for (const path of [
      "/it/_dev/motion",
      "/en/_dev/motion",
      "/it/dev-tools/motion",
    ]) {
      const response = await request.get(path);
      expect(response.status(), path).toBe(404);
    }
  });
});
