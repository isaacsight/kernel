// kbot Music Learning Engine — Self-Improving Production Intelligence
//
// Inspired by Agent Zero's adaptive memory + kbot's existing learning.ts
//
// Three feedback loops:
// 1. SOUND MEMORY — Remember which synth settings, presets, and samples sounded good
// 2. PATTERN MEMORY — Remember which drum patterns, melodies, and progressions the user kept
// 3. MIX MEMORY — Remember mix decisions that worked (volumes, EQ, sends)
//
// The engine learns from:
// - User keeps a beat playing (positive signal)
// - User changes something (negative signal for what was changed, positive for what wasn't)
// - User says "I like this" or "this sounds good" (explicit positive)
// - User says "change the drums" or "make it darker" (explicit correction)
// - User exports/saves (strongest positive signal)
//
// Everything persists to ~/.kbot/music-memory/

import { homedir } from 'node:os'
import { join } from 'node:path'
import { existsSync, readFileSync, writeFileSync, mkdirSync } from 'node:fs'

const MUSIC_DIR = join(homedir(), '.kbot', 'music-memory')
const SOUNDS_FILE = join(MUSIC_DIR, 'sounds.json')
const PATTERNS_FILE = join(MUSIC_DIR, 'patterns.json')
const MIXES_FILE = join(MUSIC_DIR, 'mixes.json')
const PREFERENCES_FILE = join(MUSIC_DIR, 'preferences.json')
const HISTORY_FILE = join(MUSIC_DIR, 'history.json')

function ensureDir(): void {
  if (!existsSync(MUSIC_DIR)) mkdirSync(MUSIC_DIR, { recursive: true })
}

function loadJSON<T>(path: string, fallback: T): T {
  ensureDir()
  if (!existsSync(path)) return fallback
  try { return JSON.parse(readFileSync(path, 'utf-8')) } catch { return fallback }
}

function saveJSON(path: string, data: unknown): void {
  ensureDir()
  writeFileSync(path, JSON.stringify(data, null, 2))
}

// ═══ 1. SOUND MEMORY ════════════════════════════════════════════════
// Remembers which instruments + settings sounded good for which role

export interface SoundMemory {
  /** What role this sound served (bass, melody, pad, drums, etc.) */
  role: string
  /** Genre context */
  genre: string
  /** Plugin used */
  plugin: string
  /** Plugin manufacturer */
  manufacturer: string
  /** Preset name if applicable */
  preset: string
  /** Key parameters that were set */
  params: Record<string, number>
  /** User satisfaction score (0-1, updated via feedback) */
  score: number
  /** Number of times this was used */
  uses: number
  /** Last used timestamp */
  lastUsed: string
  /** Tags from user feedback */
  tags: string[]
}

let sounds: SoundMemory[] = loadJSON(SOUNDS_FILE, [])

/** Record a sound that was used in a production */
export function recordSound(sound: Omit<SoundMemory, 'score' | 'uses' | 'lastUsed' | 'tags'>): void {
  const existing = sounds.find(s =>
    s.role === sound.role && s.plugin === sound.plugin && s.genre === sound.genre
  )
  if (existing) {
    existing.uses++
    existing.lastUsed = new Date().toISOString()
    // Merge params (keep the latest)
    existing.params = { ...existing.params, ...sound.params }
    if (sound.preset) existing.preset = sound.preset
  } else {
    sounds.push({
      ...sound,
      score: 0.5, // neutral starting score
      uses: 1,
      lastUsed: new Date().toISOString(),
      tags: [],
    })
  }
  saveJSON(SOUNDS_FILE, sounds)
}

/** Boost a sound's score (user liked it) */
export function boostSound(role: string, genre: string, amount: number = 0.1): void {
  const sound = sounds.find(s => s.role === role && s.genre === genre)
  if (sound) {
    sound.score = Math.min(1, sound.score + amount)
    saveJSON(SOUNDS_FILE, sounds)
  }
}

/** Penalize a sound's score (user changed it) */
export function penalizeSound(role: string, genre: string, amount: number = 0.15): void {
  const sound = sounds.find(s => s.role === role && s.genre === genre)
  if (sound) {
    sound.score = Math.max(0, sound.score - amount)
    saveJSON(SOUNDS_FILE, sounds)
  }
}

/** Get the best-scoring sound for a role + genre */
export function getBestSound(role: string, genre: string): SoundMemory | null {
  const candidates = sounds
    .filter(s => s.role === role && s.genre === genre && s.score > 0.4)
    .sort((a, b) => b.score - a.score)
  return candidates[0] || null
}

/** Get all sounds for a genre, sorted by score */
export function getSoundsForGenre(genre: string): SoundMemory[] {
  return sounds
    .filter(s => s.genre === genre)
    .sort((a, b) => b.score - a.score)
}

// ═══ 2. PATTERN MEMORY ══════════════════════════════════════════════
// Remembers drum patterns, melodies, bass lines, and chord progressions

export interface PatternMemory {
  /** Pattern type */
  type: 'drums' | 'bass' | 'melody' | 'chords' | 'perc'
  /** Genre context */
  genre: string
  /** Key (for pitched patterns) */
  key: string
  /** Scale used */
  scale: string
  /** BPM */
  bpm: number
  /** The actual MIDI data: [pitch, start, duration, velocity][] */
  notes: Array<[number, number, number, number]>
  /** Bars */
  bars: number
  /** User satisfaction score */
  score: number
  /** Times used */
  uses: number
  /** Tags */
  tags: string[]
  /** Created */
  created: string
}

let patterns: PatternMemory[] = loadJSON(PATTERNS_FILE, [])

/** Record a pattern that was used */
export function recordPattern(pattern: Omit<PatternMemory, 'score' | 'uses' | 'tags' | 'created'>): void {
  patterns.push({
    ...pattern,
    score: 0.5,
    uses: 1,
    tags: [],
    created: new Date().toISOString(),
  })
  // Keep max 200 patterns (trim lowest-scored)
  if (patterns.length > 200) {
    patterns.sort((a, b) => b.score - a.score)
    patterns = patterns.slice(0, 200)
  }
  saveJSON(PATTERNS_FILE, patterns)
}

/** Get the best pattern for a type + genre */
export function getBestPattern(type: string, genre: string): PatternMemory | null {
  const candidates = patterns
    .filter(p => p.type === type && p.genre === genre && p.score > 0.4)
    .sort((a, b) => b.score - a.score)
  return candidates[0] || null
}

/** Boost a pattern (user kept it) */
export function boostPattern(type: string, genre: string, amount: number = 0.1): void {
  const recent = patterns
    .filter(p => p.type === type && p.genre === genre)
    .sort((a, b) => new Date(b.created).getTime() - new Date(a.created).getTime())
  if (recent[0]) {
    recent[0].score = Math.min(1, recent[0].score + amount)
    recent[0].uses++
    saveJSON(PATTERNS_FILE, patterns)
  }
}

// ═══ 3. MIX MEMORY ══════════════════════════════════════════════════
// Remembers mix settings that worked

export interface MixMemory {
  /** Genre */
  genre: string
  /** Per-role volumes */
  volumes: Record<string, number>
  /** Per-role panning */
  panning: Record<string, number>
  /** Send levels */
  sends: Array<{ role: string; returnIdx: number; level: number }>
  /** Score */
  score: number
  /** Times used */
  uses: number
  /** Created */
  created: string
}

let mixes: MixMemory[] = loadJSON(MIXES_FILE, [])

/** Record a mix configuration */
export function recordMix(mix: Omit<MixMemory, 'score' | 'uses' | 'created'>): void {
  mixes.push({
    ...mix,
    score: 0.5,
    uses: 1,
    created: new Date().toISOString(),
  })
  if (mixes.length > 50) {
    mixes.sort((a, b) => b.score - a.score)
    mixes = mixes.slice(0, 50)
  }
  saveJSON(MIXES_FILE, mixes)
}

/** Get the best mix for a genre */
export function getBestMix(genre: string): MixMemory | null {
  const candidates = mixes
    .filter(m => m.genre === genre && m.score > 0.4)
    .sort((a, b) => b.score - a.score)
  return candidates[0] || null
}

/** Boost the most recent mix for a genre */
export function boostMix(genre: string, amount: number = 0.1): void {
  const recent = mixes
    .filter(m => m.genre === genre)
    .sort((a, b) => new Date(b.created).getTime() - new Date(a.created).getTime())
  if (recent[0]) {
    recent[0].score = Math.min(1, recent[0].score + amount)
    recent[0].uses++
    saveJSON(MIXES_FILE, mixes)
  }
}

// ═══ 4. USER PREFERENCES ════════════════════════════════════════════
// Persistent preferences learned from behavior

export interface MusicPreferences {
  /** Preferred genres (ordered by frequency) */
  genres: Record<string, number>
  /** Preferred keys */
  keys: Record<string, number>
  /** Preferred BPM ranges per genre */
  bpmRanges: Record<string, [number, number]>
  /** Preferred instruments per role */
  instruments: Record<string, string>
  /** Preferred Roland Cloud instruments */
  rolandPreferred: boolean
  /** Preferred reverb amount (0-1) */
  reverbAmount: number
  /** Preferred melody density (sparse/normal/dense) */
  melodyDensity: string
  /** Total beats produced */
  totalBeats: number
  /** Total sessions */
  totalSessions: number
  /** Favorite progressions */
  progressions: Record<string, number>
}

let preferences: MusicPreferences = loadJSON(PREFERENCES_FILE, {
  genres: {},
  keys: {},
  bpmRanges: {},
  instruments: {},
  rolandPreferred: true,
  reverbAmount: 0.35,
  melodyDensity: 'normal',
  totalBeats: 0,
  totalSessions: 0,
  progressions: {},
})

/** Record that a genre was used */
export function recordGenreUse(genre: string): void {
  preferences.genres[genre] = (preferences.genres[genre] || 0) + 1
  preferences.totalBeats++
  saveJSON(PREFERENCES_FILE, preferences)
}

/** Record that a key was used */
export function recordKeyUse(key: string): void {
  preferences.keys[key] = (preferences.keys[key] || 0) + 1
  saveJSON(PREFERENCES_FILE, preferences)
}

/** Record a progression was used */
export function recordProgressionUse(progression: string): void {
  preferences.progressions[progression] = (preferences.progressions[progression] || 0) + 1
  saveJSON(PREFERENCES_FILE, preferences)
}

/** Get the user's most-used genre */
export function getPreferredGenre(): string | null {
  const entries = Object.entries(preferences.genres).sort((a, b) => b[1] - a[1])
  return entries[0]?.[0] || null
}

/** Get the user's preferred key for a genre */
export function getPreferredKey(genre: string): string | null {
  // Check genre-specific key preferences from sounds
  const genreSounds = sounds.filter(s => s.genre === genre && s.score > 0.6)
  // For now use global key preferences
  const entries = Object.entries(preferences.keys).sort((a, b) => b[1] - a[1])
  return entries[0]?.[0] || null
}

/** Get all preferences */
export function getPreferences(): MusicPreferences {
  return { ...preferences }
}

// ═══ 5. PRODUCTION HISTORY ══════════════════════════════════════════
// Complete history of what was produced

export interface ProductionEvent {
  /** Timestamp */
  timestamp: string
  /** What happened */
  action: 'produce_beat' | 'design_sound' | 'arrange_song' | 'modify' | 'export' | 'feedback'
  /** Genre */
  genre: string
  /** Key */
  key: string
  /** BPM */
  bpm: number
  /** What was changed (if modification) */
  detail: string
  /** User feedback (if any) */
  feedback: 'positive' | 'negative' | 'neutral'
}

let history: ProductionEvent[] = loadJSON(HISTORY_FILE, [])

/** Record a production event */
export function recordEvent(event: Omit<ProductionEvent, 'timestamp'>): void {
  history.push({
    ...event,
    timestamp: new Date().toISOString(),
  })
  // Keep last 500 events
  if (history.length > 500) {
    history = history.slice(-500)
  }
  saveJSON(HISTORY_FILE, history)
}

/** Get recent history */
export function getRecentHistory(count: number = 20): ProductionEvent[] {
  return history.slice(-count)
}

// ═══ 6. SELF-IMPROVEMENT LOOP ═══════════════════════════════════════
// The core Agent Zero-inspired concept: process feedback and improve

export interface FeedbackSignal {
  /** What was the context */
  genre: string
  /** What was the action */
  action: string
  /** Was it positive or negative */
  sentiment: 'positive' | 'negative'
  /** What specifically was good/bad */
  target: string // 'drums', 'bass', 'melody', 'pad', 'mix', 'overall'
  /** Optional detail */
  detail?: string
}

/**
 * Process user feedback and update all memory systems.
 * This is the self-improvement loop — every feedback signal
 * adjusts future behavior.
 */
export function processFeedback(signal: FeedbackSignal): string {
  const { genre, action, sentiment, target, detail } = signal
  const isPositive = sentiment === 'positive'
  const amount = isPositive ? 0.1 : 0.15 // penalize harder than reward (asymmetric trust)

  const updates: string[] = []

  if (target === 'overall' || target === 'all') {
    // Boost/penalize everything for this genre
    if (isPositive) {
      boostMix(genre, amount)
      updates.push('mix boosted')
    }
    for (const type of ['drums', 'bass', 'melody', 'chords', 'perc'] as const) {
      if (isPositive) boostPattern(type, genre, amount)
    }
    for (const role of ['drums', 'bass', 'melody', 'pad', 'perc'] as const) {
      if (isPositive) boostSound(role, genre, amount)
      else penalizeSound(role, genre, amount)
    }
    updates.push(`all ${isPositive ? 'boosted' : 'penalized'} for ${genre}`)
  } else {
    // Target specific element
    if (isPositive) {
      boostSound(target, genre, amount)
      boostPattern(target as any, genre, amount)
      updates.push(`${target} boosted`)
    } else {
      penalizeSound(target, genre, amount)
      updates.push(`${target} penalized — will try different approach next time`)
    }
  }

  // Record the event
  recordEvent({
    action: 'feedback',
    genre,
    key: '',
    bpm: 0,
    detail: `${sentiment} feedback on ${target}: ${detail || 'no detail'}`,
    feedback: sentiment === 'positive' ? 'positive' : 'negative',
  })

  return `Learned: ${updates.join(', ')}. Score adjustments saved.`
}

/**
 * Get a learning summary — what kbot has learned about the user's taste.
 */
export function getLearningReport(): string {
  const lines: string[] = ['## kbot Music Learning Report', '']

  // Genre preferences
  const genreEntries = Object.entries(preferences.genres).sort((a, b) => b[1] - a[1])
  if (genreEntries.length > 0) {
    lines.push('**Preferred genres:**')
    for (const [genre, count] of genreEntries.slice(0, 5)) {
      lines.push(`  ${genre}: ${count} beats`)
    }
    lines.push('')
  }

  // Key preferences
  const keyEntries = Object.entries(preferences.keys).sort((a, b) => b[1] - a[1])
  if (keyEntries.length > 0) {
    lines.push('**Preferred keys:** ' + keyEntries.slice(0, 5).map(([k, c]) => `${k}(${c})`).join(', '))
    lines.push('')
  }

  // Best sounds
  const topSounds = sounds.filter(s => s.score > 0.6).sort((a, b) => b.score - a.score).slice(0, 10)
  if (topSounds.length > 0) {
    lines.push('**Top-rated sounds:**')
    for (const s of topSounds) {
      lines.push(`  ${s.role} (${s.genre}): ${s.plugin} — score ${s.score.toFixed(2)} (${s.uses} uses)`)
    }
    lines.push('')
  }

  // Stats
  lines.push(`**Total:** ${preferences.totalBeats} beats, ${history.length} events, ${sounds.length} sounds, ${patterns.length} patterns`)

  return lines.join('\n')
}

/**
 * Apply learned preferences to a genre preset.
 * Returns overrides that should be applied on top of the default preset.
 */
export function getLearnedOverrides(genre: string): {
  preferredKey?: string
  preferredBpm?: number
  soundOverrides: Record<string, { plugin: string; manufacturer: string; preset: string }>
  mixOverrides?: { volumes: Record<string, number> }
} {
  const overrides: ReturnType<typeof getLearnedOverrides> = { soundOverrides: {} }

  // Check if we have a preferred key for this genre
  const prefKey = getPreferredKey(genre)
  if (prefKey) overrides.preferredKey = prefKey

  // Check for high-scoring sounds
  for (const role of ['drums', 'bass', 'melody', 'pad', 'perc']) {
    const best = getBestSound(role, genre)
    if (best && best.score > 0.7) {
      overrides.soundOverrides[role] = {
        plugin: best.plugin,
        manufacturer: best.manufacturer,
        preset: best.preset,
      }
    }
  }

  // Check for learned mix
  const bestMix = getBestMix(genre)
  if (bestMix && bestMix.score > 0.7) {
    overrides.mixOverrides = { volumes: bestMix.volumes }
  }

  return overrides
}
