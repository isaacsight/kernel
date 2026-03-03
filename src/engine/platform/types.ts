// ─── Platform Engine Types ──────────────────────────────────────
//
// Unified orchestrator that chains Content, Knowledge, Algorithm,
// and Social engines into end-to-end content workflows.

import type { ContentFormat, ContentStageState, AlgorithmScore, PublishTarget } from '../content/types'
import type { SocialPlatform, AdaptedContent } from '../social/types'

// ─── Phase Pipeline ──────────────────────────────────────────

export type PlatformPhase = 'brief' | 'create' | 'score' | 'adapt' | 'distribute' | 'monitor'
export type PlatformPhaseStatus = 'pending' | 'active' | 'awaiting_approval' | 'approved' | 'skipped' | 'failed'

export interface PlatformPhaseState {
  phase: PlatformPhase
  status: PlatformPhaseStatus
  output?: BriefPhaseOutput | CreatePhaseOutput | ScorePhaseOutput | AdaptPhaseOutput | DistributePhaseOutput | MonitorPhaseOutput
  startedAt?: number
  completedAt?: number
  error?: string
}

// ─── Phase Outputs ──────────────────────────────────────────

export interface BriefPhaseOutput {
  type: 'brief'
  angles: string[]
  selectedAngle: string
  enrichedBrief: string
  knowledgeContext: string[]
}

export interface CreatePhaseOutput {
  type: 'create'
  contentId: string
  title: string
  finalContent: string
  stages: ContentStageState[]
}

export interface ScorePhaseOutput {
  type: 'score'
  score: AlgorithmScore
  recommendations: PublishTarget[]
}

export interface AdaptPhaseOutput {
  type: 'adapt'
  adaptations: PlatformAdaptation[]
}

export interface PlatformAdaptation {
  platform: SocialPlatform
  accountId: string
  adapted: AdaptedContent
  approved: boolean
}

export interface DistributePhaseOutput {
  type: 'distribute'
  published: DistributeResult[]
  blogSlug?: string
}

export interface DistributeResult {
  platform: SocialPlatform | 'blog'
  postId?: string
  platformUrl?: string
  status: 'published' | 'scheduled' | 'failed'
  error?: string
}

export interface MonitorPhaseOutput {
  type: 'monitor'
  snapshots: MonitorSnapshot[]
}

export interface MonitorSnapshot {
  platform: SocialPlatform | 'blog'
  impressions: number
  likes: number
  reposts: number
  replies: number
  engagementRate: number
}

// ─── Workflow Configuration ──────────────────────────────────

export type PlatformWorkflowType = 'full' | 'create_and_publish' | 'score_existing' | 'republish' | 'analyze'

export interface PlatformWorkflowConfig {
  type: PlatformWorkflowType
  brief: string
  format: ContentFormat
  targetPlatforms: SocialPlatform[]
  autoApprovePhases: PlatformPhase[]
  existingContentId?: string
}

// ─── Callbacks ──────────────────────────────────────────────

export interface PlatformEngineCallbacks {
  onProgress: (phase: PlatformPhase, status: PlatformPhaseStatus, details?: string) => void
  onChunk?: (text: string) => void
  onPhaseUpdate?: (phases: PlatformPhaseState[]) => void
  onApprovalNeeded?: (phase: PlatformPhase, output: unknown) => void
  onContentStageUpdate?: (stages: ContentStageState[]) => void
  onContentApprovalNeeded?: (stage: string, output: string) => void
}

// ─── Workflow State ─────────────────────────────────────────

export type PlatformEngineState = 'idle' | 'running' | 'awaiting_phase_approval' | 'awaiting_content_approval' | 'completed' | 'failed' | 'cancelled'

export interface PlatformWorkflow {
  id: string
  userId: string
  config: PlatformWorkflowConfig
  phases: PlatformPhaseState[]
  state: PlatformEngineState
  contentId?: string
  createdAt: number
  updatedAt: number
}

// ─── Phase Configs ──────────────────────────────────────────

export interface PhaseConfig {
  phase: PlatformPhase
  autoApprove: boolean
  required: boolean
}

export const PHASE_CONFIGS: Record<PlatformWorkflowType, PhaseConfig[]> = {
  full: [
    { phase: 'brief',      autoApprove: false, required: true },
    { phase: 'create',     autoApprove: false, required: true },
    { phase: 'score',      autoApprove: true,  required: true },
    { phase: 'adapt',      autoApprove: false, required: true },
    { phase: 'distribute', autoApprove: false, required: true },
    { phase: 'monitor',    autoApprove: true,  required: false },
  ],
  create_and_publish: [
    { phase: 'brief',      autoApprove: false, required: true },
    { phase: 'create',     autoApprove: false, required: true },
    { phase: 'score',      autoApprove: true,  required: false },
    { phase: 'distribute', autoApprove: false, required: true },
  ],
  score_existing: [
    { phase: 'score',      autoApprove: true,  required: true },
    { phase: 'adapt',      autoApprove: false, required: false },
    { phase: 'distribute', autoApprove: false, required: false },
  ],
  republish: [
    { phase: 'adapt',      autoApprove: false, required: true },
    { phase: 'distribute', autoApprove: false, required: true },
    { phase: 'monitor',    autoApprove: true,  required: false },
  ],
  analyze: [
    { phase: 'score',      autoApprove: true,  required: true },
    { phase: 'monitor',    autoApprove: true,  required: true },
  ],
}
