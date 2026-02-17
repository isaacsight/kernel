// ═══════════════════════════════════════════════════════════════
//  The Antigravity Kernel — A Unified AI Engine
// ═══════════════════════════════════════════════════════════════
//
//  Architecture:
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
import { getProvider } from './providers/registry';
import { perceiveInput as _perceiveInput } from './perception';
import { attend as _attend } from './attention';
import { reflect as _reflect } from './reflection';
import { extractKeyEntities } from './textAnalysis';
import type { Agent, Message } from '../types';

// Re-export all types for backward compatibility
export type {
  ThinkingStep,
  ReasoningResult,
  CognitivePhase,
  IntentType,
  ReasoningDomain,
  Intent,
  Perception,
  AttentionState,
  Belief,
  WorldModel,
  EphemeralMemory,
  WorkingMemory,
  LastingMemory,
  Reflection,
  EngineState,
  EngineEvent,
  EngineListener,
} from './types';

import type {
  CognitivePhase,
  Belief,
  WorldModel,
  LastingMemory,
  EphemeralMemory,
  AttentionState,
  Perception,
  Reflection,
  ReasoningResult,
  EngineState,
  EngineEvent,
  EngineListener,
} from './types';

// ─── Storage ────────────────────────────────────────────────

const LASTING_MEMORY_KEY = 'antigravity-kernel-memory';
const WORLD_MODEL_KEY = 'antigravity-kernel-world';

// ─── Discussion Guardrails ───────────────────────────────

const DISCUSSION_MAX_TURNS = 10;
const DISCUSSION_MIN_QUALITY = 0.3;
const DISCUSSION_QUALITY_WINDOW = 3;

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
  setUserId: (userId: string | null) => void;
  loadFromSupabase: () => Promise<void>;
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

  // ── Supabase Sync State ────────────────────────────────

  let currentUserId: string | null = null;
  let supabaseVersion = 0;
  let syncTimer: ReturnType<typeof setTimeout> | null = null;

  function scheduleSyncToSupabase(): void {
    if (!currentUserId) return;
    if (syncTimer) clearTimeout(syncTimer);
    syncTimer = setTimeout(async () => {
      if (!currentUserId) return;
      try {
        const { syncEngineState } = await import('./SupabaseClient');
        const newVersion = await syncEngineState(
          currentUserId,
          state.worldModel as unknown as Record<string, unknown>,
          state.lasting as unknown as Record<string, unknown>,
          supabaseVersion
        );
        supabaseVersion = newVersion;
      } catch (err) {
        console.warn('[Engine] Supabase sync failed:', err);
      }
    }, 7000);
  }

  function persistState(): void {
    saveWorldModel(state.worldModel);
    saveLastingMemory(state.lasting);
    scheduleSyncToSupabase();
  }

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
  //  Phase 4: DECIDE — Select agent
  // ═══════════════════════════════════════════════════════

  function selectAgent(
    perception: Perception,
    attention: AttentionState,
  ): { agent: Agent; reason: string; confidence: number } {
    if (agentOverride) {
      const overridden = agentOverride;
      agentOverride = null;
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
  //  Phase 5: ACT — Generate response
  // ═══════════════════════════════════════════════════════

  async function act(
    agent: Agent,
    perception: Perception,
    attention: AttentionState,
    reasoning: ReasoningResult | null,
  ): Promise<string> {
    const contextParts: string[] = [];

    if (reasoning) {
      contextParts.push(
        `[Reasoning (${(reasoning.confidence * 100).toFixed(0)}% confidence): ${reasoning.conclusion}]`
      );
    }

    if (attention.depth !== 'surface') {
      contextParts.push(`[Focus: ${attention.primaryFocus}]`);
    }

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

    const claudeMessages: { role: string; content: string }[] = state.working.conversationHistory
      .slice(-10)
      .map(m => ({
        role: m.agentId === 'human' ? 'user' : 'assistant',
        content: `${m.agentName}: ${m.content}`,
      }));
    claudeMessages.push({ role: 'user', content: topic + contextSuffix });

    let accumulated = '';
    const response = await getProvider().streamChat(
      claudeMessages,
      (chunk) => {
        accumulated = chunk;
        emit({ type: 'response_chunk', text: chunk, timestamp: Date.now() });
      },
      { system: agent.systemPrompt, tier: 'strong', max_tokens: 512 }
    );

    return response || accumulated;
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

    const existing = state.worldModel.beliefs.find(b =>
      b.content.toLowerCase().includes(content.toLowerCase().slice(0, 20)) ||
      content.toLowerCase().includes(b.content.toLowerCase().slice(0, 20))
    );

    if (existing) {
      existing.confidence = Math.min(1, existing.confidence + 0.1);
      existing.reinforcedCount++;
      emit({ type: 'belief_updated', belief: existing, delta: 0.1, timestamp: Date.now() });
      return existing;
    }

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
    shiftConviction(reflection.convictionDelta, reflection.lesson);

    state.worldModel.situationSummary = state.working.topic
      ? `In discussion about "${state.working.topic}". Turn ${state.working.turnCount}.`
      : `Processing ${perception.intent.type} request.`;

    const history = state.working.conversationHistory.filter(m => m.agentId === 'human');
    if (history.length >= 2) {
      const avgLength = history.reduce((sum, m) => sum + m.content.length, 0) / history.length;
      state.worldModel.userModel.communicationStyle =
        avgLength < 30 ? 'terse' :
        avgLength < 100 ? 'conversational' :
        'detailed';
    }

    if (reflection.worldModelUpdate) {
      formBelief(reflection.worldModelUpdate, 0.6, 'reflected');
    }

    if (perception.isQuestion && reflection.scores.relevance < 0.4) {
      state.working.unresolvedQuestions = [
        ...state.working.unresolvedQuestions.slice(-4),
        state.ephemeral.currentInput,
      ];
    }

    const agentId = reflection.agentUsed;
    const existing = state.lasting.agentPerformance[agentId] || { uses: 0, avgQuality: 0 };
    const newAvg = (existing.avgQuality * existing.uses + reflection.quality) / (existing.uses + 1);
    state.lasting.agentPerformance[agentId] = {
      uses: existing.uses + 1,
      avgQuality: newAvg,
    };

    if (state.working.turnCount % 5 === 0 && state.working.conversationHistory.length > 0) {
      const recent = state.working.conversationHistory.slice(-5);
      const speakers = [...new Set(recent.map(m => m.agentName))].join(', ');
      state.working.threadSummary = `${speakers} discussed "${state.working.topic}" over ${state.working.turnCount} turns.`;
    }

    persistState();

    emit({
      type: 'world_model_updated',
      summary: state.worldModel.situationSummary,
      timestamp: Date.now(),
    });
  }

  // ═══════════════════════════════════════════════════════
  //  THE COGNITIVE LOOP
  // ═══════════════════════════════════════════════════════

  async function cognitiveLoop(input: string): Promise<void> {
    if (aborted) return;
    aborted = false;
    const cycleStart = Date.now();

    state.ephemeral = {
      ...createEmptyEphemeral(),
      currentInput: input,
      startedAt: cycleStart,
    };

    // ── 1. Perceive ──
    setPhase('perceiving');
    const perception = _perceiveInput(input, state.working.conversationHistory);
    state.ephemeral.perception = perception;
    emit({ type: 'perception_complete', perception, timestamp: Date.now() });
    emit({ type: 'intent_parsed', intent: perception.intent, timestamp: Date.now() });

    if (aborted) return;

    // ── 2. Attend ──
    setPhase('attending');
    const attention = _attend(perception, state.working.conversationHistory, state.working.unresolvedQuestions);
    state.ephemeral.attention = attention;
    emit({ type: 'attention_set', attention, timestamp: Date.now() });

    if (aborted) return;

    // ── 3. Think ──
    setPhase('thinking');
    const reasoning: ReasoningResult | null = null; // Reasoning engine removed (was Gemini-based)

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

    state.working.emotionalTone =
      state.working.emotionalTone * 0.7 + perception.sentiment * 0.3;

    // ── 6. Reflect ──
    setPhase('reflecting');
    const durationMs = Date.now() - cycleStart;
    const reflection = _reflect(input, response, agent, perception, durationMs, state.working.conversationHistory);

    state.lasting.totalInteractions++;
    state.lasting.preferredAgents[agent.id] =
      (state.lasting.preferredAgents[agent.id] || 0) + 1;
    state.lasting.reflections = [
      ...state.lasting.reflections.slice(-49),
      reflection,
    ];

    if (reflection.quality < 0.3 || reflection.quality > 0.85) {
      state.lasting.patternNotes = [
        ...state.lasting.patternNotes.slice(-19),
        `[${new Date().toLocaleDateString()}] ${reflection.lesson}`,
      ];
    }

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
      persistState();
    }

    formBelief(`Currently exploring: "${topic}"`, 0.8, 'observed');

    let currentAgent = KERNEL_AGENTS[0];
    let discussionTurns = 0;
    const discussionReflections: Reflection[] = [];

    while (!aborted) {
      if (discussionTurns >= DISCUSSION_MAX_TURNS) {
        emit({
          type: 'discussion_stopped',
          reason: `Reached maximum of ${DISCUSSION_MAX_TURNS} turns`,
          turns: discussionTurns,
          timestamp: Date.now(),
        });
        break;
      }

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
        const discMessages: { role: string; content: string }[] = state.working.conversationHistory
          .slice(-10)
          .map(m => ({
            role: m.agentId === 'human' ? 'user' : 'assistant',
            content: `${m.agentName}: ${m.content}`,
          }));
        discMessages.push({ role: 'user', content: `CURRENT TOPIC: "${topic}"\n\nNow respond as ${currentAgent.name}. Remember: 2-3 sentences max, build on what others said, reference them by name.` });

        response = await getProvider().streamChat(
          discMessages,
          (chunk) => {
            emit({ type: 'response_chunk', text: chunk, timestamp: Date.now() });
          },
          { system: currentAgent.systemPrompt, tier: 'strong', max_tokens: 512 }
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
      const reflection = _reflect(topic, response, currentAgent, perception, Date.now() - cycleStart, state.working.conversationHistory);
      updateWorldModel(reflection, perception);
      emit({ type: 'cycle_complete', reflection, timestamp: Date.now() });

      discussionReflections.push(reflection);
      discussionTurns++;

      if (discussionReflections.length >= DISCUSSION_QUALITY_WINDOW) {
        const recentWindow = discussionReflections.slice(-DISCUSSION_QUALITY_WINDOW);
        const avgQuality = recentWindow.reduce((sum, r) => sum + r.quality, 0) / recentWindow.length;
        if (avgQuality < DISCUSSION_MIN_QUALITY) {
          emit({
            type: 'discussion_stopped',
            reason: `Quality degraded (avg ${(avgQuality * 100).toFixed(0)}% over last ${DISCUSSION_QUALITY_WINDOW} turns)`,
            turns: discussionTurns,
            timestamp: Date.now(),
          });
          break;
        }
      }

      state.cycleCount++;
      currentAgent = getNextAgent(currentAgent.id);

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
      persistState();
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
      persistState();
    },
    overrideNextAgent: (agent: Agent | null) => {
      agentOverride = agent;
    },
    pruneReflections: (minQuality: number) => {
      const before = state.lasting.reflections.length;
      state.lasting.reflections = state.lasting.reflections.filter(r => r.quality >= minQuality);
      const removed = before - state.lasting.reflections.length;
      if (removed > 0) persistState();
      return removed;
    },
    setUserId: (userId: string | null) => {
      currentUserId = userId;
      if (!userId && syncTimer) {
        clearTimeout(syncTimer);
        syncTimer = null;
      }
    },
    loadFromSupabase: async () => {
      if (!currentUserId) return;
      try {
        const { getEngineState } = await import('./SupabaseClient');
        const remote = await getEngineState(currentUserId);
        if (!remote) {
          console.log('[Engine] No remote state found, will seed on next persist');
          return;
        }
        supabaseVersion = remote.version;
        const remoteMemory = remote.lasting_memory as unknown as LastingMemory;
        if (remoteMemory.totalInteractions > state.lasting.totalInteractions) {
          state.lasting = remoteMemory;
          state.worldModel = remote.world_model as unknown as WorldModel;
          saveLastingMemory(state.lasting);
          saveWorldModel(state.worldModel);
          console.log('[Engine] State loaded from Supabase (remote had more interactions)');
        } else {
          console.log('[Engine] Local state newer, will overwrite remote on next persist');
        }
      } catch (err) {
        console.warn('[Engine] Failed to load from Supabase:', err);
      }
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
