// Shared rate limiting — calls check_rate_limit RPC with fail-open semantics
//
// Usage:
//   import { checkRateLimit, rateLimitResponse, RATE_LIMITS } from '../_shared/rate-limit.ts'
//
//   const rl = await checkRateLimit(svc, userId, 'claude-proxy', tier)
//   if (!rl.allowed) return rateLimitResponse(rl, CORS_HEADERS)

import { SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2'

export type Tier = 'free' | 'paid' | 'pro'

export interface RateLimitConfig {
  free: number
  paid: number
  pro: number
  windowSeconds?: number
}

export interface RateLimitResult {
  allowed: boolean
  current_count: number
  limit: number
  retry_after_seconds: number
}

/** Per-endpoint rate limit definitions (requests per window) */
export const RATE_LIMITS: Record<string, RateLimitConfig> = {
  'claude-proxy':       { free: 10, paid: 60,  pro: 120, windowSeconds: 60 },
  'web-search':         { free: 10, paid: 10,  pro: 20,  windowSeconds: 60 },
  'url-fetch':          { free: 20, paid: 20,  pro: 40,  windowSeconds: 60 },
  'evaluate-chat':      { free: 10, paid: 10,  pro: 20,  windowSeconds: 60 },
  'extract-insights':   { free: 5,  paid: 5,   pro: 10,  windowSeconds: 60 },
  'import-conversation':{ free: 5,  paid: 5,   pro: 10,  windowSeconds: 60 },
  'transcribe':         { free: 3,  paid: 3,   pro: 6,   windowSeconds: 60 },
  'mcp-proxy':          { free: 20, paid: 20,  pro: 40,  windowSeconds: 60 },
  'shared-conversation':{ free: 30, paid: 30,  pro: 30,  windowSeconds: 60 },
  'reset-user-data':    { free: 3,  paid: 3,   pro: 5,   windowSeconds: 3600 },
  'export-user-data':   { free: 1,  paid: 1,   pro: 1,   windowSeconds: 86400 },
  'identity-recovery':  { free: 10, paid: 10,  pro: 20,  windowSeconds: 300 },
  'tts':                { free: 0,  paid: 0,   pro: 10,  windowSeconds: 60 },
  'delete-account':     { free: 3,  paid: 3,   pro: 3,   windowSeconds: 86400 },
  'create-checkout':    { free: 5,  paid: 5,   pro: 10,  windowSeconds: 3600 },
  'create-portal':      { free: 5,  paid: 5,   pro: 10,  windowSeconds: 3600 },
}

/**
 * Check rate limit via Postgres RPC. Fail-open: if RPC errors, allow the request.
 */
export async function checkRateLimit(
  svc: SupabaseClient,
  key: string,
  endpoint: string,
  tier: Tier = 'free'
): Promise<RateLimitResult> {
  const config = RATE_LIMITS[endpoint]
  if (!config) return { allowed: true, current_count: 0, limit: 999, retry_after_seconds: 0 }

  const limit = config[tier]
  const windowSeconds = config.windowSeconds ?? 60

  try {
    const { data, error } = await svc.rpc('check_rate_limit', {
      p_key: key,
      p_endpoint: endpoint,
      p_limit: limit,
      p_window_seconds: windowSeconds,
    })

    if (error) {
      console.warn(`[rate-limit] RPC error for ${endpoint}: ${error.message}`)
      return { allowed: true, current_count: 0, limit, retry_after_seconds: 0 }
    }

    return data as RateLimitResult
  } catch (err) {
    console.warn(`[rate-limit] fail-open for ${endpoint}:`, err)
    return { allowed: true, current_count: 0, limit, retry_after_seconds: 0 }
  }
}

/**
 * Build a 429 response with Retry-After header.
 */
export function rateLimitResponse(
  result: RateLimitResult,
  corsHeaders: Record<string, string>
): Response {
  return new Response(
    JSON.stringify({
      error: 'rate_limited',
      retry_after: result.retry_after_seconds,
      limit: result.limit,
    }),
    {
      status: 429,
      headers: {
        'Content-Type': 'application/json',
        'Retry-After': String(result.retry_after_seconds),
        ...corsHeaders,
      },
    }
  )
}
