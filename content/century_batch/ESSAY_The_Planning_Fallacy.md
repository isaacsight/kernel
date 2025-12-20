---
title: "The Planning Fallacy in LLMs"
date: 2025-12-19
category: System_2_Thinking
tags: [Planning, Psychology, AI]
---

# Optimism Bias

Humans always underestimate how long a task will take.
LLMs do too.
"I can build this app in 5 steps," says the Agent.
Step 3 turns out to be a fractal nightmare.

## Simulation First
Before executing, we force the agent to **Simulate**.
"Walk through Step 3 in detail. What could go wrong?"
Agent: "Ah, looking closely, the API documentation is ambiguous. This might take longer."

## Dynamic Replanning
A plan is not a script. It is a hypothesis.
When Step 1 fails, the Agent must NOT push forward.
It must **Replan**.
"The assumption failed. New plan needed."
This flexibility separates a script from an Agent.
