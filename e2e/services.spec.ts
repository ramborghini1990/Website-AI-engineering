import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";

import en from "../messages/en.json";
import it from "../messages/it.json";
import { readServices } from "./support/content";
import {
  layoutShift,
  scrollThroughPage,
  settleAnimations,
  trackLayoutShift,
  waitForHydration,
} from "./support/motion";

/**
 * Services pages (P2.3) on the PRODUCTION build served with CSP_MODE=enforce:
 * the index and the four detail pages in both languages. Content comes from the
 * real MDX files (read with the pure parser), structured data is parsed out of
 * the served HTML, and every internal link is followed.
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

async function watch(page: Page) {
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
  return {
    errors,
    violations: () =>
      page.evaluate(() => (window as unknown as { __csp: string[] }).__csp),
  };
}

/** The first service in display order; the collection is never empty (collections.test.ts). */
function firstService(locale: "it" | "en") {
  const first = readServices(locale).at(0);
  if (first === undefined) throw new Error(`no ${locale} service`);
  return first;
}

type Node = Record<string, unknown> & { "@type": string };

async function jsonLd(page: Page): Promise<Node[]> {
  const scripts = await page
    .locator('script[type="application/ld+json"]')
    .evaluateAll((all) => all.map((script) => script.textContent));
  expect(scripts).toHaveLength(1);
  const data = JSON.parse(scripts.at(0) ?? "") as {
    "@context": string;
    "@graph": Node[];
  };
  expect(data["@context"]).toBe("https://schema.org");
  return data["@graph"];
}

for (const locale of LOCALES) {
  const services = readServices(locale);
  const copy = messages[locale].services;

  test.describe(`index (${locale})`, () => {
    test("one h1, the lead, one card per service in order, each linking to its page", async ({
      page,
    }) => {
      const response = await open(page, `/${locale}/services`);

      expect(response?.status()).toBe(200);
      await expect(page.getByRole("heading", { level: 1 })).toHaveText(
        copy.title,
      );
      await expect(page.getByText(copy.lead)).toBeVisible();
      const h2 = await page
        .getByRole("main")
        .getByRole("heading", { level: 2 })
        .allTextContents();
      expect(h2.slice(0, 4)).toEqual(
        services.map((service) => service.data.title),
      );
      for (const { slug, data } of services) {
        await expect(
          page.getByRole("link", { name: new RegExp(data.title) }),
        ).toHaveAttribute("href", `/${locale}/services/${slug}`);
      }
    });

    test("title, description, canonical and hreflang are right", async ({
      page,
    }) => {
      await open(page, `/${locale}/services`);

      await expect(page).toHaveTitle(
        `${messages[locale].metadata.services.title} | ${BRAND}`,
      );
      await expect(page.locator('meta[name="description"]')).toHaveAttribute(
        "content",
        messages[locale].metadata.services.description,
      );
      const canonical = await page
        .locator('link[rel="canonical"]')
        .getAttribute("href");
      expect(canonical).toMatch(new RegExp(`/${locale}/services$`));
      const alternates = await page
        .locator('link[rel="alternate"][hreflang]')
        .evaluateAll((all) =>
          all.map((link) => link.getAttribute("hreflang") ?? ""),
        );
      expect(alternates.sort()).toEqual(["en", "it", "x-default"]);
    });

    test("the header lists Services, marked as the current page", async ({
      page,
    }) => {
      await open(page, `/${locale}/services`);

      await expect(
        page
          .getByRole("banner")
          .getByRole("link", { name: messages[locale].nav.items.services }),
      ).toHaveAttribute("aria-current", "page");
    });
  });

  for (const { slug, data } of services) {
    test.describe(`detail /${locale}/services/${slug}`, () => {
      test("renders the MDX content: h1, summary, body headings, the three lists and the technologies", async ({
        page,
      }) => {
        const response = await open(page, `/${locale}/services/${slug}`);

        expect(response?.status()).toBe(200);
        await expect(page.getByRole("heading", { level: 1 })).toHaveText(
          data.title,
        );
        await expect(page.getByText(data.summary)).toBeVisible();
        const h2 = await page
          .getByRole("main")
          .getByRole("heading", { level: 2 })
          .allTextContents();
        expect(h2).toEqual(
          expect.arrayContaining([
            copy.labels.idealFor,
            copy.labels.outcomes,
            copy.labels.deliverables,
            ...(data.stack.length > 0 ? [copy.labels.stack] : []),
          ]),
        );
        for (const item of [
          ...data.idealFor,
          ...data.outcomes,
          ...data.deliverables,
        ]) {
          await expect(page.getByText(item, { exact: true })).toBeVisible();
        }
        await expect(page.getByText(data.stack.join(" · "))).toBeVisible();
      });

      test("title, description, canonical and hreflang come from the frontmatter", async ({
        page,
      }) => {
        await open(page, `/${locale}/services/${slug}`);

        await expect(page).toHaveTitle(`${data.seoTitle} | ${BRAND}`);
        await expect(page.locator('meta[name="description"]')).toHaveAttribute(
          "content",
          data.description,
        );
        const canonical = await page
          .locator('link[rel="canonical"]')
          .getAttribute("href");
        expect(canonical).toMatch(new RegExp(`/${locale}/services/${slug}$`));
        const hrefs = await page
          .locator('link[rel="alternate"][hreflang]')
          .evaluateAll((all) =>
            all.map(
              (link) =>
                `${link.getAttribute("hreflang") ?? ""} ${link.getAttribute("href") ?? ""}`,
            ),
          );
        expect(
          hrefs.some(
            (h) => h.startsWith("it ") && h.endsWith(`/it/services/${slug}`),
          ),
        ).toBe(true);
        expect(
          hrefs.some(
            (h) => h.startsWith("en ") && h.endsWith(`/en/services/${slug}`),
          ),
        ).toBe(true);
        expect(
          hrefs.some(
            (h) =>
              h.startsWith("x-default ") && h.endsWith(`/it/services/${slug}`),
          ),
        ).toBe(true);
      });

      test("structured data: ProfessionalService, Service and BreadcrumbList, consistent with the page", async ({
        page,
      }) => {
        await open(page, `/${locale}/services/${slug}`);
        const graph = await jsonLd(page);
        const canonical = await page
          .locator('link[rel="canonical"]')
          .getAttribute("href");

        expect(graph.map((node) => node["@type"])).toEqual([
          "ProfessionalService",
          "Service",
          "BreadcrumbList",
        ]);
        const [practice, service, breadcrumb] = graph;
        expect(service).toMatchObject({
          name: data.title,
          description: data.description,
          url: canonical,
          provider: { "@id": practice["@id"] },
        });
        expect(practice).toMatchObject({
          name: BRAND,
          knowsAbout: data.stack,
          address: { addressLocality: "Torino", addressCountry: "IT" },
        });
        const items = breadcrumb["itemListElement"] as Array<{
          position: number;
          name: string;
          item: string;
        }>;
        expect(items.map((item) => item.position)).toEqual([1, 2, 3]);
        expect(items[2]).toMatchObject({ name: data.title, item: canonical });
        // Nothing the site does not show: no price, contact detail, rating or profile.
        const raw = JSON.stringify(graph);
        for (const key of [
          "telephone",
          "email",
          "priceRange",
          "aggregateRating",
          "review",
          "sameAs",
          "offers",
        ]) {
          expect(raw).not.toContain(`"${key}"`);
        }
      });

      test("no demo section while the demos are drafts, and every link on the page resolves", async ({
        page,
        request,
      }) => {
        await open(page, `/${locale}/services/${slug}`);

        await expect(page.getByText(copy.labels.demo)).toHaveCount(0);
        const hrefs = await page
          .getByRole("main")
          .getByRole("link")
          .evaluateAll((all) =>
            all.map((link) => link.getAttribute("href") ?? ""),
          );
        expect(hrefs.length).toBeGreaterThan(0);
        for (const href of hrefs) {
          if (href.startsWith("#")) {
            await expect(page.locator(href)).toHaveCount(1);
          } else {
            const result = await request.get(href);
            expect(result.status(), href).toBe(200);
          }
        }
      });

      test("the call to action and the link inside the text both reach the contact block", async ({
        page,
      }) => {
        await open(page, `/${locale}/services/${slug}`);

        const main = page.getByRole("main");
        // The button (capitalised) and the link inside the body text (lower case).
        const button = main.getByRole("link", {
          name: copy.cta.cta,
          exact: true,
        });
        const inText = main.locator("p a[href='#contact']");
        await expect(button).toHaveAttribute("href", "#contact");
        await expect(inText).toHaveCount(1);

        for (const link of [inText, button]) {
          await page.evaluate(() => {
            window.scrollTo(0, 0);
          });
          await page.evaluate(() => {
            history.replaceState(null, "", location.pathname);
          });
          await link.click();
          await expect(page).toHaveURL(/#contact$/);
          await expect(page.locator("#contact")).toBeInViewport();
        }
      });
    });
  }

  test.describe(`navigation (${locale})`, () => {
    test("Home → a service card → its page → back through the breadcrumb", async ({
      page,
    }) => {
      await open(page, `/${locale}`);
      const first = firstService(locale);

      await page
        .locator("#services")
        .getByRole("link", { name: new RegExp(first.data.title) })
        .click();
      await expect(page).toHaveURL(
        new RegExp(`/${locale}/services/${first.slug}$`),
      );
      await expect(page.getByRole("heading", { level: 1 })).toHaveText(
        first.data.title,
      );

      await page
        .getByRole("navigation", { name: copy.labels.breadcrumb })
        .getByRole("link", { name: copy.title })
        .click();
      await expect(page).toHaveURL(new RegExp(`/${locale}/services$`));
    });

    test("an unknown service is a real 404 with the localized not-found page", async ({
      page,
    }) => {
      const response = await page.goto(`/${locale}/services/does-not-exist`);

      expect(response?.status()).toBe(404);
      await expect(page.getByRole("heading", { level: 1 })).toHaveText(
        messages[locale].notFound.title,
      );
      expect(
        await page.locator('script[type="application/ld+json"]').count(),
      ).toBe(0);
    });
  });
}

test.describe("a service exists in both languages under the same slug", () => {
  test("/it and /en serve different text for the same slug", async ({
    page,
  }) => {
    const slug = firstService("it").slug;
    await open(page, `/it/services/${slug}`);
    const italian = await page.getByRole("heading", { level: 1 }).textContent();
    await open(page, `/en/services/${slug}`);
    const english = await page.getByRole("heading", { level: 1 }).textContent();

    expect(italian).not.toBe(english);
    await expect(page.locator("html")).toHaveAttribute("lang", "en");
  });
});

test.describe("accessibility (axe, WCAG 2.0-2.2 A/AA)", () => {
  const pages = LOCALES.flatMap((locale) => [
    `/${locale}/services`,
    ...readServices(locale).map(({ slug }) => `/${locale}/services/${slug}`),
  ]);

  for (const scheme of ["dark", "light"] as const) {
    for (const path of pages) {
      test(`${path} (${scheme}): zero violations`, async ({ page }) => {
        await page.emulateMedia({ colorScheme: scheme });
        await open(page, path);

        await expectNoAxeViolations(page);
      });
    }
  }

  test("zero violations at 360 px in both themes, index and a detail page", async ({
    page,
  }) => {
    await page.setViewportSize({ width: 360, height: 800 });
    const slug = firstService("it").slug;
    for (const scheme of ["dark", "light"] as const) {
      await page.emulateMedia({ colorScheme: scheme });
      for (const path of ["/it/services", `/it/services/${slug}`]) {
        await open(page, path);
        await expectNoAxeViolations(page);
      }
    }
  });

  test.describe("reduced motion", () => {
    test.use({ reducedMotion: "reduce" });

    test("zero violations, index and detail", async ({ page }) => {
      const slug = firstService("en").slug;
      for (const path of ["/en/services", `/en/services/${slug}`]) {
        await open(page, path);
        await expectNoAxeViolations(page);
      }
    });
  });

  test("keyboard: the breadcrumb and the call to action are reachable in reading order", async ({
    page,
  }) => {
    const slug = firstService("it").slug;
    await open(page, `/it/services/${slug}`);

    const reached: string[] = [];
    for (let step = 0; step < 14; step++) {
      await page.keyboard.press("Tab");
      reached.push(
        await page.evaluate(
          () => document.activeElement?.getAttribute("href") ?? "",
        ),
      );
    }
    expect(reached).toContain("/it");
    expect(reached).toContain("/it/services");
    expect(reached).toContain("#contact");
    expect(reached.indexOf("/it/services")).toBeLessThan(
      reached.indexOf("#contact"),
    );
  });
});

test.describe("without JavaScript", () => {
  test.use({ javaScriptEnabled: false });

  test("the whole service is in the HTML: h1, body, lists and structured data", async ({
    page,
  }) => {
    const service = firstService("it");
    await page.goto(`/it/services/${service.slug}`);

    await expect(page.getByRole("heading", { level: 1 })).toHaveText(
      service.data.title,
    );
    await expect(
      page.getByText(service.data.outcomes[0] ?? "", { exact: true }),
    ).toBeVisible();
    await expect(page.getByRole("heading", { level: 2 }).first()).toBeVisible();
    expect(
      await page.locator('script[type="application/ld+json"]').count(),
    ).toBe(1);
  });
});

test.describe("layout", () => {
  for (const width of [360, 768, 1280, 1920]) {
    test(`${String(width)} px: no horizontal scroll on the index and a detail page`, async ({
      page,
    }) => {
      await page.setViewportSize({ width, height: 900 });
      const slug = firstService("it").slug;
      for (const path of ["/it/services", `/it/services/${slug}`]) {
        await open(page, path);

        const overflow = await page.evaluate(
          () =>
            document.documentElement.scrollWidth -
            document.documentElement.clientWidth,
        );
        expect(overflow, path).toBeLessThanOrEqual(0);
      }
    });
  }

  test("the body keeps a readable line length (at most about 75 characters)", async ({
    page,
  }) => {
    await page.setViewportSize({ width: 1920, height: 1000 });
    const slug = firstService("it").slug;
    await open(page, `/it/services/${slug}`);

    // Prose paragraphs (a long sentence, not a one-line label) must not be wider than 75ch.
    const result = await page
      .getByRole("main")
      .locator("p")
      .evaluateAll((all) => {
        const prose = all.filter((p) => p.textContent.length > 120);
        return prose.map((p) => {
          const probe = document.createElement("span");
          probe.style.cssText =
            "position:absolute;visibility:hidden;width:75ch";
          p.append(probe);
          const limit = probe.getBoundingClientRect().width;
          probe.remove();
          return { width: p.getBoundingClientRect().width, limit };
        });
      });

    expect(result.length).toBeGreaterThanOrEqual(3);
    for (const { width, limit } of result) {
      expect(width).toBeLessThanOrEqual(limit + 1);
    }
  });
});

test.describe("layout stability and security", () => {
  for (const [name, reduced] of [
    ["full motion", "no-preference"],
    ["reduced motion", "reduce"],
  ] as const) {
    test(`CLS stays under 0.05 on load and a full scroll (${name})`, async ({
      page,
    }) => {
      await page.emulateMedia({ reducedMotion: reduced });
      await trackLayoutShift(page);
      for (const path of [
        "/it/services",
        `/en/services/${firstService("en").slug}`,
      ]) {
        await page.goto(path);
        await waitForHydration(page);
        await scrollThroughPage(page);
        expect(await layoutShift(page), path).toBeLessThan(0.05);
      }
    });
  }

  test("the enforced CSP is never violated and nothing logs an error", async ({
    page,
  }) => {
    const watcher = await watch(page);
    for (const locale of LOCALES) {
      const slug = firstService(locale).slug;
      for (const path of [
        `/${locale}/services`,
        `/${locale}/services/${slug}`,
      ]) {
        await open(page, path);
        await scrollThroughPage(page);
      }
    }

    expect(await watcher.violations()).toEqual([]);
    expect(watcher.errors).toEqual([]);
  });
});
