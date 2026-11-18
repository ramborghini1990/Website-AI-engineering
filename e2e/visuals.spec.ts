import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";

import {
  layoutShift,
  settleAnimations,
  trackLayoutShift,
} from "./support/motion";
import { prodURL } from "./support/servers";

/**
 * V5: the visual layer (diagrams, glyphs, previews, section index and process
 * track) on the PRODUCTION build, across language, theme, viewport and motion
 * preference. Layout, accessibility, timing and privacy are asserted; how it
 * LOOKS is not (fonts differ between Windows and CI): the reduced-motion runs
 * only write a screenshot to .agent-logs/visuals/ for a human to review.
 */

const WCAG_TAGS = ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"];
const VIEWPORTS = [360, 768, 1280, 1920] as const;
const EDGE_VIEWPORTS = [360, 1280] as const;
const THEMES = ["dark", "light"] as const;
const MOTIONS = ["full", "reduced"] as const;

/** The full matrix: home and one page per type (service, project). Italian, the longest copy. */
const FULL = [
  { locale: "it", path: "" },
  { locale: "it", path: "/services/ai-agents" },
  { locale: "it", path: "/work/document-intelligence-demo" },
] as const;
/** Every other page, at the two edge widths only. */
const EDGE = [
  { locale: "it", path: "/services" },
  { locale: "it", path: "/services/workflow-automation" },
  { locale: "it", path: "/work" },
  { locale: "en", path: "" },
  { locale: "en", path: "/services" },
  { locale: "en", path: "/services/ai-agents" },
  { locale: "en", path: "/services/workflow-automation" },
  { locale: "en", path: "/work" },
  { locale: "en", path: "/work/document-intelligence-demo" },
] as const;

/** The whole hero sequence (the longest animation in the layer) must end before this. */
const SEQUENCE_LIMIT_MS = 5000;
const MIN_TEXT_PX = 12;

type Combo = {
  locale: "it" | "en";
  path: string;
  width: (typeof VIEWPORTS)[number];
  theme: (typeof THEMES)[number];
  motion: (typeof MOTIONS)[number];
};

const combos: Combo[] = [
  ...FULL.map((page) => ({ page, widths: VIEWPORTS })),
  ...EDGE.map((page) => ({ page, widths: EDGE_VIEWPORTS })),
].flatMap(({ page, widths }) =>
  widths.flatMap((width) =>
    THEMES.flatMap((theme) =>
      MOTIONS.map((motion) => ({ ...page, width, theme, motion })),
    ),
  ),
);

/** Every request that leaves the test origin (data: and blob: stay in the browser). */
function foreignRequests(page: Page): string[] {
  const foreign: string[] = [];
  page.on("request", (request) => {
    const url = request.url();
    if (
      !url.startsWith(prodURL) &&
      !url.startsWith("data:") &&
      !url.startsWith("blob:")
    )
      foreign.push(url);
  });
  return foreign;
}

/** Checks a) b) c) of the matrix, run in the page. Returns one line per problem. */
function auditLayout(page: Page): Promise<string[]> {
  return page.evaluate((minTextPx) => {
    const problems: string[] = [];
    const where = (el: Element) =>
      `${el.tagName.toLowerCase()}${el.id ? `#${el.id}` : ""}${
        typeof el.className === "string" && el.className
          ? `.${el.className.split(/\s+/).slice(0, 3).join(".")}`
          : ""
      }`;

    // a) every diagram: a caption, a title the figure is named by, a legend that matches its drawing
    for (const figure of document.querySelectorAll("figure[data-diagram]")) {
      const id = figure.getAttribute("data-diagram") ?? "?";
      const caption = figure.querySelector("figcaption");
      if (!caption?.textContent.trim())
        problems.push(`${id}: empty figcaption`);
      const titleId = figure.getAttribute("aria-labelledby") ?? "";
      if (!document.getElementById(titleId)?.textContent.trim())
        problems.push(`${id}: aria-labelledby does not name a title`);

      const items = [...figure.querySelectorAll("figcaption ol > li")];
      if (items.length === 0) problems.push(`${id}: no legend items`);
      const legend = items.map((li) => li.getAttribute("data-step-index"));
      const expected = items.map((_, index) => String(index + 1));
      if (legend.join() !== expected.join())
        problems.push(`${id}: legend numbering ${legend.join()} is not 1..n`);
      const drawn = new Set(
        [...figure.querySelectorAll("svg [data-node-step-index]")].map((el) =>
          el.getAttribute("data-node-step-index"),
        ),
      );
      if ([...drawn].sort().join() !== expected.join())
        problems.push(
          `${id}: drawing shows steps ${[...drawn].sort().join()}, legend has ${expected.join()}`,
        );

      const svg = figure.querySelector("svg");
      if (svg?.getAttribute("aria-hidden") !== "true")
        problems.push(`${id}: svg is not aria-hidden`);
    }

    // every svg keeps its intrinsic ratio, so nothing resizes after paint
    for (const svg of document.querySelectorAll("svg")) {
      if (!svg.getAttribute("viewBox"))
        problems.push(`svg without viewBox: ${where(svg)}`);
    }

    // b) nothing is wider than the viewport unless a clipping ancestor inside the viewport contains it
    const viewport = document.documentElement.clientWidth;
    if (document.documentElement.scrollWidth > viewport)
      problems.push(
        `horizontal scroll: scrollWidth ${String(document.documentElement.scrollWidth)} > ${String(viewport)}`,
      );
    for (const el of document.body.querySelectorAll("*")) {
      const rect = el.getBoundingClientRect();
      if (rect.width <= viewport + 1) continue;
      let clipped = false;
      for (
        let parent = el.parentElement;
        parent && parent !== document.body;
        parent = parent.parentElement
      ) {
        const overflow = getComputedStyle(parent).overflowX;
        if (
          overflow !== "visible" &&
          parent.getBoundingClientRect().width <= viewport + 1
        ) {
          clipped = true;
          break;
        }
      }
      if (!clipped)
        problems.push(
          `wider than the viewport (${String(Math.round(rect.width))} > ${String(viewport)}): ${where(el)}`,
        );
    }

    // c) every SVG <text> renders at 12 px or more: user-unit font size x the viewBox scale
    for (const text of document.querySelectorAll<SVGTextElement>("svg text")) {
      const scale = text.getScreenCTM()?.a ?? 0;
      if (scale === 0) continue; // not rendered (display: none)
      const px = parseFloat(getComputedStyle(text).fontSize) * scale;
      if (px < minTextPx - 0.05)
        problems.push(
          `svg text "${text.textContent.trim().slice(0, 20)}" renders at ${px.toFixed(1)} px`,
        );
    }
    return problems;
  }, MIN_TEXT_PX);
}

/**
 * e) and f): look at every animation inside a diagram. Reduced motion: none at all.
 * Full motion: all finite, each ending before the limit, and all finished soon after.
 * Returns the problems and how many animations it saw.
 */
async function auditDiagramMotion(
  page: Page,
  motion: Combo["motion"],
): Promise<{ problems: string[]; seen: number }> {
  return page.evaluate(
    async ({ motionMode, limit }) => {
      const problems: string[] = [];
      const inDiagram = () =>
        document
          .getAnimations()
          .filter((animation) =>
            (animation.effect as KeyframeEffect | null)?.target?.closest(
              "[data-diagram]",
            ),
          );
      const seen = inDiagram();
      if (motionMode === "reduced") {
        for (const animation of seen) {
          if (animation.playState === "running")
            problems.push(
              `running animation under reduced motion: ${animation.constructor.name}`,
            );
        }
        return { problems, seen: seen.length };
      }
      for (const animation of seen) {
        const timing = animation.effect?.getComputedTiming();
        if (timing?.iterations === Infinity)
          problems.push("infinite animation inside a diagram");
        else if (Number(timing?.endTime) > limit)
          problems.push(`animation ends at ${String(timing?.endTime)} ms`);
      }
      await Promise.race([
        Promise.allSettled(seen.map((animation) => animation.finished)),
        new Promise((resolve) => setTimeout(resolve, limit)),
      ]);
      for (const animation of seen) {
        if (animation.playState !== "finished")
          problems.push(
            `animation still ${animation.playState} after ${String(limit)} ms`,
          );
      }
      return { problems, seen: seen.length };
    },
    { motionMode: motion, limit: SEQUENCE_LIMIT_MS },
  );
}

test.describe("visual layer: language x theme x viewport x motion (production build)", () => {
  for (const combo of combos) {
    const { locale, path, width, theme, motion } = combo;
    const name = `/${locale}${path} ${String(width)}px ${theme} ${motion}-motion`;

    test(name, async ({ page }) => {
      test.setTimeout(60_000);
      await page.setViewportSize({ width, height: 900 });
      await page.emulateMedia({
        reducedMotion: motion === "reduced" ? "reduce" : "no-preference",
      });
      await page.addInitScript((choice) => {
        window.localStorage.setItem("theme", choice);
      }, theme);
      await trackLayoutShift(page);
      const foreign = foreignRequests(page);

      await page.goto(`/${locale}${path}`, { waitUntil: "load" });
      expect(
        await page.evaluate(() => document.documentElement.className),
      ).toContain(theme);

      // f) and e): read while the hero may still be moving
      const motionAudit = await auditDiagramMotion(page, motion);
      // d) layout shift from navigation to load + 1 s
      await page.waitForTimeout(1000);
      const shift = await layoutShift(page);

      await settleAnimations(page);
      const problems = [...(await auditLayout(page)), ...motionAudit.problems];
      if (shift !== 0)
        problems.push(`layout shift ${shift.toFixed(4)} (must be 0)`);
      if (foreign.length > 0)
        problems.push(`requests left the origin: ${foreign.join(", ")}`);

      // h) axe: serious and critical only
      const results = await new AxeBuilder({ page })
        .withTags(WCAG_TAGS)
        .analyze();
      for (const violation of results.violations) {
        if (violation.impact === "serious" || violation.impact === "critical")
          problems.push(
            `axe ${violation.impact} ${violation.id}: ${violation.nodes
              .slice(0, 3)
              .map((node) => node.target.join(" "))
              .join(" | ")}`,
          );
      }

      // Evidence for a human, not an assertion. Never fails the test.
      if (motion === "reduced") {
        const file = `.agent-logs/visuals/${locale}${path.replace(/\//g, "_") || "_home"}-${String(width)}-${theme}.png`;
        await page
          .screenshot({ path: file, fullPage: true })
          .catch(() => undefined);
      }

      expect(problems, name).toEqual([]);
    });
  }

  test("the home hero diagram really animates in full motion (the checks above are not vacuous)", async ({
    page,
  }) => {
    await page.setViewportSize({ width: 1280, height: 900 });
    await page.emulateMedia({ reducedMotion: "no-preference" });
    await page.goto("/it", { waitUntil: "load" });
    const { seen, problems } = await auditDiagramMotion(page, "full");
    expect(problems).toEqual([]);
    expect(seen).toBeGreaterThan(0);
  });
});
