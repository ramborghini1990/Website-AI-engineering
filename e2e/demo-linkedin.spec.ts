import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";

import en from "../messages/en.json";
import it from "../messages/it.json";
import {
  layoutShift,
  settleAnimations,
  trackLayoutShift,
  waitForHydration,
} from "./support/motion";
import { isDemoEvent } from "./support/analytics";

/**
 * The LinkedIn outreach demo (P3.2) on the PRODUCTION build with the CSP
 * enforced: a simulation, so the tests prove what that promises: it works with
 * no network, no message is scheduled without the person's confirmation and
 * approval (one prospect at a time, no bulk), nothing is ever sent anywhere, and
 * it is accessible and responsive. The rules are unit-tested per prospect; here
 * they are checked as the visitor sees them.
 */

const WCAG_TAGS = ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"];
const LOCALES = ["it", "en"] as const;
const messages = { it, en } as const;
const SLUG = "linkedin-assisted-outreach";

type Locale = (typeof LOCALES)[number];
type ItemId = keyof typeof it.demos.linkedin.items;

const demoCopy = (locale: Locale) => messages[locale].demos.linkedin;
const shellCopy = (locale: Locale) => messages[locale].demos.shell;

async function open(page: Page, locale: Locale) {
  await page.goto(`/${locale}/work/${SLUG}`);
  await waitForHydration(page);
  await settleAnimations(page);
}

const demo = (page: Page, locale: Locale) =>
  page.getByRole("region", { name: shellCopy(locale).title });
const list = (page: Page, locale: Locale) =>
  page.getByRole("region", { name: demoCopy(locale).prospects.title });
const detail = (page: Page, locale: Locale) =>
  page.getByRole("region", { name: demoCopy(locale).detail.title });
const queue = (page: Page, locale: Locale) =>
  page.getByRole("region", { name: demoCopy(locale).queue.title });
const row = (page: Page, locale: Locale, id: ItemId) =>
  list(page, locale).getByRole("button", {
    name: new RegExp(
      demoCopy(locale).items[id].name.replaceAll(".", String.raw`\.`),
    ),
  });
const status = (page: Page, locale: Locale) =>
  demo(page, locale).getByRole("status");
const approve = (page: Page, locale: Locale) =>
  detail(page, locale).getByRole("button", {
    name: demoCopy(locale).gate.approve,
  });
const confirm = (page: Page, locale: Locale) =>
  detail(page, locale).getByRole("checkbox", {
    name: demoCopy(locale).gate.confirm,
  });

async function research(page: Page, locale: Locale) {
  await page
    .getByRole("button", { name: demoCopy(locale).controls.research })
    .click();
  await expect(status(page, locale)).toContainText(
    demoCopy(locale).controls.done.split("{")[0] ?? "",
    { timeout: 15_000 },
  );
}

async function expectNoAxeViolations(page: Page) {
  const results = await new AxeBuilder({ page }).withTags(WCAG_TAGS).analyze();
  expect(results.violations).toEqual([]);
}

test.describe("the page", () => {
  for (const locale of LOCALES) {
    const c = demoCopy(locale);

    test(`/${locale}: the page has its h1, a Simulation badge, the disclosure, the six prospects and the compliance framing`, async ({
      page,
    }) => {
      const response = await page.goto(`/${locale}/work/${SLUG}`);

      expect(response?.status()).toBe(200);
      await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
      await expect(
        demo(page, locale).getByText(shellCopy(locale).badge, { exact: true }),
      ).toBeVisible();
      await expect(
        demo(page, locale).locator("[data-demo-disclosure]"),
      ).toContainText(c.disclosure);
      await expect(list(page, locale).getByRole("button")).toHaveCount(6);
      const compliance = demo(page, locale).locator("[data-compliance]");
      for (const text of [
        ...Object.values(c.compliance).filter((v) => v !== c.compliance.title),
        ...Object.values(c.forbidden).filter((v) => v !== c.forbidden.title),
      ]) {
        await expect(compliance).toContainText(text);
      }
      await expect(page.getByText(c.boundary.approval)).toBeVisible();
    });

    test(`/${locale}: the disclosure and the compliance framing are in the HTML and come before the prospects (${locale})`, async ({
      request,
    }) => {
      const html = await (await request.get(`/${locale}/work/${SLUG}`)).text();

      const disclosureAt = html.indexOf(c.disclosure.slice(0, 40));
      const complianceAt = html.indexOf(c.forbidden.title);
      const prospectsAt = html.indexOf(c.prospects.title);
      expect(disclosureAt).toBeGreaterThan(-1);
      expect(complianceAt).toBeGreaterThan(disclosureAt);
      expect(prospectsAt).toBeGreaterThan(complianceAt);
    });
  }
});

test.describe("research, then a mandatory approval (reduced motion: instant)", () => {
  test.use({ reducedMotion: "reduce" });

  test("before the research there is nothing to approve: no checkbox, no approve button, an empty queue (negative)", async ({
    page,
  }) => {
    const c = demoCopy("it");
    await open(page, "it");

    await expect(page.getByRole("checkbox")).toHaveCount(0);
    await expect(approve(page, "it")).toHaveCount(0);
    await expect(queue(page, "it").getByText(c.queue.empty)).toBeVisible();
  });

  test("the agent rates and drafts as the rules say, and only the three worth contacting get a message", async ({
    page,
  }) => {
    const c = demoCopy("it");
    await open(page, "it");
    await research(page, "it");

    await expect(status(page, "it")).toHaveText(
      c.controls.done
        .replace("{total}", "6")
        .replace("{drafts}", "3")
        .replace("{pending}", "3"),
    );
    await row(page, "it", "alfa").click();
    await expect(
      detail(page, "it").getByText(c.detail.scoreOf.replace("{score}", "100")),
    ).toBeVisible();
    await expect(
      detail(page, "it")
        .getByRole("table", { name: c.detail.breakdown })
        .getByRole("row"),
    ).toHaveCount(4);
    await expect(
      detail(page, "it").getByLabel(c.detail.draftLabel),
    ).toHaveValue(new RegExp(c.news.expansion));
    for (const id of ["cima", "delta", "eco"] as const) {
      await row(page, "it", id).click();
      await expect(
        detail(page, "it").getByLabel(c.detail.draftLabel),
        id,
      ).toHaveCount(0);
      await expect(approve(page, "it"), id).toHaveCount(0);
    }
    await row(page, "it", "eco").click();
    await expect(
      detail(page, "it").getByText(c.detail.blockedNote),
    ).toBeVisible();
  });

  test("approval cannot be skipped: the button is disabled until the person confirms they read the message (negative)", async ({
    page,
  }) => {
    const c = demoCopy("it");
    await open(page, "it");
    await research(page, "it");
    await row(page, "it", "alfa").click();

    await expect(approve(page, "it")).toBeDisabled();
    await expect(
      detail(page, "it").getByText(c.gate.needConfirm),
    ).toBeVisible();
    await approve(page, "it").click({ force: true });
    await expect(page.getByText(c.gate.simulated)).toHaveCount(0);
    await expect(queue(page, "it").getByText(c.queue.empty)).toBeVisible();
    await expect(list(page, "it").getByText(c.status.scheduled)).toHaveCount(0);
  });

  test("confirm and approve: it is scheduled, queued, the draft locks, focus moves to the outcome, and only that one changed", async ({
    page,
  }) => {
    const c = demoCopy("it");
    await open(page, "it");
    await research(page, "it");
    await row(page, "it", "alfa").click();
    await detail(page, "it")
      .getByLabel(c.detail.draftLabel)
      .fill("Testo modificato dalla persona");
    await confirm(page, "it").click();

    await expect(approve(page, "it")).toBeEnabled();
    await approve(page, "it").click();

    await expect(detail(page, "it").getByText(c.gate.simulated)).toBeVisible();
    await expect(detail(page, "it").locator("p[tabindex='-1']")).toBeFocused();
    await expect(approve(page, "it")).toHaveCount(0);
    await expect(
      detail(page, "it").getByLabel(c.detail.draftLabel),
    ).toHaveValue("Testo modificato dalla persona");
    await expect(
      detail(page, "it").getByLabel(c.detail.draftLabel),
    ).not.toBeEditable();
    const table = queue(page, "it").getByRole("table", {
      name: c.queue.caption,
    });
    await expect(table.getByRole("row")).toHaveCount(2);
    await expect(table.getByRole("row").nth(1)).toContainText(
      c.items.alfa.name,
    );
    await expect(list(page, "it").getByText(c.status.scheduled)).toHaveCount(1);
    await expect(list(page, "it").getByText(c.status.pending)).toHaveCount(2);
  });

  test("editing after confirming takes the confirmation back", async ({
    page,
  }) => {
    const c = demoCopy("it");
    await open(page, "it");
    await research(page, "it");
    await row(page, "it", "alfa").click();
    await confirm(page, "it").click();
    await expect(approve(page, "it")).toBeEnabled();

    await detail(page, "it")
      .getByLabel(c.detail.draftLabel)
      .fill("Nuovo testo");

    await expect(confirm(page, "it")).not.toBeChecked();
    await expect(approve(page, "it")).toBeDisabled();
  });

  test("there is no bulk action anywhere: approval is per prospect, and approving one leaves the others waiting (negative)", async ({
    page,
  }) => {
    const c = demoCopy("it");
    await open(page, "it");
    await research(page, "it");
    for (const button of await demo(page, "it").getByRole("button").all()) {
      expect(await button.innerText()).not.toMatch(
        /tutt[ie]|\ball\b|in massa|bulk/i,
      );
    }

    await row(page, "it", "borgo").click();
    await confirm(page, "it").click();
    await approve(page, "it").click();
    await row(page, "it", "fiume").click();

    await expect(approve(page, "it")).toBeDisabled();
    await expect(confirm(page, "it")).not.toBeChecked();
    await expect(list(page, "it").getByText(c.status.scheduled)).toHaveCount(1);
  });

  test("discarding schedules nothing and is final", async ({ page }) => {
    const c = demoCopy("it");
    await open(page, "it");
    await research(page, "it");
    await row(page, "it", "fiume").click();

    await detail(page, "it")
      .getByRole("button", { name: c.gate.discard })
      .click();

    await expect(list(page, "it").getByText(c.status.discarded)).toHaveCount(1);
    await expect(page.getByText(c.gate.simulated)).toHaveCount(0);
    await expect(approve(page, "it")).toHaveCount(0);
    await expect(queue(page, "it").getByText(c.queue.empty)).toBeVisible();
  });

  test("reset starts over: nothing researched, queued or scheduled", async ({
    page,
  }) => {
    const c = demoCopy("it");
    await open(page, "it");
    await research(page, "it");
    await row(page, "it", "alfa").click();
    await confirm(page, "it").click();
    await approve(page, "it").click();

    await page.getByRole("button", { name: shellCopy("it").reset }).click();

    await expect(list(page, "it").getByText(c.status.new)).toHaveCount(6);
    await expect(queue(page, "it").getByText(c.queue.empty)).toBeVisible();
    await expect(page.getByText(c.gate.simulated)).toHaveCount(0);
  });
});

test.describe("pacing (motion allowed)", () => {
  test("the agent works through the prospects one at a time, with progress announced and the button busy", async ({
    page,
  }) => {
    const c = demoCopy("it");
    await open(page, "it");

    await page.getByRole("button", { name: c.controls.research }).click();

    await expect(
      page.getByRole("button", { name: c.controls.researching }),
    ).toBeDisabled();
    await expect(status(page, "it")).toContainText(/Ricercati \d+ di 6/);
    await expect(status(page, "it")).toContainText(
      c.controls.done.split("{")[0] ?? "",
      { timeout: 15_000 },
    );
  });
});

test.describe("zero network, zero storage, strict CSP", () => {
  test.use({ reducedMotion: "reduce" });

  test("a whole session makes no request to anywhere else, sends nothing, stores nothing, and the CSP is never violated", async ({
    page,
    baseURL,
  }) => {
    const c = demoCopy("it");
    const origin = new URL(baseURL ?? "http://localhost:3100").origin;
    const offenders: string[] = [];
    const errors: string[] = [];
    await page.addInitScript(() => {
      const w = window as unknown as { __csp: string[] };
      w.__csp = [];
      document.addEventListener("securitypolicyviolation", (event) => {
        w.__csp.push(`${event.violatedDirective} <- ${event.blockedURI}`);
      });
    });
    page.on("console", (message) => {
      if (message.type() === "error") errors.push(message.text());
    });
    page.on("pageerror", (error) => errors.push(String(error)));
    await open(page, "it");
    await page.waitForLoadState("networkidle");
    // From here on, only the visitor's actions: nothing may leave the page.
    page.on("request", (request) => {
      if (isDemoEvent(request, origin)) return; // the cookieless funnel event (P3.5), checked in demo-analytics.spec.ts
      const url = new URL(request.url());
      if (url.origin !== origin) offenders.push(`foreign ${request.url()}`);
      if (request.method() !== "GET")
        offenders.push(`${request.method()} ${request.url()}`);
      if (url.pathname.startsWith("/api"))
        offenders.push(`api ${request.url()}`);
    });

    await research(page, "it");
    await row(page, "it", "alfa").click();
    await confirm(page, "it").click();
    await approve(page, "it").click();
    await row(page, "it", "fiume").click();
    await detail(page, "it")
      .getByRole("button", { name: c.gate.discard })
      .click();
    await page.waitForTimeout(300);

    expect(offenders).toEqual([]);
    expect(
      await page.evaluate(
        () => (window as unknown as { __csp: string[] }).__csp,
      ),
    ).toEqual([]);
    expect(errors).toEqual([]);
    expect(
      await page.evaluate(() => localStorage.length + sessionStorage.length),
    ).toBe(0);
    expect(await page.evaluate(() => document.cookie)).toBe("");
  });

  test("the page loads nothing from LinkedIn or any other third party", async ({
    page,
    baseURL,
  }) => {
    const origin = new URL(baseURL ?? "http://localhost:3100").origin;
    const foreign: string[] = [];
    page.on("request", (request) => {
      if (new URL(request.url()).origin !== origin) {
        foreign.push(request.url());
      }
    });

    await open(page, "en");
    await research(page, "en");
    await page.waitForLoadState("networkidle");

    expect(foreign).toEqual([]);
  });
});

test.describe("the call to action into the funnel", () => {
  for (const locale of LOCALES) {
    test(`${locale}: it goes to the contact page with the service pre-selected, and the form shows the need chosen`, async ({
      page,
    }) => {
      await open(page, locale);

      const link = demo(page, locale).getByRole("link", {
        name: shellCopy(locale).cta,
      });
      await expect(link).toHaveAttribute(
        "href",
        `/${locale}/contact?service=ai-agents`,
      );
      await link.click();

      await expect(page).toHaveURL(
        new RegExp(`/${locale}/contact\\?service=ai-agents$`),
      );
      await waitForHydration(page);
      const f = messages[locale].contact.form;
      await expect(
        page.getByRole("radio", { name: f.need.options["ai-agents"] }),
      ).toBeChecked();
      await expect(page.getByLabel(f.need.descriptionLabel)).toHaveValue("");
    });
  }

  test("the demo's own call to action says what this demo is for", async ({
    page,
  }) => {
    await open(page, "it");

    await expect(
      demo(page, "it").getByRole("heading", { name: demoCopy("it").ctaTitle }),
    ).toBeVisible();
  });

  test("the page's closing call to action also pre-selects the service", async ({
    page,
  }) => {
    await open(page, "it");

    await expect(
      page
        .getByRole("region", { name: messages.it.work.cta.title })
        .getByRole("link", { name: messages.it.work.cta.cta }),
    ).toHaveAttribute("href", "/it/contact?service=ai-agents");
  });
});

test.describe("keyboard", () => {
  test.use({ reducedMotion: "reduce" });

  test("the whole flow works with the keyboard: research, pick a prospect, confirm, approve", async ({
    page,
  }) => {
    const c = demoCopy("it");
    await open(page, "it");

    await page.getByRole("button", { name: c.controls.research }).focus();
    await page.keyboard.press("Enter");
    await expect(status(page, "it")).toContainText(
      c.controls.done.split("{")[0] ?? "",
      { timeout: 15_000 },
    );
    await row(page, "it", "borgo").focus();
    await page.keyboard.press("Enter");
    await confirm(page, "it").focus();
    await page.keyboard.press("Space");
    await expect(approve(page, "it")).toBeEnabled();
    await approve(page, "it").focus();
    await page.keyboard.press("Enter");

    await expect(detail(page, "it").getByText(c.gate.simulated)).toBeVisible();
  });
});

test.describe("accessibility (axe, WCAG 2.0-2.2 A/AA)", () => {
  test.use({ reducedMotion: "reduce" });

  for (const scheme of ["dark", "light"] as const) {
    for (const locale of LOCALES) {
      test(`${locale} (${scheme}): initial, researched with a draft, confirmed, and after approval: zero violations`, async ({
        page,
      }) => {
        await page.emulateMedia({ colorScheme: scheme });
        await open(page, locale);
        await expectNoAxeViolations(page);

        await research(page, locale);
        await row(page, locale, "alfa").click();
        await expectNoAxeViolations(page);

        await confirm(page, locale).click();
        await expectNoAxeViolations(page);

        await approve(page, locale).click();
        await expectNoAxeViolations(page);
      });
    }
  }

  test("every kind of prospect has an accessible detail view (draft, on hold, not a fit, blocked)", async ({
    page,
  }) => {
    await open(page, "en");
    await research(page, "en");

    for (const id of ["borgo", "cima", "delta", "eco", "fiume"] as const) {
      await row(page, "en", id).click();
      await expectNoAxeViolations(page);
    }
  });

  test("zero violations at 360 px, both themes, researched", async ({
    page,
  }) => {
    await page.setViewportSize({ width: 360, height: 800 });
    for (const scheme of ["dark", "light"] as const) {
      await page.emulateMedia({ colorScheme: scheme });
      await open(page, "it");
      await research(page, "it");
      await row(page, "it", "alfa").click();
      await confirm(page, "it").click();
      await expectNoAxeViolations(page);
    }
  });
});

test.describe("layout and stability", () => {
  test.use({ reducedMotion: "reduce" });

  for (const width of [360, 768, 1280, 1920]) {
    test(`${String(width)} px: no horizontal scroll, before the research and after a message is scheduled`, async ({
      page,
    }) => {
      await page.setViewportSize({ width, height: 900 });
      await open(page, "it");
      const overflow = () =>
        page.evaluate(
          () =>
            document.documentElement.scrollWidth -
            document.documentElement.clientWidth,
        );

      expect(await overflow()).toBeLessThanOrEqual(0);
      await research(page, "it");
      await row(page, "it", "alfa").click();
      expect(await overflow()).toBeLessThanOrEqual(0);
      await confirm(page, "it").click();
      await approve(page, "it").click();
      expect(await overflow()).toBeLessThanOrEqual(0);
    });
  }

  test("the prospects and the detail sit side by side on a desktop and stack on a phone", async ({
    page,
  }) => {
    await page.setViewportSize({ width: 1280, height: 900 });
    await open(page, "it");
    const sideBySide = async () => {
      const a = await list(page, "it").boundingBox();
      const b = await detail(page, "it").boundingBox();
      return Math.abs((a?.y ?? 0) - (b?.y ?? 1000)) < 40;
    };

    expect(await sideBySide()).toBe(true);
    await page.setViewportSize({ width: 360, height: 900 });
    expect(await sideBySide()).toBe(false);
  });

  test("CLS stays under 0.05 on load and through the research and an approval", async ({
    page,
  }) => {
    await trackLayoutShift(page);
    await page.goto(`/it/work/${SLUG}`);
    await waitForHydration(page);
    await research(page, "it");
    await row(page, "it", "alfa").click();
    await confirm(page, "it").click();
    await approve(page, "it").click();

    expect(await layoutShift(page)).toBeLessThan(0.05);
  });
});

test.describe("without JavaScript", () => {
  test.use({ javaScriptEnabled: false });

  test("the page is readable: the disclosure, the compliance framing, the prospects and a notice that the controls need JavaScript", async ({
    page,
  }) => {
    const c = demoCopy("it");
    await page.goto(`/it/work/${SLUG}`);

    await expect(page.getByText(c.disclosure)).toBeVisible();
    await expect(page.getByText(c.noscript)).toBeVisible();
    await expect(page.getByText(c.forbidden.bulk)).toBeVisible();
    await expect(page.getByText(c.items.alfa.name).first()).toBeVisible();
    await expect(
      demo(page, "it").getByRole("link", { name: shellCopy("it").cta }),
    ).toHaveAttribute("href", "/it/contact?service=ai-agents");
  });
});
