// Plan limits — single source of truth for the 3-tier subscription system.
// Frontend mirror: src/config/planLimits.ts (must stay in sync)

export type PlanId = 'free' | 'pro_monthly' | 'pro_annual' | 'max_monthly' | 'max_annual'

export interface PlanLimits {
  messagesPerMonth: number
  messagesPerDay: number
  maxTokens: number
  memory: boolean
  goals: boolean
  briefings: boolean          // full access (generate + discuss)
  briefingHistoryDays: number | null  // null = unlimited
  etPerMonth: number
  filesPerMonth: number
  historyDays: number | null  // null = unlimited
  contentPerMonth: number     // content pipeline runs
  socialAccountsMax: number   // max connected social accounts
  socialPostsPerMonth: number // max social posts per month
  knowledgeItems: number      // max knowledge base items
  knowledgeDocsPerMonth: number // doc uploads for knowledge ingestion
  knowledgeAutoRetrieval: number // top-N items injected in context (0 = disabled)
  knowledgeQueries: boolean   // explicit "what do I know?" queries
  platformWorkflowsPerMonth: number // end-to-end platform engine runs
}

export const PLAN_LIMITS: Record<PlanId, PlanLimits> = {
  free: {
    messagesPerMonth: 30, messagesPerDay: 10, maxTokens: 500,
    memory: false, goals: false, briefings: false,
    briefingHistoryDays: 3, etPerMonth: 0,
    filesPerMonth: 0, historyDays: 3,
    contentPerMonth: 0,
    socialAccountsMax: 0, socialPostsPerMonth: 0,
    knowledgeItems: 0, knowledgeDocsPerMonth: 0, knowledgeAutoRetrieval: 0, knowledgeQueries: false,
    platformWorkflowsPerMonth: 0,
  },
  pro_monthly: {
    messagesPerMonth: 1000, messagesPerDay: 100, maxTokens: 8192,
    memory: true, goals: true, briefings: true,
    briefingHistoryDays: null, etPerMonth: 30,
    filesPerMonth: 10, historyDays: null,
    contentPerMonth: 10,
    socialAccountsMax: 3, socialPostsPerMonth: 30,
    knowledgeItems: 5000, knowledgeDocsPerMonth: 20, knowledgeAutoRetrieval: 5, knowledgeQueries: true,
    platformWorkflowsPerMonth: 5,
  },
  pro_annual: {
    messagesPerMonth: 1000, messagesPerDay: 100, maxTokens: 8192,
    memory: true, goals: true, briefings: true,
    briefingHistoryDays: null, etPerMonth: 45,
    filesPerMonth: 10, historyDays: null,
    contentPerMonth: 15,
    socialAccountsMax: 5, socialPostsPerMonth: 50,
    knowledgeItems: 5000, knowledgeDocsPerMonth: 20, knowledgeAutoRetrieval: 5, knowledgeQueries: true,
    platformWorkflowsPerMonth: 8,
  },
  max_monthly: {
    messagesPerMonth: 6000, messagesPerDay: 500, maxTokens: 8192,
    memory: true, goals: true, briefings: true,
    briefingHistoryDays: null, etPerMonth: 100,
    filesPerMonth: 50, historyDays: null,
    contentPerMonth: 50,
    socialAccountsMax: 10, socialPostsPerMonth: 200,
    knowledgeItems: 50000, knowledgeDocsPerMonth: 100, knowledgeAutoRetrieval: 10, knowledgeQueries: true,
    platformWorkflowsPerMonth: 30,
  },
  max_annual: {
    messagesPerMonth: 6000, messagesPerDay: 500, maxTokens: 8192,
    memory: true, goals: true, briefings: true,
    briefingHistoryDays: null, etPerMonth: 100,
    filesPerMonth: 50, historyDays: null,
    contentPerMonth: 50,
    socialAccountsMax: 10, socialPostsPerMonth: 200,
    knowledgeItems: 50000, knowledgeDocsPerMonth: 100, knowledgeAutoRetrieval: 10, knowledgeQueries: true,
    platformWorkflowsPerMonth: 30,
  },
}

/** Statuses that grant Pro access (active subscription or trial period). */
export const ACTIVE_STATUSES = ['active', 'trialing']

export function resolvePlanId(sub: { status: string; plan?: string } | null): PlanId {
  if (!sub || !ACTIVE_STATUSES.includes(sub.status)) return 'free'
  if (sub.plan === 'max_annual') return 'max_annual'
  if (sub.plan === 'max_monthly') return 'max_monthly'
  return sub.plan === 'pro_annual' ? 'pro_annual' : 'pro_monthly'
}
