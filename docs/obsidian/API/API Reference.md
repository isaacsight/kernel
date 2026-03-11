---
tags: [kernel, api, reference]
updated: "2026-03-11"
---

# Kernel REST API Reference

Base URL: `https://kernel.chat/api/` (routes through `kernel-api` edge function)

Auth: `Authorization: Bearer kn_live_...`

## Current State

The REST API code exists but is **not publicly exposed**. The platform is free-only with 10 messages per day for all users. The API may be opened in the future.

## Endpoints

### POST /chat
Send a message to a Kernel agent.

```json
{
  "message": "Explain quantum entanglement",
  "agent": "researcher",    // optional, auto-routes if omitted
  "model": "sonnet",        // optional: sonnet (default) or haiku
  "stream": false,          // optional: SSE streaming
  "system": "Be concise"    // optional: custom system prompt
}
```

Response:
```json
{
  "id": "msg_...",
  "agent": "researcher",
  "content": "Quantum entanglement is...",
  "model": "claude-sonnet-4-6",
  "usage": { "input_tokens": 150, "output_tokens": 800 }
}
```

### POST /swarm
Multi-agent collaboration.

```json
{
  "message": "Design a trading platform architecture",
  "agents": ["architect", "coder", "critic"],
  "synthesis_model": "sonnet"
}
```

### GET /agents
List available agents.

### GET /usage
Usage statistics.

```json
{
  "tier": "free",
  "daily_messages": { "count": 7, "limit": 10, "resets_at": "2026-03-12T00:00:00Z" }
}
```

## Rate Limits

| Limit | Value |
|-------|-------|
| Messages per day | 10 |
| Rate limit | 10/min |
| All 20 agents | Available |

## Error Codes

| Code | Meaning |
|------|---------|
| 401 | Invalid or missing API key |
| 403 | Daily limit exceeded or feature not available |
| 429 | Rate limited (check `Retry-After` header) |
| 400 | Invalid request body |
