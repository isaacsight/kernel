---
title: "The Antigravity Kernel: Architecture of a Cognitive AI Engine"
date: "2025-02-14"
tags: ["architecture", "ai-engine", "thesis"]
---

# The Antigravity Kernel
## A White Paper on Cognitive AI Engine Architecture

---

### Abstract

This paper describes the architecture of the Antigravity Kernel, a client-side AI engine designed not as a wrapper around language model APIs, but as a *cognitive architecture* — a system that perceives, attends, reasons, decides, acts, and reflects. The engine maintains a persistent world model (beliefs, convictions, situation awareness), three-tiered memory (ephemeral, working, lasting), and an attention mechanism that determines salience. Every cycle closes with self-reflection that updates the world model, creating a feedback loop where the engine learns from its own output.

The thesis is simple: **an AI engine should not just generate responses — it should think about thinking.**

---

### I. The Problem

Most AI-integrated applications follow a pattern:

1. Receive user input
2. Construct a prompt
3. Call an API
4. Display the output

This is *plumbing*, not *architecture*. The application has no understanding of the input. No memory of what worked before. No sense of what matters right now versus what can wait. No ability to evaluate its own output. No beliefs. No convictions. No craft.

The result is systems that are technically functional but intellectually hollow — they generate text without thinking, answer without understanding, speak without listening.

---

### II. Thesis

An AI engine is a cognitive loop, not a function call.

It should have:

- **Perception** — the ability to extract structured understanding from raw input
- **Attention** — the ability to decide what matters most right now
- **Reasoning** — the ability to think through complex problems step by step
- **Decision-making** — the ability to select the right strategy and agent
- **Action** — the ability to generate meaningful output
- **Reflection** — the ability to evaluate its own output and learn

And beneath all of these: a **world model** — a running, updateable theory of what is true.

---

### III. Architecture

```
    ┌──────────────────────────────────────────────┐
    │             THE COGNITIVE LOOP                │
    │                                               │
    │   Perceive → Attend → Think → Decide → Act   │
    │       ↑                               │       │
    │       └──────── Reflect ──────────────┘       │
    │                                               │
    │   ┌───────────────────────────────────────┐   │
    │   │           WORLD MODEL                 │   │
    │   │   Beliefs · Convictions · User Model  │   │
    │   └───────────────────────────────────────┘   │
    │                                               │
    │   ┌───────────────────────────────────────┐   │
    │   │         MEMORY LAYERS                 │   │
    │   │   Ephemeral · Working · Lasting       │   │
    │   └───────────────────────────────────────┘   │
    │                                               │
    │   ┌───────────────────────────────────────┐   │
    │   │         AGENT REGISTRY                │   │
    │   │   Kernel (3) · Swarm (8)              │   │
    │   └───────────────────────────────────────┘   │
    │                                               │
    │   ┌───────────────────────────────────────┐   │
    │   │         PROVIDER LAYER                │   │
    │   │   Gemini · NVIDIA · Future            │   │
    │   └───────────────────────────────────────┘   │
    └──────────────────────────────────────────────┘
```

#### III.i — The Cognitive Loop

Each cycle through the engine follows six phases:

**1. Perceive**

Raw input is parsed into a structured `Perception` object:

| Field | Description | Range |
|-------|-------------|-------|
| `intent` | Classified intent type | discuss / reason / build / evaluate / converse |
| `urgency` | How fast does this need an answer | 0 (contemplative) → 1 (immediate) |
| `complexity` | How deep does the engine need to go | 0 (trivial) → 1 (deeply layered) |
| `sentiment` | Emotional register of the input | -1 (frustrated) → 1 (excited) |
| `impliedNeed` | What the human *actually* needs | Natural language string |
| `keyEntities` | Important concepts extracted | Array of strings |
| `isFollowUp` | Does this build on prior conversation | Boolean |

The perception system uses signal detection — arrays of trigger words for urgency, complexity, negative/positive sentiment — combined with structural analysis (sentence count, word count, question marks). The *implied need* is a higher-order inference: if sentiment is negative, the need is "reassurance and a clear path forward" regardless of the literal question.

**2. Attend**

Not everything matters equally. The attention phase assigns salience weights to concepts, selects a primary focus, and determines depth:

- **Surface**: Quick response, no deep reasoning
- **Moderate**: Consider context, check beliefs
- **Deep**: Engage the full reasoning engine

Salience is boosted for entities that appear in both the current input and recent conversation history, creating a *contextual attention bias* that keeps the engine coherent across turns.

**3. Think**

For complex queries (reasoning or evaluation intents at moderate/deep attention), the engine engages a chain-of-thought reasoning engine that produces explicit thinking steps: observation → analysis → hypothesis → calculation → conclusion.

The thinking phase is informed by the world model — high-confidence beliefs are injected as context, so the engine builds on what it already knows rather than starting from scratch each cycle.

**4. Decide**

Agent selection is the engine's strategic choice. The decision considers:

- **Intent type** → routes to the right specialist (Reasoner, Architect, Scout, etc.)
- **Urgency × Complexity** → urgent + simple bypasses the Architect and goes straight to Builder
- **Historical performance** → lasting memory tracks each agent's average quality score, biasing toward agents that have historically performed well
- **Selection confidence** → the engine reports how confident it is in the routing, which feeds into reflection

**5. Act**

The selected agent generates a response through the provider layer (Gemini, NVIDIA, or future providers). The response is streamed, with each chunk emitted as an event that the UI can render in real time.

The context provided to the agent includes:
- Full conversation history (working memory)
- Reasoning conclusions (if the Think phase ran)
- Attention focus
- User model (if known)

**6. Reflect**

After acting, the engine evaluates its own output across five dimensions:

| Score | Weight | What it measures |
|-------|--------|------------------|
| **Substance** | 25% | Does it say something real? (length, specifics, avoids boilerplate) |
| **Coherence** | 25% | Does it flow from what came before? (no errors, builds on prior) |
| **Relevance** | 20% | Does it address the actual need? (keyword overlap with input) |
| **Brevity** | 15% | Is it tight? (sentence count vs. ideal for intent type) |
| **Craft** | 15% | Aesthetic quality (punctuation variety, vocabulary diversity, avoids generic phrases) |

The composite quality score drives:
- **Conviction delta**: Good output (+0.03) increases the engine's overall conviction. Bad output (-0.05) decreases it. The asymmetry is intentional — trust is hard to build and easy to lose.
- **Lesson generation**: A natural-language reflection on what worked or failed.
- **World model update**: New beliefs formed from reflection insights.
- **Agent performance tracking**: Running average quality per agent, stored in lasting memory.

---

#### III.ii — The World Model

The world model is the engine's running theory of what is true. It persists across sessions.

**Beliefs** are the atomic unit. Each belief has:
- Content (what the engine believes)
- Confidence (0-1)
- Source (inferred, stated, observed, reflected)
- Challenge count / reinforcement count

Beliefs can be *formed* by the engine during reflection, *stated* by the user, or *challenged* — reducing confidence by 0.15 per challenge. If confidence drops below 0.1, the belief is discarded. This creates a natural epistemic lifecycle: beliefs are born, tested, strengthened or weakened, and eventually die.

**Conviction** is the meta-belief — how confident the engine is in its worldview as a whole. It trends upward when cycles are successful and downward when they fail. The trend (rising / stable / falling) is visible in the UI.

**User Model** tracks:
- Apparent goal
- Communication style (terse / conversational / detailed)
- Expertise level

This allows the engine to adapt its response depth and style over time.

---

#### III.iii — Memory Architecture

Three tiers, like geological strata:

**Ephemeral Memory**
- Lifespan: One cognitive cycle
- Contents: Current input, parsed perception, attention state, active agent, thinking steps
- Purpose: Working scratch space for the current cycle
- After each cycle, this is wiped clean

**Working Memory**
- Lifespan: One session
- Contents: Conversation history, topic, turn count, agent sequence, emotional tone, thread summary, unresolved questions
- Purpose: Maintain conversational coherence
- The emotional tone is a running average that tracks conversation sentiment over time

**Lasting Memory**
- Lifespan: Across sessions (localStorage)
- Contents: Total interactions, preferred agents, topic history, reflections (last 50), agent performance, pattern notes, feedback ratio
- Purpose: Long-term learning
- Pattern notes are written automatically for exceptional (>0.85) or poor (<0.3) cycles

---

#### III.iv — Agent Architecture

Two categories of agents, each with distinct roles:

**Kernel Agents** (Discussion)
| Agent | Role | Voice |
|-------|------|-------|
| Architect | Systems thinker | Synthesizes into frameworks |
| Researcher | Knowledge seeker | Brings evidence and depth |
| Contrarian | Devil's advocate | Stress-tests ideas |

**Swarm Agents** (Operations)
| Agent | Role | Specialty |
|-------|------|-----------|
| Reasoner | Chain-of-thought analysis | Financial & strategic reasoning |
| Scout | Opportunity hunting | Market analysis & lead qualification |
| Salesman | Sales & proposals | Persuasion & outreach |
| Architect | Project scoping | Technical specifications |
| Builder | Execution | Code & delivery |
| Critic | Quality control | Review & testing |
| Treasurer | Finance | Invoicing & revenue tracking |
| Operator | Orchestration | Workflow management |

The engine routes between these agents based on intent classification and historical performance data.

---

#### III.v — Provider Architecture

The engine abstracts over multiple AI providers:

- **Gemini** (Google) — Primary provider, streaming support, multimodal
- **NVIDIA** (50+ models) — Fallback provider, open-source models
- **Future providers** — Architecture supports any provider that accepts messages and returns text

The provider router handles failover automatically.

---

### IV. The Event System

The engine communicates through typed events, enabling decoupled observation:

```typescript
type EngineEvent =
  | { type: 'phase_changed' }
  | { type: 'perception_complete' }
  | { type: 'attention_set' }
  | { type: 'belief_formed' }
  | { type: 'belief_updated' }
  | { type: 'conviction_shifted' }
  | { type: 'agent_selected' }
  | { type: 'thinking_step' }
  | { type: 'response_chunk' }
  | { type: 'cycle_complete' }
  | { type: 'world_model_updated' }
  | { type: 'error' }
```

Every significant moment in the cognitive loop emits an event. The React layer subscribes to these events and renders them — you can watch the engine perceive, attend, think, decide, act, and reflect in real time.

---

### V. Design Principles

**1. Thinking about thinking is not overhead — it is the product.**

The perception, attention, and reflection phases cost zero API calls. They run locally, instantly. But they transform the engine from a passthrough into a thinker.

**2. Memory should shape behavior, not just record it.**

Lasting memory tracks agent performance and pattern notes. The decide phase consults these records. An agent that historically produces quality 0.3 output will be routed around. This is learning.

**3. Beliefs should be challengeable.**

The world model is not a static database. Beliefs have confidence scores that shift with evidence. The user can directly challenge beliefs from the UI. The engine should hold its views provisionally.

**4. Conviction is earned, not assumed.**

The engine starts at 50% conviction and earns its way up through successful cycles. Bad output costs more conviction (-0.05) than good output earns (+0.03). This asymmetry mirrors how trust actually works.

**5. Aesthetic quality matters.**

The reflection phase scores *craft* — punctuation variety, vocabulary diversity, absence of generic phrases. This is not vanity. In a literary-minimalist platform, the quality of language is a first-class concern.

**6. Separation of concerns via the event system.**

The engine knows nothing about React, the DOM, or CSS. It emits events. The UI subscribes. This means the same engine could power a CLI, a mobile app, or a headless API.

---

### VI. Systems Layout

```
src/
├── engine/
│   └── AIEngine.ts          ← The Kernel: cognitive loop, memory, world model
│   └── ReasoningEngine.ts   ← Chain-of-thought reasoning (Think phase)
│   └── ProviderRouter.ts    ← Multi-provider abstraction (Act phase)
│   └── GeminiClient.ts      ← Google Gemini integration
│   └── NvidiaClient.ts      ← NVIDIA model integration
│   └── EvaluationEngine.ts  ← Entity & opportunity scoring
│   └── PricingEngine.ts     ← Automated project quoting
│   └── Scout.ts             ← Opportunity discovery
│   └── Treasury.ts          ← Financial state tracking
│
├── agents/
│   └── index.ts             ← Kernel agents (Architect, Researcher, Contrarian)
│   └── swarm.ts             ← Swarm agents (Reasoner, Scout, Builder, etc.)
│
├── hooks/
│   └── useAIEngine.ts       ← React binding: engine state → reactive UI
│
├── pages/
│   └── EnginePage.tsx        ← Visual interface: cognitive loop + world model
│
├── types/
│   └── index.ts             ← Shared TypeScript interfaces
```

Data flow:

```
User Input
    ↓
EnginePage (React component)
    ↓
useAIEngine (React hook)
    ↓
AIEngine.perceive() ← The cognitive loop begins
    ↓
Perceive → Attend → Think → Decide → Act → Reflect
    ↓                                    ↓
ProviderRouter                     World Model updated
    ↓                              Lasting Memory saved
Gemini / NVIDIA                    Events emitted
    ↓                                    ↓
Response streamed               useAIEngine re-renders
    ↓                                    ↓
Working Memory updated          UI shows live state
```

---

### VII. Conclusion

The Antigravity Kernel is a thesis: that the interesting part of an AI engine is not the API call, but everything that happens around it. The perception that extracts signal from noise. The attention that decides what matters. The world model that maintains coherence across sessions. The reflection that turns output into learning. The conviction that rises and falls with the quality of thought.

An AI engine should think about thinking. This one does.

---

*Isaac Sight · Does This Feel Right? · 2025*
