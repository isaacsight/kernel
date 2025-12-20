---
title: "The Architect's Dilemma: Refactoring vs Rewriting"
date: 2025-12-19
category: Swarm_Architecture
tags: [Engineering, Architecture, Legacy Code]
---

# The Ship of Theseus

When a human engineer looks at a messy codebase, they sigh and say, "Let's rewrite it."
When an AI looks at a messy codebase, it says, "I can work with this."

This is the **Architect's Dilemma**. AIs are *too tolerant* of bad code.

## The Entropy Problem
Because LLMs have high cognitive flexibility, they can navigate spaghetti code easily. They don't feel the pain of a 500-line function the way a human does.
Over time, this allows entropy to accumulate. The system works, but it becomes a labyrinth that no human can enter.

## Enforcing Taste
We had to train the **Architect** agent not just to solve the problem, but to **judge the solution**.
*   **Cyclomatic Complexity Limits**: Hard rules. If the AI writes a nested loop 4 levels deep, the Guardian blocks it.
*   **The "Human Readability" Test**: We prompt the AI: *"Would a junior engineer understand this?"* If no, refactor.

## The Refactoring Agent
We built a specialized agent that runs *only* when the codebase is idle.
It doesn't add features. It just renames variables, extracts methods, and adds type hints.
It is the Janitor of the Swarm. And it is the only reason our system doesn't collapse under its own weight.
