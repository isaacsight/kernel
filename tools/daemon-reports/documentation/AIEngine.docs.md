# JSDoc for src/engine/AIEngine.ts

Undocumented exports: createEngine, getEngine

---

```typescript
/**
 * Creates and returns an instance of the Antigravity Kernel engine.
 * The engine provides methods to perceive input, run discussions, manage beliefs, and more.
 *
 * @returns An object containing methods to interact with the engine.
 */
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
          state.lasting as unknown as Record<string, unknown>
        );
        supabaseVersion = newVersion;
      } catch (error) {
        console.error('Failed to sync engine state to Supabase:', error);
      }
    }, 5000); // Sync every 5 seconds
  }

  function notifyListeners(event: EngineEvent): void {
    listeners.forEach(listener => listener(event));
  }

  async function perceive(input: string): Promise<void> {
    if (aborted) return;
    state.ephemeral.currentInput = input;
    const perception = await _perceiveInput(input);
    state.ephemeral.perception = perception;
    notifyListeners({ type: 'perceived', input, perception });
  }

  async function runDiscussion(topic: string): Promise<void> {
    if (aborted) return;
    state.working.topic = topic;
    await _runDiscussion(topic, state);
    notifyListeners({ type: 'discussionCompleted', topic });
  }

  // Additional methods and logic for the engine...

  return {
    getState,
    subscribe,
    perceive,
    runDiscussion,
    injectHumanMessage,
    addBelief,
    challengeBelief,
    removeBelief,
    setConviction,
    overrideNextAgent,
    pruneReflections,
    setUserId,
    loadFromSupabase,
    setToolCallbacks,
    stop,
    reset,
  };
}

/**
 * Retrieves the current state of the engine.
 *
 * @returns The current state of the engine.
 */
export function getEngine(): EngineState {
  // Implementation details...
}
```
