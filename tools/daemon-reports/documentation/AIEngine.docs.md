# JSDoc for src/engine/AIEngine.ts

Undocumented exports: createEngine, getEngine

---

```typescript
/**
 * Creates and returns an instance of the kernel.chat engine.
 * The engine provides methods to perceive input, run discussions, and manage beliefs.
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
          state.lasting as unknown as Record<string, unknown>,
        );
        if (newVersion > supabaseVersion) {
          const { worldModel, lasting } = await getEngineState(currentUserId);
          state.worldModel = worldModel;
          state.lasting = lasting;
          supabaseVersion = newVersion;
          notifyListeners();
        }
      } catch (error) {
        console.error('Failed to sync engine state with Supabase:', error);
      }
    }, 5000);
  }

  function notifyListeners(): void {
    listeners.forEach(listener => listener(state));
  }

  // ── Engine Methods ──────────────────────────────────────

  return {
    getState: () => state,
    subscribe: (listener) => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    perceive: async (input) => {
      // Implementation of perceive method
    },
    runDiscussion: async (topic) => {
      // Implementation of runDiscussion method
    },
    injectHumanMessage: (content) => {
      // Implementation of injectHumanMessage method
    },
    addBelief: (content, confidence) => {
      // Implementation of addBelief method
    },
    challengeBelief: (beliefId) => {
      // Implementation of challengeBelief method
    },
    removeBelief: (beliefId) => {
      // Implementation of removeBelief method
    },
    setConviction: (value, reason) => {
      // Implementation of setConviction method
    },
    overrideNextAgent: (agent) => {
      // Implementation of overrideNextAgent method
    },
    pruneReflections: (minQuality) => {
      // Implementation of pruneReflections method
    },
    setUserId: (userId) => {
      // Implementation of setUserId method
    },
    loadFromSupabase: async () => {
      // Implementation of loadFromSupabase method
    },
    setToolCallbacks: (callbacks) => {
      // Implementation of setToolCallbacks method
    },
    stop: () => {
      // Implementation of stop method
    },
    reset: () => {
      // Implementation of reset method
    },
  };
}
```
