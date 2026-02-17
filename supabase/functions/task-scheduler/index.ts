// Supabase Edge Function: task-scheduler
// Called every 5 min by external cron. Queries due tasks, executes them,
// updates next_run_at.
//
// Deploy: npx supabase functions deploy task-scheduler --project-ref eoxxpyixdieprsxlpwcs

import { serve } from 'https://deno.land/std@0.177.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

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
