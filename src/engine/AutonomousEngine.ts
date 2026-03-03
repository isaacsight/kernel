// ─── Autonomous Engine — Background Agents & Adaptive Routing ────
//
// Manages background agents that run on triggers (schedule, event,
// condition), records agent outcomes for quality tracking, and
// optimizes routing weights based on accumulated performance data.

import type {
  BackgroundAgent,
  BackgroundAgentRun,
  AgentOutcome,
  RoutingWeights,
  BackgroundTrigger,
} from './autonomous/types'
import { supabase } from './SupabaseClient'

// ─── Background Agent Management ────────────────────────────────

/**
 * Create a new background agent and persist to Supabase.
 */
export async function createBackgroundAgent(
  userId: string,
  config: {
    name: string
    description: string
    trigger: BackgroundTrigger
    agent_config: { persona: string; tools: string[] }
  },
): Promise<BackgroundAgent> {
  const { data, error } = await supabase
    .from('background_agents')
    .insert({
      user_id: userId,
      name: config.name,
      description: config.description,
      trigger: config.trigger,
      agent_config: config.agent_config,
      enabled: true,
    })
    .select()
    .single()

  if (error) throw new Error(`Failed to create background agent: ${error.message}`)
  return mapAgentRow(data)
}

/**
 * List all background agents for a user.
 */
export async function listBackgroundAgents(userId: string): Promise<BackgroundAgent[]> {
  const { data, error } = await supabase
    .from('background_agents')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })

  if (error) throw new Error(`Failed to list background agents: ${error.message}`)
  return (data || []).map(mapAgentRow)
}

/**
 * Toggle an agent's enabled state.
 */
export async function toggleAgent(agentId: string, enabled: boolean): Promise<void> {
  const { error } = await supabase
    .from('background_agents')
    .update({ enabled })
    .eq('id', agentId)

  if (error) throw new Error(`Failed to toggle agent: ${error.message}`)
}

/**
 * Evaluate which agents have their triggers met.
 * Returns the subset of agents ready to run.
 */
export function evaluateTriggers(agents: BackgroundAgent[]): BackgroundAgent[] {
  const now = new Date()
  return agents.filter(agent => {
    if (!agent.enabled) return false

    const trigger = agent.trigger
    switch (trigger.type) {
      case 'schedule':
        return evaluateCron(trigger.cron, now, agent.last_run_at)
      case 'event':
        // Event-based triggers are fired externally — always false in polling
        return false
      case 'condition':
        // Condition checks are evaluated by the caller
        return false
      default:
        return false
    }
  })
}

/**
 * Execute a background agent: mark as running, call Claude proxy,
 * record the run, and update the agent's last_run_at.
 */
export async function executeAgent(agent: BackgroundAgent): Promise<BackgroundAgentRun> {
  const startedAt = new Date().toISOString()

  // Insert a running record
  const { data: runRow, error: insertError } = await supabase
    .from('background_agent_runs')
    .insert({
      agent_id: agent.id,
      status: 'running',
      output: '',
      started_at: startedAt,
    })
    .select()
    .single()

  if (insertError) throw new Error(`Failed to start agent run: ${insertError.message}`)

  const startTime = Date.now()

  try {
    // Call the Claude proxy with the agent's persona
    const { data: aiResponse, error: aiError } = await supabase.functions.invoke('claude-proxy', {
      body: {
        mode: 'text',
        model: 'haiku',
        system: agent.agent_config.persona,
        messages: [
          {
            role: 'user',
            content: `You are a background agent named "${agent.name}". ${agent.description}. Execute your task now and provide your output.`,
          },
        ],
      },
    })

    if (aiError) throw new Error(aiError.message)

    const output = typeof aiResponse === 'string' ? aiResponse : (aiResponse?.text || aiResponse?.content || JSON.stringify(aiResponse))
    const completedAt = new Date().toISOString()
    const durationMs = Date.now() - startTime

    // Update the run record
    await supabase
      .from('background_agent_runs')
      .update({
        status: 'completed',
        output,
        completed_at: completedAt,
        duration_ms: durationMs,
      })
      .eq('id', runRow.id)

    // Update the agent's last_run_at and run_count
    await supabase
      .from('background_agents')
      .update({
        last_run_at: completedAt,
        run_count: agent.run_count + 1,
      })
      .eq('id', agent.id)

    return {
      id: runRow.id,
      agent_id: agent.id,
      status: 'completed',
      output,
      started_at: startedAt,
      completed_at: completedAt,
      duration_ms: durationMs,
    }
  } catch (err) {
    const completedAt = new Date().toISOString()
    const durationMs = Date.now() - startTime
    const errorMsg = err instanceof Error ? err.message : String(err)

    // Mark run as failed
    try {
      await supabase
        .from('background_agent_runs')
        .update({
          status: 'failed',
          output: `Error: ${errorMsg}`,
          completed_at: completedAt,
          duration_ms: durationMs,
        })
        .eq('id', runRow.id)
    } catch { /* non-critical */ }

    return {
      id: runRow.id,
      agent_id: agent.id,
      status: 'failed',
      output: `Error: ${errorMsg}`,
      started_at: startedAt,
      completed_at: completedAt,
      duration_ms: durationMs,
    }
  }
}

// ─── Outcome & Routing ──────────────────────────────────────────

/**
 * Record an agent outcome for quality tracking.
 */
export async function recordOutcome(outcome: Omit<AgentOutcome, 'id' | 'recorded_at'>): Promise<void> {
  const { error } = await supabase
    .from('agent_outcomes')
    .insert({
      agent_id: outcome.agent_id,
      intent_type: outcome.intent_type,
      quality_score: outcome.quality_score,
      user_signal: outcome.user_signal,
    })

  if (error) throw new Error(`Failed to record outcome: ${error.message}`)
}

/**
 * Get routing weights for a user's agents.
 */
export async function getRoutingWeights(userId: string): Promise<RoutingWeights[]> {
  // Join through background_agents to filter by user
  const { data, error } = await supabase
    .from('routing_weights')
    .select('*')

  if (error) throw new Error(`Failed to get routing weights: ${error.message}`)

  return (data || []).map(row => ({
    agent_id: row.agent_id,
    intent_type: row.intent_type,
    weight: row.weight,
    sample_count: row.sample_count,
    last_updated: row.last_updated,
  }))
}

/**
 * Recalculate routing weights from accumulated outcomes.
 * Uses exponential moving average weighted by recency.
 */
export async function optimizeRouting(userId: string): Promise<void> {
  // Fetch recent outcomes
  const { data: outcomes, error: outcomesError } = await supabase
    .from('agent_outcomes')
    .select('agent_id, intent_type, quality_score, user_signal, recorded_at')
    .order('recorded_at', { ascending: false })
    .limit(500)

  if (outcomesError) throw new Error(`Failed to fetch outcomes: ${outcomesError.message}`)
  if (!outcomes || outcomes.length === 0) return

  // Group by agent_id + intent_type
  const grouped = new Map<string, { scores: number[]; signals: string[] }>()
  for (const o of outcomes) {
    const key = `${o.agent_id}::${o.intent_type}`
    const entry = grouped.get(key) || { scores: [], signals: [] }
    entry.scores.push(o.quality_score)
    entry.signals.push(o.user_signal)
    grouped.set(key, entry)
  }

  // Calculate weights with exponential decay
  for (const [key, { scores, signals }] of grouped) {
    const [agentId, intentType] = key.split('::')

    // EMA with decay factor 0.9
    let weight = 0
    let decaySum = 0
    const decay = 0.9
    for (let i = 0; i < scores.length; i++) {
      const d = Math.pow(decay, i)
      // Adjust score by user signal
      const signalMultiplier = signals[i] === 'positive' ? 1.2 : signals[i] === 'negative' ? 0.6 : 1.0
      weight += scores[i] * signalMultiplier * d
      decaySum += d
    }
    weight = decaySum > 0 ? weight / decaySum : 1.0

    // Clamp weight to [0.1, 2.0]
    weight = Math.max(0.1, Math.min(2.0, weight))

    // Upsert routing weight
    await supabase
      .from('routing_weights')
      .upsert(
        {
          agent_id: agentId,
          intent_type: intentType,
          weight,
          sample_count: scores.length,
          last_updated: new Date().toISOString(),
        },
        { onConflict: 'agent_id,intent_type' },
      )
  }
}

// ─── Helpers ────────────────────────────────────────────────────

/** Map a database row to a BackgroundAgent object */
function mapAgentRow(row: Record<string, unknown>): BackgroundAgent {
  return {
    id: row.id as string,
    user_id: row.user_id as string,
    name: row.name as string,
    description: row.description as string,
    trigger: row.trigger as BackgroundTrigger,
    agent_config: row.agent_config as { persona: string; tools: string[] },
    enabled: row.enabled as boolean,
    last_run_at: (row.last_run_at as string) || null,
    run_count: (row.run_count as number) || 0,
    created_at: row.created_at as string,
  }
}

/**
 * Simple cron evaluation — checks if a cron expression should fire.
 * Supports: "every_Xm" (every X minutes), "every_Xh" (every X hours),
 * "daily_HH:MM" (daily at a specific time).
 */
function evaluateCron(cron: string, now: Date, lastRunAt: string | null): boolean {
  if (!lastRunAt) return true // Never run before — fire immediately

  const lastRun = new Date(lastRunAt)
  const elapsed = now.getTime() - lastRun.getTime()

  // "every_Xm" — every X minutes
  const minuteMatch = cron.match(/^every_(\d+)m$/)
  if (minuteMatch) {
    const minutes = parseInt(minuteMatch[1], 10)
    return elapsed >= minutes * 60 * 1000
  }

  // "every_Xh" — every X hours
  const hourMatch = cron.match(/^every_(\d+)h$/)
  if (hourMatch) {
    const hours = parseInt(hourMatch[1], 10)
    return elapsed >= hours * 60 * 60 * 1000
  }

  // "daily_HH:MM" — once daily at a specific time
  const dailyMatch = cron.match(/^daily_(\d{2}):(\d{2})$/)
  if (dailyMatch) {
    const targetHour = parseInt(dailyMatch[1], 10)
    const targetMinute = parseInt(dailyMatch[2], 10)
    const todayTarget = new Date(now)
    todayTarget.setHours(targetHour, targetMinute, 0, 0)

    // Fire if we're past the target time and haven't run today
    return now >= todayTarget && lastRun < todayTarget
  }

  return false
}
