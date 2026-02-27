// Supabase Edge Function: proactive-briefings
// Generates proactive "Kernel noticed..." insights from user mirror data.
// Called by task-scheduler on schedule, or directly for a specific user.
// Pro-only: only processes users with active subscriptions.
//
// Deploy: npx supabase functions deploy proactive-briefings --project-ref eoxxpyixdieprsxlpwcs

import { serve } from 'https://deno.land/std@0.177.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { corsHeaders, handlePreflight, OPEN_CORS_HEADERS, SECURITY_HEADERS } from '../_shared/cors.ts'

// Throttle: max 1 proactive notification per user per 24 hours
const THROTTLE_MS = 24 * 60 * 60 * 1000
// Require facet updates within last 48 hours
const FACET_FRESHNESS_MS = 48 * 60 * 60 * 1000
// Minimum convergence insights required
const MIN_INSIGHTS = 2

serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return handlePreflight(req)
  }

  const CORS_HEADERS = { ...OPEN_CORS_HEADERS, ...SECURITY_HEADERS }

  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
  const supabaseUrl = Deno.env.get('SUPABASE_URL')
  const authHeader = req.headers.get('Authorization')

  let isServiceCall = false
  if (authHeader === `Bearer ${serviceKey}`) {
    isServiceCall = true
  }

  try {
    const supabase = createClient(
      supabaseUrl ?? '',
      serviceKey ?? '',
      { auth: { persistSession: false, autoRefreshToken: false } },
    )

    let targetUserId: string | null = null

    // If not a service call, authenticate the user (manual "generate now" trigger)
    if (!isServiceCall) {
      if (!authHeader) {
        return new Response(JSON.stringify({ error: 'Unauthorized' }), {
          status: 401,
          headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
        })
      }
      const token = authHeader.replace('Bearer ', '')
      const { data: { user }, error: authErr } = await supabase.auth.getUser(token)
      if (authErr || !user) {
        return new Response(JSON.stringify({ error: 'Unauthorized' }), {
          status: 401,
          headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
        })
      }

      // Check Pro status (active or trialing)
      const { data: sub } = await supabase
        .from('subscriptions')
        .select('status')
        .eq('user_id', user.id)
        .in('status', ['active', 'trialing'])
        .maybeSingle()
      if (!sub) {
        return new Response(JSON.stringify({ error: 'Proactive Briefings is a Pro feature.' }), {
          status: 403,
          headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
        })
      }

      targetUserId = user.id
    }

    // Parse optional payload (service call can target a specific user)
    let payload: { user_id?: string } = {}
    try {
      const text = await req.text()
      if (text) payload = JSON.parse(text)
    } catch { /* no body or invalid JSON */ }

    if (isServiceCall && payload.user_id) {
      targetUserId = payload.user_id
    }

    // ── Gather users to process ──────────────────────────────
    interface UserToProcess { id: string }
    let usersToProcess: UserToProcess[] = []

    if (targetUserId) {
      usersToProcess = [{ id: targetUserId }]
    } else {
      // Cron mode: fetch all Pro users (active + trialing)
      const { data: proUsers } = await supabase
        .from('subscriptions')
        .select('user_id')
        .in('status', ['active', 'trialing'])

      if (proUsers) {
        usersToProcess = proUsers.map((u: { user_id: string }) => ({ id: u.user_id }))
      }
    }

    let processedCount = 0
    let skippedCount = 0

    for (const u of usersToProcess) {
      try {
        // ── 1. Fetch user memory with mirror data ──────────────
        const { data: memory } = await supabase
          .from('user_memory')
          .select('agent_facets, convergence_insights, last_convergence, last_proactive_at')
          .eq('user_id', u.id)
          .maybeSingle()

        if (!memory) { skippedCount++; continue }

        // ── 2. Check qualification criteria ────────────────────

        // 2a. Throttle: has it been > 24h since last proactive notification?
        if (memory.last_proactive_at) {
          const lastProactive = new Date(memory.last_proactive_at).getTime()
          if (Date.now() - lastProactive < THROTTLE_MS) {
            skippedCount++
            continue
          }
        }

        // 2b. Has convergence insights (at least MIN_INSIGHTS)?
        const insights = memory.convergence_insights as unknown[]
        if (!insights || !Array.isArray(insights) || insights.length < MIN_INSIGHTS) {
          skippedCount++
          continue
        }

        // 2c. Has agent facets with recent updates (within 48h)?
        const facets = memory.agent_facets as Record<string, {
          agentId: string
          observations: string[]
          patterns: string[]
          updatedAt: number
          messagesSeen: number
        }> | null

        if (!facets || typeof facets !== 'object' || Object.keys(facets).length === 0) {
          skippedCount++
          continue
        }

        const now = Date.now()
        const hasRecentFacet = Object.values(facets).some(
          f => f && f.updatedAt && (now - f.updatedAt) < FACET_FRESHNESS_MS
        )
        if (!hasRecentFacet) {
          skippedCount++
          continue
        }

        // ── 3. Build mirror context for Claude ──────────────────
        const facetSummaries = Object.values(facets)
          .filter(f => f && f.observations && f.observations.length > 0)
          .map(f => {
            const obs = (f.observations || []).slice(0, 4).join('; ')
            const pat = (f.patterns || []).slice(0, 2).join('; ')
            return `[${f.agentId}] Observations: ${obs}${pat ? ` | Patterns: ${pat}` : ''}`
          })
          .join('\n')

        const insightTexts = (insights as Array<{ insight: string; sources: string[]; confidence: number }>)
          .filter(i => i && i.insight)
          .map(i => `- ${i.insight} (from: ${(i.sources || []).join(', ')}, confidence: ${i.confidence || 0.5})`)
          .join('\n')

        if (!facetSummaries && !insightTexts) {
          skippedCount++
          continue
        }

        // ── 4. Generate proactive insight via Claude Haiku ──────
        const prompt = `Given these facets and insights about a user, generate ONE interesting observation, connection, or question that would be genuinely useful to them. Be specific, not generic. Max 2 sentences.

Agent facets:
${facetSummaries}

Convergence insights:
${insightTexts}

Write a single observation that connects patterns across different dimensions. Start naturally — do not begin with "I noticed" or use the word "facet". Write as if you're a thoughtful friend sharing something you connected.`

        const proxyUrl = `${supabaseUrl}/functions/v1/claude-proxy`
        const claudeRes = await fetch(proxyUrl, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${serviceKey}`,
          },
          body: JSON.stringify({
            mode: 'text',
            tier: 'fast',
            messages: [{ role: 'user', content: prompt }],
            max_tokens: 200,
          }),
        })

        if (!claudeRes.ok) {
          const errText = await claudeRes.text().catch(() => 'unknown')
          console.error(`[proactive] Claude failed for user ${u.id}: ${errText}`)
          continue
        }

        const { text: insightText } = await claudeRes.json()
        if (!insightText || insightText.trim().length < 10) {
          console.warn(`[proactive] Empty or too-short insight for user ${u.id}`)
          continue
        }

        const cleanInsight = insightText.trim().slice(0, 300)

        // ── 5. Create in-app notification ───────────────────────
        await supabase.from('notifications').insert({
          user_id: u.id,
          title: 'Kernel noticed...',
          body: cleanInsight,
          type: 'proactive',
          proactive_trigger: cleanInsight,
        })

        // ── 6. Send push notification if subscribed ─────────────
        try {
          const notifyUrl = `${supabaseUrl}/functions/v1/send-notification`
          await fetch(notifyUrl, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Bearer ${serviceKey}`,
            },
            body: JSON.stringify({
              channel: 'push',
              user_id: u.id,
              title: 'Kernel has an observation for you',
              body: cleanInsight,
              type: 'proactive',
              url: '/',
            }),
          })
        } catch (pushErr) {
          // Push failure is non-blocking
          console.warn(`[proactive] Push notification failed for ${u.id}:`, pushErr)
        }

        // ── 7. Update last_proactive_at timestamp ───────────────
        await supabase
          .from('user_memory')
          .update({ last_proactive_at: new Date().toISOString() })
          .eq('user_id', u.id)

        processedCount++
        console.log(`[proactive] Generated insight for user ${u.id}`)
      } catch (userErr) {
        // Per-user errors should not crash the entire batch
        console.error(`[proactive] Error processing user ${u.id}:`, userErr)
      }
    }

    return new Response(JSON.stringify({
      processed: processedCount,
      skipped: skippedCount,
      total: usersToProcess.length,
    }), {
      headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
    })
  } catch (err) {
    console.error('[proactive-briefings] Fatal error:', err)
    return new Response(JSON.stringify({
      error: err instanceof Error ? err.message : 'Unknown error',
    }), {
      status: 500,
      headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
    })
  }
})
