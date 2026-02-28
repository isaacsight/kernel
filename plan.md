# Agent Creator — Implementation Plan

## What It Is

A UI for users to create custom AI agents with their own personality, expertise, and system prompt. Custom agents plug into the existing routing, swarm, convergence, and memory systems automatically.

User flow:
1. Open the agent creator panel (from drawer or settings)
2. Give the agent a name, emoji, color, and description of what it does
3. Kernel auto-generates a system prompt from the description (or user writes their own)
4. Save → agent appears in their agent list and gets routed to when relevant

## Architecture

### Storage: Local-First + Supabase Sync

- **Zustand store** (`customAgentStore.ts`) — instant local access, persisted to localStorage
- **Supabase table** (`custom_agents`) — cross-device sync, usage tracking
- Local is source of truth during session; sync on load and save

### Routing: Two Modes

1. **Auto-routing** — Custom agents get included in the AgentRouter classification prompt. Haiku decides when to route to them based on their description/keywords.
2. **Manual pin** — User can pin a custom agent to the conversation, bypassing the router entirely. All messages go through that agent until unpinned.

### Integration Points

Custom agents use the same `Specialist` interface as built-in agents. One change to `getSpecialist()` makes them available everywhere — swarm, convergence, memory, the whole stack.

---

## Files to Create

### 1. `src/stores/customAgentStore.ts` — Zustand Store

```
State:
  agents: Record<string, CustomAgent>
  pinnedAgentId: string | null        // manual pin for current conversation

CustomAgent:
  id: string                          // slug from name, e.g. "my-tutor"
  name: string                        // "My Tutor"
  emoji: string                       // "📖"
  color: string                       // "#7BA59B"
  description: string                 // one-line for routing ("helps me study physics")
  systemPrompt: string                // full prompt
  enabled: boolean
  usageCount: number
  createdAt: number
  updatedAt: number

Actions:
  addAgent, updateAgent, deleteAgent, toggleAgent
  pinAgent(id | null)
  syncFromSupabase(agents)
  incrementUsage(id)
```

Persist to localStorage as `kernel-custom-agents`. Partialize everything (agents are small text).

### 2. `src/components/CustomAgentPanel.tsx` — Creator/Editor UI

Bottom-sheet panel following the existing `ka-` pattern.

**Sections:**
- **Agent list** — cards showing emoji + name + description + toggle + edit/delete
- **Create/Edit form** (slides in when creating or editing):
  - Name input (max 30 chars)
  - Emoji picker (simple grid of ~50 common emoji)
  - Color picker (8 preset swatches + custom hex input)
  - Description textarea ("What does this agent do?" — 1-2 sentences, used for routing)
  - System prompt textarea (auto-generated from description, editable)
  - "Generate prompt" button — sends description to Haiku, gets back a formatted system prompt following the PERSONALITY_PREAMBLE + SPECIALIZATION pattern
  - Live preview card showing how the agent will appear
- **Empty state** — "Create your first custom agent" with explanation

**Constraints:**
- Max 10 custom agents per user (prevents router prompt bloat)
- System prompt max 2000 chars
- Crisis protocol always injected (non-negotiable safety)

### 3. `supabase/migrations/045_custom_agents.sql` — Database Table

```sql
CREATE TABLE custom_agents (
  id TEXT NOT NULL,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  emoji TEXT NOT NULL DEFAULT '✨',
  color TEXT NOT NULL DEFAULT '#6B5B95',
  description TEXT NOT NULL DEFAULT '',
  system_prompt TEXT NOT NULL,
  enabled BOOLEAN DEFAULT true,
  usage_count INT DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  PRIMARY KEY (user_id, id)
);

ALTER TABLE custom_agents ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage own agents"
  ON custom_agents FOR ALL
  USING (auth.uid() = user_id);
```

RPCs:
- `get_custom_agents()` — returns all for current user
- `upsert_custom_agent(agent_data JSONB)` — create or update
- `delete_custom_agent(agent_id TEXT)` — delete
- `increment_agent_usage(agent_id TEXT)` — atomic usage counter

---

## Files to Modify

### 4. `src/agents/specialists.ts` — Agent Lookup

Modify `getSpecialist()` to check custom agents:

```typescript
export function getSpecialist(id: string): Specialist {
  if (SPECIALISTS[id]) return SPECIALISTS[id]

  // Check custom agents (Zustand store accessed outside React)
  const custom = useCustomAgentStore.getState().agents[id]
  if (custom && custom.enabled) {
    return {
      id: custom.id,
      name: custom.name,
      icon: custom.emoji,
      color: custom.color,
      systemPrompt: `${PERSONALITY_PREAMBLE}\n\nYOUR SPECIALIZATION: ${custom.name}\n\n${custom.systemPrompt}${ARTIFACT_RULES}`,
    }
  }

  return SPECIALISTS.kernel
}
```

Export `PERSONALITY_PREAMBLE` and `ARTIFACT_RULES` (currently const, not exported) so the custom agent prompt generation can use them.

### 5. `src/engine/AgentRouter.ts` — Intent Classification

Two changes:

**A. Include custom agents in the classification prompt:**
```typescript
// Before classifyIntent, build dynamic agent descriptions
const customAgents = useCustomAgentStore.getState()
  .getAllAgents()
  .filter(a => a.enabled)
  .map(a => `- ${a.id}: ${a.description}`)
  .join('\n')

// Append to CLASSIFICATION_SYSTEM:
// "Custom agents:\n{customAgents}"
```

**B. Accept custom agent IDs in validation:**
```typescript
const validAgents = [...builtinIds, ...customAgentIds]
```

**C. Handle pinned agents:**
```typescript
const pinned = useCustomAgentStore.getState().pinnedAgentId
if (pinned) {
  return { agentId: pinned, confidence: 1.0, complexity: 0.5, ... }
}
```

### 6. `src/hooks/useChatEngine.ts` — Load + Use Custom Agents

- On mount: fetch custom agents from Supabase, sync to store
- On agent selection: if custom agent, increment usage count
- On pin: skip classification, use pinned agent directly

### 7. `src/hooks/usePanelManager.ts` — Panel State

Add `showCustomAgentPanel` / `setShowCustomAgentPanel` to the panel manager.

### 8. `src/pages/EnginePage.tsx` — Render Panel

- Lazy import `CustomAgentPanel`
- Add to "More" menu or drawer: "My Agents" option
- Render panel when `showCustomAgentPanel` is true
- Show pinned agent indicator in the input bar (small colored dot + name)

### 9. `src/index.css` — Styles

~100-150 lines for:
- `.ka-custom-agent-panel` — bottom sheet container
- `.ka-custom-agent-card` — agent list cards
- `.ka-custom-agent-form` — create/edit form
- `.ka-custom-agent-preview` — live preview
- `.ka-custom-agent-pin` — pinned indicator in input bar
- Dark mode + e-ink overrides
- Mobile responsive (375px)

### 10. `src/engine/SwarmOrchestrator.ts` — Include Custom Agents in Pool

```typescript
// Add enabled custom agents to AGENT_POOL dynamically
function getAgentPool(): SwarmAgent[] {
  const customs = useCustomAgentStore.getState()
    .getAllAgents()
    .filter(a => a.enabled)
    .map(a => ({
      id: `custom:${a.id}`,
      name: a.name,
      icon: a.emoji,
      systemPrompt: getSpecialist(a.id).systemPrompt,
    }))
  return [...BASE_AGENT_POOL, ...customs]
}
```

---

## What NOT to Build (Yet)

- **Sharing/marketplace** — no agent sharing between users. That's a v2 feature that needs moderation, discovery, and trust.
- **Agent analytics dashboard** — usage count is enough for now. Deep analytics later.
- **Agent-to-agent handoffs** — custom agents participate in swarms, but don't define their own handoff rules.
- **Supabase edge function** — CRUD goes through the Supabase client directly (RLS protects it). No need for a separate edge function.
- **Custom tools** — agents get the same tools as built-in specialists. Custom tool definitions are a platform-level feature for later.

---

## Implementation Order

1. **Store + Migration** — `customAgentStore.ts` + `045_custom_agents.sql` (foundation)
2. **Specialist integration** — modify `getSpecialist()` + export preamble/rules (makes custom agents usable)
3. **Router integration** — modify `classifyIntent()` + pinning (makes custom agents routable)
4. **Panel UI** — `CustomAgentPanel.tsx` + styles (makes it user-facing)
5. **Engine wiring** — `usePanelManager`, `EnginePage`, `useChatEngine` (connects everything)
6. **Swarm integration** — `SwarmOrchestrator` pool update (enables multi-agent)
7. **Test + polish** — type check, build, manual test flow
