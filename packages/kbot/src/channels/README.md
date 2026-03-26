# kbot Channel for Claude Code

Bridges kbot's cognitive engine (374+ tools, 41 agents, learning engine) into Claude Code sessions.

## Setup

Add to your `.mcp.json`:

```json
{
  "mcpServers": {
    "kbot-channel": {
      "command": "node",
      "args": ["./node_modules/@kernel.chat/kbot/dist/channels/kbot-channel.js"]
    }
  }
}
```

## Start

```bash
claude --dangerously-load-development-channels server:kbot-channel
```

## What it does

**One-way events (kbot → Claude Code):**
- Messages from external platforms (webhooks, HTTP)
- Learning engine updates (new patterns, routing changes)
- Forge notifications (new tools created)
- Security alerts from the self-defense system

**Two-way tools (Claude Code → kbot):**
- `kbot_reply` — reply through kbot to the originating platform
- `kbot_agent` — delegate to kbot's 26 specialist agents
- `kbot_tools` — list or execute any of kbot's 374+ tools
- `kbot_status` — health check, learning stats, active sessions

**Permission relay:**
- Approve/deny Claude Code tool use via SSE or connected platforms
- Send "yes <id>" or "no <id>" from any connected platform

## Test

```bash
# Watch events
curl -N localhost:7438/events

# Send a message
curl -X POST localhost:7438 -d "explain this codebase" -H "X-Sender: local"

# Health check
curl localhost:7438/health
```

## Architecture

```
External (webhooks, HTTP)
    ↕ kbot Channel (:7438)
    ↕ Claude Code (stdio)
```
