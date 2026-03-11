---
tags: [kernel, architecture, agents]
updated: "2026-03-11"
---

# Agent System — 20 Specialists

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

## Extended Specialists (7, swarm-accessible)

| ID | Icon | Role | Color |
|---|---|---|---|
| `aesthete` | ✨ | Visual design & aesthetics | `#F472B6` (pink) |
| `guardian` | 🛡️ | Security & safety | `#10B981` (emerald) |
| `curator` | 📚 | Knowledge curation | `#8B5CF6` (purple) |
| `strategist` | ♟️ | Business strategy | `#F59E0B` (amber) |
| `hacker` | ⚡ | Offensive security, CTFs, red teaming | `#00FF41` (matrix green) |
| `operator` | ⬡ | Full delegation, autonomous execution | `#FF6B35` (burnt orange) |
| `dreamer` | ☾ | Dream engineering, worldbuilding, vision | `#7B68EE` (slate violet) |

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

## Claude Code Sub-Agents (7)

| Agent | File | Role |
|-------|------|------|
| QA | `.claude/agents/qa.md` | Build verification, screenshot regression, bug reports |
| Designer | `.claude/agents/designer.md` | Rubin design system enforcement, a11y, dark mode |
| Performance | `.claude/agents/performance.md` | Bundle budgets, dependency audit, latency monitoring |
| Security | `.claude/agents/security.md` | Defensive — vulnerability scanning, secrets detection, auth verification |
| Hacker | `.claude/agents/hacker.md` | Offensive — red team exploit attempts, auth bypass, SSRF, XSS, privilege escalation |
| DevOps | `.claude/agents/devops.md` | Deploy pipeline, health checks, rollback procedures |
| Product | `.claude/agents/product.md` | UX evaluation, feature discovery, mobile-first testing |

### Hacker Agent Anti-Hallucination Protocol

Built from research on agent hallucination (Liu 2023, Dhuliawala 2023, Du 2023):
- **4-phase protocol**: Recon → Exploit → Analyze → Report (data collection separated from interpretation)
- **Provenance tags**: `[TOOL]`, `[INFERENCE]`, `[ASSUMPTION]` on every finding
- **Self-verification step**: re-reads findings, downgrades unsubstantiated claims
- **Tool-first reasoning**: run command FIRST, then analyze (prevents confirmation bias)
- **Closed-world tool list**: explicit "you have NO other tools"

## Key Design Rules

- AgentSelection uses SPECIALISTS directly when router confidence ≥ 0.7 (NOT swarm mapping)
- File routing: When `ContentBlock[]` (images/PDFs) attached, ALWAYS use direct Claude call — never route through swarm/workflow/research (they only accept strings)
- Artifact auto-promotion: code blocks ≥ 8 lines without `:filename.ext` get auto-promoted with inferred filenames
- `ARTIFACT_RULES` appended to END of every specialist prompt (recency bias)
- `max_tokens`: 8192 for build intents, 4096 otherwise
