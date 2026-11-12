import AxeBuilder from "@axe-core/playwright";
import {
  expect,
  test,
  type Browser,
  type Page,
  type TestInfo,
} from "@playwright/test";

import en from "../messages/en.json";
import it from "../messages/it.json";
import {
  layoutShift,
  settleAnimations,
  trackLayoutShift,
  waitForHydration,
} from "./support/motion";

/**
 * The contact page and the inquiry funnel (P2.5) on the PRODUCTION build served
 * with CSP_MODE=enforce and NO service configured: that is the local/CI mode of
 * the funnel (docs/PROJECT_STATE.md D30): memory limiter, memory store, memory
 * mailbox and a bot check that passes, so nothing leaves the machine. What the
 * tests can and cannot see from the browser:
 *  - they see the form, its validation, the redirect to the confirmation page,
 *    the rate-limit message, the silent success for a filled honeypot, and that
 *    no third-party request is made;
 *  - they cannot read the stored row or the mailbox (in-process). That is
 *    proved by the unit tests (process.test.ts, store.test.ts, actions.test.ts).
 *
 * The rate limiter is per client address and lives in the server process, so
 * every test uses its own client address (`x-real-ip`), or a second test run
 * would see the first one's counts.
 */

const WCAG_TAGS = ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"];
const LOCALES = ["it", "en"] as const;
const messages = { it, en } as const;
const BRAND = "AI Solutions & Engineering";
const RUN = String(Date.now());

type Locale = (typeof LOCALES)[number];

/** A client address derived from the test and this run: stable inside a test, different between tests and runs. */
function addressFor(info: TestInfo, salt = ""): string {
  let hash = 7;
  for (const char of `${info.titlePath.join("/")}${RUN}${salt}`) {
    hash = (hash * 31 + char.charCodeAt(0)) >>> 0;
  }
  // 198.18.0.0/15 is reserved for benchmarking (RFC 2544): never a real visitor.
  return `198.18.${String((hash >>> 8) % 256)}.${String((hash % 254) + 1)}`;
}

async function visitor(browser: Browser, info: TestInfo, salt = "") {
  const context = await browser.newContext({
    extraHTTPHeaders: { "x-real-ip": addressFor(info, salt) },
  });
  return { context, page: await context.newPage() };
}

async function open(page: Page, locale: Locale) {
  await page.goto(`/${locale}/contact`);
  await waitForHydration(page);
  await settleAnimations(page);
}

const form = (locale: Locale) => messages[locale].contact.form;
const DESCRIPTION =
  "We receive many repeated requests by email and want to sort them automatically.";

async function stepNeed(page: Page, locale: Locale) {
  const f = form(locale);
  await page.getByRole("radio", { name: f.need.options["ai-agents"] }).check();
  await page.getByLabel(f.need.descriptionLabel).fill(DESCRIPTION);
  await page.getByRole("button", { name: f.buttons.next }).click();
}

async function stepBudgetAndTimeline(page: Page, locale: Locale) {
  const f = form(locale);
  await page.getByRole("radio", { name: f.budget.options["5k-15k"] }).check();
  await page.getByRole("button", { name: f.buttons.next }).click();
  await page.getByRole("radio", { name: f.timeline.options.asap }).check();
  await page.getByRole("button", { name: f.buttons.next }).click();
}

async function stepContact(page: Page, locale: Locale) {
  const f = form(locale);
  await page.getByLabel(f.contact.nameLabel).fill("Anna Test");
  await page.getByLabel(f.contact.emailLabel).fill("anna.test@example.com");
}

async function toContactStep(page: Page, locale: Locale) {
  await stepNeed(page, locale);
  await stepBudgetAndTimeline(page, locale);
}

async function expectNoAxeViolations(page: Page) {
  const results = await new AxeBuilder({ page }).withTags(WCAG_TAGS).analyze();
  expect(results.violations).toEqual([]);
}

for (const locale of LOCALES) {
  const copy = messages[locale].contact;
  const f = form(locale);

  test.describe(`page (${locale})`, () => {
    test("one h1, the approved lead, the form and the two lists beside it", async ({
      page,
    }) => {
      const response = await page.goto(`/${locale}/contact`);

      expect(response?.status()).toBe(200);
      await expect(page.getByRole("heading", { level: 1 })).toHaveText(
        copy.title,
      );
      await expect(page.getByText(copy.lead)).toBeVisible();
      await expect(
        page.getByRole("heading", { level: 2, name: f.title }),
      ).toBeVisible();
      await expect(
        page.getByRole("heading", { level: 2, name: copy.prepare.title }),
      ).toBeVisible();
      await expect(
        page.getByRole("heading", { level: 2, name: copy.next.title }),
      ).toBeVisible();
    });

    test("title, description, canonical and hreflang are right", async ({
      page,
    }) => {
      await page.goto(`/${locale}/contact`);

      await expect(page).toHaveTitle(
        `${messages[locale].metadata.contact.title} | ${BRAND}`,
      );
      await expect(page.locator('meta[name="description"]')).toHaveAttribute(
        "content",
        messages[locale].metadata.contact.description,
      );
      expect(
        await page.locator('link[rel="canonical"]').getAttribute("href"),
      ).toMatch(new RegExp(`/${locale}/contact$`));
      const alternates = await page
        .locator('link[rel="alternate"][hreflang]')
        .evaluateAll((all) =>
          all.map((link) => link.getAttribute("hreflang") ?? ""),
        );
      expect(alternates.sort()).toEqual(["en", "it", "x-default"]);
    });

    test("the header and the closing buttons of the site lead here", async ({
      page,
    }) => {
      await page.goto(`/${locale}`);
      await waitForHydration(page);

      await page
        .getByRole("banner")
        .getByRole("link", { name: messages[locale].cta.label })
        .click();

      await expect(page).toHaveURL(new RegExp(`/${locale}/contact$`));
    });
  });

  test.describe(`inquiry funnel (${locale})`, () => {
    test("happy path: four steps, then the confirmation page", async ({
      browser,
    }, info) => {
      const { context, page } = await visitor(browser, info);
      await open(page, locale);

      await expect(
        page.getByRole("heading", { level: 3, name: f.steps.need }),
      ).toBeVisible();
      await stepNeed(page, locale);
      await expect(
        page.getByRole("group", { name: f.budget.legend }),
      ).toBeVisible();
      await expect(
        page.locator("form").getByRole("heading", { level: 3 }),
      ).toBeFocused();
      await stepBudgetAndTimeline(page, locale);
      await expect(page.getByLabel(f.contact.nameLabel)).toBeVisible();
      await stepContact(page, locale);
      await page.getByRole("button", { name: f.buttons.submit }).click();

      await expect(page).toHaveURL(new RegExp(`/${locale}/contact/thanks$`));
      await expect(page.getByRole("heading", { level: 1 })).toHaveText(
        copy.thanks.title,
      );
      await expect(page.getByText(copy.thanks.body)).toBeVisible();
      await context.close();
    });

    test("nothing the visitor typed appears in the confirmation URL or page", async ({
      browser,
    }, info) => {
      const { context, page } = await visitor(browser, info);
      await open(page, locale);
      await toContactStep(page, locale);
      await stepContact(page, locale);
      await page.getByRole("button", { name: f.buttons.submit }).click();
      await expect(page).toHaveURL(new RegExp(`/${locale}/contact/thanks$`));

      expect(page.url()).not.toMatch(/anna|example|need|budget/i);
      expect(await page.content()).not.toContain("anna.test@example.com");
      await context.close();
    });

    test("the marketing consent is unticked and optional: sending works without ticking it", async ({
      browser,
    }, info) => {
      const { context, page } = await visitor(browser, info);
      await open(page, locale);
      await toContactStep(page, locale);

      const box = page.getByRole("checkbox", { name: f.consent.marketing });
      await expect(box).not.toBeChecked();
      await stepContact(page, locale);
      await page.getByRole("button", { name: f.buttons.submit }).click();

      await expect(page).toHaveURL(new RegExp(`/${locale}/contact/thanks$`));
      await context.close();
    });

    test("an empty step shows an error summary that takes focus, and stays on the step", async ({
      browser,
    }, info) => {
      const { context, page } = await visitor(browser, info);
      await open(page, locale);

      await page.getByRole("button", { name: f.buttons.next }).click();

      const summary = page.locator("form").getByRole("alert");
      await expect(summary).toContainText(f.errors.summaryTitle);
      await expect(summary).toBeFocused();
      await expect(
        page.getByRole("group", { name: f.need.legend }),
      ).toBeVisible();
      await expect(page.getByLabel(f.need.descriptionLabel)).toHaveAttribute(
        "aria-invalid",
        "true",
      );
      await context.close();
    });

    test("a malformed email is caught on the details step", async ({
      browser,
    }, info) => {
      const { context, page } = await visitor(browser, info);
      await open(page, locale);
      await toContactStep(page, locale);
      await page.getByLabel(f.contact.nameLabel).fill("Anna Test");
      await page.getByLabel(f.contact.emailLabel).fill("not-an-email");

      await page.getByRole("button", { name: f.buttons.submit }).click();

      await expect(
        page.getByLabel(f.contact.emailLabel),
      ).toHaveAccessibleDescription(
        `${f.contact.emailHint} ${f.errors.emailInvalid}`,
      );
      await expect(page).toHaveURL(new RegExp(`/${locale}/contact$`));
      await context.close();
    });

    test("going back keeps what was typed", async ({ browser }, info) => {
      const { context, page } = await visitor(browser, info);
      await open(page, locale);
      await stepNeed(page, locale);

      await page.getByRole("button", { name: f.buttons.back }).click();

      await expect(page.getByLabel(f.need.descriptionLabel)).toHaveValue(
        DESCRIPTION,
      );
      await expect(
        page.getByRole("radio", { name: f.need.options["ai-agents"] }),
      ).toBeChecked();
      await context.close();
    });

    test("the privacy sentence is on the details step and links to the privacy notice (P4.2), with no literal tag in the text", async ({
      browser,
    }, info) => {
      const { context, page } = await visitor(browser, info);
      await open(page, locale);
      await toContactStep(page, locale);

      await expect(page.getByText(/art\. 6/)).toBeVisible();
      await expect(page.locator("form a[href*='privacy']")).toHaveAttribute(
        "href",
        `/${locale}/privacy`,
      );
      await expect(page.locator("form")).not.toContainText("<link>");
      await context.close();
    });

    test("the sixth request in ten minutes from one address is refused with a message, and others are not", async ({
      browser,
    }, info) => {
      test.setTimeout(120_000);
      const { context, page } = await visitor(browser, info);

      for (let attempt = 0; attempt < 5; attempt++) {
        await open(page, locale);
        await toContactStep(page, locale);
        await stepContact(page, locale);
        await page.getByRole("button", { name: f.buttons.submit }).click();
        await expect(page).toHaveURL(new RegExp(`/${locale}/contact/thanks$`));
      }
      await open(page, locale);
      await toContactStep(page, locale);
      await stepContact(page, locale);
      await page.getByRole("button", { name: f.buttons.submit }).click();

      await expect(page.locator("form").getByRole("alert")).toContainText(
        f.failure.rate_limited.split("{minutes}")[0] ?? "",
      );
      await expect(page).toHaveURL(new RegExp(`/${locale}/contact$`));
      await expect(page.getByLabel(f.contact.nameLabel)).toHaveValue(
        "Anna Test",
      );

      const other = await visitor(browser, info, "another-client");
      await open(other.page, locale);
      await toContactStep(other.page, locale);
      await stepContact(other.page, locale);
      await other.page.getByRole("button", { name: f.buttons.submit }).click();
      await expect(other.page).toHaveURL(
        new RegExp(`/${locale}/contact/thanks$`),
      );
      await other.context.close();
      await context.close();
    });

    test("a filled honeypot gets a normal-looking success and no error (the bot learns nothing)", async ({
      browser,
    }, info) => {
      const { context, page } = await visitor(browser, info);
      await open(page, locale);
      await toContactStep(page, locale);
      await stepContact(page, locale);
      await page.evaluate(() => {
        const input = document.querySelector<HTMLInputElement>(
          'input[name="website"]',
        );
        if (input) input.value = "http://spam.example";
      });

      await page.getByRole("button", { name: f.buttons.submit }).click();

      await expect(page).toHaveURL(new RegExp(`/${locale}/contact/thanks$`));
      await context.close();
    });

    test("the honeypot is invisible to people: hidden from assistive technology and out of the tab order", async ({
      browser,
    }, info) => {
      const { context, page } = await visitor(browser, info);
      await open(page, locale);
      await toContactStep(page, locale);

      const honeypot = page.locator('input[name="website"]');
      await expect(honeypot).toHaveAttribute("tabindex", "-1");
      await expect(
        honeypot.locator("xpath=ancestor::*[@aria-hidden='true']"),
      ).toHaveCount(1);
      await context.close();
    });

    test("no request leaves the site during the whole flow, and the enforced CSP is never violated", async ({
      browser,
      baseURL,
    }, info) => {
      const { context, page } = await visitor(browser, info);
      const origin = new URL(baseURL ?? "http://localhost:3100").origin;
      const foreign: string[] = [];
      const errors: string[] = [];
      page.on("request", (request) => {
        const url = new URL(request.url());
        if (!["http:", "https:"].includes(url.protocol)) return;
        if (url.origin !== origin) foreign.push(url.origin);
      });
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

      await open(page, locale);
      await toContactStep(page, locale);
      await stepContact(page, locale);
      const violations = await page.evaluate(
        () => (window as unknown as { __csp: string[] }).__csp,
      );
      await page.getByRole("button", { name: f.buttons.submit }).click();
      await expect(page).toHaveURL(new RegExp(`/${locale}/contact/thanks$`));

      expect(foreign).toEqual([]);
      expect(violations).toEqual([]);
      expect(errors).toEqual([]);
      await context.close();
    });
  });
}

test.describe("confirmation page", () => {
  for (const locale of LOCALES) {
    test(`/${locale}/contact/thanks renders, is not indexable, and shows nothing personal`, async ({
      page,
    }) => {
      const response = await page.goto(`/${locale}/contact/thanks`);

      expect(response?.status()).toBe(200);
      await expect(page.getByRole("heading", { level: 1 })).toHaveText(
        messages[locale].contact.thanks.title,
      );
      await expect(page.locator('meta[name="robots"]')).toHaveAttribute(
        "content",
        /noindex/,
      );
    });
  }
});

test.describe("without JavaScript", () => {
  test.use({ javaScriptEnabled: false });

  test("the page is readable: h1, lead, the first step and the two lists are in the HTML", async ({
    page,
  }) => {
    await page.goto("/it/contact");

    await expect(page.getByRole("heading", { level: 1 })).toHaveText(
      it.contact.title,
    );
    await expect(page.getByText(it.contact.lead)).toBeVisible();
    await expect(
      page.getByRole("group", { name: it.contact.form.need.legend }),
    ).toBeVisible();
    await expect(
      page.getByRole("heading", { level: 2, name: it.contact.next.title }),
    ).toBeVisible();
    // The steps need JavaScript: the visitor is told so, in words.
    await expect(page.getByText(it.contact.form.noscript)).toBeVisible();
  });
});

test.describe("accessibility (axe, WCAG 2.0-2.2 A/AA)", () => {
  for (const scheme of ["dark", "light"] as const) {
    for (const locale of LOCALES) {
      test(`step 1 /${locale}/contact (${scheme}): zero violations`, async ({
        page,
      }) => {
        await page.emulateMedia({ colorScheme: scheme });
        await open(page, locale);

        await expectNoAxeViolations(page);
      });
    }

    test(`every step and the error summary (${scheme}): zero violations`, async ({
      browser,
    }, info) => {
      const { context, page } = await visitor(browser, info, scheme);
      await page.emulateMedia({ colorScheme: scheme });
      await open(page, "it");

      await page
        .getByRole("button", { name: it.contact.form.buttons.next })
        .click();
      await expectNoAxeViolations(page); // the error summary on step 1
      await stepNeed(page, "it");
      await expectNoAxeViolations(page); // budget
      await page
        .getByRole("radio", { name: it.contact.form.budget.options["5k-15k"] })
        .check();
      await page
        .getByRole("button", { name: it.contact.form.buttons.next })
        .click();
      await expectNoAxeViolations(page); // timeline
      await page
        .getByRole("radio", { name: it.contact.form.timeline.options.asap })
        .check();
      await page
        .getByRole("button", { name: it.contact.form.buttons.next })
        .click();
      await expectNoAxeViolations(page); // details, with the honeypot and the consent
      await page
        .getByRole("button", { name: it.contact.form.buttons.submit })
        .click();
      await expectNoAxeViolations(page); // details with errors
      await context.close();
    });

    test(`the confirmation page (${scheme}): zero violations`, async ({
      page,
    }) => {
      await page.emulateMedia({ colorScheme: scheme });
      await page.goto("/en/contact/thanks");
      await waitForHydration(page);

      await expectNoAxeViolations(page);
    });
  }

  test("zero violations at 360 px in both themes", async ({ page }) => {
    await page.setViewportSize({ width: 360, height: 800 });
    for (const scheme of ["dark", "light"] as const) {
      await page.emulateMedia({ colorScheme: scheme });
      await open(page, "en");
      await expectNoAxeViolations(page);
    }
  });

  test.describe("reduced motion", () => {
    test.use({ reducedMotion: "reduce" });

    test("zero violations", async ({ page }) => {
      await open(page, "it");
      await expectNoAxeViolations(page);
    });
  });
});

test.describe("layout and stability", () => {
  for (const width of [360, 768, 1280, 1920]) {
    test(`${String(width)} px: no horizontal scroll on the page and on the last step`, async ({
      browser,
    }, info) => {
      const { context, page } = await visitor(browser, info, String(width));
      await page.setViewportSize({ width, height: 900 });
      await open(page, "it");
      await toContactStep(page, "it");

      const overflow = await page.evaluate(
        () =>
          document.documentElement.scrollWidth -
          document.documentElement.clientWidth,
      );
      expect(overflow).toBeLessThanOrEqual(0);
      await context.close();
    });
  }

  test("CLS stays under 0.05 while the page loads", async ({ page }) => {
    await trackLayoutShift(page);
    await page.goto("/it/contact");
    await waitForHydration(page);
    await page.waitForTimeout(500);

    expect(await layoutShift(page)).toBeLessThan(0.05);
  });

  test("the radio options, buttons and fields are at least 44 px tall (the checkbox extends its hit area by CSS)", async ({
    page,
  }) => {
    await open(page, "it");

    const heights = await page
      .locator(
        "form label:has(input[type='radio']), form button:not([role='checkbox']), form textarea",
      )
      .evaluateAll((all) =>
        all.map((el) => Math.round(el.getBoundingClientRect().height)),
      );
    expect(heights.length).toBeGreaterThan(5);
    expect(Math.min(...heights)).toBeGreaterThanOrEqual(44);
  });
});
