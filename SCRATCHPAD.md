# SCRATCHPAD — Session Memory

> This file persists context between Claude Code sessions.
> Before ending a session, ask Claude to update this file with what was accomplished and what's pending.
> The SessionStart hook automatically loads this into Claude's context.

## Current Session (2026-03-19)

### Accomplished — Largest session ever

#### v3.6.0 → v3.11.0 in one session (12 npm versions, 20+ commits)

**New Concepts:**
- **Autotelic Agent** — auto (self) + telos (purpose). Fusion of Bootstrap + Limitless Execution
- **Collective Learning** — anonymized cross-user intelligence (the hive mind / network effect)
- **Federated Stigmergic Learning** — the academic name for what kbot does (research paper written)

**8 Research Breakthroughs Built:**
1. **Voyager Skill Library** — auto-distills successful tool chains into reusable skills
2. **MAR Multi-Persona Reflection** — 5 specialists critique failures, judge synthesizes
3. **Spec-Driven Development** — `kbot spec` generates formal requirements (EARS notation)
4. **Three-Tier Memory Synthesis** — observations → reflections → identity (Stanford Generative Agents)
5. **LATS Tree Search Planning** — Monte Carlo Tree Search for branching plans
6. **GEPA Prompt Self-Optimization** — specialist prompts evolve from execution traces (ICLR 2026)
7. **A2A v0.3 Protocol** — agent-to-agent interop, Agent Cards, task lifecycle
8. **MCP Apps** — interactive HTML/JS UI in conversations (Chart.js, tables, diffs, Mermaid)

**Major Features Built:**
- `kbot status` — unified Kernel dashboard (version, tools, learning, collective, npm, GitHub, bootstrap)
- `kbot automate` — event-driven automations (file watch, schedule, git hooks, webhooks)
- `kbot --plan` — read-only exploration mode (20 read-only tools only)
- `kbot --tree` — LATS tree search planning instead of linear
- `kbot collective` — opt-in collective learning (--enable, --diagnose, --insights)
- `kbot autotelic` — self-purpose + self-agency cycle
- `kbot spec` — spec-driven development
- `kbot a2a` — Agent-to-Agent protocol (card, discover, send, status, cancel, agents, history)
- `kbot apps` — MCP Apps tool listing and rendering
- `kbot immune` — self-audit (renamed from duplicate `audit`)
- Full cognitive stack: 11/11 modules wired into agent loop
- Skills auto-discovery (~/.kbot/skills/ and .kbot/skills/)
- VS Code extension (packages/vscode-kbot/, .vsix packaged)
- CI pipeline (GitHub Actions: web + kbot + vscode, all green)
- Branch protection enabled
- First-run collective prompt for new users

**Infrastructure:**
- GitHub releases: 7 (was 0)
- Description rewritten: leads with "kbot" + install command
- Topics: 20 high-traffic terms
- Discord invite: fixed (permanent, never expires)
- Docker Hub: v3.7.1 (was v2.22.1)
- Edge function: kbot-engine deployed with /collective endpoint
- Migration 086: collective learning schema fixes applied
- kernel.chat: redesigned as kbot landing page (chat removed)
- HN post: drafted at tools/hn-post.md
- Research paper: docs/federated-stigmergic-learning.md
- 4 new agent definitions: autotelic.md, collective.md, plus existing

**Audit Fixes:**
- 7 critical collective learning issues fixed (schema types, RPC params, column names, upsert, return shapes, exit flush, rate limiting)
- Pre-existing test failure fixed (tier gating test bug)
- gamedev.test.ts excluded from vitest (uses node:test)
- Signal quality: real values flowing (classifier_confidence, was_rerouted, response_quality)
- All 317/317 tests passing
- CI fully green

### Pending
- **HN post** — drafted, ready to fire. Best timing: Tue-Thu 8-10am ET. Needs Isaac to post.
- **Social accounts** — @kbot_ai (X), Bluesky, Mastodon not created
- **Social preview image** — OG card is blank white, needs real design
- **VS Code Marketplace** — publisher account costs money, offering via GitHub + npm instead
- **Docker Hub v3.11.0** — Docker is running, can push
- **Tool count update** — package.json still says 290 tools, actual may be higher with new MCP App tools
- **Distribution** — autotelic says 32%. Launch posts are THE bottleneck.

## kbot Current State
- **npm version**: 3.11.0
- **New modules this session**: skill-library, reflection, spec, memory-synthesis, tree-planner, prompt-evolution, a2a-client, mcp-apps, collective, automations, skills-loader
- **Cognitive modules**: 11/11 active
- **Tests**: 317/317 passing
- **Agents**: 23 built-in + autotelic + collective specialist
- **Claude Code agents**: 30 (.md files in .claude/agents/)
- **Providers**: 20
- **Downloads**: ~3,671/week (~1,195/day)
- **Stars**: 1
- **GitHub releases**: 7
- **CI**: Green (3 jobs: web, kbot, vscode)
- **Branch protection**: Enabled
- **Discord**: Working (permanent invite: discord.gg/kdMauM9abG)
- **Docker Hub**: v3.7.1 (needs update to v3.11.0)

## Key Concepts
- **Autotelic** — self-purpose + self-agency. The ultimate agent.
- **Collective Learning** — network effect. More users → better patterns → smarter kbot.
- **Federated Stigmergic Learning** — academic name for collective learning (research paper written)
- **The 0.001%** — kbot is the first AI that gets smarter every time anyone uses it.

## Key Decisions
- **kernel.chat is now a kbot landing page** — chat app removed from homepage
- **VS Code extension via GitHub only** — marketplace costs money
- **Distribution is THE bottleneck** — 32% score, everything else is built
- **Network effect is the moat** — features can be copied, collective intelligence can't
