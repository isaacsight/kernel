// Supabase Edge Function: published-content
// Public endpoint — no auth required for reads.
// Returns published content items by slug for public-facing pages.
//
// Deploy: npx supabase functions deploy published-content --project-ref eoxxpyixdieprsxlpwcs --no-verify-jwt

import { serve } from 'https://deno.land/std@0.177.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { OPEN_CORS_HEADERS, SECURITY_HEADERS } from '../_shared/cors.ts'

const HEADERS = { ...OPEN_CORS_HEADERS, ...SECURITY_HEADERS }

// Simple IP-based rate limit: 60 requests per minute per IP
const ipCounts = new Map<string, { count: number; resetAt: number }>()

function checkIPRate(ip: string): boolean {
  const now = Date.now()
  const entry = ipCounts.get(ip)
  if (!entry || now > entry.resetAt) {
    ipCounts.set(ip, { count: 1, resetAt: now + 60_000 })
    return true
  }
  entry.count++
  return entry.count <= 60
}

serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: OPEN_CORS_HEADERS })
  }

  try {
    const url = new URL(req.url)
    const slug = url.searchParams.get('slug')

    if (!slug) {
      return new Response(JSON.stringify({ error: 'slug parameter required' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json', ...HEADERS },
      })
    }

    // Validate slug format
    if (!/^[a-z0-9][a-z0-9-]{0,80}$/.test(slug)) {
      return new Response(JSON.stringify({ error: 'Invalid slug format' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json', ...HEADERS },
      })
    }

    // Rate limit by IP
    const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim()
      || req.headers.get('cf-connecting-ip')
      || 'unknown'
    if (!checkIPRate(ip)) {
      return new Response(JSON.stringify({ error: 'rate_limited', retry_after: 60 }), {
        status: 429,
        headers: { 'Content-Type': 'application/json', 'Retry-After': '60', ...HEADERS },
      })
    }

    const svc = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
      { auth: { persistSession: false, autoRefreshToken: false } },
    )

    // Fetch published content
    const { data, error } = await svc
      .from('content_items')
      .select('id, title, slug, final_content, tags, format, meta_description, author_name, view_count, published_at, created_at')
      .eq('slug', slug)
      .eq('is_published', true)
      .single()

    if (error || !data) {
      return new Response(JSON.stringify({ error: 'Content not found' }), {
        status: 404,
        headers: { 'Content-Type': 'application/json', ...HEADERS },
      })
    }

    // Increment view count (fire-and-forget)
    svc.rpc('increment_published_view_count', { content_slug: slug }).catch(() => {})

    return new Response(JSON.stringify(data), {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
        'Cache-Control': 'public, max-age=60, s-maxage=300',
        ...HEADERS,
      },
    })

  } catch (error) {
    console.error('published-content error:', error)
    return new Response(JSON.stringify({ error: 'Internal server error' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json', ...HEADERS },
    })
  }
})
