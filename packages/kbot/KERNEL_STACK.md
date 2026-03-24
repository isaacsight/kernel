# The Kernel Stack

> Claude thinks. kbot acts. Both learn.

The Kernel Stack is what happens when you stop treating AI as a tool and start treating it as infrastructure. It's a self-improving, agent-native development system where Claude Code orchestrates and kbot executes — connected by MCP, compounding with every session.

This isn't a framework. It's an architecture for building software with AI at every layer.

---

## The Stack

```
┌─────────────────────────────────────────────────────────┐
│                    KERNEL STACK                          │
│                                                         │
│  ┌─────────────────────────────────────────────────┐    │
│  │  ORCHESTRATOR — Claude Code (Opus 4.6, 1M ctx)  │    │
│  │  Thinks, plans, writes code, dispatches agents   │    │
│  └──────────────────────┬──────────────────────────┘    │
│                         │ MCP Protocol                   │
│  ┌──────────────────────▼──────────────────────────┐    │
│  │  AGENT FRAMEWORK — kbot (350+ tools, 26 agents) │    │
│  │  Executes, learns, routes, remembers             │    │
│  └──────────────────────┬──────────────────────────┘    │
│                         │                                │
│  ┌──────────┬───────────┼───────────┬──────────────┐    │
│  │ Agents   │ Local AI  │ Backend   │ Deployment   │    │
│  │ 36 specs │ MLX/GGUF  │ Supabase  │ npm + Pages  │    │
│  │ parallel │ 19 models │ Edge Fns  │ Discord      │    │
│  │ learning │ $0 cost   │ Postgres  │ GitHub       │    │
│  └──────────┴───────────┴───────────┴──────────────┘    │
│                                                         │
│  ┌─────────────────────────────────────────────────┐    │
│  │  SELF-IMPROVEMENT LOOP                           │    │
│  │  Bootstrap → Synthesize → Learn → Compound       │    │
│  └─────────────────────────────────────────────────┘    │
└─────────────────────────────────────────────────────────┘
```

## The Seven Layers

### 1. Orchestrator — Claude Code

The brain. Opus 4.6 with 1M token context. Reads entire codebases, reasons about architecture, writes code, and dispatches parallel agent workers.

- Plans multi-step implementations
- Spawns background agents for independent work
- Maintains session memory across conversations
- Operates under **Limitless Execution** — acts, never advises

### 2. Agent Framework — kbot

The body. A terminal AI agent with 350+ tools across 46 modules, 26 specialist agents, and a learning engine that gets smarter with every interaction.

- **Bayesian skill routing** — routes tasks to the best agent based on learned performance
- **Runtime tool forging** — creates new tools on-the-fly when a capability gap is detected
- **Pattern extraction** — learns solutions, user preferences, and task patterns
- **Multi-provider** — Anthropic, OpenAI, Google, Ollama, llama.cpp, + 15 more

### 3. Protocol — MCP (Model Context Protocol)

The nervous system. Every tool, every service, every data source connects through MCP. This is what makes the stack composable.

Connected surfaces in this project:
- `mcp__github__*` — GitHub issues, PRs, releases, code search
- `mcp__playwright__*` — Browser automation, screenshots, E2E testing
- `mcp__kernel-*` — Admin, analytics, agents, comms, tools, extended
- `mcp__kbot__*` — File ops, search, planning, memory
- `mcp__kbot-local__*` — Local model inference, embeddings, vision

### 4. Agents — Parallel Specialists

36 agent definitions in `.claude/agents/`, each with a protocol, tools, and pass/fail criteria. They run in parallel — Claude dispatches them, they report back.

| Category | Agents |
|----------|--------|
| **Ship cycle** | ship, bootstrap, sync, pulse, deployer, devops |
| **Quality** | qa, reviewer, designer, performance, security, hacker |
| **Community** | github, discord, email-agent, outreach, onboarding |
| **Product** | product, admin, curator, architect, debugger, documenter |
| **Experimental** | limitless, autopoiesis, autotelic, collective, synthesis |

The `/ship` command runs a 6-gate pipeline: **security → QA → design → perf → devops → product**. Every gate must pass.

### 5. Local AI — MLX + llama.cpp

$0 inference on Apple Silicon. 19 models across 5 tiers:

| Tier | Models | RAM | Use case |
|------|--------|-----|----------|
| Light | Qwen 3 0.6B, Phi-4 Mini | 4-8 GB | Autocomplete, classification |
| Standard | Llama 3.3 8B, Gemma 3 | 8-16 GB | General tasks, code |
| Heavy | Codestral 22B, Nemotron 30B | 16-32 GB | Complex reasoning |
| Ultra | Llama 3.1 70B, Nemotron 70B | 48-64 GB | Research, analysis |
| Frontier | DeepSeek R1 671B | 128+ GB | Everything |

Smart model selection: kbot picks the right model based on task complexity and available hardware.

### 6. Backend — Supabase

Auth, Postgres, Edge Functions, Storage. The backend for the web companion (kernel.chat) and the cloud sync layer for kbot's learning engine.

- `claude-proxy` — all AI calls, tier gating, rate limits
- `stripe-webhook` — billing, subscriptions
- `notify-webhook` — Discord notifications
- 90+ database migrations

### 7. Self-Improvement Loop

This is what makes the Kernel Stack different from every other AI development setup. **It gets better by itself.**

```
┌──────────┐     ┌────────────┐     ┌─────────┐     ┌──────────┐
│ Bootstrap │────▶│ Synthesize │────▶│  Learn  │────▶│ Compound │
│ (sense)   │     │ (connect)  │     │ (store) │     │ (apply)  │
└──────────┘     └────────────┘     └─────────┘     └──────────┘
      ▲                                                    │
      └────────────────────────────────────────────────────┘
```

- **Bootstrap** — scans the project, finds the highest-impact fix, implements it
- **Synthesize** — connects patterns across sessions, agents, and users
- **Learn** — stores solutions, routing decisions, user preferences
- **Compound** — session N makes session N+1 faster. Measured, not hoped.

---

## The Names

The Kernel Stack goes by many names depending on context:

| Name | When to use |
|------|-------------|
| **Kernel Stack** | The full system. "We built this on the Kernel Stack." |
| **CK Stack** | Claude + kbot. The core pairing. Like LAMP but for AI-native dev. |
| **Agentic Stack** | Describing the paradigm. Agents all the way down. |
| **Compound AI Stack** | Academic context. Multiple models and agents composing. |
| **Cognitive Stack** | Referring to kbot's 11 cognitive modules and learning engine. |
| **Limitless Stack** | Referring to the operational doctrine. "Act, don't advise." |
| **Symbiotic Stack** | Describing the Claude/kbot relationship. Brain + body. |
| **CK Loop** | The inner cycle: Claude thinks → kbot acts → both learn. |

---

## What It Replaces

| Before | After (Kernel Stack) |
|--------|---------------------|
| Write code manually | Claude writes, kbot tests, agents review |
| Run tests manually | `/qa` — parallel E2E, type-check, visual regression |
| Deploy manually | `/ship` — 6-gate pipeline, auto-publish, auto-announce |
| Track issues manually | GitHub agent triages, labels, responds, closes stale |
| Monitor manually | Daemon agent watches markets, security, health 24/7 |
| Learn from docs | kbot learns from usage — Bayesian routing, pattern extraction |
| One model | 19 local models + 20 cloud providers, auto-selected by task |
| Static tools | Runtime tool forging — kbot builds what it needs |

---

## Quick Start

```bash
# Install kbot
npm install -g @kernel.chat/kbot

# Start using it
kbot "explain this codebase"
kbot --agent coder "fix the auth bug"
kbot --agent researcher "papers on active inference"

# Or pipe to it
git diff | kbot "review this"
cat error.log | kbot "diagnose"
```

For the full stack (web companion + agents + backend):
```bash
git clone https://github.com/isaacsight/kernel.git
cd kernel
npm install
npm run dev
```

---

## Architecture Principles

1. **Local-first.** Files, git, grep execute instantly at $0. Cloud is a choice, not a requirement.
2. **Agent-native.** Every task routes to a specialist. The router learns which agent performs best.
3. **Self-improving.** The learning engine extracts patterns from every session. The bootstrap agent fixes one thing per run.
4. **Open protocol.** MCP means any tool plugs in. No vendor lock-in. No walled garden.
5. **Limitless Execution.** Act, don't advise. Discover tools, don't say they're missing. Fail forward, don't stop.

---

## Stats

- **350+** built-in tools
- **26** specialist agents
- **36** Claude Code agent definitions
- **19** local models
- **20** AI providers
- **11** cognitive modules
- **90+** database migrations
- **90K+** lines of TypeScript
- **$0** to run locally

---

<p align="center">
  <strong>kernel.chat</strong> · <a href="https://github.com/isaacsight/kernel">GitHub</a> · <a href="https://www.npmjs.com/package/@kernel.chat/kbot">npm</a> · <a href="https://discord.gg/kdMauM9abG">Discord</a>
</p>

<p align="center">
  <em>MIT Licensed. Built by kernel.chat group.</em>
</p>
