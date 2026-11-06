# MOTION.md — GSAP, ScrollTrigger and Lenis

Rules: CLAUDE.md §8 and docs/DESIGN.md §6 (this file is how they are implemented). Everything lives in `src/lib/motion/`.

## Pieces

| File | Role |
|---|---|
| `gsap.ts` | **The only place GSAP is imported from.** Registers `useGSAP`, `ScrollTrigger` and `CustomEase` once, creates the `ds-*` eases from the CSS bezier tokens, refreshes ScrollTrigger when fonts have loaded. No-op on the server |
| `tokens.ts` | Durations (seconds), bezier curves and ease names mirroring the CSS `--duration-*` / `--ease-*` tokens; `tokens.test.ts` fails if they drift |
| `use-reduced-motion.ts` | `useReducedMotion()`: follows the OS setting live; `false` on the server and during hydration |
| `use-motion.ts` | `useMotion(build, { scope })`: **how to write a GSAP animation here** (`build` may return a cleanup; `contextSafe` wraps handlers) |
| `use-media-query.ts`, `use-after-idle.ts` | Small hooks behind `useReducedMotion`, `LenisProvider` and the FX components (`useFxReady`) |
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
| FX library: markup, motion modules, contrast, code splitting | `src/components/fx/*.test.ts(x)` |
| FX library in a browser: no-JS, full, reduced, live switches, navigation leaks, touch, short viewport, axe in both themes, CLS | `e2e/fx.spec.ts` (against `next dev`) |
| FX code is absent from pages that do not use it | `e2e/fx-bundle.spec.ts` (production build) |

`window.__motionDebug` (`triggers()`, `pinSpacers()`, `lenis()`) exists only on dev-tools pages and is what the tests read.

## FX library (`src/components/fx/`, P1.6)

Six reusable effects, showcased at `/[locale]/_dev/fx` (dev only). Every one is static-first: the server renders the final state, and each has a fallback for no JavaScript and for reduced motion.

| Component | Needs JS | Under reduced motion | Without JS |
|---|---|---|---|
| `TextReveal` (headline) | `when="view"`: yes, lazy. `when="load"`: **no** (CSS) | plain headline; chunk never loads. `load`: the animation token is `none` | plain headline. `load` still animates (CSS) |
| `MagneticButton` | yes, lazy, mouse only | button stays put; chunk never loads | plain button |
| `SpotlightCard` | yes, lazy, mouse only | plain card; chunk never loads | plain card |
| `ScrollPinnedSection` | yes, lazy | stacked steps, nothing hidden or pinned | stacked steps |
| `Marquee` | **no** (CSS) | wrapped static list, no loop, no switch | still loops; the pause switch still works |
| `GradientMesh` | **no** (CSS) | blobs stand still | blobs drift (CSS) |

**How code splitting works.** A page that imports an FX component gets only a small wrapper (markup, a `ref`, `next/dynamic`). The animation code sits in `*.motion.tsx` next to it, which only the wrapper reaches through `next/dynamic(..., { ssr: false })`, and only after the browser is idle (`useFxReady`), never under reduced motion (and, for pointer effects, never on touch devices). Pages that do not import FX components get none of it: `e2e/fx-bundle.spec.ts` proves that on the production build, `fx-structure.test.ts` keeps wrappers from importing GSAP statically. `Marquee` and `GradientMesh` have no JavaScript at all.

**Writing a new FX:** copy the pair `x.tsx` + `x.motion.tsx`. The wrapper renders the final-state markup with a `ref`, calls `useFxReady()` and mounts `<XMotion scope={ref} />` when ready; the motion file calls `useMotion` and returns null.

**`useMotion` additions made for this:** `build` may return a cleanup function (event listeners, observers), and receives `contextSafe`: wrap any event handler that creates tweens (they are made after `build` returns, so without it they escape the revert and survive unmount or a preference flip).

Things worth knowing:

- **Hero headline (P2.2): `TextReveal when="load"`.** `view` skips a heading that is already on screen, so it could never animate a hero. `load` is CSS only (`--animate-word-rise` keyframes, a per-word `animation-delay`, 40 ms per word and 600 ms at most): the words are in the server HTML, nothing waits for JavaScript, the first word shows at once, and the reduced-motion block switches the token off.
- `TextReveal` (`when="view"`) only animates a headline that is still below the trigger line when its motion loads. One already on screen (or scrolled past, e.g. after Back) stays as rendered: hiding visible text to animate it in is a flash and would hurt LCP. A hero headline is `playIntro`'s job.
- `ScrollPinnedSection` does not pin when its content is taller than the viewport (reflow, WCAG 1.4.10). It checks once when its motion loads; it does not re-check on resize. Steps are text: a step that is still transparent is focusable, so put no links or controls in them.
- ScrollTrigger pins by moving the section into a spacer element. The wrapper keeps the section inside an unpinned `div` so React can remove it on its own (`fx-integration.test.tsx` covers the case that used to throw `NotFoundError`).
- `GradientMesh` and the `SpotlightCard` glow are translucent accent over text. Their strengths live in `fx-tokens.ts` and `fx-contrast.test.ts` proves 4.5:1 for every text colour in both themes. The mesh is capped at about 5 % per blob for that reason, so on a dark background it is subtle to the point of being easy to miss. Raising it fails the test.
- `Marquee` stretches each copy to at least the viewport width, so the loop never shows a gap, at the cost of wider spacing on wide screens. Items are plain text (the second copy is `aria-hidden`).
- `next dev` preloads dynamic chunks whatever the preference, so "the chunk is not downloaded under reduced motion" can only be observed on a production build; the dev e2e checks behaviour instead (no triggers, nothing hidden).

## Known limits

- The engine is about 47 KB transferred (119 KB raw), fetched after the browser is idle. Pages without scroll motion still download it; if that matters for a lightweight page, give `LenisProvider` an opt-out per route.
- CLS is measured as the plain sum of shifts without recent input, on one browser (Chromium), on a fast machine; it is not field data.
- Lenis is not used on touch devices by design. iOS Safari and Firefox are untested.
- GSAP's `matchMedia` ignores preference changes that arrive within 2 ms of each other (it reads `Date.now()`); real users never do that, tests must advance the clock.
