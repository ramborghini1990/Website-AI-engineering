import AxeBuilder from "@axe-core/playwright";
import {
  expect,
  test,
  type APIRequestContext,
  type Browser,
  type BrowserContext,
  type Page,
  type TestInfo,
} from "@playwright/test";

import en from "../messages/en.json";
import it from "../messages/it.json";
import { bookingOrigin } from "./support/servers";
import { settleAnimations, waitForHydration } from "./support/motion";

/**
 * The cookie banner and consent receipt (P4.1) on the PRODUCTION build with
 * CSP_MODE=enforce. Garante 2021 guidelines as tests: nothing non-essential
 * before consent, Accept and Reject equal, "X" = reject, no consent by
 * scrolling, no pre-ticked box, 6 months before asking again, withdrawal as easy
 * as giving, and a receipt with no IP.
 */

const WCAG_TAGS = ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"];
const LOCALES = ["it", "en"] as const;
const messages = { it, en } as const;
const STUB =
  "<!doctype html><html><head><title>stub</title></head><body><p>stub calendar</p></body></html>";
const DAY = 24 * 60 * 60 * 1000;

type Locale = (typeof LOCALES)[number];

const copy = (locale: Locale) => messages[locale].consent;

/** A visitor with their own client address, so the receipt limiter never couples tests. */
async function visitor(browser: Browser, info: TestInfo) {
  let hash = 17;
  for (const char of `${info.titlePath.join("/")}${String(Date.now())}`) {
    hash = (hash * 31 + char.charCodeAt(0)) >>> 0;
  }
  const context = await browser.newContext({
    extraHTTPHeaders: {
      "x-real-ip": `198.18.${String((hash >>> 8) % 256)}.${String((hash % 254) + 1)}`,
    },
  });
  const page = await context.newPage();
  const booking: string[] = [];
  await page.route(`${bookingOrigin}/**`, (route) => {
    booking.push(route.request().url());
    return route.fulfill({
      status: 200,
      contentType: "text/html",
      body: STUB,
    });
  });
  const foreign: string[] = [];
  const problems: string[] = [];
  page.on("request", (request) => {
    const url = request.url();
    if (url.startsWith("data:") || url.startsWith("blob:")) return;
    if (!url.startsWith(String(info.project.use.baseURL))) foreign.push(url);
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
  return { context, page, booking, foreign, problems };
}

async function open(page: Page, locale: Locale, path = "") {
  await page.goto(`/${locale}${path}`);
  await waitForHydration(page);
  await settleAnimations(page);
}

const banner = (page: Page) => page.locator("[data-consent-banner]");
const action = (page: Page, name: string) =>
  page.locator(`[data-consent-action='${name}']`);

const consentCookie = async (context: BrowserContext) =>
  (await context.cookies()).find((cookie) => cookie.name === "consent");

const receipt = (page: Page) =>
  page.waitForResponse(
    (response) =>
      response.url().endsWith("/api/consent") &&
      response.request().method() === "POST",
  );

const decoded = (value: string) =>
  JSON.parse(decodeURIComponent(value)) as {
    v: string;
    t: number;
    c: number[];
    i?: string;
  };

for (const locale of LOCALES) {
  const c = copy(locale);

  test.describe(`cookie banner (${locale})`, () => {
    test("first visit: the banner asks, and NOTHING non-essential happens: no cookie, no storage, no third party, no request to the provider (negative)", async ({
      browser,
    }, info) => {
      const { context, page, booking, foreign, problems } = await visitor(
        browser,
        info,
      );
      await open(page, locale, "/contact");

      await expect(banner(page)).toBeVisible();
      await expect(page.getByRole("region", { name: c.title })).toBeVisible();
      await expect(action(page, "reject_all")).toHaveText(c.rejectAll);
      await expect(action(page, "accept_all")).toHaveText(c.acceptAll);
      await expect(action(page, "customize")).toHaveText(c.customize);
      await expect(page.getByText(c.closeHint)).toBeVisible();

      await page.waitForLoadState("networkidle");
      expect(await context.cookies()).toEqual([]);
      expect(await page.evaluate(() => document.cookie)).toBe("");
      expect(await page.evaluate(() => localStorage.length)).toBe(0);
      expect(await page.evaluate(() => sessionStorage.length)).toBe(0);
      expect(booking).toEqual([]);
      expect(foreign).toEqual([]);
      expect(await page.locator("iframe").count()).toBe(0);
      expect(problems).toEqual([]);
      await context.close();
    });

    test("Accept all and Reject all have equal prominence: same size, colours, weight and border", async ({
      browser,
    }, info) => {
      const { context, page } = await visitor(browser, info);
      await open(page, locale);

      const look = (name: string) =>
        action(page, name).evaluate((element) => {
          const style = getComputedStyle(element);
          const box = element.getBoundingClientRect();
          return {
            height: Math.round(box.height),
            background: style.backgroundColor,
            color: style.color,
            fontSize: style.fontSize,
            fontWeight: style.fontWeight,
            border: style.border,
            padding: style.padding,
          };
        });
      expect(await look("reject_all")).toEqual(await look("accept_all"));
      const reject = await action(page, "reject_all").boundingBox();
      const accept = await action(page, "accept_all").boundingBox();
      expect(Math.abs((reject?.y ?? 0) - (accept?.y ?? 1))).toBeLessThan(2);
      await context.close();
    });

    test("Accept all: a first-party technical cookie for 6 months, one receipt with no ip, the booking embed loads with no further click, and the banner does not come back", async ({
      browser,
    }, info) => {
      const { context, page, booking, problems } = await visitor(browser, info);
      await open(page, locale, "/contact");
      expect(booking).toEqual([]);

      const response = receipt(page);
      await action(page, "accept_all").click();
      const answered = await response;

      expect(answered.status()).toBe(201);
      expect(answered.headers()["set-cookie"]).toBeUndefined();
      expect(answered.request().postDataJSON()).toEqual({
        policyVersion: "2026-11-v1",
        method: "accept_all",
        choices: { booking: true },
      });
      const { id } = (await answered.json()) as { id: string };
      expect(id).toMatch(/^[0-9a-f-]{36}$/);

      await expect(banner(page)).toHaveCount(0);
      await expect(page.locator("iframe")).toHaveCount(1);
      await expect.poll(() => booking.length).toBeGreaterThan(0);

      await expect
        .poll(async () => {
          const cookie = await consentCookie(context);
          return cookie === undefined ? null : decoded(cookie.value).i;
        })
        .toBe(id);
      const cookie = await consentCookie(context);
      expect(cookie).toMatchObject({
        name: "consent",
        path: "/",
        httpOnly: false,
        sameSite: "Lax",
      });
      expect(decoded(cookie?.value ?? "")).toMatchObject({
        v: "2026-11-v1",
        c: [1],
      });
      // first party only, about 6 months
      const days = ((cookie?.expires ?? 0) * 1000 - Date.now()) / DAY;
      expect(days).toBeGreaterThan(180);
      expect(days).toBeLessThan(184);
      expect(await context.cookies()).toHaveLength(1);

      await page.reload();
      await waitForHydration(page);
      await expect(banner(page)).toHaveCount(0);
      await expect(page.locator("iframe")).toHaveCount(1);
      expect(problems).toEqual([]);
      expect(
        await page.evaluate(
          () => (window as unknown as { __csp: string[] }).__csp,
        ),
      ).toEqual([]);
      await context.close();
    });

    test("Reject all persists across reload and navigation, and the embed stays blocked (negative)", async ({
      browser,
    }, info) => {
      const { context, page, booking } = await visitor(browser, info);
      await open(page, locale, "/contact");

      const response = receipt(page);
      await action(page, "reject_all").click();
      expect((await response).request().postDataJSON()).toMatchObject({
        method: "reject_all",
        choices: { booking: false },
      });
      await expect(banner(page)).toHaveCount(0);

      await page.reload();
      await waitForHydration(page);
      await expect(banner(page)).toHaveCount(0);
      await open(page, locale, "");
      await expect(banner(page)).toHaveCount(0);
      await open(page, locale, "/contact");
      await expect(banner(page)).toHaveCount(0);
      await expect(page.locator("iframe")).toHaveCount(0);
      await expect(
        page.locator("[data-consent-gate='booking']"),
      ).toHaveAttribute("data-state", "blocked");
      await page.waitForLoadState("networkidle");
      expect(booking).toEqual([]);
      expect(decoded((await consentCookie(context))?.value ?? "").c).toEqual([
        0,
      ]);
      await context.close();
    });

    test("the X rejects: nothing is loaded, and the receipt says it was the X", async ({
      browser,
    }, info) => {
      const { context, page, booking } = await visitor(browser, info);
      await open(page, locale, "/contact");

      const response = receipt(page);
      await page.getByRole("button", { name: c.close }).click();

      expect((await response).request().postDataJSON()).toMatchObject({
        method: "close",
        choices: { booking: false },
      });
      await expect(banner(page)).toHaveCount(0);
      await expect(page.locator("iframe")).toHaveCount(0);
      expect(booking).toEqual([]);
      expect(decoded((await consentCookie(context))?.value ?? "").c).toEqual([
        0,
      ]);
      await context.close();
    });

    test("scrolling, moving, typing and clicking elsewhere are never consent (negative)", async ({
      browser,
    }, info) => {
      const { context, page, booking } = await visitor(browser, info);
      await open(page, locale, "/contact");

      await page.mouse.wheel(0, 4000);
      await page.keyboard.press("PageDown");
      await page.keyboard.press("Escape");
      await page.mouse.click(5, 5);
      await page.waitForTimeout(800);

      await expect(banner(page)).toBeVisible();
      expect(await context.cookies()).toEqual([]);
      expect(booking).toEqual([]);
      await context.close();
    });

    test("Customise: nothing is ticked in advance, necessary is on and locked; saving with the box ticked allows the embed", async ({
      browser,
    }, info) => {
      const { context, page } = await visitor(browser, info);
      await open(page, locale, "/contact");

      await action(page, "customize").click();
      const necessary = page.getByRole("checkbox", {
        name: c.categories.necessary.label,
      });
      const booking = page.getByRole("checkbox", {
        name: c.categories.booking.label,
      });
      await expect(necessary).toBeChecked();
      await expect(necessary).toBeDisabled();
      await expect(booking).not.toBeChecked();

      await booking.click();
      const response = receipt(page);
      await action(page, "save").click();

      expect((await response).request().postDataJSON()).toMatchObject({
        method: "custom",
        choices: { booking: true },
      });
      await expect(page.locator("iframe")).toHaveCount(1);
      await context.close();
    });

    test("withdrawing is as easy as giving: the footer link, one untick, one click, and the embed is gone", async ({
      browser,
    }, info) => {
      const { context, page } = await visitor(browser, info);
      await open(page, locale, "/contact");
      await action(page, "accept_all").click();
      await expect(page.locator("iframe")).toHaveCount(1);

      await page.getByRole("button", { name: c.reopen }).click();
      await expect(banner(page)).toHaveAttribute(
        "data-consent-banner",
        "reopened",
      );
      await expect(banner(page)).toBeFocused();
      const booking = page.getByRole("checkbox", {
        name: c.categories.booking.label,
      });
      await expect(booking).toBeChecked();
      await expect(page.getByText(/[0-9a-f]{8}-[0-9a-f]{4}-/)).toBeVisible();

      await booking.click();
      const response = receipt(page);
      await action(page, "save").click();

      expect((await response).request().postDataJSON()).toMatchObject({
        method: "custom",
        choices: { booking: false },
      });
      await expect(page.locator("iframe")).toHaveCount(0);
      await expect(banner(page)).toHaveCount(0);
      await expect(page.getByRole("status")).toHaveText(c.saved);
      await expect(page.getByRole("button", { name: c.reopen })).toBeFocused();
      expect(decoded((await consentCookie(context))?.value ?? "").c).toEqual([
        0,
      ]);
      await context.close();
    });

    test("closing the reopened panel changes nothing and sends nothing", async ({
      browser,
    }, info) => {
      const { context, page } = await visitor(browser, info);
      await open(page, locale, "/contact");
      // The receipt answers after the choice is applied and writes its code into
      // the cookie: wait for it, or `before` is read half-way through that update.
      const sent = receipt(page);
      await action(page, "accept_all").click();
      await sent;
      await expect(page.locator("iframe")).toHaveCount(1);
      await expect
        .poll(async () => {
          const value = (await consentCookie(context))?.value;
          return value === undefined ? undefined : decoded(value).i;
        })
        .toBeTruthy();
      const before = (await consentCookie(context))?.value;
      const requests: string[] = [];
      page.on("request", (request) => {
        if (request.url().endsWith("/api/consent")) requests.push("receipt");
      });

      await page.getByRole("button", { name: c.reopen }).click();
      await page.getByRole("button", { name: c.closeKeep }).click();

      await expect(banner(page)).toHaveCount(0);
      await expect(page.locator("iframe")).toHaveCount(1);
      expect(requests).toEqual([]);
      expect((await consentCookie(context))?.value).toBe(before);
      await context.close();
    });

    test("the footer link is on every page", async ({ browser }, info) => {
      const { context, page } = await visitor(browser, info);
      for (const path of ["", "/contact", "/services", "/work"]) {
        await open(page, locale, path);
        await expect(
          page.getByRole("button", { name: c.reopen }),
        ).toBeVisible();
      }
      await context.close();
    });

    test("keyboard only: the banner is the first thing after the skip link, and Reject all works with Enter", async ({
      browser,
    }, info) => {
      const { context, page } = await visitor(browser, info);
      await open(page, locale);

      await page.keyboard.press("Tab");
      await expect(page.locator("a[href^='#']").first()).toBeFocused();
      await page.keyboard.press("Tab");
      expect(
        await page.evaluate(
          () =>
            document.activeElement?.closest("[data-consent-banner]") !== null,
        ),
      ).toBe(true);

      for (let i = 0; i < 6; i += 1) {
        if (
          await action(page, "reject_all").evaluate(
            (element) => element === document.activeElement,
          )
        )
          break;
        await page.keyboard.press("Tab");
      }
      await expect(action(page, "reject_all")).toBeFocused();
      const response = receipt(page);
      await page.keyboard.press("Enter");
      await response;

      await expect(banner(page)).toHaveCount(0);
      await context.close();
    });
  });
}

// P4.7: the banner was the page's Largest Contentful Paint because it appeared
// only after hydration. The server now renders it for exactly the visitors the
// browser would show it to, so it paints with the first frame.
test.describe("the server renders the banner only for a visitor who must choose", () => {
  const cookie = (over: Record<string, unknown> = {}) =>
    encodeURIComponent(
      JSON.stringify({
        v: "2026-11-v1",
        t: Date.now() - 10 * DAY,
        c: [0],
        ...over,
      }),
    );
  const html = async (request: APIRequestContext, value?: string) =>
    (
      await request.get("/it", {
        headers: value === undefined ? {} : { cookie: `consent=${value}` },
      })
    ).text();

  test("no cookie: the banner, with its buttons and the text, is in the HTML", async ({
    request,
  }) => {
    const out = await html(request);
    expect(out).toContain('data-consent-banner="first"');
    expect(out).toContain('data-consent-action="reject_all"');
    expect(out).toContain('data-consent-action="accept_all"');
    expect(out).toContain(it.consent.title);
  });

  test("a valid decision (accept or reject): no banner in the HTML", async ({
    request,
  }) => {
    expect(await html(request, cookie())).not.toContain(
      'data-consent-banner="',
    );
    expect(await html(request, cookie({ c: [1] }))).not.toContain(
      'data-consent-banner="',
    );
  });

  test("a decision the browser would ignore is ignored by the server too (negative)", async ({
    request,
  }) => {
    for (const stale of [
      cookie({ t: Date.now() - 200 * DAY }), // older than six months
      cookie({ v: "1999-01-v0" }), // another wording
      cookie({ t: Date.now() + 5 * DAY }), // dated in the future
      cookie({ extra: 1 }), // a key we do not write
      "not-json",
      "a".repeat(500),
    ]) {
      expect(await html(request, stale), stale.slice(0, 30)).toContain(
        'data-consent-banner="first"',
      );
    }
  });

  test("carries the rule that hides it without JavaScript, with the page's nonce", async ({
    request,
  }) => {
    expect(await html(request)).toMatch(
      /<noscript><style nonce="[^"]+">\[data-consent-banner\]\{display:none\}<\/style><\/noscript>/,
    );
  });

  test("the server-rendered banner does not load a third party (negative)", async ({
    request,
  }) => {
    const out = await (await request.get("/it/contact")).text();
    expect(out).toContain('data-consent-banner="first"');
    expect(out).not.toContain("<iframe");
  });
});

test.describe("when the banner asks again, and when it does not", () => {
  const cookieValue = (over: Record<string, unknown>) =>
    encodeURIComponent(
      JSON.stringify({
        v: "2026-11-v1",
        t: Date.now() - 10 * DAY,
        c: [0],
        ...over,
      }),
    );

  async function withCookie(
    browser: Browser,
    info: TestInfo,
    value: string | null,
  ) {
    const v = await visitor(browser, info);
    if (value !== null) {
      await v.context.addCookies([
        {
          name: "consent",
          value,
          url: String(info.project.use.baseURL),
        },
      ]);
    }
    await open(v.page, "it", "/contact");
    return v;
  }

  test("not before 6 months: a rejection from 5 months ago stays", async ({
    browser,
  }, info) => {
    const { context, page, booking } = await withCookie(
      browser,
      info,
      cookieValue({ t: Date.now() - 150 * DAY }),
    );

    await expect(banner(page)).toHaveCount(0);
    await expect(page.locator("iframe")).toHaveCount(0);
    expect(booking).toEqual([]);
    await context.close();
  });

  test("after 6 months, when the wording version changed, or when the cookie is unreadable: it asks again and loads nothing", async ({
    browser,
  }, info) => {
    for (const value of [
      cookieValue({ t: Date.now() - 190 * DAY, c: [1] }),
      cookieValue({ v: "2025-01-v0", c: [1] }),
      "garbage",
      cookieValue({ c: [1], extra: true }),
    ]) {
      const { context, page, booking } = await withCookie(browser, info, value);
      await expect(banner(page), value).toBeVisible();
      await expect(page.locator("iframe"), value).toHaveCount(0);
      expect(booking, value).toEqual([]);
      await context.close();
    }
  });

  test("a cookie cleared by the visitor asks again", async ({
    browser,
  }, info) => {
    const { context, page } = await withCookie(browser, info, null);
    // Wait for the receipt: its answer rewrites the cookie, so clearing before it
    // arrives would be undone by the page itself.
    const sent = receipt(page);
    await action(page, "accept_all").click();
    await expect(banner(page)).toHaveCount(0);
    await sent;
    await expect
      .poll(async () => (await consentCookie(context))?.value ?? "")
      .toContain("%22i%22");

    await context.clearCookies();
    await page.reload();
    await waitForHydration(page);

    await expect(banner(page)).toBeVisible();
    await expect(page.locator("iframe")).toHaveCount(0);
    await context.close();
  });
});

test.describe("the receipt endpoint", () => {
  test("negative: another origin, a stale version and extra keys are refused; a good one is stored with no cookie set", async ({
    browser,
  }, info) => {
    const { context } = await visitor(browser, info);
    const request = context.request;
    const good = {
      policyVersion: "2026-11-v1",
      method: "accept_all",
      choices: { booking: true },
    };

    const foreign = await request.post("/api/consent", {
      data: good,
      headers: { origin: "https://evil.example" },
    });
    expect(foreign.status()).toBe(403);
    expect(
      (
        await request.post("/api/consent", { data: { ...good, ip: "1.2.3.4" } })
      ).status(),
    ).toBe(400);
    expect(
      (
        await request.post("/api/consent", {
          data: { ...good, policyVersion: "1999-01-v1" },
        })
      ).status(),
    ).toBe(400);
    expect(
      (
        await request.post("/api/consent", {
          data: "x",
          headers: { "content-type": "text/plain" },
        })
      ).status(),
    ).toBe(415);

    const ok = await request.post("/api/consent", { data: good });
    expect(ok.status()).toBe(201);
    expect(ok.headers()["set-cookie"]).toBeUndefined();
    expect(ok.headers()["cache-control"]).toBe("no-store");
    expect(Object.keys((await ok.json()) as object)).toEqual(["id"]);
    await context.close();
  });
});

test.describe("accessibility and layout", () => {
  for (const scheme of ["dark", "light"] as const) {
    for (const locale of LOCALES) {
      test(`axe finds nothing on the banner: first, customising and reopened (${locale}, ${scheme})`, async ({
        browser,
      }, info) => {
        const { context, page } = await visitor(browser, info);
        await page.emulateMedia({ colorScheme: scheme });
        await open(page, locale, "/contact");
        const scan = async () =>
          (await new AxeBuilder({ page }).withTags(WCAG_TAGS).analyze())
            .violations;

        await expect(banner(page)).toBeVisible();
        expect(await scan()).toEqual([]);

        await action(page, "customize").click();
        await expect(
          banner(page).getByRole("group", {
            name: copy(locale).preferencesTitle,
          }),
        ).toBeVisible();
        expect(await scan()).toEqual([]);

        await action(page, "accept_all").click();
        await expect(banner(page)).toHaveCount(0);
        expect(await scan()).toEqual([]);

        await page.getByRole("button", { name: copy(locale).reopen }).click();
        await expect(banner(page)).toHaveAttribute(
          "data-consent-banner",
          "reopened",
        );
        expect(await scan()).toEqual([]);
        await context.close();
      });
    }
  }

  for (const width of [360, 768, 1280, 1920]) {
    test(`at ${String(width)} px the banner fits: no sideways scroll, every control reachable, fixed to the bottom and not taller than the screen`, async ({
      browser,
    }, info) => {
      const { context, page } = await visitor(browser, info);
      await page.setViewportSize({ width, height: 700 });
      await open(page, "it", "/contact");
      await action(page, "customize").click();

      const box = await banner(page).boundingBox();
      expect(box?.height ?? 0).toBeLessThanOrEqual(700);
      expect((box?.y ?? 0) + (box?.height ?? 0)).toBeGreaterThanOrEqual(699);
      expect(
        await page.evaluate(
          () =>
            document.documentElement.scrollWidth -
            document.documentElement.clientWidth,
        ),
      ).toBeLessThanOrEqual(0);
      for (const name of ["reject_all", "accept_all", "save", "close"]) {
        await action(page, name).scrollIntoViewIfNeeded();
        const target = await action(page, name).boundingBox();
        expect(target?.width ?? 0, name).toBeGreaterThanOrEqual(44);
        expect(target?.height ?? 0, name).toBeGreaterThanOrEqual(44);
      }
      await context.close();
    });
  }

  test("with reduced motion the banner behaves the same and does not shift the page", async ({
    browser,
  }, info) => {
    const { context, page } = await visitor(browser, info);
    await page.emulateMedia({ reducedMotion: "reduce" });
    await open(page, "en", "/contact");
    const before = await page.evaluate(
      () => document.documentElement.scrollHeight,
    );

    await expect(banner(page)).toBeVisible();
    await action(page, "accept_all").click();
    await expect(banner(page)).toHaveCount(0);

    // a fixed banner takes no room: the page is as tall with it as without
    expect(
      await page.evaluate(() => document.documentElement.scrollHeight),
    ).toBeGreaterThanOrEqual(before - 1);
    await context.close();
  });

  test("without JavaScript there is no visible banner, no button that does nothing, and the booking link still works", async ({
    browser,
  }) => {
    const context = await browser.newContext({ javaScriptEnabled: false });
    const page = await context.newPage();
    await page.goto("/en/contact");

    // P4.7: the server puts the banner in the HTML for a visitor who has not
    // chosen, and a <noscript> rule hides it. Hidden means not seen, not in the
    // accessibility tree and not focusable, so it is as good as absent: no
    // panel over the page and no button that cannot work.
    await expect(banner(page)).toBeHidden();
    await expect(banner(page).getByRole("button")).toHaveCount(0);
    expect(await page.locator("iframe").count()).toBe(0);
    await expect(
      page.getByRole("button", { name: en.consent.reopen }),
    ).toBeHidden();
    await expect(
      page.getByRole("link", { name: new RegExp(en.contact.booking.fallback) }),
    ).toBeVisible();
    await context.close();
  });
});
