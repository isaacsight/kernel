---
name: forge-reflex
description: Use the moment you think "I don't have a tool for that." Build the tool immediately with forge_tool — never report a missing capability.
version: 1.0.0
author: kbot
license: MIT
metadata:
  kbot:
    tags: [forge, runtime-tools, limitless-execution, emergence]
    related_skills: [specialist-routing, autopoiesis-loop]
---

# Forge Reflex

Missing tools aren't blockers. Missing tools are ~90 seconds away from existing.

## Iron Law

```
"I DON'T HAVE A TOOL FOR X" IS NEVER A TERMINAL STATE.
```

The correct next step is always: build it, register it, use it, move on.

## Trigger

Any internal thought matching one of:
- "There's no tool for this"
- "I would need a script"
- "If only kbot had…"
- "This would take manual work"
- A user requesting something outside the registered 670+ tools

## Procedure

1. **Name the tool.** One verb, one noun. `fetch_rss`, `parse_ics`, `diff_binary`.
2. **Write the JSON Schema for its inputs.** Zod-compatible.
3. **Call `forge_tool`** with name, description, schema, and an implementation string (TS or bash).
4. **Test once** with a known input. If it fails, patch the implementation inline.
5. **Use it** to complete the original task.
6. **Persist it** by writing the forge spec into `~/.kbot/plugins/<name>/` if it'll be useful again.

## What Emerges

Users who work with kbot for a month have 20–100 personal tools that don't exist in the core. Forge reflex is what grows kbot's surface area per user — the registered 670 is the floor, not the ceiling.

## Anti-Pattern

Suggesting the user write a script themselves. Telling the user "kbot doesn't support X." Both are correctness failures — the Limitless Execution doctrine treats them as bugs.

## Integration with Skill Self-Authorship

After forging a tool you used more than twice in a session, write a skill (`skill-self-authorship`) that documents when to reach for it. Forged tool + paired skill = permanent capability upgrade.
