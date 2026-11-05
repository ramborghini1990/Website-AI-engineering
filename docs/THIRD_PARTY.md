# THIRD_PARTY.md — copy-in code and notable third-party sources

CLAUDE.md §5: copy-in components are code we now own. Adapt to tokens, remove unused props, add types, and record source and licence here. Runtime dependencies are listed separately in `package.json`; this file records provenance and anything that is not a plain dependency.

## Copy-in / pattern-derived code

| Code | Source | Licence | Where | How it was adopted |
|---|---|---|---|---|
| UI primitives: Button, Input, Textarea, Label, Checkbox, Select, Dialog, Sheet, Tabs, Tooltip, Toast | Structure and API follow the **shadcn/ui** pattern (`cva` variants, `cn()` helper, thin wrappers over Radix primitives) | MIT | `src/components/ui/*`, `src/lib/utils.ts` | **Written by hand**, not generated: the shadcn CLI was not run (it downloads and executes unpinned packages; CLAUDE.md §13 and `docs/SECURITY_TOOLING_AUDIT.md`). Restyled to our tokens; sizes capped at the 44 px hit target; no copy inside components (labels are props); animations driven by `--animate-*` tokens. Toast uses Radix Toast with a small own store (`use-toast.ts`) instead of shadcn's Sonner variant, to avoid an extra dependency. |

If the shadcn CLI is ever used to add a component, review the generated diff like third-party code (licence, accessibility, raw colours, external scripts) and add a row here.

## Runtime dependencies added with the primitives (P1.3)

| Package | Purpose | Licence |
|---|---|---|
| `@radix-ui/react-dialog`, `-select`, `-checkbox`, `-tabs`, `-tooltip`, `-toast`, `-label`, `-slot` | Accessible behaviour (focus management, keyboard, ARIA) | MIT |
| `lucide-react` | Icons (CLAUDE.md §7) | ISC |
| `class-variance-authority` | Component variants | Apache-2.0 |
| `clsx`, `tailwind-merge` | `cn()` class composition | MIT |

Licences were read from the npm registry on 2026-11-05.

## Motion dependencies (P1.5)

| Package | Purpose | Licence |
|---|---|---|
| `gsap` 3.15.1 (core, `ScrollTrigger`, `CustomEase`) | Animation engine and scroll-linked scenes | **GSAP "Standard 'no charge' license"**, https://gsap.com/standard-license (registry field, read 2026-11-05). Not an OSI licence |
| `@gsap/react` 2.1.2 (`useGSAP`) | React lifecycle and cleanup for GSAP | "See license at https://gsap.com/standard-license" (same text) |
| `lenis` 1.3.27 | Smooth scrolling | MIT |

**GSAP licence: needs a human check.** CLAUDE.md §5 and BLUEPRINT §2 allow GSAP and state its plugins are free for commercial use. The licence text is custom, so it has not been reviewed by a qualified professional here; read it once before launch and record the outcome below. This project uses only the plugins that ship in the public `gsap` package (`ScrollTrigger`, `CustomEase`) and does not use GSAP to build a tool that competes with GSAP.

- [ ] GSAP standard licence read and accepted for INAMBIENTE's use (commercial website and demos)

**Lenis stylesheet.** `src/app/globals.css` contains a subset of upstream `lenis/dist/lenis.css` (MIT). Two rules were deliberately left out: `html.lenis, html.lenis body { height: auto }` (changes the document height when Lenis starts, a layout shift measured at CLS 0.062 in this project) and the `lenis-stopped` overflow rule (Radix already locks scroll).

## Not yet used

React Bits / 21st.dev components: none copied so far (P1.6 will add rows when it does).
