# MOTION.md — GSAP, ScrollTrigger and Lenis

Rules: CLAUDE.md §8 and docs/DESIGN.md §6 (this file is how they are implemented). Everything lives in `src/lib/motion/`.

## Pieces

| File | Role |
|---|---|
| `gsap.ts` | **The only place GSAP is imported from.** Registers `useGSAP`, `ScrollTrigger` and `CustomEase` once, creates the `ds-*` eases from the CSS bezier tokens, refreshes ScrollTrigger when fonts have loaded. No-op on the server |
| `tokens.ts` | Durations (seconds), bezier curves and ease names mirroring the CSS `--duration-*` / `--ease-*` tokens; `tokens.test.ts` fails if they drift |
| `use-reduced-motion.ts` | `useReducedMotion()`: follows the OS setting live; `false` on the server and during hydration |
| `use-motion.ts` | `useMotion(build, { scope })`: **how to write a GSAP animation here** |
| `reveal.ts` | `revealOnScroll`, `playIntro`: reveal helpers (FROM an offset TO the server-rendered state) |
| `lenis-provider.tsx` | `LenisProvider`, mounted once in `[locale]/layout.tsx`. Loads the engine after idle; never under reduced motion |
| `lenis-runtime.tsx` | The engine (GSAP + Lenis), lazy-loaded by the provider |

## One loop

`Lenis` runs with `autoRaf: false`. `gsap.ticker` calls `lenis.raf(time * 1000)` and `ScrollTrigger.update()` runs on every Lenis `scroll` event. Never create a second Lenis instance or your own `requestAnimationFrame` loop. Touch scrolling stays native (`syncTouch: false`). Lenis is paused while a Radix dialog, sheet or select locks the page (`data-scroll-locked` on `<body>`); scrollable overlays carry `data-lenis-prevent`.

## Writing a motion component

```tsx
"use client";
import { gsap } from "@/lib/motion/gsap";
import { revealOnScroll } from "@/lib/motion/reveal";
import { useMotion } from "@/lib/motion/use-motion";

export function Features() {
  const scope = useRef<HTMLElement>(null);

  useMotion(({ reduced }) => {
    for (const el of gsap.utils.toArray<HTMLElement>(".feature")) {
      revealOnScroll(el, { reduced });
    }
    if (reduced) return; // no pinned or scrubbed scene
    // ... timelines with scrollTrigger go here
  }, { scope });

  return <section ref={scope}>...</section>;
}
```

- Create **everything** inside `useMotion`. It reverts tweens, timelines and ScrollTriggers on unmount, when `dependencies` change and when the reduced-motion preference flips (and rebuilds with the new value). A ScrollTrigger created anywhere else will leak.
- Render content on the server in its **final state**; animate FROM an offset. Nothing may be hidden until JavaScript runs.
- Animate `transform` and `opacity` only. Never `width`, `height`, `top`, `left`.
- **Reduced motion contract** (`reduced === true`): leave the final state, or an opacity fade of at most `reducedFade` (0.16 s). No pinning, scrubbing, parallax or looping.
- At most one pinned section per viewport. GSAP and `motion` never touch the same element.

## Layout shift

Lenis adds a `lenis` class to `<html>`. Upstream's stylesheet sets `html.lenis, html.lenis body { height: auto }`; with the original `h-full` layout that changed the document height after load and measured **CLS 0.062** (over the 0.05 budget). The layout therefore uses `min-h-dvh` on `<body>` (no height on `<html>`) and the rule is not copied. Do not reintroduce a height on `html`/`body` that depends on that class.

## Testing

| What | Where |
|---|---|
| Registration, tokens, hook, `useMotion`, reveal helpers, provider, runtime (single loop, StrictMode, scroll lock, route refresh) | `src/lib/motion/*.test.ts(x)` |
| Dev test page (intro, 6 reveals, 1 pinned scene) | `/[locale]/_dev/motion` (dev only, 404 in production) |
| Full motion, reduced motion, live preference switches, exact ScrollTrigger and pin counts across navigations, CLS, scroll lock | `e2e/motion.spec.ts` (against `next dev`) |
| Engine is lazy and absent under reduced motion, CLS on real pages | `e2e/scroll.spec.ts` (production build) |

`window.__motionDebug` (`triggers()`, `pinSpacers()`, `lenis()`) exists only on dev-tools pages and is what the tests read.

## Known limits

- The engine is about 47 KB transferred (119 KB raw), fetched after the browser is idle. Pages without scroll motion still download it; if that matters for a lightweight page, give `LenisProvider` an opt-out per route.
- CLS is measured as the plain sum of shifts without recent input, on one browser (Chromium), on a fast machine; it is not field data.
- Lenis is not used on touch devices by design. iOS Safari and Firefox are untested.
- GSAP's `matchMedia` ignores preference changes that arrive within 2 ms of each other (it reads `Date.now()`); real users never do that, tests must advance the clock.
