---
tags: [kernel, architecture, agents]
updated: "2026-03-06"
---

# Agent System — 17 Specialists

## Flow: User Message → Response

1. **AgentRouter** (Haiku) classifies intent → routes to specialist (confidence ≥ 0.7)
2. If `needsSwarm`: **SwarmOrchestrator** selects 2-4 agents → parallel Haiku contributions → Sonnet synthesis
3. If `isMultiStep`: **TaskPlanner** decomposes into steps → sequential execution → streamed final
4. **MemoryAgent** extracts user profile in background → injected into future prompts

## Specialists (5 core)

| ID | Role | Color | File |
|---|---|---|---|
| `kernel` | General / personal | `#6B5B95` (amethyst) | `specialists.ts` |
| `researcher` | Research & fact-finding | `#5B8BA0` (slate blue) | `specialists.ts` |
| `coder` | Programming | `#6B8E6B` (sage green) | `specialists.ts` |
| `writer` | Content creation | `#B8875C` (warm brown) | `specialists.ts` |
| `analyst` | Strategy & evaluation | `#A0768C` (mauve) | `specialists.ts` |

## Extended Specialists (4, swarm-accessible)

| ID | Role |
|---|---|
| `aesthete` | Visual design & aesthetics |
| `guardian` | Security & safety |
| `curator` | Knowledge curation |
| `strategist` | Business strategy |

## Swarm Agents (5)

| ID | Role | File |
|---|---|---|
| `reasoner` | Deep reasoning | `swarm.ts` |
| `architect` | System design | `swarm.ts` |
| `builder` | Implementation | `swarm.ts` |
| `critic` | Critical analysis | `swarm.ts` |
| `operator` | Operations | `swarm.ts` |

## Discussion Agents (3)

| ID | Role | File |
|---|---|---|
| `panel-architect` | Architecture perspective | `index.ts` |
| `panel-researcher` | Research perspective | `index.ts` |
| `panel-contrarian` | Devil's advocate | `index.ts` |

## Key Design Rules

- AgentSelection uses SPECIALISTS directly when router confidence ≥ 0.7 (NOT swarm mapping)
- File routing: When `ContentBlock[]` (images/PDFs) attached, ALWAYS use direct Claude call — never route through swarm/workflow/research (they only accept strings)
- Artifact auto-promotion: code blocks ≥ 8 lines without `:filename.ext` get auto-promoted with inferred filenames
- `ARTIFACT_RULES` appended to END of every specialist prompt (recency bias)
- `max_tokens`: 8192 for build intents, 4096 otherwise
