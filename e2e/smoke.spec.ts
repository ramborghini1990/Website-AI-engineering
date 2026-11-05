import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";

const WCAG_TAGS = ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"];

// Computed colours of the `bg` token (docs/DESIGN.md §2.1).
const DARK_BG = "rgb(11, 13, 16)"; // #0B0D10
const LIGHT_BG = "rgb(246, 244, 238)"; // #F6F4EE

const bodyBackground = (page: Page) =>
  page.evaluate(() => getComputedStyle(document.body).backgroundColor);

/**
 * Switch the theme class, then wait for every colour transition to finish. The
 * header and footer links fade their colour (160 ms), and axe measured mid-fade
 * reads the old text colour on the new background.
 */
const setThemeClass = async (page: Page, theme: "light" | "dark") => {
  // Wait for hydration first: ThemeSync (a layout effect) puts the STORED theme on
  // <html> when React hydrates, which clears a class added by hand before that
  // moment. The theme radios are enabled only after that commit, so they are the
  // precise signal (a hydrated header link is not: React tags elements earlier).
  await page.waitForFunction(
    () =>
      document
        .querySelector('input[name="theme"]')
        ?.hasAttribute("disabled") === false,
  );
  await page.evaluate((t) => {
    document.documentElement.classList.remove("light", "dark");
    document.documentElement.classList.add(t);
  }, theme);
  await page.evaluate(() =>
    // allSettled: a transition replaced by a newer one is cancelled, and its
    // `finished` promise rejects with an AbortError.
    Promise.allSettled(
      document
        .getAnimations()
        .filter((a) => a.effect?.getComputedTiming().iterations !== Infinity)
        .map((a) => a.finished),
    ),
  );
};

async function expectNoAxeViolations(page: Page) {
  const results = await new AxeBuilder({ page }).withTags(WCAG_TAGS).analyze();
  expect(results.violations).toEqual([]);
}

test.describe("smoke", () => {
  test("home page loads with a single h1", async ({ page }) => {
    const response = await page.goto("/it");

    expect(response?.status()).toBe(200);
    await expect(page).toHaveTitle(/.+/);
    await expect(page.getByRole("heading", { level: 1 })).toHaveCount(1);
  });

  test("home page has no axe violations (WCAG 2.2 AA)", async ({ page }) => {
    await page.goto("/it");

    await expectNoAxeViolations(page);
  });
});

test.describe("dev-only routes", () => {
  for (const path of [
    "/it/_dev/ui",
    "/en/_dev/ui",
    "/it/_dev",
    "/it/dev-tools/ui", // the real route behind the /_dev rewrite
    "/_dev/ui", // no locale: redirected to /it/_dev/ui, then 404
  ]) {
    test(`${path} is a 404 in the production build`, async ({ request }) => {
      const response = await request.get(path);

      expect(response.status()).toBe(404);
    });
  }
});

test.describe("theme: system dark", () => {
  test.use({ colorScheme: "dark" });

  test("uses the dark tokens and passes axe", async ({ page }) => {
    await page.goto("/it");

    expect(await bodyBackground(page)).toBe(DARK_BG);
    await expectNoAxeViolations(page);
  });

  test("an explicit .light class overrides the system preference", async ({
    page,
  }) => {
    await page.goto("/it");
    await setThemeClass(page, "light");

    expect(await bodyBackground(page)).toBe(LIGHT_BG);
    await expectNoAxeViolations(page);
  });
});

test.describe("theme: system light", () => {
  test.use({ colorScheme: "light" });

  test("uses the light tokens and passes axe", async ({ page }) => {
    await page.goto("/it");

    expect(await bodyBackground(page)).toBe(LIGHT_BG);
    await expectNoAxeViolations(page);
  });

  test("an explicit .dark class overrides the system preference", async ({
    page,
  }) => {
    await page.goto("/it");
    await setThemeClass(page, "dark");

    expect(await bodyBackground(page)).toBe(DARK_BG);
    await expectNoAxeViolations(page);
  });
});

test.describe("fonts", () => {
  test("are self-hosted: no third-party request, fonts served from our origin", async ({
    page,
    baseURL,
  }) => {
    const origin = new URL(baseURL ?? "http://localhost:3100").origin;
    const foreign: string[] = [];
    const fontUrls: string[] = [];
    page.on("request", (request) => {
      const url = request.url();
      if (url.startsWith("http") && new URL(url).origin !== origin) {
        foreign.push(url);
      }
      if (request.resourceType() === "font") fontUrls.push(url);
    });

    await page.goto("/it");
    await page.evaluate(() => document.fonts.ready);

    expect(foreign).toEqual([]);
    expect(fontUrls.length).toBeGreaterThan(0);
    for (const url of fontUrls) expect(new URL(url).origin).toBe(origin);
  });

  test("Instrument Sans loads; JetBrains Mono is declared and fetched only when used", async ({
    page,
  }) => {
    await page.goto("/it");
    const faces = await page.evaluate(async () => {
      await document.fonts.ready;
      return [...document.fonts].map((face) => ({
        family: face.family.replace(/["']/g, ""),
        status: face.status,
      }));
    });
    const loaded = faces
      .filter((face) => face.status === "loaded")
      .map((face) => face.family);
    const declared = faces.map((face) => face.family);

    expect(loaded).toContain("Instrument Sans");
    // The placeholder page has no monospaced text, so the browser (correctly)
    // never downloads it; it is still wired up for when a page uses it.
    expect(declared).toContain("JetBrains Mono");
  });
});
