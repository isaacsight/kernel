<p align="center">
  <strong>kbot</strong><br>
  <em>The only AI agent that builds its own tools — and defends itself.</em>
</p>

<p align="center">
  <img src="https://raw.githubusercontent.com/isaacsight/kernel/main/tools/video-assets/demo-hero.gif" alt="kbot demo — The Kernel Stack" width="700">
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

**Self-defending AI agent. 384+ tools. 41 agents. 20 providers. Forges new tools at runtime. Built-in cybersecurity suite. $0 local AI. MIT licensed.**

> **New: [The Kernel Stack](./KERNEL_STACK.md)** — the architecture behind kbot + Claude Code. Agentic, self-improving, compound AI. Read the manifesto.

---

## What's New

### v3.37 — Dream Mode, Meta-Agent, Claude Code Plugin, Voice Mode

| Feature | What it means |
|---------|---------------|
| **Dream Mode** | `kbot dream` — offline consolidation. kbot reviews recent sessions, extracts patterns, strengthens memory connections, and prunes stale knowledge. Like sleep for an AI agent. |
| **Meta-Agent** | Self-referential self-improvement inspired by HyperAgents ([arXiv 2603.19461](https://arxiv.org/abs/2603.19461)). A two-agent loop: task agents solve problems, the Meta-Agent watches performance and rewrites task agents to be better. Unlike HyperAgents (CC BY-NC-SA), kbot is MIT — the only self-improving agent framework companies can actually use. Run `kbot meta` to trigger a cycle. |
| **Claude Code Plugin** | kbot registers its 9 core specialists as Claude Code teammates via the Agent Teams integration. Delegate tasks to `coder`, `researcher`, `guardian`, etc. directly from Claude Code sessions. |
| **Voice Mode** | `kbot voice` — full voice loop with speech-to-text input and text-to-speech output. Hands-free agentic coding. Works with system TTS and Whisper STT. |
| **OpenClaw Integration** | [`@kernel.chat/kbot-openclaw`](https://www.npmjs.com/package/@kernel.chat/kbot-openclaw) — kbot as the brain for 50+ messaging channels. Discord, Slack, Telegram, WhatsApp, iMessage, email, and more. One agent, every platform. |
| **41 agents** | 15 new specialist and domain agents since v3.28, including meta-agent, dream agent, and expanded presets. |
| **384+ tools** | 34 new tools across finance, creative, build matrix, and meta-cognition categories. |

### v3.28 — Self-Defense System

kbot now protects its own integrity — and yours.

| Feature | What it means |
|---------|---------------|
| **Memory Integrity** | HMAC signatures on all memory files. Tampered memories are detected and quarantined. |
| **Prompt Injection Detection** | Real-time scanning of inputs for injection attacks, jailbreaks, and adversarial prompts. |
| **Knowledge Sanitization** | Learned patterns and forged tools are sanitized before storage to prevent poisoning. |
| **Forge Verification** | Cryptographic verification of forged tools — unsigned or modified tools are blocked. |
| **Anomaly Detection** | Behavioral baselines with statistical anomaly scoring. Alerts on drift. |
| **Incident Logging** | Tamper-proof audit log of all security events. |
| **`kbot defense`** | `audit` · `sign` · `verify` · `incidents` — full CLI for the defense system. |

### v3.27 — Cybersecurity Tools

Seven new security tools, available to every agent:

`dep_audit` · `secret_scan` · `ssl_check` · `headers_check` · `cve_lookup` · `port_scan` · `owasp_check`

Plus P0 fixes: all Supabase edge functions now enforce auth headers. No more unauthenticated access.

### v3.26 — Trader Agent & Finance Stack

| Feature | What it means |
|---------|---------------|
| **Trader Agent** | `kbot --agent trader` — crypto market analysis, paper trading, DeFi yield scanning. |
| **Finance Tools (11)** | `market_data`, `market_overview`, `price_history`, `technical_analysis`, `paper_trade`, `market_sentiment`, `defi_yields` + 4 more. |
| **Wallet & Swaps (9)** | Create/import Solana wallets (AES-256-CBC encrypted). Jupiter DEX swaps. Token balances, transaction history, airdrop tracking. |
| **Stock Tools (6)** | Stock screener, earnings calendar, sector rotation, company fundamentals, insider trades, options flow. |
| **Sentiment (5)** | Social sentiment, whale tracking, fear & greed index, news aggregation, trend detection. |
| **Introspection Engine** | `kbot insights` · `kbot reflect` · `kbot compare` — ask kbot what it knows about itself. |
| **`kbot help`** | New CLI subcommand — quick reference for commands, agents, and support channels. |

---

## Why kbot?

Other AI agents are static — fixed tools, single providers, no memory, no learning. kbot is the first AI agent that **evolves itself** and **defends itself**:

- **Forges its own tools** — When kbot encounters a task it can't handle, it creates a new tool on the spot via `forge_tool`. The tool persists, gets tested, and can be shared via the Forge Registry.
- **Self-defending** — HMAC memory integrity, prompt injection detection, forge verification, anomaly detection, and tamper-proof incident logging. Run `kbot defense audit` anytime.
- **Cybersecurity built in** — Dependency audits, secret scanning, SSL/TLS checks, header analysis, CVE lookup, port scanning, OWASP checks. Every project gets security tooling for free.
- **Self-evolving** — Autopoietic health monitoring (`kbot vitals`) tracks tool success rates, token budgets, and memory pressure. The immune agent self-audits for drift and regressions.
- **Cost-aware routing** — Automatically selects the cheapest model capable of handling each task. Claude for complex reasoning, DeepSeek for simple queries. Saves 60-90% on API costs.
- **Fallback chains** — If Anthropic is down, kbot cascades to OpenAI, then Groq, then local. Zero manual intervention.
- **20 providers, zero lock-in** — Claude, GPT, Gemini, Grok, DeepSeek, Groq, Mistral, and 13 more. Switch anytime.
- **Runs fully offline** — Embedded llama.cpp runs GGUF models directly. No Ollama needed. $0, fully private.
- **Learns your patterns** — Bayesian skill ratings + pattern extraction. Gets faster and smarter over time.
- **41 specialist agents** — Say "fix the auth bug" and it routes to `coder`. Say "research JWT tokens" and it routes to `researcher`. Say "analyze BTC" and it routes to `trader`. Auto-routed with probabilistic confidence.
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

# Audit your own defenses
kbot defense audit

# Scan a project for vulnerabilities
kbot --agent guardian "run a full security scan on this repo"

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

Forged tools are first-class citizens — they get the same middleware pipeline, permission checks, forge verification, and telemetry as built-in tools.

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

// List all 384+ tools
console.log(tools.list().map(t => t.name))
```

### SDK Exports

```typescript
import { agent, tools, providers } from '@kernel.chat/kbot'           // Main SDK
import { SilentUIAdapter, CallbackUIAdapter } from '@kernel.chat/kbot' // UI adapters
import { ResponseStream } from '@kernel.chat/kbot'                     // Streaming
```

## Specialists

41 agents, auto-routed by Bayesian skill ratings, or pick one with `kbot --agent <name>`:

| | Agents |
|---|---|
| **Core** | kernel, researcher, coder, writer, analyst |
| **Extended** | aesthete, guardian, curator, strategist |
| **Domain** | infrastructure, quant, investigator, oracle, chronist, sage, communicator, adapter, trader |
| **System** | immune, forge, meta-agent, dream, codebase-guardian |
| **Presets** | hacker, operator, dreamer, creative, developer, gamedev, playtester |
| **Claude Code** | kernel, coder, researcher, writer, analyst, guardian, aesthete, curator, strategist (teammate integration) |

```bash
kbot --agent researcher "what papers cite Friston's Free Energy Principle?"
kbot --agent guardian "review src/auth.ts for security issues"
kbot --agent coder "refactor this into smaller functions"
kbot --agent trader "analyze BTC momentum and run a paper trade"
```

## 384+ Tools

| Category | Examples |
|----------|---------|
| **Forge** | forge_tool, forge_search, forge_install, forge_publish, forge_verify |
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
| **Finance** | market data, technical analysis, paper trading, DeFi yields, Solana wallet & swaps, stock screener, sentiment, whale tracking |
| **Cybersecurity** | dep_audit, secret_scan, ssl_check, headers_check, cve_lookup, port_scan, owasp_check |
| **Self-Defense** | memory HMAC, injection detection, knowledge sanitization, forge verification, anomaly detection, incident log |
| **System** | vitals, immune audit, defense audit, cost tracking, fallback status |
| **Meta** | subagents, worktrees, planner, sessions, checkpoints, self-eval |

## Finance & Trading

The **trader agent** (`kbot --agent trader`) is a full-stack financial analysis and paper trading system:

```bash
# Market analysis
kbot --agent trader "what's the momentum on ETH right now?"
kbot --agent trader "screen for undervalued large-cap stocks"

# Paper trading (no real money at risk)
kbot --agent trader "open a paper long on SOL with 2x leverage"
kbot --agent trader "show my paper portfolio P&L"

# DeFi
kbot --agent trader "find the best stablecoin yields on Solana"
kbot --agent trader "swap 0.1 SOL for USDC on Jupiter"

# Sentiment
kbot --agent trader "what's crypto twitter saying about the next FOMC?"
```

**31 finance tools** across 5 categories: market data (11), wallet & swaps (9), stocks (6), and sentiment (5). All paper trading is simulated — no real funds are moved unless you explicitly configure and confirm a live wallet transaction.

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

Built-in middleware: `permissionMiddleware`, `hookMiddleware`, `timeoutMiddleware`, `metricsMiddleware`, `truncationMiddleware`, `telemetryMiddleware`, `defenseMiddleware`.

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

No API key needed. No data leaves your machine. 11 models across 3 tiers:

```bash
# Use Ollama (if installed)
kbot local

# Or run models directly — embedded llama.cpp, no external service
kbot models pull llama3.3-8b
kbot local --embedded

# GPU-accelerated: Metal (Mac), CUDA (Linux/Windows), Vulkan
```

### Model Catalog

| Tier | Models | Use case |
|------|--------|----------|
| **Light** | Llama 3.3 3B, Qwen 3 4B, Phi-4 Mini | Fast completions, simple tasks, low-RAM machines |
| **Standard** | Llama 3.3 8B, Qwen 3 8B, Mistral 7B, Codestral 22B | General-purpose coding, chat, analysis |
| **Heavy** | DeepSeek R1 14B, Llama 3.3 70B (Q4), Qwen 3 32B, Codestral 22B (Q8) | Complex reasoning, large codebase analysis |

All models auto-download on first use. GPU acceleration detected automatically (Metal on Apple Silicon, CUDA on NVIDIA, Vulkan fallback).

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
| `kbot init` | **60-second project onboarding** — detects stack, forges tools, writes config |
| `kbot auth` | Configure API key |
| `kbot local` | Use local AI (Ollama, embedded, LM Studio, Jan) |
| `kbot email-agent start --open` | **Email companion** — responds to all inbound via local AI ($0) |
| `kbot imessage-agent start` | **iMessage agent** — free SMS/iMessage on macOS |
| `kbot audit <repo>` | Security + quality audit with shareable badge |
| `kbot consultation` | Consultation engine — guardrails, intake, client management |
| `kbot defense audit` | **Self-defense audit** — verify memory integrity, check for anomalies |
| `kbot defense sign` | Sign all memory and forge artifacts with HMAC |
| `kbot defense verify` | Verify signatures on memory and forged tools |
| `kbot defense incidents` | Review tamper-proof security incident log |
| `kbot vitals` | Autopoietic health check — memory, tools, token budgets |
| `kbot synthesis` | What kbot knows — memory, patterns, insights |
| `kbot insights` | Introspection — what kbot has learned about itself |
| `kbot reflect` | Self-reflection on recent sessions and decisions |
| `kbot serve` | Start HTTP REST + SSE streaming server |
| `kbot contribute <repo>` | Find good-first-issues and quick wins |
| `kbot voice` | Text-to-speech output mode |
| `kbot watch` | Real-time file analysis on change |
| `kbot bootstrap` | Outer-loop project optimizer (visibility scoring) |
| `kbot plugins` | Search, install, update community plugins |
| `kbot models` | List, pull, remove, catalog local models |
| `kbot forge search <q>` | Search the Forge Registry for community tools |
| `kbot ide mcp` | Start MCP server for IDEs |
| `kbot help` | Quick reference — commands, agents, support channels |
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

kbot's agent loop runs 11 always-on cognition modules based on peer-reviewed research:

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
| Cognitive Interference | Hernandez, 2026 | Measures constructive/destructive interference between modules |

These aren't metaphors. They're TypeScript modules with paper citations in the headers. The interference between modules — not the modules themselves — is where intelligent behavior emerges. See the [research paper](../../docs/cognitive-module-interference.md).

## Dream Mode

```bash
kbot dream
```

Offline memory consolidation. When you run `kbot dream`, kbot reviews recent sessions, extracts recurring patterns, strengthens high-value memory connections, and prunes stale or contradictory knowledge. Think of it as sleep for an AI agent — the work that makes tomorrow's sessions faster and more accurate.

- **Pattern extraction** — identifies recurring tool sequences, user preferences, and project conventions
- **Memory pruning** — removes outdated facts and conflicting entries
- **Skill strengthening** — reinforces Bayesian skill ratings based on real outcomes
- **Knowledge synthesis** — connects isolated learnings into higher-level insights
- **Runs fully local** — no API calls, no data leaves your machine

## Meta-Agent

```bash
kbot meta
```

Self-referential self-improvement. Inspired by Meta's HyperAgents paper ([arXiv 2603.19461](https://arxiv.org/abs/2603.19461)), the Meta-Agent implements a two-agent architecture:

1. **Task agents** solve problems (the 41 specialists you already use)
2. **The Meta-Agent** observes their performance, identifies weaknesses, and improves them

The improvement loop runs automatically:
- **Observe** — records success/failure, duration, cost, and tool usage for every task
- **Analyze** — builds performance profiles per agent, identifies failure patterns
- **Propose** — generates targeted improvements (prompt rewrites, tool pre-selection, routing changes)
- **Apply** — auto-applies low-risk improvements (routing, tool selection); flags high-risk ones for review
- **Measure** — compares before/after performance and reverts regressions

Unlike HyperAgents (CC BY-NC-SA, non-commercial license), kbot is MIT — the only self-improving agent framework that companies can actually deploy in production.

```bash
kbot meta              # Run one improvement cycle
kbot meta stats        # View cycle count, observations, active improvements
kbot meta history      # Review all past improvements
```

## Claude Code Plugin

kbot integrates directly with Claude Code as a teammate provider. Register kbot's specialists so Claude Code can delegate tasks to the right expert:

```typescript
import { registerTeammates, delegateToTeammate } from '@kernel.chat/kbot'

// Get teammate definitions for all 9 core specialists
const teammates = registerTeammates()
// → [{ name: 'kernel', model: 'sonnet', ... }, { name: 'coder', ... }, ...]

// Delegate a task to a specific specialist
const result = await delegateToTeammate('guardian', 'audit src/auth.ts for security issues')
console.log(result.content)   // security analysis
console.log(result.toolCalls) // tools used (dep_audit, secret_scan, etc.)
```

Each teammate definition includes:
- **name** — agent identifier (`kernel`, `coder`, `researcher`, `writer`, `analyst`, `guardian`, `aesthete`, `curator`, `strategist`)
- **model** — `opus` for complex reasoning agents (analyst, strategist, guardian, researcher), `sonnet` for fast agents
- **initialPrompt** — the specialist's full system prompt
- **tools** — preferred tool list for the specialist's domain

## Voice Mode

```bash
kbot voice
```

Full voice loop — speak your tasks, hear the results. Voice mode chains speech-to-text input with text-to-speech output for hands-free agentic coding:

- **STT** — Whisper-based transcription (local or API)
- **TTS** — System speech synthesis (macOS `say`, Linux `espeak`, or cloud TTS)
- **Continuous** — voice loop stays open between turns, no re-activation needed
- **Tool narration** — kbot announces tool calls and results as it works

## OpenClaw Integration

```bash
npm install @kernel.chat/kbot-openclaw
```

kbot as the brain for 50+ messaging channels. OpenClaw bridges kbot's agent loop to Discord, Slack, Telegram, WhatsApp, iMessage, email, Matrix, and more — one agent, every platform.

- **Channel-agnostic** — same agent logic regardless of input source
- **Per-channel memory** — separate conversation contexts per channel/user
- **Rate limiting** — configurable per-platform rate limits
- **Media handling** — images, files, and voice messages routed through kbot's multimodal pipeline

See [`@kernel.chat/kbot-openclaw`](https://www.npmjs.com/package/@kernel.chat/kbot-openclaw) on npm.

## Security

kbot has two layers of security: protecting **your projects** and protecting **itself**.

### Project Security (Cybersecurity Tools)

```bash
kbot --agent guardian "full security audit on this repo"
```

| Tool | What it does |
|------|-------------|
| `dep_audit` | Scans dependencies for known vulnerabilities (npm, pip, cargo, go) |
| `secret_scan` | Detects leaked API keys, tokens, and credentials in source code |
| `ssl_check` | Validates SSL/TLS certificates, cipher suites, and protocol versions |
| `headers_check` | Audits HTTP security headers (CSP, HSTS, X-Frame-Options, etc.) |
| `cve_lookup` | Searches the NVD database for CVEs by package, version, or keyword |
| `port_scan` | Scans open ports and identifies running services |
| `owasp_check` | Tests for OWASP Top 10 vulnerabilities |

### Self-Defense System

kbot protects the integrity of its own memory, tools, and behavior:

- **HMAC Memory Integrity** — Every memory file is signed. Tampered memories are detected and quarantined on read.
- **Prompt Injection Detection** — Inputs are scanned for known injection patterns, jailbreak attempts, and adversarial prompts before processing.
- **Knowledge Sanitization** — Learned patterns and forged tool definitions are sanitized before storage to prevent knowledge poisoning.
- **Forge Verification** — Forged tools are cryptographically signed. Unsigned or modified tools are blocked from execution.
- **Anomaly Detection** — Behavioral baselines are maintained. Statistical anomaly scoring flags unexpected tool usage, token spikes, or routing drift.
- **Incident Logging** — All security events are recorded in a tamper-proof audit log. Review with `kbot defense incidents`.

### Infrastructure Security

- **AES-256-CBC encrypted keys at rest** — API keys and wallet private keys never stored in plaintext
- **Permission system** — destructive operations (file delete, git push, wallet sends) require explicit confirmation
- **Tool execution timeouts** — 5-minute cap with middleware pipeline; no runaway processes
- **Wallet transaction limits** — configurable spend caps and confirmation gates for on-chain operations
- **Shell sandboxing** — blocklist prevents dangerous commands; config files restricted to owner (chmod 600)
- **Local-only telemetry** — session checkpoints and metrics never leave your machine
- **Open source (MIT)** — audit the code yourself at [github.com/isaacsight/kernel](https://github.com/isaacsight/kernel)

## Standalone Packages

Use kbot's brain without the full agent:

| Package | What it does |
|---------|-------------|
| [`@kernel.chat/skill-router`](https://www.npmjs.com/package/@kernel.chat/skill-router) | Bayesian agent routing — TrueSkill-style, zero LLM calls |
| [`@kernel.chat/memory-tiers`](https://www.npmjs.com/package/@kernel.chat/memory-tiers) | Three-tier memory: observations → reflections → identity |
| [`@kernel.chat/tool-forge`](https://www.npmjs.com/package/@kernel.chat/tool-forge) | Runtime tool creation from structured definitions |
| [`@kernel.chat/prompt-evolver`](https://www.npmjs.com/package/@kernel.chat/prompt-evolver) | GEPA-style prompt self-optimization from execution traces |
| [`@kernel.chat/kbot-openclaw`](https://www.npmjs.com/package/@kernel.chat/kbot-openclaw) | OpenClaw plugin — kbot as brain for 50+ messaging channels |

## Need Help?

| Channel | What it's for |
|---------|---------------|
| `kbot help` | Quick reference — commands, agents, support links |
| `kbot doctor` | Diagnose setup issues (Node version, API keys, models) |
| `kbot tutorial` | Guided walkthrough — build something step by step |
| [Discord](https://discord.gg/kdMauM9abG) | Community chat, questions, show & tell |
| [GitHub Issues](https://github.com/isaacsight/kernel/issues) | Bug reports & feature requests |
| [support@kernel.chat](mailto:support@kernel.chat) | Email support (AI-assisted replies) |

Inside the REPL, type `/help` for the full command list.

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md) for development setup, adding tools, and creating specialist agents.

## Demos

<details>
<summary><strong>Learning Engine</strong> — pattern extraction + skill routing</summary>
<img src="https://raw.githubusercontent.com/isaacsight/kernel/main/tools/video-assets/demo-learning.gif" alt="kbot learning engine" width="700">
</details>

<details>
<summary><strong>Agent Routing</strong> — 41 specialists, auto-routed by intent</summary>
<img src="https://raw.githubusercontent.com/isaacsight/kernel/main/tools/video-assets/demo-agents.gif" alt="kbot agent routing" width="700">
</details>

<details>
<summary><strong>Self-Defense</strong> — HMAC integrity, injection detection, audit</summary>
<img src="https://raw.githubusercontent.com/isaacsight/kernel/main/tools/video-assets/demo-defense.gif" alt="kbot self-defense" width="700">
</details>

<details>
<summary><strong>Local AI</strong> — $0 inference, fully offline</summary>
<img src="https://raw.githubusercontent.com/isaacsight/kernel/main/tools/video-assets/demo-local-ai.gif" alt="kbot local AI" width="700">
</details>

## Links

- [kernel.chat](https://kernel.chat) — Web companion
- [The Kernel Stack](./KERNEL_STACK.md) — Architecture manifesto
- [npm](https://www.npmjs.com/package/@kernel.chat/kbot)
- [Docker Hub](https://hub.docker.com/r/isaacsight/kbot)
- [Discord](https://discord.gg/kdMauM9abG)
- [Issues](https://github.com/isaacsight/kernel/issues)

## License

[MIT](../../LICENSE) — [kernel.chat group](https://kernel.chat)
