// Supabase Edge Function: task-scheduler
// Called every 5 min by external cron. Queries due tasks, executes them,
// updates next_run_at.
//
// Deploy: npx supabase functions deploy task-scheduler --project-ref eoxxpyixdieprsxlpwcs

import { serve } from 'https://deno.land/std@0.177.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { logAudit } from '../_shared/audit.ts'

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

// Simple next-run calculator (mirrors client-side logic)
function calculateNextRun(schedule: any): string | null {
  const time = schedule.time || '09:00'
  const [hours, minutes] = time.split(':').map(Number)
  const now = new Date()

  switch (schedule.type) {
    case 'once':
      return null // Don't reschedule one-time tasks

    case 'daily': {
      const next = new Date(now)
      next.setDate(next.getDate() + 1)
      next.setHours(hours, minutes, 0, 0)
      return next.toISOString()
    }

    case 'weekdays': {
      const next = new Date(now)
      next.setDate(next.getDate() + 1)
      next.setHours(hours, minutes, 0, 0)
      while (next.getDay() === 0 || next.getDay() === 6) {
        next.setDate(next.getDate() + 1)
      }
      return next.toISOString()
    }

    case 'weekly': {
      const next = new Date(now)
      next.setDate(next.getDate() + 7)
      next.setHours(hours, minutes, 0, 0)
      return next.toISOString()
    }

    default:
      return null
  }
}

serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: CORS_HEADERS })
  }

  // Verify caller is authorized via service role key (auto-injected by Supabase)
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
  if (!serviceKey) {
    console.error('[task-scheduler] SUPABASE_SERVICE_ROLE_KEY not available — rejecting request')
    return new Response(JSON.stringify({ error: 'Server misconfiguration' }), {
      status: 500,
      headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
    })
  }
  const authHeader = req.headers.get('Authorization')
  if (authHeader !== `Bearer ${serviceKey}`) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), {
      status: 401,
      headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
    })
  }

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
    )

    // Find tasks that are due
    const now = new Date().toISOString()
    const { data: dueTasks, error } = await supabase
      .from('scheduled_tasks')
      .select('*')
      .eq('is_active', true)
      .lte('next_run_at', now)
      .limit(50)

    if (error) throw error
    if (!dueTasks || dueTasks.length === 0) {
      return new Response(JSON.stringify({ processed: 0 }), {
        headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
      })
    }

    let processed = 0

    for (const task of dueTasks) {
      try {
        // Create execution record
        const { data: exec } = await supabase
          .from('task_executions')
          .insert({
            task_id: task.id,
            user_id: task.user_id,
            status: 'running',
          })
          .select()
          .single()

        // Create notification
        await supabase.from('notifications').insert({
          user_id: task.user_id,
          title: task.title,
          body: `Scheduled ${task.task_type.replace('_', ' ')} task completed.`,
          type: task.task_type === 'reminder' ? 'reminder'
            : task.task_type === 'briefing' ? 'briefing'
            : task.task_type === 'goal_checkin' ? 'goal'
            : 'task_complete',
        })

        // Mark execution complete
        if (exec) {
          await supabase
            .from('task_executions')
            .update({ status: 'completed', duration_ms: Date.now() - new Date(exec.created_at).getTime() })
            .eq('id', exec.id)
        }

        // Calculate next run
        const nextRun = calculateNextRun(task.schedule)
        if (nextRun) {
          await supabase
            .from('scheduled_tasks')
            .update({ next_run_at: nextRun, updated_at: now })
            .eq('id', task.id)
        } else {
          // One-time task — deactivate
          await supabase
            .from('scheduled_tasks')
            .update({ is_active: false, updated_at: now })
            .eq('id', task.id)
        }

        processed++
      } catch (taskErr) {
        console.error(`Failed to process task ${task.id}:`, taskErr)
      }
    }

    // ── Proactive briefings: generate "Kernel noticed..." insights ──
    try {
      const proactiveUrl = `${Deno.env.get('SUPABASE_URL')}/functions/v1/proactive-briefings`
      const proactiveRes = await fetch(proactiveUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')}`,
        },
        body: JSON.stringify({}),
      })
      if (proactiveRes.ok) {
        const result = await proactiveRes.json()
        console.log(`[proactive] Processed: ${result.processed}, skipped: ${result.skipped}`)
      } else {
        console.warn(`[proactive] Failed (${proactiveRes.status}):`, await proactiveRes.text().catch(() => 'unknown'))
      }
    } catch (proactiveErr) {
      console.warn('Proactive briefings failed (non-blocking):', proactiveErr)
    }

    // ── Cleanup: purge expired rate limits, old audit events, old errors ──
    try {
      await supabase.rpc('cleanup_rate_limits')
      await supabase.rpc('cleanup_audit_events', { p_retention_days: 90 })
      await supabase.rpc('cleanup_platform_errors', { p_retention_days: 30 })
      await supabase.rpc('cleanup_message_states', { p_retention_days: 30 })
    } catch (cleanupErr) {
      console.warn('Cleanup RPCs failed (non-blocking):', cleanupErr)
    }

    // ── Provider reliability: recompute health scores ──
    try {
      await supabase.rpc('compute_provider_health')
      console.log('[health] Provider scores recomputed')
    } catch (scoreErr) {
      console.warn('Provider health computation failed (non-blocking):', scoreErr)
    }

    // ── Health monitoring: check error rates and alert on spikes ──
    try {
      const { data: health } = await supabase.rpc('get_error_health', { p_window_minutes: 15 })
      if (health) {
        const platformRate = health.platform_error_rate_pct ?? 0
        const platformErrors = health.platform_errors ?? 0

        // Alert if error rate exceeds 10% OR more than 20 platform errors in 15 min
        if (platformRate > 10 || platformErrors > 20) {
          const notifyUrl = `${Deno.env.get('SUPABASE_URL')}/functions/v1/notify-webhook`
          await fetch(notifyUrl, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Bearer ${Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')}`,
            },
            body: JSON.stringify({
              event_type: 'error_spike',
              error_rate: platformRate,
              platform_errors: platformErrors,
              total_errors: health.total_errors,
              refunded_count: health.refunded_count,
              breakdown: JSON.stringify(health.by_provider, null, 2),
            }),
          })
          console.warn(`[health] Error spike alert: ${platformRate}% error rate, ${platformErrors} errors in 15min`)
        }
      }
    } catch (healthErr) {
      console.warn('Health check failed (non-blocking):', healthErr)
    }

    // Audit log
    logAudit(supabase, {
      actorType: 'system', eventType: 'system.cron', action: 'task-scheduler',
      source: 'task-scheduler', status: 'success', statusCode: 200,
      metadata: { processed },
    })

    return new Response(JSON.stringify({ processed }), {
      headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
    })
  } catch (err) {
    console.error('Scheduler error:', err)
    return new Response(JSON.stringify({ error: 'Scheduler failed' }), {
      status: 500,
      headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
    })
  }
})
