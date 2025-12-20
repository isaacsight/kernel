---
title: "The Council Protocol: How Agents Debate"
date: 2025-12-19
category: Swarm_Architecture
tags: [Architecture, Multi-Agent, Backend]
---

# Beyond the Chatroom

If you put 5 LLMs in a group chat, you don't get a swarm. You get noise.
To build a true **Breeding Ground for Ideas**, we needed a Protocol. We call it **The Council**.

## The Structure of Debate
The Council is not a flat hierarchy. It is structured:
1.  **The Chair (Main Process)**: Sets the topic and time limit.
2.  **The Proposer (e.g., Architect)**: Offers a solution.
3.  **The Critic (e.g., Guardian)**: Attacks the solution.
4.  **The Synthesizer (e.g., Editor)**: Merges the best parts.

## Structured Output, Not Natural Language
Agents don't talk to each other in English paragraphs. They talk in JSON.
*   **Proposer**: `{ "proposal": "Use Redis", "confidence": 0.9 }`
*   **Critic**: `{ "objection": "Memory overhead", "severity": "high" }`

This structured debate prevents "hallucination drift" where agents get lost in polite conversation.

## The Final Vote
The Council must eventually converge. We implemented a **Consensus Mechanism**.
If the `confidence` score of the synthesis exceeds 0.85, the action is approved. If not, it triggers a "Human Review" request.
We built a bureaucracy that actually works.
