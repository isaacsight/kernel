---
name: systematic-debugging
description: Use when any test fails, any bug surfaces, or any behavior is unexpected. Enforces root-cause analysis before code changes.
version: 1.0.0
author: kbot
license: MIT
metadata:
  kbot:
    tags: [debugging, root-cause, investigation, tdd]
    related_skills: [test-driven-development, ship-pipeline, specialist-routing]
---

# Systematic Debugging

Random fixes waste time and create new bugs. Before writing a single line of fix, you must understand *why* it broke.

## Iron Law

```
NO FIX WITHOUT A NAMED ROOT CAUSE.
```

If you can't finish the sentence "It broke because ___", you are not ready to edit.

## When to Use

- Any failing test
- Any exception in a log
- Any "this used to work"
- Any UI regression
- Any flaky behavior
- Any build failure

Especially use this under time pressure — "quick fix" almost always means "new bug tomorrow."

## Four Phases

### Phase 1 — Reproduce

- Run the failing case *exactly*. Don't paraphrase the command.
- Capture the full error: message, stack, file, line.
- If you can't reproduce, you don't understand the bug yet — stop and gather more evidence.

Tools: `bash` to run the command, `kbot_read` to open the file at the stack trace line, `git_diff` to see what changed recently.

### Phase 2 — Isolate

- Binary-search the change set. Use `git log --oneline -20` and check the last commit that touched the area.
- Trace the data flow upstream from the symptom. The bug almost never lives where the exception fires.
- Find a *working* similar case in the same codebase. What's different?

Tools: `grep` for the bad value, `git_log` for history, subagent with Explore to map the call graph.

### Phase 3 — Hypothesize

- Write down one sentence: "I think this is caused by X because Y."
- Predict what the smallest possible reproduction looks like.
- Predict what the smallest possible fix looks like.

Do **not** write code yet. Share the hypothesis first if the user is watching.

### Phase 4 — Fix

1. Write a failing test that captures the bug (see `test-driven-development`).
2. Make the minimal change that turns it green.
3. Run the full suite. No regressions.
4. Commit with a message that names the root cause, not the symptom.

## The Rule of Three

If your third fix attempt failed, **stop**. Don't try a fourth. The bug is not where you think it is, or the architecture is wrong. Escalate — use `kbot_plan` or hand off to a specialist agent.

## Red Flags (stop and restart)

- "Let me just try this and see"
- "I'll comment this out for now"
- Changing more than one thing per commit
- Adding a try/except to make the error go away
- "It works on my machine"

## How kbot Helps

- `kbot --thinking` shows reasoning — use it when debugging complex issues.
- `kbot --agent coder` routes to the specialist with strongest code-patching track record.
- `kbot --plan` forces read-only investigation mode for Phase 1 & 2.
- `forge_tool` builds a throwaway diagnostic script when stdlib tools aren't enough.
