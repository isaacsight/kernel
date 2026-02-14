// React hook for the Antigravity Kernel AI Engine
//
// Exposes the engine's cognitive loop, memory layers, and events
// as reactive state that components can observe and render.

import { useState, useEffect, useCallback, useRef } from 'react';
import {
  getEngine,
  type EngineState,
  type EngineEvent,
  type CognitivePhase,
  type Reflection,
} from '../engine/AIEngine';
import type { Message } from '../types';

export interface AIEngineHook {
  // State
  phase: CognitivePhase;
  messages: Message[];
  topic: string;
  turnCount: number;
  cycleCount: number;
  isRunning: boolean;

  // Memory
  totalInteractions: number;
  reflections: Reflection[];
  topicHistory: string[];

  // Live events
  lastEvent: EngineEvent | null;
  thinkingSteps: EngineEvent[];
  streamingText: string;

  // Actions
  perceive: (input: string) => Promise<void>;
  startDiscussion: (topic: string) => Promise<void>;
  injectMessage: (content: string) => void;
  stop: () => void;
  reset: () => void;
}

export function useAIEngine(): AIEngineHook {
  const engine = getEngine();
  const [engineState, setEngineState] = useState<EngineState>(engine.getState());
  const [lastEvent, setLastEvent] = useState<EngineEvent | null>(null);
  const [thinkingSteps, setThinkingSteps] = useState<EngineEvent[]>([]);
  const [streamingText, setStreamingText] = useState('');
  const isRunning = useRef(false);

  useEffect(() => {
    const unsubscribe = engine.subscribe((event: EngineEvent) => {
      // Update state snapshot on every event
      setEngineState(engine.getState());
      setLastEvent(event);

      switch (event.type) {
        case 'thinking_step':
          setThinkingSteps(prev => [...prev, event]);
          break;
        case 'response_chunk':
          setStreamingText(event.text);
          break;
        case 'cycle_complete':
          setStreamingText('');
          break;
        case 'phase_changed':
          if (event.phase === 'perceiving') {
            setThinkingSteps([]);
            setStreamingText('');
          }
          break;
      }
    });

    return unsubscribe;
  }, [engine]);

  const perceive = useCallback(async (input: string) => {
    if (isRunning.current) return;
    isRunning.current = true;
    try {
      await engine.perceive(input);
    } finally {
      isRunning.current = false;
    }
  }, [engine]);

  const startDiscussion = useCallback(async (topic: string) => {
    if (isRunning.current) return;
    isRunning.current = true;
    try {
      await engine.runDiscussion(topic);
    } finally {
      isRunning.current = false;
    }
  }, [engine]);

  const injectMessage = useCallback((content: string) => {
    engine.injectHumanMessage(content);
    setEngineState(engine.getState());
  }, [engine]);

  const stop = useCallback(() => {
    engine.stop();
    isRunning.current = false;
    setEngineState(engine.getState());
  }, [engine]);

  const reset = useCallback(() => {
    engine.reset();
    isRunning.current = false;
    setThinkingSteps([]);
    setStreamingText('');
    setEngineState(engine.getState());
  }, [engine]);

  return {
    phase: engineState.phase,
    messages: engineState.working.conversationHistory,
    topic: engineState.working.topic,
    turnCount: engineState.working.turnCount,
    cycleCount: engineState.cycleCount,
    isRunning: engineState.phase !== 'idle',

    totalInteractions: engineState.lasting.totalInteractions,
    reflections: engineState.lasting.reflections,
    topicHistory: engineState.lasting.topicHistory,

    lastEvent,
    thinkingSteps,
    streamingText,

    perceive,
    startDiscussion,
    injectMessage,
    stop,
    reset,
  };
}
