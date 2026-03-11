---
tags: [kernel, architecture, kbot, cli]
updated: "2026-03-08"
---

# K:BOT — Terminal Agent

K:BOT is Kernel's open-source CLI agent. Local-first AI from the terminal — 14 providers, 60+ tools, BYOK (bring your own key). An 8th grader can use it.

**npm:** `@kernel.chat/kbot` v2.5.0
**Install:** `npm install -g @kernel.chat/kbot`

## Quick Start

```bash
npm install -g @kernel.chat/kbot
kbot
```

First run auto-detects Ollama/env vars, or walks through a guided 2-option setup. No AI experience needed.

## Key Capabilities

| Feature | Description |
|---------|------------|
| **20 Agents** | kernel, researcher, coder, writer, analyst + 15 more |
| **60+ Tools** | Bash, file I/O, git, code search, GitHub, web fetch, notebooks, sandboxes |
| **14 Providers** | Anthropic, OpenAI, Google, Mistral, xAI, DeepSeek, Groq, Together, Fireworks, Perplexity, Cohere, NVIDIA, Ollama, OpenClaw |
| **BYOK** | Bring Your Own Key — you pay your provider directly, $0 from Kernel |
| **Local-first** | Ollama auto-detection, fully private, $0 cost |
| **Streaming** | Real-time token streaming + extended thinking display |
| **Pipe composable** | `cat file | kbot "explain"`, `--json`, stdout/stderr separation |
| **Diff previews** | Colored diffs before file changes (in `--safe` mode) |
| **Sessions** | Save/resume conversations |
| **Computer use** | Screenshots, mouse, keyboard (opt-in `--computer-use`) |

## Architecture

```
packages/kbot/
├── src/
│   ├── agent.ts       # Core agent loop (message → tools → respond)
│   ├── cli.ts         # REPL, flags, guided setup, slash commands
│   ├── auth.ts        # BYOK key management, 14 provider configs
│   ├── context.ts     # Project context (git, package.json, etc.)
│   ├── memory.ts      # Persistent memory (markdown)
│   ├── streaming.ts   # SSE streaming (Anthropic + OpenAI compat)
│   ├── ui.ts          # Terminal UI (stderr/stdout separation, NO_COLOR)
│   ├── permissions.ts # Permission system (permissive/normal/strict)
│   ├── learning.ts    # Self-training, keyword extraction, stats
│   ├── planner.ts     # Multi-step task decomposition
│   ├── sessions.ts    # Session save/resume
│   ├── plugins.ts     # User plugins from ~/.kbot/plugins/
│   ├── matrix.ts      # Custom agent creation, mimic profiles
│   ├── tools/
│   │   ├── files.ts   # Read/write/edit/glob/grep + diff previews
│   │   ├── bash.ts    # Shell command execution
│   │   ├── git.ts     # Git operations
│   │   ├── search.ts  # Web search (Perplexity, DuckDuckGo)
│   │   ├── github.ts  # GitHub API (issues, PRs, repos)
│   │   ├── computer.ts # Screenshot, mouse, keyboard (opt-in)
│   │   ├── sandbox.ts # Docker sandboxed execution
│   │   ├── notebook.ts # Jupyter notebook support
│   │   ├── subagent.ts # Spawn sub-agents for parallel work
│   │   ├── worktree.ts # Git worktree isolation
│   │   └── ...        # 60+ total
│   └── ide/           # IDE integrations (MCP server, LSP bridge)
```

## CLI Design (2026 Patterns)

Follows clig.dev guidelines, Claude Code patterns, gh CLI conventions:

- **stderr vs stdout** — Status (spinners, errors) → stderr. Content (responses) → stdout. Pipe-safe.
- **NO_COLOR** — Respects `NO_COLOR` env var and non-TTY detection.
- **Context-aware prompt** — Shows directory: `packages/kbot ❯`
- **Conversational errors** — "Ollama isn't running. Open the Ollama app or run: ollama serve"
- **Smart tool filtering** — Casual messages get 0 tools, local models get 10 core tools, cloud gets 60+.

## Auto-Setup Flow

When no provider is configured:

1. **Check env vars** — Scans for `OPENAI_API_KEY`, `ANTHROPIC_API_KEY`, etc. Auto-configures instantly.
2. **Check local** — Pings Ollama + OpenClaw in parallel. Auto-configures if running.
3. **Guided setup** — "Pick 1 or 2": Free & Private (Ollama) or Cloud AI (paste API key).

## CLI Flags

| Flag | Purpose |
|------|---------|
| `-p, --pipe` | Raw text output for scripting |
| `--json` | JSON output (`{content, agent, model, usage}`) |
| `-y, --yes` | Skip all confirmations |
| `-q, --quiet` | No banners, spinners, status |
| `-t, --thinking` | Show AI reasoning steps |
| `--safe` | Confirm destructive ops + diff previews |
| `--strict` | Confirm ALL operations |
| `--computer-use` | Enable screenshot/mouse/keyboard tools |

## REPL Commands

| Command | Purpose |
|---------|---------|
| `/clear` | Reset conversation |
| `/save [name]` | Save session |
| `/resume <id>` | Resume saved session |
| `/model <name>` | Switch AI model |
| `/agent <name>` | Switch specialist |
| `/ollama [model]` | Switch to local Ollama |
| `/remember <…>` | Teach kbot a fact |
| `/thinking` | Toggle reasoning display |

## Sub-commands

| Command | Purpose |
|---------|---------|
| `kbot auth` / `kbot byok` | Set up API key |
| `kbot ollama` | Configure local Ollama |
| `kbot pull` | Download Ollama models |
| `kbot doctor` | Diagnose setup |
| `kbot ide mcp` | Start MCP server for IDEs |

## Pipe Composability

```bash
cat error.log | kbot "explain this error"     # Stdin as context
echo "what is 2+2" | kbot                      # Stdin-only
kbot "summarize" > summary.txt                 # Stdout piping
kbot --json "fix the bug" | jq .content        # JSON mode
kbot -q "list files" 2>/dev/null               # Suppress status
```

## Development

```bash
cd packages/kbot
npm run build          # tsc + chmod +x dist/cli.js
npm run dev            # Run with tsx (no build)
npm run typecheck      # Type-check only
npm publish --access public  # Publish to npm
```
