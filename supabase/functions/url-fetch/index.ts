// Supabase Edge Function: url-fetch
// Fetches a URL and returns extracted text content.
//
// Deploy: npx supabase functions deploy url-fetch --project-ref eoxxpyixdieprsxlpwcs

import { serve } from 'https://deno.land/std@0.177.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { corsHeaders, handlePreflight, SECURITY_HEADERS } from '../_shared/cors.ts'

const MAX_CONTENT_LENGTH = 12000

// ─── Per-user rate limiting ──────────────────────────────
const RATE_LIMIT_WINDOW_MS = 60_000
const RATE_LIMIT_MAX = 20 // 20 fetches per minute per user
const fetchRateLimitMap = new Map<string, number[]>()

function checkFetchRateLimit(userId: string): { allowed: boolean; retryAfter: number } {
  const now = Date.now()
  const timestamps = (fetchRateLimitMap.get(userId) || []).filter(t => now - t < RATE_LIMIT_WINDOW_MS)
  if (timestamps.length >= RATE_LIMIT_MAX) {
    return { allowed: false, retryAfter: Math.ceil((timestamps[0] + RATE_LIMIT_WINDOW_MS - now) / 1000) }
  }
  timestamps.push(now)
  fetchRateLimitMap.set(userId, timestamps)
  return { allowed: true, retryAfter: 0 }
}

setInterval(() => {
  const now = Date.now()
  for (const [key, ts] of fetchRateLimitMap) {
    const recent = ts.filter(t => now - t < RATE_LIMIT_WINDOW_MS)
    if (recent.length === 0) fetchRateLimitMap.delete(key)
    else fetchRateLimitMap.set(key, recent)
  }
}, 300_000)

// Block private/internal IPs to prevent SSRF
const BLOCKED_HOSTS = [
  /^localhost$/i,
  /^127\./,
  /^10\./,
  /^172\.(1[6-9]|2\d|3[01])\./,
  /^192\.168\./,
  /^0\./,
  /^169\.254\./,
  /^\[::1\]/,
  /^\[fc/i,
  /^\[fd/i,
  /^\[fe80/i,
]

function htmlToText(html: string): string {
  // Extract Open Graph / meta tags first (useful for social media)
  const ogTitle = html.match(/<meta[^>]*property="og:title"[^>]*content="([^"]*)"/) ||
                  html.match(/<meta[^>]*content="([^"]*)"[^>]*property="og:title"/)
  const ogDesc = html.match(/<meta[^>]*property="og:description"[^>]*content="([^"]*)"/) ||
                 html.match(/<meta[^>]*content="([^"]*)"[^>]*property="og:description"/)
  const title = html.match(/<title[^>]*>([^<]*)<\/title>/i)

  let meta = ''
  if (ogTitle?.[1] || title?.[1]) meta += `Title: ${ogTitle?.[1] || title?.[1]}\n`
  if (ogDesc?.[1]) meta += `Description: ${ogDesc?.[1]}\n`

  // Remove script, style, nav, header, footer tags and their content
  let text = html
    .replace(/<script[\s\S]*?<\/script>/gi, '')
    .replace(/<style[\s\S]*?<\/style>/gi, '')
    .replace(/<nav[\s\S]*?<\/nav>/gi, '')
    .replace(/<header[\s\S]*?<\/header>/gi, '')
    .replace(/<footer[\s\S]*?<\/footer>/gi, '')

  // Convert common block elements to newlines
  text = text.replace(/<\/(p|div|h[1-6]|li|tr|br\s*\/?)>/gi, '\n')
  text = text.replace(/<br\s*\/?>/gi, '\n')

  // Strip remaining HTML tags
  text = text.replace(/<[^>]+>/g, ' ')

  // Decode common HTML entities
  text = text
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&nbsp;/g, ' ')
    .replace(/&#x27;/g, "'")
    .replace(/&#x2F;/g, '/')

  // Clean up whitespace
  text = text.replace(/[ \t]+/g, ' ')
  text = text.replace(/\n\s*\n/g, '\n\n')
  text = text.trim()

  const result = meta ? `${meta}\n---\n${text}` : text
  return result.slice(0, MAX_CONTENT_LENGTH)
}

serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return handlePreflight(req)
  }

  const CORS_HEADERS = { ...corsHeaders(req), ...SECURITY_HEADERS }

  try {
    // ── Auth: verify JWT ────────────────────────────────
    const token = req.headers.get('authorization')?.replace('Bearer ', '')
    if (!token) {
      return new Response(
        JSON.stringify({ error: 'Missing authorization header' }),
        { status: 401, headers: { 'Content-Type': 'application/json', ...CORS_HEADERS } }
      )
    }

    const supabase = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_ANON_KEY')!)
    const { data: { user }, error: authError } = await supabase.auth.getUser(token)
    if (authError || !user) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        { status: 401, headers: { 'Content-Type': 'application/json', ...CORS_HEADERS } }
      )
    }

    // ── Rate limit ──────────────────────────────────────
    const rateCheck = checkFetchRateLimit(user.id)
    if (!rateCheck.allowed) {
      return new Response(
        JSON.stringify({ error: 'rate_limited', retry_after: rateCheck.retryAfter }),
        { status: 429, headers: { 'Content-Type': 'application/json', 'Retry-After': String(rateCheck.retryAfter), ...CORS_HEADERS } }
      )
    }

    const { url, raw } = await req.json()
    if (!url || typeof url !== 'string') {
      return new Response(
        JSON.stringify({ error: 'url is required' }),
        { status: 400, headers: { 'Content-Type': 'application/json', ...CORS_HEADERS } }
      )
    }

    // ── SSRF protection: block private/internal IPs ─────
    try {
      const parsed = new URL(url)
      if (BLOCKED_HOSTS.some(re => re.test(parsed.hostname))) {
        return new Response(
          JSON.stringify({ error: 'URL points to a blocked host' }),
          { status: 400, headers: { 'Content-Type': 'application/json', ...CORS_HEADERS } }
        )
      }
      if (!['http:', 'https:'].includes(parsed.protocol)) {
        return new Response(
          JSON.stringify({ error: 'Only HTTP/HTTPS URLs are allowed' }),
          { status: 400, headers: { 'Content-Type': 'application/json', ...CORS_HEADERS } }
        )
      }
    } catch {
      return new Response(
        JSON.stringify({ error: 'Invalid URL' }),
        { status: 400, headers: { 'Content-Type': 'application/json', ...CORS_HEADERS } }
      )
    }

    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; KernelBot/1.0)',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
      },
      redirect: 'follow',
    })

    if (!response.ok) {
      return new Response(
        JSON.stringify({ error: `Failed to fetch URL (${response.status})`, text: '' }),
        { headers: { 'Content-Type': 'application/json', ...CORS_HEADERS } }
      )
    }

    const contentType = response.headers.get('content-type') || ''
    const body = await response.text()

    // If raw mode requested, return the HTML directly (capped at 100KB for share pages)
    if (raw) {
      const MAX_RAW = 100_000
      return new Response(
        JSON.stringify({ html: body.slice(0, MAX_RAW), url }),
        { headers: { 'Content-Type': 'application/json', ...CORS_HEADERS } }
      )
    }

    let text: string
    if (contentType.includes('text/html') || contentType.includes('application/xhtml')) {
      text = htmlToText(body)
    } else {
      // Plain text, JSON, XML, etc. — return as-is (trimmed)
      text = body.slice(0, MAX_CONTENT_LENGTH)
    }

    return new Response(
      JSON.stringify({ text, url }),
      { headers: { 'Content-Type': 'application/json', ...CORS_HEADERS } }
    )
  } catch (error) {
    console.error('url-fetch error:', error)
    return new Response(
      JSON.stringify({ error: 'Failed to fetch URL', text: '' }),
      { status: 500, headers: { 'Content-Type': 'application/json', ...CORS_HEADERS } }
    )
  }
})
