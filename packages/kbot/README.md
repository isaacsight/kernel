# K:BOT

Open-source terminal AI agent. 17 specialists, 60+ tools, 14 providers, local-first.

## Quick Start

```bash
# Install globally
npm install -g @kernel.chat/kbot

# Set up with your API key (auto-detects provider)
kbot auth

# Or use a local model (no API key needed)
kbot ollama

# Start chatting
kbot
```

## One-Shot Mode

```bash
kbot "fix the auth bug in src/auth.ts"
kbot "create a react component for user profiles"
kbot "deploy to production"
```

## Features

- **14 Providers**: Anthropic, OpenAI, Google, Mistral, xAI, DeepSeek, Groq, Together, Fireworks, Perplexity, Cohere, NVIDIA, Ollama, OpenClaw
- **60+ Tools**: File ops, bash, git, GitHub, web search, Jupyter notebooks, Docker sandbox, background tasks, MCP consumption, and more
- **Local-First**: Simple operations (file reads, git, grep) execute locally without API calls
- **Learning Engine**: Caches successful patterns, solutions, and user preferences — gets faster over time
- **Custom Agents**: Create on-the-fly specialist agents or use built-in presets
- **Hooks & Plugins**: Extend with pre/post tool hooks and custom plugins
- **IDE Integration**: MCP server for VS Code, Cursor, Zed, Neovim

## Providers

| Provider | Cost | Setup |
|----------|------|-------|
| Anthropic (Claude) | $3-15/M tokens | `ANTHROPIC_API_KEY` |
| OpenAI (GPT) | $2.5-10/M tokens | `OPENAI_API_KEY` |
| Google (Gemini) | $0.15-0.60/M tokens | `GOOGLE_API_KEY` |
| Ollama (Local) | **Free** | `ollama serve` |
| OpenClaw (Local) | **Free** | `openclaw-cmd start` |

Set any provider's env var and K:BOT auto-detects it. Or run `kbot auth` for interactive setup.

## Commands

| Command | Description |
|---------|-------------|
| `kbot` | Interactive REPL |
| `kbot "prompt"` | One-shot execution |
| `kbot auth` | Configure API key |
| `kbot ollama` | Set up local Ollama |
| `kbot usage` | Show usage stats |
| `/save` | Save current session |
| `/resume` | Resume a saved session |
| `/matrix` | Manage custom agents |
| `/plugins` | Manage plugins |
| `/compact` | Compress conversation history |

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
        ├─ Permission check (destructive ops require confirmation)
        ├─ Pre/post hooks
        ├─ Tool execution (local, with timeout)
        └─ Learning (async, patterns + solutions + profile)
```

## Security

- API keys encrypted at rest (AES-256-CBC)
- Config file restricted to owner (chmod 600)
- Destructive operations require user confirmation
- Bash tool blocks dangerous commands (rm -rf /, fork bombs, etc.)
- Tool execution timeout prevents hangs (5 min default)
- Result truncation prevents memory exhaustion (50KB default)

## License

MIT — Antigravity Group
