// ═══════════════════════════════════════════════════════════════
//  The Antigravity Kernel — A Unified AI Engine
// ═══════════════════════════════════════════════════════════════
//
//  Architecture:
//    Perceive → Attend → Decide → Act → Reflect
//        ↑                                        │
//        └──────────── World Model ───────────────┘
//
//  Memory (three geological strata):
//    Ephemeral — vanishes after each cognitive cycle
//    Working   — persists for the session
//    Lasting   — survives across sessions
//
// ═══════════════════════════════════════════════════════════════

import { getProvider } from './providers/registry';
import { perceiveInput as _perceiveInput } from './perception';
import { attend as _attend } from './attention';
import { reflect as _reflect, reflectWithAI as _reflectWithAI } from './reflection';
import { classifyIntent as routerClassify, buildRecentContext } from './AgentRouter';
import { selectAgent } from './AgentSelection';
import { formBelief, challengeBeliefById, shiftConviction, updateWorldModel } from './WorldModel';
import { runDiscussion as _runDiscussion } from './DiscussionMode';
import { getToolsForAgent, getToolCount } from './tools/registry';
import { runToolLoop } from './tools/executor';
import { syncEngineState, getEngineState } from './SupabaseClient';
import { useCompanionStore } from '../stores/companionStore';
import type { Agent, Message } from '../types';
import type { ToolLoopCallbacks } from './tools/executor';

// Re-export all types for backward compatibility
export type {
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
  Perception,
  AttentionState,
  EngineState,
  EngineEvent,
  EngineListener,
} from './types';

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
  setToolCallbacks: (callbacks: ToolLoopCallbacks) => void;
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
  //  Phase 5: ACT — Generate response
  // ═══════════════════════════════════════════════════════

  // Tool loop callbacks — can be set externally for HITL gates
  let toolCallbacks: ToolLoopCallbacks = {};

  async function act(
    agent: Agent,
    perception: Perception,
    attention: AttentionState,
  ): Promise<string> {
    const contextParts: string[] = [];

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
    // For build/code intents, append artifact format reminder to the user message
    const isBuildIntent = perception.intent.type === 'build' || agent.id === 'coder'
      || agent.id === 'writer' || agent.id === 'aesthete';

    // Extract filenames mentioned in the user's message for explicit ordering
    let artifactReminder = '';
    if (isBuildIntent) {
      const filePattern = /\b([\w-]+\.(?:html?|css|scss|js|jsx|ts|tsx|py|json|yaml|yml|md|sql|csv|svg|xml|toml|rs|go|java|rb|swift|kt|sh|cpp|c|php))\b/gi;
      const mentionedFiles = [...new Set(topic.match(filePattern) || [])];
      if (mentionedFiles.length >= 2) {
        artifactReminder = `\n\n[CRITICAL: You MUST produce ALL ${mentionedFiles.length} files: ${mentionedFiles.join(', ')}. Output them in order, each as a separate \`\`\`language:filename.ext block. Do NOT skip any file. Start with ${mentionedFiles[0]}, then ${mentionedFiles.slice(1).join(', then ')}.]`;
      } else {
        artifactReminder = '\n\n[IMPORTANT: Every complete file MUST use ```language:filename.ext format.]';
      }
    }
    claudeMessages.push({ role: 'user', content: topic + contextSuffix + artifactReminder });

    // Higher token limit for build/code intents that produce file artifacts
    const maxTokens = isBuildIntent ? 8192 : 4096;
    // Append artifact compliance suffix to system prompt for build intents
    const systemPrompt = isBuildIntent
      ? agent.systemPrompt + '\n\nCRITICAL RULE: When the user asks for N files, you MUST produce ALL N files as separate ```language:filename.ext code blocks. Start each file immediately — minimal explanation between files. Produce files FIRST, explanations AFTER all files.'
      : agent.systemPrompt;
    const streak = useCompanionStore.getState().streak;
    const llmOpts = { system: systemPrompt, tier: 'strong' as const, max_tokens: maxTokens, streak };

    // Use tool loop if tools are available for this agent
    const agentTools = getToolCount() > 0 ? getToolsForAgent(agent.id) : [];

    if (agentTools.length > 0) {
      const callbacks: ToolLoopCallbacks = {
        onChunk: (chunk) => {
          emit({ type: 'response_chunk', text: chunk, timestamp: Date.now() });
        },
        onToolCall: toolCallbacks.onToolCall,
        onApprovalNeeded: toolCallbacks.onApprovalNeeded,
      };

      const result = await runToolLoop(claudeMessages, agentTools, callbacks, llmOpts);
      return result.text;
    }

    // Fallback: direct streaming (no tools)
    let accumulated = '';
    const response = await getProvider().streamChat(
      claudeMessages,
      (chunk) => {
        accumulated = chunk;
        emit({ type: 'response_chunk', text: chunk, timestamp: Date.now() });
      },
      llmOpts
    );

    return response || accumulated;
  }

  // ═══════════════════════════════════════════════════════
  //  THE COGNITIVE LOOP
  // ═══════════════════════════════════════════════════════

  const MAX_INPUT_LENGTH = 32_000; // ~32KB max user input

  async function cognitiveLoop(input: string): Promise<void> {
    if (aborted) return;
    aborted = false;

    // Input length validation — reject excessively long messages
    if (input.length > MAX_INPUT_LENGTH) {
      emit({
        type: 'error',
        message: `Message too long (${input.length} chars). Maximum is ${MAX_INPUT_LENGTH} characters.`,
        timestamp: Date.now(),
      });
      return;
    }

    const cycleStart = Date.now();

    state.ephemeral = {
      ...createEmptyEphemeral(),
      currentInput: input,
      startedAt: cycleStart,
    };

    // ── 0. Route (Haiku classification) ──
    const recentCtx = buildRecentContext(
      state.working.conversationHistory.map(m => ({
        role: m.agentId === 'human' ? 'user' : 'assistant',
        content: m.content,
      }))
    );
    let routerResult = undefined;
    try {
      routerResult = await routerClassify(input, recentCtx);
    } catch { /* keyword fallback if router fails */ }

    // ── 1. Perceive ──
    setPhase('perceiving');
    const perception = _perceiveInput(input, state.working.conversationHistory, routerResult);
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

    // ── 3. Decide ──
    setPhase('deciding');
    const selection = selectAgent(
      perception,
      attention,
      agentOverride,
      state.lasting.agentPerformance,
      state.working.agentSequence,
    );
    if (selection.consumedOverride) agentOverride = null;
    const { agent, reason: selectionReason, confidence } = selection;
    state.ephemeral.activeAgent = agent;
    emit({ type: 'agent_selected', agent, reason: `${selectionReason} (${(confidence * 100).toFixed(0)}% confident)`, timestamp: Date.now() });

    if (aborted) return;

    // ── 4. Act ──
    setPhase('acting');
    let response: string;
    try {
      response = await act(agent, perception, attention);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error during generation';
      emit({ type: 'error', message, timestamp: Date.now() });
      shiftConviction(state.worldModel, emit, -0.05, 'Generation error');
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

    // ── 5. Reflect ──
    setPhase('reflecting');
    const durationMs = Date.now() - cycleStart;
    let reflection;
    try {
      reflection = await _reflectWithAI(input, response, agent, perception, durationMs, state.working.conversationHistory);
    } catch {
      reflection = _reflect(input, response, agent, perception, durationMs, state.working.conversationHistory);
    }

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

    updateWorldModel(state, emit, persistState, reflection, perception);

    state.cycleCount++;
    emit({ type: 'cycle_complete', reflection, timestamp: Date.now() });

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
    runDiscussion: (topic: string) => {
      aborted = false;
      return _runDiscussion(topic, {
        getState: () => state,
        setState: (patch) => { state = { ...state, ...patch }; },
        setEphemeral: (eph) => { state.ephemeral = eph; },
        emit,
        setPhase,
        persistState,
        isAborted: () => aborted,
        createEmptyEphemeral,
      });
    },
    injectHumanMessage,
    addBelief: (content: string, confidence: number) => formBelief(state.worldModel, emit, content, confidence, 'stated'),
    challengeBelief: (beliefId: string) => challengeBeliefById(state.worldModel, emit, beliefId),
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
    setToolCallbacks: (callbacks: ToolLoopCallbacks) => {
      toolCallbacks = callbacks;
    },
    loadFromSupabase: async () => {
      if (!currentUserId) return;
      try {
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
