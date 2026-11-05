import { gsap } from "@/lib/motion/gsap";
import {
  duration,
  ease,
  introOffset,
  reducedFade,
  revealOffset,
} from "@/lib/motion/tokens";

/**
 * Content is rendered on the server in its FINAL state; these helpers animate
 * it FROM an offset TO that state on the client, so nothing is hidden until
 * JavaScript runs (LCP, CLAUDE.md §8). Only `opacity` and `transform` move.
 * Call them inside `useMotion`.
 */

/**
 * Reveal one element when it scrolls into view (once).
 * Reduced motion: no tween, the element simply stays in its final state.
 */
export function revealOnScroll(
  element: Element,
  { reduced, start = "top 85%" }: { reduced: boolean; start?: string },
): gsap.core.Tween | undefined {
  if (reduced) return undefined;
  return gsap.from(element, {
    opacity: 0,
    y: revealOffset,
    duration: duration.reveal,
    ease: ease.out,
    scrollTrigger: { trigger: element, start, once: true },
  });
}

/**
 * The page's one signature entrance, played once on load.
 * Reduced motion: a short opacity fade, no movement.
 */
export function playIntro(
  targets: gsap.TweenTarget,
  { reduced }: { reduced: boolean },
): gsap.core.Tween {
  if (reduced) {
    return gsap.from(targets, {
      opacity: 0,
      duration: reducedFade,
      ease: ease.linear,
    });
  }
  return gsap.from(targets, {
    opacity: 0,
    y: introOffset,
    duration: duration.narrative,
    ease: ease.out,
    stagger: 0.08,
  });
}
