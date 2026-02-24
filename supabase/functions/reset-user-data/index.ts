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
    const errors: string[] = []
    const userId = user.id

    const shouldDelete = (s: Scope) => scope === 'all' || scope === s

    /** Safe delete helper — catches individual table errors so one failure doesn't abort the rest */
    async function safeDelete(table: string, key: string, filter: Record<string, string>) {
      try {
        let query = admin.from(table).delete({ count: 'exact' })
        for (const [col, val] of Object.entries(filter)) {
          query = query.eq(col, val)
        }
        const { count, error } = await query
        if (error) {
          console.warn(`[reset-user-data] ${table} delete error:`, error.message)
          errors.push(`${table}: ${error.message}`)
          return 0
        }
        return count ?? 0
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err)
        console.warn(`[reset-user-data] ${table} delete threw:`, msg)
        errors.push(`${table}: ${msg}`)
        return 0
      }
    }

    // Conversations + messages (messages cascade via FK)
    if (shouldDelete('conversations')) {
      deleted.conversations = await safeDelete('conversations', 'conversations', { user_id: userId })
      deleted.messages = await safeDelete('messages', 'messages', { user_id: userId })
      await safeDelete('shared_conversations', 'shared_conversations', { user_id: userId })
    }

    // User memory (profile extracted from conversations)
    if (shouldDelete('memory')) {
      deleted.memory = await safeDelete('user_memory', 'user_memory', { user_id: userId })
      deleted.procedures = await safeDelete('procedures', 'procedures', { user_id: userId })
    }

    // Knowledge graph (relations cascade via FK on entities)
    if (shouldDelete('knowledge')) {
      // Delete relations first (they reference entities)
      deleted.relations = await safeDelete('knowledge_graph_relations', 'knowledge_graph_relations', { user_id: userId })
      deleted.entities = await safeDelete('knowledge_graph_entities', 'knowledge_graph_entities', { user_id: userId })
    }

    // Goals
    if (shouldDelete('goals')) {
      deleted.goals = await safeDelete('user_goals', 'user_goals', { user_id: userId })
    }

    // Preferences (reset user_metadata to clean state)
    if (shouldDelete('preferences')) {
      try {
        const { error: updateErr } = await admin.auth.admin.updateUser(userId, {
          user_metadata: {
            // Preserve only essential fields
            display_name: user.user_metadata?.display_name || '',
            avatar_url: user.user_metadata?.avatar_url || '',
          },
        })
        if (updateErr) {
          console.warn('Failed to reset preferences:', updateErr.message)
          errors.push(`preferences: ${updateErr.message}`)
        }
        deleted.preferences = updateErr ? 0 : 1
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err)
        console.warn('Failed to reset preferences (threw):', msg)
        errors.push(`preferences: ${msg}`)
        deleted.preferences = 0
      }

      // Delete briefings
      deleted.briefings = await safeDelete('briefings', 'briefings', { user_id: userId })
      deleted.engine_state = await safeDelete('user_engine_state', 'user_engine_state', { user_id: userId })
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

    console.log(`[reset-user-data] user=${userId} scope=${scope} deleted=`, deleted, errors.length ? `errors=${errors.join('; ')}` : '')

    if (errors.length > 0 && Object.values(deleted).every(v => v === 0)) {
      // Complete failure — nothing was deleted
      return jsonResponse({ error: `Reset failed: ${errors[0]}`, details: errors }, 500)
    }

    return jsonResponse({ success: true, scope, deleted, ...(errors.length > 0 ? { warnings: errors } : {}) })
  } catch (error) {
    console.error('reset-user-data error:', error)
    return jsonResponse({ error: error instanceof Error ? error.message : 'Internal server error' }, 500)
  }
})
