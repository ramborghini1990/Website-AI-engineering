---
paths:
  - "src/components/**"
  - "src/app/**/*.tsx"
  - "src/app/**/*.css"
  - "src/lib/motion/**"
  - "e2e/**"
---

# UI rules: styling, motion, accessibility

Loaded when you work on components, pages, styles, motion or e2e specs. As binding as CLAUDE.md.
For deeper guidance, Grep `docs/DESIGN.md` / `docs/MOTION.md` for the relevant heading and Read only that section.

## Styling & design

- Use design tokens from `src/app/globals.css` (`@theme`). **No raw hex/rgb, no arbitrary pixel values** in components unless a token cannot express it (then leave a comment).
- Tailwind class order is enforced by Prettier. Variants with `cva`, merge with `cn()` (`clsx` + `tailwind-merge`).
- Mobile-first. Check 360, 768, 1280 and 1920 px widths.
- Typography: max 2 families, fluid `clamp()` scale tokens, body ≥ 16 px, line length 60–75ch.
- Icons: `lucide-react` SVGs. No emoji as icons.
- Dark-first with a full light theme; both meet contrast (text 4.5:1, large text and UI 3:1).
- No generic "AI template" aesthetics (default purple gradients on white, uniform rounded cards, centred-everything). Follow `docs/DESIGN.md`.
- Every user-facing string goes through `next-intl` messages or locale MDX; no hard-coded copy in components.

## Motion (GSAP, ScrollTrigger, Lenis)

- Register GSAP plugins once in `src/lib/motion/gsap.ts`. `useGSAP()` with a `scope` ref so tweens and ScrollTriggers revert on unmount.
- One `LenisProvider` driven by `gsap.ticker`; ScrollTrigger updated on Lenis `scroll`. Never a second scroll loop.
- Animate only `transform` and `opacity` (`clip-path`/filters sparingly). Never `width`, `height`, `top`, `left` or layout properties.
- `prefers-reduced-motion: reduce` → Lenis off, scroll-linked timelines become instant states or short fades, autoplay loops paused. Every motion component implements this.
- Content readable without JS: server-render final state, animate *from* an offset on the client; no hidden-until-hydrated content.
- Pin at most one section per viewport. `ScrollTrigger.refresh()` after layout-changing fonts/images load.
- Never GSAP and `motion` on the same element.

## Accessibility

- Semantic HTML first; ARIA only when no native element fits. One `h1` per page, ordered headings.
- Keyboard-reachable with a visible `focus-visible` ring. Hit targets ≥ 44×44 px.
- Images: meaningful `alt` or `alt=""` for decoration; `next/image` with explicit sizes.
- Forms: visible labels, errors via `aria-describedby`, error summary on submit, no placeholder-only labels.
- Every new page or component gets an axe check in Playwright.
