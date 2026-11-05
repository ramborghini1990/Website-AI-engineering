"use client";

import dynamic from "next/dynamic";
import type { ReactNode } from "react";

import { useAfterIdle } from "@/lib/motion/use-after-idle";
import { useReducedMotion } from "@/lib/motion/use-reduced-motion";

// GSAP + Lenis are a separate chunk, fetched only after the page is interactive.
const LenisRuntime = dynamic(() => import("@/lib/motion/lenis-runtime"), {
  ssr: false,
});

/**
 * The single owner of smooth scrolling (CLAUDE.md §8). Mount it once, in the
 * root layout. With `prefers-reduced-motion: reduce` Lenis is not even loaded
 * and the page scrolls natively; if the preference changes while the page is
 * open the engine is created or destroyed accordingly.
 */
export function LenisProvider({ children }: { children: ReactNode }) {
  const reduced = useReducedMotion();
  const idle = useAfterIdle();

  return (
    <>
      {children}
      {idle && !reduced ? <LenisRuntime /> : null}
    </>
  );
}
