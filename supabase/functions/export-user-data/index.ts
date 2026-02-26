// Supabase Edge Function: export-user-data
// Exports all user data as a downloadable JSON file (GDPR Article 20 / CCPA portability).
// No request body needed — exports everything for the authenticated user.
//
// Deploy: npx supabase functions deploy export-user-data --project-ref eoxxpyixdieprsxlpwcs --no-verify-jwt

import { serve } from 'https://deno.land/std@0.177.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { corsHeaders, handlePreflight, SECURITY_HEADERS } from '../_shared/cors.ts'
import { logAudit, getClientIP, getUA } from '../_shared/audit.ts'
import { checkRateLimit, rateLimitResponse } from '../_shared/rate-limit.ts'

/** Mask IP addresses for privacy (e.g., 192.168.1.42 → 192.168.*.*) */
function maskIP(ip: string | null | undefined): string | null {
  if (!ip) return null
  const parts = ip.split('.')
  if (parts.length === 4) return `${parts[0]}.${parts[1]}.*.*`
  // IPv6 or unusual format — mask last half
  if (ip.includes(':')) {
    const segments = ip.split(':')
    const half = Math.ceil(segments.length / 2)
    return [...segments.slice(0, half), ...segments.slice(half).map(() => '*')].join(':')
  }
  return ip
}

/** Recursively mask IP addresses in objects/arrays */
function maskIPs(data: unknown): unknown {
  if (data === null || data === undefined) return data
  if (typeof data === 'string') return data
  if (Array.isArray(data)) return data.map(maskIPs)
  if (typeof data === 'object') {
    const obj = data as Record<string, unknown>
    const result: Record<string, unknown> = {}
    for (const [key, value] of Object.entries(obj)) {
      if (/ip[_-]?address|client[_-]?ip|ip$/i.test(key) && typeof value === 'string') {
        result[key] = maskIP(value)
      } else if (typeof value === 'object') {
        result[key] = maskIPs(value)
      } else {
        result[key] = value
      }
    }
    return result
  }
  return data
}

serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return handlePreflight(req)
  }

  const CORS_HEADERS = { ...corsHeaders(req), ...SECURITY_HEADERS }

  try {
    // ── Auth: verify user JWT ───────────────────────────
    const token = req.headers.get('authorization')?.replace('Bearer ', '')
    if (!token) {
      return new Response(JSON.stringify({ error: 'Missing authorization header' }), {
        status: 401,
        headers: { 'Content-Type': 'application/json', ...CORS_HEADERS },
      })
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const anonKey = Deno.env.get('SUPABASE_ANON_KEY')!
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!

    const userClient = createClient(supabaseUrl, anonKey)
    const { data: { user }, error: authError } = await userClient.auth.getUser(token)
    if (authError || !user) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { 'Content-Type': 'application/json', ...CORS_HEADERS },
      })
    }

    // ── Service-role client ─────────────────────────────
    const admin = createClient(supabaseUrl, serviceRoleKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    })

    // ── Rate limit: 1 per 24 hours ──────────────────────
    const rl = await checkRateLimit(admin, user.id, 'export-user-data', 'free')
    if (!rl.allowed) return rateLimitResponse(rl, CORS_HEADERS)

    // ── Export all user data ────────────────────────────
    const startTime = Date.now()
    const userId = user.id
    const warnings: string[] = []

    /** Safe query helper — catches per-table errors so one failure doesn't abort all */
    async function safeQuery<T = unknown>(
      table: string,
      key = 'user_id',
      keyValue: string = userId,
      columns = '*',
    ): Promise<{ data: T[]; count: number }> {
      try {
        const { data, error } = await admin
          .from(table)
          .select(columns)
          .eq(key, keyValue)
        if (error) {
          console.error(`[export] ${table} query error:`, error.message)
          warnings.push(`${table}: ${error.message}`)
          return { data: [] as T[], count: 0 }
        }
        return { data: (data || []) as T[], count: data?.length ?? 0 }
      } catch (err) {
        console.error(`[export] ${table} threw:`, err)
        warnings.push(`${table}: ${err instanceof Error ? err.message : 'unknown'}`)
        return { data: [] as T[], count: 0 }
      }
    }

    // Run all queries in parallel
    const [
      conversations,
      messages,
      sharedConversations,
      responseSignals,
      userMemory,
      userEngineState,
      kgEntities,
      kgRelations,
      procedures,
      userGoals,
      scheduledTasks,
      taskExecutions,
      workflowRuns,
      briefings,
      notifications,
      subscriptions,
      discordLinks,
      deviceFingerprints,
      identityEvents,
      recoveryRequests,
      auditEvents,
      usageLogs,
    ] = await Promise.all([
      // Conversations
      safeQuery('conversations'),
      safeQuery('messages'),
      safeQuery('shared_conversations'),
      safeQuery('response_signals'),
      // Intelligence
      safeQuery('user_memory'),
      safeQuery('user_engine_state'),
      safeQuery('knowledge_graph_entities'),
      safeQuery('knowledge_graph_relations'),
      safeQuery('procedures'),
      // Goals & Tasks
      safeQuery('user_goals'),
      safeQuery('scheduled_tasks'),
      safeQuery('task_executions'),
      safeQuery('workflow_runs'),
      safeQuery('briefings'),
      safeQuery('notifications'),
      // Account
      safeQuery('subscriptions'),
      safeQuery('discord_user_links'),
      // Security & Audit
      safeQuery('device_fingerprints'),
      safeQuery('identity_events'),
      safeQuery('recovery_requests', 'user_id', userId, 'id,user_id,request_type,state,ip_address,user_agent,created_at,updated_at,expires_at,executed_at'),
      safeQuery('audit_events', 'actor_id'),
      safeQuery('usage_logs'),
    ])

    // Conditional: discord_user_memory is keyed by discord_id, not user_id
    let discordMemory = { data: [] as unknown[], count: 0 }
    if (discordLinks.data.length > 0) {
      const discordId = (discordLinks.data[0] as Record<string, unknown>).discord_id as string
      if (discordId) {
        discordMemory = await safeQuery('discord_user_memory', 'discord_id', discordId)
      }
    }

    // Build safe account info from auth.users (exclude sensitive fields)
    const safeUserInfo = {
      id: user.id,
      email: user.email,
      created_at: user.created_at,
      updated_at: user.updated_at,
      last_sign_in_at: user.last_sign_in_at,
      app_metadata: { provider: user.app_metadata?.provider, providers: user.app_metadata?.providers },
      user_metadata: user.user_metadata,
    }

    const duration = Date.now() - startTime

    // Apply IP masking to security tables
    const securityData = {
      device_fingerprints: maskIPs(deviceFingerprints.data),
      identity_events: maskIPs(identityEvents.data),
      recovery_requests: maskIPs(recoveryRequests.data),
      audit_events: maskIPs(auditEvents.data),
      usage_logs: maskIPs(usageLogs.data),
      discord_user_memory: maskIPs(discordMemory.data),
    }

    // Assemble export
    const exportData = {
      export_version: '1.0',
      exported_at: new Date().toISOString(),
      stats: {
        tables_exported: 23,
        total_records:
          conversations.count + messages.count + sharedConversations.count + responseSignals.count +
          userMemory.count + userEngineState.count + kgEntities.count + kgRelations.count + procedures.count +
          userGoals.count + scheduledTasks.count + taskExecutions.count + workflowRuns.count +
          briefings.count + notifications.count +
          subscriptions.count + discordLinks.count +
          deviceFingerprints.count + identityEvents.count + recoveryRequests.count +
          auditEvents.count + usageLogs.count + discordMemory.count,
        duration_ms: duration,
        ...(warnings.length > 0 ? { warnings } : {}),
      },
      account: {
        user: safeUserInfo,
        subscriptions: subscriptions.data,
        discord_links: discordLinks.data,
      },
      conversations: {
        conversations: conversations.data,
        messages: messages.data,
        shared_conversations: sharedConversations.data,
        response_signals: responseSignals.data,
      },
      intelligence: {
        user_memory: userMemory.data,
        user_engine_state: userEngineState.data,
        knowledge_graph_entities: kgEntities.data,
        knowledge_graph_relations: kgRelations.data,
        procedures: procedures.data,
      },
      goals_and_tasks: {
        user_goals: userGoals.data,
        scheduled_tasks: scheduledTasks.data,
        task_executions: taskExecutions.data,
        workflow_runs: workflowRuns.data,
        briefings: briefings.data,
        notifications: notifications.data,
      },
      security: securityData,
    }

    // ── Audit log ───────────────────────────────────────
    logAudit(admin, {
      actorId: userId,
      eventType: 'user.action',
      action: 'export-user-data',
      source: 'export-user-data',
      status: 'success',
      statusCode: 200,
      metadata: { total_records: exportData.stats.total_records, duration_ms: duration },
      ip: getClientIP(req),
      userAgent: getUA(req),
    })

    console.log(`[export-user-data] user=${userId} records=${exportData.stats.total_records} duration=${duration}ms`)

    return new Response(JSON.stringify(exportData, null, 2), {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
        'Content-Disposition': `attachment; filename="kernel-data-export-${new Date().toISOString().slice(0, 10)}.json"`,
        ...CORS_HEADERS,
      },
    })
  } catch (error) {
    console.error('export-user-data error:', error)
    return new Response(JSON.stringify({ error: 'Internal server error' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json', ...CORS_HEADERS },
    })
  }
})
