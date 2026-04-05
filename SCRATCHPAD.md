# SCRATCHPAD — Session Memory

> This file persists context between Claude Code sessions.

## Current Session (2026-04-02 full day) — MEGA BUILD + ABLETON + LEADERBOARD

### Two-day summary (Apr 1-2): v3.62.0 → v3.73.3

**Shipped:**
- Dream engine (7-tier memory cascade, dreaming daemon)
- Buddy system (8 species, evolution, achievements, chat, trading cards, leaderboard)
- Voice input, memory scanner, user behavior learning
- Service watchdog, morning briefing
- Multi-agent finance, music gen, AI interpretability, cyber threat intel
- A2A protocol, Ollama 0.19 detection, DeepSeek V4 provider
- KBotBridge Remote Script (programmatic Ableton device loading via Browser API)
- iPhone control (Apple ecosystem + mobile-mcp)
- Buddy leaderboard on kernel.chat/#/leaderboard
- Coldplay Clocks session + Empire of the Sun / Tame Impala build
- Install script (kernel.chat/install.sh)
- CI fixed, demo GIF re-recorded, README updated everywhere

**Stats:** 764+ tools, 10 stars, 1,929 downloads (Apr 1), v3.73.3

**Users:** Jae (portfolio analysis emails), Harrison (install help), Ray (agent setup)

**Ableton:** KBotBridge on port 9997, AbletonOSC enabled. Two sessions saved.

**Pending:**
- Collective intelligence plan (partially built, not fully executed)
- iPhone Developer Mode needs Xcode installed for full device control
- X API tokens expired (social posting needs manual)
- Video demo needs better recording (current GIF has issues)
- kernel.chat site updated: scroll fixed, 764+ tools, responsive breakpoints

---

## Previous Session (2026-04-02 afternoon) — HTTPS FIX + USER SUPPORT + MARKETING PUSH

### User Issue: Harrison (hwmccormick123@gmail.com)
- Harrison couldn't connect kbot to Claude Cowork — form requires `https://`, kbot serve only spoke HTTP
- Fixed by adding native HTTPS support to `kbot serve`
- Emailed him the fix via kernel-comms MCP
- Email agent is live and running (launchd `com.kernel.email-agent`) — Harrison can reply and get AI responses via local Ollama

### Shipped: `kbot serve --https`
- **serve.ts** — Added `--https` flag with auto-generated self-signed TLS cert (`~/.kbot/certs/`)
- **cli.ts** — Added `--https`, `--cert <path>`, `--key <path>` flags
- `ensureSelfSignedCert()` — EC P-256 cert via openssl, 365-day validity, localhost + 127.0.0.1 SANs
- Users can also provide custom certs: `kbot serve --cert x.pem --key x.key`
- Clean build, clean typecheck

### Marketing Push
- **HN post live**: https://news.ycombinator.com/item?id=47622060 (Show HN: K:BOT — 738-tool terminal AI agent, plugs into Claude Cowork)
- **X thread drafted** — 4 tweets in `tools/social-posts-2026-04-02.md` (X API tokens expired, needs manual post)
- **LinkedIn drafted** — also in `tools/social-posts-2026-04-02.md`
- **Demo recording script** created at `tools/demo-recording.sh` (asciinema + vhs + agg all installed)
- **Competitor intel**: Skales (BSL-1.1, desktop GUI agent from Vienna, 6 HN points) — kbot differentiates on: true MIT open source, terminal-native, 738 tools, Claude Cowork connector, deeper local AI

### Discovery Daemon Status
- Running: 1,477 total runs, 608 pulses, 70 intel scans, 0 errors today
- Email agent: running via launchd since 6:30 AM
- Ollama: online with qwen2.5-coder:32b + 13 other models
- Resend webhook: active, pointing to Supabase `receive-email` edge function

### Stats
- **738 registered tools**
- **v3.71.0** on npm
- npm: **4,799 downloads/week**, **10 GitHub stars**
- 170 npm versions published

### Not done
- X thread needs manual posting (API tokens expired — needs `X_API_KEY`, `X_API_SECRET`, `X_ACCESS_TOKEN`, `X_ACCESS_SECRET` in `.env`)
- Claude-in-Chrome extension not bridged to Claude Code terminal (separate MCP — not configured in `~/.claude/settings.json`)
- npm publish with HTTPS changes not yet done
- Video demo still pending
- LinkedIn post needs manual posting

---

## Previous Session (2026-04-01 overnight) — CLAUDE CODE LEAK → DREAM ENGINE → NIGHT SHIFT

### Claude Code Source Leak Study + Original Builds

**What happened:** Claude Code's full source (~512K lines TypeScript) leaked via source maps in npm package @anthropic-ai/claude-code@2.1.88. Studied the architecture, built original features inspired by patterns found.

### Shipped: v3.63.0 — Dream Engine + Rival Intel
- **Dream Engine** (dream.ts, 660 lines) — post-session memory consolidation via local Ollama, exponential decay aging, dream journal auto-injected into system prompt
- **5 dream tools** — dream_now, dream_status, dream_journal, dream_search, dream_reinforce
- **Rival Intel Agent** (.claude/agents/rival-intel.md) — competitive intelligence on Claude Code architecture
- **CLI** — `kbot dream run/status/search/journal`
- Published npm + pushed GitHub

### Shipped: v3.64.0 — Night Shift (buddy, voice, scanner)
- **Buddy System** (buddy.ts, 513 lines) — 8 ASCII companion species, 5 moods, deterministic assignment, persistent naming
- **Voice Input** (voice-input.ts, 466 lines) — local STT via whisper.cpp + Ollama, push-to-talk
- **Memory Scanner** (memory-scanner.ts, 564 lines) — passive in-session detection of corrections, preferences, project facts. Hooks into addTurn(), scans every 5 turns.
- **6 new tools** — buddy_status, buddy_rename, voice_listen, voice_status, memory_scan_status, memory_scan_toggle
- Published npm + pushed GitHub

### Stats
- **686 registered tools** (was 671 at session start)
- **v3.64.0** on npm (was v3.62.0 at session start)
- npm: 4,806 downloads/week, 6 GitHub stars

---

## Previous Session (2026-03-31 night) — ABLETON BEAT SESSION: Kalan.FrFr x Don Toliver

### Built a full beat in Ableton Live 12 via kbot OSC + AppleScript automation

#### Session: 142 BPM | F minor | Fm - Db - Ab - Eb progression

**Active tracks (all Roland Cloud):**
1. **TR-808 DRUMS** (track 5) — 81-note pattern: bouncy syncopated kick, clap on 2&4, hi-hats w/ triplet rolls, rimshot, conga
2. **ZENOLOGY 808 BASS** (track 17) — 10-note sub bass pattern, F1→Db2→Ab1→Eb2 with ghost re-triggers
3. **ZENOLOGY MELODY** (track 18) — 14-note dreamy pluck motif, Ab→Bb→C movement
4. **XV-5080 PAD** (track 13) — 16-note wide chord voicings, one per bar
5. **ZENOLOGY COUNTER** (track 20) — 8-note subtle F5/Eb5 fills

**What worked:**
- kbot AbletonOSC tools: transport, track rename, clip create, MIDI write, clip fire, mixer — all solid
- Plugin loading via AppleScript: `View > Search in Browser` → type name → keyboard Down arrows → Return
- ZENOLOGY (not FX) loads with 3 Down arrows to skip past FX presets
- TR-808 loaded via Python Quartz drag from browser to session view
- `cliclick` installed via Homebrew for macOS mouse automation

**What didn't work:**
- `load_plugin` OSC endpoint — always times out (custom kbot extension, not in standard AbletonOSC)
- CGEvent mouse drags — coordinates didn't match screen positions (Retina scaling mismatch)
- IDE terminal steals focus from Ableton on every bash command — solved by running clicks inside `osascript` blocks
- Loading multiple heavy Roland plugins in sequence can crash Ableton

**Presets still needed (user will do manually):**
- ZENOLOGY tracks need bass/pluck/texture presets selected
- XV-5080 needs a pad preset selected
- Add reverb + delay sends on melody and counter tracks

---

## Previous Session (2026-03-31 afternoon) — SHIP v3.59.0 + COMPUTER-USE VERIFIED

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
