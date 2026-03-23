---
tags: [kernel, architecture, kbot, cli]
updated: "2026-03-22"
---

# K:BOT — Terminal Agent

K:BOT is Kernel's open-source multi-channel AI agent. 290+ tools, 25 agents, 20 providers. Runs locally for $0 or with any cloud API. Ships with pre-loaded knowledge. Learns from every session.

**npm:** `@kernel.chat/kbot` v3.20.0
**Install:** `npm install -g @kernel.chat/kbot`
**Docker:** `docker run -it isaacsight/kbot`

## Quick Start

```bash
npm install -g @kernel.chat/kbot
kbot init              # 60-second project onboarding
kbot "fix the top bug" # one-shot execution
kbot                   # interactive REPL
```

First run auto-detects Ollama/LM Studio/Jan/env vars. Seeds 14 patterns + 17 knowledge entries. Forges project-specific tools.

## Key Capabilities

| Feature | Description |
|---------|------------|
| **25 Agents** | kernel, researcher, coder, writer, analyst, gamedev, playtester + 18 more |
| **290+ Tools** | Files, bash, git, search, deploy, creative, gamedev, VFX, training, social, audit |
| **20 Providers** | Anthropic, OpenAI, Google, Mistral, xAI, DeepSeek, Groq, + 13 more |
| **Email Agent** | `kbot email-agent start --open` — responds to all inbound via local AI ($0) |
| **iMessage Agent** | `kbot imessage-agent start` — free SMS/iMessage on macOS |
| **Observer** | Learns from Claude Code sessions + its own tool calls (all LLMs) |
| **Seed Knowledge** | New users start with 14 patterns + 17 engineering facts |
| **`kbot init`** | Detects stack, forges project tools, writes .kbot.json in 60 seconds |
| **Forge** | Runtime tool creation + community registry |
| **SDK** | Programmatic API: `import { agent, tools } from '@kernel.chat/kbot'` |
| **MCP Server** | `kbot ide mcp` — works with VS Code, Cursor, Zed, Neovim |
| **Audit** | `kbot audit owner/repo --share` — security + quality report with badge |
| **Local-first** | Ollama, embedded llama.cpp, LM Studio, Jan — $0, fully private |
| **11 Cognitive Modules** | Free Energy, Autopoiesis, Strange Loops, Predictive Processing, etc. |

## Architecture

```
packages/kbot/src/
├── agent.ts            # Core agent loop + universal observer
├── cli.ts              # 3,998 lines — all commands, REPL, setup
├── auth.ts             # 20 providers, BYOK, auto-detection
├── init.ts             # Project onboarding (kbot init)
├── observer.ts         # Cross-session learning (all LLMs)
├── seed-knowledge.ts   # Pre-loaded patterns + facts for new users
├── learning.ts         # Pattern cache, solution index, user profile
├── memory-synthesis.ts # Three-tier generative memory
├── consultation.ts     # Email consultation pipeline
├── email-agent.ts      # Autonomous email companion
├── imessage-agent.ts   # iMessage/SMS agent (macOS)
├── agents/
│   ├── specialists.ts  # 17 core + extended + domain agents
│   ├── gamedev.ts      # Game development specialist
│   ├── playtester.ts   # Brutally honest game tester
│   ├── creative.ts     # Creative intelligence
│   ├── developer.ts    # kbot self-improvement
│   └── replit.ts       # Replit specialist
├── tools/              # 290+ tools across 20+ categories
│   ├── gamedev.ts      # 16 game dev tools (11,029 lines)
│   ├── training.ts     # Model fine-tuning (2,596 lines)
│   ├── audit.ts        # Repo audit with badges
│   ├── deploy.ts       # Vercel, Netlify, Cloudflare, Fly.io, Railway
│   ├── creative.ts     # Generative art, shaders, music
│   ├── vfx.ts          # GLSL, FFmpeg, ImageMagick, Blender
│   └── ...
├── ide/
│   ├── mcp-server.ts   # MCP for VS Code, Cursor, Zed
│   └── acp-server.ts   # ACP for JetBrains
└── 11 cognitive modules (free-energy.ts, autopoiesis.ts, etc.)
```

## Commands

| Command | Purpose |
|---------|---------|
| `kbot` | Interactive REPL |
| `kbot "prompt"` | One-shot execution |
| `kbot init` | Project onboarding — detect stack, forge tools |
| `kbot auth` | Configure API key (20 providers) |
| `kbot local` | Use local AI ($0, private) |
| `kbot email-agent start --open` | Email companion agent |
| `kbot imessage-agent start` | iMessage agent (macOS) |
| `kbot observe` | Ingest learning from Claude Code sessions |
| `kbot audit <repo> --share` | Audit any GitHub repo with badge |
| `kbot synthesis` | Show learned insights |
| `kbot vitals` | Autopoietic health check |
| `kbot status` | Unified dashboard |
| `kbot doctor` | 10-point setup check |
| `kbot serve` | HTTP REST + SSE server |
| `kbot forge search <q>` | Community tool registry |
| `kbot ide mcp` | MCP server for IDEs |
| `kbot bootstrap` | Visibility scoring |
| `kbot consultation` | Domain guardrails + intake |

## Learning Pipeline

```
Seed knowledge (ships with npm) → 14 patterns + 17 facts
  → User runs kbot (any LLM) → observer records tool calls
  → User uses Claude Code → PostToolUse hook records tool calls
  → Auto-ingest every 50 calls + on session end
  → Learning engine: patterns, solutions, knowledge, profile
  → Memory synthesis: observations → reflections → insights
  → Next session is smarter than the last
```

## 83,622 lines. 18 days. 129 commits. All written by Claude Code.
