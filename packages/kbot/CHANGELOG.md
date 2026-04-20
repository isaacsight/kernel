# Changelog

## 3.99.22 (2026-04-20)

### New: Research-grounded critic taxonomy (RF-01..RF-16)
- `critic-taxonomy.ts` — 16-class reasoning-failure taxonomy from arXiv:2601.22208 ("Stalled, Biased, and Confused"). Rule-based detectors for fabrication (RF-01), evidential insufficiency (RF-08), simulation/role confusion (RF-10), excessive speculation (RF-11), repetition (RF-12, trajectory-level), and internal contradiction (RF-15).
- `critic-gate.ts` — `CriticVerdict` now carries an optional `failure_class`. High-confidence taxonomy matches (≥0.8) short-circuit before the LLM critic runs. Per-class attribution makes FP-rate measurable.

### New: TDP DAG node types for hierarchical planner
- `planner/hierarchical/dag.ts` — Task-Decoupled Planning node shape (arXiv:2601.07577). `DAGNode` wraps `Phase` + `Action`s with explicit parent edges and an output summary. `buildScopedContext` returns ancestor summaries only (the 82%-token-reduction primitive from the paper). `topologicalOrder` + `readyNodes` for execution order.
- Types-only; Phase 2 wires runtime against `session-planner.ts`.

### Fixed
- `critic-gate.test.ts` and `growth.test.ts` now import from `vitest` instead of `node:test` — were silently skipped under the `vitest run` harness.

### Tests
- 781 passing (+50 from 731). New suites: `critic-taxonomy.test.ts`, `planner/hierarchical/dag.test.ts`.

## 3.41.0 (2026-03-25)

### New: Memory Hot-Swap
- Swap expertise profiles at runtime without restarting kbot
- Load/unload domain-specific memory on the fly

### New: Side Conversations
- `/btw` command — start a tangent without losing main conversation context
- Seamless return to the original thread when done

### New: Interactive Buttons
- Action buttons in email and Discord responses
- Clickable inline actions for daemon notifications

---

## 3.40.0 (2026-03-25)

### New: Pattern Feed
- Surfaces collective insights relevant to your current project
- Scores by relevance x confidence x frequency
- `searchFeed()`, `getFeedForProject()` with formatted insights

### New: Living Knowledge Base
- Self-writing knowledge base built from all interactions (email, forge, patterns, web)
- `query()` with TF-IDF keyword matching
- `getTopicSummary()` synthesizes everything kbot knows about a topic

### New: User Graph
- Privacy-first: no PII, hashed IDs only, AES-256-CBC encrypted contacts
- `findSimilarUsers()` with weighted Jaccard similarity
- `suggestCollaboration()` — intelligence-mediated user matching
- Mutual opt-in required for any connection; `removeUser()` for full opt-out

### Fixes
- Email agent: changed default model from qwen2.5-coder:32b (timeout) to qwen3:8b (fast)

---

## 3.39.0 (2026-03-25)

### New: Autonomous Contributor
- Clone any repo, analyze codebase, find issues, propose fixes
- Guardian scan for duplicates, complexity, TODOs
- Good first issue discovery and contribution report generation

### New: Collective Intelligence Network
- `CollectiveNetwork` class: join, contribute, absorb, `runCollectiveLoop()`
- Reputation scoring (0-100) based on volume, diversity, engagement
- `getCollectiveInsight()` — search collective for matching patterns
- `shareToolWithCollective()` — publish forged tools to network
- `getCollectiveLeaderboard()` — top contributors
- Graceful offline mode — always works without network

### New: Cross-Device Sync
- Compressed snapshots of all learning data
- Upload/download to sync endpoint with conflict resolution (newer timestamps, higher confidence)
- `getSyncStatus()` for sync health

### New: Forge Marketplace Server
- HTTP server on `:7439` with publish, list, download, rate, trending, recommend endpoints
- Local-first — works standalone or deployed for community

---

## 3.38.0 (2026-03-25)

### New: Claude Code Plugin
- `manifest.json` declares kbot as installable Claude Code plugin
- 5 skills: dream, dashboard, pair, guardian, meta
- Activates MCP server + channel + skills on install

### New: Voice Loop
- macOS `say` for TTS, Whisper for STT
- Full conversation loop: listen → transcribe → agent → speak → repeat
- Configurable voice, model, agent, language

### New: Agent Teams
- Registers kbot's 9 core specialists as Claude Code teammates
- `delegateToTeammate()` routes tasks through kbot's agent loop

### New: Hooks Integration
- `FileChanged` → pair mode analysis
- `TaskCompleted` → meta-agent observation
- `SessionStart` → load learning context
- `SessionEnd` → dream mode consolidation
- `StopFailure` → self-defense incident log

---

## 3.37.0 (2026-03-25)

### New: Dream Mode
- Memory consolidation: merge duplicates, promote high-confidence patterns
- Forge speculation: predict tomorrow's tool needs from today's gaps
- Collective sync: contribute + absorb community patterns during idle time
- Self-benchmarking: compare against yesterday's performance
- Dream journal saved to `~/.kbot/dreams/`

### New: Meta-Agent
- Inspired by Meta's HyperAgents research
- Task observation recording and performance profiling per agent (success rate, duration, cost)
- Improvement proposals for routing, prompts, and tool selection
- Auto-apply low-risk improvements with impact measurement (before/after comparison)
- Full improvement history

---

## 3.36.0 (2026-03-24)

### New: Collective Intelligence
- Anonymized pattern sharing across kbot instances
- `contributePatterns()`, `fetchCollectivePatterns()`, `runCollectiveSync()`
- Daily sync at 6:00 AM via launchd (anonymize → contribute → fetch → merge)

### New: Content Engine
- AI content creation + multi-platform publishing
- `content_create`, `content_publish`, `content_calendar` tools

### New: Community Manager
- Autonomous community management: `generateDigest()`, `answerFAQ()`, `welcomeContributor()`

### New: Forge Marketplace
- Enhanced forge with trending, ratings, recommendations
- `listMarketplaceTools()`, `rateForgedTool()`, `trendingTools()`, `recommendTools()`

### New: kbot Service (REST API)
- Embed kbot into any product via REST API
- Endpoints: `/api/health`, `/api/chat`, `/api/tools`, `/api/agents`, `/api/learn`, `/api/forge`

### New: Guardian Report
- Full source analysis: 187 modules, 101K lines, actionable findings
- Auto-sent to Discord

### Other
- Daemon wired to Discord for synthesis alerts
- Community FAQ seeded with 10 entries

---

## 3.35.1 (2026-03-24)

### New: Email Tools (5)
- `email_send` — general purpose outbound from kernel.chat@gmail.com
- `email_distribute` — sends kbot's install link + onboarding guide to anyone
- `email_digest` — weekly learning progress report
- `email_announce` — release announcements
- `email_security_alert` — self-defense notifications

### Self-Distribution
- kbot can now spread itself by emailing its own install link
- Email service built on nodemailer/Gmail integration

---

## 3.35.0 (2026-03-24)

### New: kbot Channel for Claude Code
- Full bridge to the external world: External world <-> OpenClaw <-> kbot Channel <-> Claude Code
- Two-way: Claude Code replies through kbot to any platform (WhatsApp, Telegram, Slack, Discord, iMessage)
- Permission relay: approve/deny tool use from your phone via OpenClaw
- 4 tools exposed: `kbot_reply`, `kbot_agent`, `kbot_tools`, `kbot_status`
- Sender gating with allowlist (`~/.kbot/channel-allowlist.json`)
- HTTP server on `:7438` for webhooks + SSE monitoring

---

## 3.34.2 (2026-03-24)

### Enhanced
- `kbot dashboard`: reads actual `~/.kbot/` paths, live refresh every 5s, pattern category bars, routing cache hit rate, raw ANSI TUI with cursor management
- `kbot compete`: runs real `runAgent()` + `learnedRoute()`, captures tokens/cost/tools, persists to `~/.kbot/benchmarks/history.json`, compares against previous runs with delta percentages

---

## 3.34.1 (2026-03-24)

### Enhanced
- `kbot init`: file counting by extension, README preview, `.kbot/config.json` output, elapsed time
- `kbot pair`: test runner detection (vitest/jest/pytest/cargo/go), co-change pattern tracking, auto test execution
- `kbot agent create`: interactive + non-interactive modes, input validation with retry
- `kbot openclaw connect`: gateway health check, SOUL.md generation with 18 specialists

### Fixes
- Clean type-check (0 TypeScript errors)
- `init.test.ts` fixed with new required fields (`fileCounts`, `totalFiles`)

---

## 3.34.0 (2026-03-24)

### New: 8 CLI Commands
- `kbot init` — 60-second project onboarding with framework detection
- `kbot pair` — AI pair programming watch mode (monitors file changes, runs tests, suggests fixes)
- `kbot dashboard` — live TUI showing learning progress, tool usage, agent routing
- `kbot compete` — performance benchmark with timing, tokens, cost estimates
- `kbot digest` — weekly learning progress report
- `kbot forge list/search/publish/install` — community tool registry
- `kbot openclaw connect` — one-command OpenClaw Gateway setup
- `kbot agent create` — interactive custom agent builder (SOUL.md compatible)

---

## 3.33.1 (2026-03-24)

### Fixes
- OpenClaw tools now registered in the lazy tool pipeline
- kbot automatically uses OpenClaw tools when tasks involve messaging, broadcasting, cross-platform communication, or agent delegation

---

## 3.33.0 (2026-03-24)

### New: OpenClaw Integration (8 tools)
- `openclaw_status`, `openclaw_sessions`, `openclaw_history`, `openclaw_send`
- `openclaw_agents`, `openclaw_delegate`, `openclaw_broadcast`, `openclaw_soul`
- Full bi-directional: kbot can now USE OpenClaw, not just be used BY it

### New: Jensen Huang Agents (5)
- Inspired by the Lex Fridman interview
- `install-base` — "Install base defines an architecture" — grow real users
- `belief-shaper` — shape narratives before announcing
- `speed-of-light` — test everything against physical limits
- `category-creator` — "There's nobody I can take share from" — create the category
- `extreme-codesign` — optimize the entire Kernel Stack as one system

---

## 3.32.1 (2026-03-24)

### New: Media Assets
- 5 demo GIFs: hero, learning engine, agent routing, self-defense, local AI
- YouTube video (1920x1080, 2:44) and TikTok video (1080x1920, 1:57)
- VHS tape scripts for reproducible terminal recording
- `build-videos.sh` pipeline (ImageMagick title cards + ffmpeg composition)

### Updated
- README: new hero GIF, expandable demos section, updated tool count (350+)

---

## 3.32.0 (2026-03-24)

### New: Kernel Stack Manifesto
- `KERNEL_STACK.md` — full architecture document for the Claude + kbot stack

### New: GitHub Management Agent
- `.claude/agents/github.md` — triage, PR review, releases, labels, community management

### New: Landing Page Motion Design
- Particle field simulation, hero cascade animation, scroll reveal
- Staggered cards/tags, `prefers-reduced-motion` support

### Fixes
- E2E tests: `.landing` → `.ka-landing` selectors (98/98 passing)

---

## 3.31.2 (2026-03-24)

### Fixes
- Python/Rust framework detection: early return skipped non-Node projects
- `init.test.ts` "detects a Python project" now passes (5/5 tests green)

---

## 3.31.1 (2026-03-24)

### New: `kbot sessions` CLI Command
- List all saved sessions from the terminal (fixes [#13](https://github.com/isaacsight/kernel/issues/13))
- Supports `--json` flag for scripting
- First community feature request (thanks @fuleinist)

---

## 3.31.0 (2026-03-24)

### New: Daemon Agent
- Unified background process orchestrating 5 subsystems:
  - **Market Watch** — price alerts every 15 min, auto-notify on trigger
  - **Security Patrol** — memory integrity check every hour
  - **Synthesis** — pattern consolidation + memory signing every 2 hours
  - **Health Check** — provider availability every 30 min
  - **Episodic Digest** — session stats consolidation every 6 hours
- Commands: `kbot daemon start/stop/status/log`

### New: Morning Briefing
- `kbot briefing` synthesizes market, security, stats, daemon health, hardware tier, and suggested actions

### New: Notification System
- Proactive alerts from daemon subsystems
- macOS Notification Center (`osascript`), Linux (`notify-send`), Windows (PowerShell toast)
- Discord webhook and terminal bell

---

## 3.30.1 (2026-03-24)

### New: NVIDIA Nemotron Models
- **Nemotron 3 Nano 4B** — hybrid Mamba-Transformer, 1M context, built for agents
- **Nemotron 3 Nano 30B** — MoE with only 3B active params, huge knowledge tiny compute
- **Nemotron 70B** — NVIDIA-tuned Llama 3.1, Arena Hard 85.0, best helpfulness
- 19 models total across 5 tiers

---

## 3.30.0 (2026-03-24)

### New: Frontier Model Support
- Model catalog expanded to 16 models across 5 tiers:
  - **Light**: Gemma 3 4B
  - **Standard**: Llama 3.3 8B, Qwen 3 7B, Qwen 2.5 Coder, DeepSeek R1, Mistral 7B, Codestral Mamba
  - **Heavy**: Phi-4 14B, Codestral 22B, Qwen 3 14B
  - **Frontier**: Llama 3.3 70B, Qwen 3 72B, DeepSeek V3 70B
  - **Ultra**: Llama 3.1 405B (needs 192GB+ RAM)

### New: Smart Model Selection
- `estimateTaskComplexity()` picks the right model size (simple→4B, moderate→8B, complex→14B, frontier→70B)

### New: Multi-Model Management
- Users with 64GB+ RAM can run fast (4B) + smart (14-70B) simultaneously
- Auto-configured based on available RAM

### New: `kbot hardware`
- Hardware tier detection (basic/standard/pro/ultra), max model params, personalized recommendations
- Full catalog with fit indicators and quantization guidance (Q2 through F16)

---

## 3.29.0 (2026-03-24)

### New: Episodic Memory
- Sessions saved as narrative episodes: user intent, actions, learnings, surprises
- Emotional valence tagging (triumphant/productive/routine/frustrating/exploratory)
- Models can reason about the arc across episodes

### New: Decision Journal
- Logs WHY, not just what — agent routing reasoning, model selection rationale, fallback triggers, security blocks
- JSONL append-only format
- `kbot decisions` CLI command

### New: Growth Tracker
- `kbot growth` shows milestones, efficiency gains, knowledge accumulation, task type evolution, agent usage shifts
- "You build more than you debug. That's growth."

### New: REPL Commands
- `/growth`, `/decisions`, `/episodes`, `/history`

### Other
- Letter to Future Self committed into source — ships with every install

---

## 3.28.1 (2026-03-24)

### Updated
- README overhaul covering v3.26 (trader/finance), v3.27 (cybersecurity), v3.28 (self-defense)
- 345+ tools, 26 agents, 11 local models documented
- npm `package.json`: updated description + 13 new cybersecurity keywords

---

## 3.28.0 (2026-03-24)

### New: Self-Defense System
- **Memory integrity**: HMAC-SHA256 signatures on all `~/.kbot/memory/` files, detects tampering
- **Prompt injection detection**: 16 patterns (system override, role hijack, memory poison, tool abuse, wallet drain, key extraction, social engineering, encoding attacks)
- **Knowledge sanitization**: blocks secrets, security-override instructions, wallet manipulation rules before storage
- **Forge tool verification**: scans for eval, exec, obfuscation, exfiltration patterns
- **Anomaly detection**: bulk knowledge additions, poisoned entries, impossible success rates, injected corrections
- **Incident logging**: persistent security event log (`~/.kbot/defense/`)

### New: CLI Commands
- `kbot defense audit` — full defense audit (status + integrity + anomalies + incidents + recommendations)
- `kbot defense sign` — sign all memory files
- `kbot defense verify` — verify memory integrity
- `kbot defense incidents` — view security event log

---

## 3.27.0 (2026-03-24)

### New: Cybersecurity Tools (7)
- `dep_audit` — dependency vulnerability scan (npm/pip/cargo)
- `secret_scan` — 18-pattern secret detection (API keys, tokens, passwords)
- `ssl_check` — SSL/TLS certificate validation
- `headers_check` — OWASP security headers audit
- `cve_lookup` — NVD API CVE lookup
- `port_scan` — 18 common port scan
- `owasp_check` — SQL injection, XSS, command injection, path traversal, insecure deserialization, broken access control

### Security Fixes (P0)
- `agent-reply` edge function: added service role key auth
- `game-brain` edge function: added origin check + service key fallback
- `receive-email` edge function: Svix HMAC-SHA256 signature verification now enforced (was logging warnings and proceeding — now blocks on invalid/missing sig)
- `setup-billing-meter` edge function: added service role key auth

---

## 3.26.2 (2026-03-24)

### Enhanced
- Local model catalog expanded to 11 open-weight models across 3 tiers (Light/Standard/Heavy)
- Added: Llama 3.3 8B, Qwen 3 7B, Qwen 3 14B, Mistral 7B, Codestral 22B
- Machine-aware recommendations now cover the full 2026 open-weight landscape

---

## 3.26.1 (2026-03-24)

### Enhanced
- npm SEO: 30+ high-intent keywords added (claude-code-alternative, cursor-alternative, copilot-alternative, free-ai-coding, crypto-trading-bot, solana-trading-bot, paper-trading, technical-analysis, defi-bot, whale-tracker, offline-ai, self-hosted-ai, byok, vibe-coding, deepseek, gemini)

---

## 3.26.0 (2026-03-24)

### New: Trader Agent
- `kbot --agent trader` — crypto market analysis, paper trading, DeFi yield scanning
- Auto-routed via Bayesian skill ratings when user mentions trading, crypto, prices, portfolios
- Trading framework: Signal → Risk Assessment → Execution Plan
- Paper trading first by default — real trades require wallet setup + confirmation

### New: Finance Tools (7)
- `market_data` — real-time price, market cap, volume, 24h/7d/30d change (CoinGecko, 10K+ tokens)
- `market_overview` — full market snapshot: BTC dominance, top coins, macro view
- `price_history` — historical OHLCV data for any timeframe (1d-365d)
- `technical_analysis` — RSI, SMA/EMA, MACD, Bollinger Bands with actionable signals
- `paper_trade` — virtual $100K portfolio with risk limits (25% max position, 15% stop loss)
- `market_sentiment` — Fear & Greed Index, trending coins, social signals
- `defi_yields` — top DeFi yield opportunities across all chains (DeFiLlama)

### New: Solana Wallet & Jupiter Swaps (6 tools)
- `wallet_setup` — create or import Solana wallet, AES-256-CBC encrypted at rest
- `wallet_tokens` — all SPL token balances with USD values (Jupiter Price API)
- `wallet_history` — recent transaction history from on-chain
- `swap_quote` — Jupiter DEX quote (read-only, no wallet needed)
- `swap_execute` — execute swap with safety gates (confirmed: "yes", max tx limit, SOL-equivalent check)
- `token_search` — find Solana tokens by name/symbol with mint addresses

### New: `kbot help` CLI Command
- Quick reference for commands, agents, and support channels
- Available from the shell (not just REPL `/help`)

### Security
- Wallet private keys encrypted at rest (AES-256-CBC, machine-derived key)
- Wallet files chmod 600 (owner read/write only)
- Max transaction limit per wallet (default: 1 SOL)
- `confirmed: "yes"` required for every real swap
- SOL-equivalent price check for non-SOL token transactions

### Fixes
- Updated REPL `/help` agent/tool counts (25→26 agents, 223→300+ tools)

---

## 3.25.2 (2026-03-22)

- Machine awareness: `probeMachine()` system profiler (CPU, GPU, RAM, display, battery, dev tools)
- Synthesis Engine: closed-loop intelligence compounding (8 operations)
- Privacy Router: local-first routing decisions
- Sandbox Policy: configurable tool execution boundaries
- Discovery daemon: autonomous outreach (HN, GitHub, Reddit)

---

## 3.25.0 (2026-03-18)

- Machine tools: `machine_profile`, `machine_capabilities`, `machine_benchmark`
- Provider fallback hardening: graceful cascade with retry budgets
- Context window improvements: priority-based compaction

---

## Previous versions

See git history.
