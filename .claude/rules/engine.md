---
paths:
  - "src/engine/**"
  - "src/agents/**"
---
# AI Engine Rules

## Architecture

- AgentRouter classifies user intent → routes to specialist
- SwarmOrchestrator handles multi-agent parallel collaboration
- TaskPlanner decomposes multi-step tasks
- MemoryAgent extracts user profile in background

## Models

- Use `haiku` for routing, classification, and fast tasks
- Use `sonnet` for synthesis, deep reasoning, and final outputs
- All calls go through ClaudeClient → claude-proxy edge function

## Agent Files

- Specialists defined in `src/agents/specialists.ts`
- Swarm agents in `src/agents/swarm.ts`
- Each agent has: id, name, description, systemPrompt, color
- NEVER hardcode prompts — always use the agent definition files

## Performance

- Use parallel Haiku calls for swarm contributions
- Stream responses when possible (mode: 'stream')
- Token budget: Haiku max 1024, Sonnet max 4096 for normal responses

## Research Context
Please refer to `KERNEL_RESEARCH.md` in the project root for the definitive background on the Kernel's identity, system architecture, UX philosophy, and aesthetic engineering requirements.
