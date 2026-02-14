// ═══════════════════════════════════════════════════════════════
//  The Antigravity Kernel — A Unified AI Engine
// ═══════════════════════════════════════════════════════════════
//
//  Architecture: Perceive → Think → Decide → Act → Reflect
//
//  This engine unifies the scattered intelligence modules
//  (reasoning, agents, providers, memory) into a single
//  cognitive loop. It is the substrate upon which the
//  Sovereign AI platform thinks.
//
// ═══════════════════════════════════════════════════════════════

import { KERNEL_AGENTS, getNextAgent } from '../agents';
import { SWARM_AGENTS, routeToAgent } from '../agents/swarm';
import { generateResponse } from './ProviderRouter';
import { reason, type ThinkingStep, type ReasoningResult } from './ReasoningEngine';
import type { Agent, Message } from '../types';

// ─── Cognitive Phase ────────────────────────────────────────

export type CognitivePhase =
  | 'idle'        // Resting state — awaiting stimulus
  | 'perceiving'  // Processing input, extracting intent
  | 'thinking'    // Reasoning through the problem
  | 'deciding'    // Selecting agent and strategy
  | 'acting'      // Generating response
  | 'reflecting'; // Evaluating output quality

// ─── Intent Classification ──────────────────────────────────

export type Intent =
  | { type: 'discuss'; topic: string }
  | { type: 'reason'; question: string; domain: 'financial' | 'technical' | 'strategic' | 'general' }
  | { type: 'build'; description: string }
  | { type: 'evaluate'; opportunity: string }
  | { type: 'converse'; message: string };

// ─── Memory Layers ──────────────────────────────────────────
//
//  Three tiers, like geological strata:
//  - Ephemeral: vanishes after each cognitive cycle
//  - Working: persists for the session
//  - Lasting: survives across sessions (localStorage)
//

export interface EphemeralMemory {
  currentInput: string;
  parsedIntent: Intent | null;
  activeAgent: Agent | null;
  thinkingSteps: ThinkingStep[];
  startedAt: number;
}

export interface WorkingMemory {
  conversationHistory: Message[];
  topic: string;
  turnCount: number;
  agentSequence: string[];     // which agents have spoken, in order
  emotionalTone: number;       // -1 (critical) to 1 (affirming)
  coherenceScore: number;      // how well the conversation flows (0-1)
}

export interface LastingMemory {
  totalInteractions: number;
  preferredAgents: Record<string, number>;  // agent id → selection count
  topicHistory: string[];
  reflections: Reflection[];
  feedbackRatio: { positive: number; negative: number };
}

// ─── Reflection ─────────────────────────────────────────────

export interface Reflection {
  timestamp: number;
  phase: CognitivePhase;
  input: string;
  output: string;
  agentUsed: string;
  durationMs: number;
  quality: number;  // 0-1 self-assessed
  lesson: string;
}

// ─── Engine State ───────────────────────────────────────────

export interface EngineState {
  phase: CognitivePhase;
  ephemeral: EphemeralMemory;
  working: WorkingMemory;
  lasting: LastingMemory;
  isOnline: boolean;
  cycleCount: number;
}

// ─── Engine Events ──────────────────────────────────────────

export type EngineEvent =
  | { type: 'phase_changed'; phase: CognitivePhase; timestamp: number }
  | { type: 'intent_parsed'; intent: Intent; timestamp: number }
  | { type: 'agent_selected'; agent: Agent; reason: string; timestamp: number }
  | { type: 'thinking_step'; step: ThinkingStep; timestamp: number }
  | { type: 'response_chunk'; text: string; timestamp: number }
  | { type: 'cycle_complete'; reflection: Reflection; timestamp: number }
  | { type: 'error'; message: string; timestamp: number };

export type EngineListener = (event: EngineEvent) => void;

// ─── The Engine ─────────────────────────────────────────────

const LASTING_MEMORY_KEY = 'antigravity-kernel-memory';

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
  } catch {
    // Storage full or unavailable — degrade gracefully
  }
}

function createEmptyLastingMemory(): LastingMemory {
  return {
    totalInteractions: 0,
    preferredAgents: {},
    topicHistory: [],
    reflections: [],
    feedbackRatio: { positive: 0, negative: 0 },
  };
}

function createEmptyEphemeral(): EphemeralMemory {
  return {
    currentInput: '',
    parsedIntent: null,
    activeAgent: null,
    thinkingSteps: [],
    startedAt: 0,
  };
}

export function createEngine(): {
  getState: () => EngineState;
  subscribe: (listener: EngineListener) => () => void;
  perceive: (input: string) => Promise<void>;
  runDiscussion: (topic: string) => Promise<void>;
  injectHumanMessage: (content: string) => void;
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
    },
    lasting: loadLastingMemory(),
    isOnline: true,
    cycleCount: 0,
  };

  const listeners: Set<EngineListener> = new Set();
  let aborted = false;

  // ── Event System ────────────────────────────────────────

  function emit(event: EngineEvent): void {
    for (const listener of listeners) {
      try {
        listener(event);
      } catch {
        // Listener errors should never crash the engine
      }
    }
  }

  function setPhase(phase: CognitivePhase): void {
    state = { ...state, phase };
    emit({ type: 'phase_changed', phase, timestamp: Date.now() });
  }

  // ── Phase 1: Perceive ───────────────────────────────────
  //
  //  Parse raw input into structured intent.
  //  The engine understands *what kind of thing*
  //  is being asked before it thinks about it.

  function parseIntent(input: string): Intent {
    const lower = input.toLowerCase();

    // Reasoning triggers
    if (
      lower.includes('think about') || lower.includes('analyze') ||
      lower.includes('evaluate') || lower.includes('should i') ||
      lower.includes('worth it') || lower.includes('expected value') ||
      lower.includes('strategy') || lower.includes('calculate') ||
      lower.includes('reason through')
    ) {
      const domain = lower.includes('money') || lower.includes('revenue') || lower.includes('cost')
        ? 'financial' as const
        : lower.includes('code') || lower.includes('build') || lower.includes('architecture')
        ? 'technical' as const
        : lower.includes('plan') || lower.includes('approach') || lower.includes('strategy')
        ? 'strategic' as const
        : 'general' as const;

      return { type: 'reason', question: input, domain };
    }

    // Build triggers
    if (
      lower.includes('build') || lower.includes('create') ||
      lower.includes('implement') || lower.includes('make me')
    ) {
      return { type: 'build', description: input };
    }

    // Evaluation triggers
    if (
      lower.includes('opportunity') || lower.includes('evaluate this') ||
      lower.includes('is this worth') || lower.includes('should we pursue')
    ) {
      return { type: 'evaluate', opportunity: input };
    }

    // Discussion triggers
    if (
      lower.includes('discuss') || lower.includes('what do you think about') ||
      lower.includes("let's talk about") || lower.includes('debate')
    ) {
      const topic = input
        .replace(/discuss|what do you think about|let's talk about|debate/gi, '')
        .trim() || input;
      return { type: 'discuss', topic };
    }

    // Default: conversational
    return { type: 'converse', message: input };
  }

  // ── Phase 2: Think ──────────────────────────────────────
  //
  //  Engage the reasoning engine for complex queries.
  //  Simpler intents skip this phase.

  async function think(intent: Intent): Promise<ReasoningResult | null> {
    if (intent.type !== 'reason' && intent.type !== 'evaluate') {
      return null;
    }

    const question = intent.type === 'reason' ? intent.question : intent.opportunity;
    const domain = intent.type === 'reason' ? intent.domain : 'financial';

    try {
      const result = await reason(question, undefined, domain);

      // Emit each thinking step for the UI
      for (const step of result.thinking) {
        emit({ type: 'thinking_step', step, timestamp: Date.now() });
        state.ephemeral.thinkingSteps.push(step);
      }

      return result;
    } catch {
      return null;
    }
  }

  // ── Phase 3: Decide ─────────────────────────────────────
  //
  //  Select the right agent to handle the response.
  //  Uses intent, conversation history, and lasting memory
  //  to make the best choice.

  function selectAgent(intent: Intent): { agent: Agent; reason: string } {
    switch (intent.type) {
      case 'discuss': {
        // For discussions, rotate through kernel agents
        const lastAgentId = state.working.agentSequence[state.working.agentSequence.length - 1];
        const agent = lastAgentId
          ? getNextAgent(lastAgentId)
          : KERNEL_AGENTS[0];
        return { agent, reason: 'Discussion rotation — next voice in sequence' };
      }

      case 'reason':
        return {
          agent: SWARM_AGENTS.find(a => a.id === 'reasoner') || SWARM_AGENTS[0],
          reason: `Deep ${intent.domain} reasoning required`,
        };

      case 'build':
        return {
          agent: SWARM_AGENTS.find(a => a.id === 'architect') || SWARM_AGENTS[0],
          reason: 'Build request — routing to Architect for scoping',
        };

      case 'evaluate':
        return {
          agent: SWARM_AGENTS.find(a => a.id === 'scout') || SWARM_AGENTS[0],
          reason: 'Opportunity evaluation — Scout assesses viability',
        };

      case 'converse': {
        // Route based on message content using the swarm router
        const routed = routeToAgent(intent.message);
        return { agent: routed, reason: `Content-based routing to ${routed.name}` };
      }
    }
  }

  // ── Phase 4: Act ────────────────────────────────────────
  //
  //  Generate the actual response through the selected
  //  agent and provider. Streams chunks back via events.

  async function act(
    agent: Agent,
    intent: Intent,
    reasoning: ReasoningResult | null
  ): Promise<string> {
    const contextSuffix = reasoning
      ? `\n\n[Reasoning completed with ${reasoning.confidence * 100}% confidence: ${reasoning.conclusion}]`
      : '';

    const topic = intent.type === 'discuss'
      ? intent.topic
      : intent.type === 'reason'
      ? intent.question
      : intent.type === 'build'
      ? intent.description
      : intent.type === 'evaluate'
      ? intent.opportunity
      : intent.message;

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

  // ── Phase 5: Reflect ────────────────────────────────────
  //
  //  After acting, the engine evaluates its own output.
  //  This is how it learns over time.

  function reflect(
    input: string,
    output: string,
    agent: Agent,
    durationMs: number
  ): Reflection {
    // Simple heuristics for self-assessment
    const hasSubstance = output.length > 50;
    const isCoherent = !output.includes('Error') && !output.includes('Unable to');
    const isRelevant = output.toLowerCase().includes(
      input.toLowerCase().split(' ')[0] || ''
    );

    const quality = (
      (hasSubstance ? 0.4 : 0) +
      (isCoherent ? 0.4 : 0) +
      (isRelevant ? 0.2 : 0)
    );

    const lesson = quality > 0.7
      ? `${agent.name} handled this well. Similar inputs should route here.`
      : quality > 0.4
      ? `Adequate response from ${agent.name}. Consider deeper reasoning next time.`
      : `Poor response quality. Re-evaluate agent selection for this intent type.`;

    return {
      timestamp: Date.now(),
      phase: 'reflecting',
      input,
      output: output.slice(0, 200),
      agentUsed: agent.id,
      durationMs,
      quality,
      lesson,
    };
  }

  // ── The Cognitive Loop ──────────────────────────────────
  //
  //  The full cycle: perceive → think → decide → act → reflect.
  //  Each phase emits events that the UI can observe.

  async function perceive(input: string): Promise<void> {
    if (aborted) return;
    const cycleStart = Date.now();

    // Reset ephemeral memory for new cycle
    state.ephemeral = {
      ...createEmptyEphemeral(),
      currentInput: input,
      startedAt: cycleStart,
    };

    // ── Perceive ──
    setPhase('perceiving');
    const intent = parseIntent(input);
    state.ephemeral.parsedIntent = intent;
    emit({ type: 'intent_parsed', intent, timestamp: Date.now() });

    if (aborted) return;

    // ── Think ──
    setPhase('thinking');
    const reasoning = await think(intent);

    if (aborted) return;

    // ── Decide ──
    setPhase('deciding');
    const { agent, reason: selectionReason } = selectAgent(intent);
    state.ephemeral.activeAgent = agent;
    emit({ type: 'agent_selected', agent, reason: selectionReason, timestamp: Date.now() });

    if (aborted) return;

    // ── Act ──
    setPhase('acting');
    let response: string;
    try {
      response = await act(agent, intent, reasoning);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error during generation';
      emit({ type: 'error', message, timestamp: Date.now() });
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

    // ── Reflect ──
    setPhase('reflecting');
    const durationMs = Date.now() - cycleStart;
    const reflection = reflect(input, response, agent, durationMs);

    // Update lasting memory
    state.lasting.totalInteractions++;
    state.lasting.preferredAgents[agent.id] =
      (state.lasting.preferredAgents[agent.id] || 0) + 1;
    state.lasting.reflections = [
      ...state.lasting.reflections.slice(-49), // Keep last 50
      reflection,
    ];
    saveLastingMemory(state.lasting);

    state.cycleCount++;
    emit({ type: 'cycle_complete', reflection, timestamp: Date.now() });

    // Return to idle
    setPhase('idle');
  }

  // ── Discussion Mode ─────────────────────────────────────
  //
  //  Continuous multi-agent discussion. Each agent takes
  //  a turn, with contemplative pauses between.

  async function runDiscussion(topic: string): Promise<void> {
    aborted = false;
    state.working.topic = topic;

    if (!state.lasting.topicHistory.includes(topic)) {
      state.lasting.topicHistory = [
        ...state.lasting.topicHistory.slice(-19),
        topic,
      ];
      saveLastingMemory(state.lasting);
    }

    // First agent starts
    let currentAgent = KERNEL_AGENTS[0];

    while (!aborted) {
      const cycleStart = Date.now();

      setPhase('deciding');
      state.ephemeral = {
        ...createEmptyEphemeral(),
        activeAgent: currentAgent,
        startedAt: cycleStart,
      };
      emit({
        type: 'agent_selected',
        agent: currentAgent,
        reason: 'Discussion turn',
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
        emit({ type: 'error', message: 'Generation failed, pausing discussion', timestamp: Date.now() });
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
      const reflection = reflect(topic, response, currentAgent, Date.now() - cycleStart);
      emit({ type: 'cycle_complete', reflection, timestamp: Date.now() });

      state.cycleCount++;

      // Advance to next agent
      currentAgent = getNextAgent(currentAgent.id);

      // Contemplative pause (2-4 seconds)
      setPhase('idle');
      await new Promise<void>((resolve) => {
        const delay = 2000 + Math.random() * 2000;
        const timeout = setTimeout(resolve, delay);
        // Allow abort during pause
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
      },
      lasting: state.lasting, // Preserve lasting memory across resets
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
    perceive,
    runDiscussion,
    injectHumanMessage,
    stop,
    reset,
  };
}

// ── Singleton ─────────────────────────────────────────────
//
//  The engine is a singleton. There is one kernel.

let _engine: ReturnType<typeof createEngine> | null = null;

export function getEngine(): ReturnType<typeof createEngine> {
  if (!_engine) {
    _engine = createEngine();
  }
  return _engine;
}
