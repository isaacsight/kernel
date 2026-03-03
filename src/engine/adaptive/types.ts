// ─── Adaptive Engine Types ──────────────────────────────────────
//
// Self-improving intelligence layer. Observes every interaction,
// builds a model of what works for each user, and feeds hints
// back into prompt engineering to make responses progressively better.

// ─── Signal Types ───────────────────────────────────────────

export type AdaptiveSignalType =
  | 'thumbs_up'
  | 'thumbs_down'
  | 'edit'
  | 'retry'
  | 'copy'
  | 'share'
  | 'ignore'
  | 'expand'
  | 'follow_up'

export interface AdaptiveSignal {
  id: string
  userId: string
  type: AdaptiveSignalType
  messageId?: string
  agentId?: string
  engineId?: string
  context?: Record<string, unknown>
  timestamp: number
}

// ─── User Adaptive Profile ──────────────────────────────────

export interface ResponsePreferences {
  preferredLength: 'concise' | 'moderate' | 'detailed'
  preferredTone: 'casual' | 'balanced' | 'formal'
  preferredDetail: 'high-level' | 'moderate' | 'granular'
  preferredFormat: 'prose' | 'structured' | 'mixed'
}

export interface AdaptiveProfile {
  userId: string
  responsePreferences: ResponsePreferences
  agentPreferences: Record<string, number>
  topicAffinities: Record<string, number>
  satisfactionTrend: number[]
  lastUpdated: number
}

// ─── A/B Experiments ────────────────────────────────────────

export type ExperimentStatus = 'draft' | 'running' | 'paused' | 'completed'

export interface ExperimentVariant {
  id: string
  name: string
  config: Record<string, unknown>
  sampleSize: number
  successRate: number
}

export interface Experiment {
  id: string
  name: string
  description: string
  variants: ExperimentVariant[]
  status: ExperimentStatus
  startedAt?: number
  completedAt?: number
  winningVariant?: string
}

// ─── Insights ───────────────────────────────────────────────

export type InsightType = 'pattern' | 'anomaly' | 'recommendation' | 'trend'

export interface AdaptiveInsight {
  id: string
  type: InsightType
  title: string
  description: string
  confidence: number
  data?: Record<string, unknown>
  createdAt: number
}

// ─── Quality Metrics ────────────────────────────────────────

export interface QualityMetrics {
  responseQuality: number
  userSatisfaction: number
  agentAccuracy: number
  engineEfficiency: number
  adaptationRate: number
}

// ─── Response Hints ─────────────────────────────────────────

export interface ResponseHints {
  preferredLength: ResponsePreferences['preferredLength']
  preferredTone: ResponsePreferences['preferredTone']
  preferredDetail: ResponsePreferences['preferredDetail']
  preferredFormat: ResponsePreferences['preferredFormat']
  topAgents: string[]
  recentSatisfaction: number
  suggestions: string[]
}

// ─── Adaptation History Entry ───────────────────────────────

export interface AdaptationHistoryEntry {
  timestamp: number
  field: string
  oldValue: unknown
  newValue: unknown
  reason: string
}

// ─── Callbacks ──────────────────────────────────────────────

export interface AdaptiveEngineCallbacks {
  onSignalRecorded?: (signal: AdaptiveSignal) => void
  onProfileUpdated?: (profile: AdaptiveProfile) => void
  onInsightDiscovered?: (insight: AdaptiveInsight) => void
  onExperimentUpdate?: (experiment: Experiment) => void
}
