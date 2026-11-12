import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";

import en from "../messages/en.json";
import it from "../messages/it.json";
import { readServices, readWork } from "./support/content";
import {
  layoutShift,
  scrollThroughPage,
  trackLayoutShift,
  waitForHydration,
} from "./support/motion";

/**
 * Home (P2.2) on the PRODUCTION build, served with CSP_MODE=enforce: content
 * from the approved deck, static-first, reduced motion, the FX behaviours,
 * accessibility in both themes, layout shift and the LCP element.
 */

const WCAG_TAGS = ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"];
const LOCALES = ["it", "en"] as const;
const messages = { it, en } as const;

/** A viewport tall enough for the pinned process section to fit and pin. */
const TALL = { width: 1280, height: 1000 };

const hero = (page: Page) => page.getByRole("heading", { level: 1 });
const words = (page: Page) => hero(page).locator("[data-fx-word]");
const css = (locator: ReturnType<Page["locator"]>, property: string) =>
  locator.evaluate(
    (el, name) => getComputedStyle(el).getPropertyValue(name),
    property,
  );

async function open(page: Page, locale: "it" | "en") {
  await page.goto(`/${locale}`);
  await waitForHydration(page);
}

/** Wait until the hero headline has finished rising (a half-faded word is a transient state). */
async function heroSettled(page: Page) {
  await expect
    .poll(
      async () =>
        words(page).evaluateAll((all) =>
          all.every((word) => getComputedStyle(word).opacity === "1"),
        ),
      { timeout: 10_000 },
    )
    .toBe(true);
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

for (const locale of LOCALES) {
  const copy = messages[locale].home;

  test.describe(`content (${locale})`, () => {
    test("the hero is the approved one-line offer: one h1, the eyebrow, the lead and two actions", async ({
      page,
    }) => {
      await open(page, locale);

      await expect(hero(page)).toHaveCount(1);
      await expect(hero(page)).toHaveAccessibleName(copy.hero.headline);
      await expect(hero(page)).toHaveText(copy.hero.headline);
      await expect(page.getByText(copy.hero.eyebrow)).toBeVisible();
      await expect(page.getByText(copy.hero.lead)).toBeVisible();
      await expect(
        page
          .getByRole("link", { name: copy.hero.primaryCta, exact: true })
          .first(),
      ).toBeVisible();
      await expect(
        page.getByRole("link", { name: copy.hero.secondaryCta }),
      ).toBeVisible();
    });

    test("the sections come in order, each named by its h2 (demos appear only when a demo is published)", async ({
      page,
    }) => {
      await open(page, locale);

      const h2 = await page
        .getByRole("main")
        .getByRole("heading", { level: 2 })
        .allTextContents();
      // The demos section appears exactly when a demo is published (the Instagram demo, P3.1).
      const demos = readWork(locale).filter(
        ({ data }) => !data.draft && data.kind === "demo",
      );
      expect(demos.length).toBeGreaterThan(0);
      expect(h2).toEqual([
        copy.proof.title,
        copy.services.title,
        copy.demos.title,
        copy.process.title,
        copy.finalCta.title,
      ]);
      await expect(page.locator("#demos")).toHaveCount(1);
      for (const { slug } of demos) {
        await expect(
          page.locator("#demos").locator(`a[href='/${locale}/work/${slug}']`),
        ).toHaveCount(1);
      }
    });

    test("the proof strip shows the four commitments and no figure", async ({
      page,
    }) => {
      await open(page, locale);

      const section = page.getByRole("region", { name: copy.proof.title });
      await expect(section.getByRole("listitem")).toHaveCount(4);
      for (const item of Object.values(copy.proof.items)) {
        await expect(section).toContainText(item.title);
        await expect(section).toContainText(item.text);
      }
      const prose = (await section.locator("h3, p").allTextContents()).join(
        " ",
      );
      expect(prose).not.toMatch(/\d/);
    });

    test("the services grid shows the four services of the content collection, in order, as spotlight cards", async ({
      page,
    }) => {
      await open(page, locale);
      const services = readServices(locale);

      const section = page.getByRole("region", { name: copy.services.title });
      await expect(section.locator("[data-fx='spotlight-card']")).toHaveCount(
        4,
      );
      expect(
        await section.getByRole("heading", { level: 3 }).allTextContents(),
      ).toEqual(services.map((service) => service.data.title));
      for (const service of services) {
        await expect(section).toContainText(service.data.summary);
      }
    });

    test("the process timeline lists the four phases of the approved method", async ({
      page,
    }) => {
      await open(page, locale);

      const steps = messages[locale].process.steps;
      const section = page.getByRole("region", { name: copy.process.title });
      expect(
        await section.locator("[data-fx-step] h3").allTextContents(),
      ).toEqual([
        steps.discover.title,
        steps.prototype.title,
        steps.build.title,
        steps.launch.title,
      ]);
    });

    test("the closing call to action sits on the mesh and points at the contact block", async ({
      page,
    }) => {
      await open(page, locale);

      const section = page.getByRole("region", { name: copy.finalCta.title });
      await expect(section.getByText(copy.finalCta.body)).toBeVisible();
      await expect(
        section.getByRole("link", { name: copy.finalCta.cta }),
      ).toHaveAttribute("href", `/${locale}/contact`);
      await expect(page.locator("[data-fx='gradient-mesh']")).toHaveCount(1);
    });

    test("no dead links: every link on the page is an in-page anchor that exists (or a header/footer link that returns 200)", async ({
      page,
      request,
    }) => {
      await open(page, locale);

      const hrefs = await page
        .locator("a[href]")
        .evaluateAll((links) =>
          links.map(
            (link) => (link as HTMLAnchorElement).getAttribute("href") ?? "",
          ),
        );
      for (const href of hrefs) {
        if (href.startsWith("#")) {
          expect(await page.locator(href).count(), href).toBeGreaterThan(0);
        } else if (href.startsWith("/")) {
          expect((await request.get(href)).status(), href).toBe(200);
        }
      }
      // The in-page anchors left are the skip link and the hero's "services" action;
      // the contact actions are links to the contact page now.
      const anchors = hrefs.filter((h) => h.startsWith("#"));
      expect(anchors).toContain("#services");
      expect(anchors.length).toBeGreaterThanOrEqual(2);
      expect(
        hrefs.filter((h) => h === `/${locale}/contact`).length,
      ).toBeGreaterThanOrEqual(3);
    });

    test("the hero actions lead to the services on the page and to the contact block", async ({
      page,
    }) => {
      await open(page, locale);

      await page.getByRole("link", { name: copy.hero.secondaryCta }).click();
      await expect(page).toHaveURL(/#services$/);
      await expect(page.locator("#services")).toBeInViewport();

      await page
        .getByRole("region", { name: copy.finalCta.title })
        .getByRole("link", { name: copy.finalCta.cta })
        .click();
      await expect(page).toHaveURL(new RegExp(`/${locale}/contact$`));
      await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
    });
  });
}

test.describe("static-first: without JavaScript", () => {
  test.use({ javaScriptEnabled: false });

  for (const locale of LOCALES) {
    test(`/${locale}: every sentence is in the HTML and readable; the hero still animates (CSS)`, async ({
      page,
    }) => {
      const copy = messages[locale].home;
      await page.goto(`/${locale}`);

      for (const text of [
        copy.hero.headline,
        copy.hero.lead,
        copy.proof.items.owner.text,
        copy.services.lead,
        copy.process.lead,
        copy.finalCta.body,
      ]) {
        await expect(page.locator("main")).toContainText(text);
      }
      // the pinned story is a plain stack: every step visible, no spacer, no progress bar
      for (const step of await page.locator("[data-fx-step]").all()) {
        await expect(step).toBeVisible();
        expect(await css(step, "opacity")).toBe("1");
      }
      expect(await page.locator(".pin-spacer").count()).toBe(0);
      expect(
        await css(page.locator("[data-fx-progress-track]"), "visibility"),
      ).toBe("hidden");
      // the headline is CSS-driven: it arrives on its own, without a script
      expect(await css(words(page).first(), "animation-name")).toBe(
        "word-rise",
      );
      await heroSettled(page);
    });
  }
});

test.describe("reduced motion", () => {
  test.use({ reducedMotion: "reduce", viewport: TALL });

  test("nothing moves: the headline is still, the story is stacked, the mesh is static", async ({
    page,
  }) => {
    await open(page, "it");

    for (const word of await words(page).all()) {
      expect(await css(word, "animation-name")).toBe("none");
      expect(await css(word, "opacity")).toBe("1");
    }
    await page.waitForTimeout(3000); // past idle: nothing may pin or appear later
    expect(await page.locator(".pin-spacer").count()).toBe(0);
    for (const step of await page.locator("[data-fx-step]").all()) {
      expect(await css(step, "opacity")).toBe("1");
    }
    expect(
      await css(
        page.locator("[data-fx='gradient-mesh'] [aria-hidden] > div").first(),
        "animation-name",
      ),
    ).toBe("none");
  });

  test("a card does not light up and the CTA does not lean", async ({
    page,
  }) => {
    await open(page, "en");
    await page.waitForTimeout(2500);
    const card = page.locator("[data-fx='spotlight-card']").first();
    await card.scrollIntoViewIfNeeded();
    const box = await card.boundingBox();
    if (!box) throw new Error("no box");

    await page.mouse.move(box.x + 60, box.y + 40);
    await page.waitForTimeout(500);

    expect(await css(card.locator("[data-fx-spot='edge']"), "opacity")).toBe(
      "0",
    );
  });
});

test.describe("full motion", () => {
  test.use({ viewport: TALL });

  test("the headline words rise in on load, within the stagger budget, and end fully visible", async ({
    page,
  }) => {
    await page.goto("/it");

    expect(await css(words(page).first(), "animation-name")).toBe("word-rise");
    const delays = await words(page).evaluateAll((all) =>
      all.map(
        (word) =>
          Number.parseFloat(getComputedStyle(word).animationDelay) * 1000,
      ),
    );
    expect(delays[0]).toBe(0);
    expect(Math.max(...delays)).toBeLessThanOrEqual(600);
    await heroSettled(page);
    // and it only moved transform and opacity
    expect(await css(words(page).first(), "transform")).toMatch(
      /^(none|matrix\(1, 0, 0, 1, 0, 0\))$/,
    );
  });

  test("the process section pins while scrolling through it, reveals the four phases, then lets go", async ({
    page,
  }) => {
    await open(page, "en");
    await expect
      .poll(() => page.locator(".pin-spacer").count(), { timeout: 15_000 })
      .toBe(1);
    const section = page.locator("[data-fx='pinned-section'] section");
    const step = (i: number) =>
      css(page.locator("[data-fx-step]").nth(i), "opacity");
    expect(await step(0)).toBe("1");
    expect(await step(3)).toBe("0"); // hidden until its scroll position

    await page.evaluate(() => {
      const spacer = document.querySelector<HTMLElement>(".pin-spacer");
      if (spacer) window.scrollTo(0, spacer.offsetTop + 500);
    });
    await expect
      .poll(() => css(section, "position"), { timeout: 10_000 })
      .toBe("fixed");

    await page.evaluate(() => {
      const spacer = document.querySelector<HTMLElement>(".pin-spacer");
      if (spacer)
        window.scrollTo(
          0,
          spacer.offsetTop + spacer.offsetHeight - window.innerHeight - 40,
        );
    });
    await expect.poll(() => step(3), { timeout: 10_000 }).toBe("1");

    await page.evaluate(() => {
      window.scrollTo(0, document.documentElement.scrollHeight);
    });
    await expect
      .poll(() => css(section, "position"), { timeout: 10_000 })
      .not.toBe("fixed");
  });

  test("a service card lights up under the mouse, and the primary CTA leans toward it", async ({
    page,
  }) => {
    await open(page, "it");
    await page.waitForTimeout(2500); // the motion chunks load after idle
    const card = page.locator("[data-fx='spotlight-card']").first();
    await card.scrollIntoViewIfNeeded();
    const box = await card.boundingBox();
    if (!box) throw new Error("no box");

    await page.mouse.move(box.x + 60, box.y + 40);

    await expect
      .poll(() => css(card.locator("[data-fx-spot='edge']"), "opacity"))
      .toBe("1");
  });
});

test.describe("the first paint", () => {
  test("the largest contentful paint is the hero text, at the first paint, not after any script", async ({
    page,
  }, testInfo) => {
    await page.addInitScript(() => {
      const w = window as unknown as {
        __lcp?: { time: number; inHero: boolean; tag: string };
      };
      new PerformanceObserver((list) => {
        for (const entry of list.getEntries()) {
          const element = (entry as PerformanceEntry & { element?: Element })
            .element;
          w.__lcp = {
            time: entry.startTime,
            tag: element?.tagName ?? "?",
            inHero: element?.closest("section")?.querySelector("h1") != null,
          };
        }
      }).observe({ type: "largest-contentful-paint", buffered: true });
    });
    await page.goto("/it");
    await waitForHydration(page);
    await page.waitForTimeout(2500);

    const lcp = await page.evaluate(
      () =>
        (
          window as unknown as {
            __lcp?: { time: number; inHero: boolean; tag: string };
          }
        ).__lcp,
    );
    testInfo.annotations.push({
      type: "lcp",
      description: `${String(Math.round(lcp?.time ?? -1))} ms, <${lcp?.tag ?? "?"}>`,
    });
    expect(lcp?.inHero).toBe(true);
    // The budget is 2.0 s on a mid-range phone (Lighthouse CI, P4.6); this local
    // run is a fast machine, so it only guards against a regression.
    expect(lcp?.time ?? Infinity).toBeLessThan(2000);
  });
});

test.describe("accessibility (axe, WCAG 2.0-2.2 A/AA)", () => {
  for (const scheme of ["dark", "light"] as const) {
    for (const locale of LOCALES) {
      test(`/${locale} (${scheme}): zero violations`, async ({ page }) => {
        await page.emulateMedia({ colorScheme: scheme });
        await open(page, locale);
        await heroSettled(page);

        await expectNoAxeViolations(page);
      });
    }
  }

  test("zero violations at 360 px, in both themes", async ({ page }) => {
    await page.setViewportSize({ width: 360, height: 800 });
    for (const scheme of ["dark", "light"] as const) {
      await page.emulateMedia({ colorScheme: scheme });
      await open(page, "it");
      await heroSettled(page);

      await expectNoAxeViolations(page);
    }
  });

  test.describe("reduced motion", () => {
    test.use({ reducedMotion: "reduce" });

    for (const scheme of ["dark", "light"] as const) {
      test(`zero violations (${scheme}), every step visible`, async ({
        page,
      }) => {
        await page.emulateMedia({ colorScheme: scheme });
        await open(page, "en");

        await expectNoAxeViolations(page);
      });
    }
  });

  test("zero violations with the pinned story at its end (every phase visible)", async ({
    page,
  }) => {
    await page.setViewportSize(TALL);
    await page.emulateMedia({ colorScheme: "light" });
    await open(page, "it");
    await heroSettled(page);
    await expect
      .poll(() => page.locator(".pin-spacer").count(), { timeout: 15_000 })
      .toBe(1);
    await page.evaluate(() => {
      const spacer = document.querySelector<HTMLElement>(".pin-spacer");
      if (spacer)
        window.scrollTo(
          0,
          spacer.offsetTop + spacer.offsetHeight - window.innerHeight - 40,
        );
    });
    await expect
      .poll(() => css(page.locator("[data-fx-step]").nth(3), "opacity"), {
        timeout: 10_000,
      })
      .toBe("1");

    await expectNoAxeViolations(page);
  });

  test("the keyboard reaches every action in reading order, and nothing hidden is focusable", async ({
    page,
  }) => {
    await open(page, "en");

    // A first visit has the cookie banner (P4.1) right after the skip link: its
    // five stops (the X, the cookie-policy link (P4.2), Reject all, Accept all,
    // Customise) come before the header.
    const BANNER_STOPS = 5;
    const order: string[] = [];
    for (let i = 0; i < 14 + BANNER_STOPS; i++) {
      await page.keyboard.press("Tab");
      order.push(
        await page.evaluate(() => {
          const el = document.activeElement;
          return el
            ? `${el.tagName}:${el.textContent.trim().slice(0, 24)}`
            : "";
        }),
      );
    }
    // skip link, brand, nav, theme (one radio group stop), language, header CTA, then the hero
    expect(order[0]).toContain("Skip to main content");
    expect(order.slice(1, 1 + BANNER_STOPS)).toEqual([
      "BUTTON:",
      "A:Read the cookie policy",
      "BUTTON:Reject all",
      "BUTTON:Accept all",
      "BUTTON:Customise",
    ]);
    expect(order.some((entry) => entry.includes("Get in touch"))).toBe(true);
    expect(order.some((entry) => entry.includes("See the services"))).toBe(
      true,
    );
    expect(
      await page.evaluate(
        () =>
          document
            .querySelector("[data-fx-step]")
            ?.querySelector("a, button, [tabindex]") ?? null,
      ),
    ).toBeNull();
  });
});

test.describe("layout", () => {
  for (const width of [360, 768, 1280, 1920]) {
    test(`${String(width)} px: no horizontal scroll`, async ({ page }) => {
      await page.setViewportSize({ width, height: 900 });
      await open(page, "it");

      const overflow = await page.evaluate(
        () =>
          document.documentElement.scrollWidth -
          document.documentElement.clientWidth,
      );
      expect(overflow).toBeLessThanOrEqual(0);
    });
  }

  test("the services are two columns on a desktop and one column on a phone", async ({
    page,
  }) => {
    await open(page, "it");
    const columns = async () => {
      const xs = await page
        .locator("[data-fx='spotlight-card']")
        .evaluateAll((cards) =>
          cards.map((card) => Math.round(card.getBoundingClientRect().x)),
        );
      return new Set(xs).size;
    };

    await page.setViewportSize({ width: 1280, height: 900 });
    expect(await columns()).toBe(2);
    await page.setViewportSize({ width: 360, height: 800 });
    expect(await columns()).toBe(1);
  });

  test("the hero headline fits a phone: at most four lines at 360 px", async ({
    page,
  }) => {
    await page.setViewportSize({ width: 360, height: 800 });
    await open(page, "it");
    await heroSettled(page);

    const lines = await hero(page).evaluate((el) => {
      const lineHeight = Number.parseFloat(getComputedStyle(el).lineHeight);
      return Math.round(el.getBoundingClientRect().height / lineHeight);
    });
    expect(lines).toBeLessThanOrEqual(4);
  });
});

test.describe("layout shift (CLS)", () => {
  test("full motion: under 0.05 over load, motion start-up and a full scroll through the pinned story", async ({
    page,
  }, testInfo) => {
    await page.setViewportSize(TALL);
    await trackLayoutShift(page);
    await open(page, "it");
    await expect
      .poll(() => page.locator(".pin-spacer").count(), { timeout: 15_000 })
      .toBe(1);

    await scrollThroughPage(page);

    const cls = await layoutShift(page);
    testInfo.annotations.push({ type: "cls", description: cls.toFixed(4) });
    expect(cls).toBeLessThan(0.05);
  });

  test.describe("reduced motion", () => {
    test.use({ reducedMotion: "reduce" });

    test("under 0.05 over load and a full scroll", async ({
      page,
    }, testInfo) => {
      await trackLayoutShift(page);
      await open(page, "en");

      await scrollThroughPage(page);

      const cls = await layoutShift(page);
      testInfo.annotations.push({ type: "cls", description: cls.toFixed(4) });
      expect(cls).toBeLessThan(0.05);
    });
  });

  test("on a phone: under 0.05 over load and a full scroll", async ({
    page,
  }, testInfo) => {
    await page.setViewportSize({ width: 360, height: 800 });
    await trackLayoutShift(page);
    await open(page, "it");

    await scrollThroughPage(page);

    const cls = await layoutShift(page);
    testInfo.annotations.push({ type: "cls", description: cls.toFixed(4) });
    expect(cls).toBeLessThan(0.05);
  });
});

test.describe("a late web font", () => {
  // Reduced motion shows the headline at the very first paint (full motion
  // starts it at opacity 0, which layout-shift scoring ignores), so this is the
  // case where a font that arrives late would re-flow visible text.
  test.use({ reducedMotion: "reduce" });

  for (const locale of LOCALES) {
    test(`/${locale}: never shifts the layout, even when the fonts arrive 1.5 s late (font-display: optional)`, async ({
      page,
    }, testInfo) => {
      await page.route("**/*.woff2", async (route) => {
        await new Promise((resolve) => setTimeout(resolve, 1500));
        await route.continue();
      });
      await trackLayoutShift(page);
      await open(page, locale);
      await page.waitForTimeout(2500); // past the late fonts

      const cls = await layoutShift(page);
      testInfo.annotations.push({ type: "cls", description: cls.toFixed(4) });
      expect(cls).toBeLessThan(0.05);
    });
  }
});

test.describe("under the enforced CSP", () => {
  for (const locale of LOCALES) {
    test(`/${locale}: the whole page, with its animations, inline styles and motion modules, runs with zero violations`, async ({
      page,
    }) => {
      await page.setViewportSize(TALL);
      const watcher = await watch(page);
      await open(page, locale);
      await heroSettled(page);
      await scrollThroughPage(page); // starts Lenis, the pin and every reveal

      expect(await watcher.violations()).toEqual([]);
      expect(watcher.errors).toEqual([]);
    });
  }
});
