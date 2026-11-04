# PROJECT_STATE.md

Live handoff file between Claude Code sessions. Claude updates it at the end of every task; you review it with the diff. Keep it short: history belongs in git and ADRs, not here. Sections marked *(rolling)* keep only the latest ~10 entries.

_Last updated: 2026-11-04 · by: Claude Code · branch: `main` (P0.1 committed as `9718ab3`)_

---

## 1. Current focus

| Field | Value |
|---|---|
| Phase | 0 — Setup, governance & tooling |
| Active task | `P0.2` — Governance & config files (`.claude/settings.json`, `.env.example`, `.gitignore`) |
| Status | **awaiting review** (acceptance criteria met, not committed) |
| Next task | `P0.3` |

**Plan for the active task**
1. `.gitignore`: keep `.env*` ignored but re-include `!.env.example`; also ignore `secrets/`, key/cert files and `.claude/settings.local.json`.
2. `.env.example`: placeholder-only contract split public / server-only, no real secrets.
3. `.claude/settings.json`: deny reading/editing env, secrets and key files, deny state-changing git and destructive commands, allow verification commands and read-only git, keep `enableAllProjectMcpServers` off.
4. Test the deny rule against a dummy canary `.env.local`.

**Where I stopped** (exact file/function, what's half-done)
- Nothing half-done. **Action for you:** delete the dummy test file `.env.local` (it only contains `DENY_RULE_CANARY=…`, gitignored). I could not remove it because the deny rules also block me from touching it.
- The governance files from the blueprint other than `.claude/settings.json` and `.env.example` (CLAUDE.md, ROADMAP.md, PROJECT_STATE.md, `docs/*`) were already committed in `b8b50ef`; `.mcp.json` and `.github/*` belong to P0.7 / P0.5.

---

## 2. Phase progress

| Phase | Status | Tasks done | Notes |
|---|---|---|---|
| 0 Setup & governance | ◐ | 2/7 | P0.1 committed; P0.2 awaiting review/commit |
| 1 Core, design system, motion | ☐ | 0/8 | |
| 2 Landing & value proposition | ☐ | 0/7 | |
| 3 Agent showcases & funnels | ☐ | 0/7 | |
| 4 GDPR, CI/CD, hardening | ☐ | 0/7 | |

---

## 3. Completed milestones *(rolling)*

| Date | Task | Summary | Commit (filled by you) |
|---|---|---|---|
| 2026-11-04 | P0.1 | Next.js 16.4.5 scaffold, strict TS, Tailwind v4, pnpm 12.16.1, Node 24 pinned | `9718ab3` |

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
| D9 | 2026-11-04 | Pinned toolchain: Node 24 (`.nvmrc` `24`, engines `>=24 <25`), pnpm 12.16.1 via `packageManager`; Next 16.4.5, React 19.3.0, Tailwind 4.3.4, TS 5.9.3 | Reproducible installs; versions are what `create-next-app` resolved today | — |
| D10 | 2026-11-04 | `@types/node` bumped from scaffold `^20` to `^24` | Types should match the pinned Node runtime | — |
| D11 | 2026-11-04 | Claude permissions: env/secret/key files denied for Read and Edit by explicit filename (not `.env.*`); state-changing git, `rm -rf`, `npm install`, publish and curl/wget-to-shell denied; rules mirrored for `Bash` and `PowerShell` tools | A blanket `.env.*` deny would also block `.env.example`, and deny always wins over allow | — |

---

## 5. Blockers & open questions

| # | Blocker / question | Owner | Needed by task |
|---|---|---|---|
| B1 | ~~Confirm decisions D1–D8~~ confirmed 2026-11-03 | you | — |
| B2 | Company legal data for footer (sede legale, P.IVA, REA, capitale sociale, PEC) | you | P1.8 |
| B3 | Privacy contact email + retention period for inquiries | you | P2.5 / P4.3 |
| B4 | Legal review of privacy/cookie policy texts | you / counsel | P4.2 |

---

## 6. Environment & services status

| Service | Dev | Preview | Prod | Notes |
|---|---|---|---|---|
| Vercel project | | | | region fra1 |
| Postgres (EU) | | | | separate branch per env |
| Upstash Redis (EU) | | | | |
| Email provider (EU) | | | | SPF/DKIM/DMARC |
| Turnstile | test key | test key | prod key | |
| Claude API | | | | budget alert set? |
| 21st MCP | key in shell env | n/a | n/a | never in repo |

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

- **Limits of the deny rules:** `Read`/`Edit`/`Grep` denies are path-based and solid. The `Bash`/`PowerShell` env patterns (`* .env.local` etc.) only match literal command text; I did **not** test bypass spellings such as `cat ./.env.local` or `type .\.env.local`, which probably slip through. For a hard guarantee, use Claude Code's sandbox / OS-level filesystem restrictions.
- **`.env.example` assumptions to confirm:** email variables are provider-neutral (`EMAIL_API_KEY`, `EMAIL_FROM`, `INQUIRY_NOTIFY_TO`) because the EU provider is not chosen yet (P2.5); Turnstile values are Cloudflare's published always-pass test keys, copied from memory, so check them against Cloudflare's docs; no analytics or Cal.com variables yet (D6 platform and P2.7 undecided).
- **CLAUDE.md §13:** changing `.claude/settings.json` normally needs asking; done here because P0.2 explicitly requests it.
- **P0.3 / `typecheck` script:** `tsc --noEmit` fails on a fresh checkout (`LayoutProps` is a Next-generated global; `next-env.d.ts` and `.next/types` are gitignored). Use `next typegen && tsc --noEmit`. Verified that works from a clean state.
- **P0.3 / scripts:** `pnpm verify`, `typecheck`, `format`, `test`, `test:e2e` do not exist yet; only `dev`, `build`, `start`, `lint`.
- **Decision for you — `next.config.ts`:** the generator enabled `cacheComponents: true` and `partialPrefetching: true` (kept as generated). Cache Components changes how dynamic data/Suspense work and may interact with the P1.4 (next-intl) and P1.7 (CSP nonce) tasks. Keep or turn off before Phase 1.
- **Decision for you — `AGENTS.md`:** generated by `create-next-app`/`next dev` (re-created if deleted); it points to docs in `node_modules/next/dist/docs/`. CLAUDE.md remains the authority. Keep, or add to `.gitignore`.
- **CLAUDE.md §5 wording:** it refers to `pnpm.onlyBuiltDependencies`; pnpm 12 uses `allowBuilds` in `pnpm-workspace.yaml` (currently `sharp: false`, `unrs-resolver: false`). Note `sharp: false` means `next/image` uses no native sharp build; revisit when image optimisation matters.
- **Scaffold leftovers to replace later:** default `README.md`, default page, `Create Next App` metadata and `lang="en"` (P1.4/P2), raw hex in `globals.css` and `next/font/google` Geist (P1.2).
- **Deprecation notice:** pnpm warns `eslint@9.39.5` is deprecated (10.x available); left as scaffolded, decide in P0.3.

---

## 9. Last verification run

```
pnpm verify      → not available yet (added in P0.3); equivalent checks run individually:
  pnpm install --frozen-lockfile → pass
  tsc --noEmit                   → pass (after Next generated route types; also pass from a clean state with `next typegen`)
  pnpm lint --max-warnings=0     → pass
  pnpm build                     → pass (Next 16.4.5 Turbopack; routes: /, /_not-found, both static)
  unit tests                     → none yet (harness arrives in P0.4)
pnpm test:e2e    → not run (no UI change; Playwright arrives in P0.4)

P0.2 acceptance (deny rule test against dummy canary .env.local, live without restart):
  Read tool        → denied
  Grep tool        → denied
  Bash `cat .env.local`              → denied
  PowerShell `Get-Content .env.local` → denied
  Write tool       → denied
  Read .env.example                  → allowed
  settings.json parses; git check-ignore: .env.local/.env.production/secrets/*/*.key ignored,
  .env.example and .claude/settings.json tracked
```

---

## 10. Proposed commit(s) for the work above

```
chore: add claude code permissions and env contract

Add .claude/settings.json that denies reading or editing env files,
secrets and key material, denies state-changing git and destructive
commands, and allows the verification commands and read-only git.
Add a placeholder-only .env.example split into public and server
variables, and re-include it in .gitignore (which also now ignores
secrets/, key/cert files and settings.local.json).

Task: P0.2

Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>
```

---

### Session handoff prompt (copy into a new Claude Code session)

> Read `CLAUDE.md`, `PROJECT_STATE.md` and the current phase in `ROADMAP.md`. Summarise the current state in 3 lines, confirm the active task, then continue. Stop when the task's acceptance criteria are met, run `pnpm verify`, update `PROJECT_STATE.md`, and propose a commit message. Do not commit.
