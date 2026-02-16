// ═══════════════════════════════════════════════════════════════
//  The Antigravity Kernel — A Unified AI Engine
// ═══════════════════════════════════════════════════════════════
//
//  This is not a wrapper around an API. It is a cognitive
//  architecture. The engine perceives, attends, believes,
//  reasons, decides, acts, and reflects. It maintains a world
//  model — a running theory of what's true and what matters.
//  It tracks conviction — how sure it is, and whether that
//  surety is earned. It has an aesthetic sense — a preference
//  for brevity, for elegance, for the right word at the
//  right moment.
//
//  Architecture:
//
//    Perceive → Attend → Think → Decide → Act → Reflect
//        ↑                                        │
//        └──────────── World Model ───────────────┘
//
//  Memory (three geological strata):
//    Ephemeral — vanishes after each cognitive cycle
//    Working   — persists for the session
//    Lasting   — survives across sessions
//
// ═══════════════════════════════════════════════════════════════

import { KERNEL_AGENTS, getNextAgent } from '../agents';
import { SWARM_AGENTS, routeToAgent } from '../agents/swarm';
import { generateResponse } from './ProviderRouter';
import type { Agent, Message } from '../types';

// Inlined from deleted ReasoningEngine (was Gemini-based, no longer used)
export interface ThinkingStep {
  step: number;
  thought: string;
  type: 'observation' | 'analysis' | 'hypothesis' | 'calculation' | 'conclusion';
}

export interface ReasoningResult {
  thinking: ThinkingStep[];
  conclusion: string;
  confidence: number;
  reasoning_time_ms: number;
  action?: { type: string; params: Record<string, unknown> };
}

// ─── Cognitive Phase ────────────────────────────────────────

export type CognitivePhase =
  | 'idle'        // Resting — awaiting stimulus
  | 'perceiving'  // Processing input, extracting signal
  | 'attending'   // Deciding what matters most right now
  | 'thinking'    // Reasoning through the problem
  | 'deciding'    // Selecting agent and strategy
  | 'acting'      // Generating response
  | 'reflecting'; // Evaluating output, updating world model

// ─── Intent Classification ──────────────────────────────────

export type IntentType = 'discuss' | 'reason' | 'build' | 'evaluate' | 'converse';
export type ReasoningDomain = 'financial' | 'technical' | 'strategic' | 'general';

export type Intent =
  | { type: 'discuss'; topic: string }
  | { type: 'reason'; question: string; domain: ReasoningDomain }
  | { type: 'build'; description: string }
  | { type: 'evaluate'; opportunity: string }
  | { type: 'converse'; message: string };

// ─── Perception ─────────────────────────────────────────────
//
//  Perception is more than classification. It extracts the
//  signal from noise: what kind of thing is this, how urgent,
//  how complex, what emotional register, what does the human
//  actually need (not just what they said).

export interface Perception {
  intent: Intent;
  urgency: number;          // 0 (contemplative) → 1 (immediate)
  complexity: number;       // 0 (trivial) → 1 (deeply layered)
  sentiment: number;        // -1 (frustrated/negative) → 1 (excited/positive)
  impliedNeed: string;      // what the human actually needs (often unstated)
  keyEntities: string[];    // important nouns/concepts extracted
  isQuestion: boolean;
  isFollowUp: boolean;      // does this build on prior conversation?
}

// ─── Attention ──────────────────────────────────────────────
//
//  Not everything matters equally. Attention assigns salience
//  weights to what the engine should focus on right now.

export interface AttentionState {
  primaryFocus: string;              // the one thing that matters most
  salience: Record<string, number>;  // concept → weight (0-1)
  distractions: string[];            // things to deliberately ignore
  depth: 'surface' | 'moderate' | 'deep';  // how deep to go
}

// ─── World Model ────────────────────────────────────────────
//
//  The engine's running theory of what's true. Beliefs can
//  be strong or weak, confirmed or uncertain. The world model
//  is what makes the engine coherent across turns — it
//  remembers not just what was said, but what it believes.

export interface Belief {
  id: string;
  content: string;            // what the engine believes
  confidence: number;         // 0-1 how sure
  source: 'inferred' | 'stated' | 'observed' | 'reflected';
  formedAt: number;           // timestamp
  challengedCount: number;    // how many times this has been questioned
  reinforcedCount: number;    // how many times this has been confirmed
}

export interface WorldModel {
  beliefs: Belief[];
  convictions: {
    overall: number;          // 0-1: how sure the engine is about its worldview
    trend: 'rising' | 'stable' | 'falling';
    lastShift: number;        // timestamp of last significant change
  };
  situationSummary: string;   // one-sentence: what's happening right now
  userModel: {
    apparentGoal: string;     // what the human seems to be trying to do
    communicationStyle: 'terse' | 'conversational' | 'detailed' | 'unknown';
    expertise: 'beginner' | 'intermediate' | 'expert' | 'unknown';
  };
}

// ─── Memory Layers ──────────────────────────────────────────

export interface EphemeralMemory {
  currentInput: string;
  perception: Perception | null;
  attention: AttentionState | null;
  activeAgent: Agent | null;
  thinkingSteps: ThinkingStep[];
  startedAt: number;
}

export interface WorkingMemory {
  conversationHistory: Message[];
  topic: string;
  turnCount: number;
  agentSequence: string[];
  emotionalTone: number;       // running average: -1 → 1
  coherenceScore: number;      // 0-1: how well the conversation flows
  threadSummary: string;       // compressed summary of conversation so far
  unresolvedQuestions: string[];
}

export interface LastingMemory {
  totalInteractions: number;
  preferredAgents: Record<string, number>;
  topicHistory: string[];
  reflections: Reflection[];
  feedbackRatio: { positive: number; negative: number };
  agentPerformance: Record<string, { uses: number; avgQuality: number }>;
  patternNotes: string[];      // engine's own notes about what works
}

// ─── Reflection ─────────────────────────────────────────────
//
//  Reflection is the engine looking in a mirror. It assesses
//  not just "did it work" but "was it right" — the difference
//  between functional correctness and aesthetic quality.

export interface Reflection {
  timestamp: number;
  phase: CognitivePhase;
  input: string;
  output: string;
  agentUsed: string;
  durationMs: number;
  quality: number;             // 0-1 composite score
  scores: {
    substance: number;         // did it say something real?
    coherence: number;         // does it flow from what came before?
    relevance: number;         // does it address the actual need?
    brevity: number;           // is it tight, or bloated?
    craft: number;             // aesthetic quality — rhythm, word choice
  };
  lesson: string;
  worldModelUpdate: string | null;  // did this change what the engine believes?
  convictionDelta: number;          // +/- change to overall conviction
}

// ─── Engine State ───────────────────────────────────────────

export interface EngineState {
  phase: CognitivePhase;
  ephemeral: EphemeralMemory;
  working: WorkingMemory;
  lasting: LastingMemory;
  worldModel: WorldModel;
  isOnline: boolean;
  cycleCount: number;
}

// ─── Engine Events ──────────────────────────────────────────

export type EngineEvent =
  | { type: 'phase_changed'; phase: CognitivePhase; timestamp: number }
  | { type: 'perception_complete'; perception: Perception; timestamp: number }
  | { type: 'attention_set'; attention: AttentionState; timestamp: number }
  | { type: 'intent_parsed'; intent: Intent; timestamp: number }
  | { type: 'belief_formed'; belief: Belief; timestamp: number }
  | { type: 'belief_updated'; belief: Belief; delta: number; timestamp: number }
  | { type: 'conviction_shifted'; from: number; to: number; reason: string; timestamp: number }
  | { type: 'agent_selected'; agent: Agent; reason: string; timestamp: number }
  | { type: 'thinking_step'; step: ThinkingStep; timestamp: number }
  | { type: 'response_chunk'; text: string; timestamp: number }
  | { type: 'cycle_complete'; reflection: Reflection; timestamp: number }
  | { type: 'world_model_updated'; summary: string; timestamp: number }
  | { type: 'error'; message: string; timestamp: number };

export type EngineListener = (event: EngineEvent) => void;

// ─── Storage ────────────────────────────────────────────────

const LASTING_MEMORY_KEY = 'antigravity-kernel-memory';
const WORLD_MODEL_KEY = 'antigravity-kernel-world';

function loadLastingMemory(): LastingMemory {
  if (typeof window === 'undefined') return createEmptyLastingMemory();
  try {
    const saved = localStorage.getItem(LASTING_MEMORY_KEY);
    return saved ? JSON.parse(saved) : createEmptyLastingMemory();
  } catch {
    return createEmptyLastingMemory();
  }
}

function saveLastingMemory(memory: LastingMemory): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(LASTING_MEMORY_KEY, JSON.stringify(memory));
  } catch { /* degrade gracefully */ }
}

function loadWorldModel(): WorldModel {
  if (typeof window === 'undefined') return createEmptyWorldModel();
  try {
    const saved = localStorage.getItem(WORLD_MODEL_KEY);
    return saved ? JSON.parse(saved) : createEmptyWorldModel();
  } catch {
    return createEmptyWorldModel();
  }
}

function saveWorldModel(model: WorldModel): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(WORLD_MODEL_KEY, JSON.stringify(model));
  } catch { /* degrade gracefully */ }
}

function createEmptyLastingMemory(): LastingMemory {
  return {
    totalInteractions: 0,
    preferredAgents: {},
    topicHistory: [],
    reflections: [],
    feedbackRatio: { positive: 0, negative: 0 },
    agentPerformance: {},
    patternNotes: [],
  };
}

function createEmptyWorldModel(): WorldModel {
  return {
    beliefs: [],
    convictions: { overall: 0.5, trend: 'stable', lastShift: Date.now() },
    situationSummary: 'Awaiting first interaction.',
    userModel: {
      apparentGoal: 'unknown',
      communicationStyle: 'unknown',
      expertise: 'unknown',
    },
  };
}

function createEmptyEphemeral(): EphemeralMemory {
  return {
    currentInput: '',
    perception: null,
    attention: null,
    activeAgent: null,
    thinkingSteps: [],
    startedAt: 0,
  };
}

// ─── Text Analysis Utilities ────────────────────────────────
//
//  These are the engine's senses — how it reads signal
//  from raw text without calling an external API.

const URGENCY_SIGNALS = [
  'asap', 'urgent', 'now', 'immediately', 'quick', 'hurry',
  'deadline', 'emergency', 'critical', 'blocked', 'stuck',
];

const COMPLEXITY_SIGNALS = [
  'architecture', 'system', 'design', 'tradeoff', 'integrate',
  'scale', 'distributed', 'optimize', 'refactor', 'migration',
  'strategy', 'framework', 'paradigm', 'philosophy',
];

const NEGATIVE_SIGNALS = [
  'frustrated', 'broken', 'wrong', 'bad', 'hate', 'terrible',
  'confused', 'lost', "can't", "doesn't work", 'failing', 'error',
];

const POSITIVE_SIGNALS = [
  'great', 'love', 'excited', 'amazing', 'perfect', 'beautiful',
  'elegant', 'clean', 'brilliant', 'inspired', 'thank',
];

function countSignals(text: string, signals: string[]): number {
  const lower = text.toLowerCase();
  return signals.filter(s => lower.includes(s)).length;
}

function extractKeyEntities(text: string): string[] {
  // Extract capitalized words and quoted phrases as key entities
  const quoted = text.match(/"([^"]+)"|'([^']+)'/g)?.map(q => q.replace(/['"]/g, '')) || [];
  const capitalized = text.match(/\b[A-Z][a-z]{2,}\b/g) || [];
  const unique = [...new Set([...quoted, ...capitalized])];
  return unique.slice(0, 5); // max 5 entities
}

// ─── The Engine ─────────────────────────────────────────────

export function createEngine(): {
  getState: () => EngineState;
  subscribe: (listener: EngineListener) => () => void;
  perceive: (input: string) => Promise<void>;
  runDiscussion: (topic: string) => Promise<void>;
  injectHumanMessage: (content: string) => void;
  addBelief: (content: string, confidence: number) => void;
  challengeBelief: (beliefId: string) => void;
  removeBelief: (beliefId: string) => void;
  setConviction: (value: number, reason: string) => void;
  overrideNextAgent: (agent: Agent | null) => void;
  pruneReflections: (minQuality: number) => number;
  stop: () => void;
  reset: () => void;
} {
  // ── Internal State ──────────────────────────────────────

  let state: EngineState = {
    phase: 'idle',
    ephemeral: createEmptyEphemeral(),
    working: {
      conversationHistory: [],
      topic: '',
      turnCount: 0,
      agentSequence: [],
      emotionalTone: 0,
      coherenceScore: 1,
      threadSummary: '',
      unresolvedQuestions: [],
    },
    lasting: loadLastingMemory(),
    worldModel: loadWorldModel(),
    isOnline: true,
    cycleCount: 0,
  };

  const listeners: Set<EngineListener> = new Set();
  let aborted = false;
  let agentOverride: Agent | null = null;

  // ── Event System ────────────────────────────────────────

  function emit(event: EngineEvent): void {
    for (const listener of listeners) {
      try { listener(event); } catch { /* never crash the engine */ }
    }
  }

  function setPhase(phase: CognitivePhase): void {
    state = { ...state, phase };
    emit({ type: 'phase_changed', phase, timestamp: Date.now() });
  }

  // ═══════════════════════════════════════════════════════
  //  Phase 1: PERCEIVE
  // ═══════════════════════════════════════════════════════
  //
  //  Raw input → structured understanding.
  //  The engine extracts:
  //    - Intent: what kind of thing is being asked
  //    - Urgency: how fast does this need an answer
  //    - Complexity: how deep does the engine need to go
  //    - Sentiment: what emotional register is the human in
  //    - Implied need: what do they actually need (unstated)
  //    - Key entities: important concepts to focus on

  function perceiveInput(input: string): Perception {
    const lower = input.toLowerCase();
    const words = input.split(/\s+/);
    const wordCount = words.length;

    // ── Intent Classification ──
    const intent = classifyIntent(input, lower);

    // ── Urgency (0-1) ──
    const urgencyHits = countSignals(input, URGENCY_SIGNALS);
    const hasQuestionMark = input.includes('?');
    const isShort = wordCount < 8;
    const urgency = Math.min(1, (urgencyHits * 0.3) + (isShort ? 0.1 : 0) + (hasQuestionMark ? 0.05 : 0));

    // ── Complexity (0-1) ──
    const complexityHits = countSignals(input, COMPLEXITY_SIGNALS);
    const hasMultipleSentences = (input.match(/[.!?]+/g)?.length || 0) > 1;
    const isLong = wordCount > 30;
    const complexity = Math.min(1,
      (complexityHits * 0.2) +
      (hasMultipleSentences ? 0.15 : 0) +
      (isLong ? 0.2 : 0) +
      (intent.type === 'reason' ? 0.3 : 0) +
      (intent.type === 'evaluate' ? 0.2 : 0)
    );

    // ── Sentiment (-1 to 1) ──
    const negHits = countSignals(input, NEGATIVE_SIGNALS);
    const posHits = countSignals(input, POSITIVE_SIGNALS);
    const sentiment = Math.max(-1, Math.min(1, (posHits - negHits) * 0.3));

    // ── Implied Need ──
    const impliedNeed = inferNeed(intent, urgency, complexity, sentiment);

    // ── Key Entities ──
    const keyEntities = extractKeyEntities(input);

    // ── Is Follow-Up? ──
    const isFollowUp =
      lower.startsWith('and ') ||
      lower.startsWith('also ') ||
      lower.startsWith('but ') ||
      lower.startsWith('what about') ||
      lower.startsWith('how about') ||
      state.working.conversationHistory.length > 0;

    return {
      intent,
      urgency,
      complexity,
      sentiment,
      impliedNeed,
      keyEntities,
      isQuestion: hasQuestionMark || lower.startsWith('how') || lower.startsWith('what') || lower.startsWith('why') || lower.startsWith('should'),
      isFollowUp,
    };
  }

  function classifyIntent(input: string, lower: string): Intent {
    // Reasoning triggers — need deep thought
    if (
      lower.includes('think about') || lower.includes('analyze') ||
      lower.includes('evaluate') || lower.includes('should i') ||
      lower.includes('worth it') || lower.includes('expected value') ||
      lower.includes('strategy') || lower.includes('calculate') ||
      lower.includes('reason through') || lower.includes('what if')
    ) {
      const domain: ReasoningDomain =
        lower.includes('money') || lower.includes('revenue') || lower.includes('cost') || lower.includes('profit')
          ? 'financial'
          : lower.includes('code') || lower.includes('build') || lower.includes('architecture') || lower.includes('system')
          ? 'technical'
          : lower.includes('plan') || lower.includes('approach') || lower.includes('strategy') || lower.includes('decision')
          ? 'strategic'
          : 'general';

      return { type: 'reason', question: input, domain };
    }

    // Build triggers — need construction
    if (
      lower.includes('build') || lower.includes('create') ||
      lower.includes('implement') || lower.includes('make me') ||
      lower.includes('write a') || lower.includes('generate')
    ) {
      return { type: 'build', description: input };
    }

    // Evaluation triggers — need assessment
    if (
      lower.includes('opportunity') || lower.includes('evaluate this') ||
      lower.includes('is this worth') || lower.includes('should we pursue') ||
      lower.includes('viable') || lower.includes('feasible')
    ) {
      return { type: 'evaluate', opportunity: input };
    }

    // Discussion triggers — need multi-perspective exploration
    if (
      lower.includes('discuss') || lower.includes('what do you think about') ||
      lower.includes("let's talk about") || lower.includes('debate') ||
      lower.includes('perspectives on') || lower.includes('opinions on')
    ) {
      const topic = input
        .replace(/discuss|what do you think about|let's talk about|debate|perspectives on|opinions on/gi, '')
        .trim() || input;
      return { type: 'discuss', topic };
    }

    // Default: conversational
    return { type: 'converse', message: input };
  }

  function inferNeed(
    intent: Intent,
    urgency: number,
    complexity: number,
    sentiment: number,
  ): string {
    if (sentiment < -0.3) {
      return 'Reassurance and a clear path forward';
    }
    if (urgency > 0.6) {
      return 'A fast, decisive answer';
    }
    if (complexity > 0.6) {
      return 'Deep analysis with visible reasoning';
    }

    switch (intent.type) {
      case 'discuss': return 'Multiple perspectives to think with';
      case 'reason': return 'Rigorous thinking made visible';
      case 'build': return 'A concrete plan or artifact';
      case 'evaluate': return 'An honest assessment with numbers';
      case 'converse': return 'A thoughtful, human response';
    }
  }

  // ═══════════════════════════════════════════════════════
  //  Phase 2: ATTEND
  // ═══════════════════════════════════════════════════════
  //
  //  Not everything matters equally. Attention selects what
  //  the engine should focus on, and what it should ignore.
  //  This prevents the engine from being pulled in every
  //  direction at once.

  function attend(perception: Perception): AttentionState {
    const { intent, complexity, keyEntities, isFollowUp } = perception;

    // Primary focus = the core of what's being asked
    const primaryFocus = intent.type === 'discuss'
      ? intent.topic
      : intent.type === 'reason'
      ? intent.question
      : intent.type === 'build'
      ? intent.description
      : intent.type === 'evaluate'
      ? intent.opportunity
      : intent.message;

    // Build salience map from entities + conversation context
    const salience: Record<string, number> = {};
    keyEntities.forEach((entity, i) => {
      salience[entity] = 1 - (i * 0.15); // first entity = most salient
    });

    // Boost salience of things mentioned in recent conversation
    if (isFollowUp) {
      const recentMessages = state.working.conversationHistory.slice(-3);
      for (const msg of recentMessages) {
        for (const entity of keyEntities) {
          if (msg.content.toLowerCase().includes(entity.toLowerCase())) {
            salience[entity] = Math.min(1, (salience[entity] || 0) + 0.2);
          }
        }
      }
    }

    // Depth depends on complexity and intent
    const depth: AttentionState['depth'] =
      complexity > 0.6 || intent.type === 'reason' ? 'deep' :
      complexity > 0.3 || intent.type === 'evaluate' ? 'moderate' :
      'surface';

    // Distractions = things that might pull attention away
    const distractions: string[] = [];
    if (state.working.unresolvedQuestions.length > 2) {
      distractions.push('accumulated unresolved questions');
    }

    return { primaryFocus, salience, distractions, depth };
  }

  // ═══════════════════════════════════════════════════════
  //  Phase 3: THINK
  // ═══════════════════════════════════════════════════════
  //
  //  Engage the reasoning engine for complex queries.
  //  Informed by attention (what to focus on) and world
  //  model (what we already believe). Simpler intents
  //  skip this phase entirely.

  async function think(
    _perception: Perception,
    _attention: AttentionState,
  ): Promise<ReasoningResult | null> {
    // Reasoning engine removed (was Gemini-based). Returns null — the
    // act() phase handles responses fine without a separate reasoning step.
    return null;
  }

  // ═══════════════════════════════════════════════════════
  //  Phase 4: DECIDE
  // ═══════════════════════════════════════════════════════
  //
  //  Select the right agent, informed by:
  //    - Intent (what kind of thing is being asked)
  //    - Attention (what matters)
  //    - World model (what we believe about the user)
  //    - Lasting memory (what's worked before)

  function selectAgent(
    perception: Perception,
    attention: AttentionState,
  ): { agent: Agent; reason: string; confidence: number } {
    // Check for manual agent override
    if (agentOverride) {
      const overridden = agentOverride;
      agentOverride = null; // consume the override
      return { agent: overridden, reason: `Manual override → ${overridden.name}`, confidence: 1 };
    }

    const { intent, urgency, complexity } = perception;
    const perf = state.lasting.agentPerformance;

    switch (intent.type) {
      case 'discuss': {
        const lastAgentId = state.working.agentSequence[state.working.agentSequence.length - 1];
        const agent = lastAgentId ? getNextAgent(lastAgentId) : KERNEL_AGENTS[0];
        return { agent, reason: 'Discussion rotation — next voice', confidence: 0.9 };
      }

      case 'reason': {
        const reasoner = SWARM_AGENTS.find(a => a.id === 'reasoner')!;
        const reasonerPerf = perf['reasoner'];
        const confidence = reasonerPerf ? Math.min(0.95, 0.7 + reasonerPerf.avgQuality * 0.25) : 0.7;
        return {
          agent: reasoner,
          reason: `Deep ${intent.domain} reasoning (depth: ${attention.depth})`,
          confidence,
        };
      }

      case 'build': {
        // If urgent, go straight to builder. If complex, start with architect.
        if (urgency > 0.6 && complexity < 0.5) {
          return {
            agent: SWARM_AGENTS.find(a => a.id === 'builder')!,
            reason: 'Urgent + simple — routing direct to Builder',
            confidence: 0.75,
          };
        }
        return {
          agent: SWARM_AGENTS.find(a => a.id === 'architect')!,
          reason: 'Build request — Architect scopes first',
          confidence: 0.85,
        };
      }

      case 'evaluate': {
        return {
          agent: SWARM_AGENTS.find(a => a.id === 'scout')!,
          reason: 'Opportunity evaluation — Scout assesses viability',
          confidence: 0.8,
        };
      }

      case 'converse': {
        const routed = routeToAgent(intent.message);

        // Check if this agent has historically performed well
        const agentPerf = perf[routed.id];
        const confidence = agentPerf
          ? Math.min(0.9, 0.5 + agentPerf.avgQuality * 0.4)
          : 0.6;

        return {
          agent: routed,
          reason: `Content-routed to ${routed.name}`,
          confidence,
        };
      }
    }
  }

  // ═══════════════════════════════════════════════════════
  //  Phase 5: ACT
  // ═══════════════════════════════════════════════════════
  //
  //  Generate the response. The agent speaks, shaped by
  //  everything the engine has perceived, attended to,
  //  thought about, and decided.

  async function act(
    agent: Agent,
    perception: Perception,
    attention: AttentionState,
    reasoning: ReasoningResult | null,
  ): Promise<string> {
    const contextParts: string[] = [];

    // Add reasoning conclusion if available
    if (reasoning) {
      contextParts.push(
        `[Reasoning (${(reasoning.confidence * 100).toFixed(0)}% confidence): ${reasoning.conclusion}]`
      );
    }

    // Add attention focus
    if (attention.depth !== 'surface') {
      contextParts.push(`[Focus: ${attention.primaryFocus}]`);
    }

    // Add user model context if known
    if (state.worldModel.userModel.apparentGoal !== 'unknown') {
      contextParts.push(`[User goal: ${state.worldModel.userModel.apparentGoal}]`);
    }

    const contextSuffix = contextParts.length > 0
      ? '\n\n' + contextParts.join('\n')
      : '';

    const topic =
      perception.intent.type === 'discuss' ? perception.intent.topic :
      perception.intent.type === 'reason' ? perception.intent.question :
      perception.intent.type === 'build' ? perception.intent.description :
      perception.intent.type === 'evaluate' ? perception.intent.opportunity :
      perception.intent.message;

    let accumulated = '';
    const response = await generateResponse(
      agent,
      state.working.conversationHistory,
      topic + contextSuffix,
      (chunk) => {
        accumulated = chunk;
        emit({ type: 'response_chunk', text: chunk, timestamp: Date.now() });
      }
    );

    return response || accumulated;
  }

  // ═══════════════════════════════════════════════════════
  //  Phase 6: REFLECT
  // ═══════════════════════════════════════════════════════
  //
  //  The engine looks at what it just produced and asks:
  //  - Was this good? (substance, coherence, relevance)
  //  - Was this beautiful? (brevity, craft)
  //  - What should I believe differently now?
  //  - How confident am I?
  //
  //  Reflection feeds back into the world model and
  //  lasting memory, closing the loop.

  function reflect(
    input: string,
    output: string,
    agent: Agent,
    perception: Perception,
    durationMs: number,
  ): Reflection {
    const words = output.split(/\s+/).length;
    const sentences = (output.match(/[.!?]+/g) || []).length || 1;
    const avgSentenceLength = words / sentences;

    // ── Substance (0-1) ──
    // Does it say something real, or is it filler?
    const hasSubstance = output.length > 50;
    const hasSpecifics = /\d/.test(output) || output.includes('"') || output.includes('because');
    const notBoilerplate = !output.includes('I can help') && !output.includes('Here is');
    const substance = (
      (hasSubstance ? 0.4 : 0) +
      (hasSpecifics ? 0.35 : 0) +
      (notBoilerplate ? 0.25 : 0)
    );

    // ── Coherence (0-1) ──
    // Does it flow from what came before?
    const noErrors = !output.includes('Error') && !output.includes('Unable to');
    const lastMessage = state.working.conversationHistory[state.working.conversationHistory.length - 2];
    const buildsOnPrior = lastMessage
      ? output.toLowerCase().split(' ').some(w =>
          w.length > 4 && lastMessage.content.toLowerCase().includes(w)
        )
      : true;
    const coherence = (noErrors ? 0.5 : 0) + (buildsOnPrior ? 0.5 : 0);

    // ── Relevance (0-1) ──
    // Does it address the actual need?
    const inputWords = input.toLowerCase().split(/\s+/).filter(w => w.length > 3);
    const outputLower = output.toLowerCase();
    const relevantWords = inputWords.filter(w => outputLower.includes(w)).length;
    const relevance = inputWords.length > 0
      ? Math.min(1, relevantWords / Math.min(inputWords.length, 5))
      : 0.5;

    // ── Brevity (0-1) ──
    // Is it tight? The best responses say a lot in little.
    // Sweet spot: 2-4 sentences for discussion, more for reasoning.
    const isReasoning = perception.intent.type === 'reason' || perception.intent.type === 'evaluate';
    const idealSentences = isReasoning ? 8 : 3;
    const sentenceRatio = sentences / idealSentences;
    const brevity = sentenceRatio <= 1
      ? 0.6 + (sentenceRatio * 0.4)  // under ideal = good
      : Math.max(0, 1 - (sentenceRatio - 1) * 0.3); // over ideal = penalty
    const brevityFinal = Math.min(1, brevity * (avgSentenceLength < 25 ? 1 : 0.7));

    // ── Craft (0-1) ──
    // Aesthetic quality. Does it read well?
    const hasVariedPunctuation = /[;:—–]/.test(output);
    const noRepetition = new Set(output.toLowerCase().split(/\s+/)).size / words > 0.6;
    const notGeneric = !output.includes('In conclusion') && !output.includes('Overall');
    const craft = (
      (hasVariedPunctuation ? 0.3 : 0) +
      (noRepetition ? 0.4 : 0) +
      (notGeneric ? 0.3 : 0)
    );

    const quality = (
      substance * 0.25 +
      coherence * 0.25 +
      relevance * 0.2 +
      brevity * 0.15 +
      craft * 0.15
    );

    // ── Conviction Delta ──
    const convictionDelta = quality > 0.7 ? 0.03 : quality < 0.4 ? -0.05 : 0;

    // ── Lesson ──
    const lesson =
      quality > 0.75
        ? `Strong cycle. ${agent.name}'s voice fits this intent well.`
        : quality > 0.5
        ? substance < 0.5
          ? `${agent.name} responded but lacked specifics. Push for concrete details.`
          : brevity < 0.4
          ? `Too verbose. ${agent.name} should be more concise for ${perception.intent.type} intents.`
          : `Adequate. The coherence could improve — build more on prior context.`
        : `Weak cycle. ${
            coherence < 0.3 ? 'Lost thread of conversation.' :
            relevance < 0.3 ? 'Missed the actual question.' :
            `${agent.name} may not be the right voice for this.`
          }`;

    // ── World Model Update ──
    let worldModelUpdate: string | null = null;
    if (perception.isQuestion && quality > 0.6) {
      worldModelUpdate = `User asks ${perception.intent.type} questions — prefers ${perception.complexity > 0.5 ? 'depth' : 'directness'}.`;
    }

    return {
      timestamp: Date.now(),
      phase: 'reflecting',
      input,
      output: output.slice(0, 300),
      agentUsed: agent.id,
      durationMs,
      quality,
      scores: {
        substance,
        coherence,
        relevance,
        brevity: brevityFinal,
        craft,
      },
      lesson,
      worldModelUpdate,
      convictionDelta,
    };
  }

  // ═══════════════════════════════════════════════════════
  //  WORLD MODEL OPERATIONS
  // ═══════════════════════════════════════════════════════

  function formBelief(content: string, confidence: number, source: Belief['source']): Belief {
    const belief: Belief = {
      id: `belief_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
      content,
      confidence,
      source,
      formedAt: Date.now(),
      challengedCount: 0,
      reinforcedCount: 0,
    };

    // Check if a similar belief already exists
    const existing = state.worldModel.beliefs.find(b =>
      b.content.toLowerCase().includes(content.toLowerCase().slice(0, 20)) ||
      content.toLowerCase().includes(b.content.toLowerCase().slice(0, 20))
    );

    if (existing) {
      // Reinforce existing belief
      existing.confidence = Math.min(1, existing.confidence + 0.1);
      existing.reinforcedCount++;
      emit({ type: 'belief_updated', belief: existing, delta: 0.1, timestamp: Date.now() });
      return existing;
    }

    // Add new belief (keep last 20)
    state.worldModel.beliefs = [
      ...state.worldModel.beliefs.slice(-19),
      belief,
    ];
    emit({ type: 'belief_formed', belief, timestamp: Date.now() });
    return belief;
  }

  function challengeBeliefById(beliefId: string): void {
    const belief = state.worldModel.beliefs.find(b => b.id === beliefId);
    if (!belief) return;

    belief.confidence = Math.max(0, belief.confidence - 0.15);
    belief.challengedCount++;

    emit({ type: 'belief_updated', belief, delta: -0.15, timestamp: Date.now() });

    // If challenged too many times, discard
    if (belief.confidence < 0.1) {
      state.worldModel.beliefs = state.worldModel.beliefs.filter(b => b.id !== beliefId);
    }
  }

  function shiftConviction(delta: number, reason: string): void {
    const from = state.worldModel.convictions.overall;
    const to = Math.max(0, Math.min(1, from + delta));
    const isSignificant = Math.abs(delta) > 0.02;

    state.worldModel.convictions = {
      overall: to,
      trend: delta > 0.01 ? 'rising' : delta < -0.01 ? 'falling' : 'stable',
      lastShift: isSignificant ? Date.now() : state.worldModel.convictions.lastShift,
    };

    if (isSignificant) {
      emit({ type: 'conviction_shifted', from, to, reason, timestamp: Date.now() });
    }
  }

  function updateWorldModel(reflection: Reflection, perception: Perception): void {
    // Update conviction
    shiftConviction(reflection.convictionDelta, reflection.lesson);

    // Update situation summary
    state.worldModel.situationSummary = state.working.topic
      ? `In discussion about "${state.working.topic}". Turn ${state.working.turnCount}.`
      : `Processing ${perception.intent.type} request.`;

    // Update user model based on patterns
    const history = state.working.conversationHistory.filter(m => m.agentId === 'human');
    if (history.length >= 2) {
      const avgLength = history.reduce((sum, m) => sum + m.content.length, 0) / history.length;
      state.worldModel.userModel.communicationStyle =
        avgLength < 30 ? 'terse' :
        avgLength < 100 ? 'conversational' :
        'detailed';
    }

    // Form beliefs from reflection insights
    if (reflection.worldModelUpdate) {
      formBelief(reflection.worldModelUpdate, 0.6, 'reflected');
    }

    // Track unresolved questions
    if (perception.isQuestion && reflection.scores.relevance < 0.4) {
      state.working.unresolvedQuestions = [
        ...state.working.unresolvedQuestions.slice(-4),
        state.ephemeral.currentInput,
      ];
    }

    // Update agent performance
    const agentId = reflection.agentUsed;
    const existing = state.lasting.agentPerformance[agentId] || { uses: 0, avgQuality: 0 };
    const newAvg = (existing.avgQuality * existing.uses + reflection.quality) / (existing.uses + 1);
    state.lasting.agentPerformance[agentId] = {
      uses: existing.uses + 1,
      avgQuality: newAvg,
    };

    // Generate thread summary periodically
    if (state.working.turnCount % 5 === 0 && state.working.conversationHistory.length > 0) {
      const recent = state.working.conversationHistory.slice(-5);
      const speakers = [...new Set(recent.map(m => m.agentName))].join(', ');
      state.working.threadSummary = `${speakers} discussed "${state.working.topic}" over ${state.working.turnCount} turns.`;
    }

    // Save
    saveWorldModel(state.worldModel);
    saveLastingMemory(state.lasting);

    emit({
      type: 'world_model_updated',
      summary: state.worldModel.situationSummary,
      timestamp: Date.now(),
    });
  }

  // ═══════════════════════════════════════════════════════
  //  THE COGNITIVE LOOP
  // ═══════════════════════════════════════════════════════
  //
  //  The full cycle, now with attention and world model:
  //
  //  perceive → attend → think → decide → act → reflect
  //      ↑                                        │
  //      └──────── world model updated ───────────┘

  async function cognitiveLoop(input: string): Promise<void> {
    if (aborted) return;
    aborted = false;
    const cycleStart = Date.now();

    // Reset ephemeral
    state.ephemeral = {
      ...createEmptyEphemeral(),
      currentInput: input,
      startedAt: cycleStart,
    };

    // ── 1. Perceive ──
    setPhase('perceiving');
    const perception = perceiveInput(input);
    state.ephemeral.perception = perception;
    emit({ type: 'perception_complete', perception, timestamp: Date.now() });
    emit({ type: 'intent_parsed', intent: perception.intent, timestamp: Date.now() });

    if (aborted) return;

    // ── 2. Attend ──
    setPhase('attending');
    const attention = attend(perception);
    state.ephemeral.attention = attention;
    emit({ type: 'attention_set', attention, timestamp: Date.now() });

    if (aborted) return;

    // ── 3. Think ──
    setPhase('thinking');
    const reasoning = await think(perception, attention);

    if (aborted) return;

    // ── 4. Decide ──
    setPhase('deciding');
    const { agent, reason: selectionReason, confidence } = selectAgent(perception, attention);
    state.ephemeral.activeAgent = agent;
    emit({ type: 'agent_selected', agent, reason: `${selectionReason} (${(confidence * 100).toFixed(0)}% confident)`, timestamp: Date.now() });

    if (aborted) return;

    // ── 5. Act ──
    setPhase('acting');
    let response: string;
    try {
      response = await act(agent, perception, attention, reasoning);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error during generation';
      emit({ type: 'error', message, timestamp: Date.now() });
      shiftConviction(-0.05, 'Generation error');
      setPhase('idle');
      return;
    }

    if (aborted) return;

    // Record to working memory
    const agentMessage: Message = {
      id: `engine_${Date.now()}`,
      agentId: agent.id,
      agentName: agent.name,
      content: response,
      timestamp: new Date(),
    };
    state.working.conversationHistory.push(agentMessage);
    state.working.turnCount++;
    state.working.agentSequence.push(agent.id);

    // Update emotional tone (running average)
    state.working.emotionalTone =
      state.working.emotionalTone * 0.7 + perception.sentiment * 0.3;

    // ── 6. Reflect ──
    setPhase('reflecting');
    const durationMs = Date.now() - cycleStart;
    const reflection = reflect(input, response, agent, perception, durationMs);

    // Update lasting memory
    state.lasting.totalInteractions++;
    state.lasting.preferredAgents[agent.id] =
      (state.lasting.preferredAgents[agent.id] || 0) + 1;
    state.lasting.reflections = [
      ...state.lasting.reflections.slice(-49),
      reflection,
    ];

    // Add pattern note for significant learnings
    if (reflection.quality < 0.3 || reflection.quality > 0.85) {
      state.lasting.patternNotes = [
        ...state.lasting.patternNotes.slice(-19),
        `[${new Date().toLocaleDateString()}] ${reflection.lesson}`,
      ];
    }

    // Update world model
    updateWorldModel(reflection, perception);

    state.cycleCount++;
    emit({ type: 'cycle_complete', reflection, timestamp: Date.now() });

    setPhase('idle');
  }

  // ── Discussion Mode ─────────────────────────────────────

  async function runDiscussion(topic: string): Promise<void> {
    aborted = false;
    state.working.topic = topic;

    if (!state.lasting.topicHistory.includes(topic)) {
      state.lasting.topicHistory = [...state.lasting.topicHistory.slice(-19), topic];
      saveLastingMemory(state.lasting);
    }

    // Form a belief about this discussion
    formBelief(`Currently exploring: "${topic}"`, 0.8, 'observed');

    let currentAgent = KERNEL_AGENTS[0];

    while (!aborted) {
      const cycleStart = Date.now();

      setPhase('attending');
      const attention: AttentionState = {
        primaryFocus: topic,
        salience: { [topic]: 1 },
        distractions: [],
        depth: 'moderate',
      };
      state.ephemeral = {
        ...createEmptyEphemeral(),
        activeAgent: currentAgent,
        attention,
        startedAt: cycleStart,
      };
      emit({ type: 'attention_set', attention, timestamp: Date.now() });

      setPhase('deciding');
      emit({
        type: 'agent_selected',
        agent: currentAgent,
        reason: `Discussion turn — ${currentAgent.name} speaks`,
        timestamp: Date.now(),
      });

      setPhase('acting');
      let response: string;
      try {
        response = await generateResponse(
          currentAgent,
          state.working.conversationHistory,
          topic,
          (chunk) => {
            emit({ type: 'response_chunk', text: chunk, timestamp: Date.now() });
          }
        );
      } catch {
        emit({ type: 'error', message: 'Generation failed', timestamp: Date.now() });
        shiftConviction(-0.03, 'Discussion generation error');
        break;
      }

      if (aborted) break;

      const message: Message = {
        id: `disc_${Date.now()}`,
        agentId: currentAgent.id,
        agentName: currentAgent.name,
        content: response,
        timestamp: new Date(),
      };
      state.working.conversationHistory.push(message);
      state.working.turnCount++;
      state.working.agentSequence.push(currentAgent.id);

      setPhase('reflecting');
      const perception: Perception = {
        intent: { type: 'discuss', topic },
        urgency: 0,
        complexity: 0.5,
        sentiment: 0,
        impliedNeed: 'Multiple perspectives',
        keyEntities: extractKeyEntities(response),
        isQuestion: false,
        isFollowUp: true,
      };
      const reflection = reflect(topic, response, currentAgent, perception, Date.now() - cycleStart);
      updateWorldModel(reflection, perception);
      emit({ type: 'cycle_complete', reflection, timestamp: Date.now() });

      state.cycleCount++;
      currentAgent = getNextAgent(currentAgent.id);

      // Contemplative pause
      setPhase('idle');
      await new Promise<void>((resolve) => {
        const delay = 2000 + Math.random() * 2000;
        const timeout = setTimeout(resolve, delay);
        const check = setInterval(() => {
          if (aborted) {
            clearTimeout(timeout);
            clearInterval(check);
            resolve();
          }
        }, 100);
      });
    }

    setPhase('idle');
  }

  // ── Human Injection ─────────────────────────────────────

  function injectHumanMessage(content: string): void {
    const message: Message = {
      id: `human_${Date.now()}`,
      agentId: 'human',
      agentName: 'Isaac',
      content,
      timestamp: new Date(),
    };
    state.working.conversationHistory.push(message);

    // Update user model from human messages
    const style = content.length < 30 ? 'terse'
      : content.length < 100 ? 'conversational'
      : 'detailed';
    state.worldModel.userModel.communicationStyle = style as typeof state.worldModel.userModel.communicationStyle;
  }

  // ── Control ─────────────────────────────────────────────

  function stop(): void {
    aborted = true;
    setPhase('idle');
  }

  function reset(): void {
    aborted = true;
    state = {
      phase: 'idle',
      ephemeral: createEmptyEphemeral(),
      working: {
        conversationHistory: [],
        topic: '',
        turnCount: 0,
        agentSequence: [],
        emotionalTone: 0,
        coherenceScore: 1,
        threadSummary: '',
        unresolvedQuestions: [],
      },
      lasting: state.lasting,
      worldModel: state.worldModel,
      isOnline: true,
      cycleCount: 0,
    };
    setPhase('idle');
  }

  // ── Public Interface ────────────────────────────────────

  return {
    getState: () => ({ ...state }),
    subscribe: (listener: EngineListener) => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    perceive: cognitiveLoop,
    runDiscussion,
    injectHumanMessage,
    addBelief: (content: string, confidence: number) => formBelief(content, confidence, 'stated'),
    challengeBelief: challengeBeliefById,
    removeBelief: (beliefId: string) => {
      state.worldModel.beliefs = state.worldModel.beliefs.filter(b => b.id !== beliefId);
      saveWorldModel(state.worldModel);
    },
    setConviction: (value: number, reason: string) => {
      const from = state.worldModel.convictions.overall;
      const clamped = Math.max(0, Math.min(1, value));
      state.worldModel.convictions = {
        overall: clamped,
        trend: clamped > from ? 'rising' : clamped < from ? 'falling' : 'stable',
        lastShift: Date.now(),
      };
      emit({ type: 'conviction_shifted', from, to: clamped, reason, timestamp: Date.now() });
      saveWorldModel(state.worldModel);
    },
    overrideNextAgent: (agent: Agent | null) => {
      agentOverride = agent;
    },
    pruneReflections: (minQuality: number) => {
      const before = state.lasting.reflections.length;
      state.lasting.reflections = state.lasting.reflections.filter(r => r.quality >= minQuality);
      const removed = before - state.lasting.reflections.length;
      if (removed > 0) saveLastingMemory(state.lasting);
      return removed;
    },
    stop,
    reset,
  };
}

// ── Singleton ─────────────────────────────────────────────

let _engine: ReturnType<typeof createEngine> | null = null;

export function getEngine(): ReturnType<typeof createEngine> {
  if (!_engine) {
    _engine = createEngine();
  }
  return _engine;
}
