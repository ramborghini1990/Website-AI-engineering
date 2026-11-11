import "@testing-library/jest-dom/vitest";
import { cleanup } from "@testing-library/react";
import { afterEach, beforeEach, vi } from "vitest";

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

// The demos report cookieless events with `fetch` (P3.5). No test may reach a
// network: in the browser-like environment `fetch` is a stub that answers 204,
// and tests that care replace it with their own (`vi.stubGlobal`).
if (typeof window !== "undefined") {
  beforeEach(() => {
    vi.stubGlobal(
      "fetch",
      vi.fn(() => Promise.resolve(new Response(null, { status: 204 }))),
    );
  });
}

// Vitest globals are off, so Testing Library cannot register its own cleanup.
afterEach(() => {
  cleanup();
});
