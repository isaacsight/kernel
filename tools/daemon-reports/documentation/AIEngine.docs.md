# JSDoc for src/engine/AIEngine.ts

Undocumented exports: createEngine, getEngine

---

```typescript
/**
 * Creates and initializes a new engine instance.
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
    }, 5000);
  }

  // ── Engine Methods ─────────────────────────────────────

  function notifyListeners(): void {
    for (const listener of listeners) {
      listener(state);
    }
  }

  async function perceive(input: string): Promise<void> {
    if (aborted) return;
    state.phase = 'perceiving';
    state.ephemeral.currentInput = input;
    const perception = await _perceiveInput(input);
    state.ephemeral.perception = perception;
    notifyListeners();
    // Continue with the rest of the cognitive cycle...
  }

  async function runDiscussion(topic: string): Promise<void> {
    if (aborted) return;
    state.phase = 'running discussion';
    state.working.topic = topic;
    await _runDiscussion(topic);
    notifyListeners();
  }

  function injectHumanMessage(content: string): void {
    if (aborted) return;
    state.ephemeral.currentInput = content;
    // Process the human message...
    notifyListeners();
  }

  function addBelief(content: string, confidence: number): void {
    const newBelief = formBelief(content, confidence);
    state.worldModel.beliefs.push(newBelief);
    notifyListeners();
  }

  function challengeBelief(beliefId: string): void {
    challengeBeliefById(state.worldModel, beliefId);
    notifyListeners();
  }

  function removeBelief(beliefId: string): void {
    const index = state.worldModel.beliefs.findIndex(b => b.id === beliefId);
    if (index !== -1) {
      state.worldModel.beliefs.splice(index, 1);
      notifyListeners();
    }
  }

  function setConviction(value: number, reason: string): void {
    shiftConviction(state.worldModel, value, reason);
    notifyListeners();
  }

  function overrideNextAgent(agent: Agent | null): void {
    agentOverride = agent;
  }

  function pruneReflections(minQuality: number): number {
    const initialCount = state.lasting.reflections.length;
    state.lasting.reflections = state.lasting.reflections.filter(r => r.quality >= minQuality);
    return initialCount - state.lasting.reflections.length;
  }

  function setUserId(userId: string | null): void {
    currentUserId = userId;
    if (userId) {
      loadFromSupabase();
    }
  }

  async function loadFromSupabase(): Promise<void> {
    if (!currentUserId) return;
    try {
      const { worldModel, lastingMemory } = await getEngineState(currentUserId);
      state.worldModel = worldModel;
      state.lasting = lastingMemory;
      notifyListeners();
    } catch (error) {
      console.error('Failed to load engine state from Supabase:', error);
    }
  }

  function setToolCallbacks(callbacks: ToolLoopCallbacks): void {
    // Implement tool callback setting logic...
  }

  function stop(): void {
    aborted = true;
  }

  function reset(): void {
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
      lasting: loadLastingMemory(),
      worldModel: loadWorldModel(),
      isOnline: true,
      cycleCount: 0,
    };
    notifyListeners();
  }

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
 * Retrieves the current engine state.
 *
 * @returns The current engine state.
 */
export function getEngine(): EngineState {
  // Implementation of getting the engine state
}
```
