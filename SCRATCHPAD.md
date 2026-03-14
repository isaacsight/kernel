# SCRATCHPAD — Session Memory

> This file persists context between Claude Code sessions.
> Before ending a session, ask Claude to update this file with what was accomplished and what's pending.
> The SessionStart hook automatically loads this into Claude's context.

## Current Session (2026-03-13)

### Accomplished This Session

#### v2.10.0 → v2.10.1 Published
- **6 new feature modules**: test runner, watch mode, voice mode, export, plugin marketplace, rate limiter
- **Streaming hardening**: retry with exponential backoff (1s/2s/4s) for 429/5xx errors
- **Smarter context management**: priority scoring preserves high-value turns during compaction
- **80 tests across 6 files** (vitest)
- **Rebrand**: "Antigravity Group" → "kernel.chat group" across entire codebase
- **Rename**: `kbot ollama` → `kbot local` (with backwards-compatible alias)
- **Published**: v2.10.0 and v2.10.1 to npm, pushed to GitHub

#### 5 New Modules Built, Wired & Published (prior session)
All 5 modules created by parallel background agents, integrated into codebase, audited, and shipped:

1. **Repo Map** (`src/repo-map.ts`) — Aider-style codebase indexer
   - File tree walking with TS/JS/Python symbol extraction
   - 60s cache, 8KB output cap, respects .gitignore
   - Injected into system prompt for non-casual tasks

2. **Provider Fallback** (`src/provider-fallback.ts`) — LiteLLM-style failover
   - 3-level failback: retry → same-tier → cross-tier
   - Per-provider health tracking (latency/failure metrics, 5-min window)
   - 4 tiers: premium, standard, fast, local

3. **Self-Evaluation** (`src/self-eval.ts`) — Ragas-inspired quality gate
   - Faithfulness + relevancy scoring
   - Auto-retry on low quality scores
   - Toggleable via `--self-eval` flag or `/self-eval` REPL command

4. **Active Memory Tools** (`src/tools/memory-tools.ts`) — Letta/MemGPT-style
   - 4 agent-callable tools: memory_save, memory_search, memory_forget, memory_update
   - JSON storage in `~/.kbot/memory/{category}/`
   - Categories: fact, preference, pattern, solution

5. **Task Ledger** (`src/task-ledger.ts`) — Magentic-One dual-ledger
   - Facts/guesses/plan/progress tracking
   - Auto-replan on: 2+ consecutive failures, >$0.50 cost, >3 tool loops
   - Integrated into planner.ts

#### Integration Points
- `agent.ts`: repo map in system prompt, provider health tracking, self-eval quality gate
- `planner.ts`: task ledger initialization, progress tracking, replan triggers
- `tools/index.ts`: memory tools + browser tools registered
- `cli.ts`: `--self-eval` flag, `/self-eval`, `/health`, `/providers` REPL commands

#### Security Fixes (P2)
- `computer.ts`: Hardened AppleScript escaping (strips control chars, escapes backslashes)
- `.gitignore`: Added `*.pem` and `*.key` patterns
- OOM prevention: safeReadBody() with byte-level streaming caps

#### Version 2.7.0 Published to npm
- Version bumped across: `cli.ts`, `package.json`, `acp-server.ts`, `SKILL.md`
- Tool count updated: 85 → 93 across all files
- `npm publish --access public` — **v2.7.0 live on npm registry**
- Auto-updater will notify existing users

#### QA + Security Audit Passed
- Full QA: typecheck clean, build clean
- Security audit: 3 P2 findings, all fixed
- OpenClaw local AI review: MINOR FIXES rating, no bugs

#### Commits Pushed
- `8d8fe659` — i18n translations for 24 languages
- `25e23d5b` — kbot local model support, OpenClaw MCP
- `05bb00bc` — 37 specialist agents
- `02b5ba57` — session, scholar, auditor, benchmarker agents
- `83bc3d7a` — physicist specialist agent
- `2f858c0b` — v2.7.0: repo map, provider fallback, self-eval, memory tools, task ledger

### Previous Session (2026-03-12)
- Online presence audit (0 stars, 1043 npm downloads)
- Launch preparation (READMEs, LICENSE, SKILL.md, launch drafts)
- CI fix (visual regression tests)
- Version 2.6.0 prep (never published — jumped to 2.7.0)
- i18n expansion (11 new locales)

### Pending
- **Fix kbot API key** — User's Anthropic key shows "invalid x-api-key". Run `kbot auth` to reconfigure.
- **Launch posts** — drafts ready in `tools/launch-drafts.md`, update to reflect `kbot local` naming
- **iOS Capacitor sync** — Homebrew Ruby installed, need to install CocoaPods then `npx cap sync ios`
- **awesome-openclaw-skills PR** — blocked until skill gains traction on ClawHub

## Key Decisions
- **Repo identity**: K:BOT is the primary product. kernel.chat web app is the "companion."
- **Free tier**: 20 msgs/day, no subscription push. UPGRADES_ENABLED = false in useBilling.ts.
- **8th-grade copy**: All user-facing text written simply, no jargon.
- **Zero Tailwind**: All vanilla CSS with `ka-` prefix.
- **Edge function deploys**: ALWAYS use `--no-verify-jwt` flag.
- **Launch strategy**: Spread posts across 5 days (Thu-Tue). Twitter/X first, then HN, then Reddit, then Dev.to.

## Download Stats (as of 2026-03-13)
- **Lifetime**: ~1,100+ downloads (9 days since first publish)
- **Launch day (Mar 4)**: 670
- **v2.3.0 day (Mar 9)**: 187
- **v2.5.0 day (Mar 11)**: 95
- **v2.7.0 published (Mar 13)**: tracking
- **Pattern**: Spikes on release days, flat between

## Test Accounts
- **Free**: `kernel-test-bot@antigravitygroup.co` / `KernelTest2026!`
- **Pro**: `kernel-pro-test@antigravitygroup.co` / `KernelProTest2026`
