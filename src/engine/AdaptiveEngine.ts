// ─── Adaptive Engine — Self-Improving Intelligence Layer ────────
//
// Engine #10 in the Kernel system. Observes every interaction,
// builds a model of what works for each user, and feeds hints
// back into prompt engineering to make responses progressively better.
//
// Key insight: This engine watches EVERY signal (thumbs up/down,
// copies, retries, edits) and uses exponential moving averages
// to learn each user's preferences over time.

import { supabase } from './SupabaseClient'
import type {
  AdaptiveSignal,
  AdaptiveSignalType,
  AdaptiveProfile,
  ResponsePreferences,
  ResponseHints,
  Experiment,
  ExperimentVariant,
  AdaptiveInsight,
  QualityMetrics,
  AdaptationHistoryEntry,
} from './adaptive/types'

// ─── Constants ──────────────────────────────────────────────

const TABLE_SIGNALS = 'adaptive_signals'
const TABLE_PROFILES = 'adaptive_profiles'
const TABLE_EXPERIMENTS = 'adaptive_experiments'
const TABLE_INSIGHTS = 'adaptive_insights'
const TABLE_HISTORY = 'adaptive_history'

/** Exponential moving average decay factor (0–1). Higher = more weight on recent signals. */
const EMA_ALPHA = 0.15

/** Minimum signals before we consider the profile "trained" */
const MIN_SIGNALS_FOR_PROFILE = 5

/** Positive signal types that indicate satisfaction */
const POSITIVE_SIGNALS: AdaptiveSignalType[] = ['thumbs_up', 'copy', 'share', 'expand', 'follow_up']

/** Negative signal types that indicate dissatisfaction */
const NEGATIVE_SIGNALS: AdaptiveSignalType[] = ['thumbs_down', 'retry', 'edit']

/** Neutral signal types */
const NEUTRAL_SIGNALS: AdaptiveSignalType[] = ['ignore']

// ─── Default Profile ────────────────────────────────────────

const DEFAULT_PREFERENCES: ResponsePreferences = {
  preferredLength: 'moderate',
  preferredTone: 'balanced',
  preferredDetail: 'moderate',
  preferredFormat: 'mixed',
}

function defaultProfile(userId: string): AdaptiveProfile {
  return {
    userId,
    responsePreferences: { ...DEFAULT_PREFERENCES },
    agentPreferences: {},
    topicAffinities: {},
    satisfactionTrend: [],
    lastUpdated: Date.now(),
  }
}

// ─── Signal Recording ───────────────────────────────────────

/**
 * Record a user quality signal (thumbs up/down, copy, retry, etc.).
 * Stored in Supabase for later analysis.
 */
export async function recordSignal(
  signal: Omit<AdaptiveSignal, 'id'>,
): Promise<AdaptiveSignal | null> {
  const id = `as_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
  const full: AdaptiveSignal = { ...signal, id }

  const { error } = await supabase
    .from(TABLE_SIGNALS)
    .insert({
      id: full.id,
      user_id: full.userId,
      type: full.type,
      message_id: full.messageId || null,
      agent_id: full.agentId || null,
      engine_id: full.engineId || null,
      context: full.context || null,
      created_at: new Date(full.timestamp).toISOString(),
    })

  if (error) {
    console.error('[adaptive] Error recording signal:', error)
    // Fall back to localStorage if Supabase fails
    appendLocalSignal(full)
    return full
  }

  return full
}

// ─── Profile Management ─────────────────────────────────────

/**
 * Get the user's adaptive profile (preferences learned from signals).
 */
export async function getAdaptiveProfile(userId: string): Promise<AdaptiveProfile> {
  const { data, error } = await supabase
    .from(TABLE_PROFILES)
    .select('*')
    .eq('user_id', userId)
    .maybeSingle()

  if (error) {
    console.error('[adaptive] Error fetching profile:', error)
    return defaultProfile(userId)
  }

  if (!data) return defaultProfile(userId)

  return {
    userId: data.user_id,
    responsePreferences: (data.response_preferences as ResponsePreferences) || { ...DEFAULT_PREFERENCES },
    agentPreferences: (data.agent_preferences as Record<string, number>) || {},
    topicAffinities: (data.topic_affinities as Record<string, number>) || {},
    satisfactionTrend: (data.satisfaction_trend as number[]) || [],
    lastUpdated: new Date(data.updated_at).getTime(),
  }
}

/**
 * Recalculate profile from accumulated signals using exponential moving average.
 * This is the core adaptation algorithm.
 */
export async function updateAdaptiveProfile(userId: string): Promise<AdaptiveProfile> {
  // Fetch recent signals (last 200)
  const { data: signals, error } = await supabase
    .from(TABLE_SIGNALS)
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(200)

  if (error || !signals || signals.length < MIN_SIGNALS_FOR_PROFILE) {
    return getAdaptiveProfile(userId)
  }

  // Get existing profile as baseline
  const existing = await getAdaptiveProfile(userId)
  const profile = { ...existing }

  // ─── Calculate satisfaction trend (EMA) ───────────────
  const satisfactionScores: number[] = []
  for (const s of signals.reverse()) {
    const type = s.type as AdaptiveSignalType
    let score = 0.5 // neutral
    if (POSITIVE_SIGNALS.includes(type)) score = 1.0
    if (NEGATIVE_SIGNALS.includes(type)) score = 0.0
    satisfactionScores.push(score)
  }

  // Apply EMA
  const emaTrend: number[] = []
  let emaValue = satisfactionScores[0] ?? 0.5
  for (const score of satisfactionScores) {
    emaValue = EMA_ALPHA * score + (1 - EMA_ALPHA) * emaValue
    emaTrend.push(Math.round(emaValue * 100) / 100)
  }
  profile.satisfactionTrend = emaTrend.slice(-50)

  // ─── Infer response length preference ─────────────────
  const positiveSignals = signals.filter(s => POSITIVE_SIGNALS.includes(s.type))
  const negativeSignals = signals.filter(s => NEGATIVE_SIGNALS.includes(s.type))

  // If user frequently retries or edits, they may want different length/detail
  const retryRate = signals.filter(s => s.type === 'retry').length / signals.length
  const editRate = signals.filter(s => s.type === 'edit').length / signals.length
  const copyRate = signals.filter(s => s.type === 'copy').length / signals.length
  const expandRate = signals.filter(s => s.type === 'expand').length / signals.length

  // High expand rate → user wants more detail
  if (expandRate > 0.2) {
    profile.responsePreferences.preferredLength = 'detailed'
    profile.responsePreferences.preferredDetail = 'granular'
  } else if (copyRate > 0.3 && retryRate < 0.1) {
    // High copy rate with low retry → current style works well
    // Keep existing preferences
  } else if (retryRate > 0.2) {
    // High retry rate → something isn't working, nudge toward moderate
    profile.responsePreferences.preferredLength = 'moderate'
  }

  // ─── Agent preferences (EMA per agent) ────────────────
  const agentScores: Record<string, number[]> = {}
  for (const s of signals) {
    if (!s.agent_id) continue
    if (!agentScores[s.agent_id]) agentScores[s.agent_id] = []
    const score = POSITIVE_SIGNALS.includes(s.type) ? 1 : NEGATIVE_SIGNALS.includes(s.type) ? 0 : 0.5
    agentScores[s.agent_id].push(score)
  }

  for (const [agentId, scores] of Object.entries(agentScores)) {
    let agentEma = 0.5
    for (const score of scores) {
      agentEma = EMA_ALPHA * score + (1 - EMA_ALPHA) * agentEma
    }
    profile.agentPreferences[agentId] = Math.round(agentEma * 100) / 100
  }

  // ─── Topic affinities (from context) ──────────────────
  for (const s of signals) {
    const ctx = s.context as Record<string, unknown> | null
    const topic = ctx?.topic as string | undefined
    if (!topic) continue

    const current = profile.topicAffinities[topic] || 0.5
    const score = POSITIVE_SIGNALS.includes(s.type) ? 1 : NEGATIVE_SIGNALS.includes(s.type) ? 0 : 0.5
    profile.topicAffinities[topic] = Math.round((EMA_ALPHA * score + (1 - EMA_ALPHA) * current) * 100) / 100
  }

  profile.lastUpdated = Date.now()

  // ─── Persist to Supabase ──────────────────────────────
  const { error: upsertError } = await supabase
    .from(TABLE_PROFILES)
    .upsert({
      user_id: userId,
      response_preferences: profile.responsePreferences,
      agent_preferences: profile.agentPreferences,
      topic_affinities: profile.topicAffinities,
      satisfaction_trend: profile.satisfactionTrend,
      updated_at: new Date().toISOString(),
    })

  if (upsertError) {
    console.error('[adaptive] Error upserting profile:', upsertError)
  }

  return profile
}

// ─── Response Hints ─────────────────────────────────────────

/**
 * Get hints for response generation based on accumulated learning.
 * These hints are injected into prompts to personalize responses.
 */
export async function getResponseHints(
  userId: string,
  intent?: string,
): Promise<ResponseHints> {
  const profile = await getAdaptiveProfile(userId)
  const trend = profile.satisfactionTrend
  const recentSatisfaction = trend.length > 0 ? trend[trend.length - 1] : 0.5

  // Find top-performing agents
  const topAgents = Object.entries(profile.agentPreferences)
    .sort(([, a], [, b]) => b - a)
    .slice(0, 3)
    .filter(([, score]) => score > 0.5)
    .map(([id]) => id)

  // Build suggestions based on patterns
  const suggestions: string[] = []

  if (recentSatisfaction < 0.4) {
    suggestions.push('Recent satisfaction is low — consider asking if the response style is helpful')
  }
  if (profile.responsePreferences.preferredLength === 'concise') {
    suggestions.push('User prefers concise responses — keep it brief')
  }
  if (profile.responsePreferences.preferredLength === 'detailed') {
    suggestions.push('User prefers detailed responses — be thorough')
  }
  if (profile.responsePreferences.preferredFormat === 'structured') {
    suggestions.push('User prefers structured output — use headers, lists, sections')
  }

  // Intent-specific hints
  if (intent) {
    const topicAffinity = profile.topicAffinities[intent]
    if (topicAffinity !== undefined && topicAffinity > 0.7) {
      suggestions.push(`User engages well with "${intent}" topics`)
    }
  }

  return {
    preferredLength: profile.responsePreferences.preferredLength,
    preferredTone: profile.responsePreferences.preferredTone,
    preferredDetail: profile.responsePreferences.preferredDetail,
    preferredFormat: profile.responsePreferences.preferredFormat,
    topAgents,
    recentSatisfaction,
    suggestions,
  }
}

// ─── Experiments (A/B Testing) ──────────────────────────────

/**
 * Create a new A/B experiment.
 */
export async function createExperiment(
  experiment: Omit<Experiment, 'id'>,
): Promise<Experiment | null> {
  const id = `exp_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
  const full: Experiment = { ...experiment, id }

  const { error } = await supabase
    .from(TABLE_EXPERIMENTS)
    .insert({
      id: full.id,
      name: full.name,
      description: full.description,
      variants: full.variants,
      status: full.status,
      started_at: full.startedAt ? new Date(full.startedAt).toISOString() : null,
      completed_at: full.completedAt ? new Date(full.completedAt).toISOString() : null,
      winning_variant: full.winningVariant || null,
    })

  if (error) {
    console.error('[adaptive] Error creating experiment:', error)
    return null
  }

  return full
}

/**
 * Deterministically assign a user to an experiment variant (hash-based).
 * Same user + experiment always gets the same variant.
 */
export function assignVariant(userId: string, experimentId: string, variants: ExperimentVariant[]): string {
  if (variants.length === 0) return ''

  // Simple hash: sum of char codes
  const combined = `${userId}:${experimentId}`
  let hash = 0
  for (let i = 0; i < combined.length; i++) {
    hash = ((hash << 5) - hash + combined.charCodeAt(i)) | 0
  }

  const index = Math.abs(hash) % variants.length
  return variants[index].id
}

/**
 * Record the outcome of an experiment variant.
 */
export async function recordExperimentOutcome(
  experimentId: string,
  variantId: string,
  success: boolean,
): Promise<void> {
  const { data: experiment, error } = await supabase
    .from(TABLE_EXPERIMENTS)
    .select('variants')
    .eq('id', experimentId)
    .maybeSingle()

  if (error || !experiment) {
    console.error('[adaptive] Error fetching experiment for outcome:', error)
    return
  }

  const variants = (experiment.variants as ExperimentVariant[]) || []
  const variant = variants.find(v => v.id === variantId)
  if (!variant) return

  variant.sampleSize += 1
  // Running success rate = (old_rate * (n-1) + new_outcome) / n
  variant.successRate =
    ((variant.successRate * (variant.sampleSize - 1)) + (success ? 1 : 0)) / variant.sampleSize

  const { error: updateError } = await supabase
    .from(TABLE_EXPERIMENTS)
    .update({ variants })
    .eq('id', experimentId)

  if (updateError) {
    console.error('[adaptive] Error updating experiment outcome:', updateError)
  }
}

/**
 * Statistical analysis of running experiments.
 * Checks if any variant has a statistically significant lead.
 */
export async function analyzeExperiments(): Promise<Experiment[]> {
  const { data, error } = await supabase
    .from(TABLE_EXPERIMENTS)
    .select('*')
    .eq('status', 'running')

  if (error || !data) {
    console.error('[adaptive] Error fetching experiments:', error)
    return []
  }

  const analyzed: Experiment[] = []

  for (const row of data) {
    const variants = (row.variants as ExperimentVariant[]) || []
    const experiment: Experiment = {
      id: row.id,
      name: row.name,
      description: row.description,
      variants,
      status: row.status,
      startedAt: row.started_at ? new Date(row.started_at).getTime() : undefined,
      completedAt: row.completed_at ? new Date(row.completed_at).getTime() : undefined,
      winningVariant: row.winning_variant || undefined,
    }

    // Check for statistical significance (simplified)
    // Require min 30 samples per variant and > 10% difference
    const qualified = variants.filter(v => v.sampleSize >= 30)
    if (qualified.length >= 2) {
      const sorted = [...qualified].sort((a, b) => b.successRate - a.successRate)
      const best = sorted[0]
      const second = sorted[1]
      const diff = best.successRate - second.successRate

      if (diff > 0.1) {
        experiment.winningVariant = best.id
        experiment.status = 'completed'
        experiment.completedAt = Date.now()

        // Persist winner
        await supabase
          .from(TABLE_EXPERIMENTS)
          .update({
            status: 'completed',
            winning_variant: best.id,
            completed_at: new Date().toISOString(),
            variants,
          })
          .eq('id', experiment.id)
      }
    }

    analyzed.push(experiment)
  }

  return analyzed
}

// ─── Insights Discovery ─────────────────────────────────────

/**
 * Analyze signal patterns to surface insights about user behavior.
 */
export async function discoverInsights(userId: string): Promise<AdaptiveInsight[]> {
  const { data: signals, error } = await supabase
    .from(TABLE_SIGNALS)
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(500)

  if (error || !signals || signals.length < 5) return []

  const insights: AdaptiveInsight[] = []
  const now = Date.now()

  // ─── Pattern: Agent preference ────────────────────────
  const agentPositive: Record<string, number> = {}
  const agentTotal: Record<string, number> = {}
  for (const s of signals) {
    if (!s.agent_id) continue
    agentTotal[s.agent_id] = (agentTotal[s.agent_id] || 0) + 1
    if (POSITIVE_SIGNALS.includes(s.type)) {
      agentPositive[s.agent_id] = (agentPositive[s.agent_id] || 0) + 1
    }
  }
  for (const [agent, total] of Object.entries(agentTotal)) {
    if (total < 5) continue
    const rate = (agentPositive[agent] || 0) / total
    if (rate > 0.75) {
      insights.push({
        id: `insight_agent_${agent}_${now}`,
        type: 'pattern',
        title: `Strong preference for ${agent}`,
        description: `${Math.round(rate * 100)}% positive signals when ${agent} responds (${total} interactions)`,
        confidence: Math.min(0.95, 0.5 + total / 100),
        data: { agent, positiveRate: rate, total },
        createdAt: now,
      })
    }
  }

  // ─── Pattern: Time-of-day engagement ──────────────────
  const hourBuckets = new Array(24).fill(0)
  const hourPositive = new Array(24).fill(0)
  for (const s of signals) {
    const hour = new Date(s.created_at).getHours()
    hourBuckets[hour]++
    if (POSITIVE_SIGNALS.includes(s.type)) hourPositive[hour]++
  }
  const peakHour = hourBuckets.indexOf(Math.max(...hourBuckets))
  if (hourBuckets[peakHour] > 10) {
    const period = peakHour < 6 ? 'late night' :
      peakHour < 12 ? 'morning' :
      peakHour < 18 ? 'afternoon' : 'evening'
    insights.push({
      id: `insight_peak_time_${now}`,
      type: 'trend',
      title: `Peak engagement: ${period}`,
      description: `Most active around ${peakHour}:00 with ${hourBuckets[peakHour]} interactions`,
      confidence: 0.7,
      data: { peakHour, count: hourBuckets[peakHour] },
      createdAt: now,
    })
  }

  // ─── Pattern: Retry frequency (quality indicator) ─────
  const retryCount = signals.filter(s => s.type === 'retry').length
  const retryRate = retryCount / signals.length
  if (retryRate > 0.15 && signals.length > 20) {
    insights.push({
      id: `insight_high_retry_${now}`,
      type: 'anomaly',
      title: 'High retry rate detected',
      description: `${Math.round(retryRate * 100)}% of interactions involve retries — responses may need adjustment`,
      confidence: 0.8,
      data: { retryRate, retryCount, total: signals.length },
      createdAt: now,
    })
  }

  // ─── Recommendation: Based on satisfaction trend ──────
  const profile = await getAdaptiveProfile(userId)
  const trend = profile.satisfactionTrend
  if (trend.length >= 10) {
    const recentAvg = trend.slice(-10).reduce((s, v) => s + v, 0) / 10
    const olderAvg = trend.slice(-20, -10).reduce((s, v) => s + v, 0) / Math.min(10, trend.slice(-20, -10).length || 1)

    if (recentAvg > olderAvg + 0.1) {
      insights.push({
        id: `insight_improving_${now}`,
        type: 'trend',
        title: 'Satisfaction is improving',
        description: `Recent satisfaction (${Math.round(recentAvg * 100)}%) is up from earlier (${Math.round(olderAvg * 100)}%)`,
        confidence: 0.75,
        data: { recentAvg, olderAvg },
        createdAt: now,
      })
    } else if (recentAvg < olderAvg - 0.1) {
      insights.push({
        id: `insight_declining_${now}`,
        type: 'anomaly',
        title: 'Satisfaction is declining',
        description: `Recent satisfaction (${Math.round(recentAvg * 100)}%) is down from earlier (${Math.round(olderAvg * 100)}%)`,
        confidence: 0.75,
        data: { recentAvg, olderAvg },
        createdAt: now,
      })
    }
  }

  // ─── Recommendation: Copy-heavy users ─────────────────
  const copyCount = signals.filter(s => s.type === 'copy').length
  if (copyCount / signals.length > 0.3 && signals.length > 15) {
    insights.push({
      id: `insight_copy_heavy_${now}`,
      type: 'recommendation',
      title: 'Optimize for copy-ability',
      description: 'User frequently copies responses — consider more structured, copy-ready formatting',
      confidence: 0.7,
      data: { copyRate: copyCount / signals.length },
      createdAt: now,
    })
  }

  // Persist insights
  for (const insight of insights) {
    await supabase
      .from(TABLE_INSIGHTS)
      .upsert({
        id: insight.id,
        user_id: userId,
        type: insight.type,
        title: insight.title,
        description: insight.description,
        confidence: insight.confidence,
        data: insight.data || null,
        created_at: new Date(insight.createdAt).toISOString(),
      })
      .then(({ error: e }) => {
        if (e) console.error('[adaptive] Error persisting insight:', e)
      })
  }

  return insights
}

// ─── Quality Metrics ────────────────────────────────────────

/**
 * Overall quality metrics dashboard for a user.
 */
export async function getQualityMetrics(userId: string): Promise<QualityMetrics> {
  const { data: signals, error } = await supabase
    .from(TABLE_SIGNALS)
    .select('type, agent_id, engine_id')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(100)

  if (error || !signals || signals.length === 0) {
    return {
      responseQuality: 0.5,
      userSatisfaction: 0.5,
      agentAccuracy: 0.5,
      engineEfficiency: 0.5,
      adaptationRate: 0,
    }
  }

  const total = signals.length
  const positiveCount = signals.filter(s => POSITIVE_SIGNALS.includes(s.type)).length
  const negativeCount = signals.filter(s => NEGATIVE_SIGNALS.includes(s.type)).length
  const neutralCount = total - positiveCount - negativeCount

  // Response quality: weighted score (positive=1, neutral=0.5, negative=0)
  const responseQuality = (positiveCount * 1 + neutralCount * 0.5) / total

  // User satisfaction: pure positive ratio
  const userSatisfaction = positiveCount / total

  // Agent accuracy: how often the routed agent gets positive signals
  const agentSignals = signals.filter(s => s.agent_id)
  const agentAccuracy = agentSignals.length > 0
    ? agentSignals.filter(s => POSITIVE_SIGNALS.includes(s.type)).length / agentSignals.length
    : 0.5

  // Engine efficiency: inverse of retry rate (fewer retries = more efficient)
  const retryCount = signals.filter(s => s.type === 'retry').length
  const engineEfficiency = 1 - (retryCount / total)

  // Adaptation rate: how much the profile has changed (measured by satisfaction trend slope)
  const profile = await getAdaptiveProfile(userId)
  const trend = profile.satisfactionTrend
  let adaptationRate = 0
  if (trend.length >= 5) {
    const first5 = trend.slice(0, 5).reduce((s, v) => s + v, 0) / 5
    const last5 = trend.slice(-5).reduce((s, v) => s + v, 0) / 5
    adaptationRate = Math.max(0, last5 - first5)
  }

  return {
    responseQuality: Math.round(responseQuality * 100) / 100,
    userSatisfaction: Math.round(userSatisfaction * 100) / 100,
    agentAccuracy: Math.round(agentAccuracy * 100) / 100,
    engineEfficiency: Math.round(engineEfficiency * 100) / 100,
    adaptationRate: Math.round(adaptationRate * 100) / 100,
  }
}

// ─── Adaptation History ─────────────────────────────────────

/**
 * History of profile changes over time.
 */
export async function getAdaptationHistory(
  userId: string,
  limit = 20,
): Promise<AdaptationHistoryEntry[]> {
  const { data, error } = await supabase
    .from(TABLE_HISTORY)
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(limit)

  if (error || !data) {
    console.error('[adaptive] Error fetching adaptation history:', error)
    return []
  }

  return data.map(row => ({
    timestamp: new Date(row.created_at).getTime(),
    field: row.field,
    oldValue: row.old_value,
    newValue: row.new_value,
    reason: row.reason,
  }))
}

// ─── Fetch Experiments ──────────────────────────────────────

/**
 * Get all experiments, optionally filtered by status.
 */
export async function getExperiments(
  status?: Experiment['status'],
): Promise<Experiment[]> {
  let query = supabase
    .from(TABLE_EXPERIMENTS)
    .select('*')
    .order('started_at', { ascending: false })

  if (status) query = query.eq('status', status)

  const { data, error } = await query

  if (error || !data) {
    console.error('[adaptive] Error fetching experiments:', error)
    return []
  }

  return data.map(row => ({
    id: row.id,
    name: row.name,
    description: row.description,
    variants: (row.variants as ExperimentVariant[]) || [],
    status: row.status,
    startedAt: row.started_at ? new Date(row.started_at).getTime() : undefined,
    completedAt: row.completed_at ? new Date(row.completed_at).getTime() : undefined,
    winningVariant: row.winning_variant || undefined,
  }))
}

// ─── Fetch Insights ─────────────────────────────────────────

/**
 * Get persisted insights for a user.
 */
export async function getInsights(
  userId: string,
  limit = 20,
): Promise<AdaptiveInsight[]> {
  const { data, error } = await supabase
    .from(TABLE_INSIGHTS)
    .select('*')
    .eq('user_id', userId)
    .order('confidence', { ascending: false })
    .limit(limit)

  if (error || !data) {
    console.error('[adaptive] Error fetching insights:', error)
    return []
  }

  return data.map(row => ({
    id: row.id,
    type: row.type,
    title: row.title,
    description: row.description,
    confidence: row.confidence,
    data: row.data || undefined,
    createdAt: new Date(row.created_at).getTime(),
  }))
}

// ─── Format Hints for Prompt Injection ──────────────────────

/**
 * Format response hints as a system prompt suffix.
 * This is the bridge between the Adaptive Engine and the AI response.
 */
export function formatHintsForPrompt(hints: ResponseHints): string {
  const parts: string[] = []

  parts.push('\n\nADAPTIVE PREFERENCES (learned from this user\'s interaction patterns):')

  const lengthMap = { concise: '2-3 paragraphs max', moderate: '3-5 paragraphs', detailed: '5+ paragraphs with depth' }
  parts.push(`- Response length: ${hints.preferredLength} (${lengthMap[hints.preferredLength]})`)

  const toneMap = { casual: 'conversational, relaxed', balanced: 'warm but professional', formal: 'structured, precise' }
  parts.push(`- Tone: ${hints.preferredTone} (${toneMap[hints.preferredTone]})`)

  const detailMap = { 'high-level': 'focus on the big picture', moderate: 'balance overview and detail', granular: 'include specifics and nuance' }
  parts.push(`- Detail level: ${hints.preferredDetail} (${detailMap[hints.preferredDetail]})`)

  const formatMap = { prose: 'flowing paragraphs', structured: 'headers, lists, sections', mixed: 'adapt to content' }
  parts.push(`- Format: ${hints.preferredFormat} (${formatMap[hints.preferredFormat]})`)

  if (hints.suggestions.length > 0) {
    parts.push('- Notes: ' + hints.suggestions.join('; '))
  }

  return parts.join('\n')
}

// ─── Local Fallback Storage ─────────────────────────────────

const LOCAL_KEY = 'kernel-adaptive-signals-pending'

function appendLocalSignal(signal: AdaptiveSignal): void {
  try {
    const existing = JSON.parse(localStorage.getItem(LOCAL_KEY) || '[]') as AdaptiveSignal[]
    existing.push(signal)
    // Cap at 100 pending signals
    const capped = existing.slice(-100)
    localStorage.setItem(LOCAL_KEY, JSON.stringify(capped))
  } catch {
    // Silent fail for storage issues
  }
}

/**
 * Flush any locally cached signals to Supabase.
 * Called on app startup or when connectivity is restored.
 */
export async function flushPendingSignals(): Promise<number> {
  try {
    const pending = JSON.parse(localStorage.getItem(LOCAL_KEY) || '[]') as AdaptiveSignal[]
    if (pending.length === 0) return 0

    const rows = pending.map(s => ({
      id: s.id,
      user_id: s.userId,
      type: s.type,
      message_id: s.messageId || null,
      agent_id: s.agentId || null,
      engine_id: s.engineId || null,
      context: s.context || null,
      created_at: new Date(s.timestamp).toISOString(),
    }))

    const { error } = await supabase.from(TABLE_SIGNALS).insert(rows)
    if (error) {
      console.error('[adaptive] Error flushing pending signals:', error)
      return 0
    }

    localStorage.removeItem(LOCAL_KEY)
    return rows.length
  } catch {
    return 0
  }
}
