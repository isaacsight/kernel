---
title: "Studio OS: An AI-First Operating System"
date: 2025-12-09
category: Engineering
tags: [ai, studio-os, architecture, system-design, react, fastapi]
excerpt: "A distributed, agentic operating system for creative work. Orchestrates local Mac agents and remote Windows compute nodes."
status: Active
image: /static/images/studio-os-dashboard.png
---

# The Operating System for One

**Studio OS** is an experiment in "personal enterprise software". It is a distributed operating system designed to orchestrate a team of autonomous AI agents to assist with creative work.

## The Architecture

The system runs on a distributed hybrid-cloud architecture:

1.  **The Control Plane (MacBook Air)**
    *   **Frontend**: A React-based "Mission Control" dashboard that visualizes agent states.
    *   **Orchestra**: A `FastAPI` backend that routes intent and manages state.
    *   **Agents**: Lightweight Python classes (`The Alchemist`, `The Editor`, `The Architect`) that handle specific domains.

2.  **The Compute Plane (Studio Node / Windows)**
    *   **Hardware**: Dual NVIDIA 3090s.
    *   **Model Engine**: Hosting **Qwen 2.5 72B** via VLLM/Exo for heavy reasoning tasks ("Deep Mode").
    *   **Service Mesh**: Tailscale for secure, encrypted node-to-node communication.

## Key Components

### 1. The Dashboard (Mission Control)
A single pane of glass for monitoring the synthetic workforce. It features:
*   Real-time agent status indicators.
*   Command-line interface for natural language instruction.
*   Direct access to "Deep Work" commissioning.

### 2. The Agent Swarm
*   **The Alchemist**: Creative generation and research. Can consult the 72B model for complex reasoning.
*   **The Editor**: Style enforcement and rigorous auditing against the "Gentle Doctrine".
*   **The Librarian**: Knowledge graph management and RAG retrieval.
*   **The Visionary**: Image asset generation.

## Philosophy

Most AI tools force you to work *in* them (chatbots). Studio OS is designed to work *for* you. It observes the file system, listens for webhooks, and acts as a background layer of intelligence that amplifies the capabilities of the solo creator.

*Built in collaboration with Antigravity (Google DeepMind).*
