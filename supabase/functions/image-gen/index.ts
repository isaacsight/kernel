// Supabase Edge Function: image-gen
// AI image generation via Google Gemini (gemini-3.1-flash-image-preview). Pro-only feature.
//
// Deploy: npx supabase functions deploy image-gen --project-ref eoxxpyixdieprsxlpwcs --no-verify-jwt

import { serve } from 'https://deno.land/std@0.177.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { corsHeaders, handlePreflight, SECURITY_HEADERS } from '../_shared/cors.ts'
import { checkRateLimit, rateLimitResponse } from '../_shared/rate-limit.ts'
import { logAudit, getClientIP, getUA } from '../_shared/audit.ts'

// ─── Configuration ──────────────────────────────────────
const MAX_PROMPT_LENGTH = 2000
const GEMINI_MODEL = 'gemini-2.5-flash-image'
const GEMINI_API_BASE = 'https://generativelanguage.googleapis.com/v1beta/models'
const ESTIMATED_COST_USD = 0

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
          JSON.stringify({ error: 'pro_only', message: 'Image generation is a Pro feature.' }),
          { status: 403, headers: { 'Content-Type': 'application/json', ...CORS_HEADERS } }
        )
      }
    }

    // Rate limit
    const svc = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, {
      auth: { persistSession: false, autoRefreshToken: false },
    })
    const rlCheck = await checkRateLimit(svc, user.id, 'image-gen', 'pro')
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
    const { prompt } = body as { prompt?: string }

    if (!prompt || typeof prompt !== 'string' || !prompt.trim()) {
      return new Response(
        JSON.stringify({ error: 'Missing or empty prompt field' }),
        { status: 400, headers: { 'Content-Type': 'application/json', ...CORS_HEADERS } }
      )
    }

    if (prompt.length > MAX_PROMPT_LENGTH) {
      return new Response(
        JSON.stringify({ error: `Prompt too long (${prompt.length} chars). Max ${MAX_PROMPT_LENGTH}.` }),
        { status: 400, headers: { 'Content-Type': 'application/json', ...CORS_HEADERS } }
      )
    }

    // Call Gemini Image Generation API
    const geminiKey = Deno.env.get('GEMINI_API_KEY')
    if (!geminiKey) {
      console.error('GEMINI_API_KEY not configured')
      return new Response(
        JSON.stringify({ error: 'Image generation service not configured' }),
        { status: 503, headers: { 'Content-Type': 'application/json', ...CORS_HEADERS } }
      )
    }

    const geminiUrl = `${GEMINI_API_BASE}/${GEMINI_MODEL}:generateContent?key=${geminiKey}`
    const geminiRes = await fetch(geminiUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: {
          responseModalities: ['TEXT', 'IMAGE'],
        },
      }),
    })

    if (!geminiRes.ok) {
      const errBody = await geminiRes.text()
      console.error('Gemini image-gen error:', geminiRes.status, errBody)
      return new Response(
        JSON.stringify({ error: 'Image generation failed' }),
        { status: 502, headers: { 'Content-Type': 'application/json', ...CORS_HEADERS } }
      )
    }

    const geminiData = await geminiRes.json()

    // Extract text and images from Gemini response
    let text = ''
    const images: { data: string; mimeType: string }[] = []

    const candidates = geminiData.candidates || []
    for (const candidate of candidates) {
      const parts = candidate.content?.parts || []
      for (const part of parts) {
        if (part.text) {
          text += part.text
        } else if (part.inlineData) {
          images.push({
            data: part.inlineData.data,
            mimeType: part.inlineData.mimeType || 'image/png',
          })
        }
      }
    }

    if (images.length === 0) {
      return new Response(
        JSON.stringify({ error: 'No image was generated. Try rephrasing your prompt.' }),
        { status: 422, headers: { 'Content-Type': 'application/json', ...CORS_HEADERS } }
      )
    }

    // Audit log
    logAudit(svc, {
      actorId: user.id, eventType: 'edge_function.call', action: 'image-gen',
      source: 'image-gen', status: 'success', statusCode: 200,
      metadata: { promptLength: prompt.length, imageCount: images.length, estimated_cost_usd: ESTIMATED_COST_USD },
      ip: getClientIP(req), userAgent: getUA(req),
    })

    // Log usage with cost
    svc.from('usage_logs').insert({
      user_id: user.id,
      endpoint: 'image-gen',
      model: GEMINI_MODEL,
      input_tokens: 0,
      output_tokens: 0,
      estimated_cost_usd: ESTIMATED_COST_USD,
      metadata: { promptLength: prompt.length, imageCount: images.length },
    }).then(() => {}).catch(err => console.warn('[image-gen] Usage log failed:', err))

    return new Response(
      JSON.stringify({ text, images, model: GEMINI_MODEL }),
      { headers: { 'Content-Type': 'application/json', ...CORS_HEADERS } }
    )
  } catch (error) {
    console.error('image-gen error:', error)
    return new Response(
      JSON.stringify({ error: 'Image generation failed' }),
      { status: 500, headers: { 'Content-Type': 'application/json', ...CORS_HEADERS } }
    )
  }
})
