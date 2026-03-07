---
tags: [kernel, architecture, memory]
updated: "2026-03-06"
---

# Memory System

Kernel has a multi-layered memory system that learns users over time and injects relevant context into every conversation.

## Layers

### 1. User Memory Profile (`user_memory` table)
- **What:** Structured JSONB profile with interests, goals, facts, preferences, communication_style
- **How:** `MemoryAgent.ts` extracts from conversations using Haiku every ~3 messages
- **Warmth:** Each item has a warmth score (mention count + last reinforcement timestamp)
- **Decay:** Exponential half-life — 1 mention = 45-day half-life, scales with reinforcement
- **Injection:** `formatMemoryForPrompt()` filters by relevance (Jaccard similarity to current query), caps at ~2000 chars

### 2. Knowledge Graph (`knowledge_graph_entities` + `knowledge_graph_relations`)
- **What:** Entity-relation graph (person, company, project, concept, preference, location)
- **Confidence:** 0.5–1.0, with mention_count tracking
- **Consolidation:** High-confidence entities (0.7+, 3+ mentions) get promoted to profile facts
- **Obsidian sync:** `sync_vault_to_kernel` extracts entities from vault notes into KG

### 3. Convergence (`agent_facets` in user_memory)
- **What:** 6 facet lenses (kernel/researcher/coder/writer/analyst/curator) observe per conversation
- **How:** Haiku extraction every ~3 messages, Sonnet convergence synthesis every ~5 messages
- **Output:** Emergent insights that combine perspectives across agents

### 4. Procedural Memory (`procedures` table)
- **What:** Learned workflows with trigger phrases and step sequences
- **Source:** `'learned'` (extracted from conversations) or `'defined'` (user-created)

### 5. K:BOT Local Memory (`~/.kbot/memory/context.md`)
- **What:** Markdown file, max 50KB, auto-truncates keeping last 500 lines
- **Scope:** CLI-only, not synced to Supabase

## Data Flow

```
User message
  → MemoryAgent.extractMemory() [every ~3 msgs, Haiku]
  → MemoryAgent.mergeMemory() [dedup, warmth update]
  → upsertUserMemory() [save to Postgres]

Next message:
  → getUserMemory() [load profile]
  → formatMemoryForPrompt(profile, userQuery, recentContext) [relevance filter]
  → Injected into system prompt between engine state and callback opportunities
  → Claude responds with personalized context
```

## Safety
- Strips prompt injection patterns before storing
- Fields capped at 200 chars
- Crisis/self-harm content omitted entirely
- Memory never "dumped" — always relevance-filtered

## Obsidian Integration

The `kernel-obsidian` MCP server provides bidirectional sync:
- **Kernel → Obsidian:** `sync_memory_to_vault`, `sync_insights_to_vault`, `sync_briefing_to_vault`
- **Obsidian → Kernel:** `sync_vault_to_kernel` (AI extraction → knowledge graph + profile)
