// ─── Content + Algorithm Engine Types ──────────────────────────
//
// Shared type definitions for the Content Engine (multi-stage pipeline)
// and Algorithm Engine (scoring, ranking, distribution intelligence).

// ─── Content Pipeline ──────────────────────────────────────────

export type ContentStage = 'ideation' | 'research' | 'outline' | 'draft' | 'edit' | 'publish'
export type ContentStageStatus = 'pending' | 'active' | 'awaiting_approval' | 'approved' | 'skipped' | 'failed'

export type ContentFormat =
  | 'blog_post'
  | 'newsletter'
  | 'twitter_thread'
  | 'linkedin_post'
  | 'essay'
  | 'documentation'
  | 'email_campaign'
  | 'landing_page'
  | 'press_release'
  | 'custom'

export interface ContentStageConfig {
  stage: ContentStage
  primaryAgent: string
  supportAgents: string[]
  autoApprove: boolean
  maxTokens: number
}

export const STAGE_CONFIGS: ContentStageConfig[] = [
  { stage: 'ideation',  primaryAgent: 'writer',     supportAgents: ['strategist', 'curator'], autoApprove: false, maxTokens: 1500 },
  { stage: 'research',  primaryAgent: 'researcher',  supportAgents: ['analyst'],              autoApprove: true,  maxTokens: 2048 },
  { stage: 'outline',   primaryAgent: 'analyst',     supportAgents: ['writer'],               autoApprove: false, maxTokens: 1500 },
  { stage: 'draft',     primaryAgent: 'writer',      supportAgents: [],                       autoApprove: false, maxTokens: 8192 },
  { stage: 'edit',      primaryAgent: 'analyst',     supportAgents: ['writer'],               autoApprove: false, maxTokens: 8192 },
  { stage: 'publish',   primaryAgent: 'strategist',  supportAgents: ['analyst'],              autoApprove: false, maxTokens: 2048 },
]

export interface ContentStageState {
  stage: ContentStage
  status: ContentStageStatus
  output?: string
  supportOutputs?: Record<string, string>
  userFeedback?: string
  startedAt?: number
  completedAt?: number
  error?: string
}

export interface ContentItem {
  id: string
  userId: string
  brief: string
  format: ContentFormat
  title?: string
  tags: string[]
  currentStage: ContentStage
  stages: ContentStageState[]
  finalContent?: string
  createdAt: number
  updatedAt: number
  // Publishing fields
  isPublished?: boolean
  publishedAt?: number
  slug?: string
  metaDescription?: string
  authorName?: string
  viewCount?: number
}

export interface ContentVersion {
  id: string
  contentId: string
  stage: ContentStage
  content: string
  metadata: Record<string, unknown>
  createdAt: number
}

// ─── Content Pipeline Callbacks ────────────────────────────────

export interface ContentPipelineEvent {
  type: 'content_progress'
  stage: ContentStage
  status: ContentStageStatus
  details?: string
  timestamp: number
}

export interface ContentPipelineCallbacks {
  onProgress: (event: ContentPipelineEvent) => void
  onChunk?: (text: string) => void
  onStageUpdate?: (stages: ContentStageState[]) => void
  onApprovalNeeded?: (stage: ContentStage, output: string) => void
}

// ─── Algorithm Engine ──────────────────────────────────────────

export type ScoreDimension = 'relevance' | 'quality' | 'userAffinity' | 'freshness' | 'trendAlignment'

export interface DimensionScore {
  dimension: ScoreDimension
  score: number       // 0.0 - 1.0
  weight: number      // 0.0 - 1.0 (sums to 1.0 across dimensions)
  reasoning?: string
}

export interface AlgorithmScore {
  contentId: string
  composite: number   // weighted sum
  dimensions: DimensionScore[]
  scoredAt: number
}

export const DEFAULT_WEIGHTS: Record<ScoreDimension, number> = {
  relevance:      0.30,
  quality:        0.25,
  userAffinity:   0.20,
  freshness:      0.15,
  trendAlignment: 0.10,
}

export interface AlgorithmWeights {
  userId: string
  weights: Record<ScoreDimension, number>
  updatedAt: number
  learningRate: number  // EMA alpha, default 0.1
}

export interface SignalSource {
  type: 'topic_fit' | 'audience_match' | 'voice_alignment' | 'trend_data' | 'quality_markers'
  data: string
  confidence: number
  source: string
}

export type PublishPlatform = 'blog' | 'twitter' | 'linkedin' | 'newsletter' | 'medium' | 'substack'

export interface PublishTarget {
  platform: PublishPlatform
  score: number
  reasoning: string
  bestTime?: string
  formatNotes?: string
}

export interface PerformanceMetric {
  platform: PublishPlatform
  metric: string        // e.g. 'views', 'likes', 'shares', 'clicks', 'conversions'
  value: number
  recordedAt: number
}

export interface AlgorithmFeedback {
  contentId: string
  predictedScore: number
  actualPerformance: number  // normalized 0-1
  weightDelta: Record<ScoreDimension, number>
  createdAt: number
}

export interface AlgorithmCallbacks {
  onProgress?: (step: string, details?: string) => void
  onScoreUpdate?: (score: AlgorithmScore) => void
}
