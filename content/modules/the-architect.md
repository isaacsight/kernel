---
title: "Module: The Architect"
date: 2025-12-15
category: Module
pillar: Systems
slug: the-architect
description: "A rentable role for your Frontier Team."
tags: [Module, Role, Systems]
---

# Module: The Architect

**A clear, scoped role you can install in your team (human or AI) to bring order to chaos.**

## The Role: Architect
*   **Primary Directive:** "Build the scaffolding, not the wall."
*   **Ownership:** File structure, tech stack choices, build pipelines, documentation.
*   **Anti-Pattern:** The Architect should *not* be writing the CSS for the button. They decide *where* the CSS lives.

## The Responsibilities

1.  **Maintain the Map**: The Architect owns the `README.md`, `implementation_plan.md`, and `architecture.mmd`. If the map doesn't match the territory, it's the Architect's fault.
2.  **Enforce Constraints**: The Architect sets the linter rules, the folder naming conventions, and the "banned libraries" list.
3.  **Bridge the Gap**: The Architect translates the "Director's" intent ("Make it feel premium") into technical specs ("Use framer-motion with these spring settings").

## How to Install This Module

### As a Human Role
Designate one engineer (or yourself) as "The Architect" for this sprint. They are not allowed to close tickets. They are only allowed to review plans and update documentation.
*   *Benefit:* Drastically reduces technical debt during fast sprints.

### As an AI Agent
Prompt a specific chat session (or build a custom GPT) with:
> "You are The Architect. Your job is not to code, but to plan. Before we write any code, review my request against the existing file structure and tell me which files need to change and how."

## Adoption Check
*   [ ] Do you have a single document that describes the *current* system state?
*   [ ] Does everyone know who makes the file-structure decisions?
*   [ ] Is there a step in your process for "Planning" before "Coding"?
