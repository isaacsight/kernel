// Plan limits — single source of truth for the 2-tier subscription system.
// Free: 10 msgs/month (Haiku). Pro: 200 msgs/month (Sonnet), $0.10 overage.
// Frontend mirror: src/config/planLimits.ts (must stay in sync)

export type PlanId = 'free' | 'pro_monthly'

export interface PlanLimits {
  messagesPerMonth: number
  messagesPerDay: number
  maxTokens: number
  memory: boolean
  goals: boolean
  briefings: boolean
  briefingHistoryDays: number | null
  etPerMonth: number
  filesPerMonth: number
  historyDays: number | null
  contentPerMonth: number
  socialAccountsMax: number
  socialPostsPerMonth: number
  knowledgeItems: number
  knowledgeDocsPerMonth: number
  knowledgeAutoRetrieval: number
  knowledgeQueries: boolean
  platformWorkflowsPerMonth: number
  overageRateCents: number // cents per overage message (0 = no overage)
}

export const PLAN_LIMITS: Record<PlanId, PlanLimits> = {
  free: {
    messagesPerMonth: 10, messagesPerDay: 10, maxTokens: 4096,
    memory: false, goals: false, briefings: false,
    briefingHistoryDays: 3, etPerMonth: 0,
    filesPerMonth: 0, historyDays: 3,
    contentPerMonth: 0,
    socialAccountsMax: 0, socialPostsPerMonth: 0,
    knowledgeItems: 0, knowledgeDocsPerMonth: 0, knowledgeAutoRetrieval: 0, knowledgeQueries: false,
    platformWorkflowsPerMonth: 0,
    overageRateCents: 0,
  },
  pro_monthly: {
    messagesPerMonth: 200, messagesPerDay: 200, maxTokens: 8192,
    memory: true, goals: true, briefings: true,
    briefingHistoryDays: null, etPerMonth: 30,
    filesPerMonth: 10, historyDays: null,
    contentPerMonth: 10,
    socialAccountsMax: 3, socialPostsPerMonth: 30,
    knowledgeItems: 5000, knowledgeDocsPerMonth: 20, knowledgeAutoRetrieval: 5, knowledgeQueries: true,
    platformWorkflowsPerMonth: 5,
    overageRateCents: 10, // $0.10 per message
  },
}

/** Statuses that grant Pro access (active subscription or trial period). */
export const ACTIVE_STATUSES = ['active', 'trialing']

export function resolvePlanId(sub: { status: string; plan?: string } | null): PlanId {
  if (!sub || !ACTIVE_STATUSES.includes(sub.status)) return 'free'
  return 'pro_monthly'
}
