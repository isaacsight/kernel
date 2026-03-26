---
name: dashboard
description: Show kbot's live learning dashboard — tool usage, agent routing, growth metrics
---

# kbot Learning Dashboard

Display kbot's learning dashboard showing real-time stats and growth metrics.

## Steps

1. Run `kbot dashboard` to launch the live terminal dashboard
2. The dashboard shows:
   - **Learning stats** — total patterns, solutions, and knowledge entries learned
   - **Tool usage** — most-used tools, execution times, success rates
   - **Agent routing** — which agents handle which types of tasks, routing confidence
   - **Session history** — recent sessions with message counts and agents used
   - **Growth metrics** — learning rate over time, new patterns per day
   - **Cost tracking** — token usage and estimated cost per session
3. Dashboard refreshes every 5 seconds. Press `q` to quit.
4. Summarize the key metrics after viewing

## Notes

- The dashboard reads from `~/.kbot/memory/` and `~/.kbot/sessions/`
- No API calls are made — all data is local
- If learning data is empty, kbot needs more usage before metrics are meaningful
