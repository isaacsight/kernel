/**
 * Reasoning-failure taxonomy for the critic gate.
 *
 * Adopted verbatim from "Stalled, Biased, and Confused: Uncovering Reasoning
 * Failures in LLMs for Cloud-Based Root Cause Analysis" (arXiv:2601.22208,
 * 2026). 16 modes, evaluated across 48k simulated scenarios on ReAct and
 * Plan-and-Execute workflows. The domain is cloud RCA but the modes generalize
 * to tool-using agents.
 *
 * Purpose here: replace ad-hoc ERROR_KEYWORDS matching in critic-gate.ts with
 * a typed classifier so that when the critic rejects a tool result we can
 * attribute the rejection to a named class. Makes FP-rate measurement tractable
 * per-class instead of in aggregate.
 *
 * This module is pure (no I/O, no LLM calls). Classification is rule-based and
 * intentionally conservative — when nothing matches, returns null and the
 * existing critic fallback handles it.
 */

export type RFClass =
  | 'RF-01-fabricated-evidence'
  | 'RF-02-metric-interpretation'
  | 'RF-03-confused-provenance'
  | 'RF-04-temporal-misordering'
  | 'RF-05-spurious-causal-attribution'
  | 'RF-06-unjustified-instance-specificity'
  | 'RF-07-arbitrary-evidence-selection'
  | 'RF-08-evidential-insufficiency'
  | 'RF-09-failure-to-update-belief'
  | 'RF-10-simulation-role-confusion'
  | 'RF-11-excessive-speculation'
  | 'RF-12-repetition-failure-to-resume'
  | 'RF-13-anchoring-bias'
  | 'RF-14-invalid-inference-pattern'
  | 'RF-15-internal-contradiction'
  | 'RF-16-arithmetic-error'

export interface RFClassification {
  class: RFClass
  evidence: string
  confidence: number
}

export interface TrajectoryStep {
  tool: string
  args: Record<string, unknown>
  result: string
  timestampMs: number
}

const SPECULATION_MARKERS = [
  'i think', 'probably', 'might be', 'could be', 'perhaps',
  'it seems', 'i believe', 'likely', "i'm guessing", 'my guess',
]

const FABRICATION_MARKERS = [
  'as an ai', 'i cannot actually', 'i don\'t have access', 'hypothetically',
  'let\'s assume', 'for the sake of', 'imagine that',
]

const UNRESOLVED_ERROR_MARKERS = [
  'enoent', 'permission denied', 'eacces', 'connection refused',
  'timeout', 'econnrefused', 'not found',
]

function lower(s: string): string {
  return (s || '').toLowerCase()
}

/** RF-01: tool result contains hedging language presented as fact. */
function detectFabrication(text: string): RFClassification | null {
  const lc = lower(text)
  for (const m of FABRICATION_MARKERS) {
    if (lc.includes(m)) {
      return {
        class: 'RF-01-fabricated-evidence',
        evidence: `hedging marker "${m}" in tool result`,
        confidence: 0.7,
      }
    }
  }
  return null
}

/** RF-08: result is structurally empty or shorter than task demands. */
function detectEvidentialInsufficiency(text: string): RFClassification | null {
  const trimmed = (text || '').trim()
  if (trimmed.length === 0) {
    return {
      class: 'RF-08-evidential-insufficiency',
      evidence: 'empty tool result',
      confidence: 0.95,
    }
  }
  if (trimmed.length < 16 && !/\d/.test(trimmed)) {
    return {
      class: 'RF-08-evidential-insufficiency',
      evidence: `result is ${trimmed.length} chars with no numeric content`,
      confidence: 0.55,
    }
  }
  return null
}

/** RF-11: speculation language in what should be a factual tool result. */
function detectExcessiveSpeculation(text: string): RFClassification | null {
  const lc = lower(text)
  const hits = SPECULATION_MARKERS.filter(m => lc.includes(m))
  if (hits.length >= 2) {
    return {
      class: 'RF-11-excessive-speculation',
      evidence: `speculation markers: ${hits.slice(0, 3).join(', ')}`,
      confidence: 0.6,
    }
  }
  return null
}

/** RF-10: model output claims tool ran when the result text shows it did not. */
function detectSimulationConfusion(text: string): RFClassification | null {
  const lc = lower(text)
  const hasUnresolvedError = UNRESOLVED_ERROR_MARKERS.some(m => lc.includes(m))
  const claimsSuccess = /\b(successfully|completed|done|finished)\b/.test(lc)
  if (hasUnresolvedError && claimsSuccess) {
    return {
      class: 'RF-10-simulation-role-confusion',
      evidence: 'result claims success and contains an error marker',
      confidence: 0.85,
    }
  }
  return null
}

/** RF-15: internal contradiction — two opposing claims in one result. */
function detectInternalContradiction(text: string): RFClassification | null {
  const lc = lower(text)
  if (/\b(is|was|are)\s+\w+/.test(lc) && /\bis\s+not\b.*\bis\b/.test(lc)) {
    return {
      class: 'RF-15-internal-contradiction',
      evidence: 'opposing "is"/"is not" claims within result',
      confidence: 0.5,
    }
  }
  return null
}

/** RF-12: trajectory-level — last N steps repeat the same tool+args. */
export function detectRepetition(
  trajectory: TrajectoryStep[],
  windowSize = 3,
): RFClassification | null {
  if (trajectory.length < windowSize) return null
  const window = trajectory.slice(-windowSize)
  const first = window[0]
  const key = `${first.tool}:${JSON.stringify(first.args)}`
  const allSame = window.every(
    s => `${s.tool}:${JSON.stringify(s.args)}` === key,
  )
  if (allSame) {
    return {
      class: 'RF-12-repetition-failure-to-resume',
      evidence: `${windowSize} consecutive identical calls to ${first.tool}`,
      confidence: 0.9,
    }
  }
  return null
}

/**
 * Classify a single tool result against the RF taxonomy.
 *
 * Returns the highest-confidence match, or null if nothing fires. Callers
 * should treat null as "no taxonomy signal" — not as "result is fine".
 */
export function classifyToolResult(result: string): RFClassification | null {
  const detectors = [
    detectSimulationConfusion,
    detectFabrication,
    detectEvidentialInsufficiency,
    detectExcessiveSpeculation,
    detectInternalContradiction,
  ]
  let best: RFClassification | null = null
  for (const d of detectors) {
    const hit = d(result)
    if (hit && (!best || hit.confidence > best.confidence)) {
      best = hit
    }
  }
  return best
}
