// Supabase Edge Function: transcribe
// Accepts audio file uploads and returns transcription via OpenAI Whisper API.
//
// Deploy: npx supabase functions deploy transcribe --project-ref eoxxpyixdieprsxlpwcs

import { serve } from 'https://deno.land/std@0.177.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { corsHeaders, handlePreflight, SECURITY_HEADERS } from '../_shared/cors.ts'

// ─── Configuration ──────────────────────────────────────
const FREE_MAX_SIZE = 2 * 1024 * 1024   // 2MB
const PRO_MAX_SIZE = 25 * 1024 * 1024    // 25MB
const ALLOWED_TYPES = new Set([
  'audio/mpeg', 'audio/mp3', 'audio/wav', 'audio/x-wav',
  'audio/mp4', 'audio/m4a', 'audio/x-m4a',
  'audio/ogg', 'audio/webm', 'audio/flac',
])
const ALLOWED_EXTENSIONS = new Set([
  'mp3', 'wav', 'ogg', 'm4a', 'webm', 'flac', 'mp4', 'mpeg', 'mpga',
])

// ─── Per-user rate limiting ────────────────────────────
const RATE_LIMIT_WINDOW_MS = 60_000
const RATE_LIMIT_MAX = 3
const rateLimitMap = new Map<string, number[]>()

function checkRateLimit(userId: string): { allowed: boolean; retryAfter: number } {
  const now = Date.now()
  const timestamps = (rateLimitMap.get(userId) || []).filter(t => now - t < RATE_LIMIT_WINDOW_MS)
  if (timestamps.length >= RATE_LIMIT_MAX) {
    return { allowed: false, retryAfter: Math.ceil((timestamps[0] + RATE_LIMIT_WINDOW_MS - now) / 1000) }
  }
  timestamps.push(now)
  rateLimitMap.set(userId, timestamps)
  return { allowed: true, retryAfter: 0 }
}

setInterval(() => {
  const now = Date.now()
  for (const [key, ts] of rateLimitMap) {
    const recent = ts.filter(t => now - t < RATE_LIMIT_WINDOW_MS)
    if (recent.length === 0) rateLimitMap.delete(key)
    else rateLimitMap.set(key, recent)
  }
}, 300_000)

// ─── Main handler ──────────────────────────────────────
serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return handlePreflight(req)
  }

  const CORS_HEADERS = { ...corsHeaders(req), ...SECURITY_HEADERS }

  try {
    // Auth
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

    // Rate limit
    const rateCheck = checkRateLimit(user.id)
    if (!rateCheck.allowed) {
      return new Response(
        JSON.stringify({ error: 'rate_limited', retry_after: rateCheck.retryAfter }),
        { status: 429, headers: { 'Content-Type': 'application/json', 'Retry-After': String(rateCheck.retryAfter), ...CORS_HEADERS } }
      )
    }

    // Parse multipart form data
    const contentType = req.headers.get('content-type') || ''
    if (!contentType.includes('multipart/form-data')) {
      return new Response(
        JSON.stringify({ error: 'Expected multipart/form-data' }),
        { status: 400, headers: { 'Content-Type': 'application/json', ...CORS_HEADERS } }
      )
    }

    const formData = await req.formData()
    const file = formData.get('file') as File | null
    if (!file) {
      return new Response(
        JSON.stringify({ error: 'No audio file provided' }),
        { status: 400, headers: { 'Content-Type': 'application/json', ...CORS_HEADERS } }
      )
    }

    // Validate file extension
    const ext = file.name.split('.').pop()?.toLowerCase() || ''
    if (!ALLOWED_EXTENSIONS.has(ext)) {
      return new Response(
        JSON.stringify({ error: `Unsupported audio format: .${ext}` }),
        { status: 400, headers: { 'Content-Type': 'application/json', ...CORS_HEADERS } }
      )
    }

    // Check subscription tier for size limits
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
    let isPro = false
    if (serviceKey) {
      const svc = createClient(Deno.env.get('SUPABASE_URL')!, serviceKey, {
        auth: { persistSession: false, autoRefreshToken: false },
      })
      const { data: sub } = await svc
        .from('subscriptions')
        .select('status')
        .eq('user_id', user.id)
        .eq('status', 'active')
        .maybeSingle()
      isPro = !!sub
    }

    const maxSize = isPro ? PRO_MAX_SIZE : FREE_MAX_SIZE
    if (file.size > maxSize) {
      return new Response(
        JSON.stringify({
          error: `File too large (${(file.size / 1048576).toFixed(1)}MB). Max ${(maxSize / 1048576).toFixed(0)}MB.`,
          upgrade: !isPro,
        }),
        { status: 413, headers: { 'Content-Type': 'application/json', ...CORS_HEADERS } }
      )
    }

    // Call OpenAI Whisper API
    const openaiKey = Deno.env.get('OPENAI_API_KEY')
    if (!openaiKey) {
      console.error('OPENAI_API_KEY not configured')
      return new Response(
        JSON.stringify({ error: 'Transcription service not configured' }),
        { status: 503, headers: { 'Content-Type': 'application/json', ...CORS_HEADERS } }
      )
    }

    const whisperForm = new FormData()
    whisperForm.append('file', file, file.name)
    whisperForm.append('model', 'whisper-1')
    whisperForm.append('response_format', 'verbose_json')

    const whisperRes = await fetch('https://api.openai.com/v1/audio/transcriptions', {
      method: 'POST',
      headers: { Authorization: `Bearer ${openaiKey}` },
      body: whisperForm,
    })

    if (!whisperRes.ok) {
      const errBody = await whisperRes.text()
      console.error('Whisper API error:', whisperRes.status, errBody)
      return new Response(
        JSON.stringify({ error: 'Transcription failed' }),
        { status: 502, headers: { 'Content-Type': 'application/json', ...CORS_HEADERS } }
      )
    }

    const result = await whisperRes.json()

    return new Response(
      JSON.stringify({
        text: result.text,
        duration_seconds: result.duration ?? null,
        language: result.language ?? null,
      }),
      { headers: { 'Content-Type': 'application/json', ...CORS_HEADERS } }
    )
  } catch (error) {
    console.error('transcribe error:', error)
    return new Response(
      JSON.stringify({ error: 'Transcription failed' }),
      { status: 500, headers: { 'Content-Type': 'application/json', ...CORS_HEADERS } }
    )
  }
})
