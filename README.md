# Kernel

A personal AI platform with 17 specialist agents, persistent memory, and a terminal-first CLI.

**Live**: [kernel.chat](https://kernel.chat)

## K:BOT — Terminal Agent (v2.1.0)

K:BOT is Kernel's command-line AI agent. It gives you access to the full Kernel Matrix from your terminal — 17 specialist agents, local-first tool execution, and multi-model support.

```bash
npx @kernel.chat/kbot
```

### Features

- **17 Specialist Agents** — Kernel, Researcher, Coder, Writer, Analyst, Aesthete, Guardian, Curator, Strategist, Infrastructure, Quant, Investigator, Oracle, Chronist, Sage, Communicator, Adapter
- **Local-First Tools** — File read/write, git, bash, web search — all run on your machine
- **Multi-Model** — Cloud (Claude, GPT-4, Gemini) or local (Ollama, OpenClaw) — your choice
- **Smart Model Routing** — Auto-selects the best local model per task (code, reasoning, research)
- **Mimic Matrix** — Code like Claude Code, Cursor, Copilot, or framework experts (Next.js, React, Rust, Python)
- **Subagent System** — Spawn parallel workers for research, coding, and analysis
- **BYOK** — Bring your own API key (14 providers supported)
- **Runs Fully Offline** — `kbot ollama` for $0 local AI with open-weight models
- **Sessions** — Save, resume, and share conversations
- **Persistent Memory** — Teach kbot facts that persist across sessions

### Quick Start

```bash
# Install globally
npm install -g @kernel.chat/kbot

# Interactive mode
kbot

# One-shot
kbot "explain this codebase"

# Pipe mode (for scripting)
kbot -p "generate a Dockerfile for this project"

# Use local models (free)
kbot ollama

# Diagnose setup
kbot doctor
```

### Slash Commands

| Command | Description |
|---------|-------------|
| `/agent <name>` | Switch specialist agent |
| `/model <name>` | Switch AI model |
| `/mimic <profile>` | Activate coding style (claude-code, cursor, nextjs, etc.) |
| `/plan <task>` | Autonomous plan-execute mode |
| `/save` | Save conversation |
| `/resume <id>` | Resume saved session |
| `/ollama [model]` | Switch to local models |
| `/thinking` | Toggle extended thinking |
| `/help` | Full command list |

## Web App — kernel.chat

The Kernel web app is a full-featured AI chat platform with:

- **Persistent Memory** — Learns your interests, goals, and communication style
- **Specialist Agent Routing** — Messages route to the right agent automatically
- **Web Search** — Real-time information with source citations
- **Conversation Sharing** — Share and live-share conversations
- **Dark Mode** — Full light/dark theme support
- **Mobile-First** — PWA with iOS and Android builds (Capacitor)
- **Multi-Language** — 15+ languages supported

### Pricing

| Plan | Price | Messages |
|------|-------|----------|
| Free | $0 | 20/day |
| Pro | $39/mo | 1,000+ then $0.03/msg |
| Growth | $249/mo | 10,000 + swarm + priority |

## Stack

- **Web**: React 19 + TypeScript + Vite 6 + Zustand + Framer Motion
- **CLI**: TypeScript + Node.js 20+ (zero runtime deps beyond chalk/ora)
- **Backend**: Supabase (auth, database, realtime)
- **Deploy**: GitHub Pages (web) + npm (kbot)
- **Design**: EB Garamond + Courier Prime, warm ivory (#FAF9F6)

## Development

```bash
# Web app
npm install
npm run dev          # http://localhost:5173
npm run build        # Production build

# K:BOT
cd packages/kbot
npm install
npm run dev          # Run in dev mode
npm run build        # Compile TypeScript
```

## License

MIT
