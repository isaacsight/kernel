# SCRATCHPAD — Session Memory

> This file persists context between Claude Code sessions.
> Before ending a session, ask Claude to update this file with what was accomplished and what's pending.
> The SessionStart hook automatically loads this into Claude's context.

## Current Session (2026-03-20 → 2026-03-21)

### Accomplished — kbot becomes autonomous

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
