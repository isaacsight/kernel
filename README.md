# K:BOT

Open-source terminal AI agent. 17 specialists, 60+ tools, 14 providers, local-first.

```bash
npx @kernel.chat/kbot
```

## What is K:BOT?

K:BOT is a terminal AI agent that works right where you do — your command line. Ask it questions, have it write code, search the web, manage git, run shell commands, and more. It picks the right specialist for your task automatically.

Use any AI provider you want (Claude, GPT, Gemini, Mistral, etc.) or run fully offline with Ollama. Your keys, your models, your machine.

## Quick Start

```bash
# Install globally
npm install -g @kernel.chat/kbot

# Or run directly (no install)
npx @kernel.chat/kbot

# Or use the install script
curl -fsSL https://kernel.chat/install.sh | bash
```

```bash
# Interactive mode
kbot

# One-shot
kbot "explain this codebase"
kbot "fix the auth bug in src/auth.ts"
kbot "create a Dockerfile for this project"

# Pipe mode (for scripting)
kbot -p "generate a migration for user roles" > migration.sql

# Use local models (free, no API key)
kbot ollama

# Set up your API key
kbot auth
```

## Features

- **17 Specialist Agents** — Kernel, Researcher, Coder, Writer, Analyst, Aesthete, Guardian, Curator, Strategist, Infrastructure, Quant, Investigator, Oracle, Chronist, Sage, Communicator, Adapter
- **60+ Tools** — File read/write, bash, git, GitHub, web search, Jupyter notebooks, Docker sandbox, background tasks, MCP client
- **14 Providers** — Anthropic, OpenAI, Google, Mistral, xAI, DeepSeek, Groq, Together, Fireworks, Perplexity, Cohere, NVIDIA, Ollama, OpenClaw
- **Local-First** — Simple tasks (file reads, git, grep) run locally without an API call
- **Learning Engine** — Caches successful patterns, solutions, and your preferences — gets smarter over time
- **Mimic Matrix** — Code like Claude Code, Cursor, Copilot, or framework experts (Next.js, React, Rust, Python)
- **Subagent System** — Spawn parallel workers for research, coding, and analysis
- **Runs Fully Offline** — `kbot ollama` for $0 local AI with open-weight models
- **Sessions** — Save, resume, and share conversations
- **IDE Integration** — MCP server for VS Code, Cursor, Zed, Neovim

## Slash Commands

| Command | What it does |
|---------|-------------|
| `/agent <name>` | Switch specialist agent |
| `/model <name>` | Switch AI model |
| `/mimic <profile>` | Code like Claude Code, Cursor, Next.js, etc. |
| `/plan <task>` | Autonomous plan → execute mode |
| `/save` | Save your conversation |
| `/resume <id>` | Pick up where you left off |
| `/ollama [model]` | Switch to local models |
| `/thinking` | Toggle extended thinking |
| `/compact` | Compress conversation history |
| `/matrix` | Manage custom agents |
| `/plugins` | Manage plugins |
| `/help` | Full command list |

## Providers

| Provider | Cost | How to set up |
|----------|------|---------------|
| Anthropic (Claude) | $3–15/M tokens | `ANTHROPIC_API_KEY` |
| OpenAI (GPT) | $2.50–10/M tokens | `OPENAI_API_KEY` |
| Google (Gemini) | $0.15–0.60/M tokens | `GOOGLE_API_KEY` |
| Mistral | $0.25–2/M tokens | `MISTRAL_API_KEY` |
| Groq | $0.05–0.27/M tokens | `GROQ_API_KEY` |
| Ollama (Local) | **Free** | `ollama serve` |
| OpenClaw (Local) | **Free** | `openclaw-cmd start` |

Set any provider's env var and K:BOT auto-detects it. Or run `kbot auth` for interactive setup.

## Architecture

```
User Message
    │
    ├─ Local-first check (file reads, git, grep → instant, $0)
    │
    ├─ Complexity detection → Autonomous planner (multi-step)
    │
    └─ Provider API call → Tool execution loop
        │
        ├─ Permission check (destructive ops need confirmation)
        ├─ Pre/post hooks
        ├─ Tool execution (local, with timeout)
        └─ Learning (async — patterns + solutions + profile)
```

## Security

- API keys encrypted at rest (AES-256-CBC)
- Config file restricted to owner (chmod 600)
- Destructive operations require confirmation
- Bash tool blocks dangerous commands (rm -rf /, fork bombs, etc.)
- Tool execution timeout (5 min default)
- Result truncation prevents memory exhaustion (50KB default)

## Development

```bash
cd packages/kbot
npm install
npm run dev          # Run in dev mode (tsx)
npm run build        # Compile TypeScript
npm run test         # Run tests
npm run typecheck    # Type-check only
```

## Web Companion — kernel.chat

K:BOT has a web companion at [kernel.chat](https://kernel.chat) — same 17 agents, persistent memory, and a visual interface. Free to use (10 messages/day).

The web app source lives in `src/` with a Supabase backend in `supabase/`.

## License

MIT — [Antigravity Group](https://antigravitygroup.co)
