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
import { bookingOrigin, bookingURL } from "./support/servers";
import { settleAnimations, waitForHydration } from "./support/motion";

/**
 * Booking (P2.7) on the PRODUCTION build with CSP_MODE=enforce and
 * NEXT_PUBLIC_CAL_URL set to a placeholder on the EU Cal.com host. The booking
 * page is never really reached: every request to that origin is intercepted, and
 * the tests that matter count them. ROADMAP acceptance: no request to the
 * booking provider before the visitor clicks.
 */

const WCAG_TAGS = ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"];
const LOCALES = ["it", "en"] as const;
const messages = { it, en } as const;
const STUB =
  "<!doctype html><html><head><title>stub</title></head><body><p>stub calendar</p></body></html>";

type Locale = (typeof LOCALES)[number];

/** Intercepts the booking origin and records every request made to it. */
async function stubBooking(page: Page): Promise<string[]> {
  const seen: string[] = [];
  await page.route(`${bookingOrigin}/**`, (route) => {
    seen.push(route.request().url());
    return route.fulfill({
      status: 200,
      contentType: "text/html",
      body: STUB,
    });
  });
  page.on("request", (request) => {
    if (request.url().startsWith(bookingOrigin)) seen.push(request.url());
  });
  return seen;
}

async function open(page: Page, locale: Locale) {
  await page.goto(`/${locale}/contact`);
  await waitForHydration(page);
  await settleAnimations(page);
}

const copy = (locale: Locale) => messages[locale].contact.booking;

async function visitor(browser: Browser, info: TestInfo) {
  let hash = 11;
  for (const char of `${info.titlePath.join("/")}${String(Date.now())}`) {
    hash = (hash * 31 + char.charCodeAt(0)) >>> 0;
  }
  const context = await browser.newContext({
    extraHTTPHeaders: {
      "x-real-ip": `198.19.${String((hash >>> 8) % 256)}.${String((hash % 254) + 1)}`,
    },
  });
  return { context, page: await context.newPage() };
}

for (const locale of LOCALES) {
  const c = copy(locale);

  test.describe(`booking section (${locale})`, () => {
    test("is part of the contact page: an h2, a lead, the blocked calendar with its disclosure, a button and the plain link", async ({
      page,
    }) => {
      await stubBooking(page);
      await open(page, locale);

      await expect(
        page.getByRole("heading", { level: 2, name: c.title }),
      ).toBeVisible();
      await expect(page.getByText(c.lead)).toBeVisible();
      await expect(page.getByText(c.gate.title)).toBeVisible();
      await expect(page.getByText(c.gate.body)).toBeVisible();
      await expect(
        page.getByRole("button", { name: c.gate.load }),
      ).toBeVisible();
      const link = page.getByRole("link", { name: new RegExp(c.fallback) });
      await expect(link).toHaveAttribute("href", bookingURL);
      await expect(link).toHaveAttribute("target", "_blank");
      expect(await link.getAttribute("rel")).toMatch(/noopener/);
      await expect(
        page.getByRole("link", { name: new RegExp(c.fallback) }),
      ).toHaveAccessibleName(`${c.fallback} ${c.newTab}`);
    });

    test("NO request is made to the booking provider before the click, however the page is used (negative)", async ({
      page,
    }) => {
      const seen = await stubBooking(page);
      await open(page, locale);
      // Use the page: scroll, move the pointer over the gate, walk the whole form.
      await page.mouse.wheel(0, 3000);
      await page.getByText(c.gate.title).hover();
      await page.waitForLoadState("networkidle");
      await page.waitForTimeout(500);

      expect(seen).toEqual([]);
      expect(await page.locator("iframe").count()).toBe(0);
      const html = await page.content();
      expect(html).not.toContain("<iframe");
      const hints = await page
        .locator(
          'head link[rel~="preconnect"], head link[rel~="dns-prefetch"], head link[rel~="preload"], head link[rel~="prefetch"]',
        )
        .evaluateAll((all) =>
          all.map((link) => link.getAttribute("href") ?? ""),
        );
      expect(hints.filter((href) => href.includes("cal."))).toEqual([]);
      const resources = await page.evaluate(() =>
        performance.getEntriesByType("resource").map((entry) => entry.name),
      );
      expect(resources.filter((name) => name.includes("cal.eu"))).toEqual([]);
    });

    test("the click loads exactly the configured page, in a titled, sandboxed frame, and moves focus to it, with no CSP violation", async ({
      page,
    }) => {
      const seen = await stubBooking(page);
      await page.addInitScript(() => {
        const w = window as unknown as { __csp: string[] };
        w.__csp = [];
        document.addEventListener("securitypolicyviolation", (event) => {
          w.__csp.push(`${event.violatedDirective} <- ${event.blockedURI}`);
        });
      });
      await open(page, locale);
      expect(seen).toEqual([]);

      await page.getByRole("button", { name: c.gate.load }).click();

      const frame = page.locator("iframe");
      await expect(frame).toHaveCount(1);
      await expect(frame).toHaveAttribute("src", bookingURL);
      await expect(frame).toHaveAttribute("title", c.frameTitle);
      await expect(frame).toHaveAttribute("referrerpolicy", "strict-origin");
      expect(await frame.getAttribute("sandbox")).not.toMatch(
        /allow-top-navigation|allow-modals/,
      );
      await expect(
        page.frameLocator("iframe").getByText("stub calendar"),
      ).toBeVisible();
      await expect(
        page.getByRole("region", { name: c.gate.title }),
      ).toBeFocused();
      expect(seen.length).toBeGreaterThan(0);
      expect(seen.every((url) => url.startsWith(bookingURL))).toBe(true);
      expect(
        await page.evaluate(
          () => (window as unknown as { __csp: string[] }).__csp,
        ),
      ).toEqual([]);
      await expect(
        page.getByRole("link", { name: new RegExp(c.fallback) }),
      ).toBeVisible();
    });

    test("a keyboard user can load it: Tab to the button, Enter", async ({
      page,
    }) => {
      await stubBooking(page);
      await open(page, locale);

      await page.getByRole("button", { name: c.gate.load }).focus();
      await page.keyboard.press("Enter");

      await expect(page.locator("iframe")).toHaveCount(1);
    });

    test("the choice is not remembered: after a reload the calendar is blocked again and nothing was stored", async ({
      page,
    }) => {
      const seen = await stubBooking(page);
      await open(page, locale);
      await page.getByRole("button", { name: c.gate.load }).click();
      await expect(page.locator("iframe")).toHaveCount(1);
      seen.length = 0;

      await page.reload();
      await waitForHydration(page);
      await page.waitForLoadState("networkidle");

      await expect(page.locator("iframe")).toHaveCount(0);
      await expect(
        page.getByRole("button", { name: c.gate.load }),
      ).toBeVisible();
      expect(seen).toEqual([]);
      expect(await page.evaluate(() => document.cookie)).toBe("");
      expect(
        await page.evaluate(() =>
          Object.keys(localStorage).filter((key) =>
            /cal|consent|booking/i.test(key),
          ),
        ),
      ).toEqual([]);
    });
  });
}

test.describe("content security policy", () => {
  test("frame-src allows the booking origin and only it; nothing else gains the origin", async ({
    request,
  }) => {
    const response = await request.get("/it/contact");
    const policy = response.headers()["content-security-policy"] ?? "";
    const directive = (name: string) =>
      policy
        .split(";")
        .map((part) => part.trim())
        .find((part) => part.startsWith(`${name} `)) ?? "";

    expect(directive("frame-src")).toBe(`frame-src ${bookingOrigin}`);
    for (const other of [
      "default-src",
      "script-src",
      "connect-src",
      "img-src",
      "style-src",
      "font-src",
      "form-action",
    ]) {
      expect(directive(other), other).not.toContain("cal.eu");
    }
    expect(policy).not.toContain("example-handle");
    expect(policy).not.toMatch(/\*/);
  });

  test("another provider's page cannot be framed, even with the booking origin allowed (negative)", async ({
    page,
  }) => {
    await open(page, "it");
    const violations = await page.evaluate(
      () =>
        new Promise<string[]>((resolve) => {
          const seen: string[] = [];
          document.addEventListener("securitypolicyviolation", (event) => {
            seen.push(`${event.violatedDirective} <- ${event.blockedURI}`);
          });
          const frame = document.createElement("iframe");
          frame.src = "https://cal.com/someone";
          document.body.append(frame);
          setTimeout(() => {
            resolve(seen);
          }, 800);
        }),
    );

    expect(violations.some((entry) => entry.startsWith("frame-src"))).toBe(
      true,
    );
  });
});

test.describe("without JavaScript", () => {
  test.use({ javaScriptEnabled: false });

  test("only the plain link is offered: the button would do nothing, so it is hidden", async ({
    page,
  }) => {
    await page.goto("/it/contact");

    const c = copy("it");
    await expect(page.getByText(c.gate.body)).toBeVisible();
    await expect(page.getByRole("button", { name: c.gate.load })).toBeHidden();
    await expect(
      page.getByRole("link", { name: new RegExp(c.fallback) }),
    ).toHaveAttribute("href", bookingURL);
  });
});

test.describe("the form keeps working next to the booking option", () => {
  test("the inquiry can be sent whether or not the calendar was loaded", async ({
    browser,
  }, info) => {
    const { context, page } = await visitor(browser, info);
    await stubBooking(page);
    await open(page, "it");
    await page.getByRole("button", { name: copy("it").gate.load }).click();
    await expect(page.locator("iframe")).toHaveCount(1);
    const f = it.contact.form;

    await page
      .getByRole("radio", { name: f.need.options["ai-agents"] })
      .check();
    await page
      .getByLabel(f.need.descriptionLabel)
      .fill(
        "We receive many repeated requests by email and want to sort them.",
      );
    await page.getByRole("button", { name: f.buttons.next }).click();
    await page.getByRole("radio", { name: f.budget.options["5k-15k"] }).check();
    await page.getByRole("button", { name: f.buttons.next }).click();
    await page.getByRole("radio", { name: f.timeline.options.asap }).check();
    await page.getByRole("button", { name: f.buttons.next }).click();
    await page.getByLabel(f.contact.nameLabel).fill("Anna Test");
    await page.getByLabel(f.contact.emailLabel).fill("anna.test@example.com");
    await page.getByRole("button", { name: f.buttons.submit }).click();

    await expect(page).toHaveURL(/\/it\/contact\/thanks$/);
    await context.close();
  });

  test("the contact page still has exactly one h1, and the booking h2 comes after the form and its lists", async ({
    page,
  }) => {
    await stubBooking(page);
    await open(page, "it");

    await expect(page.getByRole("heading", { level: 1 })).toHaveCount(1);
    const h2 = await page
      .getByRole("main")
      .getByRole("heading", { level: 2 })
      .allTextContents();
    expect(h2.at(-1)).toBe(copy("it").title);
  });
});

test.describe("accessibility (axe, WCAG 2.0-2.2 A/AA)", () => {
  for (const scheme of ["dark", "light"] as const) {
    test(`blocked and loaded (${scheme}): zero violations`, async ({
      page,
    }) => {
      await stubBooking(page);
      await page.emulateMedia({ colorScheme: scheme });
      await open(page, "it");
      let results = await new AxeBuilder({ page })
        .withTags(WCAG_TAGS)
        .analyze();
      expect(results.violations).toEqual([]);

      await page.getByRole("button", { name: copy("it").gate.load }).click();
      await expect(page.locator("iframe")).toHaveCount(1);
      results = await new AxeBuilder({ page })
        .withTags(WCAG_TAGS)
        .exclude("iframe")
        .analyze();
      expect(results.violations).toEqual([]);
    });
  }

  test("English at 360 px, blocked and loaded: zero violations and no horizontal scroll", async ({
    page,
  }) => {
    await stubBooking(page);
    await page.setViewportSize({ width: 360, height: 800 });
    await open(page, "en");
    const overflow = () =>
      page.evaluate(
        () =>
          document.documentElement.scrollWidth -
          document.documentElement.clientWidth,
      );

    expect(
      (await new AxeBuilder({ page }).withTags(WCAG_TAGS).analyze()).violations,
    ).toEqual([]);
    expect(await overflow()).toBeLessThanOrEqual(0);
    await page.getByRole("button", { name: copy("en").gate.load }).click();
    await expect(page.locator("iframe")).toHaveCount(1);
    expect(await overflow()).toBeLessThanOrEqual(0);
  });

  test.describe("reduced motion", () => {
    test.use({ reducedMotion: "reduce" });

    test("zero violations", async ({ page }) => {
      await stubBooking(page);
      await open(page, "en");

      expect(
        (await new AxeBuilder({ page }).withTags(WCAG_TAGS).analyze())
          .violations,
      ).toEqual([]);
    });
  });
});
