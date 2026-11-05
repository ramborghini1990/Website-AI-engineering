import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";

import { business } from "../src/lib/business";

const WCAG_TAGS = ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"];

async function expectNoAxeViolations(page: Page) {
  const results = await new AxeBuilder({ page }).withTags(WCAG_TAGS).analyze();
  expect(results.violations).toEqual([]);
}

test.describe("root redirect (proxy)", () => {
  const cases: Array<[string, string | undefined, string]> = [
    ["English browser", "en-US,en;q=0.9", "/en"],
    ["Italian browser", "it-IT,it;q=0.9,en;q=0.5", "/it"],
    ["unsupported language falls back to the default", "fr-FR,fr;q=0.9", "/it"],
    ["no Accept-Language header", undefined, "/it"],
  ];

  for (const [name, acceptLanguage, target] of cases) {
    test(`/ → ${target} for ${name}`, async ({ request }) => {
      const response = await request.get("/", {
        maxRedirects: 0,
        headers: acceptLanguage ? { "accept-language": acceptLanguage } : {},
      });

      expect(response.status()).toBe(307);
      // Location may be relative or absolute depending on the server.
      expect(
        new URL(response.headers()["location"] ?? "", "http://localhost")
          .pathname,
      ).toBe(target);
    });
  }

  test("sets no cookie at all: nothing is stored about the visitor", async ({
    request,
  }) => {
    for (const path of ["/", "/it", "/en", "/foo"]) {
      const response = await request.get(path, {
        maxRedirects: 0,
        headers: { "accept-language": "en-US" },
      });
      expect(response.headers()["set-cookie"], path).toBeUndefined();
    }
  });

  test("a locale-less path keeps its path when redirected", async ({
    request,
  }) => {
    const response = await request.get("/foo/bar", {
      maxRedirects: 0,
      headers: { "accept-language": "en-GB" },
    });

    expect(
      new URL(response.headers()["location"] ?? "", "http://localhost")
        .pathname,
    ).toBe("/en/foo/bar");
  });

  test("a browser follows / to the localized page", async ({ browser }) => {
    const context = await browser.newContext({ locale: "en-GB" });
    const page = await context.newPage();
    await page.goto("/");

    await expect(page).toHaveURL(/\/en$/);
    await expect(page.locator("html")).toHaveAttribute("lang", "en");
    await context.close();
  });
});

test.describe("static assets are left alone", () => {
  for (const path of ["/favicon.ico", "/next.svg"]) {
    test(`${path} is served directly, with no redirect`, async ({
      request,
    }) => {
      const response = await request.get(path, { maxRedirects: 0 });

      expect(response.status()).toBe(200);
    });
  }

  test("a missing asset is a plain 404, not a redirect to /it/...", async ({
    request,
  }) => {
    const response = await request.get("/does-not-exist.png", {
      maxRedirects: 0,
    });

    expect(response.status()).toBe(404);
  });

  test("Next's own build assets are not touched", async ({ page, request }) => {
    await page.goto("/it");
    const script = await page
      .locator('script[src*="/_next/static/"]')
      .first()
      .getAttribute("src");
    expect(script).not.toBeNull();

    const response = await request.get(script ?? "", { maxRedirects: 0 });
    expect(response.status()).toBe(200);
  });
});

for (const [locale, title, heading] of [
  [
    "it",
    `Ingegneria AI e sviluppo full-stack | ${business.brand.name}`,
    business.brand.name,
  ],
  [
    "en",
    `AI engineering and full-stack development | ${business.brand.name}`,
    business.brand.name,
  ],
] as const) {
  test.describe(`/${locale}`, () => {
    test("renders in the right language with the right metadata", async ({
      page,
      baseURL,
    }) => {
      const response = await page.goto(`/${locale}`);
      expect(response?.status()).toBe(200);

      await expect(page.locator("html")).toHaveAttribute("lang", locale);
      await expect(page).toHaveTitle(title);
      await expect(
        page.getByRole("heading", { level: 1, name: heading }),
      ).toBeVisible();
      await expect(page.getByRole("main")).toContainText(
        locale === "it"
          ? "Il nuovo sito è in costruzione."
          : "The new website is under construction.",
      );

      const origin = new URL(baseURL ?? "").origin;
      // canonical is this locale's URL; hreflang lists both locales and x-default
      await expect(page.locator('link[rel="canonical"]')).toHaveAttribute(
        "href",
        `${origin}/${locale}`,
      );
      const alternates = await page
        .locator('link[rel="alternate"][hreflang]')
        .evaluateAll((links) => {
          const byLanguage: Record<string, string | null> = {};
          for (const link of links) {
            byLanguage[link.getAttribute("hreflang") ?? ""] =
              link.getAttribute("href");
          }
          return byLanguage;
        });
      expect(alternates).toEqual({
        it: `${origin}/it`,
        en: `${origin}/en`,
        "x-default": `${origin}/it`,
      });
    });

    test("has no axe violations", async ({ page }) => {
      await page.goto(`/${locale}`);
      await expectNoAxeViolations(page);
    });

    test("has a localized description", async ({ page }) => {
      await page.goto(`/${locale}`);
      const description = await page
        .locator('meta[name="description"]')
        .getAttribute("content");

      expect(description).toContain(business.brand.name);
      expect(description).toContain(
        locale === "it" ? "agenti AI" : "AI agents",
      );
    });
  });
}

test.describe("unknown pages", () => {
  for (const [path, heading] of [
    ["/it/non-esiste", "Pagina non trovata"],
    ["/en/does-not-exist", "Page not found"],
  ] as const) {
    test(`${path} is a localized 404`, async ({ page }) => {
      const response = await page.goto(path);

      expect(response?.status()).toBe(404);
      await expect(page).toHaveTitle(`${heading} | ${business.brand.name}`);
      await expect(
        page.getByRole("heading", { level: 1, name: heading }),
      ).toBeVisible();
      await expectNoAxeViolations(page);
    });
  }

  test("/foo (no locale) redirects, then shows the 404 in the browser's language", async ({
    browser,
  }) => {
    const context = await browser.newContext({ locale: "en-US" });
    const page = await context.newPage();
    const response = await page.goto("/foo");

    expect(page.url()).toMatch(/\/en\/foo$/);
    expect(response?.status()).toBe(404);
    await expect(page.getByRole("heading", { level: 1 })).toHaveText(
      "Page not found",
    );
    await context.close();
  });

  test("an unsupported locale prefix is just a path, so it ends as a 404", async ({
    request,
  }) => {
    const response = await request.get("/xx/about");

    expect(response.status()).toBe(404);
  });
});

test.describe("language switcher", () => {
  test("is a labelled navigation with both languages, current one marked", async ({
    page,
  }) => {
    await page.goto("/it");
    const nav = page.getByRole("navigation", { name: "Lingua" });

    await expect(nav.getByRole("link", { name: "Italiano" })).toHaveAttribute(
      "aria-current",
      "true",
    );
    await expect(
      nav.getByRole("link", { name: "English" }),
    ).not.toHaveAttribute("aria-current", /.*/);
    await expect(nav.getByRole("link", { name: "English" })).toHaveAttribute(
      "hreflang",
      "en",
    );
  });

  test("switches the home page to English and back", async ({ page }) => {
    await page.goto("/it");
    await page.getByRole("link", { name: "English" }).click();

    await expect(page).toHaveURL(/\/en$/);
    await expect(page.locator("html")).toHaveAttribute("lang", "en");
    await expect(
      page.getByRole("navigation", { name: "Language" }),
    ).toBeVisible();

    await page.getByRole("link", { name: "Italiano" }).click();
    await expect(page).toHaveURL(/\/it$/);
    await expect(page.locator("html")).toHaveAttribute("lang", "it");
  });

  test("keeps the current path when switching language", async ({ page }) => {
    await page.goto("/it/pagina/non-esiste");
    await page.getByRole("link", { name: "English" }).click();

    await expect(page).toHaveURL(/\/en\/pagina\/non-esiste$/);
    await expect(
      page.getByRole("heading", { level: 1, name: "Page not found" }),
    ).toBeVisible();
  });

  test("works with the keyboard and shows a visible focus ring", async ({
    page,
  }) => {
    await page.goto("/it");
    await page.keyboard.press("Tab");
    const english = page.getByRole("link", { name: "English" });
    await english.focus();
    await expect(english).toBeFocused();

    const ring = await english.evaluate((el) => {
      const style = getComputedStyle(el);
      return { style: style.outlineStyle, width: style.outlineWidth };
    });
    expect(ring).toEqual({ style: "solid", width: "2px" });

    await page.keyboard.press("Enter");
    await expect(page).toHaveURL(/\/en$/);
  });

  test("links are at least 44px high", async ({ page }) => {
    await page.goto("/it");
    for (const name of ["Italiano", "English"]) {
      const box = await page.getByRole("link", { name }).boundingBox();
      expect(box?.height, name).toBeGreaterThanOrEqual(44);
    }
  });
});
