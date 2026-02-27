// Supabase Edge Function: url-fetch
// Fetches a URL and returns extracted text content.
//
// Deploy: npx supabase functions deploy url-fetch --project-ref eoxxpyixdieprsxlpwcs

import { serve } from 'https://deno.land/std@0.177.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { corsHeaders, handlePreflight, SECURITY_HEADERS } from '../_shared/cors.ts'
import { checkRateLimit, rateLimitResponse, type Tier } from '../_shared/rate-limit.ts'
import { logAudit, getClientIP, getUA } from '../_shared/audit.ts'
import { requireContentType, checkSSRF } from '../_shared/validate.ts'

const MAX_CONTENT_LENGTH = 12000

// ── oEmbed: YouTube & Spotify link intelligence ──────────────

function isYouTubeUrl(url: string): boolean {
  return /(?:youtube\.com\/(?:watch|shorts)|youtu\.be\/|music\.youtube\.com\/watch)/.test(url)
}

function isSpotifyUrl(url: string): boolean {
  return /open\.spotify\.com\/(track|album|playlist|artist|episode|show)\//.test(url)
}

async function fetchOEmbed(oembedUrl: string): Promise<Record<string, unknown> | null> {
  try {
    const res = await fetch(oembedUrl)
    if (!res.ok) return null
    return await res.json()
  } catch {
    return null
  }
}

async function fetchYouTubeInfo(url: string): Promise<string | null> {
  const data = await fetchOEmbed(`https://www.youtube.com/oembed?url=${encodeURIComponent(url)}&format=json`)
  if (!data?.title) return null
  let text = `YouTube Video: ${data.title}`
  if (data.author_name) text += `\nChannel: ${data.author_name}`
  if (data.author_url) text += `\nChannel URL: ${data.author_url}`
  return text
}

async function fetchSpotifyInfo(url: string): Promise<string | null> {
  const data = await fetchOEmbed(`https://open.spotify.com/oembed?url=${encodeURIComponent(url)}&format=json`)
  if (!data?.title) return null
  // Detect type from URL path
  const typeMatch = url.match(/open\.spotify\.com\/(track|album|playlist|artist|episode|show)\//)
  const type = typeMatch ? typeMatch[1].charAt(0).toUpperCase() + typeMatch[1].slice(1) : 'Content'
  let text = `Spotify ${type}: ${data.title}`
  if (data.description) text += `\nDescription: ${data.description}`
  return text
}

// ── HTML text extraction ─────────────────────────────────────

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

  // ── Content-Type check ──────────────────────────────
  const ctErr = requireContentType(req)
  if (ctErr) return ctErr(CORS_HEADERS)

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

    // ── Rate limit (Postgres RPC) ─────────────────────
    const svc = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, {
      auth: { persistSession: false, autoRefreshToken: false },
    })
    const rlCheck = await checkRateLimit(svc, user.id, 'url-fetch')
    if (!rlCheck.allowed) return rateLimitResponse(rlCheck, CORS_HEADERS)

    const { url } = await req.json()
    if (!url || typeof url !== 'string') {
      return new Response(
        JSON.stringify({ error: 'url is required' }),
        { status: 400, headers: { 'Content-Type': 'application/json', ...CORS_HEADERS } }
      )
    }

    // ── SSRF protection: block private/internal IPs ─────
    const ssrfErr = checkSSRF(url)
    if (ssrfErr) return ssrfErr(CORS_HEADERS)

    // ── oEmbed: YouTube & Spotify ─────────────────────
    if (isYouTubeUrl(url)) {
      const text = await fetchYouTubeInfo(url)
      if (text) {
        logAudit(svc, {
          actorId: user.id, eventType: 'edge_function.call', action: 'url-fetch',
          source: 'url-fetch', status: 'success', statusCode: 200,
          metadata: { url: url.substring(0, 200), handler: 'youtube-oembed' },
          ip: getClientIP(req), userAgent: getUA(req),
        })
        return new Response(
          JSON.stringify({ text, url }),
          { headers: { 'Content-Type': 'application/json', ...CORS_HEADERS } }
        )
      }
    }

    if (isSpotifyUrl(url)) {
      const text = await fetchSpotifyInfo(url)
      if (text) {
        logAudit(svc, {
          actorId: user.id, eventType: 'edge_function.call', action: 'url-fetch',
          source: 'url-fetch', status: 'success', statusCode: 200,
          metadata: { url: url.substring(0, 200), handler: 'spotify-oembed' },
          ip: getClientIP(req), userAgent: getUA(req),
        })
        return new Response(
          JSON.stringify({ text, url }),
          { headers: { 'Content-Type': 'application/json', ...CORS_HEADERS } }
        )
      }
    }

    // ── Generic fetch (fallback) ──────────────────────
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
    const raw = await response.text()

    let text: string
    if (contentType.includes('text/html') || contentType.includes('application/xhtml')) {
      text = htmlToText(raw)
    } else {
      // Plain text, JSON, XML, etc. — return as-is (trimmed)
      text = raw.slice(0, MAX_CONTENT_LENGTH)
    }

    // ── Audit log (fire-and-forget) ───────────────────
    logAudit(svc, {
      actorId: user.id, eventType: 'edge_function.call', action: 'url-fetch',
      source: 'url-fetch', status: 'success', statusCode: 200,
      metadata: { url: url.substring(0, 200) },
      ip: getClientIP(req), userAgent: getUA(req),
    })

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
