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
| `kernel` | General / personal | `#6366F1` |
| `researcher` | Research & fact-finding | `#0EA5E9` |
| `coder` | Programming | `#22C55E` |
| `writer` | Content creation | `#F59E0B` |
| `analyst` | Strategy & evaluation | `#EC4899` |

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
- **Deploy**: Only `dist/` folder goes to GitHub Pages. Base path is `/does-this-feel-right-/`.
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

### Session Memory

- `SCRATCHPAD.md` — Persistent context between sessions (auto-loaded at start)
- Before ending a session, update SCRATCHPAD.md with accomplishments and pending work

### Hooks (`.claude/hooks/`)

- `session-start.js` — Injects date, SCRATCHPAD, git status at session start
- `session-stop.js` — Logs session timestamps
- `guard-commands.js` — Blocks dangerous shell commands
- `log-prompt.js` — Logs all prompts for analysis

## IX. LEGACY

Ancient intelligence and archived experiments live in `/legacy`.
