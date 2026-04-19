---
name: autopoiesis-loop
description: Use when planning multi-session work. The autopoiesis loop is kbot using itself to improve itself — every session should end a little sharper than it started.
version: 1.0.0
author: kbot
license: MIT
metadata:
  kbot:
    tags: [self-improvement, meta, dogfood, autopoiesis]
    related_skills: [skill-self-authorship, teacher-trace-curation, dream-to-commit]
---

# The Autopoiesis Loop

kbot is the tool *and* the workbench. Every session has two outputs: the thing the user asked for, and the incremental improvement to kbot itself. Sessions that only produce the first are leaving compound interest on the table.

## The Five Moves (once per session)

1. **Session start** — run `kbot bootstrap`. The bootstrap agent surfaces the highest-leverage improvement based on accumulated signals. Do this before feature work, not instead of it.
2. **During work** — notice repeated patterns. Each repetition is a skill waiting to be written (`skill-self-authorship`).
3. **On friction** — missing tool? `forge-reflex`. Wrong specialist? Update the learned router via corrective feedback.
4. **Session end** — update `SCRATCHPAD.md` with what you learned (not what you did). The next session's opening context reads this file.
5. **Overnight** — the dream engine consolidates transcripts into memory entries. The daemon reviews diffs, runs code quality scans, translates i18n. Work continues while the user sleeps.

## Iron Law

```
NEVER END A SESSION WORSE THAN IT STARTED.
```

If kbot hit a wall and you didn't leave a corrective signal behind (a skill, a memory, a scratchpad note, a corrected learned-router pattern), the loop is broken.

## The Three Signals That Compound

- **Corrections** — user says "no, do X instead." These go into `~/.kbot/corrections/` and load as closed-loop prompts.
- **Teacher traces** — every non-local Claude call is logged to `~/.kbot/teacher/traces.jsonl`. Weekly, `kbot train-self` fine-tunes local models on the best ones.
- **Skills** — successful patterns distilled into `~/.kbot/skills/`. Loaded on relevance.

Each of these runs automatically once wired up. The skill is knowing to wire them up in the first place.

## What Emerges

Three weeks of active use and kbot's answers start feeling tuned to *this user* specifically. Six weeks in, the local model (via `train-self`) is answering basic questions at zero cost. Three months in, kbot's corrections archive has more collective wisdom than the user's own notes.

## Anti-Pattern

Running kbot as a pure consumer — asking questions, using answers, never looking at what's in `~/.kbot/`. You're paying for the loop with every API call but not collecting the dividend.
