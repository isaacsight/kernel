// ═══════════════════════════════════════════════════════════════
//  GrowthStage — Relationship maturity staging
// ═══════════════════════════════════════════════════════════════
//
//  Pure computation — no API calls. Determines how well
//  Kernel knows this user based on conversation count,
//  time span, memory richness, and convergence depth.
//
//  Each stage adjusts extraction frequency, convergence
//  cadence, and identity extraction eligibility.
//
// ═══════════════════════════════════════════════════════════════

export type GrowthStageName = 'dormant' | 'germinating' | 'growing' | 'mature'

export interface GrowthState {
  stage: GrowthStageName
  conversationCount: number
  firstSeenAt: number          // timestamp of first interaction
  memoryItemCount: number      // count of non-empty profile fields
  convergenceInsightCount: number
  kgEntityCount: number
  computedAt: number
}

export interface AdaptiveThresholds {
  /** Extract memory every N messages */
  memoryExtractionInterval: number
  /** Run convergence every N messages */
  convergenceInterval: number
  /** Proactive callback threshold (mentions to trigger) */
  proactiveCallbackThreshold: number
  /** Identity extraction enabled */
  identityExtractionEnabled: boolean
  /** Identity extraction every N messages (only at growing+) */
  identityExtractionInterval: number
}

const STAGE_THRESHOLDS: Record<GrowthStageName, AdaptiveThresholds> = {
  dormant: {
    memoryExtractionInterval: 3,
    convergenceInterval: 10,
    proactiveCallbackThreshold: 5,
    identityExtractionEnabled: false,
    identityExtractionInterval: 0,
  },
  germinating: {
    memoryExtractionInterval: 3,
    convergenceInterval: 8,
    proactiveCallbackThreshold: 4,
    identityExtractionEnabled: false,
    identityExtractionInterval: 0,
  },
  growing: {
    memoryExtractionInterval: 2,
    convergenceInterval: 7,
    proactiveCallbackThreshold: 3,
    identityExtractionEnabled: true,
    identityExtractionInterval: 5,
  },
  mature: {
    memoryExtractionInterval: 1,
    convergenceInterval: 5,
    proactiveCallbackThreshold: 2,
    identityExtractionEnabled: true,
    identityExtractionInterval: 3,
  },
}

const DAY_MS = 86_400_000

export function emptyGrowthState(): GrowthState {
  return {
    stage: 'dormant',
    conversationCount: 0,
    firstSeenAt: 0,
    memoryItemCount: 0,
    convergenceInsightCount: 0,
    kgEntityCount: 0,
    computedAt: 0,
  }
}

/** Compute growth stage from observable signals. Pure function. */
export function computeGrowthStage(
  conversationCount: number,
  firstSeenAt: number,
  memoryItemCount: number,
  convergenceInsightCount: number,
  kgEntityCount: number,
): GrowthState {
  const now = Date.now()
  const daysSinceFirst = firstSeenAt > 0 ? (now - firstSeenAt) / DAY_MS : 0

  let stage: GrowthStageName = 'dormant'

  if (conversationCount >= 30 && convergenceInsightCount >= 3 && kgEntityCount >= 10) {
    stage = 'mature'
  } else if (conversationCount >= 6 && daysSinceFirst >= 5 && memoryItemCount >= 5) {
    stage = 'growing'
  } else if (conversationCount >= 2 && daysSinceFirst >= 1) {
    stage = 'germinating'
  }

  return {
    stage,
    conversationCount,
    firstSeenAt: firstSeenAt || now,
    memoryItemCount,
    convergenceInsightCount,
    kgEntityCount,
    computedAt: now,
  }
}

/** Get adaptive thresholds for the current stage */
export function getThresholds(stage: GrowthStageName): AdaptiveThresholds {
  return STAGE_THRESHOLDS[stage]
}

/** Format growth state for system prompt injection */
export function formatGrowthForPrompt(state: GrowthState): string {
  if (!state || state.stage === 'dormant') return ''

  const stageDescriptions: Record<GrowthStageName, string> = {
    dormant: '',
    germinating: 'You are still getting to know this person. Ask curious questions. Build the foundation.',
    growing: 'You know this person well enough to anticipate. Reference past patterns. Show continuity.',
    mature: 'You have a deep relationship with this person. Your understanding is rich. Be the companion who truly knows them.',
  }

  return stageDescriptions[state.stage]
}

// ── Serialization ─────────────────────────────────────────

export function serializeGrowthState(state: GrowthState): Record<string, unknown> {
  return { ...state }
}

export function deserializeGrowthState(data: Record<string, unknown> | null): GrowthState {
  if (!data || !data.stage) return emptyGrowthState()
  return {
    stage: (data.stage as GrowthStageName) || 'dormant',
    conversationCount: (data.conversationCount as number) || 0,
    firstSeenAt: (data.firstSeenAt as number) || 0,
    memoryItemCount: (data.memoryItemCount as number) || 0,
    convergenceInsightCount: (data.convergenceInsightCount as number) || 0,
    kgEntityCount: (data.kgEntityCount as number) || 0,
    computedAt: (data.computedAt as number) || 0,
  }
}
