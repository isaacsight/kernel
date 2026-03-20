<p align="center">
  <strong>kbot</strong><br>
  <em>The only AI agent that builds its own tools.</em>
</p>

<p align="center">
  <img src="../../tools/video-assets/demo.gif" alt="kbot demo" width="700">
</p>

<p align="center">
  <a href="https://www.npmjs.com/package/@kernel.chat/kbot"><img src="https://img.shields.io/npm/v/@kernel.chat/kbot?color=6B5B95&label=npm" alt="npm version"></a>
  <a href="https://www.npmjs.com/package/@kernel.chat/kbot"><img src="https://img.shields.io/npm/dw/@kernel.chat/kbot?color=6B5B95" alt="npm downloads"></a>
  <a href="https://github.com/isaacsight/kernel/blob/main/LICENSE"><img src="https://img.shields.io/github/license/isaacsight/kernel?color=6B5B95" alt="MIT License"></a>
  <a href="https://github.com/isaacsight/kernel"><img src="https://img.shields.io/github/stars/isaacsight/kernel?color=6B5B95&style=flat" alt="GitHub stars"></a>
  <a href="https://discord.gg/kdMauM9abG"><img src="https://img.shields.io/badge/discord-join-6B5B95?logo=discord&logoColor=white" alt="Discord"></a>
</p>

```bash
npm install -g @kernel.chat/kbot
```

**Self-evolving terminal AI agent. 290 tools. 23 agents. 20 providers. Forges new tools at runtime. MIT licensed.**

---

## What's New in v3.6

| Feature | What it means |
|---------|---------------|
| **Forge Tool** | `forge_tool` — kbot creates new tools at runtime when it doesn't have one. No restart, no recompile. |
| **Forge Registry** | Publish, search, and install community-created tools. Collective autopoiesis. |
| **Autopoietic Health** | `kbot vitals` — self-monitoring system health: memory, token budgets, tool success rates. |
| **Immune Agent** | Self-auditing agent that detects drift, regressions, and anomalies across sessions. |
| **Cost-Aware Routing** | Automatically picks the cheapest model that can handle the task. Saves 60-90% on API costs. |
| **Fallback Chains** | If a provider fails, kbot cascades to the next one. Zero downtime, zero manual intervention. |
| **290 Tools** | +6 tools since v3.3: forge, vitals, immune, cost routing, fallback chains, and more. |
| **23 Agents** | Expanded specialist roster with immune and forge agents. |

---

## Why kbot?

Other AI coding tools are static — fixed tool sets, single providers, no memory. kbot is the first AI agent that **evolves itself**:

- **Forges its own tools** — When kbot encounters a task it can't handle, it creates a new tool on the spot via `forge_tool`. The tool persists, gets tested, and can be shared via the Forge Registry.
- **Self-evolving** — Autopoietic health monitoring (`kbot vitals`) tracks tool success rates, token budgets, and memory pressure. The immune agent self-audits for drift and regressions.
- **Cost-aware routing** — Automatically selects the cheapest model capable of handling each task. Claude for complex reasoning, DeepSeek for simple queries. Saves 60-90% on API costs.
- **Fallback chains** — If Anthropic is down, kbot cascades to OpenAI, then Groq, then local. Zero manual intervention.
- **20 providers, zero lock-in** — Claude, GPT, Gemini, Grok, DeepSeek, Groq, Mistral, and 13 more. Switch anytime.
- **Runs fully offline** — Embedded llama.cpp runs GGUF models directly. No Ollama needed. $0, fully private.
- **Learns your patterns** — Bayesian skill ratings + pattern extraction. Gets faster and smarter over time.
- **23 specialist agents** — Say "fix the auth bug" and it routes to `coder`. Say "research JWT tokens" and it routes to `researcher`. Auto-routed with probabilistic confidence.
- **Crash-proof** — Checkpoints after every tool call. Resume interrupted sessions automatically.
- **Use as a library** — Clean SDK with typed exports. Build your own tools on top of kbot.
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

# Forge a new tool at runtime
kbot "I need a tool that converts CSV to JSON with column filtering"

# Check system health
kbot vitals

# Pipe mode — compose with Unix tools
kbot -p "generate a user roles migration" > migration.sql
```

## Forge — Runtime Tool Creation

kbot is the only AI agent that builds its own tools. When it encounters a task no existing tool can handle, it creates one:

```bash
# kbot detects it needs a tool, creates it, tests it, and uses it — all in one turn
kbot "analyze the sentiment distribution across all my markdown files"
# → forge_tool creates 'sentiment_analyze' → executes it → returns results

# Browse and install community tools from the Forge Registry
kbot forge search "kubernetes"
kbot forge install k8s-pod-monitor

# Publish your forged tools for others
kbot forge publish sentiment_analyze
```

Forged tools are first-class citizens — they get the same middleware pipeline, permission checks, and telemetry as built-in tools.

## SDK — Use kbot as a Library

```typescript
import { agent, tools, providers } from '@kernel.chat/kbot'

// Run the agent programmatically
const result = await agent.run("fix the auth bug", { agent: 'coder' })
console.log(result.content)    // AI response
console.log(result.toolCalls)  // tools it used
console.log(result.usage)      // token counts

// Stream responses
for await (const event of agent.stream("explain this code")) {
  if (event.type === 'content_delta') process.stdout.write(event.text)
  if (event.type === 'tool_call_start') console.log(`Using: ${event.name}`)
}

// Execute tools directly
const files = await tools.execute('glob', { pattern: 'src/**/*.ts' })
console.log(files.result)

// List all 290 tools
console.log(tools.list().map(t => t.name))
```

### SDK Exports

```typescript
import { agent, tools, providers } from '@kernel.chat/kbot'           // Main SDK
import { SilentUIAdapter, CallbackUIAdapter } from '@kernel.chat/kbot' // UI adapters
import { ResponseStream } from '@kernel.chat/kbot'                     // Streaming
```

## Specialists

Auto-routed by Bayesian skill ratings, or pick one with `kbot --agent <name>`:

| | Agents |
|---|---|
| **Core** | kernel, researcher, coder, writer, analyst |
| **Extended** | aesthete, guardian, curator, strategist |
| **Domain** | infrastructure, quant, investigator, oracle, chronist, sage, communicator, adapter |
| **System** | immune, forge |
| **Presets** | claude-code, cursor, copilot, creative, developer |

```bash
kbot --agent researcher "what papers cite Friston's Free Energy Principle?"
kbot --agent guardian "review src/auth.ts for security issues"
kbot --agent coder "refactor this into smaller functions"
```

## 290 Tools

| Category | Examples |
|----------|---------|
| **Forge** | forge_tool, forge_search, forge_install, forge_publish |
| **Files & Code** | read, write, glob, grep, multi-file write |
| **Quality** | lint (ESLint/Biome/Clippy), test (Vitest/Jest/pytest), deps audit, format, type-check |
| **Shell** | bash, parallel execute, background tasks |
| **Git & GitHub** | commit, diff, PR, issues, code search |
| **Web** | search, fetch, browser automation, browser agent |
| **Research** | arXiv, Semantic Scholar, HuggingFace, NASA, DOI |
| **Data** | CSV read/query/write, transforms, reports, invoices |
| **Creative** | p5.js generative art, GLSL shaders, SVG patterns, design variants, music |
| **Deploy** | Vercel, Netlify, Cloudflare Workers/Pages, Fly.io, Railway |
| **Database** | Postgres, MySQL, SQLite queries, Prisma, ER diagrams, seed data |
| **Containers** | Docker build/run/compose, Terraform |
| **VFX** | GLSL shaders, FFmpeg, ImageMagick, Blender, procedural textures |
| **Game Dev** | scaffold, config, shaders, meshes, physics, particles, levels, tilemaps, navmesh, audio, netcode |
| **Training** | dataset prep, fine-tuning, evaluation, model export |
| **Social** | post to X, LinkedIn, Bluesky, Mastodon — single posts and threads |
| **Sandbox** | Docker containers, E2B cloud sandboxes, isolated code execution |
| **Notebooks** | Jupyter read, edit, insert, delete cells |
| **Build Matrix** | cross-platform builds — mobile, desktop, WASM, embedded, server |
| **LSP** | goto definition, find references, hover, rename, diagnostics, symbols |
| **Memory** | persistent save, search, update, forget — survives across sessions |
| **IDE** | MCP server, ACP server, LSP bridge |
| **System** | vitals, immune audit, cost tracking, fallback status |
| **Meta** | subagents, worktrees, planner, sessions, checkpoints, self-eval |

## Middleware Pipeline

Extend tool execution with composable middleware:

```typescript
import { ToolPipeline, executionMiddleware } from '@kernel.chat/kbot/tools'

const pipeline = new ToolPipeline()

// Add custom logging middleware
pipeline.use(async (ctx, next) => {
  console.log(`Calling ${ctx.toolName}...`)
  await next()
  console.log(`${ctx.toolName} took ${ctx.durationMs}ms`)
})

// Add the actual execution
pipeline.use(executionMiddleware(myExecutor))

await pipeline.execute({ toolName: 'bash', toolArgs: { command: 'ls' }, toolCallId: '1', metadata: {}, aborted: false })
```

Built-in middleware: `permissionMiddleware`, `hookMiddleware`, `timeoutMiddleware`, `metricsMiddleware`, `truncationMiddleware`, `telemetryMiddleware`.

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

Cost-aware routing automatically picks the cheapest provider that can handle each task. Fallback chains ensure zero downtime across providers.

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

## Structured Streaming

Stream typed events to any consumer:

```typescript
import { ResponseStream } from '@kernel.chat/kbot'

const stream = new ResponseStream()

// Subscribe to events
stream.on((event) => {
  switch (event.type) {
    case 'content_delta': process.stdout.write(event.text); break
    case 'tool_call_start': console.log(`Tool: ${event.name}`); break
    case 'tool_result': console.log(`Result: ${event.result}`); break
    case 'usage': console.log(`Tokens: ${event.inputTokens} in, ${event.outputTokens} out`); break
  }
})

// Or use as async iterator
for await (const event of stream) {
  // handle each event
}
```

**HTTP SSE**: `POST /stream` when running `kbot serve` — standard Server-Sent Events.

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
| `kbot vitals` | Autopoietic health check — memory, tools, token budgets |
| `kbot serve` | Start HTTP REST + SSE streaming server |
| `kbot audit <repo>` | Security + quality audit of any GitHub repo |
| `kbot contribute <repo>` | Find good-first-issues and quick wins |
| `kbot pair` | File watcher with auto-analysis |
| `kbot team` | Multi-agent TCP collaboration |
| `kbot record` | Terminal session recording (SVG, GIF, asciicast) |
| `kbot voice` | Text-to-speech output mode |
| `kbot watch` | Real-time file analysis on change |
| `kbot bootstrap` | Outer-loop project optimizer (visibility scoring) |
| `kbot plugins` | Search, install, update community plugins |
| `kbot models` | List, pull, remove, catalog local models |
| `kbot changelog` | Generate changelog from git history |
| `kbot completions` | Shell completions (bash, zsh, fish) |
| `kbot cloud` | Sync learning data to kernel.chat |
| `kbot forge search <q>` | Search the Forge Registry for community tools |
| `kbot ide mcp` | Start MCP server for IDEs |
| `kbot doctor` | 10-point health check |
| `/agent <name>` | Switch specialist |
| `/plan <task>` | Autonomous multi-step execution |
| `/save` / `/resume` | Session management |
| `/share` | Share conversation as GitHub Gist |
| `/tutorial` | Guided walkthrough |

### Power-User Flags

```bash
kbot --architect "design the auth system"    # Architecture mode — plan before code
kbot --thinking "solve this hard problem"    # Extended reasoning with thinking budget
kbot --self-eval "write a parser"            # Self-evaluation loop — scores and retries
kbot --computer-use "fill out this form"     # Computer use — controls mouse and keyboard
kbot -p "query" > output.txt                 # Pipe mode — clean output for scripting
```

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
- Tool execution timeout (5 min) with middleware pipeline
- Config files restricted to owner (chmod 600)
- Session checkpoints stored locally (~/.kbot/checkpoints/)
- Immune agent self-audits for drift and anomalies
- Telemetry is local-only — never sent externally

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md) for development setup, adding tools, and creating specialist agents.

## Links

- [kernel.chat](https://kernel.chat) — Web companion
- [npm](https://www.npmjs.com/package/@kernel.chat/kbot)
- [Docker Hub](https://hub.docker.com/r/isaacsight/kbot)
- [Discord](https://discord.gg/kdMauM9abG)
- [Issues](https://github.com/isaacsight/kernel/issues)

## License

[MIT](../../LICENSE) — [kernel.chat group](https://kernel.chat)
