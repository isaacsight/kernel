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
}

export const PLAN_LIMITS: Record<PlanId, PlanLimits> = {
  free: {
    messagesPerMonth: 20, messagesPerDay: 5, maxTokens: 500,
    memory: false, goals: false, briefings: false,
    briefingHistoryDays: 3, etPerMonth: 0,
    filesPerMonth: 0, historyDays: 3,
  },
  pro_monthly: {
    messagesPerMonth: 1000, messagesPerDay: 100, maxTokens: 8192,
    memory: true, goals: true, briefings: true,
    briefingHistoryDays: null, etPerMonth: 30,
    filesPerMonth: 10, historyDays: null,
  },
  pro_annual: {
    messagesPerMonth: 1500, messagesPerDay: 100, maxTokens: 8192,
    memory: true, goals: true, briefings: true,
    briefingHistoryDays: null, etPerMonth: 45,
    filesPerMonth: 10, historyDays: null,
  },
  max_monthly: {
    messagesPerMonth: 6000, messagesPerDay: 200, maxTokens: 8192,
    memory: true, goals: true, briefings: true,
    briefingHistoryDays: null, etPerMonth: 100,
    filesPerMonth: 50, historyDays: null,
  },
  max_annual: {
    messagesPerMonth: 6000, messagesPerDay: 200, maxTokens: 8192,
    memory: true, goals: true, briefings: true,
    briefingHistoryDays: null, etPerMonth: 100,
    filesPerMonth: 50, historyDays: null,
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
