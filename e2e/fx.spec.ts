import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Locator, type Page } from "@playwright/test";

import {
  layoutShift,
  scrollThroughPage,
  trackLayoutShift,
  waitForHydration,
} from "./support/motion";

/**
 * The FX library against `next dev` (its showcase is dev-only). Page contents:
 * two text reveals and one pinned scene = 3 ScrollTriggers (+1 pin spacer), a
 * marquee and a gradient mesh (CSS only), magnetic buttons and spotlight cards
 * (pointer listeners). Counts are exact on purpose, like in motion.spec.ts.
 */

test.setTimeout(120_000);

const FX = "/it/_dev/fx";
const GALLERY = "/it/_dev/ui";
const TRIGGERS = 3;
const WCAG_TAGS = ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"];
const PAUSE = "Pause the ticker";

async function openFx(page: Page) {
  await page.goto(FX);
  await expect(
    page.getByRole("heading", { level: 1, name: "FX library" }),
  ).toBeVisible();
  await waitForHydration(page);
  await page.waitForFunction(() => window.__motionDebug !== undefined);
}

const state = (page: Page) =>
  page.evaluate(() => ({
    triggers: window.__motionDebug?.triggers() ?? -1,
    pins: window.__motionDebug?.pinSpacers() ?? -1,
  }));

/** The motion chunks load when the browser is idle (up to ~2 s after hydration). */
async function waitForFx(page: Page) {
  await expect
    .poll(async () => (await state(page)).triggers, { timeout: 20_000 })
    .toBe(TRIGGERS);
}

function collectErrors(page: Page): string[] {
  const errors: string[] = [];
  page.on("console", (message) => {
    if (message.type() === "error") errors.push(message.text());
  });
  page.on("pageerror", (error) => errors.push(String(error)));
  return errors;
}

const css = (locator: Locator, property: string) =>
  locator.evaluate(
    (el, name) => getComputedStyle(el).getPropertyValue(name),
    property,
  );

/** translateX / translateY (px) of an element's computed transform. */
const translation = (locator: Locator) =>
  locator.evaluate((el) => {
    const matrix = new DOMMatrix(getComputedStyle(el).transform);
    return { x: matrix.m41, y: matrix.m42 };
  });

async function expectNoAxeViolations(page: Page) {
  const results = await new AxeBuilder({ page })
    .withTags(WCAG_TAGS)
    .exclude("nextjs-portal") // Next.js dev overlay, not our UI
    .analyze();
  expect(results.violations).toEqual([]);
}

const textHeading = (page: Page, index = 0) =>
  page.locator("[data-fx='text-reveal']").nth(index);
const magnetHost = (page: Page) => page.locator("[data-fx='magnetic']").first();
const card = (page: Page) => page.locator("[data-fx='spotlight-card']").first();
const marqueeViewport = (page: Page) =>
  page.locator("[data-fx='marquee'] > div").first();
const marqueeTrack = (page: Page) =>
  page.locator("[data-fx='marquee'] .animate-marquee");
const pinned = (page: Page) =>
  page.locator("[data-fx='pinned-section'] section");
const blob = (page: Page) =>
  page.locator("[data-fx='gradient-mesh'] [aria-hidden='true'] > div").first();

/** Scroll position (px from page top) of a point inside the pin spacer. */
const scrollIntoPin = (page: Page, offset: number) =>
  page.evaluate((delta) => {
    const spacer = document.querySelector<HTMLElement>(".pin-spacer");
    if (!spacer) throw new Error("no pin spacer");
    window.scrollTo(0, spacer.offsetTop + delta);
  }, offset);

// ---------------------------------------------------------------------------

test.describe("FX library: without JavaScript", () => {
  test.use({ javaScriptEnabled: false });

  test("everything is readable and in its final state", async ({ page }) => {
    await page.goto(FX);

    await expect(
      page.getByRole("heading", { level: 1, name: "FX library" }),
    ).toBeVisible();
    // text reveal: the whole headline, visible, nothing hidden
    const heading = textHeading(page);
    await expect(heading).toHaveText(
      "Agents that do the work, engineered to be trusted.",
    );
    expect(
      await css(heading.locator("[data-fx-word]").first(), "opacity"),
    ).toBe("1");
    // marquee: the list is there with all its items
    await expect(
      page
        .getByRole("list", { name: "Technologies we build with" })
        .getByRole("listitem"),
    ).toHaveCount(10);
    // spotlight cards: content visible, discs invisible
    await expect(
      page.getByRole("heading", { name: "AI agents" }),
    ).toBeVisible();
    expect(
      await css(card(page).locator("[data-fx-spot='edge']"), "opacity"),
    ).toBe("0");
    // pinned section: stacked, all steps readable, no spacer, progress bar not shown
    for (const step of await page.locator("[data-fx-step]").all()) {
      await expect(step).toBeVisible();
      expect(await css(step, "opacity")).toBe("1");
    }
    expect(await page.locator(".pin-spacer").count()).toBe(0);
    expect(
      await css(page.locator("[data-fx-progress-track]"), "visibility"),
    ).toBe("hidden");
  });

  test("the marquee still loops and its pause switch still works", async ({
    page,
  }) => {
    await page.goto(FX);
    const track = marqueeTrack(page);
    expect(await css(track, "animation-name")).toBe("marquee");
    expect(await css(track, "animation-play-state")).toBe("running");

    await page.getByRole("checkbox", { name: PAUSE }).check();

    expect(await css(track, "animation-play-state")).toBe("paused");
  });
});

// ---------------------------------------------------------------------------

test.describe("FX library: full motion", () => {
  test("loads exactly the expected motion and no errors", async ({ page }) => {
    const errors = collectErrors(page);
    await openFx(page);

    await waitForFx(page);

    // StrictMode double-runs effects in dev: a missing cleanup would show 6 and 2
    expect(await state(page)).toEqual({ triggers: TRIGGERS, pins: 1 });
    expect(errors).toEqual([]);
  });

  test("text reveal: words start hidden below the fold and rise in when reached", async ({
    page,
  }) => {
    await openFx(page);
    await waitForFx(page);
    const words = textHeading(page).locator("[data-fx-word]");
    const last = words.last();

    expect(await css(last, "opacity")).toBe("0"); // animates FROM hidden

    await textHeading(page).scrollIntoViewIfNeeded();
    await expect
      .poll(() => css(last, "opacity"), { timeout: 10_000 })
      .toBe("1");
    expect(await translation(last)).toEqual({ x: 0, y: 0 });
    // the accessible name is the full sentence, whatever the animation state
    await expect(
      page.getByRole("heading", {
        name: "Agents that do the work, engineered to be trusted.",
      }),
    ).toBeVisible();
  });

  test("magnetic button: leans toward a nearby mouse, stays under it, lets go, never moves its layout box", async ({
    page,
  }) => {
    await openFx(page);
    await waitForFx(page);
    const host = magnetHost(page);
    const magnet = host.locator("[data-fx-magnet]");
    await host.scrollIntoViewIfNeeded();
    const box = await host.boundingBox();
    if (!box) throw new Error("no box");

    await page.mouse.move(
      box.x + box.width / 2 + 30,
      box.y + box.height / 2 + 10,
    );

    await expect
      .poll(async () => (await translation(magnet)).x, { timeout: 5000 })
      .toBeGreaterThan(1);
    const moved = await translation(magnet);
    expect(moved.x).toBeLessThanOrEqual(12);
    expect(moved.y).toBeLessThanOrEqual(12);
    // the layout box did not move; only a transform did
    expect(await host.boundingBox()).toEqual(box);
    // the pointer is still over the button, so a click would land
    expect(
      await page.evaluate(
        ({ x, y }) =>
          Boolean(document.elementFromPoint(x, y)?.closest("button")),
        { x: box.x + box.width / 2 + 30, y: box.y + box.height / 2 + 10 },
      ),
    ).toBe(true);

    await page.mouse.move(box.x + box.width + 400, box.y + box.height + 200);

    await expect
      .poll(async () => Math.abs((await translation(magnet)).x), {
        timeout: 5000,
      })
      .toBeLessThan(0.05);
  });

  test("magnetic button: keyboard focus shows the normal ring and does not move it", async ({
    page,
  }) => {
    await openFx(page);
    await waitForFx(page);
    const button = magnetHost(page).getByRole("button", {
      name: "Start a project",
    });

    await button.focus();
    await page.keyboard.press("Shift+Tab");
    await page.keyboard.press("Tab");

    await expect(button).toBeFocused();
    expect(await css(button, "outline-style")).toBe("solid");
    expect(await css(button, "outline-width")).toBe("2px");
    expect(
      await translation(magnetHost(page).locator("[data-fx-magnet]")),
    ).toEqual({ x: 0, y: 0 });
  });

  test("marquee: runs, pauses on hover, resumes, and the switch pauses it too", async ({
    page,
  }) => {
    await openFx(page);
    await waitForFx(page);
    const track = marqueeTrack(page);
    const playState = () => css(track, "animation-play-state");
    expect(await css(track, "animation-name")).toBe("marquee");
    expect(await playState()).toBe("running");

    await marqueeViewport(page).hover();
    await expect.poll(playState).toBe("paused");

    await page.mouse.move(2, 2);
    await expect.poll(playState).toBe("running");

    await page.getByRole("checkbox", { name: PAUSE }).check();
    await expect.poll(playState).toBe("paused");
    await page.getByRole("checkbox", { name: PAUSE }).uncheck();
    await expect.poll(playState).toBe("running");
  });

  test("marquee: the pause switch is reachable and operable with the keyboard", async ({
    page,
  }) => {
    await openFx(page);
    await waitForFx(page);
    const toggle = page.getByRole("checkbox", { name: PAUSE });
    await magnetHost(page).getByRole("button").first().focus();

    await page.keyboard.press("Shift+Tab");

    await expect(toggle).toBeFocused();
    expect(await css(toggle, "outline-style")).toBe("solid");
    await page.keyboard.press("Space");
    await expect(toggle).toBeChecked();
    await expect
      .poll(() => css(marqueeTrack(page), "animation-play-state"))
      .toBe("paused");
  });

  test("marquee: one copy is wider than a 1920 px screen, so the loop has no gap", async ({
    page,
  }) => {
    await page.setViewportSize({ width: 1920, height: 1080 });
    await openFx(page);

    const widths = await page.evaluate(() => {
      const viewport = document.querySelector("[data-fx='marquee'] > div");
      const list = viewport?.querySelector("ul");
      return {
        viewport: viewport?.clientWidth ?? 0,
        list: list?.getBoundingClientRect().width ?? 0,
      };
    });
    expect(widths.list).toBeGreaterThanOrEqual(widths.viewport);
  });

  test("marquee: the looping copy is hidden from assistive technology and has no focusable content", async ({
    page,
  }) => {
    await openFx(page);

    expect(
      await page.evaluate(() => {
        const copy = document.querySelector(
          "[data-fx='marquee'] ul[aria-hidden='true']",
        );
        return copy?.querySelectorAll("a, button, input, [tabindex]").length;
      }),
    ).toBe(0);
    await expect(
      page.getByRole("list", { name: "Technologies we build with" }),
    ).toHaveCount(1);
  });

  test("spotlight card: the glow follows the pointer along the edge and surface, then fades out", async ({
    page,
  }) => {
    await openFx(page);
    await waitForFx(page);
    const target = card(page);
    const edge = target.locator("[data-fx-spot='edge']");
    const surface = target.locator("[data-fx-spot='surface']");
    await target.scrollIntoViewIfNeeded();
    const box = await target.boundingBox();
    if (!box) throw new Error("no box");
    expect(await css(edge, "opacity")).toBe("0");

    await page.mouse.move(box.x + 60, box.y + 40);

    await expect.poll(() => css(edge, "opacity")).toBe("1");
    await expect.poll(() => css(surface, "opacity")).toBe("0.08");
    // the disc is centred on the pointer
    await expect
      .poll(async () => {
        const disc = await edge.boundingBox();
        return disc
          ? Math.hypot(
              disc.x + disc.width / 2 - (box.x + 60),
              disc.y + disc.height / 2 - (box.y + 40),
            )
          : 999;
      })
      .toBeLessThan(3);

    await page.mouse.move(box.x + box.width - 30, box.y + box.height - 20);
    await expect
      .poll(async () => {
        const disc = await edge.boundingBox();
        return disc ? disc.x + disc.width / 2 - box.x : 0;
      })
      .toBeGreaterThan(box.width - 40);

    await page.mouse.move(2, 2);
    await expect.poll(() => css(edge, "opacity")).toBe("0");
    await expect.poll(() => css(surface, "opacity")).toBe("0");
  });

  test("spotlight card: only transform and opacity change on the discs", async ({
    page,
  }) => {
    await openFx(page);
    await waitForFx(page);
    const target = card(page);
    await target.scrollIntoViewIfNeeded();
    const box = await target.boundingBox();
    if (!box) throw new Error("no box");
    const before = await target.evaluate((el) => {
      const rect = el.getBoundingClientRect();
      return [rect.width, rect.height];
    });

    await page.mouse.move(box.x + 80, box.y + 50);
    await expect
      .poll(() => css(target.locator("[data-fx-spot='edge']"), "opacity"))
      .toBe("1");

    const after = await target.evaluate((el) => {
      const rect = el.getBoundingClientRect();
      return [rect.width, rect.height];
    });
    expect(after).toEqual(before);
  });

  test("pinned section: pins while scrolling, reveals the steps, then lets go", async ({
    page,
  }) => {
    await openFx(page);
    await waitForFx(page);
    const section = pinned(page);
    const steps = page.locator("[data-fx-step]");
    const opacityOf = (index: number) => css(steps.nth(index), "opacity");
    // before the scene: the later steps are hidden, the first is not
    expect(await opacityOf(0)).toBe("1");
    expect(await opacityOf(2)).toBe("0");

    await scrollIntoPin(page, 400);
    await expect
      .poll(() => css(section, "position"), { timeout: 10_000 })
      .toBe("fixed");
    expect(
      await css(page.locator("[data-fx-progress-track]"), "visibility"),
    ).not.toBe("hidden");

    // end of the scene: 0.75 viewport heights per step
    const end = 0.75 * 720 * 3;
    await scrollIntoPin(page, end);
    await expect.poll(() => opacityOf(2), { timeout: 10_000 }).toBe("1");
    await expect
      .poll(
        async () => (await translation(page.locator("[data-fx-progress]"))).x,
      )
      .toBe(0);

    await page.evaluate(() => {
      window.scrollTo(0, document.documentElement.scrollHeight);
    });
    await expect
      .poll(() => css(section, "position"), { timeout: 10_000 })
      .not.toBe("fixed");
  });

  test("gradient mesh: drifts slowly with transform only", async ({ page }) => {
    await openFx(page);
    const target = blob(page);
    expect(await css(target, "animation-name")).toBe("mesh-a");
    const first = await css(target, "transform");

    await page.waitForTimeout(1500);

    expect(await css(target, "transform")).not.toBe(first);
    expect(await css(target, "pointer-events")).toBe("none");
  });

  test("the page has one h1 and no axe violations (dark)", async ({ page }) => {
    await page.emulateMedia({ colorScheme: "dark" });
    await openFx(page);
    await waitForFx(page);

    await expect(page.getByRole("heading", { level: 1 })).toHaveCount(1);
    await expectNoAxeViolations(page);
  });

  test("no axe violations in the light theme either", async ({ page }) => {
    await page.emulateMedia({ colorScheme: "light" });
    await openFx(page);
    await waitForFx(page);

    await expectNoAxeViolations(page);
  });

  test("no axe violations with a card lit, a button leaning and the scene pinned", async ({
    page,
  }) => {
    await page.emulateMedia({ colorScheme: "light" });
    await openFx(page);
    await waitForFx(page);
    const target = card(page);
    await target.scrollIntoViewIfNeeded();
    const box = await target.boundingBox();
    if (!box) throw new Error("no box");
    await page.mouse.move(box.x + 60, box.y + 40);
    await expect
      .poll(() => css(target.locator("[data-fx-spot='edge']"), "opacity"))
      .toBe("1");
    await expectNoAxeViolations(page);

    // Scan the pinned scene at its end: every step fully visible. (Halfway through
    // a scrubbed fade a step is partly transparent, which is a transient state,
    // not a contrast failure of the design.)
    await scrollIntoPin(page, 0.75 * 720 * 3 - 40); // just before the scene lets go
    await expect
      .poll(() => css(pinned(page), "position"), { timeout: 10_000 })
      .toBe("fixed");
    await expect
      .poll(() => css(page.locator("[data-fx-step]").nth(2), "opacity"))
      .toBe("1");
    await expectNoAxeViolations(page);
  });
});

// ---------------------------------------------------------------------------

test.describe("FX library: reduced motion", () => {
  test.use({ reducedMotion: "reduce" });

  test("nothing animates, nothing is hidden, nothing is pinned", async ({
    page,
  }) => {
    await openFx(page);
    // (Not asserted here: that the chunks are not downloaded. `next dev` preloads
    // dynamic chunks whatever the preference, so only a production build can show
    // it; see fx-bundle.spec.ts and the unit tests of the wrappers.)
    await page.waitForTimeout(3000); // well past the idle callback's 2 s timeout

    expect(await state(page)).toEqual({ triggers: 0, pins: 0 });
    // text reveal: final state
    expect(
      await css(textHeading(page).locator("[data-fx-word]").last(), "opacity"),
    ).toBe("1");
    // pinned: stacked, every step visible, no pin
    for (const step of await page.locator("[data-fx-step]").all()) {
      expect(await css(step, "opacity")).toBe("1");
    }
    expect(await css(pinned(page), "position")).not.toBe("fixed");
    // marquee: no animation, one wrapped list, no clipping, no pause switch
    expect(await css(marqueeTrack(page), "animation-name")).toBe("none");
    await expect(
      page.locator("[data-fx='marquee'] ul[aria-hidden='true']"),
    ).toBeHidden();
    expect(
      await css(page.locator("[data-fx='marquee'] ul").first(), "flex-wrap"),
    ).toBe("wrap");
    expect(await css(marqueeViewport(page), "overflow-x")).toBe("visible");
    await expect(page.getByRole("checkbox", { name: PAUSE })).toBeHidden();
    await expect(
      page
        .getByRole("list", { name: "Technologies we build with" })
        .getByRole("listitem"),
    ).toHaveCount(10);
    // mesh: still
    expect(await css(blob(page), "animation-name")).toBe("none");
  });

  test("the marquee list wraps inside the screen (no horizontal scroll, every item reachable)", async ({
    page,
  }) => {
    await page.setViewportSize({ width: 360, height: 740 });
    await openFx(page);

    const overflow = await page.evaluate(
      () =>
        document.documentElement.scrollWidth -
        document.documentElement.clientWidth,
    );
    expect(overflow).toBeLessThanOrEqual(0);
    const last = page
      .getByRole("list", { name: "Technologies we build with" })
      .getByRole("listitem")
      .last();
    await expect(last)
      .toBeInViewport({ ratio: 0 })
      .catch(() => undefined);
    const right = await last.evaluate((el) => el.getBoundingClientRect().right);
    expect(right).toBeLessThanOrEqual(360);
  });

  test("pointer effects stay off: the button does not lean and the card does not light up", async ({
    page,
  }) => {
    await openFx(page);
    await page.waitForTimeout(2500);
    const host = magnetHost(page);
    await host.scrollIntoViewIfNeeded();
    const box = await host.boundingBox();
    if (!box) throw new Error("no box");

    await page.mouse.move(
      box.x + box.width / 2 + 30,
      box.y + box.height / 2 + 10,
    );
    await page.waitForTimeout(500);
    expect(await translation(host.locator("[data-fx-magnet]"))).toEqual({
      x: 0,
      y: 0,
    });

    const target = card(page);
    await target.scrollIntoViewIfNeeded();
    const cardBox = await target.boundingBox();
    if (!cardBox) throw new Error("no box");
    await page.mouse.move(cardBox.x + 60, cardBox.y + 40);
    await page.waitForTimeout(500);
    expect(await css(target.locator("[data-fx-spot='edge']"), "opacity")).toBe(
      "0",
    );
  });

  test("no axe violations", async ({ page }) => {
    await openFx(page);
    await page.waitForTimeout(500);

    await expectNoAxeViolations(page);
  });
});

test.describe("FX library: changing the preference while the page is open", () => {
  test("switches cleanly in both directions, repeatedly, with stable counts", async ({
    page,
  }) => {
    await openFx(page);
    await waitForFx(page);

    for (let round = 1; round <= 3; round++) {
      await page.emulateMedia({ reducedMotion: "reduce" });
      await expect
        .poll(() => state(page), { message: `round ${String(round)}: reduced` })
        .toEqual({ triggers: 0, pins: 0 });
      expect(await css(marqueeTrack(page), "animation-name")).toBe("none");
      expect(
        await css(
          textHeading(page).locator("[data-fx-word]").last(),
          "opacity",
        ),
      ).toBe("1");
      for (const step of await page.locator("[data-fx-step]").all()) {
        expect(await css(step, "opacity")).toBe("1");
      }

      await page.emulateMedia({ reducedMotion: "no-preference" });
      await expect
        .poll(() => state(page), {
          timeout: 15_000,
          message: `round ${String(round)}: back to full motion`,
        })
        .toEqual({ triggers: TRIGGERS, pins: 1 });
      expect(await css(marqueeTrack(page), "animation-name")).toBe("marquee");
    }
  });

  test("a card that is lit when the preference flips goes dark and stays dark", async ({
    page,
  }) => {
    await openFx(page);
    await waitForFx(page);
    const target = card(page);
    const edge = target.locator("[data-fx-spot='edge']");
    await target.scrollIntoViewIfNeeded();
    const box = await target.boundingBox();
    if (!box) throw new Error("no box");
    await page.mouse.move(box.x + 60, box.y + 40);
    await expect.poll(() => css(edge, "opacity")).toBe("1");

    await page.emulateMedia({ reducedMotion: "reduce" });

    await expect.poll(() => css(edge, "opacity")).toBe("0");
    await page.mouse.move(box.x + 100, box.y + 60);
    await page.waitForTimeout(400);
    expect(await css(edge, "opacity")).toBe("0");
  });
});

// ---------------------------------------------------------------------------

test.describe("FX library: route navigation", () => {
  test("every ScrollTrigger, pin and listener is gone after leaving, and rebuilt exactly on return", async ({
    page,
  }) => {
    const errors = collectErrors(page);
    await openFx(page);
    await waitForFx(page);

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
        .toEqual({ triggers: 0, pins: 0 });

      await page.getByRole("link", { name: "FX library" }).click();
      await expect(page).toHaveURL(/\/it\/_dev\/fx$/);
      await expect
        .poll(() => state(page), {
          timeout: 20_000,
          message: `round ${String(round)}: back on FX`,
        })
        .toEqual({ triggers: TRIGGERS, pins: 1 });
    }

    expect(errors).toEqual([]);
  });

  test("leaving while the scene is pinned and a card is lit leaves nothing behind; Back and Forward behave the same", async ({
    page,
  }) => {
    const errors = collectErrors(page);
    await openFx(page);
    await waitForFx(page);
    await scrollIntoPin(page, 600);
    await expect
      .poll(() => css(pinned(page), "position"), { timeout: 10_000 })
      .toBe("fixed");

    // The link is far above the viewport now: a DOM click navigates from this exact state.
    await page.getByRole("link", { name: "UI gallery" }).evaluate((link) => {
      (link as HTMLElement).click();
    });
    await expect(page).toHaveURL(/\/it\/_dev\/ui$/);
    await expect.poll(() => state(page)).toEqual({ triggers: 0, pins: 0 });
    expect(await page.locator(".pin-spacer").count()).toBe(0);

    await page.goBack();
    await expect(page).toHaveURL(/\/it\/_dev\/fx$/);
    // The browser restores the scroll position, so both headlines are already
    // above the viewport and stay as rendered (by design: nothing scrolled past
    // is hidden to be animated in). Only the pinned scene is rebuilt.
    await expect
      .poll(() => state(page), { timeout: 20_000 })
      .toEqual({ triggers: 1, pins: 1 });
    // (a fired `once` trigger removes itself, which is why the count is 1 and
    // not 3; the headline's fade plays out above the viewport.)
    await expect
      .poll(() =>
        css(textHeading(page).locator("[data-fx-word]").last(), "opacity"),
      )
      .toBe("1");

    await page.goForward();
    await expect(page).toHaveURL(/\/it\/_dev\/ui$/);
    await expect.poll(() => state(page)).toEqual({ triggers: 0, pins: 0 });
    expect(errors).toEqual([]);
  });
});

// ---------------------------------------------------------------------------

test.describe("FX library: touch devices", () => {
  test.use({
    viewport: { width: 412, height: 915 },
    hasTouch: true,
    isMobile: true,
  });

  test("pointer effects never attach; scroll effects still work", async ({
    page,
  }) => {
    await openFx(page);
    await waitForFx(page);
    expect(
      await page.evaluate(
        () => matchMedia("(hover: hover) and (pointer: fine)").matches,
      ),
    ).toBe(false);

    const host = magnetHost(page);
    await host.scrollIntoViewIfNeeded();
    await host.getByRole("button").tap();
    await page.waitForTimeout(500);
    expect(await translation(host.locator("[data-fx-magnet]"))).toEqual({
      x: 0,
      y: 0,
    });

    const target = card(page);
    await target.scrollIntoViewIfNeeded();
    await target.tap();
    await page.waitForTimeout(500);
    expect(await css(target.locator("[data-fx-spot='edge']"), "opacity")).toBe(
      "0",
    );
  });
});

test.describe("FX library: a viewport too short for the pinned scene", () => {
  test.use({ viewport: { width: 740, height: 300 } });

  test("keeps the stacked layout instead of cutting content off", async ({
    page,
  }) => {
    await openFx(page);

    await expect
      .poll(async () => (await state(page)).triggers, { timeout: 20_000 })
      .toBe(TRIGGERS - 1); // the two text reveals only
    expect((await state(page)).pins).toBe(0);
    expect(await css(pinned(page), "position")).not.toBe("fixed");
    for (const step of await page.locator("[data-fx-step]").all()) {
      expect(await css(step, "opacity")).toBe("1");
    }
  });
});

// ---------------------------------------------------------------------------

test.describe("FX library: layout shift (CLS)", () => {
  test("stays below 0.05 over load, motion start-up and a full scroll", async ({
    page,
  }, testInfo) => {
    await trackLayoutShift(page);
    await openFx(page);
    await waitForFx(page);

    await scrollThroughPage(page);

    const cls = await layoutShift(page);
    testInfo.annotations.push({ type: "cls", description: cls.toFixed(4) });
    expect(cls).toBeLessThan(0.05);
  });
});

test.describe("FX library: layout shift (CLS), reduced motion", () => {
  test.use({ reducedMotion: "reduce" });

  test("stays below 0.05 over load and a full scroll", async ({
    page,
  }, testInfo) => {
    await trackLayoutShift(page);
    await openFx(page);

    await scrollThroughPage(page);

    const cls = await layoutShift(page);
    testInfo.annotations.push({ type: "cls", description: cls.toFixed(4) });
    expect(cls).toBeLessThan(0.05);
  });
});

test.describe("FX library: reachable from the gallery", () => {
  test("the gallery links to it", async ({ page }) => {
    await page.goto(GALLERY);

    await page.getByRole("link", { name: "FX library" }).click();

    await expect(page).toHaveURL(/\/it\/_dev\/fx$/);
    await expect(
      page.getByRole("heading", { level: 1, name: "FX library" }),
    ).toBeVisible();
  });
});
