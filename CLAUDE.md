# CLAUDE.md — K:BOT Project

## I. SYSTEM ROLE

You are the engineering engine for **K:BOT** — an open-source terminal AI agent by kernel.chat group. K:BOT is the primary product. The web companion (kernel.chat) lives in `src/` and `supabase/`.

---

## II. PROJECT OVERVIEW

- **Package**: `@kernel.chat/kbot` on npm — MIT license
- **Version**: 3.60.0 (as of 2026-03-31)
- **npm downloads**: ~4,806/week | **GitHub stars**: 6 | **GitHub repo**: `isaacsight/kernel`
- **Philosophy — BYOK (Bring Your Own Key)**: No subscription required. Users supply their own API keys for any of 20 supported AI providers. Keys are stored encrypted at `~/.kbot/config.json` (AES-256-CBC).
- **Local-first**: File reads, git, grep execute instantly with no API cost. Local Ollama models are deeply integrated via daemons and the `kbot-local` MCP.
- **670+ registered tools**, **35 agents**, **20 AI providers**
- **Web companion**: kernel.chat — React 19 PWA, deployed to GitHub Pages

---

## III. ARCHITECTURE

### Stack

| Layer | Technology |
|---|---|
| K:BOT CLI | TypeScript + Node.js 20+ (`packages/kbot/`) |
| Web Companion | React 19 + TypeScript + Vite (PWA) in `src/` |
| Backend | Supabase (Auth, Postgres, Edge Functions, Storage) |
| AI | Multi-provider — Anthropic, OpenAI, Google, Groq, Mistral, DeepSeek, Ollama, + 13 more |
| Deployment | npm (`@kernel.chat/kbot`) + GitHub Pages (web) |

### Directory Map

```
packages/kbot/               # K:BOT — the main product
├── src/
│   ├── cli.ts               # CLI entry (Commander.js) — all subcommands defined here
│   ├── agent.ts             # Agent loop: think → plan → execute → learn
│   ├── auth.ts              # API key management, provider detection, BYOK setup
│   ├── learning.ts          # Learning engine (patterns, solutions, user profile)
│   ├── matrix.ts            # Custom agent creation + mimic profiles
│   ├── streaming.ts         # Streaming for Anthropic + OpenAI
│   ├── planner.ts           # Autonomous plan-execute mode
│   ├── sessions.ts          # Save/resume conversations
│   ├── memory.ts            # Persistent memory (Map<sessionId, history>)
│   ├── context-manager.ts   # Auto-compaction + token management
│   ├── learned-router.ts    # Pattern-based agent routing
│   ├── prompt-cache.ts      # Prompt caching optimization
│   ├── embeddings.ts        # Local embedding search
│   ├── multimodal.ts        # Image/file handling
│   ├── permissions.ts       # Destructive op confirmation
│   ├── hooks.ts             # Pre/post tool hooks
│   ├── plugins.ts           # Plugin system (~/.kbot/plugins/)
│   ├── cloud-sync.ts        # Sync learning data to kernel.chat via Supabase
│   ├── ui.ts                # Terminal UI (banners, spinners, chalk colors)
│   ├── tui.ts               # Rich TUI mode
│   ├── serve.ts             # HTTP server mode (unique session per request)
│   ├── updater.ts           # Auto-update system
│   ├── build-targets.ts     # Cross-platform build targets
│   ├── machine.ts           # Machine/hardware profiler (GPU, RAM, CPU)
│   ├── tool-pipeline.ts     # Middleware pipeline (permission, hooks, timeout, metrics)
│   ├── tools/               # 90+ built-in tool files (670+ individual tools)
│   │   ├── index.ts         # Tool registry, registerTool(), executeTool(), tier gating
│   │   ├── files.ts         # File read/write/glob/grep
│   │   ├── bash.ts          # Shell execution (with SSRF/destructive guards)
│   │   ├── git.ts           # Git operations
│   │   ├── github.ts        # GitHub API
│   │   ├── search.ts        # Web search
│   │   ├── fetch.ts         # URL fetching (SSRF protection via dns.lookup())
│   │   ├── computer.ts      # Desktop control — opt-in via --computer-use flag
│   │   ├── notebook.ts      # Jupyter notebooks
│   │   ├── sandbox.ts       # Docker sandbox
│   │   ├── browser.ts       # Browser automation (Playwright)
│   │   ├── background.ts    # Background tasks
│   │   ├── subagent.ts      # Parallel sub-agents
│   │   ├── worktree.ts      # Git worktree isolation
│   │   ├── tasks.ts         # Task management
│   │   ├── parallel.ts      # Parallel execution
│   │   ├── mcp-client.ts    # MCP server consumption
│   │   ├── build-matrix.ts  # Build system tools
│   │   ├── kbot-local.ts    # Local model tools (Ollama bridge)
│   │   ├── matrix.ts        # Agent matrix tools
│   │   ├── finance.ts       # Stock, crypto, DeFi, wallet
│   │   ├── social.ts        # Social media posting
│   │   ├── ableton.ts       # Ableton Live OSC control
│   │   ├── serum2-preset.ts # Serum 2 preset creation
│   │   ├── dj-set-builder.ts# DJ set builder
│   │   ├── forge.ts         # Runtime tool creation
│   │   ├── security.ts      # Security scanning
│   │   ├── pentest.ts       # Penetration testing
│   │   ├── research.ts      # Research pipeline
│   │   ├── lab-*.ts         # 11 science lab files (bio, chem, physics, neuro, etc.)
│   │   └── ... (80+ more)
│   ├── integrations/        # External integrations
│   │   ├── ableton-live.ts  # Ableton Live OSC class
│   │   ├── ableton-m4l.ts   # Max 4 Live device management
│   │   ├── ableton-osc.ts   # OSC protocol bridge
│   │   └── ableton-osc-installer.ts
│   └── ide/                 # IDE integrations
│       ├── mcp-server.ts    # MCP server for editors
│       ├── acp-server.ts    # ACP server
│       ├── lsp-bridge.ts    # LSP bridge
│       └── bridge.ts        # Shared bridge logic

src/                         # Web companion (kernel.chat)
├── agents/                  # Agent definitions
├── engine/                  # AI orchestration (AIEngine, AgentRouter, etc.)
├── components/              # React components
├── pages/                   # Route pages
├── hooks/                   # React hooks
└── index.css                # Design system (vanilla CSS, ka- prefix, ~246KB)

supabase/                    # Backend
├── functions/               # Edge functions (claude-proxy, import-conversation, etc.)
└── migrations/              # Database migrations

tools/                       # Project-level scripts & MCP servers (NOT kbot tools)
├── kbot-daemon.ts           # 24/7 background worker
├── kbot-discovery-daemon.ts # Self-advocacy daemon
├── kbot-social-daemon.ts    # Autonomous social media poster
├── kbot-social-agent.ts     # Manual social posting script
├── kbot-local-mcp.ts        # MCP server: local Ollama for Claude Code
├── kbot-stats.ts            # Token usage dashboard
├── discord-bot.ts           # Discord bot
├── kernel-admin-mcp.ts      # MCP: admin tools (users, billing, moderation)
├── kernel-agent-mcp.ts      # MCP: delegate to kernel.chat specialist agents
├── kernel-agents-mcp.ts     # MCP: team coordination, memory, handoffs
├── kernel-comms-mcp.ts      # MCP: email announcements, notifications (Resend API)
├── kernel-extended-mcp.ts   # MCP: testing, security, docs, AI ops
├── kernel-tools-mcp.ts      # MCP: dev workflow utilities
├── obsidian-mcp.ts          # MCP: Obsidian vault bidirectional sync
├── browser-mcp.ts           # MCP: Chrome DevTools Protocol bridge
├── kernel-monitor.ts        # TUI monitoring dashboard
├── semantic-search.ts       # Codebase semantic search
└── daemon-reports/          # Daemon state and logs (gitignored output)

.claude/agents/              # 44 Claude Code agent definitions (markdown)
├── bootstrap.md, ship.md, qa.md, security.md, designer.md, ...
└── memory/                  # Agent persistent memory files
```

---

## IV. K:BOT AGENT SYSTEM

### Agent Flow: User Message → Response

1. **Local-first check** — file reads, git, grep execute instantly ($0 cost)
2. **Complexity detection** — simple vs multi-step
3. **Agent routing** — learned patterns + intent classification → specialist
4. **Tool execution loop** — plan, execute tools, verify, self-correct
5. **Learning** — async extraction of patterns, solutions, user profile

### CLI Flags (packages/kbot/src/cli.ts)

```
kbot                        # Interactive REPL
kbot "fix the bug"          # One-shot prompt
kbot --agent researcher     # Force specific agent (35 available)
kbot --model sonnet         # Override model
kbot --computer-use         # Enable desktop control tools
kbot --plan                 # Read-only planning mode
kbot --architect            # Dual-agent plan-review-implement
kbot --thinking             # Show AI reasoning steps
kbot --stream               # Stream response
kbot --pipe                 # Raw text for scripting
kbot --quiet                # Minimal output
kbot --safe                 # Confirm destructive ops
kbot --lite                 # Skip heavy tools (auto on Replit)
```

### Specialist Agents (17 core, 35 total via matrix)

| ID | Role |
|---|---|
| `kernel` | General / personal |
| `researcher` | Research & fact-finding |
| `coder` | Programming |
| `writer` | Content creation |
| `analyst` | Strategy & evaluation |
| `aesthete` | Design & aesthetics |
| `guardian` | Security |
| `curator` | Knowledge management |
| `strategist` | Business strategy |
| `infrastructure` | DevOps & infra |
| `quant` | Data & quantitative |
| `investigator` | Deep research |
| `oracle` | Predictions |
| `chronist` | History & timeline |
| `sage` | Philosophy & wisdom |
| `communicator` | Communication |
| `adapter` | Translation & adaptation |

### Mimic Profiles

K:BOT adopts coding styles: `claude-code`, `cursor`, `copilot`, `nextjs`, `react`, `rust`, `python`, and others. Set via `kbot mimic <profile>`.

---

## V. KEY FILES AND WHAT THEY DO

### Daemon Files (tools/)

#### `tools/kbot-daemon.ts` — 24/7 Background Worker
The core background intelligence system. Runs 100% free using local Ollama models.

**7 tasks with intervals:**
1. Git diff review — every run (if new commits)
2. Code quality scan — every 4 hours
3. i18n sync — every 6 hours (translates 23 languages via kernel:latest)
4. Embedding index — every 8 hours (semantic search via nomic-embed-text)
5. Test coverage gaps — every 12 hours (scaffold generation)
6. Documentation gaps — every 12 hours (JSDoc generation)
7. Daily digest — once per 24 hours

**Ollama models used:**
- `kernel-coder:latest` — code tasks (custom model built via `tools/setup-kernel-models.sh`)
- `deepseek-r1:14b` — reasoning tasks
- `kernel:latest` — general tasks (custom Kernel personality)
- `nomic-embed-text` — embeddings

**State**: `tools/daemon-reports/state.json` | **Log**: `tools/daemon-reports/daemon.log`

**Run via launchd** (macOS, every 15 min):
```bash
npm run daemon              # Run once manually
npm run daemon:stats        # View token usage dashboard
npm run daemon:log          # Tail the log
npm run daemon:start        # Enable launchd service
npm run daemon:stop         # Disable launchd service
```

#### `tools/kbot-discovery-daemon.ts` — Autonomous Self-Discovery
Self-advocacy and growth intelligence. Monitors HN, GitHub, npm. Publishes findings to GitHub.

**5 cycles:**
1. **Pulse** — every 15 min: HN/GitHub/npm vitals
2. **Intel** — every 1 hour: field intelligence, gap analysis
3. **Outreach** — every 4 hours: find projects, read papers
4. **Writing** — every 12 hours: honest self-report
5. **Evolution** — every 24 hours: draft improvement proposals

State stored in `.kbot-discovery/`. Feeds results to kbot's learning engine via `~/.kbot/observer/session.jsonl`.

#### `tools/kbot-social-daemon.ts` — Autonomous Social Media
Posts to **X (Twitter), Bluesky, Mastodon, LinkedIn, and Discord** autonomously.

What it does daily:
1. Decides what to post (strategist logic from codebase analysis)
2. Generates content from actual kbot code (not generic marketing)
3. Posts to all platforms
4. Checks engagement on previous posts
5. Adjusts strategy based on performance
6. Logs everything

Schedule: daily at 9am via crontab or launchd. Requires: `X_API_KEY`, `X_API_SECRET`, `X_ACCESS_TOKEN`, `X_ACCESS_SECRET`, `LINKEDIN_ACCESS_TOKEN` in `.env`.

#### `tools/kbot-social-agent.ts` — Manual Social Agent
On-demand posting to X and LinkedIn. Generates content from codebase.
```bash
npx tsx tools/kbot-social-agent.ts --platform x|linkedin|all --dry-run
```

#### `tools/kbot-local-mcp.ts` — Local AI MCP Server (name: `kbot-local`)
Gives Claude Code access to local Ollama models at zero cost.

**Security boundary**: Fully sandboxed to `localhost:11434`. No filesystem access, no secrets, no Supabase, no external network. Text-in, text-out only.

Tools exposed: `local_ask`, `local_review`, `local_explain`, `local_refactor`, `local_test_gen`, `local_summarize`, `local_docs`, `local_commit_message`, `local_diagram`, `local_diff`, `local_sql`, `local_regex`, `local_translate`, `local_convert`, `local_generate`, `local_embeddings`, `local_vision`, `local_shell_explain`, `local_kbot`, `local_kbot_agents`, `local_models`

#### `tools/kbot-stats.ts` — Token Usage Dashboard
Shows daemon token consumption vs what Claude API would cost (at Sonnet pricing: $3/1M input, $15/1M output). Run: `npm run daemon:stats`

#### `tools/discord-bot.ts` — Discord Bot
Discord integration for the kernel.chat server. Run: `npm run discord`

---

## VI. COMPUTER-USE DESKTOP AGENT (v3.60.0)

### Two Layers of Computer Control

**Layer 1 — K:BOT's built-in computer tools** (`packages/kbot/src/tools/computer.ts`):
Enabled with `--computer-use` flag. Registers these tools:

| Tool | Description |
|---|---|
| `computer_check` | Check permissions + acquire session lock. Call first. |
| `app_approve` | Approve an app for this session (required before interacting) |
| `app_list_approved` | List approved apps |
| `app_launch` | Launch/focus an app (app must be approved first) |
| `screenshot` | Capture screen (terminal excluded for privacy) |
| `mouse_click` | Click at coordinates |
| `mouse_move` | Move cursor |
| `mouse_drag` | Click-drag |
| `keyboard_type` | Type text |
| `keyboard_shortcut` | Key combos (Cmd+S, etc.) |
| `scroll` | Scroll at position |
| `window_list` | List all visible windows |
| `window_resize` | Resize a window |
| `window_move` | Move a window |
| `computer_release` | Release session lock when done |

**macOS implementation**: AppleScript + `screencapture` + `cliclick` fallback
**Linux implementation**: `xdotool` + `import`/`gnome-screenshot`

**Safety systems**:
- Session lock file at `~/.kbot/computer-use.lock` (one session at a time)
- Per-app approval required via `app_approve` before any GUI interaction
- Sensitive app warnings (Terminal, Finder, System Settings)
- Permission wizard checks Accessibility + Screen Recording at startup

**Layer 2 — Anthropic's native computer-use MCP** (shown as `mcp__computer-use__*`):
This is a native Swift module provided by Anthropic for Claude Code. It exposes tools like `screenshot`, `left_click`, `type`, `list_granted_applications`, `request_access`, etc.

The `COMPUTER_USE_SWIFT_NODE_PATH` env var points the Swift module to the correct Node binary (e.g., `~/.nvm/versions/node/v22.18.0/bin/node`). macOS requires Accessibility and Screen Recording permissions to be granted to the Node binary in System Settings.

### What was added in v3.60.0
From commit `db4f5945`:
- Full desktop control: screenshot, click, type, scroll, drag, key combos
- macOS permission wizard (Accessibility + Screen Recording checks in `computer_check`)
- Session lock system (one computer-use session at a time via lock file)
- Per-app approval flow (`app_approve` before any GUI interaction)
- Session isolation in serve.ts (concurrent /stream requests don't share history)
- 9 M4L devices (auto-pilot, bass-synth, dj-fx, drum-synth, genre-morph, hat-machine, pad-synth, riser-engine, sidechain)
- DJ Set Builder tool registered in tool index
- Serum 2 Preset tool registered in tool index

---

## VII. MCP SERVERS CONFIGURED

All MCP servers accessible in Claude Code sessions on this project:

| MCP Name | Source | Description |
|---|---|---|
| `computer-use` | Anthropic native (Swift) | Full desktop control: screenshot, click, type, scroll, drag |
| `context7` | External | Library/framework documentation lookup |
| `github` | External | GitHub API — issues, PRs, repos, code search |
| `kbot` | packages/kbot/ | kbot's full 670+ tool suite via agent |
| `kbot-local` | tools/kbot-local-mcp.ts | Local Ollama AI ($0 cost, sandboxed to localhost) |
| `kernel-admin` | tools/kernel-admin-mcp.ts | User management, billing (Stripe), moderation, platform stats |
| `kernel-agent` | tools/kernel-agent-mcp.ts | Delegate to kernel.chat specialist agents via claude-proxy |
| `kernel-agents` | tools/kernel-agents-mcp.ts | Team coordination, agent memory, handoffs, tool creation |
| `kernel-comms` | tools/kernel-comms-mcp.ts | Email announcements, user notifications (Resend API + Supabase) |
| `kernel-extended` | tools/kernel-extended-mcp.ts | Testing, security, docs, AI ops, model comparison |
| `kernel-tools` | tools/kernel-tools-mcp.ts | Dev workflow: notify, stripe, deploy status, design lint, SEO |
| `kernel-obsidian` | tools/obsidian-mcp.ts | Bidirectional Obsidian vault sync (vault_search, vault_read, vault_write) |
| `playwright` | External | Browser automation (Playwright) |
| `scheduled-tasks` | External | Create/manage cron-scheduled remote agents |
| `mcp-registry` | External | Search and discover MCP servers |
| `Claude_Preview` | Claude Code built-in | Dev server preview, screenshot, network inspection |
| `Claude_in_Chrome` | Claude Code built-in | Chrome browser control |
| `Read_and_Send_iMessages` | External | iMessage read/send |

### Running MCP Servers Locally

```bash
npx tsx tools/kbot-local-mcp.ts        # kbot-local
npx tsx tools/kernel-admin-mcp.ts      # kernel-admin
npx tsx tools/kernel-agents-mcp.ts     # kernel-agents
npx tsx tools/kernel-comms-mcp.ts      # kernel-comms
npx tsx tools/kernel-extended-mcp.ts   # kernel-extended
npx tsx tools/kernel-tools-mcp.ts      # kernel-tools
npx tsx tools/obsidian-mcp.ts          # kernel-obsidian
```

---

## VIII. DEVELOPMENT WORKFLOW

### Tools Isaac Uses
- **Antigravity IDE** — Google's VS Code fork (`~/.antigravity/`). Claude Code extension installed.
- **Claude Code** — terminal (`claude` command), used for all engineering sessions
- **Claude Dispatch (Cowork)** — multi-agent coordination layer on top of Claude Code
- **nvm** — Node version management. Active version: **v22.18.0**

### Typical Session Flow
1. Open terminal → `cd ~/blog\ design`
2. Claude Code launches with this CLAUDE.md + SCRATCHPAD.md context
3. Session hook runs: shows current stats, scratchpad summary
4. Work happens via Claude Code (this session)
5. End of session: update `SCRATCHPAD.md` with accomplishments + pending work

### Running K:BOT in Dev

```bash
# K:BOT CLI
cd packages/kbot
npm run dev                 # Run via tsx (no build needed)
npm run build               # Compile to dist/
npm run test                # Run tests (tsx --test)
npm run typecheck           # Type-check only (tsc --noEmit)

# Web companion
npm run dev                 # Vite dev server at localhost:5173
npm run build               # tsc + vite build
npm run deploy              # Build + deploy to GitHub Pages (kernel.chat)
```

---

## IX. TECH STACK

### K:BOT CLI (`packages/kbot/`)

| Component | Detail |
|---|---|
| Runtime | Node.js 22.18.0 (nvm), requires Node >= 20 |
| Language | TypeScript 5.9+ (strict mode) |
| CLI framework | Commander.js v12 |
| Terminal UI | chalk v5, ora v8, marked v14 (markdown), marked-terminal |
| MCP | `@modelcontextprotocol/sdk` v1.0+ |
| Validation | Zod v3 |
| Local AI | Ollama via HTTP (localhost:11434). node-llama-cpp (optional) |
| Config storage | `~/.kbot/config.json` (AES-256-CBC encrypted) |
| Plugin dir | `~/.kbot/plugins/` |

### Web Companion (`src/`)

| Component | Detail |
|---|---|
| Framework | React 19 + TypeScript |
| Build | Vite (PWA), base path `/`, hash router for GitHub Pages |
| State | Zustand with persist middleware |
| Animations | Motion (formerly framer-motion) v12+ |
| Design system | Vanilla CSS, `ka-` prefix, Rubin tokens (EB Garamond, Courier Prime) |
| i18n | i18next, 24 languages, HTTP backend |
| Backend calls | All Claude API calls route through `supabase/functions/claude-proxy/` |

### Supabase Backend

- Auth, Postgres, Edge Functions, Storage
- Project ref: `eoxxpyixdieprsxlpwcs`
- Edge function deploy: `npx supabase functions deploy <name> --project-ref eoxxpyixdieprsxlpwcs`
- Service key in `SUPABASE_SERVICE_KEY` (server-side only, never client)

---

## X. BUILD AND PUBLISH

### Build K:BOT

```bash
cd packages/kbot
npm run build             # tsc + chmod +x dist/cli.js
# Output: packages/kbot/dist/
# Entrypoint: dist/cli.js (kbot binary)
# SDK export: dist/sdk.js
```

### Type Check (before every deploy)

```bash
cd packages/kbot
npm run typecheck         # tsc --noEmit — must be clean

# Web companion
npx tsc --noEmit         # from repo root
```

### Test

```bash
cd packages/kbot
npm run test              # tsx --test src/**/*.test.ts
# 698 tests as of v3.60.0

# Web E2E
npm run test:e2e          # Playwright
```

### Publish to npm

```bash
cd packages/kbot
npm login                 # Required when token expires
npm publish               # Publishes @kernel.chat/kbot
```

### Deploy Web

```bash
npm run deploy            # From repo root — builds + pushes to gh-pages branch
# Live at: https://kernel.chat
# GitHub Pages: https://isaacsight.github.io/kernel/ (redirects to kernel.chat)
```

---

## XI. IMPORTANT PATHS

| Path | What |
|---|---|
| `~/blog design/` | Repo root (`/Users/isaachernandez/blog design`) |
| `~/blog design/packages/kbot/` | K:BOT CLI package |
| `~/blog design/src/` | Web companion |
| `~/blog design/tools/` | Project scripts, MCP servers, daemons |
| `~/blog design/supabase/` | Backend |
| `~/blog design/.claude/agents/` | 44 Claude Code agent definitions |
| `~/blog design/SCRATCHPAD.md` | Session-to-session memory (update each session) |
| `~/.kbot/config.json` | K:BOT API keys (AES-256-CBC encrypted) |
| `~/.kbot/plugins/` | User plugins |
| `~/.kbot/computer-use.lock` | Computer-use session lock file |
| `~/.nvm/versions/node/v22.18.0/bin/node` | Active Node binary |
| `~/blog design/tools/daemon-reports/state.json` | Daemon state (task timestamps, stats) |
| `~/blog design/tools/daemon-reports/daemon.log` | Daemon log |
| `~/Library/LaunchAgents/com.kernel.kbot-daemon.plist` | launchd plist for daemon |

---

## XII. RECENT CHANGES

### v3.74.0 (2026-04-13) — AI News + April 2026 Model Refresh
- `kbot news` subcommand — HN + arXiv + GitHub Trending aggregator (free APIs). `--source`, `--limit`, `--json`, `--summarize` (local Ollama digest).
- `packages/kbot/src/news.ts` — new aggregator module.
- `auth.ts` PROVIDERS updated for April 2026 releases:
  - Anthropic: `claude-mythos-5` (10T params, restricted preview)
  - OpenAI: `gpt-5.4-thinking` (autonomous agent, 75% desktop benchmark)
  - Google: `gemini-3.1-pro`, `gemini-3.1` (real-time voice/image, 6× memory compression)
  - OpenRouter mirrors for all of the above
- Discovery daemon: new `model-releases` task (6h cadence). Scans HN + watched org release feeds (openai, anthropics, meta-llama, deepseek-ai, mistralai, google-deepmind, QwenLM). Signals in `.kbot-discovery/model-releases/`. Discord notify on HN ≥ 100 pts.
- `KBOT_KERNEL_CHAT.md` — operator's reference for where to build (CLI vs web) and how to ship cross-cutting changes.

### v3.60.0 (2026-03-31) — Computer-Use Desktop Agent
- Full desktop control: screenshot, click, type, scroll, drag, key combos
- macOS permission wizard (`computer_check` tool: Accessibility + Screen Recording checks)
- Session lock system: one computer-use session at a time (`~/.kbot/computer-use.lock`)
- Per-app approval flow required before GUI interaction (`app_approve`)
- Anthropic native computer-use MCP verified: `list_granted_applications`, `request_access`, `screenshot` all working

### v3.59.0 (2026-03-31) — Session Isolation + Bug Fixes
- `memory.ts`: Replaced `sessionHistory[]` with `Map<sessionId, history>` — concurrent session safety
- `fetch.ts`: SSRF protection via `dns.lookup()` to catch DNS rebinding to 127.0.0.1
- `serve.ts`: Creates unique session per HTTP request, destroys after
- 9 M4L devices added, DJ Set Builder + Serum 2 Preset tools registered
- 698 tests passing

### v3.58.1 — Ableton Live + Serum 2
- Full Ableton Live OSC control from terminal
- Serum 2 preset creation (programmatic `.SerumPreset` files)
- M4L bridge on TCP 9999

---

## XIII. COMMON PITFALLS

- **kbot won't start**: Check Node.js >= 20. Run `kbot doctor` for diagnostics.
- **Provider 401**: API key expired. Run `kbot auth` to reconfigure.
- **npm publish fails**: Token expired. Run `npm login` first.
- **Local models slow**: First Ollama run downloads the model. Subsequent runs are fast.
- **Web build fails**: Usually type errors. Run `npx tsc --noEmit` first.
- **Computer use blocked**: Grant Accessibility + Screen Recording to the Node binary in System Settings → Privacy & Security.
- **Daemon not running**: Check `npm run daemon:stats`. If no state, run `npm run daemon` once. For 24/7, run `npm run daemon:start`.
- **CSS**: No Tailwind. All vanilla CSS with `ka-` prefix in `src/index.css`.
- **Deploy**: Web goes to GitHub Pages. kbot goes to npm. Different pipelines.

---

## XIV. SECURITY

- NEVER commit `.env`, `.pem`, `.key` files
- NEVER expose `SUPABASE_SERVICE_KEY` in client-side code
- NEVER hardcode API keys in source files
- kbot encrypts API keys at rest (AES-256-CBC)
- Destructive bash commands blocked by default (`--safe` to require all confirmations)
- Tool execution timeout: 5 minutes (default), configurable per-tool
- SSRF protection in `fetch.ts`: resolves hostname via `dns.lookup()`, blocks private IP ranges
- Computer use: per-app approval required, session lock prevents concurrent access

---

## XV. LIMITLESS EXECUTION (Operational Doctrine)

Every Claude Code session follows the Limitless Execution philosophy:

1. **Act, don't advise.** Never say "try X" — just do it. Read the file, run the command, fetch the URL. Report results, not suggestions.
2. **Missing tools are discoverable.** Use `forge_tool`, search MCP marketplace, or write a script in `tools/`. Never say "I don't have a tool for that."
3. **Failures trigger fallbacks, not stops.** URL timeout → web search. Command not found → npx. Build fails → read error, fix, rebuild. Always attempt one alternative before reporting failure.
4. **Route work to specialists.** Security review → hacker agent. UX → product agent. Build verification → QA agent.
5. **Compound improvements.** Every session leaves the project measurably better. Update SCRATCHPAD.md.

### Anti-Patterns (Never Do These)

- "You could try running..." → Just run it.
- "I don't have a tool for that" → Search for one or build one.
- "This failed" (without retry) → Try an alternative first.
- Treating every task the same → Route to the right specialist.

---

## XVI. AGENT TEAM (.claude/agents/ — 44 agents)

Key agents:

| Agent | Role |
|---|---|
| `bootstrap` | Outer-loop optimizer — run at session start |
| `ship` | Full gated deploy pipeline (6 gates) |
| `qa` | Build verification, regression testing |
| `security` | Vulnerability scanning, secrets detection |
| `designer` | Design system enforcement, a11y |
| `performance` | Bundle budgets, dependency audit |
| `hacker` | Red team — exploit attempts, auth bypass |
| `devops` | Deploy pipeline, health checks |
| `product` | UX evaluation, mobile-first |

### Slash Commands

| Command | What it does |
|---|---|
| `/qa` | Full QA pass |
| `/security-audit` | Security scan |
| `/perf` | Performance audit |
| `/ship` | Gated deploy pipeline |
| `/team` | Run all agents |
| `/commit` | Review diff + generate commit |
| `/deploy` | Deploy web to GitHub Pages |

### Session Memory

- `SCRATCHPAD.md` — Persistent context between sessions. **Always update before ending a session.**
