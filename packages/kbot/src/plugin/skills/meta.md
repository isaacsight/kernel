---
name: meta
description: Run meta-agent cycle — analyze task agent performance, propose and apply improvements
---

# kbot Meta-Agent

Run kbot's meta-agent cycle. The meta-agent watches task agent performance and rewrites agents to be better.

## Steps

1. Run a meta-agent cycle: `kbot meta` or programmatically via the meta-agent module
2. The cycle follows this loop:
   - **Observe** — collect performance data from recent task agent runs (success rate, duration, tokens, cost, user satisfaction)
   - **Analyze** — identify improvement opportunities (slow agents, high-cost patterns, failed routings)
   - **Generate** — propose improved prompts, routing rules, or tool configurations
   - **Apply** — write the improvements to kbot's configuration
   - **Measure** — compare before/after metrics to verify the improvement helped
3. Review the improvement history at `~/.kbot/meta-agent/improvement-history.json`
4. Report what was observed, what improvements were proposed, and whether they were applied

## Notes

- The meta-agent is inspired by Meta's HyperAgents (arXiv 2603.19461), but kbot's implementation is MIT-licensed
- Improvements compound over time — each cycle makes the next cycle's starting point better
- Safe to run: improvements are written to config files, not source code
- Observations are stored at `~/.kbot/meta-agent/observations.json`
