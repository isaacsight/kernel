// ═══════════════════════════════════════════════════════════════
//  Pricing Engine — Type Definitions
// ═══════════════════════════════════════════════════════════════

export type FeatureTag =
  | 'chat'
  | 'routing'
  | 'swarm'
  | 'swarm_synthesis'
  | 'research'
  | 'workflow'
  | 'memory_extraction'
  | 'convergence'
  | 'task_planning'
  | 'content_pipeline'
  | 'algorithm_scoring'
  | 'platform_workflow'
  | 'knowledge_ingestion'
  | 'briefing'
  | 'master_agent'
  | 'evaluation'
  | 'image_generation'

// ─── User-facing types ──────────────────────────────────────

export interface FeatureCostBreakdown {
  feature: FeatureTag
  cost: number
  requests: number
  input_tokens: number
  output_tokens: number
}

export interface DailyTrend {
  date: string
  cost: number
  requests: number
}

export interface UserCostSummary {
  user_id: string
  days: number
  total_cost: number
  total_input_tokens: number
  total_output_tokens: number
  total_requests: number
  by_feature: FeatureCostBreakdown[]
  daily_trend: DailyTrend[]
}

export interface FeatureForecast {
  feature: FeatureTag
  requests: number
  cost: number
  daily_avg: number
}

export interface WeeklyTrend {
  week: string
  requests: number
  cost: number
}

export interface UsageForecast {
  user_id: string
  period_days: number
  active_days: number
  total_requests: number
  total_cost: number
  daily_avg_requests: number
  projected_monthly_requests: number
  projected_monthly_cost: number
  by_feature: FeatureForecast[]
  weekly_trend: WeeklyTrend[]
}

export interface TierRecommendation {
  current_plan: string
  recommended_plan: string
  reason: string
  usage_ratio: number
  projected_savings: number | null
  feature_gaps: string[]
}

// ─── Admin-facing types ─────────────────────────────────────

export interface PlatformFeatureCost {
  feature: FeatureTag
  cost: number
  requests: number
  pct: number
}

export interface ModelCost {
  model: string
  cost: number
  requests: number
}

export interface TopUser {
  user_id: string
  cost: number
  requests: number
  email?: string
}

export interface PlatformDailyTrend {
  date: string
  cost: number
  requests: number
  users: number
}

export interface PlatformCostAnalytics {
  days: number
  total_cost: number
  total_requests: number
  total_input_tokens: number
  total_output_tokens: number
  unique_users: number
  by_feature: PlatformFeatureCost[]
  by_model: ModelCost[]
  top_users: TopUser[]
  daily_trend: PlatformDailyTrend[]
}
