// Supabase Edge Function: content-moderation
// AI moderation agent using Haiku. Evaluates toxicity, spam, and guideline compliance.
// Called by content-engine on publish. Synchronous gate — content doesn't reach discovery until approved.
//
// Deploy: npx supabase functions deploy content-moderation --project-ref eoxxpyixdieprsxlpwcs --no-verify-jwt

import { serve } from 'https://deno.land/std@0.177.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { corsHeaders, handlePreflight, SECURITY_HEADERS } from '../_shared/cors.ts'
import { logAudit, getClientIP, getUA } from '../_shared/audit.ts'

const ANTHROPIC_API_KEY = Deno.env.get('ANTHROPIC_API_KEY') || ''

interface ModerationVerdict {
  toxicity: number
  spam: number
  guidelines: number
  reasoning: string
  status: 'approved' | 'flagged' | 'rejected'
}

const MODERATION_PROMPT = `You are a content moderation agent. Evaluate the following published content on three dimensions, each scored 0.0 to 1.0.

DIMENSIONS:
1. **Toxicity** (0.0 = benign, 1.0 = severe) — hate speech, harassment, threats, slurs, dehumanization
2. **Spam** (0.0 = genuine, 1.0 = pure spam) — SEO spam, generated nonsense, repetitive clickbait, keyword stuffing
3. **Guidelines** (0.0 = compliant, 1.0 = severe violation) — PII exposure, copyright infringement, illegal content, dangerous misinformation

RESPONSE FORMAT (JSON only, no markdown):
{
  "toxicity": 0.0,
  "spam": 0.0,
  "guidelines": 0.0,
  "reasoning": "Brief explanation of scores"
}

CONTENT TO EVALUATE:
`

async function moderateContent(title: string, content: string, tags: string[]): Promise<ModerationVerdict> {
  const textToEvaluate = [
    title ? `Title: ${title}` : '',
    tags.length ? `Tags: ${tags.join(', ')}` : '',
    `Content: ${content.slice(0, 8000)}`,
  ].filter(Boolean).join('\n')

  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': ANTHROPIC_API_KEY,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 256,
      messages: [{
        role: 'user',
        content: MODERATION_PROMPT + textToEvaluate,
      }],
    }),
  })

  if (!res.ok) {
    const err = await res.text()
    console.error('[moderation] Haiku API error:', err)
    // Fail-open: if moderation fails, flag for manual review
    return { toxicity: 0, spam: 0, guidelines: 0, reasoning: 'Moderation API unavailable — flagged for review', status: 'flagged' }
  }

  const data = await res.json()
  const text = data.content?.[0]?.text || '{}'

  try {
    // Extract JSON from response (handle potential markdown wrapping)
    const jsonStr = text.replace(/```json?\n?/g, '').replace(/```/g, '').trim()
    const verdict = JSON.parse(jsonStr)

    const toxicity = Math.max(0, Math.min(1, Number(verdict.toxicity) || 0))
    const spam = Math.max(0, Math.min(1, Number(verdict.spam) || 0))
    const guidelines = Math.max(0, Math.min(1, Number(verdict.guidelines) || 0))
    const reasoning = String(verdict.reasoning || '').slice(0, 500)

    // Determine status
    let status: ModerationVerdict['status'] = 'approved'
    if (toxicity >= 0.7 || spam >= 0.7 || guidelines >= 0.7) {
      status = 'rejected'
    } else if (toxicity >= 0.3 || spam >= 0.3 || guidelines >= 0.3) {
      status = 'flagged'
    }

    return { toxicity, spam, guidelines, reasoning, status }
  } catch {
    console.error('[moderation] Failed to parse verdict:', text)
    return { toxicity: 0, spam: 0, guidelines: 0, reasoning: 'Parse error — flagged for review', status: 'flagged' }
  }
}

serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return handlePreflight(req)
  const CORS = { ...corsHeaders(req), ...SECURITY_HEADERS }

  try {
    // Auth: Service-role only — this endpoint is internal (called by content-engine)
    const token = req.headers.get('authorization')?.replace('Bearer ', '')
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    if (!token || token !== serviceKey) {
      return new Response(JSON.stringify({ error: 'Unauthorized — service role required' }), {
        status: 403, headers: { 'Content-Type': 'application/json', ...CORS },
      })
    }

    const svc = createClient(
      Deno.env.get('SUPABASE_URL')!,
      serviceKey,
      { auth: { persistSession: false, autoRefreshToken: false } },
    )

    // Parse body
    const { content_id, title, content, tags } = await req.json()
    if (!content_id || !content) {
      return new Response(JSON.stringify({ error: 'content_id and content required' }), {
        status: 400, headers: { 'Content-Type': 'application/json', ...CORS },
      })
    }

    // Run AI moderation
    const verdict = await moderateContent(title || '', content, tags || [])

    // Write to content_moderation table
    await svc.from('content_moderation').upsert({
      content_id,
      status: verdict.status,
      verdict: {
        toxicity: verdict.toxicity,
        spam: verdict.spam,
        guidelines: verdict.guidelines,
        reasoning: verdict.reasoning,
      },
      updated_at: new Date().toISOString(),
    }, { onConflict: 'content_id' })

    // Update content_items moderation_status
    await svc.from('content_items').update({
      moderation_status: verdict.status,
    }).eq('id', content_id)

    // Audit
    logAudit(svc, {
      actorId: undefined,
      actorType: 'service',
      eventType: 'moderation.evaluate',
      action: `content-moderation.${verdict.status}`,
      source: 'content-moderation',
      status: 'success',
      statusCode: 200,
      metadata: {
        content_id,
        toxicity: verdict.toxicity,
        spam: verdict.spam,
        guidelines: verdict.guidelines,
        verdict_status: verdict.status,
      },
      ip: getClientIP(req),
      userAgent: getUA(req),
    })

    return new Response(JSON.stringify({
      ok: true,
      verdict: {
        status: verdict.status,
        toxicity: verdict.toxicity,
        spam: verdict.spam,
        guidelines: verdict.guidelines,
        reasoning: verdict.reasoning,
      },
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json', ...CORS },
    })

  } catch (error) {
    console.error('content-moderation error:', error)
    return new Response(JSON.stringify({ error: error instanceof Error ? error.message : 'Internal error' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json', ...CORS },
    })
  }
})
