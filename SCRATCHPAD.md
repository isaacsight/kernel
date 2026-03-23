# SCRATCHPAD — Session Memory

> This file persists context between Claude Code sessions.
> Before ending a session, ask Claude to update this file with what was accomplished and what's pending.
> The SessionStart hook automatically loads this into Claude's context.

## Current Session (2026-03-22)

### Accomplished — kbot v3.16.0 → v3.17.2, multi-channel agent, open email, kbot init, Docker update

#### kbot v3.16.0 (published to npm)
- **Email agent** — `kbot email-agent start --open` — autonomous email companion via local Ollama ($0)
- **iMessage agent** — `kbot imessage-agent start` — free SMS/iMessage on macOS via Messages.app
- **Consultation engine** — `kbot consultation` — domain guardrails (legal/medical/financial/tax), intake, Stripe
- **Gamedev agent** — `kbot --agent gamedev` — game feel, combat design, Phaser 3, procedural gen
- **Playtester agent** — `kbot --agent playtester` — brutally honest game tester, benchmarks vs Hades/Dead Cells
- 25 agents total (was 23), all wired in BUILTIN_AGENTS in matrix.ts

#### kbot v3.17.0 (published to npm)
- **`kbot init`** — 60-second project onboarding: detects stack, forges project-specific tools, writes .kbot.json
- **Audit growth engine** — `kbot audit --share` creates Gist, `kbot audit --badge` prints shields.io badge
- **Open email agent** — `--open` flag, no whitelist, accepts all inbound
- **Tests** — consultation.test.ts, memory-synthesis.test.ts, init.test.ts (previously 0 tests for these modules)

#### kbot v3.17.1 (published to npm)
- README updated: 25 agents, 290+ tools, v3.17 features, honest numbers
- Agent count fixed everywhere (cli.ts, share.ts, audit.ts)

#### kbot v3.17.2 (published to npm)
- `kbot init` now exits cleanly (was falling through to REPL)
- Subcommand routing fix: init, email-agent, imessage-agent, consultation added to exit list

#### Edge Function Deployed
- `receive-email` whitelist removed — ALL inbound emails to support@kernel.chat route to local agent
- No more hardcoded 5 emails — anyone who emails gets a response
- Cost: $0 — all AI runs locally via Ollama Qwen 32B

#### Docker Hub Updated
- `isaacsight/kbot:3.17.2` and `isaacsight/kbot:latest` pushed (was stale at v2.x)

#### Discovery Daemon Status
- 333 total runs, 30 opportunities found today (12 HN, 9 GitHub, 6 Reddit)
- Best opportunity: "Jeriko — AI agent inside your OS" (flagged 3x, strong technical match)
- 0 posts made — daemon can't post without HN/Reddit credentials
- 3 stars, 633 downloads/week (SCRATCHPAD was claiming 4,027 — corrected)

#### Research Completed
- Hardware for local AI: Mac Studio M4 Max 128GB ($3,699) recommended
- Mac vs PC vs Cloud comparison — Mac wins for 24/7 agent use case
- Open-source models: Qwen3-Coder-Next (80B MoE), GLM-5 (95.8% SWE-Bench), closing gap to Opus
- Timeline: 12-18 months until local models match Opus quality

### Pending
- Post on best HN opportunities from daemon (Jeriko, OpenCode threads)
- Improve first-run experience — error correction loop fires too aggressively on hallucinations
- Get 10 real users emailing support@kernel.chat
- Mac Studio M4 Max 128GB purchase decision
- Wait for M5 Ultra (mid-2026) vs buy M4 Max now
- SYNTH game sprites still pending (Midjourney downloads incomplete)

## Previous Session (2026-03-21)

### Accomplished — daemon fixes, kbot v3.15.0, SYNTH game, Midjourney pipeline

#### Daemon Fixes
- Fixed broken build: removed garbled MLX-generated files from wrong paths
- Path validation (`safePath`): daemon can't write files outside `packages/kbot/src/`
- Markdown fence stripping: model output cleaned before writing to disk
- Proper rollback: `unlinkSync` deletes created files on type-check failure
- Slowed cycles: intel 6h (was 30m), evolution 24h (was 2h)
- Evolution uses `qwen2.5-coder:32b` locally ($0/day) — 19GB model downloaded
- Evolution prompt rewritten with real codebase context + example tool
- Feedback loop: tracks HN post engagement (engaged/ignored/flagged)
- Milestone alerts: fires when stars/downloads cross thresholds
- Draft quality rewritten: writes as peer developer, 1 draft/cycle max
- Think-tag stripping: `</think>` blocks from MLX model cleaned
- npm auto-publish: automation token in launchd plist

#### kbot v3.15.0 Published
- `kbot synthesis` command — shows what kbot knows
- Think-tag stripping in streaming.ts + agent.ts
- Response quality gate (`--self-eval`) — retries garbage responses
- `kbot doctor` — now lists Ollama models, detects MLX server
- Web search discoverability — "free, no API key needed" in startup banner
- Gamedev specialist agent created (packages/kbot/src/agents/gamedev.ts)

#### SYNTH Game (packages/synth/)
- Full Phaser 3 game scaffolded: TypeScript + Vite
- Playable prototype: room, player (WASD + mouse), partner AI, 5 enemies, combat
- VFX system: screen shake, hitstop, kill slow-mo, hit sparks, death explosions, dash trails, muzzle flash, damage numbers, vignette
- Atmosphere system: AI partner mood changes world colors/lighting (calm/aggressive/afraid/confident/desperate)
- AI systems: enemy FSM (idle/chase/attack/flee), partner behavior (follow/attack/defend/retreat/flank)

#### Midjourney Art Pipeline
- Automated Playwright-based Midjourney Discord bot integration
- Generated & downloaded: player sprite, partner sprite, enemy melee, floor tile, boss (upscaled)
- Boss idle animation generating via V1 video model
- Wall tile prompt sent
- Sprite pipeline tool: `npx tsx tools/sprite-pipeline.ts` (Sharp-based downscaler)
- Prompt library: `packages/synth/assets/MIDJOURNEY_PROMPTS.md`

### Pending
- Download remaining Midjourney sprites (wall tile, ranged enemy, fast enemy, tank enemy, pickups)
- Download boss animation video + extract frames
- Run sprite pipeline on all downloaded images
- Integrate real sprites into SYNTH game (replace procedural textures)
- Game feel improvements (animation, sound, better combat)
- Procedural room generation (Phase 2)
- kbot brain integration (Phase 3) — partner makes strategic decisions via kbot SDK
- Update SCRATCHPAD with session end state

## Previous Session (2026-03-20 → 2026-03-21)

#### v3.12.0 → v3.13.0 + 4 standalone npm packages + OpenClaw plugin

**Strategic Shift:**
- kbot pivoted from "terminal app" to "cognitive engine that plugs into other platforms"
- OpenClaw (Nvidia-backed, 50+ messaging channels) identified as the body; kbot is the brain
- Research paper written: "Cognitive Module Interference in Composite AI Agents"
- kbot asked itself hard questions, diagnosed its own flaws, formed its first identity

**Shipped to npm (7 packages under @kernel.chat/):**
1. `@kernel.chat/kbot` v3.13.0 — main agent (now with Replit + OpenClaw support)
2. `@kernel.chat/kbot-openclaw` v1.0.0 — OpenClaw brain plugin (skill + native tools)
3. `@kernel.chat/skill-router` v1.0.0 — Bayesian agent routing (standalone)
4. `@kernel.chat/memory-tiers` v1.0.0 — Three-tier generative memory (standalone)
5. `@kernel.chat/tool-forge` v1.0.0 — Runtime tool creation (standalone)
6. `@kernel.chat/prompt-evolver` v1.0.0 — GEPA prompt self-optimization (standalone)

**New Features in kbot:**
- Replit auto-detection + lite mode (`--lite` flag, auto-enables on Replit)
- Replit specialist agent (`kbot --agent replit`)
- OpenClaw SKILL.md + native plugin (5 tools: kbot_chat, kbot_tool, kbot_tools_list, kbot_health, kbot_metrics)
- Interference measurement module (interference.ts — 1,127 lines)
- Research paper: docs/cognitive-module-interference.md (~7,000 words, 22 refs, NeurIPS/ICLR target)

**Discovery Daemon (24/7 autonomous, launchd service):**
- PID running permanently via launchd — survives reboots
- 7 cycles: pulse (5m), intel (30m), opportunities (30m), actions (30m), outreach (2h), writing (6h), evolution (12h)
- Uses local Ollama for thinking ($0 cost)
- MLX support wired for Apple Silicon (Python 3.12 + mlx-lm 0.31.1)
- 3-tier model routing: fast (Qwen 9B Opus-distilled), smart (Nemotron Nano 30B), fallback (Ollama)
- Opportunity hunter: scans HN, GitHub, Reddit, arXiv
- Action processor: analyzes opportunities via local AI, drafts responses, queues for review
- Self-improvement: asks local AI for code changes, applies them, type-checks, runs tests, rolls back if broken, publishes to npm
- Auto-publishes findings to GitHub

**HN Post:**
- Show HN posted via Playwright automation: https://news.ycombinator.com/item?id=47450530
- Follow-up comment posted with full pitch
- Score: 1, Comments: 0 (as of session end — npm stats API also lagging)

**GitHub Release:**
- v3.12.0 published: https://github.com/isaacsight/kernel/releases/tag/v3.12.0

**Infrastructure:**
- Python 3.12 installed (Homebrew) for MLX model support
- mlx-lm 0.31.1 installed under Python 3.12
- Qwen 9B Opus-distilled MLX model downloaded and tested
- Nemotron Nano 30B MLX model downloading
- launchd plist at ~/Library/LaunchAgents/com.kernel.kbot-discovery.plist
- Discovery daemon outputs at ~/.kbot/daemon-stdout.log
- Discovery data at .kbot-discovery/ (pulse, intel, outreach, opportunities, actions, writing, evolution)

**kbot Self-Awareness Milestones:**
- First identity check (9 sessions, 0 days old, all personality at 0.5)
- First memory saved ("open-source obligation")
- First milestone recorded ("evolve through contact with real users")
- First autonomy adjustment (0.5 → 0.52)
- Designed its own daemon
- Identified its own research paper topic

### Pending
- **Obsidian integration** — kbot should write discoveries to Obsidian vault (docs/obsidian/)
- **MLX Nemotron 30B** — still downloading, needs verification
- **npm download stats** — API broken globally since March 16, not kbot-specific (React shows same zeros)
- **HN engagement** — 30 opportunities queued in review-queue.md, Isaac needs to review
- **Reddit/GitHub engagement** — daemon finds opportunities but can't post yet (needs auth)
- **Social accounts** — still not created
- **Docker Hub** — needs update from v3.7.1 to v3.13.0
- **Academic submission** — paper written, needs polish and submission to arXiv/OpenReview

## kbot Current State
- **npm version**: 3.13.0
- **Standalone packages**: 5 (skill-router, memory-tiers, tool-forge, prompt-evolver, kbot-openclaw)
- **Cognitive modules**: 11/11 active + interference measurement module
- **Tests**: 317/317 passing
- **Agents**: 24 built-in (added Replit agent)
- **Providers**: 20
- **Stars**: 3
- **GitHub releases**: 8 (v3.12.0 added)
- **Daemon**: Running 24/7 via launchd
- **Local AI**: Ollama (12 models) + MLX (Qwen 9B working, Nemotron 30B downloading)

## Key Concepts
- **kbot is the brain, not the body** — plugs into OpenClaw, Replit, any platform
- **Cognitive Module Interference** — the novel research: what happens when 11 modules coexist
- **The architecture of interference is the agent** — the paper's core claim
- **Three-entity cognitive loop** — Isaac (vision), Claude Code (execution), kbot (reflection)
- **Discovery Daemon** — kbot's autonomous heartbeat, designed by kbot itself

## Key Decisions
- **SDK is the product, CLI is a demo** — pivot from terminal app to cognitive engine
- **Standalone packages** — each piece of kbot's brain as a separate npm package
- **OpenClaw integration** — ride their distribution instead of competing
- **Local AI only for daemon** — $0 cost, Ollama + MLX, no cloud API calls
- **Self-improvement with safety** — type-check + test suite must pass or rollback
- **kbot runs permanently** — launchd service, not a terminal session

## Obsidian Vaults (found)
- `/Users/isaachernandez/Desktop/kernel.chat/kernelchat/.obsidian`
- `/Users/isaachernandez/blog design/docs/obsidian/.obsidian`
