<p align="center">
  <strong>K:BOT</strong><br>
  Open-source terminal AI agent. 39 specialists, 167 tools, 19 providers, local-first.
</p>

<p align="center">
  <a href="https://www.npmjs.com/package/@kernel.chat/kbot"><img src="https://img.shields.io/npm/v/@kernel.chat/kbot?color=6B5B95&label=npm" alt="npm version"></a>
  <a href="https://www.npmjs.com/package/@kernel.chat/kbot"><img src="https://img.shields.io/npm/dw/@kernel.chat/kbot?color=6B5B95" alt="npm downloads"></a>
  <a href="https://github.com/isaacsight/kernel/blob/main/LICENSE"><img src="https://img.shields.io/github/license/isaacsight/kernel?color=6B5B95" alt="MIT License"></a>
  <a href="https://kernel.chat"><img src="https://img.shields.io/badge/web-kernel.chat-6B5B95" alt="kernel.chat"></a>
</p>

## Why K:BOT?

- **19 providers, zero lock-in** — Claude, GPT, Gemini, Mistral, Grok, DeepSeek, SambaNova, Cerebras, OpenRouter, and more
- **Runs fully offline** — `kbot local` for $0 local AI, no data leaves your machine
- **Learns your patterns** — remembers what worked, gets faster over time
- **37 specialist agents** — auto-routes to the right expert for each task
- **MCP server built in** — plug kbot into any IDE as a tool provider

## Quick Start

```bash
# Install globally
npm install -g @kernel.chat/kbot

# Set up with your API key (auto-detects provider)
kbot auth

# Or use a local model (no API key needed)
kbot local

# Start chatting
kbot
```

## One-Shot Mode

```bash
kbot "fix the auth bug in src/auth.ts"
kbot "create a react component for user profiles"
kbot "deploy to production"
kbot -p "generate a migration for user roles" > migration.sql
```

## Specialists (37)

Auto-routed or manual with `kbot --agent <name>`:

**Core**: kernel, researcher, coder, writer, analyst
**Extended**: aesthete, guardian, curator, strategist, infrastructure, quant, investigator, oracle, chronist, sage, communicator, adapter
**Domain**: physicist, mathematician, biologist, economist, psychologist, engineer, medic, linguist, ethicist, educator, diplomat
**Systems**: session, scholar, auditor, benchmarker, synthesizer, debugger

## Features

- **60+ Tools** — File ops, bash, git, GitHub, web search, Jupyter, Docker sandbox, browser, MCP client
- **Local-First** — File reads, git, grep run instantly without an API call
- **Learning Engine** — Patterns, solutions, and user preferences cached across sessions
- **Mimic Matrix** — Code like Claude Code, Cursor, Copilot, Next.js, React, Rust, Python
- **Autonomous Planner** — Complex tasks get broken into steps, executed, and verified
- **Subagent System** — Parallel workers for research, coding, and analysis
- **Hooks & Plugins** — Pre/post tool hooks and custom plugins
- **Sessions** — Save, resume, and share conversations

## Providers

| Provider | Cost | Setup |
|----------|------|-------|
| Anthropic (Claude) | $3-15/M tokens | `ANTHROPIC_API_KEY` |
| OpenAI (GPT) | $2-8/M tokens | `OPENAI_API_KEY` |
| Google (Gemini) | $1.25-10/M tokens | `GOOGLE_API_KEY` |
| Mistral | $2-6/M tokens | `MISTRAL_API_KEY` |
| xAI (Grok) | $3-15/M tokens | `XAI_API_KEY` |
| DeepSeek | $0.27-1.10/M tokens | `DEEPSEEK_API_KEY` |
| Groq | $0.59-0.79/M tokens | `GROQ_API_KEY` |
| Together AI | $0.88/M tokens | `TOGETHER_API_KEY` |
| Fireworks AI | $0.90/M tokens | `FIREWORKS_API_KEY` |
| Perplexity | $3-15/M tokens | `PERPLEXITY_API_KEY` |
| Cohere | $2.5-10/M tokens | `COHERE_API_KEY` |
| NVIDIA NIM | $0.80-1.20/M tokens | `NVIDIA_API_KEY` |
| SambaNova | $0.50-1/M tokens | `SAMBANOVA_API_KEY` |
| Cerebras | $0.60/M tokens | `CEREBRAS_API_KEY` |
| OpenRouter | varies by model | `OPENROUTER_API_KEY` |
| Ollama (Local) | **Free** | `ollama serve` |
| LM Studio (Local) | **Free** | Open LM Studio → Start Server |
| Jan (Local) | **Free** | Open Jan → Enable API Server |
| OpenClaw (Local) | **Free** | `openclaw-cmd start` |

All 19 providers auto-detected via env vars. Or run `kbot auth` for interactive setup.

## MCP Server (IDE Integration)

```json
{
  "mcp": {
    "servers": {
      "kbot": { "command": "kbot", "args": ["ide", "mcp"] }
    }
  }
}
```

Works with Claude Code, Cursor, VS Code, Windsurf, Zed, Neovim. Exposes 14 tools including `kbot_chat`, `kbot_plan`, `kbot_bash`, `kbot_read_file`, `kbot_edit_file`, `kbot_search`, `kbot_github`, and more.

## HTTP Server

```bash
kbot serve --port 7437 --token mysecret
```

REST API exposing all 60+ tools for any LLM or automation pipeline.

## Commands

| Command | Description |
|---------|-------------|
| `kbot` | Interactive REPL |
| `kbot "prompt"` | One-shot execution |
| `kbot auth` | Configure API key |
| `kbot local` | Use local AI models (Ollama, LM Studio, Jan) |
| `kbot serve` | Start HTTP server |
| `kbot ide mcp` | Start MCP server |
| `/agent <name>` | Switch specialist |
| `/mimic <profile>` | Adopt a coding style |
| `/plan <task>` | Autonomous plan + execute |
| `/save` / `/resume` | Session management |

## Security

- API keys encrypted at rest (AES-256-CBC)
- Destructive operations require confirmation
- Bash tool blocks dangerous commands
- Tool execution timeout (5 min)
- Config restricted to owner (chmod 600)

## Web Companion

[kernel.chat](https://kernel.chat) — same 37 agents with a visual interface. Free (20 msgs/day).

## Links

- **Web**: [kernel.chat](https://kernel.chat)
- **npm**: [@kernel.chat/kbot](https://www.npmjs.com/package/@kernel.chat/kbot)
- **GitHub**: [isaacsight/kernel](https://github.com/isaacsight/kernel)
- **Issues**: [Report a bug](https://github.com/isaacsight/kernel/issues)

## License

[MIT](../../LICENSE) — [kernel.chat group](https://kernel.chat)
