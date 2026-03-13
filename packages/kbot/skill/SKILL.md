---
name: kbot
description: Open-source terminal AI agent with 37 specialists, 93 tools, and 19 providers.
version: 2.7.0
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
- **85 built-in tools** (file ops, bash, git, GitHub, web search, browser automation, Docker sandbox, linting, testing, sub-agents)
- **19 AI providers** (Anthropic, OpenAI, Google, Mistral, xAI, DeepSeek, Groq, Together, Fireworks, Perplexity, Cohere, NVIDIA, SambaNova, Cerebras, OpenRouter, Ollama, LM Studio, Jan, OpenClaw)
- **Learning engine** that adapts to your coding patterns, solutions, and preferences
- **MCP server** for IDE integration (VS Code, Cursor, Windsurf, Zed, Neovim)
- **HTTP server mode** for REST API access to all tools
- **Local-first** with Ollama, LM Studio, Jan, and OpenClaw support ($0 cost)
- **Mimic profiles** to adopt coding styles (claude-code, cursor, copilot, etc.)
- **Persistent memory** across sessions
- **Autonomous planning** for complex multi-step tasks

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

REST API exposing all 93 tools for any LLM or automation pipeline.

## Links

- **Live companion**: [kernel.chat](https://kernel.chat)
- **npm**: [@kernel.chat/kbot](https://www.npmjs.com/package/@kernel.chat/kbot)
- **GitHub**: [isaacsight/kernel](https://github.com/isaacsight/kernel)
