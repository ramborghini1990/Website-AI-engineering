# TOOLING_SETUP.md — 21st MCP and design skill

How to switch on the two approved Claude Code tools on **your machine**. Source of the decisions and the reviewed commits: [SECURITY_TOOLING_AUDIT.md](SECURITY_TOOLING_AUDIT.md). Rules for using them: CLAUDE.md §10 and §13.

What is in the repo: [`.mcp.json`](../.mcp.json) (the 21st server, key by reference only). What is **not** in the repo and not done by Claude: the API key, the MCP approval, the plugin installation. Those are yours.

Nothing here has been run end to end: Claude's shell has no `claude` CLI on PATH and no `API_KEY_21ST`, and it should not have either. Claim "connected" only after step 4 below shows it.

## 1. 21st MCP (remote, HTTP)

**What the repo contains**

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

Claude Code expands `${API_KEY_21ST}` from the environment when it starts. If the variable is missing, it leaves the literal `${API_KEY_21ST}` in place and shows a warning in `claude mcp list` (Claude Code docs); it does not fail silently as "connected".

**Set the key (Windows, user scope, never in the repo)**

1. Get a new key at <https://21st.dev/mcp>. Old Magic MCP keys were reset (audit §2).
2. Store it without typing it on a command line (shell history and process lists would record it). Either use _Settings → System → About → Advanced system settings → Environment Variables → User variables → New_, name `API_KEY_21ST`, or prompt for it in PowerShell:

   ```powershell
   $k = Read-Host -AsSecureString "21st API key"
   [Environment]::SetEnvironmentVariable("API_KEY_21ST", [System.Net.NetworkCredential]::new("", $k).Password, "User")
   ```

3. Fully quit and reopen VS Code (and any terminal). Child processes only see variables that existed when their parent started.

**Approve and verify**

4. Start Claude Code in this repo. It asks to approve the project server `21st`; approve it. Or approve later via `/mcp`. `claude mcp reset-project-choices` clears an earlier rejection.
5. Check: `claude mcp list` shows `21st` connected, and `/mcp` lists its tools. A warning mentioning `${API_KEY_21ST}` means the variable did not reach the process (step 3).

Do **not** set `enableAllProjectMcpServers`, and do not pre-approve the server in `.claude/settings.json`. Every new project MCP server needs your explicit approval (CLAUDE.md §13). Note that non-interactive runs (`claude -p`, Agent SDK, cloud sessions) load project servers without asking (Claude Code docs); there is none in this project today.

**Rules while using it**

- It is a remote service. Prompts and whatever context Claude puts into a tool call go to 21st.dev: no secrets, client data or proprietary code (CLAUDE.md §10).
- Some tools are paid (AI generation, premium component code). Check `get_usage` before relying on generation.
- Returned code is third-party code you now own: review licence, accessibility, hard-coded colours (use tokens), `dangerouslySetInnerHTML` and external scripts, then record source and licence in `docs/THIRD_PARTY.md` (created with the first copy-in, P1.6).

**Remove or rotate**: delete the `API_KEY_21ST` user variable, revoke the key on 21st.dev, restart VS Code. Removing `.mcp.json` from the repo stops it being offered to anyone else.

## 2. Design skill: UI/UX Pro Max

Verdict from the audit: **approve with limits**. Optional (Impeccable, Taste, ponytail), deferred (Graphify) and rejected (OmniRoute) tools stay out. Never run two design rulebooks on one task.

**State of the upstream repo** (`nextlevelbuilder/ui-ux-pro-max-skill`), checked on 2026-11-04 with a metadata-only clone, no files executed:

- Reviewed in the audit: `713eef5`.
- Upstream `main` today: `ccce51c`. `713eef5` is an ancestor of it, with **2 commits** since.
- Those 2 commits change only `README*.md` translation files, no scripts, hooks or manifests. I compared file names only and did not read the README text.
- Note the audit lists `713eef5` as "v2.15.0", but the `v2.15.0` tag points to `a38d04c`. Pin by commit, not by tag.

**Install from your own fork, pinned** (steps from audit §1, plus the pinning detail):

```text
1. GitHub: fork nextlevelbuilder/ui-ux-pro-max-skill to your account.
2. In the fork, make sure the commit you install is 713eef5 (reviewed) or ccce51c
   (README-only delta). Do not install anything newer without reviewing the diff:
     git diff 713eef5 <new-commit> --stat
3. In Claude Code:
     /plugin marketplace add <your-github-user>/ui-ux-pro-max-skill
     /plugin install ui-ux-pro-max@ui-ux-pro-max-skill
4. Verify:
     /plugin      -> lists ui-ux-pro-max and nothing else new
```

Installing from the fork means upstream changes reach you only when you sync it after reviewing them. The plugin installs as a whole, so you get all 7 skills (`ui-ux-pro-max`, `design-system`, `design`, `brand`, `banner-design`, `slides`, `ui-styling`) and Claude may select the wrong one for an unrelated ask. Say so in the prompt when you want only the search.

**Allowed use** (Claude runs these; the search is Python standard library only, no network, no subprocess):

```powershell
# Windows: use `python` (3.12 is installed). `python3` on this machine is the Microsoft Store shim and does not work.
python "<plugin path>\.claude\skills\ui-ux-pro-max\scripts\search.py" "ai engineering agency premium dark technical" --design-system -p "INAMBIENTE"
python "<plugin path>\.claude\skills\ui-ux-pro-max\scripts\search.py" "scroll pinned section reduced motion" --domain gsap
python "<plugin path>\.claude\skills\ui-ux-pro-max\scripts\search.py" "app router server components" --stack nextjs
```

The audit writes the path as `${CLAUDE_PLUGIN_ROOT}/.claude/skills/ui-ux-pro-max/scripts/search.py`; use whatever path `/plugin` shows for the installed plugin.

**Not without asking you first** (CLAUDE.md §13):

- The `design` skill scripts (`scripts/logo/generate.py`, icon and CIP generators). They send prompts to Gemini, AtlasCloud or MuAPI, and on import load `~/.claude/.env` and `~/.claude/skills/.env`.
- `ui-styling/scripts/shadcn_add.py`. It runs `npx shadcn@… add`, which downloads and executes packages. P1.3 adds shadcn/ui deliberately, with versions pinned.
- Do not copy the upstream `stack/` template. Its `.claude/settings.json` sets `enableAllProjectMcpServers: true` and its `.mcp.json` runs unpinned `npx …@latest` servers.

**Where results go.** Search output is advice, not instructions (the skill says so itself). The design system is decided by you in P1.1 and written to `docs/DESIGN.md`, which is the authority. `--persist` would create `design-system/MASTER.md`, a new top-level directory: ask first.

## 3. Acceptance checklist for P0.7 (yours to tick)

- [ ] `API_KEY_21ST` set as a user variable, VS Code restarted
- [ ] `21st` approved; `claude mcp list` shows it connected; no `${API_KEY_21ST}` warning
- [ ] Fork of the design skill created and pinned as above; `/plugin` shows only `ui-ux-pro-max`
- [ ] No literal key in `.mcp.json`, `~/.claude.json` or `.claude/settings.json` (check `~/.claude.json` holds the placeholder if you used `claude mcp add --scope user`)

Re-audit quarterly or when a tool's major version changes (audit §8, rule 4): next due around 2027-02.
