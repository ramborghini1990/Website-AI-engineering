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

## Not yet used

React Bits / 21st.dev components: none copied so far (P1.6 will add rows when it does).
