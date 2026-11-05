import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";

const WCAG_TAGS = ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"];

// Computed colours of the `bg` token (docs/DESIGN.md §2.1).
const DARK_BG = "rgb(11, 13, 16)"; // #0B0D10
const LIGHT_BG = "rgb(246, 244, 238)"; // #F6F4EE

const bodyBackground = (page: Page) =>
  page.evaluate(() => getComputedStyle(document.body).backgroundColor);

const setThemeClass = (page: Page, theme: "light" | "dark") =>
  page.evaluate((t) => {
    document.documentElement.classList.remove("light", "dark");
    document.documentElement.classList.add(t);
  }, theme);

async function expectNoAxeViolations(page: Page) {
  const results = await new AxeBuilder({ page }).withTags(WCAG_TAGS).analyze();
  expect(results.violations).toEqual([]);
}

test.describe("smoke", () => {
  test("home page loads with a single h1", async ({ page }) => {
    const response = await page.goto("/");

    expect(response?.status()).toBe(200);
    await expect(page).toHaveTitle(/.+/);
    await expect(page.getByRole("heading", { level: 1 })).toHaveCount(1);
  });

  test("home page has no axe violations (WCAG 2.2 AA)", async ({ page }) => {
    await page.goto("/");

    await expectNoAxeViolations(page);
  });
});

test.describe("theme: system dark", () => {
  test.use({ colorScheme: "dark" });

  test("uses the dark tokens and passes axe", async ({ page }) => {
    await page.goto("/");

    expect(await bodyBackground(page)).toBe(DARK_BG);
    await expectNoAxeViolations(page);
  });

  test("an explicit .light class overrides the system preference", async ({
    page,
  }) => {
    await page.goto("/");
    await setThemeClass(page, "light");

    expect(await bodyBackground(page)).toBe(LIGHT_BG);
    await expectNoAxeViolations(page);
  });
});

test.describe("theme: system light", () => {
  test.use({ colorScheme: "light" });

  test("uses the light tokens and passes axe", async ({ page }) => {
    await page.goto("/");

    expect(await bodyBackground(page)).toBe(LIGHT_BG);
    await expectNoAxeViolations(page);
  });

  test("an explicit .dark class overrides the system preference", async ({
    page,
  }) => {
    await page.goto("/");
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

    await page.goto("/");
    await page.evaluate(() => document.fonts.ready);

    expect(foreign).toEqual([]);
    expect(fontUrls.length).toBeGreaterThan(0);
    for (const url of fontUrls) expect(new URL(url).origin).toBe(origin);
  });

  test("load Instrument Sans and JetBrains Mono", async ({ page }) => {
    await page.goto("/");
    const loaded = await page.evaluate(async () => {
      await document.fonts.ready;
      return [...document.fonts]
        .filter((face) => face.status === "loaded")
        .map((face) => face.family.replace(/["']/g, ""));
    });

    expect(loaded).toContain("Instrument Sans");
    expect(loaded).toContain("JetBrains Mono");
  });
});
