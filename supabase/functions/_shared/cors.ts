// Shared CORS + security headers for Supabase Edge Functions
//
// Usage:
//   import { corsHeaders, handlePreflight, SECURITY_HEADERS } from '../_shared/cors.ts'
//
//   // In serve handler:
//   if (req.method === 'OPTIONS') return handlePreflight(req)
//   // In responses:
//   { headers: { 'Content-Type': 'application/json', ...corsHeaders(req), ...SECURITY_HEADERS } }

const ALLOWED_ORIGINS = new Set([
  'https://kernel.chat',
  'https://www.kernel.chat',
])

function isAllowedOrigin(origin: string): boolean {
  return ALLOWED_ORIGINS.has(origin) || /^https?:\/\/localhost(:\d+)?$/.test(origin)
}

/**
 * Returns CORS headers with origin validation.
 * For browser requests from allowed origins, reflects the origin.
 * For non-browser requests (no Origin header), uses production origin.
 */
export function corsHeaders(req: Request): Record<string, string> {
  const origin = req.headers.get('origin') || ''
  return {
    'Access-Control-Allow-Origin': isAllowedOrigin(origin) ? origin : 'https://kernel.chat',
    'Access-Control-Allow-Methods': 'POST',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    'Vary': 'Origin',
  }
}

/** Handle CORS preflight with origin-validated headers */
export function handlePreflight(req: Request): Response {
  return new Response('ok', { headers: corsHeaders(req) })
}

/** Security headers to include on all responses */
export const SECURITY_HEADERS: Record<string, string> = {
  'X-Content-Type-Options': 'nosniff',
  'X-Frame-Options': 'DENY',
}

/**
 * Open CORS headers for public endpoints (shared conversations, webhooks)
 * or service-internal functions where origin doesn't matter.
 */
export const OPEN_CORS_HEADERS: Record<string, string> = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, GET, OPTIONS',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, stripe-signature',
}
