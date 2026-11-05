import type { DependencyList, RefObject } from "react";

import { gsap, useGSAP } from "@/lib/motion/gsap";

export type MotionContext = {
  /** The visitor asked for reduced motion. Apply the final state or a short fade; no scroll-linked scenes. */
  reduced: boolean;
};

/**
 * The way to write a GSAP animation here (CLAUDE.md §8).
 *
 * - Everything created inside `build` (tweens, timelines, ScrollTriggers) is
 *   reverted when the component unmounts, when `dependencies` change, and when
 *   the reduced-motion preference flips: no ScrollTrigger outlives its page.
 * - `build` runs again with the new `reduced` value when the OS setting changes.
 * - Selector strings are scoped to `scope`.
 *
 * Contract for `build` when `reduced` is true: leave server-rendered content in
 * its final state, or use a fade of at most `reducedFade` seconds; no pinning,
 * scrubbing or looping.
 */
export function useMotion(
  build: (context: MotionContext) => void,
  options: { scope: RefObject<Element | null>; dependencies?: DependencyList },
): void {
  useGSAP(
    () => {
      const mm = gsap.matchMedia(options.scope.current ?? undefined);
      mm.add(
        {
          reduced: "(prefers-reduced-motion: reduce)",
          full: "(prefers-reduced-motion: no-preference)",
        },
        (context) => {
          build({ reduced: context.conditions?.reduced === true });
        },
      );
      return () => {
        mm.revert();
      };
    },
    {
      scope: options.scope,
      // useGSAP wants a mutable array; omitted = run once on mount.
      dependencies: options.dependencies ? [...options.dependencies] : [],
    },
  );
}
