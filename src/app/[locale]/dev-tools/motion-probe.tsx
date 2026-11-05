"use client";

import { useEffect } from "react";

import { ScrollTrigger } from "@/lib/motion/gsap";

declare global {
  interface Window {
    /**
     * Read by the Playwright tests (e2e/motion.spec.ts). Exists only on dev
     * pages (it is mounted by the dev-tools layout), so it can count what is
     * alive on ANY dev page, including after navigating away from the demo.
     */
    __motionDebug?: {
      /** Live ScrollTriggers. Must be 0 on a page that created none. */
      triggers: () => number;
      /** Leftover pin wrappers in the DOM. */
      pinSpacers: () => number;
      /** Whether Lenis is currently running (it adds a class to <html>). */
      lenis: () => boolean;
    };
  }
}

export function MotionProbe() {
  useEffect(() => {
    window.__motionDebug = {
      triggers: () => ScrollTrigger.getAll().length,
      pinSpacers: () => document.querySelectorAll(".pin-spacer").length,
      lenis: () => document.documentElement.classList.contains("lenis"),
    };
    return () => {
      delete window.__motionDebug;
    };
  }, []);

  return null;
}
