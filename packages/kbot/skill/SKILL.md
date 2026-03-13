---
name: kbot
description: Open-source terminal AI agent with 37 specialists, 119 tools, and 19 providers.
version: 2.8.0
license: MIT
metadata:
  openclaw:
    requires:
      bins:
        - node
    emoji: "\U0001F916"
    homepage: https://kernel.chat
    os:
      - macos
      - linux
    install:
      - type: node
        package: "@kernel.chat/kbot"
        global: true
---

# K:BOT

Open-source terminal AI agent by Antigravity Group. Bring your own key, pick your model, run locally.

## Install

```bash
npm install -g @kernel.chat/kbot
```

## Quick Start

```bash
# Interactive mode
kbot

# One-shot
kbot "fix the auth bug in login.ts"

# Force a specialist
kbot --agent researcher "compare React vs Svelte"

# Local models (free, private)
kbot ollama
```

## Features

- **37 specialist agents** with intent-based routing (kernel, researcher, coder, writer, analyst, physicist, mathematician, debugger, and 29 more)
- **119 built-in tools** (file ops, bash, git, GitHub, web search, browser automation, Docker sandbox, E2B cloud sandbox, LSP intelligence, linting, testing, sub-agents)
- **19 AI providers** (Anthropic, OpenAI, Google, Mistral, xAI, DeepSeek, Groq, Together, Fireworks, Perplexity, Cohere, NVIDIA, SambaNova, Cerebras, OpenRouter, Ollama, LM Studio, Jan, OpenClaw)
- **Learning engine** that adapts to your coding patterns, solutions, and preferences
- **Graph memory** — knowledge graph with entity extraction and relationship reasoning
- **Architect mode** — dual-agent plan-review-implement loop for complex refactors
- **Provider fallback** — auto-failover across 19 providers when one goes down
- **Self-evaluation** — responses scored for quality and auto-retried if low
- **Repo map** — Aider-style codebase indexing for automatic context injection
- **MCP server** for IDE integration (VS Code, Cursor, Windsurf, Zed, Neovim)
- **MCP-native plugins** — extend kbot with MCP server plugins
- **LSP integration** — go-to-definition, find-references, hover, rename via language servers
- **HTTP server mode** for REST API access to all tools
- **Local-first** with Ollama, LM Studio, Jan, and OpenClaw support ($0 cost)
- **Mimic profiles** to adopt coding styles (claude-code, cursor, copilot, etc.)
- **Persistent memory** across sessions
- **Autonomous planning** with Magentic-One-style task ledger

## MCP Integration

Add K:BOT as an MCP server in your IDE:

```json
{
  "mcp": {
    "servers": {
      "kbot": {
        "command": "kbot",
        "args": ["ide", "mcp"]
      }
    }
  }
}
```

Exposes 14 tools: `kbot_chat`, `kbot_plan`, `kbot_bash`, `kbot_read_file`, `kbot_edit_file`, `kbot_write_file`, `kbot_search`, `kbot_github`, `kbot_glob`, `kbot_grep`, `kbot_agent`, `kbot_remember`, `kbot_diagnostics`, `kbot_status`.

## HTTP Server

```bash
kbot serve --port 7437 --token mysecret
```

REST API exposing all 119 tools for any LLM or automation pipeline.

## Links

- **Live companion**: [kernel.chat](https://kernel.chat)
- **npm**: [@kernel.chat/kbot](https://www.npmjs.com/package/@kernel.chat/kbot)
- **GitHub**: [isaacsight/kernel](https://github.com/isaacsight/kernel)
