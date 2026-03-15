# CLAUDE.md — K:BOT Project

## I. SYSTEM ROLE

You are the engineering engine for **K:BOT** — an open-source terminal AI agent by kernel.chat group. K:BOT is the primary product. The web companion (kernel.chat) lives in `src/` and `supabase/`.

## II. ARCHITECTURE

### Stack

- **K:BOT CLI**: TypeScript + Node.js 20+ (`packages/kbot/`)
- **Web Companion**: React 19 + TypeScript + Vite (PWA) in `src/`
- **Backend**: Supabase (Auth, Postgres, Edge Functions, Storage)
- **AI**: Multi-provider — Anthropic, OpenAI, Google, + 11 more
- **Deployment**: npm (`@kernel.chat/kbot`) + GitHub Pages (web)

### Directory Map

```
packages/kbot/           # K:BOT — the main product
├── src/
│   ├── cli.ts              # CLI entry point (commander)
│   ├── agent.ts            # Agent loop (think → plan → execute → learn)
│   ├── auth.ts             # API key management, provider detection
│   ├── learning.ts         # Learning engine (patterns, solutions, profile)
│   ├── matrix.ts           # Custom agent creation + mimic profiles
│   ├── streaming.ts        # Streaming for Anthropic + OpenAI
│   ├── planner.ts          # Autonomous plan-execute mode
│   ├── sessions.ts         # Save/resume conversations
│   ├── memory.ts           # Persistent memory across sessions
│   ├── context-manager.ts  # Auto-compaction + token management
│   ├── learned-router.ts   # Pattern-based agent routing
│   ├── prompt-cache.ts     # Prompt caching optimization
│   ├── embeddings.ts       # Local embedding search
│   ├── multimodal.ts       # Image/file handling
│   ├── permissions.ts      # Destructive op confirmation
│   ├── hooks.ts            # Pre/post tool hooks
│   ├── plugins.ts          # Plugin system
│   ├── cloud-sync.ts       # Sync learning data to kernel.chat
│   ├── ui.ts               # Terminal UI (banners, spinners, colors)
│   ├── tui.ts              # Rich TUI mode
│   ├── serve.ts            # HTTP server mode
│   ├── updater.ts          # Auto-update system
│   ├── build-targets.ts    # Cross-platform build targets
│   ├── tools/              # 60+ built-in tools
│   │   ├── files.ts           # File read/write/glob/grep
│   │   ├── bash.ts            # Shell execution
│   │   ├── git.ts             # Git operations
│   │   ├── github.ts          # GitHub API
│   │   ├── search.ts          # Web search
│   │   ├── fetch.ts           # URL fetching
│   │   ├── notebook.ts        # Jupyter notebooks
│   │   ├── sandbox.ts         # Docker sandbox
│   │   ├── browser.ts         # Browser automation
│   │   ├── computer.ts        # Computer use
│   │   ├── background.ts      # Background tasks
│   │   ├── subagent.ts        # Parallel sub-agents
│   │   ├── worktree.ts        # Git worktree isolation
│   │   ├── tasks.ts           # Task management
│   │   ├── parallel.ts        # Parallel execution
│   │   ├── mcp-client.ts      # MCP server consumption
│   │   ├── build-matrix.ts    # Build system tools
│   │   ├── kbot-local.ts       # Local model tools
│   │   └── matrix.ts          # Agent matrix tools
│   └── ide/                # IDE integrations
│       ├── mcp-server.ts      # MCP server for editors
│       ├── acp-server.ts      # ACP server
│       ├── lsp-bridge.ts      # LSP bridge
│       └── bridge.ts          # Shared bridge logic
├── install.sh              # curl installer
├── package.json            # @kernel.chat/kbot
└── tsconfig.json

src/                     # Web companion (kernel.chat)
├── agents/              # Agent definitions
├── engine/              # AI orchestration
├── components/          # React components
├── pages/               # Route pages
├── hooks/               # React hooks
└── index.css            # Design system

supabase/                # Backend
├── functions/           # Edge functions (claude-proxy, etc.)
└── migrations/          # Database migrations

tools/                   # Dev tools & automation
├── kbot-daemon.ts       # 24/7 local automation daemon
├── semantic-search.ts   # Codebase semantic search
├── kernel-monitor.ts    # TUI monitoring dashboard
├── kernel-agents-mcp.ts # Agent team MCP server
└── discord-bot.ts       # Discord bot
```

## III. K:BOT AGENT SYSTEM

### Flow: User Message → Response

1. **Local-first check** — file reads, git, grep execute instantly ($0)
2. **Complexity detection** — simple vs multi-step
3. **Agent routing** — learned patterns + intent classification → specialist
4. **Tool execution loop** — plan, execute tools, verify, self-correct
5. **Learning** — async extraction of patterns, solutions, user profile

### Specialists (17 agents)

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

K:BOT can adopt coding styles: `claude-code`, `cursor`, `copilot`, `nextjs`, `react`, `rust`, `python`, etc.

## IV. COMMANDS

| Command | Purpose |
|---|---|
| `cd packages/kbot && npm run dev` | Run kbot in dev mode |
| `cd packages/kbot && npm run build` | Build kbot for distribution |
| `cd packages/kbot && npm run test` | Run kbot tests |
| `npm run dev` | Start web companion dev server (port 5173) |
| `npm run build` | Build web companion |
| `npm run deploy` | Deploy web to GitHub Pages |

## V. ENVIRONMENT

K:BOT uses `~/.kbot/config.json` for API keys (AES-256-CBC encrypted).

Web companion uses `.env`:
- `VITE_SUPABASE_URL` / `VITE_SUPABASE_KEY` — Supabase connection
- `SUPABASE_SERVICE_KEY` — Service role key (edge functions)

## VI. COMMON PITFALLS

- **kbot won't start**: Check Node.js >= 20. Run `kbot doctor` for diagnostics.
- **Provider 401**: API key expired or invalid. Run `kbot auth` to reconfigure.
- **Local models slow**: First run downloads the model. Subsequent runs are fast.
- **Web build fails**: Usually type errors. Run `npx tsc --noEmit` first.
- **Deploy**: Web goes to GitHub Pages. kbot goes to npm. Different pipelines.
- **CSS**: No Tailwind. All vanilla CSS with `ka-` prefix in `src/index.css`.

## VII. SECURITY

- NEVER commit `.env`, `.pem`, `.key` files
- NEVER expose `SUPABASE_SERVICE_KEY` in client-side code
- NEVER hardcode API keys in source files
- kbot encrypts API keys at rest (AES-256-CBC)
- Destructive bash commands blocked by default
- Tool execution timeout: 5 min

## VIII. AGENT TEAM (Claude Code)

### Agents (`.claude/agents/`)

| Agent | Role |
|-------|------|
| QA | Build verification, regression testing |
| Designer | Design system enforcement, a11y |
| Performance | Bundle budgets, dependency audit |
| Security | Vulnerability scanning, secrets detection |
| Hacker | Red team — exploit attempts, auth bypass |
| DevOps | Deploy pipeline, health checks |
| Product | UX evaluation, mobile-first testing |

### Slash Commands

| Command | What it does |
|---------|-------------|
| `/qa` | Full QA pass |
| `/security-audit` | Security scan |
| `/perf` | Performance audit |
| `/ship` | Gated deploy pipeline |
| `/team` | Run all agents |

### Session Memory

- `SCRATCHPAD.md` — Persistent context between sessions
- Before ending a session, update SCRATCHPAD.md with accomplishments and pending work
