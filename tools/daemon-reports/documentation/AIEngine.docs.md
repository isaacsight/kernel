# JSDoc for src/engine/AIEngine.ts

Undocumented exports: createEngine, getEngine

---

```typescript
/**
 * Creates and returns an instance of the Antigravity Kernel engine.
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
          state.
```
