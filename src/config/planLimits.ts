// Plan limits — single free tier, 10 messages per day.
// No paid tiers. No subscriptions.

export type PlanId = 'free'

export interface PlanLimits {
  messagesPerDay: number
  maxTokens: number
  memory: boolean
  goals: boolean
  briefings: boolean
  historyDays: number | null
}

export const PLAN_LIMITS: Record<PlanId, PlanLimits> = {
  free: {
    messagesPerDay: 10,
    maxTokens: 4096,
    memory: true,
    goals: false,
    briefings: false,
    historyDays: null,
  },
}

export function resolvePlanId(_sub: unknown): PlanId {
  return 'free'
}
