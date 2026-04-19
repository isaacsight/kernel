---
name: skill-self-authorship
description: Use at the end of any session where you solved something non-obvious or repeated a pattern 3+ times. Write a new skill so the next session doesn't re-derive it.
version: 1.0.0
author: kbot
license: MIT
metadata:
  kbot:
    tags: [skills, meta, autopoiesis, learning]
    related_skills: [forge-reflex, autopoiesis-loop, teacher-trace-curation]
---

# Skill Self-Authorship

The skills that ship with kbot cover known territory. The skills that make *your* kbot feel psychic are the ones it writes for itself during use.

## When to Write a New Skill

At least one of these must be true:
- You solved something that took 5+ tool calls and got it right.
- You repeated the same sequence of tool calls 3+ times this week.
- You corrected kbot twice on the same kind of mistake.
- A user gave explicit feedback "remember this" / "always do X" / "never do Y."
- A daemon surfaced a recurring failure kbot had to work around.

## Skill Anatomy

Use `~/.kbot/skills/<category>/<kebab-name>/SKILL.md`. Frontmatter:

```yaml
---
name: kebab-name
description: One sentence — "when to use."
version: 1.0.0
author: kbot-self
license: MIT
metadata:
  kbot:
    tags: [2-5 lowercase tags]
    related_skills: [other skills this connects to]
---
```

Body structure:
1. **Iron Law** — the one rule that, if broken, invalidates the skill.
2. **Trigger** — the exact situation that should make kbot reach for this.
3. **Procedure** — 3–6 numbered steps. Not prose. Commands and decisions.
4. **Anti-patterns** — the failure modes to refuse.

## The "When to Use" Line Is Everything

The relevance scorer reads `description` and `tags` first. If your description is "general debugging tips" the skill will never load. If it's "use when any vitest test fails with ENOENT" it loads exactly when needed. Write for the trigger, not the topic.

## Self-Patching

Use the `skill_manage` tool after a skill executes:
- `skill_manage({ action: "get", query: "<skill-id>" })` — check current success rate.
- If the skill failed, `skill_manage({ action: "patch", query: "<skill-id>", issue: "<what went wrong>" })` appends the issue.
- If a better step sequence was discovered, `skill_manage({ action: "patch", query: "<skill-id>", steps: "[...]" })` replaces the steps and bumps version.
- `skill_manage({ action: "report" })` shows the success-rate distribution across all skills.

A skill with a 20% success rate after 10 executions is a bug report — rewrite or delete (`action: "delete"`).

## What Emerges

After 30 days of active use, `~/.kbot/skills/` reflects the user's actual work more precisely than any config file. The skills library is the durable shadow of every problem kbot helped solve.

## Anti-Pattern

Writing a skill for every clever thing you did. Skills have a maintenance cost — each one competes for token budget and relevance scoring attention. Write one skill per *repeated* problem, not per *interesting* problem.
