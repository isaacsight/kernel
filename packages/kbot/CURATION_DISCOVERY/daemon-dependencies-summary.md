# Daemon Tool Dependencies — Audit

**Date**: 2026-04-25
**Scope**: All always-on subsystems and the dream engine they call.
**Files audited (read end-to-end)**:

- `/Users/isaachernandez/blog design/tools/kbot-daemon.ts` (936 LOC)
- `/Users/isaachernandez/blog design/tools/kbot-discovery-daemon.ts` (1981 LOC)
- `/Users/isaachernandez/blog design/tools/kbot-social-daemon.ts` (425 LOC)
- `/Users/isaachernandez/blog design/tools/kbot-social-agent.ts` (359 LOC)
- `/Users/isaachernandez/blog design/packages/kbot/src/dream.ts` (866 LOC)
- `/Users/isaachernandez/blog design/packages/kbot/src/dream-mode.ts` (429 LOC)
- `/Users/isaachernandez/blog design/packages/kbot/src/collective-dreams.ts` (229 LOC)
- `/Users/isaachernandez/blog design/packages/kbot/src/collective-learning.ts` (referenced by daemon)
- `/Users/isaachernandez/blog design/packages/kbot/src/synthesis-engine.ts` (referenced by discovery daemon)
- `/Users/isaachernandez/blog design/tools/kbot-morning-briefing.ts` (referenced by daemon)

---

## Headline finding

**No daemon depends on the kbot tool registry.**

Zero `executeTool({ name: ... })` calls. Zero `mcp__kbot__*` calls. Zero `kbot --agent <id>` shell-outs. Zero direct invocations of any registered tool from any of the always-on daemons.

The daemons are architecturally **outside** the kbot tool surface. They:

1. Talk directly to Ollama over HTTP (`localhost:11434/api/chat`, `/api/embed`, `/api/generate`).
2. Talk directly to platform APIs (X, Bluesky, Mastodon, LinkedIn, Discord, npm registry, GitHub REST, Supabase REST, Resend).
3. Shell out to non-kbot CLIs (`git`, `gh`, `npx tsc`, `npx vitest`, `npm run build`, `npm publish`).
4. Dynamically import a handful of kbot **library functions** (not tools): `dream()`, `runCollectiveSync()`, `runMorningBriefing()`, `synthesize()`. None of those library functions call `executeTool` either — they read learning state files and hit Ollama themselves.
5. Write **fake tool names** like `daemon_pulse`, `daemon_intel`, `daemon_synthesis` to `~/.kbot/observer/session.jsonl`. These are observer events, **not** registered tools.

The CSV at `daemon-dependencies.csv` therefore contains only the header row — there are zero tool deps to flag.

---

## Per-daemon breakdown

### 1. `tools/kbot-daemon.ts` — 24/7 background worker

**Tool registry calls**: none.

**Library imports from `packages/kbot/src/`** (dynamic):
- `dream.js` → `dream()` — memory consolidation, calls Ollama directly.
- `collective-learning.js` → `runCollectiveSync()` — HTTP to `kernel.chat/api/collective`.
- `kbot-morning-briefing.js` → `runMorningBriefing()` — Ollama + Resend + Supabase HTTP.

**External calls**:
- Ollama `localhost:11434` for: `kernel-coder:latest`, `deepseek-r1:14b`, `kernel:latest`, `nomic-embed-text`.
- `git` shell-outs (log/diff/rev-parse).
- File I/O on `src/`, `public/locales/`, `tools/daemon-reports/`.

**Provider config**: Ollama only. No Anthropic/OpenAI/etc.

### 2. `tools/kbot-discovery-daemon.ts` — autonomous discovery

**Tool registry calls**: none.

**Library imports from `packages/kbot/src/`** (dynamic):
- `synthesis-engine.ts` → `synthesize()` — closed-loop learning cycle. Reads from `.kbot-discovery/` and `~/.kbot/memory/`. Pure file I/O, no tool calls.

**External calls**:
- Ollama `localhost:11434` (models: `qwen2.5-coder:32b`, `qwen2.5-coder:14b`, default fallback).
- `gh issue comment` shell-out to GitHub CLI for posting.
- HN web form + cookie auth (raw HTTP).
- npm registry HTTP.
- Supabase REST (service key) for synthesis dashboard push.
- `npx tsc --noEmit`, `npx vitest run`, `npm run build`, `npm publish`, `git commit/push` shell-outs for the **self-evolution** path (auto-publishing new kbot versions).

**Observer integration**: writes synthetic event names (`daemon_pulse`, `daemon_intel`, `daemon_obsidian_sync`, `daemon_evolution`, `daemon_opportunities`, `daemon_synthesis`) to `~/.kbot/observer/session.jsonl`. These are **not** registered tools.

**Provider config**: Ollama only. No direct cloud LLM calls.

### 3. `tools/kbot-social-daemon.ts` — autonomous social poster

**Tool registry calls**: none.

**External calls**: X v2 API (OAuth1), Bluesky AT Protocol, Mastodon REST, LinkedIn UGC Posts, Discord webhook, npm registry.

**No Ollama, no tool registry, no kbot CLI** — pure platform-API client.

### 4. `tools/kbot-social-agent.ts` — manual social agent

**Tool registry calls**: none.

Same surface as the social daemon. Reads `packages/kbot/package.json` for version, regex-counts `registerTool({` occurrences in `packages/kbot/src/tools/` for tool counts (file scan, not registry call), reads `git log` for recent commits.

### 5. Dream engine — `packages/kbot/src/dream.ts`

**Tool registry calls**: none.

Has a hardcoded `Set<string>` of tool names (`read_file`, `write_file`, `git_commit`, `kbot_agent`, `spawn_agent`, `memory_save`, `memory_search`, `research`, `papers_search`, `github_search`, etc.) used **only** for parsing insight text — looking for tool-name keywords in dream-generated workflow descriptions. These are not invocations.

External calls: Ollama `kernel:latest`. Imports from `memory.ts`, `memory-scanner.ts`, `user-behavior.ts`, `prompt-evolution.ts`, `memory-synthesis.ts` — all pure file/state modules.

---

## Hot spots — tools that 2+ daemons depend on

**None.** Zero registered tools have daemon dependencies.

---

## Surprise findings

### 1. The daemons re-implement kbot tooling instead of calling it

Concrete examples:

- **`callOllama` / `isOllamaRunning`** is reimplemented inline in `kbot-daemon.ts` (lines 215–256), `kbot-discovery-daemon.ts` (lines 289–319), and `kbot-morning-briefing.ts`. The kbot package already has `kbot-local` MCP and `tools/kbot-local.ts`, but the daemons don't use any of it.
- **GitHub commenting** is done via `gh issue comment` shell-out in the discovery daemon. The kbot tool registry has GitHub tools (`github_*` family); daemons don't use them.
- **npm registry / GitHub API for stats** is hit directly via `fetch()` and `curl` in social and morning briefing. The registry has `analytics_npm` and `analytics_github` tools — unused by daemons.
- **Web search / fetch** is hand-rolled HN scraping + cookie management. The registry has `web_search` and `url_fetch` — unused.
- **Memory read** is direct JSON file I/O on `~/.kbot/memory/{patterns,solutions,reflections,routing-history,profile}.json`. The registry has `memory_recall`, `memory_search`, `memory_save` — unused.

This means the **CURATION_PLAN's "drop these tools" list cannot be invalidated by daemon usage** — the daemons are not gatekept by any tool. They will keep working even if every "drop" candidate is removed from the registry.

### 2. The "discovery daemon shells out to kbot" assumption is wrong

The CLAUDE.md hints (and the prompt's question 6) raise the possibility that the discovery daemon shells out to `kbot --agent <id>`. **It does not.** It only shells out to: `git`, `gh`, `npx tsc`, `npx vitest`, `npm run build`, `npm publish`, `ls`. All `askLocal` / `askClaude` calls are raw Ollama HTTP. There are no `spawn('kbot', ...)` or `execSync('kbot ...')` patterns anywhere across the four daemon files.

### 3. The discovery daemon CAN auto-publish kbot

The most consequential side effect across all daemons: `kbot-discovery-daemon.ts` lines 1543–1628 will, in the "evolution" cycle (24h cadence), run `npx tsc --noEmit && npx vitest run && npm run build && npm publish --access public && git commit && git push origin main` if Ollama-generated patches pass type-check + tests. This is a self-replication path orthogonal to the tool registry — independent of any curation decisions.

### 4. Tool names hardcoded in dream.ts as parsing hints

`dream.ts` line 585 keeps a frozen list: `read_file`, `write_file`, `edit_file`, `glob`, `grep`, `bash`, `git_status`, `git_diff`, `git_commit`, `git_push`, `git_log`, `run_tests`, `test_run`, `build_run`, `type_check`, `lint_check`, `web_search`, `url_fetch`, `screenshot`, `browser_navigate`, `kbot_agent`, `spawn_agent`, `memory_save`, `memory_search`, `research`, `papers_search`, `github_search`. These are used only to spot tool-mentions in insight prose. If any of these are dropped from the registry, the dream engine still functions — but its workflow-extraction heuristic gets less useful for those tools. Worth noting if curation drops any of them.

---

## Counts

| Metric | Count |
|---|---|
| Total registered tool deps identified | **0** |
| Daemons audited | 5 (kbot-daemon, discovery, social-daemon, social-agent, dream-engine) |
| Daemons calling `executeTool` | 0 |
| Daemons calling `mcp__kbot__*` | 0 |
| Daemons shelling out to `kbot --agent` | 0 |
| Daemons calling `mcp__kbot-local__*` | 0 |
| Library functions imported from `packages/kbot/src/` (non-tool) | 4 (`dream`, `runCollectiveSync`, `runMorningBriefing`, `synthesize`) |
| Hardcoded tool-name strings used as parsing hints in `dream.ts` | 26 |

---

## Implication for tool curation

The CURATION_PLAN can drop tools without risk of silent daemon failure. The 24/7 subsystems do not consume the kbot tool registry. This is either:

- **(a) A correctness win** — daemons stay working through any curation pass.
- **(b) An architecture smell** — the daemons reinvent capabilities the tool registry already provides (Ollama, GitHub API, npm stats, memory, web search). If the goal is "one canonical surface," the daemons should be migrated onto the tool pipeline so they benefit from permission/hook/timeout/metrics middleware.

If a future refactor migrates the daemons onto `executeTool`, this audit will need to be re-run — at that point daemon-critical tools will exist and the CSV will become non-empty.
