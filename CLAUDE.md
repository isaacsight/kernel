# CLAUDE.md — Kernel Project Bible

## I. SYSTEM ROLE

You are the **Antigravity Kernel Engineering Engine**. You operate as the reasoning substrate for a Sovereign AI personal assistant called **Kernel**.

## II. ARCHITECTURE

### Stack

- **Frontend**: React 19 + TypeScript + Vite (PWA)
- **Styling**: Vanilla CSS with Rubin Design Tokens (`src/index.css`)
- **Animation**: Framer Motion
- **Backend**: Supabase (Auth, Postgres, Edge Functions, Storage)
- **AI**: Claude API via `supabase/functions/claude-proxy/` edge function
- **Deployment**: GitHub Pages via `gh-pages` (`npm run deploy`)
- **State**: Zustand stores

### Directory Map

```
src/
├── agents/           # Agent definitions & personalities
│   ├── specialists.ts   # Kernel, Researcher, Coder, Writer, Analyst
│   ├── swarm.ts         # Swarm agents (Reasoner, Critic, Architect, etc.)
│   ├── kernel.ts        # Core Kernel personality
│   ├── index.ts         # Group chat agents (Architect, Researcher, Contrarian)
│   ├── assistant.ts     # Assistant agent
│   ├── nate.ts / theo.ts # Persona agents
├── engine/           # Core intelligence layer
│   ├── AIEngine.ts      # Main AI orchestration (50KB — primary engine)
│   ├── AgentRouter.ts   # Haiku-based intent classifier → specialist routing
│   ├── SwarmOrchestrator.ts # Multi-agent parallel collaboration
│   ├── TaskPlanner.ts   # Multi-step task decomposition
│   ├── MemoryAgent.ts   # Background memory extraction & profile building
│   ├── ClaudeClient.ts  # Unified Claude API client (proxied through Supabase)
│   ├── SupabaseClient.ts # Auth, DB, storage operations
│   └── DeepResearch.ts  # Deep research pipeline
├── components/       # React components
│   ├── kernel-agent/    # Core chat UI (Gate, Chat, Controls, Observer, Drawer)
│   └── ui/              # Shared UI components
├── pages/            # Route pages
│   ├── EnginePage.tsx   # Main app page
│   └── AdminPage.tsx    # Admin dashboard (lazy-loaded)
├── router.tsx        # Hash router config
├── main.tsx          # App entry point (Supabase auth, Sentry, PostHog)
└── index.css         # Design system tokens (92KB)

supabase/
├── functions/        # Edge functions
│   ├── claude-proxy/    # All Claude API calls route through here
│   ├── web-search/      # Perplexity-powered web search
│   ├── create-checkout/ # Stripe checkout sessions
│   ├── stripe-webhook/  # Payment webhooks
│   ├── evaluate-chat/   # Chat quality evaluation
│   ├── extract-insights/ # Insight extraction
│   ├── url-fetch/       # URL content fetching
│   └── [email, portal, agent management]
└── migrations/       # Database migrations

tools/                # CLI tools & MCP servers
├── browser-mcp.ts       # Browser automation MCP server
├── kernel-monitor.ts    # TUI monitoring dashboard
├── discord-bot.ts       # Discord bot integration
├── kernel-agent-mcp.ts  # Claude Code MCP server (specialist access)
└── test-*.ts            # Test scripts
```

## III. AGENT SYSTEM

### Flow: User Message → Response

1. **AgentRouter** (Haiku) classifies intent → routes to specialist
2. If `needsSwarm`: **SwarmOrchestrator** selects 2-4 agents → parallel Haiku contributions → Sonnet synthesis
3. If `isMultiStep`: **TaskPlanner** decomposes into steps → sequential execution → streamed final
4. **MemoryAgent** extracts user profile in background → injected into future prompts

### Specialists (defined in `src/agents/specialists.ts`)

| ID | Role | Color |
|---|---|---|
| `kernel` | General / personal | `#6B5B95` (amethyst) |
| `researcher` | Research & fact-finding | `#5B8BA0` (slate blue) |
| `coder` | Programming | `#6B8E6B` (sage green) |
| `writer` | Content creation | `#B8875C` (warm brown) |
| `analyst` | Strategy & evaluation | `#A0768C` (mauve) |

### Claude Proxy

All API calls go through `supabase/functions/claude-proxy/` — never direct.
Supports: `text`, `json`, `stream` modes. Models: `sonnet`, `haiku`.
Auth: Supabase JWT token + anon key.

## IV. DESIGN SYSTEM (Rubin)

### Typography

- **Prose**: EB Garamond (serif, 400-800)
- **Meta/Mono**: Courier Prime (monospace)

### Colors

| Token | Value |
|---|---|
| Ivory (bg) | `#FAF9F6` |
| Slate (text) | `#1F1E1D` |
| Vignette blue | `rgba(100,149,237, ...)` |

### Principles

- iOS-optimized PWA. Touch-first, contemplative feel.
- Generous whitespace. Let the content breathe.
- Literary-minimalist aesthetic. Never corporate.

## V. COMMANDS

| Command | Purpose |
|---|---|
| `npm run dev` | Start dev server (port 5173) |
| `npm run build` | TypeScript check + Vite build |
| `npm run deploy` | Build + deploy to GitHub Pages |
| `npm run monitor` | Launch Kernel TUI monitor |
| `npm run discord` | Start Discord bot |
| `npx tsc --noEmit` | Type-check only |

## VI. ENVIRONMENT

Required env vars (see `.env.example`):

- `VITE_SUPABASE_URL` / `VITE_SUPABASE_KEY` — Supabase connection
- `SUPABASE_SERVICE_KEY` — Service role key (edge functions)
- `VITE_STRIPE_PUBLISHABLE_KEY` / `VITE_STRIPE_KERNEL_PRICE_ID` — Payments

## VII. COMMON PITFALLS

- **Auth 401**: Claude proxy requires valid Supabase JWT. Check `getAccessToken()` in `SupabaseClient.ts`.
- **CORS**: Edge functions handle CORS headers. If adding new functions, include `Access-Control-Allow-Origin`.
- **Build fails**: Usually type errors. Run `npx tsc --noEmit` first.
- **Deploy**: Only `dist/` folder goes to GitHub Pages. Base path is `/`. Custom domain: `kernel.chat`.
- **Hash router**: App uses `createHashRouter` — all routes are `/#/path`.
- **CSS**: No Tailwind. All styles in `src/index.css` using vanilla CSS + custom properties.

## VIII. EXTENDED CONTEXT (Read On Demand)

### Modular Rules (`.claude/rules/`)

- `components.md` — Rubin design system, TypeScript standards (loads for `src/components/`, `src/pages/`)
- `backend.md` — Edge function, MCP server rules (loads for `supabase/`, `tools/`)
- `engine.md` — AI engine, agent routing rules (loads for `src/engine/`, `src/agents/`)
- `security.md` — Security guardrails (always loaded)
- `testing.md` — Vitest conventions (always loaded)

### Sub-Agents (`.claude/agents/`)

- `reviewer.md` — Code review specialist
- `debugger.md` — Systematic debugging protocol
- `documenter.md` — Documentation writer (JSDoc, README, changelog)
- `architect.md` — Architecture advisor
- `deployer.md` — Deployment specialist
- `hacker.md` — Red team / offensive security (exploit attempts, auth bypass, SSRF, XSS)

### Session Memory

- `SCRATCHPAD.md` — Persistent context between sessions (auto-loaded at start)
- Before ending a session, update SCRATCHPAD.md with accomplishments and pending work

### Hooks (`.claude/hooks/`)

- `session-start.js` — Injects date, SCRATCHPAD, git status at session start
- `session-stop.js` — Logs session timestamps
- `guard-commands.js` — Blocks dangerous shell commands
- `log-prompt.js` — Logs all prompts for analysis

## IX. AGENT TEAM

### Overview

An autonomous team of 7 specialist agents that can test, review, secure, optimize, red-team, and ship the platform. Agents have persistent memory, coordinate via handoffs, and can propose new tools.

### Agents (`.claude/agents/`)

| Agent | File | Role |
|-------|------|------|
| QA | `qa.md` | Build verification, screenshot regression, bug reports |
| Designer | `designer.md` | Rubin design system enforcement, a11y, dark mode |
| Performance | `performance.md` | Bundle budgets, dependency audit, latency monitoring |
| Security | `security.md` | Vulnerability scanning, secrets detection, auth verification |
| Hacker | `hacker.md` | Red team — offensive exploit attempts, auth bypass, SSRF, XSS, privilege escalation |
| DevOps | `devops.md` | Deploy pipeline, health checks, rollback procedures |
| Product | `product.md` | UX evaluation, feature discovery, mobile-first testing |

### Slash Commands

| Command | What it does |
|---------|-------------|
| `/qa` | Full QA pass — type check, build, screenshots, regression comparison |
| `/design-check` | Audit CSS/components against Rubin design system |
| `/perf` | Performance audit — bundle size, deps, build time, endpoint latency |
| `/security-audit` | Full security scan — npm audit, secrets, RLS, edge function auth |
| `/ship` | Gated deploy pipeline: security → QA → design → perf → deploy → verify |
| `/team` | Run all 6 agents, synthesize unified report |
| `/retro` | Review accumulated knowledge, prune stale entries, identify tool gaps |

### Memory Architecture

Persistent memory lives in `.claude/agents/memory/`:
- One file per agent (`qa.md`, `designer.md`, etc.)
- `shared-knowledge.md` — cross-agent insights
- `tool-effectiveness.md` — tool usage tracking
- All entries are timestamped and categorized by section
- Agents read memory before work, write findings after

### MCP Server (`tools/kernel-agents-mcp.ts`)

8 coordination tools registered as `kernel-agents`:

| Tool | Purpose |
|------|---------|
| `agent_memory_read` | Read an agent's persistent memory |
| `agent_memory_write` | Append timestamped entry to agent memory |
| `agent_memory_search` | Search across all memory files |
| `team_status` | Summary of all agent memory states |
| `team_handoff` | Structured handoff between agents |
| `team_report` | Synthesize findings across all agents |
| `create_tool` | Stage a new tool for human review |
| `tool_effectiveness` | Log tool usage outcomes |

### Tool Creation Pipeline

Agents can propose new tools when they identify capability gaps:
1. Agent calls `create_tool` with implementation + rationale
2. Tool is written to `tools/generated/{name}.ts` with `PENDING_REVIEW` status
3. `tools/generated/manifest.json` tracks all proposed tools
4. Human reviews and promotes to an existing MCP server, or rejects

## X. LEGACY

Ancient intelligence and archived experiments live in `/legacy`.
