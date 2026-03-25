// SYNTH — Procedural Mood Engine
//
// AI that drives the atmosphere based on game state.
// Outputs a mood vector that the Atmosphere system consumes.
// Mood transitions are SMOOTH — lerp between states over 2-3 seconds.
// All client-side, zero API calls.

import type { Vec2, DirectiveType } from '../types'
import type { Mood } from '../systems/Atmosphere'

// ── Extended mood set ────────────────────────────────────────────────
// Adds: anticipation, triumph, curiosity beyond the base 5

export type ExtendedMood = Mood | 'anticipation' | 'triumph' | 'curiosity'

export interface MoodState {
  /** Primary mood (maps directly to Atmosphere palette) */
  primaryMood: Mood
  /** Extended mood for additional context */
  extendedMood: ExtendedMood
  /** Mood intensity 0-1 (how strongly the mood is expressed) */
  intensity: number
  /** Blend factor between current and target mood (for smooth transitions) */
  transitionProgress: number
  /** Debug: why this mood was chosen */
  reasoning: string
}

export interface MoodContext {
  /** Combat: number of living enemies */
  enemyCount: number
  /** Combat: number of enemies within attack range of player */
  enemiesInRange: number
  /** Player HP ratio 0-1 */
  playerHpRatio: number
  /** Partner HP ratio 0-1 */
  partnerHpRatio: number
  /** Current partner directive */
  partnerDirective: DirectiveType
  /** Director tension 0-1 */
  directorTension: number
  /** Director phase */
  directorPhase: 'build' | 'peak' | 'release' | 'breathe'
  /** Time since last enemy killed (ms) */
  timeSinceLastKillMs: number
  /** Time since last damage taken (ms) */
  timeSinceLastDamageTakenMs: number
  /** Total kills this run */
  totalKills: number
  /** Player is near a door / unexplored area */
  nearDoor: boolean
  /** Room was just cleared */
  roomCleared: boolean
  /** Boss just defeated */
  bossDefeated: boolean
  /** Time spent in current room (ms) */
  roomTimeMs: number
  /** Player position */
  playerPos: Vec2
  /** Previous player position (for movement detection) */
  prevPlayerPos: Vec2
}

// ── Mood scoring ─────────────────────────────────────────────────────

interface MoodScore {
  mood: ExtendedMood
  score: number
  reasoning: string
}

function scoreMoods(ctx: MoodContext): MoodScore[] {
  const scores: MoodScore[] = []

  // ── Calm: no enemies, safe, low tension ──
  {
    let s = 0.2
    if (ctx.enemyCount === 0) s += 0.4
    if (ctx.timeSinceLastDamageTakenMs > 5000) s += 0.15
    if (ctx.directorTension < 0.3) s += 0.15
    if (ctx.directorPhase === 'breathe') s += 0.1
    scores.push({ mood: 'calm', score: clamp(s, 0, 1), reasoning: `${ctx.enemyCount} enemies, tension ${ctx.directorTension.toFixed(2)}` })
  }

  // ── Aggressive: in combat, player is doing well ──
  {
    let s = 0.1
    if (ctx.enemyCount > 0 && ctx.enemyCount <= 4) s += 0.3
    if (ctx.playerHpRatio > 0.6) s += 0.15
    if (ctx.timeSinceLastKillMs < 3000) s += 0.2
    if (ctx.directorTension > 0.4 && ctx.directorTension < 0.7) s += 0.15
    if (ctx.partnerDirective === 'attack' || ctx.partnerDirective === 'flank') s += 0.1
    scores.push({ mood: 'aggressive', score: clamp(s, 0, 1), reasoning: `in combat, playerHP ${(ctx.playerHpRatio * 100).toFixed(0)}%` })
  }

  // ── Afraid: partner or player in danger, many enemies ──
  {
    let s = 0.05
    if (ctx.partnerHpRatio < 0.3) s += 0.3
    if (ctx.playerHpRatio < 0.4 && ctx.enemyCount > 2) s += 0.2
    if (ctx.enemyCount >= 5) s += 0.2
    if (ctx.directorTension > 0.75) s += 0.15
    if (ctx.partnerDirective === 'retreat') s += 0.1
    scores.push({ mood: 'afraid', score: clamp(s, 0, 1), reasoning: `partnerHP ${(ctx.partnerHpRatio * 100).toFixed(0)}%, ${ctx.enemyCount} enemies` })
  }

  // ── Confident: doing very well, high kill count, good HP ──
  {
    let s = 0.1
    if (ctx.playerHpRatio > 0.7 && ctx.partnerHpRatio > 0.6) s += 0.2
    if (ctx.totalKills > 5) s += 0.1
    if (ctx.timeSinceLastKillMs < 2000 && ctx.totalKills > 3) s += 0.2
    if (ctx.enemyCount <= 1) s += 0.15
    if (ctx.directorPhase === 'release') s += 0.1
    scores.push({ mood: 'confident', score: clamp(s, 0, 1), reasoning: `${ctx.totalKills} kills, good HP` })
  }

  // ── Desperate: critically low HP, many enemies, high tension ──
  {
    let s = 0.0
    if (ctx.playerHpRatio < 0.2) s += 0.4
    if (ctx.partnerHpRatio < 0.2) s += 0.2
    if (ctx.enemyCount >= 4 && ctx.playerHpRatio < 0.3) s += 0.25
    if (ctx.directorTension > 0.85) s += 0.15
    scores.push({ mood: 'desperate', score: clamp(s, 0, 1), reasoning: `playerHP ${(ctx.playerHpRatio * 100).toFixed(0)}%, critical` })
  }

  // ── Anticipation: approaching a door, enemies ahead, build phase ──
  {
    let s = 0.0
    if (ctx.nearDoor) s += 0.4
    if (ctx.directorPhase === 'build' && ctx.enemyCount === 0) s += 0.2
    if (ctx.roomTimeMs < 3000 && ctx.enemyCount > 0) s += 0.15
    scores.push({ mood: 'anticipation', score: clamp(s, 0, 1), reasoning: `near door: ${ctx.nearDoor}, build phase` })
  }

  // ── Triumph: just cleared the room or boss ──
  {
    let s = 0.0
    if (ctx.roomCleared) s += 0.5
    if (ctx.bossDefeated) s += 0.5
    if (ctx.enemyCount === 0 && ctx.totalKills > 3 && ctx.timeSinceLastKillMs < 5000) s += 0.3
    scores.push({ mood: 'triumph', score: clamp(s, 0, 1), reasoning: `cleared: ${ctx.roomCleared}, boss: ${ctx.bossDefeated}` })
  }

  // ── Curiosity: exploring, no enemies, moving around ──
  {
    let s = 0.0
    if (ctx.enemyCount === 0 && ctx.roomTimeMs > 3000) {
      // Is the player moving around?
      const dx = ctx.playerPos.x - ctx.prevPlayerPos.x
      const dy = ctx.playerPos.y - ctx.prevPlayerPos.y
      const moving = Math.sqrt(dx * dx + dy * dy) > 5
      if (moving) s += 0.3
    }
    if (!ctx.roomCleared && ctx.enemyCount === 0) s += 0.2
    if (ctx.directorPhase === 'breathe') s += 0.1
    scores.push({ mood: 'curiosity', score: clamp(s, 0, 1), reasoning: `exploring, no combat` })
  }

  return scores
}

// ── Map extended moods to base Atmosphere moods ──────────────────────

function extendedToBase(mood: ExtendedMood): Mood {
  switch (mood) {
    case 'anticipation': return 'calm'       // anticipation = dark calm with tension
    case 'triumph': return 'confident'       // triumph = bright confident
    case 'curiosity': return 'calm'          // curiosity = lighter calm
    default: return mood
  }
}

// ── State machine for smooth transitions ─────────────────────────────

let currentMood: ExtendedMood = 'calm'
let currentIntensity = 0.5
let targetIntensity = 0.5
let transitionProgress = 1.0

const TRANSITION_SPEED = 0.0004  // ~2.5 seconds for full transition
const INTENSITY_LERP = 0.002

// ── Main evaluation function ─────────────────────────────────────────

export function evaluateMood(ctx: MoodContext, deltaMs: number): MoodState {
  const scores = scoreMoods(ctx)
  scores.sort((a, b) => b.score - a.score)

  const best = scores[0]

  // Only switch mood if the new one scores significantly higher
  // This prevents rapid flickering
  const currentScore = scores.find(s => s.mood === currentMood)?.score ?? 0
  const switchThreshold = 0.15 // need to score 15% higher to switch

  if (best.mood !== currentMood && best.score > currentScore + switchThreshold) {
    currentMood = best.mood
    transitionProgress = 0 // start transition
  }

  // Advance transition
  if (transitionProgress < 1) {
    transitionProgress = Math.min(1, transitionProgress + deltaMs * TRANSITION_SPEED)
  }

  // Intensity tracks the winning score
  targetIntensity = best.score
  currentIntensity = currentIntensity + (targetIntensity - currentIntensity) * Math.min(1, deltaMs * INTENSITY_LERP)

  return {
    primaryMood: extendedToBase(currentMood),
    extendedMood: currentMood,
    intensity: currentIntensity,
    transitionProgress,
    reasoning: `${currentMood}: ${best.reasoning}`,
  }
}

/** Reset mood state (call at start of each run) */
export function resetMood(): void {
  currentMood = 'calm'
  currentIntensity = 0.5
  targetIntensity = 0.5
  transitionProgress = 1.0
}

// ── Utility ──────────────────────────────────────────────────────────

function clamp(v: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, v))
}
