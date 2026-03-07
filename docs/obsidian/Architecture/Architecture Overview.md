---
tags: [kernel, architecture, reference]
updated: "2026-03-06"
---

# Architecture Overview

## Stack

| Layer | Technology |
|-------|-----------|
| Frontend | React 19 + TypeScript + Vite (PWA) |
| Styling | Vanilla CSS with Rubin Design Tokens (`src/index.css`) |
| Animation | Motion (formerly Framer Motion, v12+) |
| State | Zustand with `persist` middleware |
| Backend | Supabase (Auth, Postgres, Edge Functions, Storage) |
| AI | Claude API via `supabase/functions/claude-proxy/` |
| CLI | K:BOT (`packages/kbot/`) — TypeScript, runs locally |
| Deployment | GitHub Pages (frontend), Supabase (backend) |
| Payments | Stripe (subscriptions + metered overage billing) |
| Domain | kernel.chat (custom domain on GH Pages) |

## Three Surfaces, One Brain

```
┌─────────────┐   ┌─────────────┐   ┌─────────────┐
│  kernel.chat │   │  K:BOT CLI  │   │  REST API   │
│  (React PWA) │   │  (Terminal)  │   │ (/api/chat) │
└──────┬───────┘   └──────┬───────┘   └──────┬───────┘
       │                  │                   │
       └──────────┬───────┴───────────────────┘
                  │
         ┌────────▼────────┐
         │  claude-proxy   │  ← All AI calls route here
         │  (Edge Function)│
         └────────┬────────┘
                  │
    ┌─────────────┼─────────────┐
    │             │             │
┌───▼───┐  ┌─────▼─────┐  ┌───▼────┐
│Postgres│  │  Storage  │  │  Auth  │
│(Memory,│  │  (Files,  │  │(Users, │
│ KG,    │  │  Avatars) │  │ OAuth) │
│ Subs)  │  │           │  │        │
└────────┘  └───────────┘  └────────┘
```

## Directory Map

```
src/
├── agents/           # Agent definitions & personalities
├── engine/           # Core intelligence layer
│   ├── AIEngine.ts      # Main orchestration (50KB)
│   ├── AgentRouter.ts   # Haiku-based intent classifier
│   ├── SwarmOrchestrator.ts # Multi-agent parallel collaboration
│   ├── MemoryAgent.ts   # Background memory extraction
│   ├── Convergence.ts   # Multi-agent perception synthesis
│   ├── ClaudeClient.ts  # Unified Claude API client
│   └── SupabaseClient.ts # DB operations
├── components/       # React components (ka-* CSS prefix)
├── hooks/            # React hooks (auth, billing, chat, voice)
├── pages/            # Route pages (hash router)
├── config/           # Plan limits, motion constants
└── index.css         # Design system tokens (~246KB)

supabase/
├── functions/        # Edge functions (claude-proxy, stripe-webhook, etc.)
└── migrations/       # Database migrations (074+)

packages/kbot/        # CLI agent
├── src/
│   ├── agent.ts      # Core agent loop
│   ├── cli.ts        # REPL + command handling
│   ├── tools/        # Local tools (bash, files, git, search)
│   └── memory.ts     # Local persistent memory

tools/                # MCP servers + utilities
├── obsidian-mcp.ts   # Obsidian ↔ Kernel sync
├── kernel-agents-mcp.ts # Agent team coordination
├── kernel-tools-mcp.ts  # Dev utilities
└── stripe-setup-unified.sh # Stripe billing setup
```

## Key Patterns

- **Hash router** — `createHashRouter` (required for GH Pages, no server rewrites)
- **Zero Tailwind** — All vanilla CSS with `ka-` prefix and Rubin design tokens
- **Bottom-sheet panels** — All settings/info panels use bottom-sheet pattern
- **File routing guard** — `hasFileContent` check: images/PDFs always go direct to Claude (never through swarm/workflow)
- **sessionStorage bridge** — Onboarding writes first message, useChatEngine consumes it
- **Fail-open rate limiting** — Postgres RPC with fallback to allow on error
