# SCRATCHPAD — Session Memory

> This file persists context between Claude Code sessions.

## Current Session (2026-03-31 afternoon) — SHIP v3.59.0 + COMPUTER-USE VERIFIED

### Shipped to GitHub, npm pending auth

#### Published to GitHub
- **v3.59.0 committed and pushed** (96 files, +8,157 lines)
- Commit: `ea31a96b` + `1733988a` (serum2 registration fix)

#### What shipped
1. **5 bug fixes** — concurrent session state (memory.ts → Map), selfTrain guard, DNS rebinding SSRF, Gemini/Cohere tool warning, edit_file full-context diff
2. **Session isolation** — serve.ts creates unique session per HTTP request, destroys after
3. **9 M4L devices** — auto-pilot, bass-synth, dj-fx, drum-synth, genre-morph, hat-machine, pad-synth, riser-engine, sidechain
4. **DJ Set Builder** — registered in tool index
5. **Serum 2 Preset tool** — was missing from index, now registered
6. **Computer-use expansion** — 866+ lines added to computer.ts
7. **Ableton Live integration** — OSC-based class in integrations/

#### Computer-Use MCP Verified
- `list_granted_applications` — works
- `request_access` — works (granted Finder)
- `screenshot` — works (captured desktop)
- Significance: kbot goes from terminal-only to full desktop agent

#### Stats
- 698 tests passing (vitest), 0 type errors
- 670+ registered tools
- npm publish blocked — token expired, needs `npm login`

### Not done
- npm publish (needs auth)
- GitHub release (can do next session)
- Show HN post
- Video demo

---

## Previous Session (2026-03-31 night) — CODE QUALITY & CONCURRENCY FIXES

### Night shift — 5 bug fixes, 1 security fix, 8 new tests

#### Bug Fixes Applied
1. **Concurrent state in memory.ts** — Replaced single `sessionHistory` array with `Map<string, ConversationTurn[]>` keyed by session ID. All functions accept optional `sessionId` param (default `'default'`). Added `destroySession()` for serve mode cleanup. CLI unchanged.
2. **Concurrent state in learning.ts** — Added concurrency docs (shared state is intentional for learning). Added `selfTrainRunning` guard to prevent overlapping `selfTrain()` runs.
3. **DNS rebinding in fetch.ts** — SSRF protection now resolves hostname via `dns.lookup()` and checks resolved IP against blocked ranges. Domains pointing to 127.0.0.1 are now caught.
4. **Gemini/Cohere silent degradation** — Added upfront warning when these providers are used with tools: "provider doesn't support native tool calling — tools will be parsed from text output".
5. **edit_file diff preview** — Now passes full file content to diff preview (was passing just the matched fragment). Diff algorithm shows 3 lines of context with `...` separators.

#### Serve Mode Session Isolation (bonus)
- Wired `sessionId` through `AgentOptions` → `runAgent` → all memory calls
- `serve.ts` now creates a unique session per HTTP request and destroys it after
- Concurrent `/stream` requests no longer share conversation history

#### Tests
- 8 new session isolation tests in memory.test.ts
- **698 tests passing** (up from 690)
- 0 type errors (tsc --noEmit clean)
- Clean build

#### Stats
- 600 registered tools (verified: 549 in tools/ + 51 elsewhere)
- README "600+" claim is accurate

---

## Previous Session (2026-03-29/30) — ABLETON BRAIN + M4L + TERMINAL CONTROL

### Built AI music production system + full terminal control for platform ops

**Published:** @kernel.chat/kbot@3.54.0, 3.55.0, 3.56.0 (npm + GitHub)

### Terminal Control System (v3.56.0)
- **6 new CLI command groups, 32 new tools** — everything manageable from terminal
- `kbot admin` — users, billing (Stripe), moderation, platform stats (6 tools)
- `kbot monitor` — live health dashboard, logs, uptime checks, alerts (4 tools)
- `kbot deploy` — all-in-one ship: web + functions + npm + release (5 tools)
- `kbot analytics` — npm downloads, GitHub traffic, user growth, revenue (5 tools)
- `kbot env` — secrets management, sync, rotation guides (5 tools)
- `kbot db` — backup, inspect, SQL, migrations, health check (6 tools)
- Fixed pre-existing duplicate 'sessions' command bug
- GitHub release: https://github.com/isaacsight/kernel/releases/tag/v3.56.0

### Key Builds
- 9 M4L devices, DJ set builder, Serum 2 preset tool
- M4L bridge working on TCP 9999
- 30-min premixed trap set (664 bars, 16,778 notes, F minor, 144 BPM)
- 7 drum patterns, Roland Cloud instruments

---

## Previous Sessions

### 2026-03-26: UNIVERSITY SESSION
- 4 npm publishes. v3.42.0 → v3.45.0
- 114 science tools across 11 lab files
- See git history for full details

### 2026-03-24: MEGA SESSION
- 13 npm publishes. v3.26.0 → v3.31.2
- Finance stack, cybersecurity, self-defense, cognitive systems
- ~10,000 lines, 350+ tools, 26 agents

### 2026-03-22 → 2026-03-23: SYNTH Game Build
- 60+ source files, 45K+ lines at kernel.chat/#/play

### Prior
See git history.
