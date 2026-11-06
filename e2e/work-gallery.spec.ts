import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";

import en from "../messages/en.json";
import it from "../messages/it.json";
import { waitForHydration } from "./support/motion";

/**
 * The Work index and detail template with SYNTHETIC published entries, against
 * `next dev` (src/app/[locale]/dev-tools/work). The production /work shows its
 * empty state because every real entry is a draft; this is where the filters,
 * the cards, the client-consent rule and the detail template get exercised in
 * a browser. Two demos, one case study with a consenting (fictional) client.
 */

test.setTimeout(120_000);

const WCAG_TAGS = ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"];
const WORK = "/it/_dev/work";
const copy = it.work;

async function open(page: Page, path = WORK) {
  const response = await page.goto(path);
  expect(response?.status()).toBe(200);
  await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
  await waitForHydration(page);
}

async function expectNoAxeViolations(page: Page) {
  const results = await new AxeBuilder({ page }).withTags(WCAG_TAGS).analyze();
  expect(results.violations).toEqual([]);
}

const filterNav = (page: Page) =>
  page.getByRole("navigation", { name: copy.filters.label });
const cards = (page: Page) =>
  page.getByRole("main").getByRole("heading", { level: 2 });

test.describe("index with published entries", () => {
  test("lists the three entries, the count and the three filter groups", async ({
    page,
  }) => {
    await open(page);

    await expect(page.getByText("Risultati: 3")).toBeVisible();
    const titles = await cards(page).allTextContents();
    expect(titles.slice(0, 3)).toEqual([
      "Fixture demo: an agent that sorts incoming messages",
      "Fixture demo: reading sample documents",
      "Fixture case study with a consenting client",
    ]);
    const nav = filterNav(page);
    for (const title of [
      copy.filters.type,
      copy.filters.sector,
      copy.filters.stack,
    ]) {
      await expect(nav.getByText(title, { exact: true })).toBeVisible();
    }
  });

  test("choosing a type narrows the list through the URL, and marks the choice", async ({
    page,
  }) => {
    await open(page);

    await filterNav(page)
      .getByRole("link", { name: copy.labels.project, exact: true })
      .click();

    await expect(page).toHaveURL(/\/it\/_dev\/work\?kind=project$/);
    await expect(page.getByText("Risultati: 1")).toBeVisible();
    expect((await cards(page).allTextContents()).slice(0, 1)).toEqual([
      "Fixture case study with a consenting client",
    ]);
    await expect(
      filterNav(page).getByRole("link", {
        name: copy.labels.project,
        exact: true,
      }),
    ).toHaveAttribute("aria-current", "true");
  });

  test("filters combine, are linkable and can be cleared", async ({ page }) => {
    await open(page, `${WORK}?kind=demo&sector=Fixture+sector+A`);

    await expect(page.getByText("Risultati: 1")).toBeVisible();
    await expect(
      page.getByRole("link", {
        name: "Fixture demo: an agent that sorts incoming messages",
      }),
    ).toBeVisible();

    await filterNav(page)
      .getByRole("link", { name: "Fixture sector B" })
      .click();
    await expect(page).toHaveURL(/kind=demo&sector=Fixture\+sector\+B$/);
    await expect(page.getByText("Risultati: 1")).toBeVisible();

    await filterNav(page).getByRole("link", { name: "PostgreSQL" }).click();
    await expect(page.getByText("Risultati: 1")).toBeVisible();

    await filterNav(page)
      .getByRole("link", { name: copy.filters.all })
      .first()
      .click();
    await expect(page.getByText("Risultati: 1")).toBeVisible();
  });

  test("filters that match nothing say so and offer to clear them", async ({
    page,
  }) => {
    await open(page, `${WORK}?kind=project&sector=Fixture+sector+B`);

    await expect(page.getByText(copy.filters.noResults)).toBeVisible();
    await expect(page.getByText("Risultati: 0")).toBeVisible();
    await page.getByRole("link", { name: copy.filters.clear }).click();
    await expect(page).toHaveURL(/\/it\/_dev\/work$/);
    await expect(page.getByText("Risultati: 3")).toBeVisible();
  });

  test("an invalid filter value is ignored: the whole list shows", async ({
    page,
  }) => {
    await open(page, `${WORK}?kind=nonsense&sector=%3Cb%3Ex`);

    await expect(page.getByText("Risultati: 3")).toBeVisible();
  });

  test("the client appears on the consenting case study only", async ({
    page,
  }) => {
    await open(page);

    await expect(page.getByText("Fixture Client S.r.l.")).toHaveCount(1);
    await expect(page.getByText(copy.labels.simulation)).toHaveCount(2);
  });

  test("the filter links work without JavaScript", async ({ browser }) => {
    const context = await browser.newContext({ javaScriptEnabled: false });
    const page = await context.newPage();
    await page.goto(WORK);
    await filterNav(page)
      .getByRole("link", { name: copy.labels.demo, exact: true })
      .click();

    await expect(page.getByText("Risultati: 2")).toBeVisible();
    await context.close();
  });
});

test.describe("detail template", () => {
  test("a demo: simulation notice, facts, service link, no client", async ({
    page,
  }) => {
    await open(page, `${WORK}?detail=fixture-lead-agent`);

    await expect(page.getByRole("heading", { level: 1 })).toHaveText(
      "Fixture demo: an agent that sorts incoming messages",
    );
    await expect(page.getByText(copy.labels.simulation)).toBeVisible();
    await expect(page.getByText("Fixture sector A")).toBeVisible();
    await expect(page.getByText("TypeScript · Claude API")).toBeVisible();
    await expect(
      page.getByRole("link", { name: "The related service" }),
    ).toHaveAttribute("href", "/it/services/ai-agents");
    await expect(page.getByText(copy.labels.client)).toHaveCount(0);
    await expect(
      page.getByRole("heading", { level: 2, name: "Fixture heading" }),
    ).toBeVisible();
  });

  test("a consenting case study: client and results, no simulation notice", async ({
    page,
  }) => {
    await open(page, `${WORK}?detail=fixture-case-study`);

    await expect(page.getByText("Fixture Client S.r.l.")).toBeVisible();
    await expect(
      page.getByRole("heading", { level: 2, name: copy.labels.outcomes }),
    ).toBeVisible();
    await expect(page.getByText("A synthetic value")).toBeVisible();
    await expect(page.getByText(copy.labels.simulation)).toHaveCount(0);
  });

  test("the breadcrumb ends on the current page", async ({ page }) => {
    await open(page, `${WORK}?detail=fixture-case-study`);

    const nav = page.getByRole("navigation", {
      name: copy.labels.breadcrumb,
    });
    await expect(nav.locator('[aria-current="page"]')).toHaveText(
      "Fixture case study with a consenting client",
    );
  });
});

test.describe("accessibility (axe, WCAG 2.0-2.2 A/AA)", () => {
  const views = [
    ["index", WORK],
    ["filtered index", `${WORK}?kind=demo&stack=TypeScript`],
    ["no results", `${WORK}?kind=project&sector=Fixture+sector+B`],
    ["demo detail", `${WORK}?detail=fixture-lead-agent`],
    ["case study detail", `${WORK}?detail=fixture-case-study`],
  ] as const;

  for (const scheme of ["dark", "light"] as const) {
    for (const [name, path] of views) {
      test(`${name} (${scheme}): zero violations`, async ({ page }) => {
        await page.emulateMedia({ colorScheme: scheme });
        await open(page, path);

        await expectNoAxeViolations(page);
      });
    }
  }

  test("English and 360 px: zero violations on the index and a detail", async ({
    page,
  }) => {
    await page.setViewportSize({ width: 360, height: 800 });
    for (const path of [
      "/en/_dev/work",
      "/en/_dev/work?detail=fixture-case-study",
    ]) {
      await open(page, path);
      await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
      await expectNoAxeViolations(page);
    }
    expect(en.work.title).toBeTruthy();
  });

  test("the filter options are reachable by keyboard and show a focus ring", async ({
    page,
  }) => {
    await open(page);
    const first = filterNav(page).getByRole("link").first();
    await first.focus();
    await page.keyboard.press("Tab");

    const focused = page.locator(":focus");
    await expect(focused).toBeVisible();
    const outline = await focused.evaluate((el) => {
      const style = getComputedStyle(el);
      return [style.outlineStyle, style.outlineWidth];
    });
    expect(outline[0]).toBe("solid");
    expect(outline[1]).not.toBe("0px");
  });

  test("every filter option is at least 44 px tall", async ({ page }) => {
    await open(page);

    const heights = await filterNav(page)
      .getByRole("link")
      .evaluateAll((all) =>
        all.map((a) => Math.round(a.getBoundingClientRect().height)),
      );
    expect(Math.min(...heights)).toBeGreaterThanOrEqual(44);
  });
});
