import "@testing-library/jest-dom/vitest";
import { cleanup } from "@testing-library/react";
import { afterEach, beforeEach } from "vitest";

import { mockReducedMotion } from "@/test-utils/match-media";

// jsdom has no `matchMedia`, but every real browser does, and importing
// src/lib/motion/gsap.ts (ScrollTrigger) needs it at load time. Default to
// "no preference"; tests that care call `mockReducedMotion(...)` themselves.
if (typeof window !== "undefined") mockReducedMotion(false);
beforeEach(() => {
  if (typeof window !== "undefined") mockReducedMotion(false);
});

// Same for the font-loading API (`document.fonts.ready`), also missing in jsdom.
if (typeof document !== "undefined" && !("fonts" in document)) {
  Object.defineProperty(document, "fonts", {
    value: { ready: Promise.resolve() },
    configurable: true,
  });
}

// Vitest globals are off, so Testing Library cannot register its own cleanup.
afterEach(() => {
  cleanup();
});
