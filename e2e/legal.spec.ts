import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";
import { readFileSync } from "node:fs";
import path from "node:path";

import en from "../messages/en.json";
import it from "../messages/it.json";
import { business } from "../src/lib/business";
import {
  processors,
  storedKeys,
  thirdParties,
} from "../src/lib/consent/registry";
import { legalKeys, legalPaths } from "../src/lib/legal/documents";
import { settleAnimations, waitForHydration } from "./support/motion";

/**
 * The legal pages (P4.2) on the PRODUCTION build with CSP_MODE=enforce: the four
 * documents in both languages, the tables printed from the consent registry and
 * checked against what a real visit leaves in the browser, the links from the
 * footer and the banner, and accessibility in both themes and at phone width.
 */

const WCAG_TAGS = ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"];
const LOCALES = ["it", "en"] as const;
const messages = { it, en } as const;

type Locale = (typeof LOCALES)[number];

/** The frontmatter of a document, read from the file the page renders. */
function frontmatter(locale: Locale, key: (typeof legalKeys)[number]) {
  const raw = readFileSync(
    path.join(process.cwd(), "content/legal", locale, `${key}.mdx`),
    "utf8",
  ).replace(/\r\n/g, "\n");
  const block = /^---\n([\s\S]*?)\n---/.exec(raw)?.[1] ?? "{}";
  return JSON.parse(block) as {
    heading: string;
    seoTitle: string;
    version: string;
    updated: string;
    status: string;
  };
}

async function open(page: Page, locale: Locale, route: string) {
  await page.goto(`/${locale}${route}`);
  await waitForHydration(page);
  await settleAnimations(page);
}

async function expectNoAxeViolations(page: Page) {
  const results = await new AxeBuilder({ page }).withTags(WCAG_TAGS).analyze();
  expect(results.violations).toEqual([]);
}

async function watch(page: Page, baseURL: string | undefined) {
  const foreign: string[] = [];
  const problems: string[] = [];
  page.on("request", (request) => {
    const url = request.url();
    if (url.startsWith("data:") || url.startsWith("blob:")) return;
    if (!url.startsWith(String(baseURL))) foreign.push(url);
  });
  page.on("console", (message) => {
    if (message.type() === "error") problems.push(message.text());
  });
  page.on("pageerror", (error) => problems.push(error.message));
  await page.addInitScript(() => {
    const w = window as unknown as { __csp: string[] };
    w.__csp = [];
    document.addEventListener("securitypolicyviolation", (event) => {
      w.__csp.push(`${event.violatedDirective} <- ${event.blockedURI}`);
    });
  });
  return { foreign, problems };
}

const noSidewaysScroll = (page: Page) =>
  page.evaluate(
    () =>
      document.documentElement.scrollWidth <=
      document.documentElement.clientWidth,
  );

for (const locale of LOCALES) {
  test.describe(`legal documents (${locale})`, () => {
    for (const key of legalKeys) {
      const doc = frontmatter(locale, key);

      test(`${legalPaths[key]}: one h1, the version and date, the draft notice, canonical + hreflang, nothing third-party, no CSP violation`, async ({
        page,
        baseURL,
      }) => {
        const seen = await watch(page, baseURL);
        const response = await page.goto(`/${locale}${legalPaths[key]}`);
        expect(response?.status()).toBe(200);
        await waitForHydration(page);
        await settleAnimations(page);

        await expect(page.locator("h1")).toHaveCount(1);
        await expect(page.locator("h1")).toHaveText(doc.heading);
        expect(await page.title()).toBe(
          `${doc.seoTitle} | ${business.brand.name}`,
        );
        await expect(page.locator("[data-legal-version]")).toContainText(
          doc.version,
        );
        await expect(page.locator("time")).toHaveAttribute(
          "datetime",
          doc.updated,
        );
        if (doc.status === "draft") {
          await expect(
            page.locator("[data-legal-status='draft']"),
          ).toBeVisible();
        }

        // canonical and hreflang, as for every other page
        const pathOf = async (selector: string) =>
          new URL((await page.locator(selector).getAttribute("href")) ?? "")
            .pathname;
        expect(await pathOf("link[rel='canonical']")).toBe(
          `/${locale}${legalPaths[key]}`,
        );
        expect(await pathOf("link[rel='alternate'][hreflang='it']")).toBe(
          `/it${legalPaths[key]}`,
        );
        expect(await pathOf("link[rel='alternate'][hreflang='en']")).toBe(
          `/en${legalPaths[key]}`,
        );
        expect(
          await pathOf("link[rel='alternate'][hreflang='x-default']"),
        ).toBe(`/it${legalPaths[key]}`);

        // the other three documents are one click away
        const others = page.getByRole("navigation", {
          name: messages[locale].legal.otherDocuments,
        });
        await expect(others.getByRole("link")).toHaveCount(3);

        expect(seen.foreign).toEqual([]);
        expect(seen.problems).toEqual([]);
        expect(
          await page.evaluate(
            () => (window as unknown as { __csp: string[] }).__csp,
          ),
        ).toEqual([]);
      });

      for (const scheme of ["dark", "light"] as const) {
        test(`${legalPaths[key]}: no axe violation (${scheme})`, async ({
          page,
        }) => {
          await page.emulateMedia({ colorScheme: scheme });
          await open(page, locale, legalPaths[key]);

          await expectNoAxeViolations(page);
        });
      }
    }

    test("/cookie-policy lists every storage key of the registry, with the kind, purpose and duration written in this language", async ({
      page,
    }) => {
      await open(page, locale, "/cookie-policy");
      const t = messages[locale].legal;

      await expect(page.locator("[data-storage-key]")).toHaveCount(
        storedKeys.length,
      );
      for (const key of storedKeys) {
        const row = page.locator(`[data-storage-key="${key.name}"]`);
        await expect(row).toContainText(key.name);
        await expect(row).toContainText(t.tables.storage.kinds[key.kind]);
        await expect(row).toContainText(t.storage[key.name].purpose);
        await expect(row).toContainText(t.storage[key.name].duration);
      }
      for (const party of thirdParties) {
        const row = page.locator(`[data-third-party="${party.id}"]`);
        await expect(row).toContainText(party.provider);
        await expect(row).toContainText(t.thirdParties[party.id].data);
      }
    });

    test("/cookie-policy and /privacy list every processor of the registry", async ({
      page,
    }) => {
      for (const route of ["/cookie-policy", "/privacy"]) {
        await open(page, locale, route);
        await expect(page.locator("[data-processor]")).toHaveCount(
          processors.length,
        );
        for (const entry of processors) {
          const row = page.locator(`[data-processor="${entry.id}"]`);
          await expect(row, `${route} ${entry.id}`).toContainText(entry.name);
          await expect(row).toContainText(
            messages[locale].legal.processors[entry.id].location,
          );
        }
      }
    });

    test("/legal and /privacy print the business record: the owner and the place are there, and what is not known yet is said so rather than invented", async ({
      page,
    }) => {
      for (const route of ["/legal", "/privacy"]) {
        await open(page, locale, route);
        const main = page.locator("main");
        await expect(main).toContainText(business.owner.name);
        await expect(main).toContainText(business.location.municipality);
        if (business.vatNumber === null) {
          await expect(
            main.locator("[data-status='pending']").first(),
          ).toHaveText(messages[locale].footer.pending);
        }
      }
    });

    test("at phone width the cookie policy's table scrolls inside its own region: the page itself never scrolls sideways, and the region is reachable by keyboard", async ({
      page,
    }) => {
      await page.setViewportSize({ width: 360, height: 800 });
      await open(page, locale, "/cookie-policy");

      expect(await noSidewaysScroll(page)).toBe(true);
      const region = page.getByRole("region", {
        name: messages[locale].legal.tables.storage.caption,
      });
      await region.focus();
      await expect(region).toBeFocused();
      await expectNoAxeViolations(page);
    });

    for (const width of [768, 1280, 1920]) {
      test(`the cookie policy has no sideways page scroll at ${String(width)} px`, async ({
        page,
      }) => {
        await page.setViewportSize({ width, height: 900 });
        await open(page, locale, "/cookie-policy");

        expect(await noSidewaysScroll(page)).toBe(true);
      });
    }

    test("the footer of every page links to the four documents, each link works, and 'Cookie preferences' is still there", async ({
      page,
    }) => {
      const t = messages[locale];
      // The banner is fixed over the bottom of the first page until the visitor decides; decide first.
      await open(page, locale, "");
      await page.locator("[data-consent-action='reject_all']").click();
      await expect(page.locator("[data-consent-banner]")).toHaveCount(0);
      for (const route of ["", "/services", "/legal"]) {
        await open(page, locale, route);
        const nav = page.getByRole("navigation", {
          name: t.legal.footerNav,
          exact: true,
        });
        for (const key of legalKeys) {
          await expect(
            nav.getByRole("link", { name: t.legal.titles[key] }),
          ).toHaveAttribute("href", `/${locale}${legalPaths[key]}`);
        }
        await expect(
          nav.getByRole("button", { name: t.consent.reopen }),
        ).toBeVisible();
      }

      await open(page, locale, "");
      await page
        .getByRole("navigation", { name: t.legal.footerNav, exact: true })
        .getByRole("link", { name: t.legal.titles.terms })
        .click();
      await expect(page).toHaveURL(new RegExp(`/${locale}/terms$`));
      await expect(page.locator("h1")).toHaveText(
        frontmatter(locale, "terms").heading,
      );
    });

    test("the link inside the cookie banner opens the cookie policy; the banner is still asking when you get there, and reading is not a decision", async ({
      page,
    }) => {
      await open(page, locale, "");
      const banner = page.locator("[data-consent-banner]");
      const link = banner.getByRole("link", {
        name: messages[locale].consent.policyLink,
      });
      await expect(link).toHaveAttribute("href", `/${locale}/cookie-policy`);
      await link.click();

      await expect(page).toHaveURL(new RegExp(`/${locale}/cookie-policy$`));
      await expect(page.locator("h1")).toHaveText(
        frontmatter(locale, "cookie-policy").heading,
      );
      await expect(banner).toBeVisible();
      expect(
        (await page.context().cookies()).some((c) => c.name === "consent"),
      ).toBe(false);
    });

    test("the contact form shows no literal tag (the Italian privacy sentence once printed '<link>' because of an apostrophe)", async ({
      page,
    }) => {
      await open(page, locale, "/contact");

      await expect(page.locator("body")).not.toContainText("<link>");
      await expect(page.locator("body")).not.toContainText("</link>");
    });
  });
}

test.describe("what a real visit leaves in the browser is exactly what the cookie policy lists", () => {
  test("accepting everything, picking a theme and using the business demo writes the registry's keys and no others (cookie, localStorage, IndexedDB)", async ({
    page,
    context,
    baseURL,
  }) => {
    const demo = en.demos.business;
    await open(page, "en", "");
    await page.locator("[data-consent-action='accept_all']").click();
    await expect
      .poll(async () =>
        (await context.cookies()).some((c) => c.name === "consent"),
      )
      .toBe(true);

    await page
      .locator("label", {
        has: page.getByRole("radio", { name: en.theme.dark }),
      })
      .click();

    await page.goto("/en/work/business-management-app");
    await waitForHydration(page);
    await settleAnimations(page);
    const region = page.getByRole("region", { name: en.demos.shell.title });
    await expect(region.locator("[data-storage]")).not.toHaveAttribute(
      "data-storage",
      "checking",
    );
    await region
      .getByRole("button", {
        name: demo.pos.addLabel.replace("{name}", demo.items.tea),
      })
      .click();
    await region.getByRole("button", { name: demo.pos.pay.cash }).click();

    const databases = () =>
      page.evaluate(async () =>
        (await indexedDB.databases()).map((db) => db.name ?? ""),
      );
    await expect.poll(databases).toContain("demo-business-suite");

    const host = new URL(String(baseURL)).hostname;
    const live = {
      cookies: (await context.cookies())
        .filter((c) => c.domain.replace(/^\./, "") === host)
        .map((c) => c.name),
      localStorage: await page.evaluate(() => Object.keys(window.localStorage)),
      sessionStorage: await page.evaluate(() =>
        Object.keys(window.sessionStorage),
      ),
      indexedDB: await databases(),
    };

    expect(live.sessionStorage).toEqual([]);
    const byKind = (kind: (typeof storedKeys)[number]["kind"]) =>
      storedKeys.filter((key) => key.kind === kind).map((key) => key.name);
    expect(live.cookies.sort()).toEqual(byKind("cookie").sort());
    expect(live.localStorage.sort()).toEqual(byKind("localStorage").sort());
    expect(live.indexedDB.sort()).toEqual(byKind("indexedDB").sort());

    // and the policy page a visitor reads lists those very names
    await open(page, "en", "/cookie-policy");
    const listed = await page
      .locator("[data-storage-key]")
      .evaluateAll((rows) =>
        rows.map((row) => row.getAttribute("data-storage-key")),
      );
    expect(listed.sort()).toEqual(
      [...live.cookies, ...live.localStorage, ...live.indexedDB].sort(),
    );
  });
});
