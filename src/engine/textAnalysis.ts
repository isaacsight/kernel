// ─── Text Analysis Utilities ────────────────────────────────
//
// The engine's senses — how it reads signal from raw text
// without calling an external API.

export const URGENCY_SIGNALS = [
  'asap', 'urgent', 'now', 'immediately', 'quick', 'hurry',
  'deadline', 'emergency', 'critical', 'blocked', 'stuck',
];

export const COMPLEXITY_SIGNALS = [
  'architecture', 'system', 'design', 'tradeoff', 'integrate',
  'scale', 'distributed', 'optimize', 'refactor', 'migration',
  'strategy', 'framework', 'paradigm', 'philosophy',
];

export const NEGATIVE_SIGNALS = [
  'frustrated', 'broken', 'wrong', 'bad', 'hate', 'terrible',
  'confused', 'lost', "can't", "doesn't work", 'failing', 'error',
];

export const POSITIVE_SIGNALS = [
  'great', 'love', 'excited', 'amazing', 'perfect', 'beautiful',
  'elegant', 'clean', 'brilliant', 'inspired', 'thank',
];

export function countSignals(text: string, signals: string[]): number {
  const lower = text.toLowerCase();
  return signals.filter(s => lower.includes(s)).length;
}

// ─── Emotional Context Detection ──────────────────────────
// Computes sentiment trajectory from recent user messages.
// Zero API calls — pure signal analysis from textAnalysis primitives.

export type EnergyLevel = 'warm' | 'neutral' | 'frustrated' | 'excited' | 'subdued'
export type EnergyTrajectory = 'improving' | 'stable' | 'declining'

export interface EmotionalContext {
  energy: EnergyLevel
  trajectory: EnergyTrajectory
  /** Raw sentiment scores for the window (most recent last) */
  sentiments: number[]
}

/** Compute sentiment for a single message: -1 (negative) to +1 (positive) */
export function messageSentiment(text: string): number {
  const pos = countSignals(text, POSITIVE_SIGNALS)
  const neg = countSignals(text, NEGATIVE_SIGNALS)
  return Math.max(-1, Math.min(1, (pos - neg) * 0.3))
}

/** Classify energy level from average sentiment */
function classifyEnergy(avg: number, urgency: number): EnergyLevel {
  if (avg >= 0.3) return 'excited'
  if (avg >= 0.1) return 'warm'
  if (avg <= -0.3 || urgency > 0.5) return 'frustrated'
  if (avg <= -0.1) return 'subdued'
  return 'neutral'
}

/**
 * Compute emotional context from the last N user messages.
 * Uses countSignals + urgency detection — zero API calls.
 */
export function computeEmotionalContext(
  userMessages: string[],
  windowSize = 6,
): EmotionalContext {
  const window = userMessages.slice(-windowSize)
  if (window.length === 0) {
    return { energy: 'neutral', trajectory: 'stable', sentiments: [] }
  }

  const sentiments = window.map(messageSentiment)
  const avg = sentiments.reduce((a, b) => a + b, 0) / sentiments.length
  const urgency = window.reduce((sum, m) => sum + countSignals(m, URGENCY_SIGNALS), 0) / window.length

  // Trajectory: compare first half to second half
  let trajectory: EnergyTrajectory = 'stable'
  if (sentiments.length >= 3) {
    const mid = Math.floor(sentiments.length / 2)
    const firstHalf = sentiments.slice(0, mid).reduce((a, b) => a + b, 0) / mid
    const secondHalf = sentiments.slice(mid).reduce((a, b) => a + b, 0) / (sentiments.length - mid)
    const delta = secondHalf - firstHalf
    if (delta > 0.15) trajectory = 'improving'
    else if (delta < -0.15) trajectory = 'declining'
  }

  return {
    energy: classifyEnergy(avg, urgency),
    trajectory,
    sentiments,
  }
}

export function extractKeyEntities(text: string): string[] {
  // Extract capitalized words and quoted phrases as key entities
  const quoted = text.match(/"([^"]+)"|'([^']+)'/g)?.map(q => q.replace(/['"]/g, '')) || [];
  const capitalized = text.match(/\b[A-Z][a-z]{2,}\b/g) || [];
  const unique = [...new Set([...quoted, ...capitalized])];
  return unique.slice(0, 5); // max 5 entities
}

/**
 * Extract top conversation topics from a set of messages.
 * Runs extractKeyEntities across all messages, counts frequency, returns top 5.
 * Pure JS — no API call needed.
 */
export function extractConversationTopics(
  messages: { role: string; content: string }[],
): string[] {
  const freq = new Map<string, number>()
  for (const m of messages) {
    // Sample first 500 chars of each message for speed
    const entities = extractKeyEntities(m.content.slice(0, 500))
    for (const e of entities) {
      freq.set(e, (freq.get(e) || 0) + 1)
    }
  }
  // Also extract notable lowercase keywords (technical terms, repeated nouns)
  const lower = messages.map(m => m.content.toLowerCase()).join(' ')
  const words = lower.match(/\b[a-z]{4,}\b/g) || []
  const wordFreq = new Map<string, number>()
  for (const w of words) wordFreq.set(w, (wordFreq.get(w) || 0) + 1)
  // Add words that appear 3+ times (indicating a real topic)
  for (const [word, count] of wordFreq) {
    if (count >= 3 && !STOP_WORDS.has(word)) {
      freq.set(word, (freq.get(word) || 0) + count)
    }
  }

  return [...freq.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([topic]) => topic)
}

const STOP_WORDS = new Set([
  'that', 'this', 'with', 'from', 'have', 'been', 'will', 'would', 'could',
  'should', 'there', 'their', 'about', 'which', 'when', 'what', 'where',
  'they', 'your', 'more', 'some', 'also', 'just', 'like', 'into', 'than',
  'them', 'then', 'each', 'make', 'made', 'does', 'done', 'very', 'only',
  'here', 'know', 'want', 'need', 'think', 'sure', 'okay', 'well', 'good',
])
