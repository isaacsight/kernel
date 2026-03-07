---
tags: [kernel, api, reference]
updated: "2026-03-06"
---

# Kernel REST API Reference

Base URL: `https://kernel.chat/api/` (routes through `kernel-api` edge function)

Auth: `Authorization: Bearer kn_live_...`

## Endpoints

### POST /chat
Send a message to a Kernel agent.

```json
{
  "message": "Explain quantum entanglement",
  "agent": "researcher",    // optional, auto-routes if omitted
  "model": "sonnet",        // optional: sonnet (default) or haiku
  "stream": false,          // optional: SSE streaming (Pro+)
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
Multi-agent collaboration (Max tier).

```json
{
  "message": "Design a trading platform architecture",
  "agents": ["architect", "coder", "critic"],  // optional, auto-selects if omitted
  "synthesis_model": "sonnet"
}
```

### GET /agents
List available agents for your tier.

### GET /usage
Monthly usage statistics.

```json
{
  "tier": "pro",
  "monthly_messages": { "count": 247, "limit": 1000 },
  "per_agent": { "coder": { "messages": 123 } }
}
```

## Tier Limits

| | Free | Pro | Max |
|---|---|---|---|
| Messages/mo | 30 | 1,000 | 6,000 |
| Rate limit | 10/min | 60/min | 180/min |
| Agents | 5 core | All 17 | All 17 |
| Streaming | No | Yes | Yes |
| Swarm | No | Yes | Yes |
| Overage | Hard cap | $0.05/msg | $0.04/msg |

## Error Codes

| Code | Meaning |
|------|---------|
| 401 | Invalid or missing API key |
| 403 | Monthly limit exceeded or feature not available for tier |
| 429 | Rate limited (check `Retry-After` header) |
| 400 | Invalid request body |
