---
tags: [kernel, architecture, agents]
updated: "2026-03-22"
---

# Agent System — 25 Specialists (kbot) + Web Agents

## kbot Agent Roster (v3.20.0)

### Core Specialists (5)

| ID | Role | Color |
|---|---|---|
| `kernel` | General / personal | `#6B5B95` (amethyst) |
| `researcher` | Research & fact-finding | `#5B8BA0` (slate blue) |
| `coder` | Programming | `#6B8E6B` (sage green) |
| `writer` | Content creation | `#B8875C` (warm brown) |
| `analyst` | Strategy & evaluation | `#A0768C` (mauve) |

### Extended Specialists (4)

| ID | Role | Color |
|---|---|---|
| `aesthete` | Visual design & aesthetics | `#F472B6` |
| `guardian` | Security & safety | `#10B981` |
| `curator` | Knowledge curation | `#8B5CF6` |
| `strategist` | Business strategy | `#F59E0B` |

### Domain Specialists (9)

| ID | Role |
|---|---|
| `infrastructure` | DevOps & infra |
| `quant` | Data & quantitative |
| `investigator` | Deep research |
| `oracle` | Predictions |
| `chronist` | History & timeline |
| `sage` | Philosophy & wisdom |
| `communicator` | Communication |
| `adapter` | Translation & adaptation |
| `immune` | Self-audit agent |

### Preset Agents (7)

| ID | Role | Color |
|---|---|---|
| `hacker` | Offensive security, CTFs, red teaming | `#00FF41` |
| `operator` | Autonomous execution | `#FF6B35` |
| `dreamer` | Dream engineering, worldbuilding | `#7B68EE` |
| `creative` | Generative art, shaders, music | `#E879F9` |
| `developer` | kbot self-improvement | `#38BDF8` |
| `gamedev` | Game feel, combat design, Phaser 3, procedural gen | `#FF6B6B` |
| `playtester` | Brutally honest game tester, benchmarks vs Hades/Dead Cells | `#FF4500` |

### Mimic Profiles

kbot can adopt coding styles: `claude-code`, `cursor`, `copilot`, `nextjs`, `react`, `rust`, `python`, etc.

## Routing

1. **Bayesian skill ratings** — TrueSkill-style confidence per agent per task category
2. **Learned router** — pattern-based from historical tool sequences
3. **Complexity detection** — simple (single tool) vs multi-step (planner)
4. **Force override** — `kbot --agent researcher "query"` bypasses routing

## Learning from External Agents

kbot now observes and learns from Claude Code sessions:
- **PostToolUse hook** captures every Claude Code tool call
- **Universal observer** in agent.ts captures kbot's own tool calls (any LLM)
- **Auto-ingest** every 50 tool calls + on session end
- Extracted: tool sequences, tech terms, task types, deployment patterns
- Feeds into: patterns, knowledge, profile, synthesis

## Web App Agents (kernel.chat)

### Specialists (same as kbot core 5 + extended 4)
Routed via Haiku-based AgentRouter with confidence threshold ≥ 0.7

### Swarm Agents (5)
| ID | Role |
|---|---|
| `reasoner` | Deep reasoning |
| `architect` | System design |
| `builder` | Implementation |
| `critic` | Critical analysis |
| `operator` | Operations |

### Discussion Agents (3)
| ID | Role |
|---|---|
| `panel-architect` | Architecture perspective |
| `panel-researcher` | Research perspective |
| `panel-contrarian` | Devil's advocate |

## Claude Code Sub-Agents (`.claude/agents/`)

| Agent | Role |
|-------|------|
| QA | Build verification, screenshot regression |
| Designer | Rubin design system enforcement, a11y |
| Performance | Bundle budgets, dependency audit |
| Security | Defensive — vulnerability scanning |
| Hacker | Offensive — red team, exploit attempts |
| DevOps | Deploy pipeline, health checks |
| Product | UX evaluation, mobile-first testing |
| Ship | Full cycle: sense → build → test → ship |
| Bootstrap | Outer-loop project optimizer |
| Email Agent | Email companion personality |
| Gamedev | Game development specialist |
| Playtester | Brutally honest game tester |
