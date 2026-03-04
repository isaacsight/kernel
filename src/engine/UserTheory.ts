// ═══════════════════════════════════════════════════════════════
//  UserTheory — Predictive user model
// ═══════════════════════════════════════════════════════════════
//
//  Maintains a theory of what the user wants, how they engage,
//  and what they'll need next. Calibrated from Loom outcomes
//  every 5 recordings.
//
//  Injected into system prompts to pre-adapt agent behavior
//  before the user even speaks.
//
// ═══════════════════════════════════════════════════════════════

import { getBackgroundProvider } from './providers/registry'
import type { Outcome } from './Loom'

// ── Types ─────────────────────────────────────────────────

export type ResponseLengthPref = 'brief' | 'moderate' | 'detailed'
export type UserMode = 'exploring' | 'building' | 'reflecting' | 'deciding'

export interface UserTheoryState {
  preferredResponseLength: ResponseLengthPref
  currentMode: UserMode
  engagementPrediction: number       // 0-1 likelihood they'll continue engaging
  topicFatigue: Record<string, number>  // topic → saturation score 0-1
  likelyNextTopics: string[]         // predicted next 3 topics
  calibratedAt: number
  outcomesSinceCalibration: number
}

// ── Constants ─────────────────────────────────────────────

const CALIBRATION_INTERVAL = 5  // calibrate every 5 Loom outcomes

const CALIBRATION_SYSTEM = `You are the Oracle — Kernel's predictive intelligence. Given recent interaction outcomes, build a theory of what this user wants and needs.

Analyze the outcomes to determine:
1. preferredResponseLength: "brief" (user sends short msgs, prefers quick answers), "moderate" (balanced), "detailed" (user engages with depth)
2. currentMode: "exploring" (broad questions, topic-hopping), "building" (specific tasks, creation), "reflecting" (introspective, meaning-seeking), "deciding" (weighing options, seeking advice)
3. engagementPrediction: 0-1 how likely they are to continue engaging based on recent signals
4. topicFatigue: topics they've been asking about too much (saturation > 0.7 = fatigued)
5. likelyNextTopics: 1-3 topics they're likely to bring up next based on patterns

Respond with ONLY valid JSON:
{"preferredResponseLength": "moderate", "currentMode": "building", "engagementPrediction": 0.8, "topicFatigue": {"coding": 0.3}, "likelyNextTopics": ["deployment", "testing"]}`

// ── Empty State ───────────────────────────────────────────

export function emptyUserTheory(): UserTheoryState {
  return {
    preferredResponseLength: 'moderate',
    currentMode: 'exploring',
    engagementPrediction: 0.5,
    topicFatigue: {},
    likelyNextTopics: [],
    calibratedAt: 0,
    outcomesSinceCalibration: 0,
  }
}

// ── Calibration ───────────────────────────────────────────

/** Should we recalibrate? True every 5 Loom outcomes. */
export function shouldCalibrate(theory: UserTheoryState): boolean {
  return theory.outcomesSinceCalibration >= CALIBRATION_INTERVAL
}

/** Increment the outcome counter */
export function recordOutcomeForTheory(theory: UserTheoryState): UserTheoryState {
  return {
    ...theory,
    outcomesSinceCalibration: theory.outcomesSinceCalibration + 1,
  }
}

/** Calibrate UserTheory from recent Loom outcomes */
export async function calibrateTheory(
  currentTheory: UserTheoryState,
  recentOutcomes: Outcome[],
): Promise<UserTheoryState> {
  if (recentOutcomes.length < 3) return currentTheory

  try {
    const outcomeSummary = recentOutcomes.slice(-15).map(o => {
      const parts = [
        `agent=${o.agentUsed}`,
        `quality=${o.effectiveQuality.toFixed(2)}`,
        `continued=${o.userSignal.continued}`,
        `latency=${o.userSignal.messageLatencyMs}ms`,
        `lengthDelta=${o.userSignal.lengthDelta.toFixed(2)}`,
      ]
      if (o.userSignal.rephrased) parts.push('rephrased')
      if (o.userSignal.abandoned) parts.push('abandoned')
      return parts.join(', ')
    }).join('\n')

    const result = await getBackgroundProvider().json<{
      preferredResponseLength: ResponseLengthPref
      currentMode: UserMode
      engagementPrediction: number
      topicFatigue: Record<string, number>
      likelyNextTopics: string[]
    }>(
      `Recent interaction outcomes:\n${outcomeSummary}`,
      { system: CALIBRATION_SYSTEM, tier: 'fast', max_tokens: 300, feature: 'theory' },
    )

    return {
      preferredResponseLength: (['brief', 'moderate', 'detailed'].includes(result.preferredResponseLength)
        ? result.preferredResponseLength
        : currentTheory.preferredResponseLength) as ResponseLengthPref,
      currentMode: (['exploring', 'building', 'reflecting', 'deciding'].includes(result.currentMode)
        ? result.currentMode
        : currentTheory.currentMode) as UserMode,
      engagementPrediction: Math.min(1, Math.max(0, result.engagementPrediction ?? 0.5)),
      topicFatigue: result.topicFatigue || {},
      likelyNextTopics: (result.likelyNextTopics || []).slice(0, 3),
      calibratedAt: Date.now(),
      outcomesSinceCalibration: 0,
    }
  } catch (err) {
    console.warn('[UserTheory] Calibration failed:', err)
    return { ...currentTheory, outcomesSinceCalibration: 0 }
  }
}

// ── Prompt Formatting ─────────────────────────────────────

export function formatTheoryForPrompt(theory: UserTheoryState): string {
  if (!theory || theory.calibratedAt === 0) return ''

  const parts: string[] = []

  // Response length adaptation
  const lengthDirectives: Record<ResponseLengthPref, string> = {
    brief: 'This user prefers concise responses. Lead with the answer, skip preamble.',
    moderate: 'This user engages with moderate depth. Balance thoroughness with clarity.',
    detailed: 'This user values detailed responses. Go deep, show your reasoning.',
  }
  parts.push(lengthDirectives[theory.preferredResponseLength])

  // Mode adaptation
  const modeDirectives: Record<UserMode, string> = {
    exploring: 'They are in exploration mode — offer breadth, connections, and "have you considered..." prompts.',
    building: 'They are in build mode — be practical, give working solutions, skip theory.',
    reflecting: 'They are in reflection mode — be thoughtful, ask good questions, mirror their thinking.',
    deciding: 'They are in decision mode — structure trade-offs, give clear recommendations, quantify when possible.',
  }
  parts.push(modeDirectives[theory.currentMode])

  // Topic fatigue
  const fatigued = Object.entries(theory.topicFatigue)
    .filter(([, score]) => score > 0.7)
    .map(([topic]) => topic)
  if (fatigued.length > 0) {
    parts.push(`Topic fatigue detected on: ${fatigued.join(', ')}. Consider gently pivoting or going deeper rather than repeating.`)
  }

  return parts.join('\n')
}

// ── Serialization ─────────────────────────────────────────

export function serializeUserTheory(theory: UserTheoryState): Record<string, unknown> {
  return { ...theory }
}

export function deserializeUserTheory(data: Record<string, unknown> | null): UserTheoryState {
  if (!data || !data.calibratedAt) return emptyUserTheory()
  return {
    preferredResponseLength: (data.preferredResponseLength as ResponseLengthPref) || 'moderate',
    currentMode: (data.currentMode as UserMode) || 'exploring',
    engagementPrediction: (data.engagementPrediction as number) || 0.5,
    topicFatigue: (data.topicFatigue as Record<string, number>) || {},
    likelyNextTopics: (data.likelyNextTopics as string[]) || [],
    calibratedAt: (data.calibratedAt as number) || 0,
    outcomesSinceCalibration: (data.outcomesSinceCalibration as number) || 0,
  }
}
