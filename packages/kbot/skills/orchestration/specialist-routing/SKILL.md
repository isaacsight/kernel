---
name: specialist-routing
description: Use when a task clearly belongs to a specialist agent. Route first, reason second — don't let the general agent muddle through a domain it has a specialist for.
version: 1.0.0
author: kbot
license: MIT
metadata:
  kbot:
    tags: [agents, routing, specialists, delegation]
    related_skills: [matrix-agent-spawn, cross-agent-blackboard, agent-handoff]
---

# Specialist Routing

kbot ships with 25+ specialists (run `kbot agents list` for the current roster). The default `kernel` agent is a generalist — competent everywhere, excellent nowhere. The feeling of "kbot is sharp" comes from routing into the right specialist before work starts.

## Iron Law

```
IF A SPECIALIST EXISTS FOR THIS DOMAIN, THE GENERALIST DOES NOT TOUCH IT.
```

## The Roster

| Signal | Specialist | Why |
|---|---|---|
| "review my code", "refactor", "fix this test" | `coder` | strongest code-patching track record |
| "research X", "find me", "what does the literature say" | `researcher` | web + arxiv + citation graph |
| "design this", "make it look right", a11y | `aesthete` | design tokens + spacing + typography |
| "is this safe", secrets, auth, permissions | `guardian` | OWASP checks, dep audit, redact |
| CI, deploys, env vars, launchd, docker | `infrastructure` | full infra toolkit |
| a statistical question, backtesting, distributions | `quant` | stats + finance + probability |
| a 30+ minute deep dive, multi-source | `investigator` | multi-step research workflow |
| "write" anything long-form | `writer` | content creation + editing |
| strategy, tradeoffs, business framing | `strategist` | structured decision support |
| how it's going, "predict X" | `oracle` | forecasting + anticipation |

## Trigger

The moment the user's first message can be classified into the table above. The learned router handles this automatically when confidence ≥ 0.7; below that, you route explicitly: `kbot --agent <id> "..."`.

## Procedure

1. **Classify the task** against the table. If two match, pick the one closer to the *verb* (review → coder; design review → aesthete).
2. **If none match**, stay on `kernel` and invoke the skill that fits instead.
3. **When in doubt**, use `--architect` (plan with one specialist, implement with another) or `--plan` (read-only scoping first).
4. **If the specialist gets stuck**, use `agent_handoff` to pass to another specialist with context — don't fall back to the generalist silently.

## Anti-Pattern

- Running everything on the default agent "for consistency." You lose every specialist advantage.
- Choosing a specialist by *topic* instead of *verb*. "Music" isn't a specialist; `aesthete` handles creative direction and `coder` handles the OSC scripting.
- Routing between specialists mid-task without writing to the blackboard — the next specialist loses context.

## What Emerges

Users develop muscle memory for `kbot --agent <id>`. Over weeks, the learned router picks up which specialist wins which task *for this user* (not average) and routes preemptively. The experience becomes: "I type the prompt, the right expert answers." That's the routing skill paying compound interest.
