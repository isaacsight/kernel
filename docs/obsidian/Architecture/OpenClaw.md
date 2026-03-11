---
tags: [kernel, architecture, openclaw, security]
updated: "2026-03-11"
---

# OpenClaw — Sandboxed Local AI Gateway

OpenClaw is a sandboxed local AI system running as an isolated macOS user on the development machine. It provides free, private, localhost-only AI capabilities to K:BOT and Claude Code via an MCP server and HTTP gateway.

## Security Model (The Rules)

OpenClaw is **SANDBOXED**. These are the hard boundaries:

1. **Separate macOS user** — `openclaw` standard (non-admin) account at `/Users/openclaw/`
2. **Sandbox policy** — All execution goes through `sandbox-exec` with policy at `/Users/openclaw/.openclaw/sandbox-policy.sb`
3. **Localhost-only networking** — Gateway binds to `127.0.0.1:18789`. No outbound internet.
4. **No access to admin data** — Cannot read Isaac's files, env vars, secrets, Supabase credentials, or Stripe keys
5. **No filesystem access** — MCP server has zero `fs`/`path` imports. Text-in, text-out only through Ollama.
6. **No database access** — No Supabase client, no service key, no database connection
7. **No payment system access** — No Stripe or any billing integration
8. **Authenticated gateway** — Token required for API calls between kbot/Claude Code and the OpenClaw gateway

## Architecture

```
┌──────────────────────────────────────────────┐
│  Isaac's admin session                       │
│                                              │
│  Claude Code ──► openclaw MCP server ──┐     │
│  K:BOT CLI ──► openclaw tools ─────────┤     │
│                                        │     │
│               HTTP localhost:18789     │     │
│               (gateway token auth)     │     │
└───────────────────────┬──────────────────────┘
                        │ su + osascript
┌───────────────────────▼──────────────────────┐
│  /Users/openclaw/ (standard user, sandboxed) │
│                                              │
│  openclaw gateway ──► Ollama (localhost:11434)│
│  openclaw node                               │
│  sandbox-exec -f sandbox-policy.sb           │
│  Own NVM + Node.js installation              │
└──────────────────────────────────────────────┘
```

## Two Integration Points

### 1. MCP Server (`tools/openclaw-mcp.ts`)

Registered as `openclaw` in Claude Code's `.mcp.json`. Communicates directly with Ollama on localhost. **19 tools** across 4 tiers:

| Tier | Tools |
|------|-------|
| **0: Core** | `local_ask`, `local_review`, `local_generate`, `local_models`, `local_explain` |
| **1: High-value** | `local_vision`, `local_commit_message`, `local_test_gen`, `local_refactor`, `local_regex` |
| **2: Workflow** | `local_diff`, `local_docs`, `local_convert`, `local_sql`, `local_translate` |
| **3: Advanced** | `local_summarize`, `local_shell_explain`, `local_diagram`, `local_embeddings` |

All tools are free ($0), run locally, and auto-select the best Ollama model for the task:
- **Code tasks** → `qwen2.5-coder:7b`, `codestral:22b`, `deepseek-coder-v2:16b`
- **Reasoning tasks** → `phi3:14b`, `deepseek-r1:8b`, `gemma3:12b`
- **General tasks** → `gemma2:9b`, `llama3.1:8b`, `mistral:7b`
- **Vision tasks** → `llava:13b` (requires image-capable model)

### 2. K:BOT Tools (`packages/kbot/src/tools/openclaw.ts`)

10 tools registered in kbot's tool system, calling the OpenClaw gateway at `http://127.0.0.1:18789`:

`openclaw_explain`, `openclaw_review`, `openclaw_refactor`, `openclaw_test_gen`, `openclaw_ask`, `openclaw_diagram`, `openclaw_regex`, `openclaw_sql`, `openclaw_shell`, `openclaw_summarize`

Health-check caching (60s) with graceful degradation — if gateway is offline, tools return a helpful message instead of failing.

## Admin Control (`openclaw-cmd`)

Script at `~/Desktop/openclaw-cmd` — controls OpenClaw from Isaac's admin session:

| Command | What it does |
|---------|-------------|
| `openclaw-cmd start` | Start gateway + node services |
| `openclaw-cmd stop` | Stop everything |
| `openclaw-cmd status` | Health check + model status |
| `openclaw-cmd ask "prompt"` | Quick question via HTTP API |
| `openclaw-cmd shell <cmd>` | Run command in openclaw's sandboxed space |
| `openclaw-cmd models <sub>` | Manage models |

Uses `su` + `osascript` with admin privileges to cross the user boundary.

## Configuration

- **Gateway URL:** `http://127.0.0.1:18789` (env: `OPENCLAW_URL`)
- **Gateway token:** Set in `openclaw-cmd` (authenticates API calls)
- **Ollama URL:** `http://localhost:11434` (hardcoded in MCP server)
- **Apache config:** `/etc/apache2/users/openclaw.conf` (Sites directory)
- **K:BOT provider:** `openclaw` in `~/.kbot/config.json` (provider type, model: `openclaw:main`)

## Key Files

| File | Purpose |
|------|---------|
| `tools/openclaw-mcp.ts` | MCP server (19 tools, Ollama integration) |
| `packages/kbot/src/tools/openclaw.ts` | K:BOT tools (10 tools, gateway integration) |
| `packages/kbot/src/auth.ts` | OpenClaw as BYOK provider config |
| `~/Desktop/openclaw-cmd` | Admin control script |
| `/Users/openclaw/.openclaw/sandbox-policy.sb` | macOS sandbox policy |
| `/etc/apache2/users/openclaw.conf` | Apache Sites config |
