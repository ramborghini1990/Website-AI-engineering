import type { Page } from "@playwright/test";

type ShiftWindow = Window & { __cls: number };

/**
 * Start recording layout shifts. Call BEFORE `page.goto`: the observer is
 * installed ahead of the page's own scripts and uses `buffered`, so the initial
 * render, the font swap and Lenis starting up are all counted.
 *
 * The result is the plain SUM of shifts without recent input, which is never
 * lower than Web Vitals' CLS (the worst session window), so a pass here is a pass there.
 */
export async function trackLayoutShift(page: Page): Promise<void> {
  await page.addInitScript(() => {
    const w = window as unknown as ShiftWindow;
    w.__cls = 0;
    new PerformanceObserver((list) => {
      for (const entry of list.getEntries()) {
        const shift = entry as PerformanceEntry & {
          value: number;
          hadRecentInput: boolean;
        };
        if (!shift.hadRecentInput) w.__cls += shift.value;
      }
    }).observe({ type: "layout-shift", buffered: true });
  });
}

export async function layoutShift(page: Page): Promise<number> {
  return page.evaluate(() => (window as unknown as ShiftWindow).__cls);
}

/** Scroll to the very bottom with real wheel events, like a person would. */
export async function scrollThroughPage(page: Page): Promise<void> {
  await page.mouse.move(640, 400);
  for (let step = 0; step < 60; step++) {
    const atBottom = await page.evaluate(
      () =>
        window.scrollY + window.innerHeight >=
        document.documentElement.scrollHeight - 2,
    );
    if (atBottom) break;
    await page.mouse.wheel(0, 500);
    await page.waitForTimeout(120);
  }
  await page.waitForTimeout(400); // let smooth scroll and any late shift settle
}

/** Wait until React has attached handlers (events before that are lost). */
export async function waitForHydration(page: Page): Promise<void> {
  await page.waitForFunction(() => {
    // The header (in every page) has links; a hydrated element carries React's keys.
    const button = document.querySelector("header a, main button, main a");
    return (
      button !== null &&
      Object.keys(button).some((key) => key.startsWith("__react"))
    );
  });
}
