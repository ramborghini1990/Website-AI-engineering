# DESIGN.md — design direction and system

**Status: APPROVED as proposed on 2026-11-05** (ROADMAP P1.1 acceptance: "DESIGN.md approved by you; contrast pairs ≥ 4.5:1 documented"): Signal amber accent, Instrument Sans + JetBrains Mono, dark-first instrument-panel direction, sharp radii. The decisions that were open are kept in §11 for the record. This file is the design authority (CLAUDE.md §7); design-skill or 21st output is advice only.

Scope of P1.1: direction and tokens as values. Nothing here is implemented yet. P1.2 turns §2–§6 into `@theme` tokens in `src/app/globals.css` and loads the fonts; P1.5/P1.6 implement the motion system and FX components.

How the numbers were produced: every colour pair below was computed with the WCAG 2.x relative-luminance formula on the exact sRGB hex values (not estimated by eye). Since P1.2 they are re-proved on every `pnpm test` by `src/app/globals.test.ts`, which reads the real tokens from `globals.css` and also compares the §2.1 table below with them, so this document cannot drift from the code.

---

## 1. Identity

**Who it is for:** founders, CTOs and operations leads at startups, SMEs and enterprises in Italy and the EU who are about to trust an engineering practice with agents, automation and production software.

**What it must feel like:** a precise, calm engineering instrument. Premium because it is exact, not because it is shiny. Italian craft, not Silicon Valley template. Dark-first, with a complete light theme.

**Concept, "the instrument panel":** the site behaves like well-made lab equipment. Hairline rules, indexed mono labels (`01 / Agenti`), tabular numerals for metrics, status dots, and one lit indicator colour. Content sits on a quiet ink-coloured field; the accent is used the way an indicator lamp is used, to say "look here".

**Principles**

1. **Instrument, not ornament.** Every visual element carries information: an index, a status, a measurement, a diagram. Decoration that carries none is removed.
2. **One light source.** One accent hue ("Signal", warm amber). Everything else is neutral. Never two competing accents.
3. **Left-anchored, asymmetric layouts.** Editorial grids with a marginal rail; headings and body start on a shared left edge. Centre alignment is the exception (final CTA, 404).
4. **Motion with meaning.** Motion explains sequence, cause or state, and respects the rules in §6. One signature motion per viewport.
5. **Proof over promise.** Real demos, real diagrams, real metrics (only with `clientConsent: true`, CLAUDE.md §12). No stock photography.
6. **Accessible by construction.** WCAG 2.2 AA is a design input, not an audit at the end.

---

## 2. Colour

Names: **Ink** (dark neutrals), **Bone** (warm off-white text and light surfaces), **Signal** (accent), **Trace** (cool secondary for data and information). Hex values are sRGB; P1.2 may store them as `oklch()` provided the sRGB result is unchanged.

Dark is the design baseline; light is a complete theme, not an inversion.

### 2.1 Semantic tokens

| Token | Dark | Light | Used for |
|---|---|---|---|
| `bg` | `#0B0D10` | `#F6F4EE` | page canvas |
| `surface-1` | `#11141A` | `#FBFAF6` | sections, cards |
| `surface-2` | `#171B22` | `#EEEBE2` | inputs, raised blocks |
| `surface-3` | `#1F242D` | `#E4E0D4` | hover, selected, code blocks |
| `border-subtle` | `#262C36` | `#D6D1C3` | decorative hairlines and dividers only |
| `border-strong` | `#6B7482` | `#6B7280` | control boundaries (inputs, checkboxes, toggles) |
| `text` | `#F2EFE8` | `#12151A` | headings, body |
| `text-secondary` | `#B7BCC6` | `#414852` | supporting copy |
| `text-muted` | `#8F96A3` | `#59606B` | captions, placeholders-as-hint, metadata |
| `accent` | `#FFB347` | `#9C4700` | links, icons, focus ring, primary button fill |
| `accent-hover` | `#FFC470` | `#7F3A00` | hover/active of the above |
| `on-accent` | `#0B0D10` | `#FBFAF6` | label on an accent-filled button |
| `trace` | `#6CCBDB` | `#00677A` | informational text, chart series 2 |
| `success` | `#5FD38D` | `#0E6B39` | success text and icons |
| `warning` | `#F2D14B` | `#7A5600` | warning text and icons |
| `danger` | `#FF7B72` | `#B3261E` | error text and icons |
| `focus` | `#FFB347` | `#9C4700` | focus ring (same hue as `accent`) |

Rules:

- Components consume **semantic** tokens only. No raw hex or `rgb()` in components (CLAUDE.md §7); a palette step is never referenced directly.
- Light and dark `accent` are different colours on purpose: bright amber carries on ink, but on paper it would fail text contrast, so the light theme uses the same hue in a deep burnt orange.
- `border-subtle` is decorative. It is intentionally low contrast and must never be the only cue for an interactive boundary; use `border-strong`.
- Status colours are always paired with an icon and text. Colour is never the only signal.
- No gradients across hues. Allowed: ink-to-ink-lighter vignettes, and one soft radial `accent` glow at ≤ 12 % opacity behind the hero (decorative, static fallback).
- Data visualisation (P3.4): series 1 `accent`, series 2 `trace`, further series use luminance and pattern differences, never new hues. Every chart has a table fallback.

### 2.2 Contrast, dark theme

| Pair | Ratio | Needs | Result |
|---|---|---|---|
| `text` on `bg` | 16.94 : 1 | 4.5 | pass |
| `text` on `surface-1` / `-2` / `-3` | 16.06 / 15.04 / 13.56 : 1 | 4.5 | pass |
| `text-secondary` on `bg` / `surface-1` / `-2` / `-3` | 10.21 / 9.68 / 9.06 / 8.17 : 1 | 4.5 | pass |
| `text-muted` on `bg` / `surface-1` / `-2` / `-3` | 6.54 / 6.20 / 5.80 / 5.23 : 1 | 4.5 | pass |
| `accent` on `bg` / `surface-1` / `-2` / `-3` | 10.92 / 10.35 / 9.69 / 8.74 : 1 | 4.5 | pass |
| `accent-hover` on `bg` | 12.40 : 1 | 4.5 | pass |
| `on-accent` on `accent` (button label) | 10.92 : 1 | 4.5 | pass |
| `on-accent` on `accent-hover` | 12.40 : 1 | 4.5 | pass |
| `trace` on `bg` / `surface-2` | 10.38 / 9.21 : 1 | 4.5 | pass |
| `success` on `bg` / `surface-2` | 10.37 / 9.20 : 1 | 4.5 | pass |
| `warning` on `bg` / `surface-2` | 12.97 / 11.51 : 1 | 4.5 | pass |
| `danger` on `bg` / `surface-2` | 7.72 / 6.85 : 1 | 4.5 | pass |
| `border-strong` on `bg` / `surface-1` / `surface-2` | 4.12 / 3.90 / 3.66 : 1 | 3 (UI) | pass |
| `focus` on `bg` / `surface-2` | 10.92 / 9.69 : 1 | 3 (UI) | pass |
| `accent` fill vs `bg` (button boundary) | 10.92 : 1 | 3 (UI) | pass |

### 2.3 Contrast, light theme

| Pair | Ratio | Needs | Result |
|---|---|---|---|
| `text` on `bg` | 16.63 : 1 | 4.5 | pass |
| `text` on `surface-1` / `-2` / `-3` | 17.52 / 15.35 / 13.86 : 1 | 4.5 | pass |
| `text-secondary` on `bg` / `surface-1` / `-2` / `-3` | 8.40 / 8.84 / 7.75 / 7.00 : 1 | 4.5 | pass |
| `text-muted` on `bg` / `surface-1` / `-2` / `-3` | 5.77 / 6.07 / 5.32 / 4.81 : 1 | 4.5 | pass |
| `accent` on `bg` / `surface-1` / `-2` / `-3` | 5.76 / 6.07 / 5.31 / 4.80 : 1 | 4.5 | pass |
| `accent-hover` on `bg` | 7.61 : 1 | 4.5 | pass |
| `on-accent` on `accent` (button label) | 6.07 : 1 | 4.5 | pass |
| `on-accent` on `accent-hover` | 8.02 : 1 | 4.5 | pass |
| `trace` on `bg` / `surface-2` | 5.93 / 5.47 : 1 | 4.5 | pass |
| `success` on `bg` / `surface-2` | 6.00 / 5.54 : 1 | 4.5 | pass |
| `warning` on `bg` / `surface-2` | 6.04 / 5.58 : 1 | 4.5 | pass |
| `danger` on `bg` / `surface-2` | 5.94 / 5.48 : 1 | 4.5 | pass |
| `border-strong` on `bg` / `surface-1` / `surface-2` | 4.40 / 4.63 / 4.06 : 1 | 3 (UI) | pass |
| `focus` on `bg` / `surface-2` | 5.76 / 5.31 : 1 | 3 (UI) | pass |
| `accent` fill vs `bg` (button boundary) | 5.76 : 1 | 3 (UI) | pass |

Known limits, stated so nobody is surprised:

- Thin margin: `text-muted` and `accent` on `surface-3` in the light theme are only 4.81 and 4.80 : 1. They pass, but with almost no margin, so do not use anything dimmer than `text-muted` on that surface and do not tweak these colours without recomputing.
- `border-subtle` is 1.31–1.46 : 1 against its backgrounds by design (decorative hairline, exempt from WCAG 1.4.11 because it is not needed to identify a control).
- Surface steps differ by only 1.05–1.25 : 1 from `bg`. Elevation is communicated by a hairline border as well, never by fill alone.
- Disabled controls are exempt from contrast rules but must still be distinguishable and carry `aria-disabled` or `disabled`; never hide meaning in a disabled state.
- Text over images or the hero glow is not covered by this table. Any such text must be re-checked on the worst-case pixel and sit on a solid or scrimmed layer.

---

## 3. Typography

Two families, both open-licence (SIL OFL) and available through `next/font/google`, which downloads at build time and serves from our own domain. No request goes to Google at runtime (BLUEPRINT §2, CLAUDE.md §5 "no font CDN"). Confirmed present in Next 16.4.5's bundled font data on 2026-11-05.

| Role | Family | Axes available | Subsets |
|---|---|---|---|
| Sans (headings, body, UI) | **Instrument Sans** | `wght` 400–700, `wdth` 75–100 | `latin`, `latin-ext` |
| Mono (eyebrows, index labels, metrics, code) | **JetBrains Mono** | `wght` 100–800 | `latin` (+ `latin-ext` if needed) |

Italian needs only Latin glyphs (à è é ì ò ù, €); `latin` covers them.

- Headings use Instrument Sans at weight 600 and, for display sizes, a slightly condensed width (`wdth` ≈ 90) to get a tight, engineered look. `wdth` must be requested in the `next/font` axes or it is not loaded.
- Mono is for **short** strings only (labels, numbers, code): uppercase eyebrows at the `xs` step with `letter-spacing: 0.06em`. Never body copy.
- Numerals in tables and metrics: `font-variant-numeric: tabular-nums`.
- Load only the weights and axes used; **`display: optional`** (changed in P2.2, was `swap`): headings use the condensed width of the variable font, which the fallback cannot match, so a font arriving after the first paint re-flowed the hero headline (three lines to two) and measured CLS 0.26 on a slow first visit. With `optional` the font is used only if it is ready almost at once (it is preloaded and self-hosted); otherwise that page view keeps the fallback and the font is cached for the next one. The trade-off: on a slow first visit the page is set in the fallback font. `e2e/home.spec.ts` ("a late web font") guards it.

### 3.1 Fluid scale

Viewport range 360 → 1440 px, interpolated linearly. Body is 16 px at 360 and 18 px at 1440 (CLAUDE.md §7: body ≥ 16 px). The largest step grows 1.82× across the range, well below the commonly used ~2.5× rule of thumb for fluid type that must still scale with browser zoom (WCAG 1.4.4); P1.5 or the first page build should confirm 200 % zoom in Playwright.

| Token | Size (360 → 1440) | `clamp()` | Line height | Tracking | Use |
|---|---|---|---|---|---|
| `text-xs` | 12 → 13 px | `clamp(0.75rem, 0.7292rem + 0.0926vw, 0.8125rem)` | 1.4 | +0.06em | mono eyebrows, index labels, legal footnotes |
| `text-sm` | 14 → 15 px | `clamp(0.875rem, 0.8542rem + 0.0926vw, 0.9375rem)` | 1.5 | 0 | captions, helper text, table cells |
| `text-base` | 16 → 18 px | `clamp(1rem, 0.9583rem + 0.1852vw, 1.125rem)` | 1.6 | 0 | body |
| `text-lg` | 18 → 21 px | `clamp(1.125rem, 1.0625rem + 0.2778vw, 1.3125rem)` | 1.5 | 0 | lead paragraph |
| `text-xl` | 21 → 26 px | `clamp(1.3125rem, 1.2083rem + 0.4630vw, 1.625rem)` | 1.35 | −0.005em | h4, card titles |
| `text-2xl` | 25 → 33 px | `clamp(1.5625rem, 1.3958rem + 0.7407vw, 2.0625rem)` | 1.25 | −0.01em | h3 |
| `text-3xl` | 30 → 42 px | `clamp(1.875rem, 1.625rem + 1.1111vw, 2.625rem)` | 1.15 | −0.015em | h2 |
| `text-4xl` | 36 → 56 px | `clamp(2.25rem, 1.8333rem + 1.8519vw, 3.5rem)` | 1.08 | −0.02em | h1 on inner pages |
| `text-5xl` | 44 → 80 px | `clamp(2.75rem, 2rem + 3.3333vw, 5rem)` | 1.02 | −0.03em | home hero / display |

Rules:

- Body copy measure **60–75 characters** (`max-width: 65ch`). Headings may be wider but wrap with `text-wrap: balance`; paragraphs use `text-wrap: pretty`.
- `xs` and `sm` are for secondary content only. Interactive text, form inputs and body copy are never below 16 px (inputs also avoid iOS zoom-on-focus).
- One `h1` per page; heading levels in order (CLAUDE.md §9); visual size is chosen with the token, semantics with the element.
- Italian runs ~15–25 % longer than English. Design every heading and button for the Italian string first, and test with the longest.

---

## 4. Spacing, layout and rhythm

- **Base unit 4 px** (Tailwind v4 `--spacing: 0.25rem`), working rhythm **8 px**. Component padding and gaps come from `1 · 2 · 3 · 4 · 6 · 8 · 12 · 16 · 24 · 32` (4, 8, 12, 16, 24, 32, 48, 64, 96, 128 px). No arbitrary pixel values (CLAUDE.md §7).
- **Section rhythm:** vertical padding between page sections `clamp(4rem, 3rem + 5vw, 8rem)` (64 → 128 px). Inside a section, blocks are separated by 48 or 64 px, never by an arbitrary mix.
- **Gutter:** `clamp(1rem, 0.5rem + 2.2vw, 2.5rem)`; also the column gap.
- **Container:** max width `80rem` (1280 px), centred, with the gutter as side padding. Prose blocks cap at `65ch`.
- **Grid:** 4 columns under 768 px, 8 at 768, 12 from 1024. Editorial pages anchor headings in columns 1–7 and use columns 9–12 as a marginal rail for index labels, metrics and secondary notes. Wide breakpoints enlarge the margins, not the line length.
- **Breakpoints:** Tailwind defaults (640, 768, 1024, 1280, 1536). Design and test at **360, 768, 1280 and 1920 px** (CLAUDE.md §7).
- **Hit targets:** at least 44 × 44 px for every interactive element (CLAUDE.md §9; WCAG 2.2 AA itself only requires 24 × 24 px, so this is stricter on purpose), with at least 8 px between adjacent targets.
- **Layers (z-index):** base 0 · sticky header 10 · popover 40 · modal and sheet 50 · toast 60. No other values.

---

## 5. Radii, borders and elevation

Restraint on purpose. Uniform rounded cards everywhere is the template look this site avoids (CLAUDE.md §7).

| Token | Value | Used for |
|---|---|---|
| `radius-none` | 0 | dividers, table rows, full-bleed bands |
| `radius-xs` | 2 px | cards and content panels (they are defined by a hairline border, not by roundness) |
| `radius-sm` | 4 px | buttons, inputs, selects, tabs |
| `radius-md` | 8 px | popovers, dialogs, sheets, code blocks |
| `radius-full` | 9999 px | status dots, avatars, pills used as tags only |

Borders: 1 px, `border-subtle` for layout, `border-strong` for controls. Prefer a hairline rule plus whitespace to a boxed card; at most one card style per page region.

Elevation in the dark theme is communicated with surface steps plus a hairline, not with shadows. Shadows exist only for things that float above the page:

| Token | Dark | Light | Used for |
|---|---|---|---|
| `shadow-none` | none | none | everything in the flow |
| `shadow-popover` | `0 8px 24px -8px rgb(0 0 0 / 0.60)` | `0 1px 0 rgb(18 21 26 / 0.04), 0 8px 24px -12px rgb(18 21 26 / 0.18)` | menus, tooltips, popovers |
| `shadow-modal` | `0 24px 64px -16px rgb(0 0 0 / 0.70)` | `0 24px 64px -20px rgb(18 21 26 / 0.28)` | dialogs and sheets, over a scrim |
| `glow-accent` | `0 0 0 1px rgb(255 179 71 / 0.40), 0 0 32px -8px rgb(255 179 71 / 0.35)` | not used | hero indicator and one featured demo only |

Raw `rgb()` is acceptable inside these shadow tokens (they cannot be expressed as a single colour token); components still reference the shadow token, not the values.

---

## 6. Motion

Implemented in P1.5 (Lenis, GSAP, ScrollTrigger, reduced motion, cleanup): see [MOTION.md](MOTION.md). The values below exist twice, as CSS tokens in `globals.css` and as GSAP tokens in `src/lib/motion/tokens.ts`; a test keeps them identical.

Principles (CLAUDE.md §8 governs; this section sets the values):

- Animate **`transform` and `opacity`** only (`clip-path` and filters sparingly). Never `width`, `height`, `top`, `left`.
- Server-render content in its final state; the client animates **from** an offset to it. Nothing is hidden until hydration (LCP).
- One signature motion per viewport. At most one pinned section per viewport.
- Motion must explain something: sequence, hierarchy, cause and effect, or state change. If removing it loses nothing, remove it.
- GSAP and `motion` never touch the same element.

### 6.1 Duration tokens

| Token | Value | Use |
|---|---|---|
| `duration-instant` | 80 ms | pressed state, toggles, checkbox tick |
| `duration-fast` | 160 ms | hover, focus, small colour/opacity changes |
| `duration-base` | 280 ms | menus, tooltips, tabs, accordion |
| `duration-slow` | 480 ms | dialogs, sheets, route-level fades |
| `duration-reveal` | 720 ms | scroll reveals of headings and blocks |
| `duration-narrative` | 1100 ms | the hero intro only, once per session |

### 6.2 Easing tokens

| Token | CSS | Nearest GSAP ease | Use |
|---|---|---|---|
| `ease-standard` | `cubic-bezier(0.2, 0, 0, 1)` | `power3.out` | most UI transitions |
| `ease-out` | `cubic-bezier(0.16, 1, 0.3, 1)` | `expo.out` | entrances and reveals (fast start, long settle) |
| `ease-in` | `cubic-bezier(0.7, 0, 0.84, 0)` | `power3.in` | exits and dismissals |
| `ease-in-out` | `cubic-bezier(0.65, 0, 0.35, 1)` | `power3.inOut` | position morphs, pinned-section transitions |
| `ease-linear` | `linear` | `none` | scroll-scrubbed progress only |

The GSAP column names the closest built-in ease; if exact curve parity is needed later, register the bezier as a `CustomEase` in `src/lib/motion/gsap.ts`.

### 6.3 Patterns

- **Reveal:** translate `Y +16 px → 0` (headings may use +24 px) with opacity `0 → 1`, `duration-reveal`, `ease-out`. Stagger list items by 40 ms and headline lines by 80 ms; total stagger never exceeds 600 ms.
- **Hover/press:** colour and opacity only, `duration-fast`; pressed state `scale(0.98)` at `duration-instant`.
- **Dialogs and sheets:** opacity plus 8 px translate, `duration-slow`, `ease-out` in and `ease-in` out. Exits are about 30 % shorter than entrances.
- **Smooth scroll (Lenis):** a single instance, driven by `gsap.ticker`. It adds inertia, never changes scroll length or hijacks keyboard and anchor navigation.
- **Pinned story section (home process timeline, P2.2):** the only scroll-linked scene; uses `ease-linear` for scrubbing and `ease-in-out` between steps.
- **Magnetic buttons, spotlight cards, marquee, gradient mesh, text reveal, pinned section (P1.6):** implemented in `src/components/fx/` (see [MOTION.md](MOTION.md)); decorative; each has a static fallback and none carries meaning that is unavailable elsewhere. Translucent layers (mesh, spotlight glow) are capped so text keeps 4.5 : 1, which makes the mesh very subtle.

### 6.4 Reduced motion (mandatory for every motion component)

When `prefers-reduced-motion: reduce`:

- Lenis is disabled and native scrolling is used.
- Scroll-linked timelines become instant end states or a ≤ 160 ms opacity fade; no parallax, no pinned scenes.
- Autoplaying loops, marquees and shader/mesh backgrounds are paused or replaced by a static frame.
- Reveals become a ≤ 160 ms opacity fade, or nothing.
- Essential information stays visible; nothing relies on motion to be understood.

---

## 7. Components, imagery and icons

- **Buttons:** primary = `accent` fill with `on-accent` label, 44 px minimum height, `radius-sm`; secondary = transparent with `border-strong`; tertiary = text with an `accent` underline. One primary action per view region.
- **Links in prose:** underlined, `accent` colour. Underline is never removed on hover.
- **Focus:** 2 px `focus` outline with 2 px offset on every interactive element (`:focus-visible`), never removed. Contrast is in §2.2–§2.3.
- **Forms:** visible labels above fields, `surface-2` field, `border-strong` boundary, errors in `danger` with an icon and linked by `aria-describedby`, plus an error summary on submit (CLAUDE.md §9).
- **Cards:** hairline `border-subtle`, `radius-xs`, no shadow. Prefer ledger-style rows (index, title, one-line outcome, arrow) to grids of identical boxes.
- **Index labels:** mono `xs` uppercase, `text-muted`, form `NN / Label`. They are decoration plus orientation: always `aria-hidden` when they repeat nearby text.
- **Icons:** `lucide-react` SVGs, 1.5 px stroke, 20 or 24 px, `currentColor`; decorative icons `aria-hidden`. No emoji as icons.
- **Imagery:** no stock photography. Use architecture and workflow diagrams (SVG), real product/demo UI, and abstract technical visuals built from the hairline grid. Every informative image has a meaningful `alt`; decorative ones `alt=""`; `next/image` with explicit `sizes`.
- **Hero visual (concept):** a faint hairline grid on `bg`, with a single `accent` indicator (a caret, scan line or status dot) tied to the kinetic headline. It is static under reduced motion.
- **Logos and client names:** only with `clientConsent: true`.

---

## 8. Themes

- **Baseline is dark.** First visit with no stored choice follows `prefers-color-scheme`; when the system expresses no preference, dark is used.
- The theme is selected by a class on `<html>` (`dark` / `light`) with `color-scheme` set accordingly so native controls and scrollbars match.
- **Implemented in P1.8.** A three-way switch (automatic, dark, light) sits in the header: native radio buttons in a fieldset (so the group, arrow keys and selected state come from the browser), 44 px icon options with screen-reader labels, the selected one filled so it is not colour alone; disabled until hydrated because a choice cannot be applied without JavaScript.
- **Storage:** one `localStorage` key, `theme` (`src/lib/theme.ts`), written only when the visitor picks dark or light and removed when they pick automatic. It is a functional preference set by the visitor's own action and **must appear in the storage table of the cookie policy (P4.2)**.
- **No flash:** a 200-character inline script in `<head>` applies the stored class before first paint. It carries the CSP nonce (the root layout reads it from the request) and `<html>` has `suppressHydrationWarning`. Switching language remounts the root layout and replaces `<html>`, so `ThemeSync` (a layout effect, before paint) puts the stored class back; an e2e test found that bug.
- Both themes must pass §2.2–§2.3. Forced-colors mode (Windows high contrast) must stay usable: keep borders and focus rings as real `border`/`outline`, not shadows only.

---

## 8b. Layout shell (P1.8)

Every page is rendered inside one shell, owned by `src/app/[locale]/layout.tsx`:

1. **Skip link** (first tab stop, hidden until focused, 44 px, targets `#main-content`; works without JavaScript).
2. **Header** (`src/components/shell/site-header.tsx`): wordmark, main navigation, theme switch, language switcher, primary call to action, in that order in the document and on screen. One wrapping row: three rows at 360 px, one row from `lg`. Not sticky (a sticky bar would cover focused elements, WCAG 2.2 2.4.11, and the FX pinned scenes).
3. **`<main id="main-content" tabindex="-1">`**: the only `main` landmark. Pages render a `div`, never a `main`.
4. **Footer** (`site-footer.tsx`): contact block (the call to action's anchor, `#contact`), then the owner and the statutory details from `src/lib/business.ts`; a muted "not yet available" for anything not registered yet (docs/IDENTITY.md).
5. **Providers:** `TooltipProvider`, `LenisProvider`, and one `Toaster` with translated labels.

Navigation is data (`src/lib/navigation.ts`): an item appears only when its page exists, so the header never links to a 404. Until the P2.x pages exist, the navigation shows Home only; flip `available` when a page ships. With more than about five items, replace the wrapping row with a menu (Sheet).

## 9. Do and don't

**Do**

- Start from the Italian copy and the 360 px layout; scale up.
- Use `accent` for one thing at a time: the primary action, the active state, the lit indicator.
- Use whitespace and hairlines to group; align to the left edge and the 12-column grid.
- Show real outputs: terminal blocks, trace logs, step lists, diagrams, metrics with units.
- Give every motion a static equivalent; test with reduced motion on.
- Check any new colour pair with the contrast script before it enters the tokens.

**Don't**

- No purple or blue-purple gradients, no gradient text, no glassmorphism blobs, no neon glow outside the one allowed `glow-accent`.
- No grid of identical rounded cards with icon, title and two lines of grey text.
- No centred-everything layouts; no centred paragraphs over three lines.
- No stock photos, no AI-generated faces, no emoji as icons, no fake logos or testimonials.
- No raw hex/`rgb()` or arbitrary pixel values in components; no second accent colour.
- Don't animate layout properties; don't autoplay anything with sound; don't hide content until JavaScript runs.
- Don't convey status by colour alone; don't remove focus outlines; don't make targets smaller than 44 × 44 px.
- Don't put mono type in paragraphs, and don't set body text below 16 px.

---

## 10. Hand-off to P1.2 and later tasks

- **Implemented in P1.2** (`src/app/globals.css`). Token names as built: `--color-bg`, `--color-surface-1…3`, `--color-border-subtle`, `--color-border-strong`, `--color-text`, `--color-text-secondary`, `--color-text-muted`, `--color-accent`, `--color-accent-hover`, `--color-on-accent`, `--color-trace`, `--color-success`, `--color-warning`, `--color-danger`, `--color-focus`; `--font-sans`, `--font-mono`; `--text-xs…5xl` with `--text-*--line-height` and `--text-*--letter-spacing`; `--radius-none|xs|sm|md|full`; `--duration-*`; `--ease-*`; `--z-*`. Tailwind's namespaces forced three names: the section rhythm, gutter and container are `--spacing-section`, `--spacing-gutter` and `--container-page` (utilities `py-section`, `gap-gutter`, `max-w-page`).
- **Shadows are not `@theme` entries.** Tailwind inlines theme shadow values at build time, which froze the dark value and ignored the light override. They are plain variables (`--shadow-popover`, `--shadow-modal`, `--shadow-glow-accent`) exposed through `@utility shadow-popover|modal|glow-accent`.
- **Default scales are cleared** (`--color-*`, `--radius-*`, `--shadow-*`, `--text-*`, `--font-*`, `--ease-*` set to `initial`). Only design tokens exist; a leftover `bg-zinc-50` or `text-white` generates no CSS.
- **Theme switching:** dark values are the baseline; `:root.light` forces light, `:root.dark` forces dark; with no class, `prefers-color-scheme: light` applies the same light values (that block must stay identical to `:root.light`, which the test enforces). The `dark:` Tailwind variant follows the same rule and is only for assets that cannot use tokens, such as the black SVG logos.
- **Contrast guard (done):** `src/app/globals.test.ts` parses the real tokens and asserts every pair in §2.2–§2.3 (≥ 4.5 : 1 text, ≥ 3 : 1 control boundaries and focus), compares the §2.1 table with the CSS, and has negative cases.
- **No-raw-colour guard (done):** `src/no-raw-colors.test.ts` runs in `pnpm verify`; it rejects hex, `rgb()`/`hsl()`/`oklch()` and default-palette classes anywhere in `src` except `globals.css` and tests.
- **Fonts (done):** `next/font/google` for Instrument Sans (axes `wght`, `wdth`; the `wdth` axis is confirmed in the generated `@font-face`) and JetBrains Mono, `display: 'swap'`, exposed as `--font-instrument-sans` and `--font-jetbrains-mono`. Playwright asserts that no request leaves our origin.
- **Page language and metadata** (`lang="en"` and the "Create Next App" title in the scaffold) belong to P1.4 / P2.1.
- Record anything copied from React Bits or 21st in `docs/THIRD_PARTY.md` (CLAUDE.md §5).

---

## 11. Decisions for you (approval gate)

1. **Accent hue:** Signal amber. Alternatives I rejected: electric blue/violet (the default "AI" look), acid lime (terminal cliché), teal (competes with `trace`). Say if you prefer another hue; the contrast table must then be recomputed.
2. **Fonts:** Instrument Sans + JetBrains Mono. Other candidates checked as available: Geist (the scaffold default, very common), Hanken Grotesk, Bricolage Grotesque (more expressive, weaker for dense UI), IBM Plex Mono.
3. **Default theme:** follow the system, dark when there is no preference. The alternative is dark for everyone until they choose.
4. **Radii:** deliberately small (2 px cards, 4 px controls). Say if you want a softer look.
5. **Brand assets:** there is no logo, wordmark or brand colour yet, and the trade name is a placeholder (`src/lib/business.ts`, docs/IDENTITY.md). If they exist later, this direction must be reconciled with them.
6. **Design-skill input:** the UI/UX Pro Max skill is not installed on this machine, so this system was decided manually without its `--design-system` search (the roadmap's intended first step). Once it is installed, I can run the allowed searches and compare, if you want a second opinion.
7. **Approval:** when you approve, P1.1 is closed and P1.2 can start. Until then, treat every value above as proposed.
