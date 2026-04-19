---
name: cross-agent-blackboard
description: Use when more than one agent works on the same problem. The blackboard is the shared context — without it, agents duplicate work and contradict each other.
version: 1.0.0
author: kbot
license: MIT
metadata:
  kbot:
    tags: [agents, coordination, blackboard, multi-agent]
    related_skills: [specialist-routing, agent-handoff]
---

# Cross-Agent Blackboard

Single-agent sessions use memory. Multi-agent sessions need a blackboard — a shared write-read surface every participating agent sees.

## When

- `kbot --architect` (plan + implement by two agents)
- `/team` running all 6 specialists against the same change
- `agent_handoff` passing control with preserved context
- Matrix agents collaborating on a research question

## Iron Law

```
ANY AGENT TAKING OVER MUST READ THE BLACKBOARD BEFORE ACTING.
ANY AGENT LEAVING MUST WRITE TO THE BLACKBOARD BEFORE EXITING.
```

## Protocol

Blackboard entries have four fields: `type` (decision/finding/blocker/artifact), `key` (short slug), `value` (the payload), `author` (agent id).

- `blackboard_write({ type, key, value })` — before handing off or pausing.
- `blackboard_read({ keyPrefix?, type? })` — on entry or after a long subagent call.
- `blackboard_query()` — full dump when context is lost.

## Example Flow (from a real session)

1. `researcher` investigates a library version incompatibility.
2. Writes `{ type: 'finding', key: 'axios.v1-vs-v2', value: 'v2 breaks the retry middleware' }`.
3. Hands off to `coder` via `agent_handoff`.
4. `coder` reads the blackboard, sees the finding, and skips re-researching.
5. Writes `{ type: 'artifact', key: 'axios-pin', value: 'pinned to 1.6.7 in package.json' }`.
6. `guardian` runs later, reads both entries, confirms no regression, writes `{ type: 'decision', key: 'axios-pin', value: 'approved' }`.

Total time from research to verified fix: 8 minutes. Without the blackboard: each agent would re-derive context, easily 25+ minutes.

## Anti-Patterns

- Passing context through the user ("please tell the next agent X"). The user is not a message bus.
- Writing vague entries ("looked into the bug"). Name the finding concretely or don't write it.
- Reading only your own writes. Other agents' entries are the whole point.

## What Emerges

With the blackboard habit, specialist chains start behaving like one compound agent. The user types one prompt, three specialists take turns, and the handoffs are invisible — because context never dropped.
