<p align="center">
  <strong>K:BOT</strong><br>
  <em>Terminal AI agent that learns your patterns.</em>
</p>

<p align="center">
  <a href="https://www.npmjs.com/package/@kernel.chat/kbot"><img src="https://img.shields.io/npm/v/@kernel.chat/kbot?color=6B5B95&label=npm" alt="npm version"></a>
  <a href="https://www.npmjs.com/package/@kernel.chat/kbot"><img src="https://img.shields.io/npm/dw/@kernel.chat/kbot?color=6B5B95" alt="npm downloads"></a>
  <a href="https://github.com/isaacsight/kernel/blob/main/LICENSE"><img src="https://img.shields.io/github/license/isaacsight/kernel?color=6B5B95" alt="MIT License"></a>
  <a href="https://github.com/isaacsight/kernel"><img src="https://img.shields.io/github/stars/isaacsight/kernel?color=6B5B95&style=flat" alt="GitHub stars"></a>
  <a href="https://discord.gg/pYJn3hBqnz"><img src="https://img.shields.io/badge/discord-join-6B5B95?logo=discord&logoColor=white" alt="Discord"></a>
</p>

<!-- TODO: Replace with actual demo GIF after recording -->
<!-- <p align="center"><img src="https://raw.githubusercontent.com/isaacsight/kernel/main/packages/kbot/demo.gif" alt="kbot demo" width="600"></p> -->

```bash
npm install -g @kernel.chat/kbot
```

**22 specialist agents. 223 tools. 20 providers. Runs offline. MIT licensed.**

---

## Why kbot?

Most AI coding tools lock you into one provider and forget everything between sessions. kbot is different:

- **20 providers, zero lock-in** — Claude, GPT, Gemini, Grok, DeepSeek, Groq, Mistral, and 13 more. Switch anytime.
- **Runs fully offline** — Embedded llama.cpp runs GGUF models directly. No Ollama needed. $0, fully private.
- **Learns your patterns** — Extracts what works from every conversation. Gets faster and smarter over time.
- **22 specialist agents** — Say "fix the auth bug" and it picks the coder. Say "research JWT tokens" and it picks the researcher. Auto-routed.
- **Self-evaluating** — Every response scored on quality. Low score? Auto-retries with feedback.
- **Works in your IDE** — Built-in MCP server for VS Code, Cursor, Zed, Neovim. ACP for JetBrains.

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
# One-shot — ask anything
kbot "explain what this project does"

# Interactive REPL
kbot

# Use your own API key (auto-detects provider)
kbot auth

# Or go fully local — no API key, no data leaves your machine
kbot local

# Pipe mode — compose with Unix tools
kbot -p "generate a user roles migration" > migration.sql
```

## Specialists

Auto-routed by intent, or pick one with `kbot --agent <name>`:

| | Agents |
|---|---|
| **Core** | kernel, researcher, coder, writer, analyst |
| **Extended** | aesthete, guardian, curator, strategist |
| **Domain** | infrastructure, quant, investigator, oracle, chronist, sage, communicator, adapter |
| **Presets** | claude-code, cursor, copilot, creative, developer |

```bash
kbot --agent researcher "what papers cite Friston's Free Energy Principle?"
kbot --agent guardian "review src/auth.ts for security issues"
kbot --agent coder "refactor this into smaller functions"
```

## 223 Tools

| Category | Examples |
|----------|---------|
| **Files & Code** | read, write, glob, grep, lint, test |
| **Shell** | bash, parallel execute, background tasks |
| **Git & GitHub** | commit, diff, PR, issues, code search |
| **Web** | search, fetch, browser automation |
| **Research** | arXiv, Semantic Scholar, HuggingFace, NASA, DOI |
| **Data** | CSV read/query/write, transforms, reports, invoices |
| **Containers** | Docker build/run/compose, Terraform |
| **VFX** | GLSL shaders, FFmpeg, ImageMagick, Blender, procedural textures |
| **IDE** | MCP server, ACP server, LSP bridge |
| **Meta** | subagents, worktrees, planner, memory, sessions |

## 20 Providers

| Provider | Cost | Local? |
|----------|------|--------|
| **Embedded (llama.cpp)** | **Free** | Yes |
| **Ollama** | **Free** | Yes |
| **LM Studio** | **Free** | Yes |
| **Jan** | **Free** | Yes |
| DeepSeek | $0.27/M in | Cloud |
| SambaNova | $0.50/M in | Cloud |
| Cerebras | $0.60/M in | Cloud |
| Groq | $0.59/M in | Cloud |
| NVIDIA NIM | $0.80/M in | Cloud |
| Together AI | $0.88/M in | Cloud |
| Fireworks AI | $0.90/M in | Cloud |
| Google (Gemini) | $1.25/M in | Cloud |
| Mistral | $2.00/M in | Cloud |
| OpenAI (GPT) | $2.00/M in | Cloud |
| Cohere | $2.50/M in | Cloud |
| Anthropic (Claude) | $3.00/M in | Cloud |
| xAI (Grok) | $3.00/M in | Cloud |
| Perplexity | $3.00/M in | Cloud |
| OpenRouter | varies | Cloud |
| K:BOT Local | **Free** | Yes |

All auto-detected via environment variables. Or run `kbot auth` for interactive setup.

## Local Mode

No API key needed. No data leaves your machine.

```bash
# Use Ollama (if installed)
kbot local

# Or run models directly — embedded llama.cpp, no external service
kbot models pull llama3.1-8b
kbot local --embedded

# GPU-accelerated: Metal (Mac), CUDA (Linux/Windows), Vulkan
```

## IDE Integration

```json
{
  "mcp": {
    "servers": {
      "kbot": { "command": "kbot", "args": ["ide", "mcp"] }
    }
  }
}
```

Works with Claude Code, Cursor, VS Code, Windsurf, Zed, Neovim. Exposes file ops, bash, git, search, planning, and more.

## Commands

| Command | What it does |
|---------|-------------|
| `kbot` | Interactive REPL |
| `kbot "prompt"` | One-shot execution |
| `kbot auth` | Configure API key |
| `kbot local` | Use local AI (Ollama, embedded, LM Studio, Jan) |
| `kbot audit <repo>` | Security + quality audit of any GitHub repo |
| `kbot contribute <repo>` | Find good-first-issues and quick wins |
| `kbot serve` | Start HTTP REST server |
| `kbot ide mcp` | Start MCP server for IDEs |
| `kbot doctor` | 10-point health check |
| `/agent <name>` | Switch specialist |
| `/plan <task>` | Autonomous multi-step execution |
| `/save` / `/resume` | Session management |
| `/share` | Share conversation as GitHub Gist |
| `/tutorial` | Guided walkthrough |

## Under the Hood

kbot's agent loop runs 10 always-on cognition modules based on peer-reviewed research:

| Module | Paper | What it does |
|--------|-------|-------------|
| Free Energy | Friston, 2010 | Explore vs exploit decisions |
| Integrated Information | Tononi, 2004 | Multi-agent synthesis quality (phi) |
| Predictive Processing | Clark, 2013 | Anticipates your next action |
| Autopoiesis | Maturana & Varela, 1972 | Self-healing component monitoring |
| Strange Loops | Hofstadter, 1979 | Meta-cognition depth tracking |
| Error Correction | Gates, 2023 | Targeted error classification + fix |
| Entropy Context | Vopson, 2022 | Information decay detection |
| Godel Limits | Godel/UBC | Stuck-loop detection |
| Simulation | Wolpert, 2008 | Change impact prediction |
| Emergent Swarm | Project Sid, 2024 | Dynamic role discovery |

These aren't metaphors. They're TypeScript modules with paper citations in the headers. See `packages/kbot/src/`.

## Security

- API keys encrypted at rest (AES-256-CBC)
- Destructive operations require confirmation
- Shell commands sandboxed with blocklist
- Tool execution timeout (5 min)
- Config files restricted to owner (chmod 600)

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md) for development setup, adding tools, and creating specialist agents.

## Links

- [kernel.chat](https://kernel.chat) — Web companion
- [npm](https://www.npmjs.com/package/@kernel.chat/kbot)
- [Docker Hub](https://hub.docker.com/r/isaacsight/kbot)
- [Discord](https://discord.gg/pYJn3hBqnz)
- [Issues](https://github.com/isaacsight/kernel/issues)

## License

[MIT](../../LICENSE) — [kernel.chat group](https://kernel.chat)
