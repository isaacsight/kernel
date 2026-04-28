# kbot

<p align="center">
  <strong>kbot</strong><br>
  Open-source terminal AI agent. 100+ specialist skills. 35 specialist agents. 20 providers. Dreams, learns, watches your system, controls your phone. $0 local.
</p>

<p align="center">
  <img src="https://raw.githubusercontent.com/isaacsight/kernel/main/tools/video-assets/demo-quick.gif" alt="kbot demo" width="700">
</p>

<p align="center">
  <a href="https://github.com/isaacsight/kernel/actions/workflows/ci.yml"><img src="https://github.com/isaacsight/kernel/actions/workflows/ci.yml/badge.svg" alt="CI"></a>
  <a href="https://www.npmjs.com/package/@kernel.chat/kbot"><img src="https://img.shields.io/npm/v/@kernel.chat/kbot?color=6B5B95&label=npm" alt="npm version"></a>
  <a href="https://www.npmjs.com/package/@kernel.chat/kbot"><img src="https://img.shields.io/npm/dw/@kernel.chat/kbot?color=6B5B95" alt="npm downloads"></a>
  <a href="https://github.com/isaacsight/kernel/blob/main/LICENSE"><img src="https://img.shields.io/github/license/isaacsight/kernel?color=6B5B95" alt="MIT License"></a>
  <a href="https://kernel.chat"><img src="https://img.shields.io/badge/web-kernel.chat-6B5B95" alt="kernel.chat"></a>
  <a href="https://discord.gg/kdMauM9abG"><img src="https://img.shields.io/badge/discord-join-6B5B95?logo=discord&logoColor=white" alt="Discord"></a>
  <a href="https://glama.ai/mcp/servers/isaacsight/kernel"><img src="https://glama.ai/mcp/servers/isaacsight/kernel/badges/score.svg" alt="kbot MCP server"></a>
</p>

```bash
npm install -g @kernel.chat/kbot
```

## Why kbot?

Most terminal AI agents lock you into one provider, one model, one way of working. kbot doesn't.

- **20 providers, zero lock-in** — Claude, GPT, Gemini, Grok, DeepSeek, Groq, Mistral, SambaNova, Cerebras, OpenRouter, and more. Switch with one command.
- **Runs fully offline** — Embedded llama.cpp, Ollama, LM Studio, or Jan. $0, fully private.
- **Learns your patterns** — Bayesian skill ratings + pattern extraction. Gets faster over time.
- **35 specialist agents** — auto-routes your request to the right expert (coder, researcher, writer, guardian, quant, and 30 more). Run any agent manually: `kbot --agent <id> "<prompt>"`. List them: `kbot agents`.
- **100+ specialist skills** — files, bash, git, GitHub, web search, deploy, database, game dev, VFX, research, science, finance, security, music production, iPhone control, and more.
- **v4.0 evidence-based curation** — went from 670 skills to ~100. Every kept skill has telemetry, agent reference, or test coverage. Everything else moved to plugins.
- **Programmatic SDK** — use kbot as a library in your own apps.
- **MCP server built in** — plug kbot into Claude Code, Cursor, VS Code, Zed, or Neovim as a tool provider.

## Use with Claude Code / Cursor / Zed

kbot is designed to compound with your existing AI editor, not replace it. One command wires everything up — MCP server config + a Claude Code skill that pre-authorizes the integration so safety filters don't refuse legitimate kbot calls.

```bash
kbot setup-claude-code   # wires ~/.claude/settings.json + copies kbot skill
kbot setup-cursor        # wires Cursor's MCP config
kbot setup-zed           # wires Zed's MCP config
kbot setup-all           # all three at once
```

Once wired, your editor can call kbot's full suite as `mcp__kbot__*` tools (and the local-Ollama subset as `mcp__kbot-local__*`). Or skip the middleman entirely and run kbot direct: `kbot "<prompt>"`, `kbot --agent <id> "<prompt>"`, `kbot agents`.

## Highlights

### Dream Engine — Your AI Remembers You

After each session, kbot "dreams" — consolidating what it learned about you into durable insights using local Ollama models. $0 cost. Insights feed back into future sessions automatically.

```
kbot dream run        # Trigger consolidation
kbot dream status     # See what kbot learned
kbot dream journal    # Full insight history
kbot dream search     # Find specific memories
```

7-tier memory: pattern cache -> solution index -> user profile -> dream journal -> passive scanner -> music production -> desktop behavior. All tiers feed each other bidirectionally through the dream engine. Dream insights automatically evolve kbot's prompts so it gets better at being *your* specific tool.

### Always-On System Manager

kbot runs 24/7 in the background, managing your entire development environment:

```
kbot watchdog             # Service dashboard — CPU, RAM, disk, all services
kbot wd --restart email   # Restart a crashed service
kbot dream status         # What kbot learned about you
```

- **Service watchdog** — health-checks all background services, auto-restarts crashes
- **Morning briefing** — daily email with downloads, stars, emails, dream insights, service health
- **Behavior learning** — observes which apps you use and when, dreams about your workflow patterns
- **Companion memory** — email agent remembers every user's preferences, goals, and conversation history
- **Proactive follow-ups** — checks in with users who go quiet, referencing their specific context

### Your Buddy — Terminal Companion

Every kbot user gets a unique ASCII buddy that evolves with them:

```
  [=====]       /\  /\       {o,o}       /\_/\
  |[o o]|      (  ..  )      |)__)      ( o.o )
  |  _  |       )    (       -"-"-       > ^ <
  |_____|      (______)\     -|-|-      (_/|\_)
   || ||         || ||      _// \\_       | |
  Robot          Fox          Owl         Cat
```

- **8 species** — deterministic based on your machine. Same user = same buddy always.
- **4 evolution levels** — levels up with XP from sessions, dreams, tool usage
- **18 achievements** — First Dream, Centurion, Tool Master, Night Owl, and more
- **Dream narration** — buddy tells you what it dreamed on startup
- **Chat mode** — `kbot buddy chat` to talk directly to your buddy via local Ollama ($0)
- **Leaderboard** — [kernel.chat/#/leaderboard](https://kernel.chat/#/leaderboard)

### iPhone Control

Control your iPhone from the terminal:

```
kbot phone_message --to "mom" --message "on my way"   # Send iMessage
kbot phone_notify                                       # Read notifications
kbot phone_shortcut --name "Morning Routine"            # Run Shortcuts
kbot phone_call --number "555-1234"                      # FaceTime call
kbot phone_clipboard --action write --text "hello"      # Universal Clipboard
```

### Music Production — Ableton Live Integration

```
kbot produce_beat --genre trap --instruments roland     # Full beat in Ableton
kbot generate_drum_pattern --genre house --bpm 124      # MIDI drum pattern
kbot music_idea "late night drive through Tokyo"        # Creative blueprint
kbot ableton_load_effect --track 2 --name "Saturator"   # Load any plugin
```

Programmatic control of Ableton Live 12 — create tracks, load plugins (including Roland Cloud, Serum 2), write MIDI, set device parameters, fire clips. All from the terminal.

### Financial Analysis

```
kbot market_analysis --ticker AAPL         # 5-perspective coordinated analysis
kbot portfolio_review --holdings '[...]'   # MAGI impact, risk scoring
kbot market_briefing                       # Morning market summary
```

### Cyber Threat Intelligence

```
kbot threat_feed                           # Latest CVEs matched to your stack
kbot ioc_check --indicator "1.2.3.4"      # Check IPs/domains/hashes
kbot attack_surface_scan --domain x.com    # Passive recon + security headers
kbot incident_response --type ransomware   # Generate IR playbook
```

### Design From Your Terminal

```bash
kbot design "a minimal pitch deck cover for our product" --kind deck --pdf --open
kbot design "landing page hero with our brand colors" --kind page
kbot design "interactive prototype of a chat inbox" --kind prototype
```

Local-first alternative to Anthropic's Claude Design. kbot reads your repo's CSS design tokens, typography, and component patterns, then generates a single complete HTML file — no external deps, mobile-first, a11y-clean — that matches your visual system. Optional Playwright-backed PDF export. Runs on your local model at $0, ships with `@kernel.chat/kbot`. No subscription, no upload, no cloud.

### Audit Any Repo in One Command

```
kbot audit facebook/react
kbot audit --share vercel/next.js   # Creates a public Gist
kbot audit --badge your/repo        # Badge for your README
```

Checks security, documentation, code quality, CI/CD, community health, and DevOps. Scored out of 100, graded A-F. Add the badge to your README.

### How it compares

| | kbot | Claude Code | Codex CLI | Aider | OpenCode |
|---|---|---|---|---|---|
| AI providers | 20 | 1 | 1 | 6 | 75+ |
| Specialist agents | 35 | 0 | 0 | 0 | 0 |
| Built-in skills | 100+ | ~20 | ~15 | ~10 | ~15 |
| Science skills | included | 0 | 0 | 0 | 0 |
| Memory system | 7-tier bidirectional | File-based | No | No | No |
| Dream engine | Yes ($0 local) | Cloud API | No | No | No |
| Service watchdog | Yes | No | No | No | No |
| Behavior learning | Yes | No | No | No | No |
| Buddy companion | Yes (8 species) | No | No | No | No |
| iPhone control | Yes | No | No | No | No |
| Music production | Ableton Live | No | No | No | No |
| Visual design | `kbot design` (local, $0) | Separate Claude Design subscription | No | No | No |
| Financial analysis | Multi-agent | No | No | No | No |
| Threat intelligence | Yes | No | No | No | No |
| Buddy leaderboard | kernel.chat | No | No | No | No |
| Offline mode | Embedded + Ollama | No | No | Ollama | Ollama |
| SDK | Yes | No | Yes | No | No |
| MCP server | Yes | N/A | No | No | No |
| Web companion | kernel.chat | No | No | No | No |
| Open source | MIT | Source available | Apache 2.0 | Apache 2.0 | MIT |
| Cost | BYOK / $0 local | $20+/mo | BYOK | BYOK | BYOK |

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

## 100+ Specialist Skills

As of v4.0, kbot ships ~100 curated skills (down from 670 — every kept skill has telemetry, agent reference, or test coverage). The rest are available as plugins.

| Category | Examples |
|----------|---------|
| **Files & Code** | read, write, glob, grep, lint, format, type-check |
| **Shell** | bash, parallel execute, background tasks |
| **Git & GitHub** | commit, diff, PR, issues, code search |
| **Web** | search, fetch, browser automation, browser agent |
| **Research** | arXiv, Semantic Scholar, HuggingFace, NASA, DOI |
| **Data** | CSV read/query/write, transforms, reports, invoices |
| **Quality** | lint (ESLint/Biome/Clippy), test (Vitest/Jest/pytest), deps audit, formatting |
| **Deploy** | Vercel, Netlify, Cloudflare Workers/Pages, Fly.io, Railway |
| **Database** | Postgres, MySQL, SQLite queries, Prisma, ER diagrams, seed data |
| **Containers** | Docker build/run/compose, Terraform |
| **Creative** | p5.js generative art, GLSL shaders, SVG patterns, design variants |
| **VFX** | GLSL shaders, FFmpeg, ImageMagick, Blender, procedural textures |
| **Game Dev** | 16 tools for Godot, Unity, Unreal, Bevy, Phaser, Three.js, PlayCanvas, Defold |
| **Training** | dataset prep, fine-tuning, evaluation, model export |
| **Social** | post to X, LinkedIn, Bluesky, Mastodon — single posts and threads |
| **Sandbox** | Docker sandboxes, E2B cloud sandboxes, isolated code execution |
| **Notebooks** | Jupyter read/edit/insert/delete cells |
| **Build Matrix** | cross-platform builds — mobile, desktop, WASM, embedded, server |
| **LSP** | goto definition, find references, hover, rename, diagnostics |
| **Memory** | persistent memory save/search/update across sessions |
| **MCP** | marketplace search/install, 20 bundled servers |
| **IDE** | MCP server, ACP server, LSP bridge |
| **Forge** | create tools at runtime, publish to registry, install from registry |
| **Meta** | subagents, worktrees, planner, sessions, checkpoints, self-eval |
| **Science & Math** | symbolic compute, matrix ops, FFT, ODEs, probability, optimization, graph theory, OEIS |
| **Physics** | orbital mechanics, circuits, signal processing, particles (PDG), relativity, quantum simulator, beam analysis, fluid dynamics |
| **Chemistry** | PubChem compounds, reactions, periodic table (118 elements), spectroscopy, stoichiometry, thermodynamics |
| **Biology** | PubMed, gene lookup, protein/PDB, BLAST, drug/ChEMBL, pathways, taxonomy, clinical trials |
| **Earth & Climate** | earthquakes/USGS, climate/NOAA, satellite imagery, geology, ocean, air quality, volcanoes, water resources |
| **Neuroscience** | brain atlas, EEG analysis, cognitive models, neural simulation, connectome, psychophysics |
| **Social Science** | psychometrics, game theory, econometrics, social network analysis, survey design, voting systems |
| **Humanities** | corpus analysis, formal logic, argument mapping, ethics frameworks, historical timelines, stylometry |
| **Health & Epidemiology** | SIR/SEIR models, epidemiology calculations, disease surveillance, nutrition, vaccination modeling |
| **Finance** | market data, technical analysis, paper trading, DeFi yields, wallet & swaps, stock screener, sentiment |
| **Cybersecurity** | dep_audit, secret_scan, ssl_check, headers_check, cve_lookup, port_scan, owasp_check |
| **Self-Defense** | memory HMAC, prompt injection detection, knowledge sanitization, forge verification, anomaly detection |

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
    G --> H{100+ Skills}
    H --> I[File ops, bash, git, GitHub, search, deploy, DB, game dev...]
    G --> J[Learning Engine]
    J --> K[Patterns + Solutions + User Profile]
    G --> L[Checkpointing]
    L --> M[Resume from last tool call]
```

## MCP Server

[![kbot MCP server](https://glama.ai/mcp/servers/isaacsight/kernel/badges/card.svg)](https://glama.ai/mcp/servers/isaacsight/kernel)

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

Or run the MCP server via Docker:

```bash
docker run -i --rm kernelchat/kbot ide mcp
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
| `kbot audit <repo>` | Security + quality audit of any GitHub repo (A-F grade) |
| `kbot dream run` | Consolidate session learnings into durable insights |
| `kbot dream status` | See what kbot has learned about you |
| `kbot dream journal` | Full insight history |
| `kbot dream search` | Find specific memories |
| `kbot watchdog` | System dashboard — services, CPU, RAM, disk, Ollama, dreams |
| `kbot wd --restart <svc>` | Restart a crashed background service |
| `kbot contribute <repo>` | Find good-first-issues and quick wins |
| `kbot share` | Share conversation as GitHub Gist |
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
| `kbot ide mcp` | Start MCP server for IDEs |
| `kbot doctor` | 10-point health check |

### Power-User Flags

```bash
kbot --architect "design the auth system"    # Architecture mode — plan before code
kbot --thinking "solve this hard problem"    # Extended reasoning with thinking budget
kbot --self-eval "write a parser"            # Self-evaluation loop — scores and retries
kbot --computer-use "fill out this form"     # Computer use — controls mouse and keyboard
kbot -p "query" > output.txt                 # Pipe mode — clean output for scripting
```

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
- **Discord**: [discord.gg/kdMauM9abG](https://discord.gg/kdMauM9abG)
- **GitHub**: [isaacsight/kernel](https://github.com/isaacsight/kernel)
- **Issues**: [Report a bug](https://github.com/isaacsight/kernel/issues)

## License

[MIT](LICENSE) — [kernel.chat group](https://kernel.chat)
