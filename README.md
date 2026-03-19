<p align="center">
  <strong>kbot</strong><br>
  Open-source terminal AI agent. 23 agents, 290 tools, 20 providers, local-first.
</p>

<p align="center">
  <img src="tools/video-assets/demo.gif" alt="kbot demo" width="700">
</p>

<p align="center">
  <a href="https://www.npmjs.com/package/@kernel.chat/kbot"><img src="https://img.shields.io/npm/v/@kernel.chat/kbot?color=6B5B95&label=npm" alt="npm version"></a>
  <a href="https://www.npmjs.com/package/@kernel.chat/kbot"><img src="https://img.shields.io/npm/dw/@kernel.chat/kbot?color=6B5B95" alt="npm downloads"></a>
  <a href="https://github.com/isaacsight/kernel/blob/main/LICENSE"><img src="https://img.shields.io/github/license/isaacsight/kernel?color=6B5B95" alt="MIT License"></a>
  <a href="https://kernel.chat"><img src="https://img.shields.io/badge/web-kernel.chat-6B5B95" alt="kernel.chat"></a>
  <a href="https://discord.gg/pYJn3hBqnz"><img src="https://img.shields.io/badge/discord-join-6B5B95?logo=discord&logoColor=white" alt="Discord"></a>
</p>

```bash
npm install -g @kernel.chat/kbot
```

## Why kbot?

Most terminal AI agents lock you into one provider, one model, one way of working. kbot doesn't.

- **20 providers, zero lock-in** — Claude, GPT, Gemini, Grok, DeepSeek, Groq, Mistral, SambaNova, Cerebras, OpenRouter, and more. Switch with one command.
- **Runs fully offline** — Embedded llama.cpp, Ollama, LM Studio, or Jan. $0, fully private.
- **Learns your patterns** — Bayesian skill ratings + pattern extraction. Gets faster over time.
- **23 specialist agents** — auto-routes your request to the right expert (coder, researcher, writer, guardian, and 19 more).
- **290 tools** — files, bash, git, GitHub, web search, deploy, database, game dev, VFX, research, MCP, and more.
- **Programmatic SDK** — use kbot as a library in your own apps.
- **MCP server built in** — plug kbot into Claude Code, Cursor, VS Code, Zed, or Neovim as a tool provider.

### How it compares

| | kbot | Claude Code | Aider | OpenCode |
|---|---|---|---|---|
| AI providers | 20 | 1 | 6 | 75+ |
| Specialist agents | 23 | 0 | 0 | 0 |
| Built-in tools | 290 | ~15 | ~10 | ~10 |
| Learning engine | Yes | No | No | No |
| Offline mode | Embedded + Ollama | No | Ollama | Ollama |
| SDK | Yes | No | No | No |
| MCP server | Yes | N/A | No | No |
| Web companion | kernel.chat | No | No | No |
| Open source | MIT | Source available | Apache 2.0 | MIT |
| Cost | BYOK / $0 local | $20+/mo | BYOK | BYOK |

## Quick Start

```bash
# Install globally
npm install -g @kernel.chat/kbot

# Or run directly (no install)
npx @kernel.chat/kbot

# Or use the install script (auto-installs Node.js if needed)
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
kbot local

# Set up your API key
kbot auth
```

## Specialists

kbot auto-routes to the right agent for each task. Or pick one with `--agent <name>`.

| | Agents |
|---|---|
| **Core** | kernel, researcher, coder, writer, analyst |
| **Extended** | aesthete, guardian, curator, strategist |
| **Domain** | infrastructure, quant, investigator, oracle, chronist, sage, communicator, adapter |
| **Presets** | claude-code, cursor, copilot, creative, developer |

## 290 Tools

| Category | Examples |
|----------|---------|
| **Files & Code** | read, write, glob, grep, lint, test |
| **Shell** | bash, parallel execute, background tasks |
| **Git & GitHub** | commit, diff, PR, issues, code search |
| **Web** | search, fetch, browser automation |
| **Research** | arXiv, Semantic Scholar, HuggingFace, NASA, DOI |
| **Data** | CSV read/query/write, transforms, reports, invoices |
| **Deploy** | Vercel, Netlify, Cloudflare Workers/Pages, Fly.io, Railway |
| **Database** | Postgres, MySQL, SQLite queries, Prisma, ER diagrams |
| **Containers** | Docker build/run/compose, Terraform |
| **VFX** | GLSL shaders, FFmpeg, ImageMagick, Blender, procedural textures |
| **Game Dev** | 16 tools for Godot, Unity, Unreal, Bevy, Phaser, Three.js, PlayCanvas, Defold |
| **Social** | post to X, LinkedIn, Bluesky, Mastodon — single posts and threads |
| **MCP** | marketplace search/install, 20 bundled servers |
| **IDE** | MCP server, ACP server, LSP bridge |
| **Meta** | subagents, worktrees, planner, memory, sessions, checkpoints |

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
| kbot local | **Free** | Yes |

Set any provider's env var and kbot auto-detects it. Or run `kbot auth` for interactive setup.

## SDK

```typescript
import { agent, tools, providers } from '@kernel.chat/kbot'

const result = await agent.run("fix the auth bug", { agent: 'coder' })
console.log(result.content)

for await (const event of agent.stream("explain this code")) {
  if (event.type === 'content_delta') process.stdout.write(event.text)
}
```

## Architecture

```mermaid
graph TD
    A[User Message] --> B{Local-first check}
    B -->|file, git, grep| C[Instant response — $0]
    B -->|Needs AI| D{Complexity detection}
    D -->|Simple| E[Bayesian Router → Specialist]
    D -->|Multi-step| F[Autonomous Planner]
    E --> G[Provider API + Tool Loop]
    F --> G
    G --> H{290 Tools}
    H --> I[File ops, bash, git, GitHub, search, deploy, DB, game dev...]
    G --> J[Learning Engine]
    J --> K[Patterns + Solutions + User Profile]
    G --> L[Checkpointing]
    L --> M[Resume from last tool call]
```

## MCP Server

Use kbot as a tool provider inside any MCP-compatible IDE:

```json
{
  "mcp": {
    "servers": {
      "kbot": { "command": "kbot", "args": ["ide", "mcp"] }
    }
  }
}
```

Works with Claude Code, Cursor, VS Code, Windsurf, Zed, Neovim.

## Commands

| Command | What it does |
|---------|-------------|
| `kbot` | Interactive REPL |
| `kbot "prompt"` | One-shot execution |
| `kbot auth` | Configure API key |
| `kbot local` | Use local AI (Ollama, embedded, LM Studio, Jan) |
| `kbot serve` | Start HTTP REST + SSE streaming server |
| `kbot audit <repo>` | Security + quality audit of any GitHub repo |
| `kbot contribute <repo>` | Find good-first-issues and quick wins |
| `kbot share` | Share conversation as GitHub Gist |
| `kbot pair` | File watcher with auto-analysis |
| `kbot team` | Multi-agent TCP collaboration |
| `kbot record` | Terminal session recording (SVG, GIF, asciicast) |
| `kbot ide mcp` | Start MCP server for IDEs |
| `kbot doctor` | 10-point health check |

## Security

- API keys encrypted at rest (AES-256-CBC)
- Destructive operations require confirmation
- Shell commands sandboxed with blocklist
- Tool execution timeout (5 min) with middleware pipeline
- Config files restricted to owner (chmod 600)
- 0 P0/P1 security issues (audited March 2026)

## Development

```bash
cd packages/kbot
npm install
npm run dev          # Run in dev mode
npm run build        # Compile TypeScript
npm run test         # Run tests (vitest)
```

## Web Companion — kernel.chat

kbot has a web companion at [kernel.chat](https://kernel.chat) — same agents, persistent memory, and a visual interface. Free to use (20 messages/day).

## Community

- **Web**: [kernel.chat](https://kernel.chat)
- **npm**: [@kernel.chat/kbot](https://www.npmjs.com/package/@kernel.chat/kbot)
- **Discord**: [discord.gg/pYJn3hBqnz](https://discord.gg/pYJn3hBqnz)
- **GitHub**: [isaacsight/kernel](https://github.com/isaacsight/kernel)
- **Issues**: [Report a bug](https://github.com/isaacsight/kernel/issues)

## License

[MIT](LICENSE) — [kernel.chat group](https://kernel.chat)
