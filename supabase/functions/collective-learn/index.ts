// Collective Intelligence Learning Function
// Triggered every 6 hours by task-scheduler
// Aggregates routing signals → updates collective knowledge patterns

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.38.4'
import { OPEN_CORS_HEADERS, SECURITY_HEADERS } from '../_shared/cors.ts'

serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: OPEN_CORS_HEADERS })
  }

  const headers = { 'Content-Type': 'application/json', ...OPEN_CORS_HEADERS, ...SECURITY_HEADERS }

  try {
    // Auth: service role only
    const authHeader = req.headers.get('authorization')?.replace('Bearer ', '')
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
    if (!authHeader || authHeader !== serviceKey) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers })
    }

    const svc = createClient(
      Deno.env.get('SUPABASE_URL')!,
      serviceKey!,
      { auth: { persistSession: false } }
    )

    const results = {
      signals_processed: 0,
      patterns_updated: 0,
      patterns_created: 0,
      patterns_pruned: 0,
    }

    // Step 1: Aggregate routing signals from the last window
    const { data: aggregated, error: aggError } = await svc.rpc('aggregate_routing_signals', {
      p_window_hours: 6,
    })

    if (aggError) {
      console.error('Aggregation error:', aggError)
      return new Response(JSON.stringify({ error: 'Aggregation failed', detail: aggError.message }), { status: 500, headers })
    }

    if (!aggregated || aggregated.length === 0) {
      return new Response(JSON.stringify({ ...results, message: 'No signals to process' }), { headers })
    }

    results.signals_processed = aggregated.reduce((sum: number, r: any) => sum + Number(r.total_count), 0)

    // Step 2: For each category→agent pair, upsert routing_rule patterns
    for (const row of aggregated) {
      const { category, agent, total_count, avg_confidence, accuracy } = row

      if (!category) continue

      const patternData = {
        category,
        agent,
        avg_confidence: Math.round(avg_confidence * 1000) / 1000,
        accuracy: Math.round(accuracy * 1000) / 1000,
      }

      // Check if pattern already exists
      const { data: existing } = await svc
        .from('collective_knowledge')
        .select('id, sample_count, confidence')
        .eq('pattern_type', 'routing_rule')
        .filter('pattern->>category', 'eq', category)
        .filter('pattern->>agent', 'eq', agent)
        .limit(1)
        .single()

      if (existing) {
        // Update existing pattern with weighted average
        const newSampleCount = existing.sample_count + Number(total_count)
        const weight = Number(total_count) / newSampleCount
        const newConfidence = existing.confidence * (1 - weight) + accuracy * weight

        await svc
          .from('collective_knowledge')
          .update({
            pattern: patternData,
            confidence: Math.round(newConfidence * 1000) / 1000,
            sample_count: newSampleCount,
            last_updated: new Date().toISOString(),
          })
          .eq('id', existing.id)

        results.patterns_updated++
      } else {
        // Create new pattern
        await svc
          .from('collective_knowledge')
          .insert({
            pattern_type: 'routing_rule',
            pattern: patternData,
            confidence: accuracy,
            sample_count: Number(total_count),
          })

        results.patterns_created++
      }
    }

    // Step 3: Prune stale patterns (low confidence + low sample count)
    const { count: pruned } = await svc
      .from('collective_knowledge')
      .delete({ count: 'exact' })
      .lt('confidence', 0.3)
      .lt('sample_count', 10)
      .lt('last_updated', new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString())

    results.patterns_pruned = pruned || 0

    // Step 4: Purge old routing signals (>30 days)
    await svc.rpc('purge_old_routing_signals').catch(() => {})

    return new Response(JSON.stringify(results), { headers })
  } catch (err) {
    console.error('collective-learn error:', err)
    return new Response(
      JSON.stringify({ error: 'Internal error', detail: String(err) }),
      { status: 500, headers }
    )
  }
})
