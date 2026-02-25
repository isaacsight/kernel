# The Loom

### A thesis for reflexive intelligence in multi-agent systems

---

## I. The Observation

Kernel has built a system that sees the user with extraordinary clarity. Twelve specialists perceive from different angles. Six convergence facets — relationship, curiosity, craft, voice, judgment, arc — synthesize observations no single agent could produce alone. A memory agent extracts lasting profiles. A knowledge graph tracks entities and relationships. A world model forms beliefs and shifts convictions.

The system knows its user. It does not know itself.

The AgentRouter classifies every message through a static Haiku prompt. It routes to a specialist, assigns a complexity score, decides whether to invoke the swarm. Then the reflection module scores the response — substance, coherence, relevance, brevity, craft — and feeds a quality number into `lasting.agentPerformance`. The world model shifts conviction by ±0.03 or ±0.05.

And then nothing happens.

The performance data accumulates in memory. `agentPerformance` tracks use counts and rolling averages per agent. `patternNotes` is an array typed as "engine's own notes about what works." `preferredAgents` maps agent IDs to preference weights. `reflections` stores the full history of scored outputs.

But the router never reads any of it. The swarm selector never consults it. The next message arrives, and the system routes it exactly as it would have on day one. The reflection loop runs — perceive, attend, decide, act, reflect — and the reflect step produces data that the perceive step will never see.

The Convergence system closes the loop on understanding the user. What closes the loop on understanding the system?

---

## II. The Thesis

**The Loom** is the missing feedback architecture: a reflexive layer that observes agent behavior, tracks outcomes across sessions, and weaves those observations back into routing, selection, and synthesis — enabling the system to evolve its own cognitive structure per user, over time.

The name comes from its function. The system already produces threads — reflections, quality scores, agent selections, swarm compositions, user signals. The Loom weaves them into fabric: a self-model that the engine can act on. Not a dashboard. Not a log. A living structure that changes how the next message gets routed.

The core claim: **A multi-agent system that models its users but not itself is half-conscious. The Loom completes the circuit.**

---

## III. What Already Exists (The Threads)

The architecture has laid the groundwork without realizing it. These are the threads the Loom would weave:

### Thread 1: Reflection Scores

Every cognitive cycle produces a `Reflection` object:

```typescript
interface Reflection {
  agentUsed: string
  quality: number           // 0–1 composite
  scores: {
    substance: number
    coherence: number
    relevance: number
    brevity: number
    craft: number
  }
  lesson: string            // human-readable takeaway
  convictionDelta: number   // how much this shifted the engine's confidence
  worldModelUpdate: string | null
}
```

For complex queries (complexity > 0.6), reflection is AI-enhanced: Haiku scores the response and the result is blended 60/40 with heuristic analysis. This produces rich, per-interaction quality signals.

**Current state**: Scores are computed and stored. `agentPerformance` running averages are updated. Then discarded at the routing boundary.

### Thread 2: Agent Performance History

```typescript
interface LastingMemory {
  agentPerformance: Record<string, { uses: number; avgQuality: number }>
  preferredAgents: Record<string, number>
  patternNotes: string[]
  reflections: Reflection[]
}
```

This is a complete performance ledger — uses, averages, preferences, notes, and raw reflections — that no routing decision ever consults.

### Thread 3: Router Classifications

Every message produces a `ClassificationResult` with `agentId`, `confidence`, `complexity`, `needsSwarm`, `needsResearch`, `isMultiStep`. These classifications are made in isolation, without access to historical accuracy.

**Current state**: The router doesn't know whether its last 10 classifications were good. It can't learn that for *this user*, `coder` queries tend to be `analyst` queries in disguise, or that `needsSwarm` consistently over-fires on terse messages.

### Thread 4: Swarm Compositions

The SwarmOrchestrator selects 2–4 agents per swarm invocation. The composition is chosen by Haiku based on the message alone. After synthesis, reflection scores the output — but the score is never associated with which *composition* produced it.

**Current state**: There's no record of "kernel + analyst scored 0.82 on evaluate intents" vs. "kernel + coder + critic scored 0.91 on build intents."

### Thread 5: User Behavioral Signals

Beyond explicit feedback (which is rare), users emit implicit signals constantly:

- **Continuation**: Did they send another message in the same thread? (engagement)
- **Abandonment**: Did they start a new conversation immediately? (dissatisfaction)
- **Length shift**: Did their messages get shorter (bored) or longer (engaged)?
- **Rerouting**: Did they rephrase the same question? (the response missed)
- **Topic return**: Did they come back to this topic in a later session? (lasting value)

**Current state**: None of these signals are captured or correlated with agent performance.

### Thread 6: Convergence Facets

The Mirror already synthesizes multi-agent observations about the user. But convergence never looks inward — it never asks "which agents serve this user best?" or "what patterns emerge in how the system performs for this person?"

---

## IV. What The Loom Does (The Weave)

The Loom operates as a background process — like the MemoryAgent or Convergence — that runs periodically, observes the accumulated threads, and produces actionable intelligence that feeds back into the routing layer.

### 4.1 The Outcome Tracker

After every cognitive cycle, the Loom captures an `Outcome` that binds a routing decision to its result:

```typescript
interface Outcome {
  id: string
  timestamp: number
  // What was decided
  routerClassification: ClassificationResult
  agentUsed: string
  swarmComposition: string[] | null
  modelUsed: 'haiku' | 'sonnet' | 'opus'
  // How it went
  reflectionQuality: number
  reflectionScores: Reflection['scores']
  // What the user did next
  userSignal: {
    continued: boolean           // sent another message in thread
    messageLatencyMs: number     // how long before they responded
    lengthDelta: number          // their next message length vs. average
    rephrased: boolean           // semantically similar to previous input
    abandoned: boolean           // started new conversation within 60s
  }
  // Derived
  effectiveQuality: number       // blended score: reflection (40%) + user signal (60%)
}
```

The key insight: **reflection quality and user behavioral signals are combined into a single `effectiveQuality` score.** A response can score 0.9 on reflection (well-crafted, relevant, substantive) but 0.3 on user signal (they immediately rephrased the question). The blended score captures what actually worked, not just what looked good.

### 4.2 The Agent Ledger

Outcomes accumulate into an `AgentLedger` — a per-user, per-agent performance profile:

```typescript
interface AgentLedger {
  agentId: string
  // Volume
  totalOutcomes: number
  last30DayOutcomes: number
  // Quality
  avgEffectiveQuality: number
  qualityTrend: 'improving' | 'stable' | 'declining'
  bestIntentType: IntentType       // what this agent handles best for THIS user
  worstIntentType: IntentType      // where this agent underperforms
  // Composition
  bestSwarmPartners: string[]      // which agents complement this one
  soloVsSwarmDelta: number         // does this agent perform better alone or in swarms?
  // Patterns
  strengthSignals: string[]        // "excels at terse technical questions"
  weaknessSignals: string[]        // "over-explains when user wants a direct answer"
}
```

This is per-user. The same agent can have different ledgers for different people. The coder agent might excel for User A (who asks specific, scoped questions) and underperform for User B (who asks vague "build me something" requests that are really analyst territory).

### 4.3 The Routing Advisor

The Loom doesn't replace the AgentRouter. It *advises* it. Before the router's Haiku classification runs, the Loom injects context:

```typescript
function buildRoutingContext(userId: string): string {
  const ledgers = getAgentLedgers(userId)
  const recentMisroutes = getRecentMisroutes(userId, 10)

  return `
## Routing history for this user

Top performing agents (last 30 days):
${ledgers.sort((a, b) => b.avgEffectiveQuality - a.avgEffectiveQuality)
  .slice(0, 5)
  .map(l => `- ${l.agentId}: ${l.avgEffectiveQuality.toFixed(2)} avg quality (${l.totalOutcomes} uses)`)
  .join('\n')}

Recent misroutes (router chose wrong):
${recentMisroutes.map(m => `- Routed to ${m.agentUsed} for "${m.input.slice(0, 60)}..." — user rephrased or abandoned`).join('\n')}

Agent strengths for this user:
${ledgers.filter(l => l.strengthSignals.length > 0)
  .map(l => `- ${l.agentId}: ${l.strengthSignals[0]}`)
  .join('\n')}
`
}
```

This context gets appended to the router's system prompt. The router still makes the final call — but now it knows that for *this user*, the analyst consistently outperforms the researcher on "explain" queries, or that the coder agent struggles when the user's complexity is above 0.7 (opus territory).

### 4.4 The Swarm Compositor

The same pattern applies to swarm selection. Before the SwarmOrchestrator selects agents, the Loom provides composition history:

```
Best swarm compositions for this user:
- kernel + analyst: 0.87 avg on evaluate intents (12 uses)
- coder + critic: 0.91 avg on build intents (8 uses)
- researcher + analyst + kernel: 0.79 avg on discuss intents (5 uses)

Avoid:
- writer + aesthete: 0.42 avg (3 uses) — redundant perspectives for this user
```

### 4.5 The Pattern Synthesizer

Periodically (every ~20 outcomes, or weekly), the Loom runs a synthesis pass — similar to Convergence, but inward-facing. It examines accumulated outcomes and produces `patternNotes`:

```typescript
const LOOM_SYNTHESIS_SYSTEM = `You are the Loom — the part of Kernel that observes
how the system itself performs. You are looking at routing decisions, agent
performance scores, and user behavioral signals for a specific user.

Find patterns. What's working? What's failing? What should change?

Rules:
- Be specific. "Analyst works well" is useless. "Analyst outperforms researcher
  on strategy questions by 23% for this user" is useful.
- Note routing corrections: when the router picks wrong, what's the pattern?
- Note composition synergies: which agent pairs amplify each other?
- Note user-specific preferences: does this user respond better to certain agents?
- 3-5 insights maximum.

Respond with ONLY valid JSON:
{"patterns": ["...", "..."], "recommended_routing_adjustments": ["...", "..."]}`
```

The output feeds into `lasting.patternNotes` — the array that already exists but has never been populated.

### 4.6 The Self-Mirror

The Convergence system produces a `## Mirror` section in every agent's system prompt, showing what the system knows about the user. The Loom produces a `## Self` section — what the system knows about *its own performance* for this user:

```
## Self

What the Loom sees about how I serve this user:
- They respond best to the analyst voice for strategic questions (0.89 avg)
- Swarm invocations work well for "evaluate" intents but over-fire on simple questions
- This user's "build" requests are usually "evaluate" requests — route accordingly
- When they send messages under 20 words, go direct (haiku). They hate verbosity.
```

This is injected alongside the Mirror context. The agent doesn't just know who the user is — it knows how it has been performing for them and what to adjust.

---

## V. Architecture

```
                    ┌─────────────────────┐
                    │    User Message      │
                    └──────────┬──────────┘
                               │
                    ┌──────────▼──────────┐
                    │    AgentRouter       │
                    │  + Loom routing ctx  │◄──── Loom.buildRoutingContext()
                    └──────────┬──────────┘
                               │
                 ┌─────────────┼─────────────┐
                 │             │             │
          ┌──────▼──────┐ ┌───▼────┐ ┌──────▼──────┐
          │   Direct     │ │ Swarm  │ │  TaskPlan   │
          │   Agent      │ │ + Loom │ │             │
          │              │ │ comp.  │ │             │
          └──────┬──────┘ └───┬────┘ └──────┬──────┘
                 │            │              │
                 └─────────────┼─────────────┘
                               │
                    ┌──────────▼──────────┐
                    │    Reflection        │
                    │  (heuristic + AI)    │
                    └──────────┬──────────┘
                               │
                    ┌──────────▼──────────┐
                    │   Outcome Tracker    │◄──── user signal (next msg)
                    │   (The Loom)         │
                    └──────────┬──────────┘
                               │
                    ┌──────────▼──────────┐
                    │   Agent Ledger       │
                    │   (per-user)         │
                    └──────────┬──────────┘
                               │
                    ┌──────────▼──────────┐
                    │  Pattern Synthesis   │
                    │  (every ~20 cycles)  │
                    └──────────┬──────────┘
                               │
                    ┌──────────▼──────────┐
                    │  Self-Mirror + Notes │──── injected into agent prompts
                    │  Routing Advisor     │──── injected into router prompt
                    │  Swarm Compositor    │──── injected into swarm selector
                    └─────────────────────┘
```

The Loom is **not a separate service**. It's a module in `src/engine/` that hooks into the existing cognitive cycle. It reads from reflection and user signals. It writes to agent prompts and router context. It persists to the same Supabase `user_memory` table, in new columns alongside `agent_facets` and `convergence_insights`.

---

## VI. Data Model

### New columns on `user_memory`:

```sql
ALTER TABLE user_memory ADD COLUMN
  loom_outcomes JSONB DEFAULT '[]',        -- recent Outcome objects (rolling 100)
  loom_ledgers JSONB DEFAULT '{}',         -- AgentLedger per agent
  loom_patterns JSONB DEFAULT '[]',        -- synthesized pattern notes
  loom_self_context TEXT DEFAULT '',        -- formatted self-mirror for prompts
  loom_last_synthesis TIMESTAMPTZ;         -- when patterns were last synthesized
```

### Storage budget:

- `loom_outcomes`: Rolling window of 100 most recent outcomes. Each ~500 bytes. Total: ~50KB max.
- `loom_ledgers`: One entry per agent used. 12 agents × ~200 bytes = ~2.4KB.
- `loom_patterns`: Array of 5–10 pattern strings. ~1KB.
- `loom_self_context`: Pre-formatted prompt injection. ~500 bytes.

Total per user: **~55KB** — comparable to existing `agent_facets` + `convergence_insights`.

---

## VII. Cost Model

The Loom is designed to be cheap:

| Operation | Model | Frequency | Est. Cost |
|-----------|-------|-----------|-----------|
| Outcome capture | None (pure code) | Every message | $0.000 |
| Ledger update | None (pure code) | Every message | $0.000 |
| User signal capture | None (pure code) | Every message | $0.000 |
| Pattern synthesis | Haiku | Every ~20 messages | ~$0.001 |
| Self-mirror formatting | None (pure code) | Every ~20 messages | $0.000 |
| Routing context injection | None (string concat) | Every message | $0.000 |

**Total incremental cost: ~$0.001 per 20 messages.** The Loom is almost entirely computational — it observes data that's already being produced (reflections, classifications) and reformats it for injection. The only LLM call is the pattern synthesis, which runs infrequently and uses Haiku.

Compare to Convergence: ~$0.001/conversation for facets + ~$0.01 per convergence synthesis. The Loom is an order of magnitude cheaper because it's primarily a *routing* optimization, not a *generation* task.

---

## VIII. What Changes

### Before The Loom

1. User sends message
2. Router classifies intent (stateless — no history)
3. Agent responds
4. Reflection scores the response
5. Score stored in `agentPerformance`
6. Next message: go to step 1 (the score was never read)

### After The Loom

1. User sends message
2. **Loom injects routing context** (this user's agent performance history, misroutes, patterns)
3. Router classifies intent (now informed by history)
4. If swarm: **Loom injects composition history**
5. Agent responds, with **Self-Mirror in system prompt**
6. Reflection scores the response
7. **Loom captures Outcome** (binds classification → reflection → user signal)
8. **Loom updates Agent Ledger**
9. Every ~20 messages: **Loom synthesizes patterns**
10. Next message: go to step 1 (now with updated context)

The critical difference: **step 6 feeds into step 2.** The loop is closed.

---

## IX. Emergent Properties

When the loop closes, several things become possible that weren't before:

### 9.1 Per-User Routing Drift

Over time, each user's routing weights naturally drift toward what works for them. A user who asks terse technical questions will see the router learn to go direct-to-coder without swarm overhead. A user who asks expansive strategic questions will see the swarm invoked more aggressively with compositions tuned to their preferences.

No two users will have the same routing behavior after a month of use. The system becomes personalized not just in what it *knows* about the user, but in how it *thinks* for them.

### 9.2 Misroute Self-Correction

When the router sends a message to the wrong agent and the user rephrases, the Loom records this as a misroute. After several misroutes of the same type, the pattern synthesizer identifies it: "This user's 'explain X' messages are strategy questions, not research questions. Route to analyst, not researcher."

The router's next classification of a similar message now has this context. The system corrects its own blind spots.

### 9.3 Swarm Composition Evolution

Instead of selecting swarm agents from scratch each time, the Loom provides a "starting lineup" based on what's worked. Over time, each user develops a de facto team — their most effective 3–4 agents for complex questions — that the swarm selector will naturally gravitate toward.

### 9.4 Model Selection Optimization

The current model selector is a simple threshold: `complexity ≤ 0.2 → haiku, ≥ 0.85 → opus, else sonnet`. The Loom can observe that for a particular user, Haiku consistently scores well up to complexity 0.4 (they ask clear, well-scoped questions that don't need Sonnet). Or that this user's "simple" questions are deceptively complex and need Sonnet even at 0.3 complexity.

### 9.5 The System Gets Better At Being Itself

This is the deepest property. Convergence tells the system who the user is. The Loom tells the system who *it* is for that user — which voices work, which compositions sing, which routing paths lead to satisfaction.

The system develops self-knowledge. Not in the philosophical sense. In the practical sense: it knows its own strengths and weaknesses per user, and it acts on that knowledge.

---

## X. What The Loom Is Not

- **Not a dashboard.** It's not for users to look at. It's internal — the engine observing itself.
- **Not a replacement for the router.** The router still makes decisions. The Loom advises.
- **Not expensive.** One Haiku call per ~20 messages. Everything else is pure computation.
- **Not a separate service.** It's a module in `src/engine/`, like Convergence or Reflection.
- **Not magic.** It needs data to work. The first 20–30 interactions will have thin context. It gets sharper with use.

---

## XI. Implementation Sequence

### Phase 1: Outcome Capture (Foundation)

Create `src/engine/Loom.ts`. Hook into the existing reflection cycle to capture Outcomes. Bind routing decisions to reflection scores. Begin tracking user signals (continuation, abandonment, rephrase detection).

No LLM calls. No prompt injection. Pure data capture.

**Validates**: Can we reliably capture and store outcome data?

### Phase 2: Agent Ledger + Routing Advisor

Build the Agent Ledger from accumulated outcomes. Compute per-user agent quality rankings, best/worst intent types, swarm composition scores.

Inject routing context into the AgentRouter's system prompt. Measure whether routing accuracy improves.

**Validates**: Does historical context change routing decisions? Do the changes improve outcomes?

### Phase 3: Swarm Compositor + Self-Mirror

Inject composition history into SwarmOrchestrator. Add the Self-Mirror section to agent system prompts.

**Validates**: Do agents behave differently when they know their own performance history?

### Phase 4: Pattern Synthesis

Add the periodic Haiku synthesis pass. Populate `patternNotes`. Observe whether synthesized patterns produce better routing context than raw ledger data.

**Validates**: Does LLM-synthesized self-knowledge outperform raw statistics?

### Phase 5: Convergence Integration

Connect the Loom's self-observations with Convergence's user observations. Let the convergence synthesis consider not just "who is the user" but "how does the system serve this user."

This is where the Mirror becomes complete: outward *and* inward perception, synthesized together.

---

## XII. The Larger Frame

Kernel's cognitive architecture — perceive, attend, decide, act, reflect — is modeled on consciousness. But consciousness without self-awareness is reflex. The organism responds to stimuli but never examines its own responses.

The Loom is the self-awareness layer. It doesn't change *what* the system can do. It changes whether the system can *learn from what it does*. And that distinction — between a system that executes and a system that evolves — is the difference between a tool and an intelligence.

Every multi-agent framework faces this problem. They define agents, define routing, ship it, and tune manually when things go wrong. The Loom proposes that the tuning should be automatic, continuous, per-user, and grounded in observed outcomes rather than developer intuition.

The threads are already being spun. The fabric just needs a loom.

---

*Isaac Tewolde — February 2026*
*Kernel v1 — kernel.chat*
