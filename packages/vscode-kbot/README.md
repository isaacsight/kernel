# kbot for VS Code

Open-source AI agent with 35 specialists, 600+ tools, and 20 providers — now in your editor.

## Features

- **MCP Server** — kbot's 12 tools available in VS Code chat via `@kbot`
- **Right-click menu** — Explain, Review, Generate Tests on any selection
- **Fix errors** — One command to fix all errors in the current file
- **Agent picker** — Choose from 17 specialist agents (coder, researcher, guardian, etc.)
- **Status bar** — kbot is always one click away
- **Runs offline** — Use local models with Ollama or embedded llama.cpp

## Requirements

Install kbot globally:

```bash
npm install -g @kernel.chat/kbot
```

## Commands

| Command | What it does |
|---------|-------------|
| `kbot: Start Chat` | Open chat input |
| `kbot: Explain Selection` | Explain selected code |
| `kbot: Review Selection` | Review selected code for issues |
| `kbot: Fix Error` | Fix all errors in current file |
| `kbot: Generate Tests` | Generate tests for selected code |
| `kbot: Ask Agent...` | Pick a specialist and ask a question |

## Settings

| Setting | Default | Description |
|---------|---------|-------------|
| `kbot.binaryPath` | `kbot` | Path to kbot binary |
| `kbot.defaultAgent` | `kernel` | Default specialist agent |
| `kbot.enableMcpServer` | `true` | Register kbot's MCP server |

## Links

- [kbot on npm](https://www.npmjs.com/package/@kernel.chat/kbot)
- [GitHub](https://github.com/isaacsight/kernel)
- [kernel.chat](https://kernel.chat)
- [Discord](https://discord.gg/kdMauM9abG)
