# Security & Tooling Audit — Skills, MCP servers, plugins

Audited 2026-11-03. Method: shallow-cloned each public repository and **read** the source (manifests, hooks, scripts) without installing or running anything. Where I could not read the source, the entry says so. Commit hashes are what I reviewed; anything newer is unreviewed.

## Summary

| Tool | Source reviewed | Verdict | Use in this project |
|---|---|---|---|
| UI/UX Pro Max skill | `nextlevelbuilder/ui-ux-pro-max-skill` @ `713eef5` (v2.15.0, MIT) | **Approve with limits** | Phase 1 design system, ongoing UI guidance |
| 21st MCP (formerly Magic MCP) | `21st-dev/magic-mcp` @ `6b5299e` (`@21st-dev/magic` 0.2.3) | **Approve with limits** | Component inspiration/search, Phases 1–3 |
| Impeccable (design skill) | `pbakaus/impeccable` @ `9fadc41` (Apache-2.0) | **Optional** | Design critique/polish passes, Phase 2+ |
| Taste skill | `Leonxlnx/taste-skill` @ `12af471` (MIT) | **Optional, skill-only** | Only if you prefer it over the two above |
| ponytail | `DietrichGebert/ponytail` @ `96608e0` (v5.3.3, MIT) | **Optional, low risk** | Logic/back-end tasks; turn ledger off |
| Graphify | `Graphify-Labs/graphify` (pyproject v0.9.101) | **Defer** | Not needed until the codebase is large |
| OmniRoute | **Not code-reviewed** (see below) | **Reject** | Do not use |

Rule of thumb applied: a skill that is only Markdown is a prompt (low risk, review for injected instructions). A skill or plugin with **scripts** runs code with your user's permissions. A plugin with **hooks** runs code automatically on events, without you asking. An **MCP server** either runs locally (code risk) or is remote (data-leaves-machine risk).

---

## 1. UI/UX Pro Max skill

**What it is:** a Claude Code plugin/marketplace that bundles 7 skills: `ui-ux-pro-max` (the main one), `design-system`, `design`, `brand`, `banner-design`, `slides`, `ui-styling`. The main skill is a searchable local CSV database (styles, palettes, font pairings, UX rules, GSAP presets, stack guidance incl. Next.js) queried via a Python script.

**Findings**
- ✅ Core search (`ui-ux-pro-max/scripts/search.py`, `core.py`, `design_system.py`) uses only the Python standard library: no network, no subprocess. It writes only when you ask it to persist a design system (`design-system/MASTER.md`), with no-overwrite by default.
- ✅ No hooks in the plugin manifest; no prompt-injection phrases found in the SKILL.md files ("ignore previous", hidden instructions, `curl | sh`, `rm -rf`). The main SKILL.md explicitly says results are recommendations, not instructions.
- ⚠️ The bundled **`design` skill** (`scripts/logo/generate.py`, icon/CIP generators) sends prompts to **Gemini, AtlasCloud or MuAPI** image APIs and, on import, **loads `.env` files from `~/.claude/.env` and `~/.claude/skills/.env`** into its environment. Harmless if unused, but it means installing the plugin puts a script that reads those files on your machine.
- ⚠️ **`ui-styling/scripts/shadcn_add.py`** shells out to `npx shadcn@… add`, which downloads and runs packages.
- ⚠️ **`stack/` template** in the repo ships `.claude/settings.json` with `"enableAllProjectMcpServers": true` and `"Read(//home/**)"`, plus a `.mcp.json` that runs `@playwright/mcp@latest`, `chrome-devtools-mcp@latest` and `shadcn@latest mcp` via `npx` (unpinned). **Do not copy that template** into this project.
- ℹ️ It installs as a whole plugin, so you get all 7 skills; Claude may auto-select `slides`/`brand`/`design` for unrelated asks.

**Verdict:** safe for its main purpose. Limit what it can trigger.

**Setup (recommended: install from your own fork, pinned)**
```bash
# 1. On GitHub: fork nextlevelbuilder/ui-ux-pro-max-skill to your account.
#    In your fork, check the HEAD matches the reviewed commit 713eef5 (or review the diff since).
# 2. In Claude Code:
/plugin marketplace add <your-github-user>/ui-ux-pro-max-skill
/plugin install ui-ux-pro-max@ui-ux-pro-max-skill
# 3. Verify:
/plugin            # should list ui-ux-pro-max, nothing else new
```
Installing from your fork means upstream changes reach you only when you sync the fork after reviewing them. CLAUDE.md §13 already forbids running the `design` and `shadcn_add.py` scripts without asking.

Typical use (Claude runs it; the path is resolved by the plugin):
```bash
python3 "${CLAUDE_PLUGIN_ROOT}/.claude/skills/ui-ux-pro-max/scripts/search.py" \
  "ai engineering agency premium dark technical" --design-system -p "INAMBIENTE"
python3 ".../search.py" "scroll pinned section reduced motion" --domain gsap
python3 ".../search.py" "app router server components" --stack nextjs
```

---

## 2. 21st MCP (formerly "Magic MCP")

**What changed:** `@21st-dev/magic` is no longer a standalone server. Since v0.2.0 it is a ~200-line **stdio→HTTP proxy** to the remote endpoint `https://21st.dev/api/mcp`. 21st recommends connecting to that HTTP endpoint directly. Old Magic API keys were reset; you need a new key from 21st.dev/mcp.

**Findings**
- ✅ Proxy source is small and readable: reads the API key from argv/env, forwards JSON-RPC to the endpoint, echoes the session id, no file access.
- ⚠️ It is a **remote** service: your prompts, and whatever context Claude includes in tool calls (component descriptions, sometimes code snippets), go to 21st.dev. Don't send client data, secrets or proprietary code.
- ⚠️ The legacy install form `npx -y @21st-dev/magic@latest API_KEY="…"` puts the key **in the command line** (visible in process lists and saved in `~/.claude.json`). Avoid it.
- ⚠️ Some tools are paid (AI generation, premium component code). Check `get_usage` before relying on generation.
- ⚠️ Generated/fetched components are third-party code: review for licence, accessibility, hard-coded colours, and any `dangerouslySetInnerHTML` or external script before adopting.

**Verdict:** useful for inspiration and blocks; use the direct HTTP endpoint with the key in an environment variable.

**Setup (project scope, key never in the repo)** — this repo's `.mcp.json`:
```json
{
  "mcpServers": {
    "21st": {
      "type": "http",
      "url": "https://21st.dev/api/mcp",
      "headers": { "x-api-key": "${API_KEY_21ST}" }
    }
  }
}
```
Then in your shell profile (not in the repo): `export API_KEY_21ST=…` (or use your OS keychain + a launcher). Start `claude` in the repo, approve the project server when prompted, and check with `claude mcp list` / `/mcp`.

Alternative, user scope only (not shared via git):
```bash
claude mcp add --transport http --scope user 21st https://21st.dev/api/mcp \
  --header 'x-api-key: ${API_KEY_21ST}'
```
Check afterwards that `~/.claude.json` holds the `${API_KEY_21ST}` placeholder and not the literal key; if your shell expanded it, edit the file and put the placeholder back.

---

## 3. Impeccable (design skill / plugin)

**What it is:** a design-quality skill (critique, polish, anti-"AI slop" rules) with an optional plugin that adds hooks and a live-browser inspection mode.

**Findings**
- ⚠️ The **plugin** registers hooks on `SessionStart`, `PostToolUse` (`Edit|Write`) and `Stop`. Each runs `scripts/impeccable`, a shell launcher that executes a **native binary**. If no binary is present it downloads one (curl/wget) and verifies it against `engine-checksums.txt` shipped in the repo. That is a reasonable integrity design, but it is still an unreviewed binary running on every file edit.
- ℹ️ Live-browser scripts inject a DOM overlay into your local dev page for inspection.
- ✅ Apache-2.0, actively maintained.

**Verdict:** optional. If you want it, prefer the **skill only** (Markdown + references) over the plugin with hooks, or install the plugin from a pinned fork and accept the binary. Don't run it alongside UI/UX Pro Max on the same task: two design rulebooks produce conflicting instructions. Use Pro Max to build the system (Phase 1), Impeccable for critique passes (Phase 2+).

---

## 4. Taste skill

**Findings:** MIT. Markdown skill plus Node scripts: `assets.mjs` fetches images from public CC0/public-domain asset APIs, `inspect.mjs`/`cdp.mjs` drive Chrome via the DevTools Protocol for visual inspection. `install.sh` contains no `curl | sh`, `sudo` or `rm -rf`.

**Verdict:** optional and low risk as a prompt-only skill. Overlaps with the two above; pick one design rulebook per task.

---

## 5. ponytail

**Identity check:** the canonical repository is **`DietrichGebert/ponytail`** (its manifests name that author). Several copies exist (`krissman/ponytail` v4.8.4, `dkfish/ponytail` v4.7.0); they are older forks and should not be used. One article names `dietrichayala/ponytail`, which I did not verify.

**What it is:** a "lazy senior dev" ruleset: forces the simplest working solution (YAGNI, stdlib first, no unrequested abstractions), with modes including an aggressive "ultra" mode.

**Findings (v5.3.3)**
- ⚠️ Hooks on `SessionStart`, `SubagentStart`, `UserPromptSubmit` run Node scripts (inject instructions, track mode, write flag files under `~/.claude` / `~/.config/ponytail`).
- ⚠️ The **ledger** feature (default **on**) spawns a background script that **reads your Claude Code session transcripts** (`~/.claude/projects/**/*.jsonl`) to compute cost/turn/token stats per task and writes CSV rows to `~/.config/ponytail/band/`. Local only, but it processes everything you've typed in Claude Code.
- ⚠️ Optional **webhook** sends each row (and, by default, task names/first prompts) to an https URL you configure. Empty by default, so nothing leaves the machine.
- ✅ MIT, readable JS, no obfuscation found.

**Verdict:** low risk, limited fit. Its minimalism suits Route Handlers, utils and tests, but it pushes against the rich motion/UI work that is the point of this site. If you install it, turn the ledger off, leave the webhook empty, and don't use "ultra" mode.
```bash
/plugin marketplace add DietrichGebert/ponytail
/plugin install ponytail@ponytail
# then set ledger=false in the plugin's config when prompted, or via /plugin
```

---

## 6. Graphify

**Identity check:** PyPI package `graphifyy`; its `pyproject.toml` points to `Graphify-Labs/graphify` (an older guide links `safishamsi/graphify`, which also still exists). I reviewed the Graphify-Labs tree.

**What it is:** builds a queryable knowledge graph of a codebase using tree-sitter, exposed to the agent via a skill, CLI and optional MCP server.

**Findings**
- ✅ Code parsing is local (tree-sitter, networkx); core dependencies have no HTTP client.
- ⚠️ Optional LLM backends (`openai`, `anthropic`, Azure) are used for non-code content (docs, PDFs) when API keys are present, which sends that content to those providers.
- ⚠️ `graphify claude install` **edits your CLAUDE.md** and adds a **PreToolUse hook**; `graphify hook install` adds **git hooks** (post-commit/checkout/merge/rewrite). Both change behaviour silently on every search or commit.
- ⚠️ Optional MCP server can run over HTTP; `extract --postgres` takes a DB connection string on the command line.

**Verdict:** defer. A marketing site + demos stays small enough that Claude's built-in search is faster and simpler. Revisit past ~50k LOC. If adopted: skip `claude install` (add a 3-line note to CLAUDE.md yourself), skip git hooks, use the stdio MCP only, add `graphify-out/` to `.gitignore`.

---

## 7. OmniRoute

**Identity check:** many same-named repositories exist. A third-party guide (agentpedia.codes, July 2026) identifies **`diegosouzapw/OmniRoute`** (npm `omniroute`) as the AI gateway used with Claude Code; I confirmed the repo exists but **did not review its source**, so everything below comes from that guide and is unverified by me.

**What it is:** a self-hosted AI gateway that sits between Claude Code and many model providers (via `ANTHROPIC_BASE_URL` / `ANTHROPIC_AUTH_TOKEN`), with a dashboard and SQLite store.

**Reported risks:** holds all your provider keys/OAuth tokens and sees every prompt and code snippet; request logging can store full headers and bodies; `REQUIRE_API_KEY` defaults to false and some versions bind to `0.0.0.0`; optional MITM/proxy modes install a root CA; some "stealth" features may breach provider terms and risk account suspension.

**Verdict:** **reject** for this project. It solves multi-provider routing, which you don't need here, and it would become the single point that sees every prompt, key and line of code. If you ever need it, run it bound to `127.0.0.1`, with `REQUIRE_API_KEY=true`, body logging off, no MITM mode, after a source review.

---

## 8. Baseline Claude Code hardening (applies regardless of plugins)

The repo's `.claude/settings.json` (included in this blueprint):
- **Denies** reading `.env*` (except `.env.example`), `secrets/**`, `*.pem`, `*.key`; denies `git push/commit/reset/rebase/merge/clean`, `rm -rf`, `curl`/`wget` piping, `npm publish`.
- **Allows** the verification commands (`pnpm typecheck|lint|test|build|verify`, read-only git) so Claude can check its own work without prompting you.
- Leaves `enableAllProjectMcpServers` **off**, so every new project MCP server needs your explicit approval.

Process rules:
1. Before installing any new skill/plugin/MCP: read its manifest, hooks and scripts (or ask Claude to audit it *without running it*), record it here with the commit reviewed.
2. Install plugins from **your own forks**, so updates are a deliberate, reviewed sync.
3. Put API keys for MCP servers in environment variables or the OS keychain, never in `.mcp.json` literals or command-line args.
4. Re-audit quarterly or when a tool's major version changes.
5. Run `/plugin` and `claude mcp list` at the start of each phase and remove what you no longer use.
