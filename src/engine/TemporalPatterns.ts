// ─── Temporal Pattern Detection ──────────────────────────────
//
// Logs {dayOfWeek, hourOfDay, topicCategory} on each extraction cycle.
// Detects recurring patterns: "Mondays: work strategy", "Evenings: philosophical"
// Uses a rolling buffer stored in user_memory JSONB — zero additional tables.

const DAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'] as const
const TIME_BUCKETS = ['early morning', 'morning', 'afternoon', 'evening', 'late night'] as const

export type DayName = typeof DAY_NAMES[number]
export type TimeBucket = typeof TIME_BUCKETS[number]

export interface TemporalEntry {
  dayOfWeek: number      // 0-6
  hourOfDay: number      // 0-23
  topicCategory: string  // extracted from conversation topics
  timestamp: number
}

export interface TemporalPattern {
  label: string           // e.g. "Monday mornings: work strategy"
  frequency: number       // how many times this pattern appeared
  confidence: number      // 0-1
}

const MAX_ENTRIES = 100
const MIN_ENTRIES_FOR_ANALYSIS = 15
const ANALYSIS_INTERVAL = 20

/** Classify hour into human-readable time bucket */
function timeBucket(hour: number): TimeBucket {
  if (hour < 6) return 'late night'
  if (hour < 9) return 'early morning'
  if (hour < 12) return 'morning'
  if (hour < 17) return 'afternoon'
  if (hour < 21) return 'evening'
  return 'late night'
}

/** Record a new temporal entry */
export function recordTemporalEntry(
  entries: TemporalEntry[],
  topicCategory: string,
): TemporalEntry[] {
  const now = new Date()
  const entry: TemporalEntry = {
    dayOfWeek: now.getDay(),
    hourOfDay: now.getHours(),
    topicCategory: topicCategory.toLowerCase().slice(0, 50),
    timestamp: Date.now(),
  }
  return [...entries.slice(-(MAX_ENTRIES - 1)), entry]
}

/** Check if analysis should run (every N entries) */
export function shouldAnalyze(entries: TemporalEntry[]): boolean {
  return entries.length >= MIN_ENTRIES_FOR_ANALYSIS &&
    entries.length % ANALYSIS_INTERVAL === 0
}

/** Detect recurring temporal patterns from the entry buffer */
export function detectPatterns(entries: TemporalEntry[]): TemporalPattern[] {
  if (entries.length < MIN_ENTRIES_FOR_ANALYSIS) return []

  // Count (day+timeBucket → topic) co-occurrences
  const bucketTopics = new Map<string, Map<string, number>>()

  for (const e of entries) {
    const bucket = `${DAY_NAMES[e.dayOfWeek]} ${timeBucket(e.hourOfDay)}s`
    if (!bucketTopics.has(bucket)) bucketTopics.set(bucket, new Map())
    const topics = bucketTopics.get(bucket)!
    topics.set(e.topicCategory, (topics.get(e.topicCategory) || 0) + 1)
  }

  // Also check pure time-of-day patterns (any day)
  const timeTopics = new Map<string, Map<string, number>>()
  for (const e of entries) {
    const bucket = `${timeBucket(e.hourOfDay)}s`
    if (!timeTopics.has(bucket)) timeTopics.set(bucket, new Map())
    const topics = timeTopics.get(bucket)!
    topics.set(e.topicCategory, (topics.get(e.topicCategory) || 0) + 1)
  }

  const patterns: TemporalPattern[] = []

  // Day+time patterns (need at least 3 occurrences)
  for (const [bucket, topics] of bucketTopics) {
    for (const [topic, count] of topics) {
      if (count >= 3) {
        patterns.push({
          label: `${bucket}: ${topic}`,
          frequency: count,
          confidence: Math.min(1, count / entries.length * 5),
        })
      }
    }
  }

  // Time-only patterns (need at least 4 occurrences since they span all days)
  for (const [bucket, topics] of timeTopics) {
    for (const [topic, count] of topics) {
      if (count >= 4) {
        // Don't add if a more specific day+time pattern already covers this
        const alreadyCovered = patterns.some(p =>
          p.label.includes(bucket) && p.label.includes(topic)
        )
        if (!alreadyCovered) {
          patterns.push({
            label: `${bucket}: ${topic}`,
            frequency: count,
            confidence: Math.min(1, count / entries.length * 4),
          })
        }
      }
    }
  }

  // Sort by confidence, take top 3
  return patterns
    .sort((a, b) => b.confidence - a.confidence || b.frequency - a.frequency)
    .slice(0, 3)
}

/** Format temporal patterns for injection into system prompt */
export function formatTemporalForPrompt(patterns: TemporalPattern[]): string {
  if (patterns.length === 0) return ''
  return patterns.map(p => `- ${p.label}`).join('\n')
}
