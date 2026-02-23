import { useState, useEffect, useCallback, useRef } from 'react';
import type { EngineEvent, EngineState } from '../engine/types';
import { useAuthContext } from '../providers/AuthProvider';
import type { Agent } from '../types';

// ─── Types ────────────────────────────────────────────────

export type KernelTab = 'chat' | 'observe' | 'control';

export interface KernelMessage {
  id: string;
  role: 'user' | 'kernel';
  content: string;
  timestamp: number;
}

export interface KernelAgentState {
  // Drawer
  isOpen: boolean;
  activeTab: KernelTab;
  openDrawer: () => void;
  closeDrawer: () => void;
  setActiveTab: (tab: KernelTab) => void;

  // Engine snapshot
  engineState: EngineState;

  // Event log
  events: EngineEvent[];

  // Chat
  messages: KernelMessage[];
  isStreaming: boolean;
  sendMessage: (content: string) => Promise<void>;

  // Access control
  isSubscribed: boolean;
  refreshAccess: () => void;

  // Engine controls
  stopEngine: () => void;
  resetEngine: () => void;
  overrideAgent: (agent: Agent | null) => void;
  setConviction: (value: number) => void;
  addBelief: (content: string, confidence: number) => void;
  challengeBelief: (beliefId: string) => void;
  removeBelief: (beliefId: string) => void;
  pruneReflections: (minQuality: number) => number;
}

// ─── Default engine state (shown before engine loads) ─────

const DEFAULT_ENGINE_STATE: EngineState = {
  phase: 'idle',
  ephemeral: { currentInput: '', perception: null, attention: null, activeAgent: null, startedAt: 0 },
  working: { conversationHistory: [], topic: '', turnCount: 0, agentSequence: [], emotionalTone: 0, coherenceScore: 1, threadSummary: '', unresolvedQuestions: [] },
  lasting: { totalInteractions: 0, preferredAgents: {}, topicHistory: [], reflections: [], feedbackRatio: { positive: 0, negative: 0 }, agentPerformance: {}, patternNotes: [] },
  worldModel: { beliefs: [], convictions: { overall: 0.5, trend: 'stable', lastShift: 0 }, situationSummary: '', userModel: { apparentGoal: '', communicationStyle: 'unknown', expertise: 'unknown' } },
  isOnline: false,
  cycleCount: 0,
};

// ─── Engine State Serializer ──────────────────────────────

function serializeEngineState(state: EngineState): string {
  const { phase, ephemeral, working, lasting, worldModel, cycleCount } = state;

  const parts: string[] = [
    `## Engine State Snapshot`,
    `Phase: ${phase}`,
    `Cycle count: ${cycleCount}`,
    `Topic: ${working.topic || '(none)'}`,
    `Turn count: ${working.turnCount}`,
    '',
  ];

  // Conviction
  parts.push(`## Conviction`);
  parts.push(`Overall: ${(worldModel.convictions.overall * 100).toFixed(1)}%`);
  parts.push(`Trend: ${worldModel.convictions.trend}`);
  parts.push('');

  // Beliefs
  if (worldModel.beliefs.length > 0) {
    parts.push(`## Beliefs (${worldModel.beliefs.length})`);
    for (const b of worldModel.beliefs) {
      parts.push(`- [${(b.confidence * 100).toFixed(0)}%] ${b.content} (source: ${b.source}, challenged: ${b.challengedCount}x)`);
    }
    parts.push('');
  }

  // User model
  parts.push(`## User Model`);
  parts.push(`Goal: ${worldModel.userModel.apparentGoal}`);
  parts.push(`Style: ${worldModel.userModel.communicationStyle}`);
  parts.push(`Expertise: ${worldModel.userModel.expertise}`);
  parts.push(`Situation: ${worldModel.situationSummary}`);
  parts.push('');

  // Current perception
  if (ephemeral.perception) {
    const p = ephemeral.perception;
    parts.push(`## Current Perception`);
    parts.push(`Intent: ${p.intent.type}`);
    parts.push(`Urgency: ${(p.urgency * 100).toFixed(0)}%`);
    parts.push(`Complexity: ${(p.complexity * 100).toFixed(0)}%`);
    parts.push(`Sentiment: ${p.sentiment.toFixed(2)}`);
    parts.push(`Implied need: ${p.impliedNeed}`);
    parts.push('');
  }

  // Current attention
  if (ephemeral.attention) {
    const a = ephemeral.attention;
    parts.push(`## Attention`);
    parts.push(`Focus: ${a.primaryFocus}`);
    parts.push(`Depth: ${a.depth}`);
    if (Object.keys(a.salience).length > 0) {
      parts.push(`Salience: ${Object.entries(a.salience).map(([k, v]) => `${k}=${(v * 100).toFixed(0)}%`).join(', ')}`);
    }
    parts.push('');
  }

  // Active agent
  if (ephemeral.activeAgent) {
    parts.push(`## Active Agent: ${ephemeral.activeAgent.name} (${ephemeral.activeAgent.id})`);
    parts.push('');
  }

  // Recent reflections
  const recentReflections = lasting.reflections.slice(-3);
  if (recentReflections.length > 0) {
    parts.push(`## Recent Reflections`);
    for (const r of recentReflections) {
      parts.push(`- Quality: ${(r.quality * 100).toFixed(0)}% | Agent: ${r.agentUsed} | Lesson: ${r.lesson}`);
    }
    parts.push('');
  }

  // Agent performance
  const perfEntries = Object.entries(lasting.agentPerformance);
  if (perfEntries.length > 0) {
    parts.push(`## Agent Performance`);
    for (const [id, perf] of perfEntries) {
      parts.push(`- ${id}: ${perf.uses} uses, avg quality ${(perf.avgQuality * 100).toFixed(0)}%`);
    }
    parts.push('');
  }

  // Conversation summary
  if (working.threadSummary) {
    parts.push(`## Thread Summary: ${working.threadSummary}`);
  }

  return parts.join('\n');
}

// ─── Lazy engine loader ──────────────────────────────────

type Engine = ReturnType<Awaited<typeof import('../engine/AIEngine')>['getEngine']>;

let _enginePromise: Promise<Engine> | null = null;
let _engine: Engine | null = null;

function loadEngine(): Promise<Engine> {
  if (_engine) return Promise.resolve(_engine);
  if (!_enginePromise) {
    _enginePromise = import('../engine/AIEngine').then(mod => {
      _engine = mod.getEngine();
      return _engine;
    });
  }
  return _enginePromise;
}

// ─── Hook ─────────────────────────────────────────────────

const MAX_EVENTS = 50;

export function useKernelAgent(): KernelAgentState {
  // Drawer state
  const [isOpen, setIsOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<KernelTab>('observe');

  // Engine snapshot — starts with default until engine loads
  const [engineState, setEngineState] = useState<EngineState>(DEFAULT_ENGINE_STATE);

  // Event log
  const [events, setEvents] = useState<EngineEvent[]>([]);

  // Chat
  const [messages, setMessages] = useState<KernelMessage[]>([]);
  const [isStreaming, setIsStreaming] = useState(false);
  const abortRef = useRef(false);
  const engineRef = useRef<Engine | null>(null);

  // Access (from AuthProvider)
  const { isSubscribed } = useAuthContext();

  // Load engine when drawer opens (deferred from startup)
  useEffect(() => {
    if (!isOpen) return;
    let cancelled = false;

    loadEngine().then(engine => {
      if (cancelled) return;
      engineRef.current = engine;
      setEngineState(engine.getState());

      const unsubscribe = engine.subscribe((event: EngineEvent) => {
        setEvents(prev => [...prev.slice(-(MAX_EVENTS - 1)), event]);
        setEngineState(engine.getState());
      });

      // Store cleanup in ref so we can call it on unmount
      cleanupRef.current = unsubscribe;
    });

    return () => { cancelled = true; };
  }, [isOpen]);

  const cleanupRef = useRef<(() => void) | null>(null);
  useEffect(() => {
    return () => { cleanupRef.current?.(); };
  }, []);

  // Send message to Kernel Agent via Claude API
  const sendMessage = useCallback(async (content: string) => {
    if (isStreaming) return;

    const userMsg: KernelMessage = {
      id: `user_${Date.now()}`,
      role: 'user',
      content,
      timestamp: Date.now(),
    };

    setMessages(prev => [...prev, userMsg]);
    setIsStreaming(true);
    abortRef.current = false;

    try {
      // Lazy-load engine, agent prompt, and Claude client
      const [engine, { KERNEL_AGENT }, { claudeStreamChat }] = await Promise.all([
        loadEngine(),
        import('../agents/kernel'),
        import('../engine/ClaudeClient'),
      ]);
      engineRef.current = engine;

      const snapshot = serializeEngineState(engine.getState());
      const systemPrompt = `${KERNEL_AGENT.systemPrompt}\n\n---\n\n${snapshot}`;

      const claudeMessages = [...messages, userMsg].map(m => ({
        role: m.role === 'kernel' ? 'assistant' : 'user',
        content: m.content,
      }));

      const kernelMsgId = `kernel_${Date.now()}`;
      setMessages(prev => [...prev, {
        id: kernelMsgId,
        role: 'kernel',
        content: '',
        timestamp: Date.now(),
      }]);

      await claudeStreamChat(
        claudeMessages,
        (fullText) => {
          if (abortRef.current) return;
          setMessages(prev =>
            prev.map(m => m.id === kernelMsgId ? { ...m, content: fullText } : m)
          );
        },
        { system: systemPrompt, model: 'sonnet', max_tokens: 1024 }
      );
    } catch (error) {
      const errMsg = error instanceof Error ? error.message : 'Failed to reach kernel.chat';
      setMessages(prev => {
        const last = prev[prev.length - 1];
        if (last?.role === 'kernel' && last.content === '') {
          return prev.map(m => m.id === last.id ? { ...m, content: `*${errMsg}*` } : m);
        }
        return [...prev, { id: `kernel_err_${Date.now()}`, role: 'kernel', content: `*${errMsg}*`, timestamp: Date.now() }];
      });
    } finally {
      setIsStreaming(false);
    }
  }, [messages, isStreaming]);

  // Engine controls — lazy, noop if engine not loaded yet
  const withEngine = useCallback((fn: (e: Engine) => void) => {
    if (engineRef.current) fn(engineRef.current);
    else loadEngine().then(fn);
  }, []);

  return {
    isOpen,
    activeTab,
    openDrawer: useCallback(() => setIsOpen(true), []),
    closeDrawer: useCallback(() => setIsOpen(false), []),
    setActiveTab,

    engineState,
    events,

    messages,
    isStreaming,
    sendMessage,

    isSubscribed,
    refreshAccess: useCallback(() => { /* handled by AuthProvider */ }, []),

    stopEngine: useCallback(() => withEngine(e => e.stop()), [withEngine]),
    resetEngine: useCallback(() => withEngine(e => e.reset()), [withEngine]),
    overrideAgent: useCallback((agent: Agent | null) => withEngine(e => e.overrideNextAgent(agent)), [withEngine]),
    setConviction: useCallback((value: number) => withEngine(e => e.setConviction(value, 'Manual adjustment via Kernel Agent')), [withEngine]),
    addBelief: useCallback((content: string, confidence: number) => withEngine(e => e.addBelief(content, confidence)), [withEngine]),
    challengeBelief: useCallback((id: string) => withEngine(e => e.challengeBelief(id)), [withEngine]),
    removeBelief: useCallback((id: string) => withEngine(e => e.removeBelief(id)), [withEngine]),
    pruneReflections: useCallback((min: number) => engineRef.current ? engineRef.current.pruneReflections(min) : 0, []),
  };
}
