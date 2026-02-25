// Supabase Edge Function: shared-conversation
// Public GET endpoint for viewing shared conversations.
// Uses Postgres-backed rate limiting and audit logging.
//
// Deploy: npx supabase functions deploy shared-conversation --project-ref eoxxpyixdieprsxlpwcs

import { serve } from 'https://deno.land/std@0.177.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { checkRateLimit, rateLimitResponse } from '../_shared/rate-limit.ts'
import { logAudit, getClientIP, getUA } from '../_shared/audit.ts'

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: CORS_HEADERS })
  }

  try {
    // Service client for rate limiting, audit, and DB queries
    const svc = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, {
      auth: { persistSession: false, autoRefreshToken: false },
    })

    // Rate limit check (keyed by IP since this is a public endpoint)
    const clientIP = getClientIP(req) || 'unknown'
    const rlCheck = await checkRateLimit(svc, clientIP, 'shared-conversation')
    if (!rlCheck.allowed) return rateLimitResponse(rlCheck, CORS_HEADERS)

    const url = new URL(req.url)
    const shareId = url.searchParams.get('id')

    if (!shareId) {
      return new Response(JSON.stringify({ error: 'Missing id parameter' }), {
        status: 400,
        headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
      })
    }

    // Fetch the shared conversation
    const { data, error } = await svc
      .from('shared_conversations')
      .select('*')
      .eq('id', shareId)
      .single()

    if (error || !data) {
      return new Response(JSON.stringify({ error: 'Conversation not found' }), {
        status: 404,
        headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
      })
    }

    // Check expiry
    if (data.expires_at && new Date(data.expires_at) < new Date()) {
      return new Response(JSON.stringify({ error: 'This shared link has expired' }), {
        status: 410,
        headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
      })
    }

    // Atomic view count increment via RPC
    await svc.rpc('increment_shared_view_count', { share_id: shareId })

    // Audit log (fire-and-forget)
    logAudit(svc, {
      actorType: 'anonymous', eventType: 'edge_function.call', action: 'shared-conversation',
      source: 'shared-conversation', status: 'success', statusCode: 200,
      metadata: { shareId },
      ip: clientIP, userAgent: getUA(req),
    })

    return new Response(JSON.stringify({
      id: data.id,
      title: data.title,
      messages: data.messages,
      view_count: data.view_count + 1,
      created_at: data.created_at,
    }), {
      status: 200,
      headers: {
        ...CORS_HEADERS,
        'Content-Type': 'application/json',
      },
    })
  } catch (err) {
    return new Response(JSON.stringify({ error: 'Internal error' }), {
      status: 500,
      headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
    })
  }
})
