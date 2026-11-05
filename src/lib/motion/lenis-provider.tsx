"use client";

import dynamic from "next/dynamic";
import { useEffect, useState, type ReactNode } from "react";

import { useReducedMotion } from "@/lib/motion/use-reduced-motion";

// GSAP + Lenis are a separate chunk, fetched only after the page is interactive.
const LenisRuntime = dynamic(() => import("@/lib/motion/lenis-runtime"), {
  ssr: false,
});

/** Becomes true once the browser is idle, so loading the engine never competes with first render. */
function useAfterIdle(): boolean {
  const [idle, setIdle] = useState(false);
  useEffect(() => {
    if (typeof requestIdleCallback === "function") {
      const handle = requestIdleCallback(
        () => {
          setIdle(true);
        },
        { timeout: 2000 },
      );
      return () => {
        cancelIdleCallback(handle);
      };
    }
    const handle = window.setTimeout(() => {
      setIdle(true);
    }, 200);
    return () => {
      window.clearTimeout(handle);
    };
  }, []);
  return idle;
}

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
