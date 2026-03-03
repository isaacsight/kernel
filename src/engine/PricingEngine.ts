// ═══════════════════════════════════════════════════════════════
//  Pricing Engine — Client
// ═══════════════════════════════════════════════════════════════

import { getAccessToken } from './SupabaseClient'
import type {
  UserCostSummary,
  UsageForecast,
  TierRecommendation,
  PlatformCostAnalytics,
} from './pricing/types'

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL || 'https://eoxxpyixdieprsxlpwcs.supabase.co'
const SUPABASE_KEY = import.meta.env.VITE_SUPABASE_KEY || ''
const PRICING_URL = `${SUPABASE_URL}/functions/v1/pricing-engine`

async function callPricingEngine<T>(action: string, params?: Record<string, unknown>): Promise<T> {
  const token = await getAccessToken()
  const res = await fetch(PRICING_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
      apikey: SUPABASE_KEY,
    },
    body: JSON.stringify({ action, ...params }),
  })

  if (!res.ok) {
    const err = await res.text()
    throw new Error(`Pricing engine error (${res.status}): ${err}`)
  }

  return res.json()
}

export async function getUserCostSummary(days = 30): Promise<UserCostSummary> {
  return callPricingEngine<UserCostSummary>('get_user_cost_summary', { days })
}

export async function getUsageForecast(): Promise<UsageForecast> {
  return callPricingEngine<UsageForecast>('get_usage_forecast')
}

export async function getTierRecommendation(): Promise<TierRecommendation> {
  return callPricingEngine<TierRecommendation>('get_tier_recommendation')
}

export async function getPlatformAnalytics(days = 30): Promise<PlatformCostAnalytics> {
  return callPricingEngine<PlatformCostAnalytics>('get_platform_analytics', { days })
}
