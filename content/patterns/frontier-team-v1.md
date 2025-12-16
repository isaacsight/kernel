---
title: "Frontier Team v1"
date: 2025-12-15
category: Pattern
pillar: Systems
slug: frontier-team-v1
description: "A pattern for organizing human and AI agents into distinct roles."
tags: [Pattern, Systems, Teams, AI]
canonical: true
intelligence:
  adoption_date: "2025-09-20"
  status: "active"
  metric_target: "Velocity"
  metric_impact: "+2.5x"
  decision_id: "DEC-003"
---

# Pattern: Frontier Team v1

**A simple, robust pattern for organizing human and AI interaction by assigning clear, named roles rather than treating AI as a generic helper.**

## The Problem
Most teams treat AI as a "chatbot" or a "copilot"—a formless distinct entity you talk to when you're stuck. This leads to:
1.  **Context thrashing**: You have to explain the project from scratch every time.
2.  **Low trust**: You don't know if the AI is good at coding or writing, so you check everything.
3.  **No system**: It doesn't get better over time.

## The Solution
Treat your "team" as a collection of specialized roles, some held by humans, some by agents.

### The Roles

#### 1. The Director (Human)
*   **Responsibility**: Taste, Direction, "Why".
*   **Input**: High-level intent, emotional goals.
*   **Output**: Decisions, final sign-off.

#### 2. The Architect (System/Agent)
*   **Responsibility**: Structure, Constraints, "How".
*   **Input**: The Director's intent.
*   **Output**: Plans, scaffolding, file structures, build scripts.
*   *Note: In my studio, this is often a strict Python script or a highly-prompted coding agent.*

#### 3. The Operator (System/Agent)
*   **Responsibility**: Execution, Grunt Work, "Do".
*   **Input**: The Architect's plans.
*   **Output**: Finished code, successfully run tests, deployed assets.

## When to Use This
*   Use this when you are a solo founder or small team feeling overwhelmed by context switching.
*   Use this when you want to automate a process but don't know where to start (start by defining the "Operator" role).

## Implementation Notes
*   **Start small**: Don't build complex agents. Just name your chat sessions "Architect" or "Operator" and stick to the persona.
*   **Formalize handoffs**: The "Director" should write a clear brief for the "Architect". The "Architect" should write a clear spec for the "Operator".

---
*Status: Active in Studio OS since Dec 2025.*
