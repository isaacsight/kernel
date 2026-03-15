// Plan limits — Free (10 msgs/month) + Pro ($15/month, 200 msgs/month, $0.10 overage).

export type PlanId = 'free' | 'pro_monthly'

export interface PlanLimits {
  messagesPerMonth: number
  maxTokens: number
  memory: boolean
  goals: boolean
  briefings: boolean
  historyDays: number | null
  filesPerMonth: number
  convergence: boolean
  workflows: boolean
  research: boolean
  extendedThinking: boolean
  webSearch: boolean
  overageRate: number // cents per message (0 = no overage)
}

export const PLAN_LIMITS: Record<PlanId, PlanLimits> = {
  free: {
    messagesPerMonth: 10,
    maxTokens: 4096,
    memory: false,
    goals: false,
    briefings: false,
    historyDays: 3,
    filesPerMonth: 0,
    convergence: false,
    workflows: false,
    research: false,
    extendedThinking: false,
    webSearch: false,
    overageRate: 0,
  },
  pro_monthly: {
    messagesPerMonth: 200,
    maxTokens: 8192,
    memory: true,
    goals: true,
    briefings: true,
    historyDays: null,
    filesPerMonth: 10,
    convergence: true,
    workflows: true,
    research: true,
    extendedThinking: true,
    webSearch: true,
    overageRate: 10, // $0.10
  },
}

export function resolvePlanId(sub: { status: string; plan?: string } | null): PlanId {
  if (!sub || !['active', 'trialing', 'past_due'].includes(sub.status)) return 'free'
  return 'pro_monthly'
}
