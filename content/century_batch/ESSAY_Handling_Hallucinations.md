---
title: "Handling Hallucinations at the Protocol Layer"
date: 2025-12-19
category: Swarm_Architecture
tags: [Hallucination, Engineering, Reliability]
---

# Trust, but Verify

"Hallucination" is a polite word for "Lying."
When an AI invents a library that doesn't exist, it breaks the build.
We cannot train hallucination out of the model completely. It is a feature of the probabilistic nature of LLMs.

So we fix it at the **Protocol Layer**.

## The Verification Loop
We treat every tool call as a "Proposal," not an "Order."
1.  **Agent**: "I will install `numpy-super-fast`."
2.  **Protocol**: Checks PyPI. "Package not found."
3.  **Protocol**: Returns Error to Agent. "This package does not exist. Try again."
4.  **Agent**: "Apologies. I will install `numpy`."

## Structured Schemas
We moved from "Free Text" to "Strict JSON Schemas" (Pydantic).
If the agent outputs a string where an integer is required, the Protocol crashes the *turn*, not the *program*.
It catches the exception and feeds the stack trace back to the agent.

## The "Are You Sure?" Pattern
For destructive actions, the Protocol inserts a mandatory self-reflection step.
*   **Agent**: "Delete database."
*   **Protocol**: "You are about to delete a persistent store. State your reasoning and confirm."
*   **Agent**: "Reasoning: Cleanup. Confirm: Yes."

This momentary pause catches 90% of accidental hallucinations.
We engineer around the creative chaos.
