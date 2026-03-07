---
tags: [kernel, architecture, kbot, cli]
updated: "2026-03-06"
---

# K:BOT — Terminal Agent

K:BOT is Kernel's CLI agent. It gives developers and power users access to the full Kernel agent system from their terminal, with local tool execution and multi-model support.

## What It Is

A local-first AI coding agent that connects to the Kernel platform. Think of it as Claude Code but with Kernel's 17 specialist agents, persistent memory, and unified billing.

```bash
npm install -g kbot
kbot auth              # Paste your API key
kbot "build me a React app"
```

## Key Capabilities

| Feature | Description |
|---------|------------|
| **17 Agents** | Same specialists as web (kernel, researcher, coder, writer, analyst + 12 more) |
| **Local Tools** | Bash execution, file read/write/edit, git operations, code search |
| **Multi-Model** | Anthropic (default), OpenAI, Google, NVIDIA, Ollama (offline) |
| **BYOK** | Bring Your Own Key — no message limits when using personal API keys |
| **Memory** | Local persistent memory at `~/.kbot/memory/context.md` |
| **Streaming** | Real-time streaming responses (Pro+) |
| **Swarm** | Multi-agent parallel collaboration (Max tier) |

## Architecture

```
packages/kbot/
├── src/
│   ├── agent.ts       # Core agent loop (message → route → tools → respond)
│   ├── cli.ts         # REPL, command parsing, plan display
│   ├── auth.ts        # API key management (kn_live_* keys)
│   ├── context.ts     # Project context gathering (git, package.json, etc.)
│   ├── memory.ts      # Local persistent memory (markdown)
│   ├── streaming.ts   # SSE streaming support
│   ├── ui.ts          # Terminal UI (colors, spinners, banners)
│   ├── tools/
│   │   ├── bash.ts    # Shell command execution
│   │   ├── files.ts   # File read/write/edit/create
│   │   ├── git.ts     # Git operations
│   │   ├── search.ts  # Grep/glob code search
│   │   ├── fetch.ts   # HTTP fetching
│   │   ├── github.ts  # GitHub API integration
│   │   └── ...
│   ├── planner.ts     # Multi-step task decomposition
│   ├── permissions.ts # Tool permission system
│   ├── hooks.ts       # Pre/post tool hooks
│   └── sessions.ts    # Conversation session management
```

## How It Connects to the Platform

1. User authenticates with `kbot auth` → stores `kn_live_*` API key locally
2. Every message goes to `kernel.chat/api/chat` (the `kernel-api` edge function)
3. `validate_api_key()` RPC resolves the user's subscription tier from the `subscriptions` table
4. Message counts go to the same shared pool (`user_memory.monthly_message_count`)
5. Same overage billing as web — unified across surfaces

## Billing (Unified)

K:BOT shares the same message pool as kernel.chat:

| Tier | Messages/mo | Overage | Rate Limit |
|------|-------------|---------|------------|
| Free | 30 | Hard cap | 10/min |
| Pro | 1,000 | $0.05/msg | 60/min |
| Max | 6,000 | $0.04/msg | 180/min |

**BYOK mode:** When using your own API key (Anthropic, OpenAI, etc.), there are no message limits and no charges from Kernel. The user pays their provider directly.

## Commands

| Command | What it does |
|---------|-------------|
| `kbot "prompt"` | One-shot message |
| `kbot` | Interactive REPL |
| `kbot auth` | Set API key |
| `kbot upgrade` | Open pricing page |
| `kbot billing` | Show plan/usage info |
| `/agent <name>` | Switch specialist |
| `/model <name>` | Switch model |
| `/ollama` | Switch to local Ollama |
| `/think` | Toggle extended thinking |
| `/plan` | Toggle planning mode |

## Development

```bash
cd packages/kbot
npm run build          # Build CLI
npm link               # Link globally for testing
kbot --help
```

The CLI is a standalone npm package in the monorepo at `packages/kbot/`. It shares no frontend code — it's pure Node.js/TypeScript with its own dependencies.
