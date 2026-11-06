import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";

import { business } from "../src/lib/business";
import {
  layoutShift,
  trackLayoutShift,
  waitForHydration,
  settleAnimations,
} from "./support/motion";

/**
 * The layout shell on the PRODUCTION build (the server runs CSP_MODE=enforce,
 * so the theme pre-paint script and every shell script also have to satisfy
 * the strict policy): skip link, header, footer, theme switch, providers.
 */

const WCAG_TAGS = ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"];
const PAGES = [
  { path: "/it", locale: "it" },
  { path: "/en", locale: "en" },
  { path: "/it/non-esiste", locale: "it" },
  { path: "/en/does-not-exist", locale: "en" },
] as const;

const COPY = {
  it: {
    skip: "Vai al contenuto principale",
    nav: "Principale",
    services: "Servizi",
    cta: "Parliamone",
    theme: "Tema",
    language: "Lingua",
    pending: "Non ancora disponibile",
    address: "Corso Regina Margherita, Torino (TO), Italia",
    system: /Automatico/,
    dark: "Scuro",
    light: "Chiaro",
  },
  en: {
    skip: "Skip to main content",
    nav: "Main",
    services: "Services",
    cta: "Get in touch",
    theme: "Theme",
    language: "Language",
    pending: "Not yet available",
    address: "Corso Regina Margherita, Torino (TO), Italy",
    system: /Automatic/,
    dark: "Dark",
    light: "Light",
  },
} as const;

async function open(page: Page, path: string) {
  await page.goto(path);
  await waitForHydration(page);
}

async function expectNoAxeViolations(page: Page) {
  await settleAnimations(page);
  const results = await new AxeBuilder({ page }).withTags(WCAG_TAGS).analyze();
  expect(results.violations).toEqual([]);
}

/** Collect CSP violations and console errors for the page's life. */
async function watch(page: Page) {
  const errors: string[] = [];
  page.on("console", (message) => {
    if (message.type() === "error" && !message.text().includes("status of 404"))
      errors.push(message.text());
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

test.describe("landmarks", () => {
  for (const { path, locale } of PAGES) {
    test(`${path}: one banner, one main, one contentinfo, one h1, named navigations`, async ({
      page,
    }) => {
      await open(page, path);
      const copy = COPY[locale];

      await expect(page.getByRole("banner")).toHaveCount(1);
      await expect(page.getByRole("main")).toHaveCount(1);
      await expect(page.getByRole("contentinfo")).toHaveCount(1);
      await expect(page.getByRole("heading", { level: 1 })).toHaveCount(1);
      await expect(
        page.getByRole("banner").getByRole("navigation", { name: copy.nav }),
      ).toBeVisible();
      await expect(
        page
          .getByRole("banner")
          .getByRole("navigation", { name: copy.language }),
      ).toBeVisible();
      await expect(page.locator("html")).toHaveAttribute("lang", locale);
    });
  }

  test("the header, the footer and the main landmark are in this order in the document", async ({
    page,
  }) => {
    await open(page, "/it");

    const order = await page.evaluate(() =>
      ["header", "main", "footer"].map(
        (selector) =>
          document
            .querySelector(selector)
            ?.compareDocumentPosition(
              document.body.lastElementChild ?? document.body,
            ) ?? 0,
      ),
    );
    const tags = await page.evaluate(() =>
      Array.from(document.body.querySelectorAll("header, main, footer")).map(
        (element) => element.tagName,
      ),
    );
    expect(order.length).toBe(3);
    expect(tags).toEqual(["HEADER", "MAIN", "FOOTER"]);
  });
});

test.describe("skip link", () => {
  for (const locale of ["it", "en"] as const) {
    test(`/${locale}: it is the first tab stop, appears on focus, and moves focus to the main content`, async ({
      page,
    }) => {
      await open(page, `/${locale}`);
      const link = page.getByRole("link", { name: COPY[locale].skip });

      // Not visible until focused: clipped to a 1 px box.
      const hidden = await link.boundingBox();
      expect(hidden?.width).toBeLessThanOrEqual(1);

      await page.keyboard.press("Tab");
      await expect(link).toBeFocused();
      const box = await link.boundingBox();
      expect(box?.width).toBeGreaterThan(100);
      expect(box?.height).toBeGreaterThanOrEqual(44);
      expect(box?.y).toBeGreaterThanOrEqual(0);
      expect(
        await link.evaluate((el) => getComputedStyle(el).outlineStyle),
      ).toBe("solid");

      await page.keyboard.press("Enter");

      await expect(page).toHaveURL(/#main-content$/);
      await expect
        .poll(() => page.evaluate(() => document.activeElement?.id))
        .toBe("main-content");
    });
  }

  test("the next Tab after skipping lands INSIDE the main content, not back in the header", async ({
    page,
  }) => {
    await open(page, "/it/non-esiste");
    await page.keyboard.press("Tab");
    await page.keyboard.press("Enter");

    await page.keyboard.press("Tab");

    expect(
      await page.evaluate(
        () =>
          document.querySelector("main")?.contains(document.activeElement) ??
          false,
      ),
    ).toBe(true);
  });

  test("works without JavaScript (it is a plain in-page link)", async ({
    browser,
  }) => {
    const context = await browser.newContext({ javaScriptEnabled: false });
    const page = await context.newPage();
    await page.goto("/it");

    const href = await page
      .getByRole("link", { name: COPY.it.skip })
      .getAttribute("href");
    expect(href).toBe("#main-content");
    await expect(page.locator("main#main-content")).toHaveCount(1);
    await context.close();
  });
});

test.describe("header", () => {
  for (const locale of ["it", "en"] as const) {
    test(`/${locale}: wordmark, current page in the nav, call to action`, async ({
      page,
    }) => {
      await open(page, `/${locale}`);
      const header = page.getByRole("banner");

      await expect(
        header.getByRole("link", { name: business.brand.name }),
      ).toHaveAttribute("href", `/${locale}`);
      const nav = header.getByRole("navigation", { name: COPY[locale].nav });
      // Home, Services (P2.3) and Work (P2.4): only pages that exist are listed.
      await expect(nav.getByRole("link")).toHaveCount(3);
      await expect(nav.getByRole("link", { name: "Home" })).toHaveAttribute(
        "aria-current",
        "page",
      );
      await expect(
        nav.getByRole("link", { name: COPY[locale].services }),
      ).not.toHaveAttribute("aria-current", "page");
      await expect(
        header.getByRole("link", { name: COPY[locale].cta }),
      ).toHaveAttribute("href", `/${locale}/contact`);
    });
  }

  test("no link in the header points at a page that does not exist (it follows every link once)", async ({
    page,
    request,
  }) => {
    await open(page, "/it");
    const hrefs = await page
      .getByRole("banner")
      .getByRole("link")
      .evaluateAll((links) =>
        links.map((link) => (link as HTMLAnchorElement).href),
      );

    for (const href of hrefs.filter((h) => !h.includes("#"))) {
      expect((await request.get(href)).status(), href).toBe(200);
    }
  });

  test("the call to action leads to the contact page", async ({ page }) => {
    await open(page, "/it");

    await page
      .getByRole("banner")
      .getByRole("link", { name: COPY.it.cta })
      .click();

    await expect(page).toHaveURL(/\/it\/contact$/);
    await expect(page.getByRole("heading", { level: 1 })).toHaveText(
      "Parliamone",
    );
  });

  test("the footer keeps the contact block with the identity details", async ({
    page,
  }) => {
    await open(page, "/it");

    await expect(page.locator("footer #contact")).toContainText("Contatti");
  });

  test("it is not sticky: it scrolls away, so it can never cover a focused element", async ({
    page,
  }) => {
    await open(page, "/it");
    await page.setViewportSize({ width: 1280, height: 400 });
    await page.evaluate(() => {
      document.body.style.minHeight = "3000px";
    });

    await page.evaluate(() => {
      window.scrollTo(0, 800);
    });

    expect(
      await page
        .getByRole("banner")
        .boundingBox()
        .then((b) => b?.y ?? 0),
    ).toBeLessThan(0);
  });
});

test.describe("footer", () => {
  for (const { path, locale } of PAGES) {
    test(`${path}: identity and statutory details are on every page, with placeholders for what is not known yet`, async ({
      page,
    }) => {
      await open(page, path);
      const footer = page.getByRole("contentinfo");
      const copy = COPY[locale];

      await expect(footer).toContainText(business.owner.name);
      await expect(footer).toContainText(business.brand.name);
      await expect(footer).toContainText(copy.address);
      await expect(footer.locator("address")).toContainText("Torino (TO)");
      // Partita IVA, REA and PEC: three neutral placeholders, nothing invented.
      await expect(footer.locator("[data-status='pending']")).toHaveCount(3);
      await expect(
        footer.locator("[data-status='pending']").first(),
      ).toHaveText(copy.pending);
      await expect(footer).toContainText(
        `© ${String(new Date().getFullYear())}`,
      );
    });
  }

  test("each identifier sits under its own label", async ({ page }) => {
    await open(page, "/en");

    const terms = await page
      .getByRole("contentinfo")
      .locator("dt")
      .allTextContents();

    expect(terms).toEqual([
      "Owner",
      "VAT number (Partita IVA)",
      "REA number",
      "PEC (certified email)",
    ]);
  });

  test("no page mentions a business name other than the configured brand token", async ({
    page,
  }) => {
    for (const { path } of PAGES) {
      await page.goto(path);
      const text = (await page.locator("body").innerText()).toLowerCase();
      expect(text, path).not.toContain(["inam", "biente"].join(""));
      expect(text, path).not.toContain("srl");
    }
  });

  test("the footer sits at the bottom even when the page is short", async ({
    page,
  }) => {
    await page.setViewportSize({ width: 1280, height: 1200 });
    // A short page: the 404 (Home is long now).
    await open(page, "/it/non-esiste");

    const bottom = await page
      .getByRole("contentinfo")
      .evaluate((el) => el.getBoundingClientRect().bottom);

    expect(Math.round(bottom)).toBe(1200);
  });
});

test.describe("theme switch", () => {
  const pick = (
    page: Page,
    locale: "it" | "en",
    which: "dark" | "light" | "system",
  ) =>
    page.getByRole("radio", {
      name: which === "system" ? COPY[locale].system : COPY[locale][which],
    });
  /** Click the option's 44 px label, as a visitor does (the radio itself is visually hidden). */
  const choose = (
    page: Page,
    locale: "it" | "en",
    which: "dark" | "light" | "system",
  ) => page.locator("label", { has: pick(page, locale, which) }).click();
  const rootClass = (page: Page) =>
    page.evaluate(() => document.documentElement.className);
  const stored = (page: Page) =>
    page.evaluate(() => window.localStorage.getItem("theme"));

  test("is a labelled group of three radios, automatic selected by default, enabled once hydrated", async ({
    page,
  }) => {
    await open(page, "/it");

    await expect(
      page.getByRole("group", { name: COPY.it.theme }),
    ).toBeVisible();
    await expect(page.getByRole("radio")).toHaveCount(3);
    await expect(pick(page, "it", "system")).toBeChecked();
    for (const radio of await page.getByRole("radio").all()) {
      await expect(radio).toBeEnabled();
    }
    expect(await stored(page)).toBeNull(); // nothing is stored until the visitor chooses
  });

  test("choosing dark and light applies the class, the colour scheme and stores ONE key", async ({
    page,
  }) => {
    await open(page, "/en");

    await choose(page, "en", "dark");
    expect(await rootClass(page)).toContain("dark");
    expect(
      await page.evaluate(
        () => getComputedStyle(document.documentElement).colorScheme,
      ),
    ).toBe("dark");
    expect(await stored(page)).toBe("dark");

    await choose(page, "en", "light");
    expect(await rootClass(page)).toContain("light");
    expect(await rootClass(page)).not.toContain("dark");
    expect(
      await page.evaluate(
        () => getComputedStyle(document.documentElement).colorScheme,
      ),
    ).toBe("light");
    expect(await page.evaluate(() => window.localStorage.length)).toBe(1);
  });

  test("the page really changes colour", async ({ page }) => {
    await open(page, "/en");
    const background = () =>
      page.evaluate(() => getComputedStyle(document.body).backgroundColor);

    await choose(page, "en", "dark");
    const dark = await background();
    await choose(page, "en", "light");
    const light = await background();

    expect(dark).not.toBe(light);
  });

  test("automatic follows the system and forgets the choice", async ({
    page,
  }) => {
    await page.emulateMedia({ colorScheme: "light" });
    await open(page, "/en");
    await choose(page, "en", "dark");

    await choose(page, "en", "system");

    expect(await stored(page)).toBeNull();
    expect(await rootClass(page)).not.toMatch(/dark|light/);
    expect(
      await page.evaluate(
        () => getComputedStyle(document.body).backgroundColor,
      ),
    ).toBe("rgb(246, 244, 238)"); // the light --color-bg, from the system preference
  });

  test("a stored choice is applied BEFORE first paint (no flash of the wrong theme)", async ({
    page,
  }) => {
    await page.emulateMedia({ colorScheme: "light" }); // system says light, the choice says dark
    await page.addInitScript(() => {
      window.localStorage.setItem("theme", "dark");
      const w = window as unknown as { __atDcl: string };
      document.addEventListener("DOMContentLoaded", () => {
        w.__atDcl = document.documentElement.className;
      });
    });

    await page.goto("/it");

    // Recorded at DOMContentLoaded: scripts have not hydrated React by then.
    expect(
      await page.evaluate(
        () => (window as unknown as { __atDcl: string }).__atDcl,
      ),
    ).toContain("dark");
    await waitForHydration(page);
    await expect(pick(page, "it", "dark")).toBeChecked();
  });

  test("the choice survives a reload and a client-side navigation (language switch)", async ({
    page,
  }) => {
    await open(page, "/it");
    await choose(page, "it", "light");

    await page.reload();
    await waitForHydration(page);
    expect(await rootClass(page)).toContain("light");
    await expect(pick(page, "it", "light")).toBeChecked();

    await page
      .getByRole("banner")
      .getByRole("link", { name: "English" })
      .click();
    await expect(page).toHaveURL(/\/en$/);
    expect(await rootClass(page)).toContain("light");
    await expect(pick(page, "en", "light")).toBeChecked();
  });

  test("works with the keyboard: Tab to the group, arrow keys change the theme", async ({
    page,
  }) => {
    await open(page, "/en");
    await pick(page, "en", "system").focus();

    await page.keyboard.press("ArrowRight");
    await expect(pick(page, "en", "dark")).toBeChecked();
    expect(await rootClass(page)).toContain("dark");

    await page.keyboard.press("ArrowRight");
    await expect(pick(page, "en", "light")).toBeChecked();
    expect(await rootClass(page)).toContain("light");
  });

  test("shows a visible 2 px focus ring on the focused option", async ({
    page,
  }) => {
    await open(page, "/en");
    // The last link of the main navigation is followed by the theme switch.
    await page
      .getByRole("navigation", { name: "Main" })
      .getByRole("link")
      .last()
      .focus();

    await page.keyboard.press("Tab");

    const checked = page.getByRole("radio", { checked: true });
    await expect(checked).toBeFocused();
    expect(
      await checked.evaluate((el) => {
        const style = getComputedStyle(el.closest("label") as HTMLElement);
        return [style.outlineStyle, style.outlineWidth];
      }),
    ).toEqual(["solid", "2px"]);
  });

  test("is disabled without JavaScript (a choice could not be applied)", async ({
    browser,
  }) => {
    const context = await browser.newContext({ javaScriptEnabled: false });
    const page = await context.newPage();
    await page.goto("/it");

    for (const radio of await page.getByRole("radio").all()) {
      await expect(radio).toBeDisabled();
    }
    await context.close();
  });

  test("the pre-paint script and the switch run under the enforced CSP: zero violations", async ({
    page,
  }) => {
    const watcher = await watch(page);
    await page.addInitScript(() => {
      window.localStorage.setItem("theme", "light");
    });
    await open(page, "/it");
    await choose(page, "it", "dark");

    expect(await watcher.violations()).toEqual([]);
    expect(watcher.errors).toEqual([]);
  });
});

test.describe("providers", () => {
  test("the toast region is mounted once, in the layout, with a translated label", async ({
    page,
  }) => {
    await open(page, "/it");

    const region = page.getByRole("region", { name: /Notifiche/ });
    await expect(region).toHaveCount(1);
    await open(page, "/en");
    await expect(
      page.getByRole("region", { name: /Notifications/ }),
    ).toHaveCount(1);
  });
});

test.describe("responsive", () => {
  for (const width of [360, 768, 1280, 1920]) {
    test(`${String(width)} px: no horizontal scroll, every header control is at least 44 px`, async ({
      page,
    }) => {
      await page.setViewportSize({ width, height: 800 });
      await open(page, "/it");

      const overflow = await page.evaluate(
        () =>
          document.documentElement.scrollWidth -
          document.documentElement.clientWidth,
      );
      expect(overflow).toBeLessThanOrEqual(0);

      const small: string[] = [];
      for (const control of await page
        .getByRole("banner")
        .locator("a, input[type='radio']")
        .all()) {
        const target =
          (await control.evaluate((el) => el.tagName)) === "INPUT"
            ? control.locator("xpath=ancestor::label")
            : control;
        const box = await target.boundingBox();
        if (box && (box.height < 44 || box.width < 44))
          small.push(
            `${(await control.textContent())?.trim() ?? "?"}: ${String(box.width)}x${String(box.height)}`,
          );
      }
      expect(small).toEqual([]);
    });
  }

  test("360 px: the header is at most four rows tall, and the footer stays readable", async ({
    page,
  }) => {
    await page.setViewportSize({ width: 360, height: 800 });
    await open(page, "/it");

    const header = await page.getByRole("banner").boundingBox();
    // Four 44 px rows with their gaps. With three links the navigation (234 px) no
    // longer leaves room for the theme switch (134 px) on its row at 360 px, so the
    // header grew from three rows (about 160 px) to four (207 px). A fifth page
    // (Process, About) must come with a menu instead of a fifth row: this bound
    // is what makes that decision unavoidable (docs/DESIGN.md §9).
    expect(header?.height).toBeLessThan(215);
    for (const term of await page
      .getByRole("contentinfo")
      .locator("dd")
      .all()) {
      const box = await term.boundingBox();
      expect((box?.x ?? 0) + (box?.width ?? 0)).toBeLessThanOrEqual(360);
    }
  });
});

test.describe("accessibility (axe, WCAG 2.0-2.2 A/AA)", () => {
  for (const scheme of ["dark", "light"] as const) {
    for (const { path } of PAGES) {
      test(`${path} (${scheme}): no violations`, async ({ page }) => {
        await page.emulateMedia({ colorScheme: scheme });
        await open(page, path);

        await expectNoAxeViolations(page);
      });
    }
  }

  test("a forced theme (stored choice) is clean too, at 360 px", async ({
    page,
  }) => {
    await page.setViewportSize({ width: 360, height: 800 });
    for (const theme of ["dark", "light"]) {
      await page.addInitScript((value) => {
        window.localStorage.setItem("theme", value);
      }, theme);
      await open(page, "/en");

      await expectNoAxeViolations(page);
    }
  });

  test("with the skip link focused and visible", async ({ page }) => {
    await open(page, "/it");
    await page.keyboard.press("Tab");

    await expectNoAxeViolations(page);
  });
});

test.describe("layout shift", () => {
  test("the shell, a theme change and a language switch add no layout shift (CLS < 0.05)", async ({
    page,
  }, testInfo) => {
    await trackLayoutShift(page);
    await open(page, "/it");

    await page
      .locator("label", {
        has: page.getByRole("radio", { name: COPY.it.dark }),
      })
      .click();
    await page
      .locator("label", {
        has: page.getByRole("radio", { name: COPY.it.light }),
      })
      .click();
    await page
      .getByRole("banner")
      .getByRole("link", { name: "English" })
      .click();
    await expect(page).toHaveURL(/\/en$/);
    await page.waitForTimeout(500);

    const cls = await layoutShift(page);
    testInfo.annotations.push({ type: "cls", description: cls.toFixed(4) });
    expect(cls).toBeLessThan(0.05);
  });
});
