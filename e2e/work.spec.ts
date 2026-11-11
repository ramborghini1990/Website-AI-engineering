import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";

import en from "../messages/en.json";
import it from "../messages/it.json";
import { readWork } from "./support/content";
import {
  layoutShift,
  scrollThroughPage,
  settleAnimations,
  trackLayoutShift,
  waitForHydration,
} from "./support/motion";

/**
 * Work pages (P2.4) on the PRODUCTION build served with CSP_MODE=enforce.
 *
 * Every entry in content/work is a draft today, so the honest result is: an
 * empty index and a 404 for every entry. The expectations are derived from the
 * files (published vs draft), so publishing a demo later changes what is
 * expected instead of silently passing. The filters and the detail template
 * with real cards are exercised on synthetic fixtures in work-gallery.spec.ts.
 */

const WCAG_TAGS = ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"];
const LOCALES = ["it", "en"] as const;
const messages = { it, en } as const;
const BRAND = "AI Solutions & Engineering";

async function open(page: Page, path: string) {
  const response = await page.goto(path);
  await waitForHydration(page);
  await settleAnimations(page);
  return response;
}

async function expectNoAxeViolations(page: Page) {
  const results = await new AxeBuilder({ page }).withTags(WCAG_TAGS).analyze();
  expect(results.violations).toEqual([]);
}

for (const locale of LOCALES) {
  const copy = messages[locale].work;
  const entries = readWork(locale);
  const published = entries.filter(({ data }) => !data.draft);
  const drafts = entries.filter(({ data }) => data.draft);

  test.describe(`index (${locale})`, () => {
    test("one h1 and the lead; the empty state when nothing is published, the cards when something is", async ({
      page,
    }) => {
      const response = await open(page, `/${locale}/work`);

      expect(response?.status()).toBe(200);
      await expect(page.getByRole("heading", { level: 1 })).toHaveText(
        copy.title,
      );
      await expect(page.getByText(copy.lead)).toBeVisible();
      if (published.length === 0) {
        await expect(
          page.getByRole("heading", { level: 2, name: copy.empty.title }),
        ).toBeVisible();
        await expect(page.getByText(copy.empty.body)).toBeVisible();
        await expect(
          page.getByRole("navigation", { name: copy.filters.label }),
        ).toHaveCount(0);
      } else {
        for (const { data } of published) {
          await expect(
            page.getByRole("link", { name: data.title }),
          ).toBeVisible();
        }
      }
    });

    test("no draft leaks into the page: neither a title, a slug nor a summary (negative)", async ({
      request,
    }) => {
      const html = await (await request.get(`/${locale}/work`)).text();

      for (const { slug, data } of drafts) {
        expect(html, slug).not.toContain(data.title);
        expect(html, slug).not.toContain(data.summary);
        expect(html, slug).not.toContain(`/work/${slug}`);
      }
    });

    test("title, description, canonical and hreflang are right; a filter query keeps the canonical", async ({
      page,
    }) => {
      await open(page, `/${locale}/work?kind=demo&sector=anything`);

      await expect(page).toHaveTitle(
        `${messages[locale].metadata.work.title} | ${BRAND}`,
      );
      await expect(page.locator('meta[name="description"]')).toHaveAttribute(
        "content",
        messages[locale].metadata.work.description,
      );
      const canonical = await page
        .locator('link[rel="canonical"]')
        .getAttribute("href");
      expect(canonical).toMatch(new RegExp(`/${locale}/work$`));
      const alternates = await page
        .locator('link[rel="alternate"][hreflang]')
        .evaluateAll((all) =>
          all.map((link) => link.getAttribute("hreflang") ?? ""),
        );
      expect(alternates.sort()).toEqual(["en", "it", "x-default"]);
    });

    test("hostile query parameters are ignored: same page, no error, nothing reflected (negative)", async ({
      page,
    }) => {
      const hostile =
        "kind=%3Cscript%3Ealert(1)%3C/script%3E&sector=%22%3E%3Cimg%20src=x%20onerror=alert(1)%3E&stack=" +
        "x".repeat(2000);
      const response = await open(page, `/${locale}/work?${hostile}`);

      expect(response?.status()).toBe(200);
      await expect(page.getByRole("heading", { level: 1 })).toHaveText(
        copy.title,
      );
      expect(await page.locator("main img").count()).toBe(0);
      expect(await page.content()).not.toContain("onerror=alert");
    });

    test("the header lists Work and marks it current", async ({ page }) => {
      await open(page, `/${locale}/work`);

      await expect(
        page
          .getByRole("banner")
          .getByRole("link", { name: messages[locale].nav.items.work }),
      ).toHaveAttribute("aria-current", "page");
    });

    test("the closing call to action leads to the contact page", async ({
      page,
    }) => {
      await open(page, `/${locale}/work`);

      const cta = page
        .getByRole("main")
        .getByRole("link", { name: copy.cta.cta });
      await expect(cta).toHaveAttribute("href", `/${locale}/contact`);
      await cta.click();
      await expect(page).toHaveURL(new RegExp(`/${locale}/contact$`));
    });
  });

  test.describe(`detail (${locale})`, () => {
    for (const { slug, data } of entries) {
      if (data.draft) {
        test(`draft /${locale}/work/${slug} is a real 404, with no title and no content (negative)`, async ({
          page,
        }) => {
          const response = await page.goto(`/${locale}/work/${slug}`);

          expect(response?.status()).toBe(404);
          await expect(page.getByRole("heading", { level: 1 })).toHaveText(
            messages[locale].notFound.title,
          );
          expect(await page.title()).not.toContain(data.seoTitle);
          const html = await page.content();
          expect(html).not.toContain(data.title);
          expect(html).not.toContain(data.summary);
        });
      } else {
        test(`published /${locale}/work/${slug} renders`, async ({ page }) => {
          const response = await open(page, `/${locale}/work/${slug}`);

          expect(response?.status()).toBe(200);
          await expect(page.getByRole("heading", { level: 1 })).toHaveText(
            data.title,
          );
          await expect(page).toHaveTitle(`${data.seoTitle} | ${BRAND}`);
        });
      }
    }

    test("an unknown slug is a real 404", async ({ page }) => {
      const response = await page.goto(`/${locale}/work/does-not-exist`);

      expect(response?.status()).toBe(404);
    });

    test("a slug with path tricks is a 404, never a file read (negative)", async ({
      request,
    }) => {
      for (const tricky of [
        "..%2F..%2Fpackage",
        "%2e%2e%2fservices%2fai-agents",
        "..%5C..%5Cpackage",
        // A published slug followed by a NUL is normalised by the framework before our code
        // sees it (it serves the same page). No draft is left after P3.4, so an unpublished
        // slug shows the lookup is by exact match.
        "planned-demo-not-published%00",
      ]) {
        const response = await request.get(`/${locale}/work/${tricky}`);
        expect(response.status(), tricky).toBe(404);
      }
    });
  });
}

test.describe("the rest of the site agrees", () => {
  test("Home shows no demos section while no demo is published, and its links resolve", async ({
    page,
    request,
  }) => {
    const anyDemo = LOCALES.some((locale) =>
      readWork(locale).some(({ data }) => !data.draft && data.kind === "demo"),
    );
    await open(page, "/it");

    await expect(page.locator("#demos")).toHaveCount(anyDemo ? 1 : 0);
    const hrefs = await page
      .getByRole("main")
      .getByRole("link")
      .evaluateAll((all) => all.map((a) => a.getAttribute("href") ?? ""));
    for (const href of hrefs.filter((h) => !h.startsWith("#"))) {
      expect((await request.get(href)).status(), href).toBe(200);
    }
  });

  test("a service page links its demo only while that demo is published (the Instagram demo is, P3.1)", async ({
    page,
  }) => {
    await open(page, "/it/services/ai-agents");
    const published = readWork("it").some(
      ({ slug, data }) => slug === "instagram-lead-agent" && !data.draft,
    );

    await expect(page.locator("a[href*='/work/']")).toHaveCount(
      published ? 1 : 0,
    );
    await open(page, "/it/services/web-applications");
    // Its demo (the business suite, P3.4) is published: exactly that one is linked.
    await expect(page.locator("a[href*='/work/']")).toHaveCount(1);
    await expect(page.locator("a[href*='/work/']")).toHaveAttribute(
      "href",
      "/it/work/business-management-app",
    );
  });

  test("the header reaches the Work page by keyboard", async ({ page }) => {
    await open(page, "/it");
    await page
      .getByRole("banner")
      .getByRole("link", { name: it.nav.items.work })
      .focus();
    await page.keyboard.press("Enter");

    await expect(page).toHaveURL(/\/it\/work$/);
  });
});

test.describe("accessibility (axe, WCAG 2.0-2.2 A/AA)", () => {
  for (const scheme of ["dark", "light"] as const) {
    for (const locale of LOCALES) {
      test(`/${locale}/work (${scheme}): zero violations`, async ({ page }) => {
        await page.emulateMedia({ colorScheme: scheme });
        await open(page, `/${locale}/work`);

        await expectNoAxeViolations(page);
      });
    }
  }

  test("zero violations at 360 px in both themes", async ({ page }) => {
    await page.setViewportSize({ width: 360, height: 800 });
    for (const scheme of ["dark", "light"] as const) {
      await page.emulateMedia({ colorScheme: scheme });
      await open(page, "/it/work");
      await expectNoAxeViolations(page);
    }
  });

  test.describe("reduced motion", () => {
    test.use({ reducedMotion: "reduce" });

    test("zero violations", async ({ page }) => {
      await open(page, "/en/work");
      await expectNoAxeViolations(page);
    });
  });
});

test.describe("layout, stability and security", () => {
  for (const width of [360, 768, 1280, 1920]) {
    test(`${String(width)} px: no horizontal scroll`, async ({ page }) => {
      await page.setViewportSize({ width, height: 900 });
      await open(page, "/it/work");

      const overflow = await page.evaluate(
        () =>
          document.documentElement.scrollWidth -
          document.documentElement.clientWidth,
      );
      expect(overflow).toBeLessThanOrEqual(0);
    });
  }

  test("CLS stays under 0.05 on load and a full scroll", async ({ page }) => {
    await trackLayoutShift(page);
    await page.goto("/en/work");
    await waitForHydration(page);
    await scrollThroughPage(page);

    expect(await layoutShift(page)).toBeLessThan(0.05);
  });

  test("the enforced CSP is never violated and nothing logs an error", async ({
    page,
  }) => {
    const errors: string[] = [];
    page.on("console", (message) => {
      if (message.type() === "error") errors.push(message.text());
    });
    page.on("pageerror", (error) => errors.push(String(error)));
    await page.addInitScript(() => {
      const w = window as unknown as { __csp: string[] };
      w.__csp = [];
      document.addEventListener("securitypolicyviolation", (event) => {
        w.__csp.push(`${event.violatedDirective} <- ${event.blockedURI}`);
      });
    });
    for (const locale of LOCALES) {
      await open(page, `/${locale}/work`);
      await scrollThroughPage(page);
    }

    expect(
      await page.evaluate(
        () => (window as unknown as { __csp: string[] }).__csp,
      ),
    ).toEqual([]);
    expect(errors).toEqual([]);
  });

  test.describe("without JavaScript", () => {
    test.use({ javaScriptEnabled: false });

    test("the page is complete in the HTML", async ({ page }) => {
      await page.goto("/it/work");

      await expect(page.getByRole("heading", { level: 1 })).toHaveText(
        it.work.title,
      );
      await expect(page.getByText(it.work.lead)).toBeVisible();
    });
  });
});
