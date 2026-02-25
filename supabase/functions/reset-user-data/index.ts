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

    /** Safe delete helper — catches per-table errors so one failure doesn't abort all */
    async function safeDelete(table: string, key: string, filter?: Record<string, unknown>) {
      try {
        let query = admin.from(table).delete({ count: 'exact' }).eq('user_id', userId)
        if (filter) {
          for (const [k, v] of Object.entries(filter)) {
            query = query.eq(k, v as string)
          }
        }
        const { count, error } = await query
        if (error) {
          console.error(`[reset] ${table} delete error:`, error.message)
          errors.push(`${table}: ${error.message}`)
          deleted[key] = 0
        } else {
          deleted[key] = count ?? 0
        }
      } catch (err) {
        console.error(`[reset] ${table} threw:`, err)
        errors.push(`${table}: ${err instanceof Error ? err.message : 'unknown'}`)
        deleted[key] = 0
      }
    }

    // Conversations + messages
    if (shouldDelete('conversations')) {
      await safeDelete('conversations', 'conversations')
      await safeDelete('messages', 'messages')
      await safeDelete('shared_conversations', 'shared_conversations')
    }

    // User memory (profile extracted from conversations)
    if (shouldDelete('memory')) {
      await safeDelete('user_memory', 'memory')
      await safeDelete('procedures', 'procedures')
    }

    // Knowledge graph (relations first — they reference entities)
    if (shouldDelete('knowledge')) {
      await safeDelete('knowledge_graph_relations', 'relations')
      await safeDelete('knowledge_graph_entities', 'entities')
    }

    // Goals
    if (shouldDelete('goals')) {
      await safeDelete('user_goals', 'goals')
    }

    // Preferences (reset user_metadata to clean state)
    if (shouldDelete('preferences')) {
      try {
        const { error: updateErr } = await admin.auth.admin.updateUser(userId, {
          user_metadata: {
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
        console.error('[reset] updateUser threw:', err)
        errors.push(`preferences: ${err instanceof Error ? err.message : 'unknown'}`)
        deleted.preferences = 0
      }

      await safeDelete('briefings', 'briefings')
      await safeDelete('user_engine_state', 'engine_state')
    }

    // If ALL operations failed, return 500 with details
    if (errors.length > 0 && Object.values(deleted).every(v => v === 0)) {
      console.error('[reset] all operations failed:', errors)
      return jsonResponse({ error: 'Reset failed', details: errors }, 500)
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
