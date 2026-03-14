# JSDoc for src/engine/AgentRouter.ts

Undocumented exports: ClassificationResult, ModelRoutingContext, classifyIntent

---

```typescript
/**
 * Represents the result of an intent classification.
 */
export interface ClassificationResult {
  agentId: 'kernel' | 'researcher' | 'coder' | 'writer' | 'analyst' | 'aesthete' | 'guardian' | 'curator' | 'strategist' | 'infrastructure' | 'quant' | 'investigator' | 'oracle' | 'chronist' | 'sage' | 'hacker' | 'operator' | 'dreamer'
  confidence: number
  complexity: number
  needsResearch: boolean
  isMultiStep: boolean
  needsSwarm: boolean
  needsImageGen: boolean
  needsImageRefinement: boolean
  needsPlatformEngine: boolean
  needsContentEngine: boolean
  needsAlgorithm: boolean
  needsKnowledgeQuery: boolean
}

/**
 * Provides context for model routing decisions.
 */
export interface ModelRoutingContext {
  messageWordCount?: number
  turnCount?: number
  extendedThinking?: boolean
}

/**
 * Auto-selects a model based on task complexity, message length, and conversation depth.
 * @param c - The classification result containing intent details.
 * @param ctx - Optional context about the current conversation.
 * @returns The selected model ('sonnet' or 'haiku').
 */
export function resolveModelFromClassification(
  c: ClassificationResult,
  ctx?: ModelRoutingContext,
): 'sonnet' | 'haiku' {
  // Extended thinking — always Sonnet
  if (ctx?.extendedThinking) return 'sonnet'
  // Deep conversation (3+ user messages) — Sonnet
  if (ctx?.turnCount && ctx.turnCount >= 3) return 'sonnet'
  // High complexity task — Sonnet
  if (c.complexity >= 0.6) return 'sonnet'
  // Long/detailed message (30+ words) — Sonnet
  if (ctx?.messageWordCount && ctx.messageWordCount >= 30) return 'sonnet'
  // Everything else — Haiku (the default!)
  return 'haiku'
}
```
