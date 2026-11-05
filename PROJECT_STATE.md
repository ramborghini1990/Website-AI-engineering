# PROJECT_STATE.md

Live handoff file between Claude Code sessions. Claude updates it at the end of every task; you review it with the diff. Keep it short: history belongs in git and ADRs, not here. Sections marked *(rolling)* keep only the latest ~10 entries.

_Last updated: 2026-11-05 · by: Claude Code · branch: `main` (P0.7 committed as `18fb0dd`)_

---

## 1. Current focus

| Field | Value |
|---|---|
| Phase | 1 — Core framework, design system & motion (Phase 0 closed 7/7, carry-overs in section 8) |
| Active task | `P1.1` — Design direction & system document (`docs/DESIGN.md`) |
| Status | **draft written, awaiting your approval (not committed).** ROADMAP acceptance for P1.1 is "approved by you" plus contrast pairs documented; the second part is done, the first is yours |
| Next task | `P1.2` — tokens in `@theme`, fonts via `next/font`; do not start before P1.1 is approved |

**Plan for the active task**
1. Decide direction manually: the UI/UX Pro Max skill is **not installed** on this machine (checked), so the roadmap's `--design-system` search step was skipped.
2. Compute every colour pair with the WCAG formula (script in the session scratchpad, not in the repo) and iterate until all pass in both themes.
3. Compute the fluid type scale (`clamp()`, 360→1440 px) and confirm fonts exist in Next 16.4.5's bundled font data.
4. Write `docs/DESIGN.md`: identity, colour tokens + contrast tables, typography, spacing/layout, radii/borders/elevation, motion tokens and reduced-motion rules, components/imagery, themes, do/don't, hand-off to P1.2, decisions for you.
5. Cross-check the document against the script; run `pnpm verify`.

**Where I stopped** (exact file/function, what's half-done)
- Nothing half-done, and no code or tokens were implemented: `docs/DESIGN.md` is the only new file.
- **Your step:** read `docs/DESIGN.md` §11 and approve or change the open decisions (accent hue, fonts, default theme, radii, brand assets). Any change to a colour requires recomputing its contrast pairs.

---

## 2. Phase progress

| Phase | Status | Tasks done | Notes |
|---|---|---|---|
| 0 Setup & governance | ✔ | 7/7 | Marked complete at your instruction. P0.7 awaiting commit. ROADMAP says a phase is done only when every acceptance criterion is checked **and CI is green on `main`**; not all are evidenced, see "Phase 0 carry-overs" in section 8 |
| 1 Core, design system, motion | ◐ | 0/8 | P1.1 draft awaiting your approval (counts as done once approved and committed) |
| 2 Landing & value proposition | ☐ | 0/7 | |
| 3 Agent showcases & funnels | ☐ | 0/7 | |
| 4 GDPR, CI/CD, hardening | ☐ | 0/7 | |

---

## 3. Completed milestones *(rolling)*

| Date | Task | Summary | Commit (filled by you) |
|---|---|---|---|
| 2026-11-04 | P0.1 | Next.js 16.4.5 scaffold, strict TS, Tailwind v4, pnpm 12.16.1, Node 24 pinned | `9718ab3` |
| 2026-11-04 | P0.2 | Claude Code permissions, `.env.example` contract, `.gitignore` for env/secrets | `f0c3c40` |
| 2026-11-04 | P0.3 | ESLint strict type-checked + jsx-a11y, Prettier + Tailwind plugin, knip, `verify` script | `9b3b01a` |
| 2026-11-04 | P0.4 | Vitest + Testing Library + jsdom; Playwright + axe smoke test | `c617808` |
| 2026-11-04 | P0.5 | CI workflows (SHA-pinned), gitleaks security workflow, Dependabot | `9d7338c` |
| 2026-11-04 | P0.6 | Vercel `fra1` config, `engines.node` 24.x, deployment runbook; production deployment Ready at https://website-ai-engineering.vercel.app/ (reported by you) | `282dcbb` |
| 2026-11-04 | P0.7 | 21st MCP in `.mcp.json` (key by reference), `docs/TOOLING_SETUP.md`, Phase 0 closed | `18fb0dd` |

---

## 4. Decisions log

Short entries; anything structural also gets an ADR in `docs/adr/`.

| # | Date | Decision | Why | ADR |
|---|---|---|---|---|
| D1 | 2026-11-03 | Hosting: Vercel `fra1` | EU region, previews, Next.js-native | — |
| D2 | 2026-11-03 | Demo backend: Route Handlers, simulation-first | Zero running cost, no ToS risk | — |
| D3 | 2026-11-03 | Content: MDX in repo | Versioned, no extra processor | — |
| D4 | 2026-11-03 | i18n: IT default + EN via next-intl | Market reach, cheap if done early | — |
| D5 | 2026-11-03 | Leads: EU Postgres + EU email | Data residency, funnel view | — |
| D6 | 2026-11-03 | Analytics: cookieless EU (Plausible/Umami) | No consent banner for analytics | — |
| D7 | 2026-11-03 | Order funnel = inquiry + booking, no payments v1 | Avoids invoicing/VAT scope | — |
| D8 | 2026-11-03 | Repo private | Keeps abuse heuristics private | — |
| D9 | 2026-11-04 | Pinned toolchain: Node 24 (`.nvmrc` `24`, engines `24.x` since D15), pnpm 12.16.1 via `packageManager`; Next 16.4.5, React 19.3.0, Tailwind 4.3.4, TS 5.9.3 | Reproducible installs; versions are what `create-next-app` resolved today | — |
| D10 | 2026-11-04 | `@types/node` bumped from scaffold `^20` to `^24` | Types should match the pinned Node runtime | — |
| D11 | 2026-11-04 | Claude permissions: env/secret/key files denied for Read and Edit by explicit filename (not `.env.*`); state-changing git, `rm -rf`, `npm install`, publish and curl/wget-to-shell denied; rules mirrored for `Bash` and `PowerShell` tools | A blanket `.env.*` deny would also block `.env.example`, and deny always wins over allow | — |
| D12 | 2026-11-04 | Tooling: `typescript-eslint` `strictTypeChecked` (TS files only), `eslint-plugin-jsx-a11y` strict rules, Prettier + `prettier-plugin-tailwindcss`, `knip`; `*.md`, `pnpm-lock.yaml`, `pnpm-workspace.yaml` excluded from Prettier. `knip` and `format:check` are separate scripts, not part of `verify` | Matches the P0.3 spec; hand-formatted docs tables and pnpm-managed files would create noisy diffs | — |
| D13 | 2026-11-04 | Testing: Vitest 5 (jsdom, globals off, explicit imports) for `src/**/*.test.{ts,tsx}`; Playwright (Chromium only for now) in top-level `e2e/` against a production build on port 3100; `@axe-core/playwright` scan with WCAG 2.0/2.1/2.2 A+AA tags, zero violations allowed. `pnpm verify` runs unit tests only; e2e stays a separate command (`pnpm test:e2e`) | Matches CLAUDE.md §4 (`verify` = typecheck + lint + test + build); a production build avoids dev-overlay noise in axe results | — |
| D14 | 2026-11-04 | CI: GitHub Actions only; every action pinned to a full commit SHA with a version comment (`checkout` v7.0.1, `setup-node` v7.1.0, `cache` v6.1.0, `upload-artifact` v7.0.2); pnpm via Corepack from `packageManager`; Node from `.nvmrc`. Secret scanning = gitleaks 8.30.1 binary pinned by version + sha256 (no third-party action); CodeQL and dependency-review excluded because the repo is private without GHAS | Supply-chain hygiene; the official gitleaks action needs a paid licence once the repo is owned by an organisation | — |
| D15 | 2026-11-04 | Vercel: `vercel.json` pins `regions: ["fra1"]`, `framework: nextjs`, `installCommand: pnpm install --frozen-lockfile`; `engines.node` is `24.x`; Pro plan required (Hobby is non-commercial only); `ENABLE_EXPERIMENTAL_COREPACK=1` to honour `packageManager`; Preview and Production use separate DB/Redis/keys per the matrix in `docs/DEPLOYMENT.md` §3; Vercel Authentication on for Previews; Web Analytics / Speed Insights off | Region and Node version are then reproducible from the repo; Vercel's default Node is a newer major than the one we pin; commercial site needs Pro; Preview must never touch production data (BLUEPRINT) | — |
| D16 | 2026-11-04 | Tooling: 21st MCP is committed in `.mcp.json` as a project server (remote HTTP, key from `${API_KEY_21ST}`); `enableAllProjectMcpServers` stays off and the server is not pre-approved in `.claude/settings.json`. UI/UX Pro Max is installed by you from your own fork pinned to the reviewed commit `713eef5` (or `ccce51c`, README-only delta); Claude does not install plugins or skills. Other audited tools stay uninstalled | Audit §1–§2, §8; CLAUDE.md §13 | — |
| D17 | 2026-11-05 | **Proposed, not yet approved:** design direction "instrument panel" in `docs/DESIGN.md`. Palette Ink / Bone / Signal (amber `#FFB347` dark, `#9C4700` light) / Trace; Instrument Sans + JetBrains Mono; fluid scale 360→1440 px with 16→18 px body; 4 px base unit; radii 2/4/8 px; motion tokens 80–1100 ms with `expo.out`-style `ease-out`; dark baseline, system preference respected | Dark-first technical identity that avoids the template look (CLAUDE.md §7); every required pair computed ≥ 4.5 : 1 (text) or ≥ 3 : 1 (UI) in both themes | — |

---

## 5. Blockers & open questions

| # | Blocker / question | Owner | Needed by task |
|---|---|---|---|
| B1 | ~~Confirm decisions D1–D8~~ confirmed 2026-11-03 | you | — |
| B2 | Company legal data for footer (sede legale, P.IVA, REA, capitale sociale, PEC) | you | P1.8 |
| B3 | Privacy contact email + retention period for inquiries | you | P2.5 / P4.3 |
| B4 | Legal review of privacy/cookie policy texts | you / counsel | P4.2 |
| B5 | Vercel: confirm the team is on **Pro** (not Hobby; Hobby is non-commercial only), MFA is on, and the DPA is accepted. Deployment itself is done | you | before launch (P4.7) |
| B7 | Do the P0.7 machine steps (`docs/TOOLING_SETUP.md` §1–§2). Partly visible: `mcp__21st__*` tools are now registered in this session, so the server was approved; not exercised, and `claude mcp list` output / the design-skill fork are unconfirmed | you | P1.3+ (21st), optional second opinion for P1.1 (design skill) |
| B8 | Approve or change `docs/DESIGN.md` §11 (accent hue, fonts, default theme, radii) and say whether INAMBIENTE already has a logo / brand colours | you | P1.1 acceptance, then P1.2 |
| B6 | Production domain name (needed for `NEXT_PUBLIC_SITE_URL` in Production) | you | P1.7 / P2.6 |

---

## 6. Environment & services status

| Service | Dev | Preview | Prod | Notes |
|---|---|---|---|---|
| Vercel project | n/a | unverified (PR preview not evidenced) | Ready: https://website-ai-engineering.vercel.app/ (from `282dcbb`) | region fra1 set in `vercel.json`; runbook `docs/DEPLOYMENT.md`; no env vars set yet (app reads none) |
| Postgres (EU) | | | | separate branch per env |
| Upstash Redis (EU) | | | | |
| Email provider (EU) | | | | SPF/DKIM/DMARC |
| Turnstile | test key | test key | prod key | |
| Claude API | | | | budget alert set? |
| 21st MCP | `.mcp.json` committed; `API_KEY_21ST` user env var, **not confirmed set**; project-server approval pending | n/a | n/a | key never in repo; see `docs/TOOLING_SETUP.md` |

Env vars added this session (names only, never values; all in `.env.example` with placeholders; `src/lib/env.ts` does not exist yet, P1.7 must mirror this list):
- Public: `NEXT_PUBLIC_SITE_URL`, `NEXT_PUBLIC_TURNSTILE_SITE_KEY`
- Server: `DATABASE_URL`, `UPSTASH_REDIS_REST_URL`, `UPSTASH_REDIS_REST_TOKEN`, `TURNSTILE_SECRET_KEY`, `RATE_LIMIT_IP_SALT`, `EMAIL_API_KEY`, `EMAIL_FROM`, `INQUIRY_NOTIFY_TO`, `ANTHROPIC_API_KEY`, `DEMOS_LIVE_ENABLED`
- Not in the file on purpose: `API_KEY_21ST` (shell env, P0.7)

Local machine note (not in repo): `corepack enable` failed with EPERM on `D:\Program Files\nodejs`, so pnpm shims were created in `%USERPROFILE%\.corepack-bin` (`corepack enable --install-directory`). Add that folder to your user PATH, or run `corepack pnpm …`.

---

## 7. Known issues & tech debt *(rolling)*

| Issue | Impact | Proposed fix | Task |
|---|---|---|---|
| | | | |

---

## 8. Follow-ups noticed (not done)

- **P1.1 / for P1.2: executable contrast guard.** The contrast numbers in `docs/DESIGN.md` come from a throwaway script that lives in the session scratchpad, not the repo. P1.2 must add a Vitest test reading the real tokens from `globals.css` and asserting every pair (≥ 4.5 : 1 text, ≥ 3 : 1 control boundaries and focus), plus the no-raw-colour check in `verify`. Until then the document is the only record.
- **P1.1 / thin margins:** light theme `text-muted` and `accent` on `surface-3` are 4.81 and 4.80 : 1; any tweak to those colours needs recomputation. `border-subtle` (1.31–1.46 : 1) is decorative only by design.
- **P1.1 / unverified assumptions:** 200 % browser zoom of the fluid type was not tested (no page exists yet, add to Playwright with the first real page); `wdth` axis must be requested in `next/font` or the condensed display style is silently not loaded; the theme pre-paint script needs a CSP nonce (P1.7) or a server-resolved cookie; the theme choice is a storage key that must appear in the cookie/storage table (P4.2).
- **P1.1 / `docs/DESIGN.md` is outside Prettier** (`*.md` ignored, D12), so its formatting is not machine-enforced. I validated its hex values, quoted ratios and table structure with a script instead.
- **Phase 0 carry-overs (phase closed at your instruction; these acceptance items are not evidenced).**
  - P0.5: CI green on `main` and "a PR shows all checks" not seen by me; branch protection on `main` not enabled; the fake-secret PR test not run (steps in the CI bullets below).
  - P0.6: "a PR gets a preview URL" not evidenced; build-log Node and pnpm versions not reported (pnpm 12 risk below); `fra1` function region unobservable on a static site. What I did see on 2026-11-04: `https://website-ai-engineering.vercel.app/` answers HTTP 200 from `Server: Vercel` with HSTS, serves the scaffold page (title "Create Next App", one `h1`), and `x-vercel-id` starts with `fra1::`, which names the edge location serving my request and is **not** proof of the function region.
  - P0.7: key, project-server approval, `claude mcp list` showing `21st` connected, and `/plugin` showing only `ui-ux-pro-max` are yours to confirm (B7).
- **P0.7: design-skill upstream drift.** Audit reviewed `713eef5`; upstream `main` is `ccce51c`. `713eef5` is an ancestor with 2 commits since, touching only `README*.md` (file names checked, text not read). The audit's "v2.15.0" label does not match the tag (`v2.15.0` → `a38d04c`): pin by commit.
- **P0.7: `python3` is not usable on this Windows machine** (Microsoft Store shim); use `python` (3.12.0). The audit's commands say `python3`.
- **P0.7: proposal, needs your approval (CLAUDE.md §13):** add deny rules in `.claude/settings.json` for the design skill's risky scripts (`design` skill generators and `ui-styling/scripts/shadcn_add.py`), so the "not without asking" rule is enforced and not only written. Not done.
- **P0.7: 21st.dev is a remote service that receives prompts and tool context.** It should never see visitor personal data (dev tool only), so I did not add it to the GDPR processors list or ROPA. Say if you want it listed anyway. Project MCP servers also load without a prompt in non-interactive runs (`claude -p`, SDK, cloud); none are used here.
- **P0.6: pnpm 12 on Vercel is unverified (main risk).** The lockfile says `lockfileVersion: '9.0'`; Vercel picks pnpm from that unless Corepack is on, and its Corepack support is documented as experimental. Check the first build log for pnpm 12.16.1 and Node 24; fallbacks are in `docs/DEPLOYMENT.md` §6. Moving the repo to another pnpm major is a decision for you, not something to do silently.
- **P0.6: `fra1` cannot be observed yet.** Both routes are static (CDN), so no function runs. Verify on the first dynamic route (inquiry handler, P2.5). `fra1` covers function execution only; CDN/edge is global, so the privacy notice must not claim EU-only hosting.
- **P0.6: Vercel as processor.** `docs/GDPR_CHECKLIST.md` processor line (tagged `[P0.6, P4.2]`) is **not ticked**: DPA acceptance, transfer mechanism (DPF/SCC, unverified here), sub-processors and log retention are yours to confirm; record in `docs/ROPA.md` (does not exist yet, P4.3).
- **P0.6: for P1.7.** `env.ts` must not make `NEXT_PUBLIC_SITE_URL` mandatory in Preview (derive it from Vercel's deployment URL), or every PR preview fails the missing-env build check. `engines.node` change (`>=24 <25` → `24.x`) is equivalent for Node 24 and avoids Vercel's default of a newer major.
- **P0.6: Hobby plan.** It builds fine but breaches Vercel's terms for a company site; use Pro.
- **Limits of the deny rules:** `Read`/`Edit`/`Grep` denies are path-based and solid. The `Bash`/`PowerShell` env patterns (`* .env.local` etc.) only match literal command text; I did **not** test bypass spellings such as `cat ./.env.local` or `type .\.env.local`, which probably slip through. For a hard guarantee, use Claude Code's sandbox / OS-level filesystem restrictions.
- **`.env.example` assumptions to confirm:** email variables are provider-neutral (`EMAIL_API_KEY`, `EMAIL_FROM`, `INQUIRY_NOTIFY_TO`) because the EU provider is not chosen yet (P2.5); Turnstile values are Cloudflare's published always-pass test keys, copied from memory, so check them against Cloudflare's docs; no analytics or Cal.com variables yet (D6 platform and P2.7 undecided).
- **CLAUDE.md §13:** changing `.claude/settings.json` normally needs asking; done here because P0.2 explicitly requests it.
- **CI has never run on GitHub.** Everything in `.github/` was checked locally only (see section 9). Likeliest first-run surprises: Corepack on the runner resolving `pnpm@12.16.1`, `setup-node` `cache: pnpm`, and Dependabot's support for the pnpm 12 lockfile format. Read the first PR's checks before relying on them.
- **`actionlint` was not run:** I downloaded it (checksum matched) but the auto-mode classifier blocked executing the binary, so I did not retry. YAML syntax is verified by Prettier and SHA pins against upstream tags; workflow semantics (expressions, step keys) are unchecked. Run `actionlint` yourself or watch the first run.
- **Branch protection is NOT enabled (roadmap P0.5 asks for it).** It is an outward-facing GitHub setting, not requested in this task, and private repos need a plan that supports it. Suggested: require PR, require checks `verify`, `e2e` and `gitleaks`, block force-push. The `gitleaks` check only *fails a PR*; without branch protection nothing stops a direct push of a secret to `main`.
- **Secret test coverage:** detection was proven with `gitleaks dir` on a synthetic canary (rule `github-pat`, exit 1) and `gitleaks git` on the real history (exit 0, 5 commits then). The end-to-end roadmap test, "a commit with a fake secret fails the PR check", could not be run here (`git commit` is denied by `.claude/settings.json`, and pushing is yours). To do it: on a throwaway branch commit a file with a fake `ghp_` + 36 random alphanumerics, open a PR, expect `gitleaks` red, then delete the branch.
- **Detection, not prevention:** by the time CI flags a secret it is already in a pushed commit and must be rotated. Consider a local `gitleaks` pre-commit hook later (needs your approval under CLAUDE.md §13; hooks are not approved by default).
- **gitleaks upgrades are manual:** `GITLEAKS_VERSION` and `GITLEAKS_SHA256` in `security.yml` are not tracked by Dependabot. Bump both together from the release's checksums file.
- **Not added (out of the requested scope):** `pnpm audit` job (roadmap P4.4 wants a clean dependency audit), Lighthouse CI (P4.6), ZAP (P4.4).
- **Playwright in CI:** `playwright.config.ts` switches to retries and github/html reporters when `CI` is set; browsers are cached by lockfile hash and installed with `--with-deps`.
- **New top-level dir `e2e/`:** CLAUDE.md §2 says not to create top-level directories without asking; the task requires a place for Playwright specs, so `e2e/` was chosen. Say if you prefer another location (`tests/e2e`, `src/...`).
- **Test dependencies beyond those you named:** `@vitejs/plugin-react` (JSX transform in Vitest), `@testing-library/dom` (peer of `@testing-library/react` 16) and `@testing-library/jest-dom` (matchers such as `toBeInTheDocument`). `@testing-library/user-event` was **not** added; add it when the first interaction test needs it.
- **Only Chromium:** `playwright.config.ts` has one project. Add Firefox/WebKit and mobile viewports (360/768/1280/1920 per CLAUDE.md §7) when real pages exist; browsers are an extra download each.
- **axe is not a full a11y audit:** it catches roughly a third of WCAG issues automatically. Keyboard flow, focus order and reduced-motion still need explicit specs (P1.5, P1.8).
- **Playwright `webServer` runs `pnpm build && pnpm start`:** a full build per `test:e2e` run when no server is already on port 3100 (about 15 s now, will grow). `reuseExistingServer` is on locally, so a long-lived `pnpm start --port 3100` speeds up iteration.
- **Windows local PATH:** `pnpm` is only on PATH via `%USERPROFILE%\.corepack-bin` (see section 6); Playwright's `webServer` command calls `pnpm`, so it needs that PATH entry in the shell that starts the tests.
- **`eslint-plugin-jsx-a11y` maintenance:** latest release is 2024-10-26 (6.10.2). Works with ESLint 9 and is what `eslint-config-next` uses, but it is the weakest maintenance signal among the new devDependencies. Playwright + axe (P0.4) is the real a11y gate.
- **jsx-a11y wiring:** `eslint-config-next` registers its own plugin instance, so re-registering it throws "Cannot redefine plugin". The config applies only the strict preset's `rules`. If `eslint-config-next` changes how it loads the plugin, revisit.
- **No `no-console` rule yet:** the roadmap Definition of Done says no `console.log` in `src/`. Not part of the P0.3 spec so not added; consider it together with the logger in P1.7.
- **knip scope:** still green with zero config after P0.4; its Vitest and Playwright plugins pick up the new entry files. Add a `knip.json` only if it starts reporting false positives.
- **Prettier line endings:** this Windows checkout has `core.autocrlf` behaviour (git warns LF→CRLF); no `.gitattributes` / `.editorconfig` exists. Consider adding one so files do not flip line endings between machines.
- **Decision for you — `next.config.ts`:** the generator enabled `cacheComponents: true` and `partialPrefetching: true` (kept as generated). Cache Components changes how dynamic data/Suspense work and may interact with the P1.4 (next-intl) and P1.7 (CSP nonce) tasks. Keep or turn off before Phase 1.
- **Decision for you — `AGENTS.md`:** generated by `create-next-app`/`next dev` (re-created if deleted); it points to docs in `node_modules/next/dist/docs/`. CLAUDE.md remains the authority. Keep, or add to `.gitignore`.
- **CLAUDE.md §5 wording:** it refers to `pnpm.onlyBuiltDependencies`; pnpm 12 uses `allowBuilds` in `pnpm-workspace.yaml` (currently `sharp: false`, `unrs-resolver: false`). Note `sharp: false` means `next/image` uses no native sharp build; revisit when image optimisation matters.
- **Scaffold leftovers to replace later:** default `README.md`, default page, `Create Next App` metadata and `lang="en"` (P1.4/P2), raw hex in `globals.css` and `next/font/google` Geist (P1.2).
- **Deprecation notice:** pnpm still warns `eslint@9.39.5` is deprecated (10.x available). Stayed on 9 because the blueprint specifies "ESLint 9 flat config" and `eslint-config-next` 16.4.5 is built against it; revisit when Next supports 10.

---

## 9. Last verification run

```
pnpm install --frozen-lockfile → pass
pnpm verify       → pass (typecheck → lint → test → build); test step: 1 file, 2 tests passed
pnpm knip         → pass
pnpm format:check → pass (does not cover *.md, so not docs/DESIGN.md)
pnpm test:e2e     → not run: no UI or code changed in P1.1

P1.1 checks (docs/DESIGN.md; scripts are in the session scratchpad, not the repo):
  contrast          → all required pairs pass in both themes (WCAG 2.x luminance formula on exact hex):
                      text >= 4.5 : 1 (lowest: light text-muted/accent on surface-3, 4.80-4.81),
                      control boundaries and focus >= 3 : 1 (lowest: dark border-strong on surface-2, 3.66)
                      One first-draft failure was fixed: light-theme amber fill was 2.24 : 1 against
                      the background, so the light accent became the deep burnt orange #9C4700
                      with a paper label (6.07 : 1)
  doc vs script     → 17/17 token hex values match the palette used; all 66 quoted ratios are values
                      the script produced; every markdown table row has the right column count
  type scale        → clamp() strings computed by script; endpoints verified (@360 and @1440 px)
  fonts             → Instrument Sans (wght 400-700, wdth 75-100) and JetBrains Mono (wght 100-800)
                      present in Next 16.4.5 font-data.json with latin / latin-ext subsets
  NOT done          → design-skill `--design-system` search (skill not installed); visual check
                      (nothing rendered yet); 200 % zoom test; your approval
```

---

## 10. Proposed commit(s) for the work above

```
docs(design): add design direction and system document

Define the visual identity as a dark-first technical "instrument
panel": Ink/Bone neutrals, a single Signal amber accent and a cool
Trace secondary, with semantic light and dark tokens. Document
every text and UI contrast pair with ratios computed from the
exact hex values (text >= 4.5:1, control boundaries and focus
>= 3:1), the fluid type scale with Instrument Sans and JetBrains
Mono, spacing and layout rhythm, radii and elevation, motion
duration and easing tokens with reduced-motion rules, and a
do/don't list. Marked as a draft pending approval; tokens are
implemented in P1.2.

Task: P1.1

Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>
```

---

### Session handoff prompt (copy into a new Claude Code session)

> Read `CLAUDE.md`, `PROJECT_STATE.md` and the current phase in `ROADMAP.md`. Summarise the current state in 3 lines, confirm the active task, then continue. Stop when the task's acceptance criteria are met, run `pnpm verify`, update `PROJECT_STATE.md`, and propose a commit message. Do not commit.
