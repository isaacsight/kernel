<p align="center">
  <strong>K:BOT</strong><br>
  Universal AI agent for your terminal. 5 built-in agents + 6 presets, 214 tools, 19 providers. Covers every code ecosystem — npm, PyPI, CRAN, Cargo, HuggingFace, arXiv, Docker, and more. Self-evolving, local-first.
</p>

<p align="center">
  <a href="https://www.npmjs.com/package/@kernel.chat/kbot"><img src="https://img.shields.io/npm/v/@kernel.chat/kbot?color=6B5B95&label=npm" alt="npm version"></a>
  <a href="https://www.npmjs.com/package/@kernel.chat/kbot"><img src="https://img.shields.io/npm/dw/@kernel.chat/kbot?color=6B5B95" alt="npm downloads"></a>
  <a href="https://github.com/isaacsight/kernel/blob/main/LICENSE"><img src="https://img.shields.io/github/license/isaacsight/kernel?color=6B5B95" alt="MIT License"></a>
  <a href="https://github.com/isaacsight/kernel"><img src="https://img.shields.io/github/stars/isaacsight/kernel?color=6B5B95&style=flat" alt="GitHub stars"></a>
  <a href="https://kernel.chat"><img src="https://img.shields.io/badge/web-kernel.chat-6B5B95" alt="kernel.chat"></a>
  <a href="https://hub.docker.com/r/isaacsight/kbot"><img src="https://img.shields.io/badge/docker-kbot-6B5B95" alt="Docker"></a>
  <a href="https://github.com/isaacsight/kernel/blob/main/packages/kbot/CONTRIBUTING.md"><img src="https://img.shields.io/badge/PRs-welcome-6B5B95" alt="PRs Welcome"></a>
</p>

## Why K:BOT?

- **19 providers, zero lock-in** — Claude, GPT, Gemini, Mistral, Grok, DeepSeek, SambaNova, Cerebras, OpenRouter, and more
- **Runs fully offline** — `kbot local` for $0 local AI, no data leaves your machine
- **Learns your patterns** — remembers what worked, gets faster over time
- **11 specialist agents** (5 built-in + 6 presets) — auto-routes to the right expert for each task
- **Self-evolving** — diagnoses its own weaknesses and improves its own code (`/evolve`)
- **Shell completions** — tab completion for bash, zsh, and fish (`kbot completions zsh`)
- **MCP server built in** — plug kbot into any IDE as a tool provider

## Install

```bash
# npm (recommended)
npm install -g @kernel.chat/kbot

# Docker
docker run -it isaacsight/kbot

# curl
curl -fsSL https://raw.githubusercontent.com/isaacsight/kernel/main/packages/kbot/install.sh | bash
```

## Quick Start

```bash
# Set up with your API key (auto-detects provider)
kbot auth

# Or use a local model (no API key needed)
kbot local

# Or run models directly — no Ollama needed
kbot models pull llama3.1-8b
kbot local --embedded

# Start chatting
kbot
```

## What's New in v2.17.0

- **Embedded inference engine** — Run GGUF models directly in kbot. No Ollama, no external service. Close your laptop, deploy anywhere.
- **`kbot models`** — Download, list, and manage GGUF models from HuggingFace
- **20 providers** — Embedded llama.cpp joins Anthropic, OpenAI, Google, Ollama, and 15 more
- **Auto-fallback** — If Ollama isn't running, kbot automatically uses embedded models
- **GPU-accelerated** — Metal (Mac), CUDA (Linux/Windows), Vulkan

```bash
# Download a model (one-time, ~5 GB)
kbot models pull llama3.1-8b

# Enable embedded mode — no external service needed
kbot local --embedded

# Or just use kbot — it auto-detects everything
kbot
```

## One-Shot Mode

```bash
kbot "fix the auth bug in src/auth.ts"
kbot "create a react component for user profiles"
kbot "deploy to production"
kbot -p "generate a migration for user roles" > migration.sql
```

## Specialists (11)

Auto-routed or manual with `kbot --agent <name>`:

**Core**: kernel, researcher, coder, writer, analyst
**Extended**: aesthete, guardian, curator, strategist, infrastructure, quant, investigator, oracle, chronist, sage, communicator, adapter
**Domain**: physicist, mathematician, biologist, economist, psychologist, engineer, medic, linguist, ethicist, educator, diplomat
**Creative**: creative, developer, hacker, operator, dreamer
**Systems**: session, scholar, auditor, benchmarker, synthesizer, debugger

## Features

- **214 Tools** — File ops, bash, git, GitHub, web search, Jupyter, Docker, browser, MCP, PyPI, CRAN, Cargo, arXiv, HuggingFace, NASA, API testing, data queries, math, LaTeX, Terraform
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

REST API exposing all 214 tools for any LLM or automation pipeline.

## Use Everywhere

| Environment | How |
|-------------|-----|
| **Terminal** | `npm install -g @kernel.chat/kbot` |
| **Docker** | `docker run -it isaacsight/kbot` |
| **VS Code / Cursor** | MCP server: `kbot ide mcp` |
| **JetBrains IDEs** | ACP server: `kbot ide acp` |
| **Neovim / Zed** | MCP server config |
| **GitHub Actions** | See `action.yml` in repo |
| **REST API** | `kbot serve --port 7437` |
| **Railway** | One-click deploy with `railway.toml` |
| **Replit** | Import repo, auto-configured |
| **CI/CD** | `npx @kernel.chat/kbot "review this diff"` |

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

[kernel.chat](https://kernel.chat) — visual interface with 39 agents. Free (20 msgs/day).

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md) for development setup, adding tools, and adding specialist agents.

## Links

- **Web**: [kernel.chat](https://kernel.chat)
- **npm**: [@kernel.chat/kbot](https://www.npmjs.com/package/@kernel.chat/kbot)
- **GitHub**: [isaacsight/kernel](https://github.com/isaacsight/kernel)
- **Docker**: [isaacsight/kbot](https://hub.docker.com/r/isaacsight/kbot)
- **MCP Registry**: `kbot` ([mcp-server.json](mcp-server.json))
- **Issues**: [Report a bug](https://github.com/isaacsight/kernel/issues)
- **Email**: [support@kernel.chat](mailto:support@kernel.chat)
- **X/Twitter**: [@isaacsight](https://x.com/isaacsight)

## License

[MIT](../../LICENSE) — [kernel.chat group](https://kernel.chat)
