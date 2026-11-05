import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";

import {
  layoutShift,
  scrollThroughPage,
  trackLayoutShift,
  waitForHydration,
} from "./support/motion";

/**
 * The motion system against `next dev` (the test page is dev-only).
 * The page has 6 scroll reveals + 1 pinned, scrubbed scene = 7 ScrollTriggers
 * and 1 pin wrapper; every count below is exact on purpose, so a duplicate (a
 * leak) fails as loudly as a missing one.
 */

test.setTimeout(120_000);

const MOTION = "/it/_dev/motion";
const GALLERY = "/it/_dev/ui";
const TRIGGERS = 7;
const WCAG_TAGS = ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"];

async function openMotion(page: Page) {
  await page.goto(MOTION);
  await expect(
    page.getByRole("heading", { level: 1, name: "Motion system" }),
  ).toBeVisible();
  await waitForHydration(page);
  await page.waitForFunction(() => window.__motionDebug !== undefined);
}

const state = (page: Page) =>
  page.evaluate(() => ({
    triggers: window.__motionDebug?.triggers() ?? -1,
    pins: window.__motionDebug?.pinSpacers() ?? -1,
    lenis: window.__motionDebug?.lenis() ?? false,
  }));

const scrollY = (page: Page) => page.evaluate(() => window.scrollY);

/** Lenis starts when the browser is idle (up to ~2s), not at hydration. */
async function waitForLenis(page: Page) {
  await expect
    .poll(async () => (await state(page)).lenis, { timeout: 10_000 })
    .toBe(true);
}

function collectErrors(page: Page): string[] {
  const errors: string[] = [];
  page.on("console", (message) => {
    if (message.type() === "error") errors.push(message.text());
  });
  page.on("pageerror", (error) => errors.push(String(error)));
  return errors;
}

test.describe("motion system: full motion", () => {
  test("starts Lenis once idle and creates exactly the expected ScrollTriggers", async ({
    page,
  }) => {
    const errors = collectErrors(page);
    await openMotion(page);

    await waitForLenis(page);
    // Exact counts: React StrictMode double-runs every effect in dev, so a
    // missing cleanup would show up here as 14, not 7.
    expect(await state(page)).toEqual({
      triggers: TRIGGERS,
      pins: 1,
      lenis: true,
    });
    expect(errors).toEqual([]);
  });

  test("scroll reveals start hidden below the fold and appear when reached", async ({
    page,
  }) => {
    await openMotion(page);
    await waitForLenis(page);
    const last = page.locator(".motion-reveal").last();
    const opacity = () => last.evaluate((el) => getComputedStyle(el).opacity);

    expect(await opacity()).toBe("0"); // animates FROM an offset, hidden until reached

    await last.scrollIntoViewIfNeeded();
    await expect.poll(opacity, { timeout: 10_000 }).toBe("1");
  });

  test("the pinned scene really pins while scrolling through it", async ({
    page,
  }) => {
    await openMotion(page);
    await waitForLenis(page);
    const story = page.locator(".motion-story");

    await page.evaluate(() => {
      const top = (document.querySelector(".pin-spacer") as HTMLElement)
        .offsetTop;
      window.scrollTo(0, top + 300);
    });

    await expect
      .poll(() => story.evaluate((el) => getComputedStyle(el).position), {
        timeout: 10_000,
      })
      .toBe("fixed");
  });

  test("keyboard scrolling is not hijacked: End reaches the bottom", async ({
    page,
  }) => {
    await openMotion(page);
    await waitForLenis(page);

    await page.keyboard.press("End");

    await expect
      .poll(
        () =>
          page.evaluate(
            () =>
              window.scrollY + window.innerHeight >=
              document.documentElement.scrollHeight - 2,
          ),
        { timeout: 10_000 },
      )
      .toBe(true);
  });

  test("wheel scrolling moves the page (smoothly)", async ({ page }) => {
    await openMotion(page);
    await waitForLenis(page);
    await page.mouse.move(640, 400);

    await page.mouse.wheel(0, 600);

    await expect
      .poll(() => scrollY(page), { timeout: 10_000 })
      .toBeGreaterThan(300);
  });

  test("has no axe violations", async ({ page }) => {
    await openMotion(page);
    await waitForLenis(page);
    await page.waitForTimeout(1500); // let the intro finish
    const results = await new AxeBuilder({ page })
      .withTags(WCAG_TAGS)
      .exclude("nextjs-portal")
      .analyze();

    expect(results.violations).toEqual([]);
  });
});

test.describe("motion system: reduced motion", () => {
  test.use({ reducedMotion: "reduce" });

  test("Lenis never starts and no ScrollTrigger, pin or smooth scroll exists", async ({
    page,
  }) => {
    await openMotion(page);

    await page.waitForTimeout(2500); // longer than the idle timeout that would start Lenis
    expect(await state(page)).toEqual({ triggers: 0, pins: 0, lenis: false });
  });

  test("scroll-revealed content is simply there: final state, no offset", async ({
    page,
  }) => {
    await openMotion(page);
    const last = page.locator(".motion-reveal").last();

    const style = await last.evaluate((el) => {
      const s = getComputedStyle(el);
      return { opacity: s.opacity, transform: s.transform };
    });

    expect(style).toEqual({ opacity: "1", transform: "none" });
  });

  test("the intro is only a short fade: it ends fully visible and never moves", async ({
    page,
  }) => {
    await openMotion(page);
    const intro = page.locator(".motion-intro").first();

    await expect
      .poll(() => intro.evaluate((el) => getComputedStyle(el).opacity), {
        timeout: 5000,
      })
      .toBe("1");
    expect(await intro.evaluate((el) => getComputedStyle(el).transform)).toBe(
      "none",
    );
  });

  test("the pinned scene is not pinned and all of its steps are visible", async ({
    page,
  }) => {
    await openMotion(page);

    expect(
      await page
        .locator(".motion-story")
        .evaluate((el) => getComputedStyle(el).position),
    ).not.toBe("fixed");
    for (const step of [1, 2, 3]) {
      await expect(
        page.locator(`.motion-story-step-${String(step)}`),
      ).toHaveCSS("opacity", "1");
    }
  });

  test("the page scrolls natively and reaches the bottom", async ({ page }) => {
    await openMotion(page);

    await scrollThroughPage(page);

    expect(
      await page.evaluate(
        () =>
          window.scrollY + window.innerHeight >=
          document.documentElement.scrollHeight - 2,
      ),
    ).toBe(true);
  });

  test("has no axe violations", async ({ page }) => {
    await openMotion(page);
    await page.waitForTimeout(500);
    const results = await new AxeBuilder({ page })
      .withTags(WCAG_TAGS)
      .exclude("nextjs-portal")
      .analyze();

    expect(results.violations).toEqual([]);
  });
});

test.describe("motion system: changing the preference while the page is open", () => {
  test("switches cleanly in both directions, repeatedly, with stable counts (no leak)", async ({
    page,
  }) => {
    await openMotion(page);
    await waitForLenis(page);
    expect(await state(page)).toEqual({
      triggers: TRIGGERS,
      pins: 1,
      lenis: true,
    });

    for (let round = 1; round <= 3; round++) {
      await page.emulateMedia({ reducedMotion: "reduce" });
      await expect
        .poll(() => state(page), { message: `round ${String(round)}: reduced` })
        .toEqual({ triggers: 0, pins: 0, lenis: false });
      // content is in its final state, nothing left hidden
      await expect(page.locator(".motion-reveal").last()).toHaveCSS(
        "opacity",
        "1",
      );

      await page.emulateMedia({ reducedMotion: "no-preference" });
      await expect
        .poll(() => state(page), {
          timeout: 10_000,
          message: `round ${String(round)}: back to full motion`,
        })
        .toEqual({ triggers: TRIGGERS, pins: 1, lenis: true });
    }
  });
});

test.describe("motion system: route navigation", () => {
  test("every ScrollTrigger and pin is removed when leaving the page and rebuilt exactly when returning", async ({
    page,
  }) => {
    const errors = collectErrors(page);
    await openMotion(page);
    await waitForLenis(page);
    expect((await state(page)).triggers).toBe(TRIGGERS);

    for (let round = 1; round <= 3; round++) {
      await page.getByRole("link", { name: "UI gallery" }).click();
      await expect(page).toHaveURL(/\/it\/_dev\/ui$/);
      await expect(
        page.getByRole("heading", { level: 1, name: "UI primitives" }),
      ).toBeVisible();
      await expect
        .poll(() => state(page), {
          message: `round ${String(round)}: on the gallery`,
        })
        .toMatchObject({ triggers: 0, pins: 0 });

      await page.getByRole("link", { name: "Motion test page" }).click();
      await expect(page).toHaveURL(/\/it\/_dev\/motion$/);
      await expect
        .poll(() => state(page), {
          message: `round ${String(round)}: back on motion`,
        })
        .toMatchObject({ triggers: TRIGGERS, pins: 1 });
    }

    // Lenis belongs to the layout, so it survives navigation as one instance.
    expect((await state(page)).lenis).toBe(true);
    expect(errors).toEqual([]);
  });

  test("browser Back and Forward behave the same way", async ({ page }) => {
    await openMotion(page);
    await waitForLenis(page);

    await page.getByRole("link", { name: "UI gallery" }).click();
    await expect(page).toHaveURL(/\/it\/_dev\/ui$/);
    await expect
      .poll(() => state(page))
      .toMatchObject({ triggers: 0, pins: 0 });

    await page.goBack();
    await expect(page).toHaveURL(/\/it\/_dev\/motion$/);
    await expect
      .poll(() => state(page))
      .toMatchObject({ triggers: TRIGGERS, pins: 1 });

    await page.goForward();
    await expect(page).toHaveURL(/\/it\/_dev\/ui$/);
    await expect
      .poll(() => state(page))
      .toMatchObject({ triggers: 0, pins: 0 });
  });

  test("a new page starts at the top even when Lenis was scrolled far down", async ({
    page,
  }) => {
    await openMotion(page);
    await waitForLenis(page);
    await page.evaluate(() => {
      window.scrollTo(0, 1500);
    });
    await expect.poll(() => scrollY(page)).toBeGreaterThan(1000);

    // The link sits in the header, far above the viewport now. A DOM click
    // navigates from exactly this scrolled-down state, like a footer link would.
    await page.getByRole("link", { name: "UI gallery" }).evaluate((link) => {
      (link as HTMLElement).click();
    });
    await expect(page).toHaveURL(/\/it\/_dev\/ui$/);

    await expect.poll(() => scrollY(page)).toBe(0);
  });
});

test.describe("motion system: layout shift (CLS)", () => {
  test("stays below 0.05 over load, Lenis start-up and a full scroll", async ({
    page,
  }, testInfo) => {
    await trackLayoutShift(page);
    await openMotion(page);
    await waitForLenis(page);
    await scrollThroughPage(page);

    const cls = await layoutShift(page);
    testInfo.annotations.push({
      type: "CLS (full motion)",
      description: cls.toFixed(4),
    });
    expect(cls).toBeLessThan(0.05);
  });
});

test.describe("motion system: the CLS tracker itself", () => {
  test("detects a real layout shift (negative control: a reading of 0 means something)", async ({
    page,
  }) => {
    await trackLayoutShift(page);
    await openMotion(page);
    expect(await layoutShift(page)).toBeLessThan(0.05); // clean before we interfere

    // Push all visible content down by 300px after load: a textbook shift.
    await page.evaluate(() => {
      const spacer = document.createElement("div");
      spacer.style.height = "300px";
      document.querySelector("main")?.before(spacer);
    });

    await expect.poll(() => layoutShift(page)).toBeGreaterThan(0.05);
  });
});

test.describe("motion system: layout shift (CLS), reduced motion", () => {
  test.use({ reducedMotion: "reduce" });

  test("stays below 0.05 over load and a full scroll", async ({
    page,
  }, testInfo) => {
    await trackLayoutShift(page);
    await openMotion(page);
    await scrollThroughPage(page);

    const cls = await layoutShift(page);
    testInfo.annotations.push({
      type: "CLS (reduced motion)",
      description: cls.toFixed(4),
    });
    expect(cls).toBeLessThan(0.05);
  });
});

test.describe("motion system: Lenis and Radix scroll lock", () => {
  test("a dialog stops the page behind it from scrolling, and scrolling resumes after it closes", async ({
    page,
  }) => {
    await page.goto(GALLERY);
    await expect(
      page.getByRole("heading", { level: 1, name: "UI primitives" }),
    ).toBeVisible();
    await waitForHydration(page);
    await page.waitForFunction(() => window.__motionDebug !== undefined);
    await waitForLenis(page);

    await page
      .getByRole("button", { name: "Open dialog" })
      .scrollIntoViewIfNeeded();
    await page.getByRole("button", { name: "Open dialog" }).click();
    await expect(
      page.getByRole("dialog", { name: "Request a call" }),
    ).toBeVisible();
    const before = await scrollY(page);

    await page.mouse.move(640, 100); // over the overlay, outside the dialog
    await page.mouse.wheel(0, 900);
    await page.waitForTimeout(800);
    expect(
      await scrollY(page),
      "background scrolled while the dialog was open",
    ).toBe(before);

    await page.keyboard.press("Escape");
    await expect(page.getByRole("dialog")).toBeHidden();
    await page.mouse.wheel(0, 900);
    await expect
      .poll(() => scrollY(page), { timeout: 10_000 })
      .toBeGreaterThan(before);
  });
});
