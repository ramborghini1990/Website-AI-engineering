import type { DependencyList, RefObject } from "react";

import { gsap, useGSAP } from "@/lib/motion/gsap";

export type MotionContext = {
  /** The visitor asked for reduced motion. Apply the final state or a short fade; no scroll-linked scenes. */
  reduced: boolean;
  /**
   * Wrap an event handler (or any callback that runs later) that creates GSAP
   * animations. Tweens made outside `build`'s own call stack are not part of
   * the context and would survive the revert; wrapped ones are reverted with it.
   */
  contextSafe: <F extends (...args: never[]) => unknown>(handler: F) => F;
};

/**
 * The way to write a GSAP animation here (CLAUDE.md §8).
 *
 * - Everything created inside `build` (tweens, timelines, ScrollTriggers) is
 *   reverted when the component unmounts, when `dependencies` change, and when
 *   the reduced-motion preference flips: no ScrollTrigger outlives its page.
 * - `build` runs again with the new `reduced` value when the OS setting changes.
 * - Selector strings are scoped to `scope`.
 * - Animations created later, in event handlers, must go through
 *   `contextSafe(handler)` or they escape the revert.
 * - `build` may return a cleanup function. Use it for what GSAP cannot revert
 *   by itself, mainly event listeners and observers; it runs on the same three
 *   occasions as the revert.
 *
 * Contract for `build` when `reduced` is true: leave server-rendered content in
 * its final state, or use a fade of at most `reducedFade` seconds; no pinning,
 * scrubbing or looping.
 */
export function useMotion(
  // `void` in the union on purpose: most builds return nothing, and an
  // `undefined`-only type would force every one of them to say `return undefined`.
  // eslint-disable-next-line @typescript-eslint/no-invalid-void-type
  build: (context: MotionContext) => void | (() => void),
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
        (context, contextSafe) =>
          build({
            reduced: context.conditions?.reduced === true,
            contextSafe: <F extends (...args: never[]) => unknown>(
              handler: F,
            ) => (contextSafe ? contextSafe(handler) : handler) as F,
          }),
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
