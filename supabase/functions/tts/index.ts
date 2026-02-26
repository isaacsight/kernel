// Supabase Edge Function: tts
// Text-to-speech via OpenAI TTS API. Pro-only feature.
//
// Deploy: npx supabase functions deploy tts --project-ref eoxxpyixdieprsxlpwcs --no-verify-jwt

import { serve } from 'https://deno.land/std@0.177.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { corsHeaders, handlePreflight, SECURITY_HEADERS } from '../_shared/cors.ts'
import { checkRateLimit, rateLimitResponse } from '../_shared/rate-limit.ts'
import { logAudit, getClientIP, getUA } from '../_shared/audit.ts'

// ─── Configuration ──────────────────────────────────────
const MAX_TEXT_LENGTH = 4096
const ALLOWED_VOICES = new Set(['alloy', 'nova', 'echo', 'onyx', 'shimmer'])
const DEFAULT_VOICE = 'alloy'

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

    // Pro-only check: verify subscription or admin status
    const isAdmin = !!user.app_metadata?.is_admin
    if (!isAdmin) {
      const svcForSub = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, {
        auth: { persistSession: false, autoRefreshToken: false },
      })
      const { data: sub } = await svcForSub
        .from('subscriptions')
        .select('status')
        .eq('user_id', user.id)
        .eq('status', 'active')
        .maybeSingle()

      if (!sub) {
        return new Response(
          JSON.stringify({ error: 'pro_only', message: 'Text-to-speech is a Pro feature.' }),
          { status: 403, headers: { 'Content-Type': 'application/json', ...CORS_HEADERS } }
        )
      }
    }

    // Rate limit
    const svc = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, {
      auth: { persistSession: false, autoRefreshToken: false },
    })
    const rlCheck = await checkRateLimit(svc, user.id, 'tts', 'pro')
    if (!rlCheck.allowed) return rateLimitResponse(rlCheck, CORS_HEADERS)

    // Parse body
    const contentType = req.headers.get('content-type') || ''
    if (!contentType.includes('application/json')) {
      return new Response(
        JSON.stringify({ error: 'Expected application/json' }),
        { status: 400, headers: { 'Content-Type': 'application/json', ...CORS_HEADERS } }
      )
    }

    const body = await req.json()
    const { text, voice } = body as { text?: string; voice?: string }

    if (!text || typeof text !== 'string' || !text.trim()) {
      return new Response(
        JSON.stringify({ error: 'Missing or empty text field' }),
        { status: 400, headers: { 'Content-Type': 'application/json', ...CORS_HEADERS } }
      )
    }

    if (text.length > MAX_TEXT_LENGTH) {
      return new Response(
        JSON.stringify({ error: `Text too long (${text.length} chars). Max ${MAX_TEXT_LENGTH}.` }),
        { status: 400, headers: { 'Content-Type': 'application/json', ...CORS_HEADERS } }
      )
    }

    const selectedVoice = (voice && ALLOWED_VOICES.has(voice)) ? voice : DEFAULT_VOICE

    // Call OpenAI TTS API
    const openaiKey = Deno.env.get('OPENAI_API_KEY')
    if (!openaiKey) {
      console.error('OPENAI_API_KEY not configured')
      return new Response(
        JSON.stringify({ error: 'TTS service not configured' }),
        { status: 503, headers: { 'Content-Type': 'application/json', ...CORS_HEADERS } }
      )
    }

    const ttsRes = await fetch('https://api.openai.com/v1/audio/speech', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${openaiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'tts-1',
        input: text,
        voice: selectedVoice,
        response_format: 'mp3',
      }),
    })

    if (!ttsRes.ok) {
      const errBody = await ttsRes.text()
      console.error('OpenAI TTS error:', ttsRes.status, errBody)
      return new Response(
        JSON.stringify({ error: 'TTS synthesis failed' }),
        { status: 502, headers: { 'Content-Type': 'application/json', ...CORS_HEADERS } }
      )
    }

    // Audit log
    logAudit(svc, {
      actorId: user.id, eventType: 'edge_function.call', action: 'tts',
      source: 'tts', status: 'success', statusCode: 200,
      metadata: { textLength: text.length, voice: selectedVoice },
      ip: getClientIP(req), userAgent: getUA(req),
    })

    // Stream the audio response back
    const audioData = await ttsRes.arrayBuffer()
    return new Response(audioData, {
      headers: {
        'Content-Type': 'audio/mpeg',
        'Content-Length': String(audioData.byteLength),
        ...CORS_HEADERS,
      },
    })
  } catch (error) {
    console.error('tts error:', error)
    return new Response(
      JSON.stringify({ error: 'TTS synthesis failed' }),
      { status: 500, headers: { 'Content-Type': 'application/json', ...CORS_HEADERS } }
    )
  }
})
