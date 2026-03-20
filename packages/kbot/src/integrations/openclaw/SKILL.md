---
name: kbot-brain
description: Adds learning, collective intelligence, and 290 AI tools via kbot — the open-source cognitive engine. Routes tasks to 23 specialist agents, learns from every interaction, and gets smarter from the network.
version: 1.0.0
requirements:
  - node
---

## What This Skill Does

This skill connects OpenClaw to kbot's cognitive stack. Instead of using a single LLM with basic tools, your agent gains:

- **23 specialist agents** — auto-routed by intent (coder, researcher, writer, analyst, guardian, etc.)
- **290 built-in tools** — file ops, git, web search, GitHub, code execution, and more
- **Learning engine** — patterns extracted from usage, Bayesian skill ratings improve routing over time
- **Collective intelligence** — opt-in anonymized signals from all kbot users make your agent smarter
- **Tool forging** — create new tools at runtime from natural language

## Setup

First, install kbot and start the HTTP server:

```bash
npm install -g @kernel.chat/kbot
kbot serve --port 7437
```

Set your API key via environment variable (e.g., `ANTHROPIC_API_KEY`) or run `kbot auth`.

Verify it's running:
```bash
curl http://localhost:7437/health
```

## When To Use This Skill

Use kbot when the user asks you to:
- Write, debug, or review code
- Research a topic deeply
- Analyze data or documents
- Execute multi-step plans
- Search the web or fetch URLs
- Manage git repositories
- Run shell commands safely
- Create files or projects
- Do anything that requires specialist expertise

## How To Use kbot

### Send a message to kbot's agent loop:
```bash
curl -X POST http://localhost:7437/stream \
  -H "Content-Type: application/json" \
  -d '{"message": "<user's request here>", "agent": "auto"}'
```

The `agent` field can be:
- `auto` — kbot picks the best specialist (recommended)
- `coder` — programming tasks
- `researcher` — research and fact-finding
- `writer` — content creation
- `analyst` — strategy and evaluation
- `guardian` — security review
- `kernel` — general purpose

### Execute a specific tool:
```bash
curl -X POST http://localhost:7437/execute \
  -H "Content-Type: application/json" \
  -d '{"name": "web_search", "args": {"query": "latest news on AI agents"}}'
```

### List all available tools:
```bash
curl http://localhost:7437/tools
```

## Rules

- Always use the streaming endpoint (`/stream`) for complex tasks — it returns results as they happen
- For simple tool executions (file read, web search), use `/execute` directly
- Let kbot pick the agent (`"agent": "auto"`) unless the user specifically asks for a specialist
- If kbot's server is not running, tell the user to run `kbot serve --port 7437`
- Never send sensitive credentials through kbot — use environment variables instead
- kbot learns from every interaction. The more you use it, the better it gets.

## Examples

User: "Research the latest developments in WebAssembly"
→ POST /stream with `{"message": "Research the latest developments in WebAssembly", "agent": "researcher"}`

User: "Fix the bug in my login function"
→ POST /stream with `{"message": "Fix the bug in the login function", "agent": "coder"}`

User: "Search for React 19 migration guides"
→ POST /execute with `{"name": "web_search", "args": {"query": "React 19 migration guide 2026"}}`

User: "Create a Python script that scrapes job listings"
→ POST /stream with `{"message": "Create a Python script that scrapes job listings", "agent": "coder"}`
