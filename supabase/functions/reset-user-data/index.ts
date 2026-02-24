// Supabase Edge Function: reset-user-data
// Selectively deletes user data by scope without deleting the account itself.
// Scopes: conversations, memory, knowledge, goals, preferences, all
//
// Deploy: npx supabase functions deploy reset-user-data --project-ref eoxxpyixdieprsxlpwcs --no-verify-jwt

import { serve } from 'https://deno.land/std@0.177.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { corsHeaders, handlePreflight, SECURITY_HEADERS } from '../_shared/cors.ts'
import { logAudit, getClientIP, getUA } from '../_shared/audit.ts'
import { checkRateLimit, rateLimitResponse } from '../_shared/rate-limit.ts'
import { requireContentType, requireJsonBody } from '../_shared/validate.ts'

const VALID_SCOPES = ['conversations', 'memory', 'knowledge', 'goals', 'preferences', 'all'] as const
type Scope = typeof VALID_SCOPES[number]

serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return handlePreflight(req)
  }

  const CORS_HEADERS = { ...corsHeaders(req), ...SECURITY_HEADERS }
  const jsonResponse = (data: unknown, status = 200) =>
    new Response(JSON.stringify(data), {
      status,
      headers: { 'Content-Type': 'application/json', ...CORS_HEADERS },
    })

  try {
    // ── Content-type check ──────────────────────────────
    const ctErr = requireContentType(req)
    if (ctErr) return ctErr(CORS_HEADERS)

    // ── Auth: verify user JWT ───────────────────────────
    const token = req.headers.get('authorization')?.replace('Bearer ', '')
    if (!token) return jsonResponse({ error: 'Missing authorization header' }, 401)

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const anonKey = Deno.env.get('SUPABASE_ANON_KEY')!
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!

    const userClient = createClient(supabaseUrl, anonKey)
    const { data: { user }, error: authError } = await userClient.auth.getUser(token)
    if (authError || !user) return jsonResponse({ error: 'Unauthorized' }, 401)

    // ── Service-role client ─────────────────────────────
    const admin = createClient(supabaseUrl, serviceRoleKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    })

    // ── Rate limit: 3 per hour ──────────────────────────
    const rl = await checkRateLimit(admin, user.id, 'reset-user-data', 'free')
    if (!rl.allowed) return rateLimitResponse(rl, CORS_HEADERS)

    // ── Parse body ──────────────────────────────────────
    const { body, error: bodyErr } = await requireJsonBody<{ scope: string }>(req)
    if (bodyErr) return bodyErr(CORS_HEADERS)

    const scope = body.scope as Scope
    if (!VALID_SCOPES.includes(scope)) {
      return jsonResponse({ error: `Invalid scope. Must be one of: ${VALID_SCOPES.join(', ')}` }, 400)
    }

    // ── Execute scoped deletion ─────────────────────────
    const deleted: Record<string, number> = {}
    const userId = user.id

    const shouldDelete = (s: Scope) => scope === 'all' || scope === s

    // Conversations + messages (messages cascade via FK)
    if (shouldDelete('conversations')) {
      const { count } = await admin
        .from('conversations')
        .delete({ count: 'exact' })
        .eq('user_id', userId)
      deleted.conversations = count ?? 0

      // Also delete orphaned messages (messages without conversation)
      const { count: msgCount } = await admin
        .from('messages')
        .delete({ count: 'exact' })
        .eq('user_id', userId)
      deleted.messages = msgCount ?? 0

      // Delete shared conversations
      await admin
        .from('shared_conversations')
        .delete()
        .eq('user_id', userId)
    }

    // User memory (profile extracted from conversations)
    if (shouldDelete('memory')) {
      const { count } = await admin
        .from('user_memory')
        .delete({ count: 'exact' })
        .eq('user_id', userId)
      deleted.memory = count ?? 0

      // Also delete procedural memory
      const { count: procCount } = await admin
        .from('procedures')
        .delete({ count: 'exact' })
        .eq('user_id', userId)
      deleted.procedures = procCount ?? 0
    }

    // Knowledge graph (relations cascade via FK on entities)
    if (shouldDelete('knowledge')) {
      // Delete relations first (they reference entities)
      const { count: relCount } = await admin
        .from('knowledge_graph_relations')
        .delete({ count: 'exact' })
        .eq('user_id', userId)
      deleted.relations = relCount ?? 0

      const { count: entCount } = await admin
        .from('knowledge_graph_entities')
        .delete({ count: 'exact' })
        .eq('user_id', userId)
      deleted.entities = entCount ?? 0
    }

    // Goals
    if (shouldDelete('goals')) {
      const { count } = await admin
        .from('user_goals')
        .delete({ count: 'exact' })
        .eq('user_id', userId)
      deleted.goals = count ?? 0
    }

    // Preferences (reset user_metadata to clean state)
    if (shouldDelete('preferences')) {
      const { error: updateErr } = await admin.auth.admin.updateUser(userId, {
        user_metadata: {
          // Preserve only essential fields
          display_name: user.user_metadata?.display_name || '',
          avatar_url: user.user_metadata?.avatar_url || '',
        },
      })
      if (updateErr) {
        console.warn('Failed to reset preferences:', updateErr.message)
      }
      deleted.preferences = updateErr ? 0 : 1

      // Delete briefings
      const { count: briefCount } = await admin
        .from('briefings')
        .delete({ count: 'exact' })
        .eq('user_id', userId)
      deleted.briefings = briefCount ?? 0
    }

    // ── Audit log ───────────────────────────────────────
    logAudit(admin, {
      actorId: userId,
      eventType: 'user.action',
      action: 'reset-user-data',
      source: 'reset-user-data',
      status: 'success',
      statusCode: 200,
      metadata: { scope, deleted },
      ip: getClientIP(req),
      userAgent: getUA(req),
    })

    console.log(`[reset-user-data] user=${userId} scope=${scope} deleted=`, deleted)
    return jsonResponse({ success: true, scope, deleted })
  } catch (error) {
    console.error('reset-user-data error:', error)
    return jsonResponse({ error: 'Internal server error' }, 500)
  }
})
