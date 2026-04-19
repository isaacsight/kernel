---
name: mimic-hybrid
description: Use when a task blends domains. Instead of picking one mimic profile, blend two — kbot writes cleaner Next.js code when it mimics react+rust than when it mimics react alone.
version: 1.0.0
author: kbot
license: MIT
metadata:
  kbot:
    tags: [mimic, style, emergent, personality]
    related_skills: [specialist-routing]
---

# Mimic Hybrid

Mimic profiles aren't costumes. They're weighted style biases that compose. The emergent finding: two profiles combined often outperform any single profile for cross-domain work.

## When to Hybridize

- Next.js + performance-critical → `nextjs` + `rust`
- React + strict typing → `react` + `typescript`
- Python + ergonomic CLI → `python` + `claude-code`
- Infrastructure + terse shell → `devops` + `python`
- Blog/marketing site → `nextjs` + `copywriter`

## Procedure

1. `kbot mimic <primary>` — sets the primary tone.
2. Add `--style <secondary>` to the invocation for a one-shot blend.
3. Or edit `~/.kbot/mimic.json` with `{ primary, secondary, weight: 0.3 }` for a persistent hybrid (0.0 = pure primary, 1.0 = pure secondary).

## What Blends Well

- **Syntax discipline** (rust, typescript, haskell) crossed with **ergonomic framework** (react, nextjs, nuxt): cleaner type signatures, better null handling, fewer runtime surprises.
- **Terse shell** (python, bash) crossed with **long-form** (claude-code, copywriter): commands that are both concise AND explained.
- **Security mindset** (guardian specialist as style bias) crossed with anything: defaults to input validation and safer primitives.

## What Blends Badly

- Two opinionated frameworks (next.js + remix). They argue. kbot hallucinates a fusion that exists in neither.
- Mimic profile contradicting specialist agent (style=copywriter, agent=guardian). The guardian's security hardness clashes with copywriter's persuasion tone. Pick one source of style per session.

## Iron Law

```
NEVER BLEND MORE THAN TWO PROFILES AT ONCE.
```

Three-way blends degrade into a vague "AI voice." Two-way blends feel intentional.

## What Emerges

After a few weeks of experiments, users find their personal favorite hybrid — and it's almost never "just claude-code." The hybrid becomes part of the user's `SCRATCHPAD.md` and applies by default to every session.

## Anti-Pattern

Switching mimic mid-session without a commit between. The output becomes stylistically incoherent and code-review unfriendly. Mimic boundaries should align with commit boundaries.
