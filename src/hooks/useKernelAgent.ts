import { useState, useEffect, useCallback, useRef } from 'react';
import { getEngine, type EngineEvent, type EngineState } from '../engine/AIEngine';
import { KERNEL_AGENT } from '../agents/kernel';
import { claudeStreamChat } from '../engine/ClaudeClient';
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

// ─── Hook ─────────────────────────────────────────────────

const MAX_EVENTS = 50;

export function useKernelAgent(): KernelAgentState {
  const engine = getEngine();

  // Drawer state
  const [isOpen, setIsOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<KernelTab>('observe');

  // Engine snapshot
  const [engineState, setEngineState] = useState<EngineState>(engine.getState());

  // Event log
  const [events, setEvents] = useState<EngineEvent[]>([]);

  // Chat
  const [messages, setMessages] = useState<KernelMessage[]>([]);
  const [isStreaming, setIsStreaming] = useState(false);
  const abortRef = useRef(false);

  // Access (from AuthProvider)
  const { isSubscribed } = useAuthContext();

  // Subscribe to engine events
  useEffect(() => {
    const unsubscribe = engine.subscribe((event: EngineEvent) => {
      setEvents(prev => [...prev.slice(-(MAX_EVENTS - 1)), event]);
      setEngineState(engine.getState());
    });
    return unsubscribe;
  }, [engine]);

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

    // Build Claude messages with engine state context
    const snapshot = serializeEngineState(engine.getState());
    const systemPrompt = `${KERNEL_AGENT.systemPrompt}\n\n---\n\n${snapshot}`;

    // Convert chat history to Claude format
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

    try {
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
      const errMsg = error instanceof Error ? error.message : 'Failed to reach Kernel Agent';
      setMessages(prev =>
        prev.map(m => m.id === kernelMsgId ? { ...m, content: `*${errMsg}*` } : m)
      );
    } finally {
      setIsStreaming(false);
    }
  }, [messages, isStreaming, engine]);

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

    stopEngine: useCallback(() => engine.stop(), [engine]),
    resetEngine: useCallback(() => engine.reset(), [engine]),
    overrideAgent: useCallback((agent: Agent | null) => engine.overrideNextAgent(agent), [engine]),
    setConviction: useCallback((value: number) => engine.setConviction(value, 'Manual adjustment via Kernel Agent'), [engine]),
    addBelief: useCallback((content: string, confidence: number) => engine.addBelief(content, confidence), [engine]),
    challengeBelief: useCallback((id: string) => engine.challengeBelief(id), [engine]),
    removeBelief: useCallback((id: string) => engine.removeBelief(id), [engine]),
    pruneReflections: useCallback((min: number) => engine.pruneReflections(min), [engine]),
  };
}
