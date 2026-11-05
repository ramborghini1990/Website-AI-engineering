/**
 * Motion tokens for GSAP. The CSS source of truth is `src/app/globals.css`
 * (--duration-*, --ease-*, docs/DESIGN.md §6); GSAP needs numbers in seconds
 * and easing curves it can evaluate, so they are mirrored here and
 * `tokens.test.ts` fails if the two ever differ.
 */

/** Seconds. Same values as the CSS `--duration-*` tokens (milliseconds there). */
export const duration = {
  instant: 0.08,
  fast: 0.16,
  base: 0.28,
  slow: 0.48,
  reveal: 0.72,
  narrative: 1.1,
} as const;

/** Cubic-bezier control points, identical to the CSS `--ease-*` tokens. */
export const bezier = {
  standard: "0.2, 0, 0, 1",
  out: "0.16, 1, 0.3, 1",
  in: "0.7, 0, 0.84, 0",
  inOut: "0.65, 0, 0.35, 1",
} as const;

/** GSAP ease names. The curves are registered from `bezier` in ./gsap.ts. */
export const ease = {
  standard: "ds-standard",
  out: "ds-out",
  in: "ds-in",
  inOut: "ds-in-out",
  /** Scroll-scrubbed progress only. */
  linear: "none",
} as const;

/** Reveal offset in px: content animates FROM here TO its server-rendered position. */
export const revealOffset = 16;
/** Headings and the hero intro may travel a little further. */
export const introOffset = 24;

/** Reduced motion: an opacity fade no longer than this, or no animation at all. */
export const reducedFade = duration.fast;
