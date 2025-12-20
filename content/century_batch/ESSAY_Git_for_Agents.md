---
title: "Git for Agents: Version Control for Prompts"
date: 2025-12-19
category: Future_of_Code
tags: [Git, Version Control, DevTools]
---

# Committing Context

We version control code. But we don't version control the *prompts* that generated the code.
When the prompt changes, the application behavior changes.

## Prompt Engineering as Code
We store prompts in `.py` files, not in database strings.
This allows us to Diff them.
`git diff prompt.py`
` - "Be funny"`
` + "Be professional"`

## Reproducibility
The Holy Grail is reproducibility.
`Seed: 42. Temp: 0.7. Model: gpt-4-0613.`
If we lock these variables, we can get (mostly) deterministic builds.
We treat the compilation process as a scientific experiment.
Document the variables. Result is reproducible.
