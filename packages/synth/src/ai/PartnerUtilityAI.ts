// SYNTH — Utility AI for Partner
//
// Replaces/enhances the simple FSM with score-based decision making.
// Each possible action gets a SCORE based on multiple factors.
// The highest-scoring action wins. Momentum prevents flicker.
// All client-side, zero API calls.

import type { Vec2, DirectiveType, Personality } from '../types'
import { DEFAULT_PERSONALITY } from '../brain/Personality'

// ── Types ────────────────────────────────────────────────────────────

export interface UtilityContext {
  partnerPos: Vec2
  partnerHp: number
  partnerMaxHp: number
  playerPos: Vec2
  playerHp: number
  playerMaxHp: number
  enemies: Array<{
    id: string
    position: Vec2
    hp: number
    maxHp: number
    distanceToPartner: number
    distanceToPlayer: number
  }>
  /** Current Director tension 0-1 */
  directorTension: number
  /** Current partner personality */
  personality: Personality
  /** Current active action (for momentum bonus) */
  currentAction: DirectiveType
}

export interface UtilityResult {
  action: DirectiveType
  score: number
  reasoning: string
  /** Target enemy ID if action is attack/flank */
  targetId?: string
}

// ── Score weights ────────────────────────────────────────────────────

// Base importance of each factor (before personality modifiers)
const MOMENTUM_BONUS = 0.20          // +20% score for current action (commitment)
const CRITICAL_HP_THRESHOLD = 0.25   // HP ratio below which self-preservation kicks in hard
const LOW_HP_THRESHOLD = 0.40

// ── Action evaluators ────────────────────────────────────────────────

function scoreAttack(ctx: UtilityContext): { score: number; reasoning: string; targetId?: string } {
  if (ctx.enemies.length === 0) return { score: 0, reasoning: 'no enemies' }

  const personality = ctx.personality.behaviorWeights
  const nearestEnemy = ctx.enemies.reduce((a, b) => a.distanceToPartner < b.distanceToPartner ? a : b)

  let score = 0.4 // base desire to fight

  // Proximity boost: closer enemies = higher attack desire
  const proximityFactor = 1 - Math.min(nearestEnemy.distanceToPartner / 300, 1)
  score += proximityFactor * 0.3

  // Few enemies = easier to attack aggressively
  if (ctx.enemies.length <= 2) score += 0.15
  if (ctx.enemies.length === 1) score += 0.1

  // Personality: aggressiveness directly boosts attack
  score *= 0.5 + personality.aggressiveness * 0.8

  // Low tension = be more aggressive
  if (ctx.directorTension < 0.3) score += 0.15

  // Partner HP: don't attack if critically low
  const partnerHpRatio = ctx.partnerHp / ctx.partnerMaxHp
  if (partnerHpRatio < CRITICAL_HP_THRESHOLD) score *= 0.2
  else if (partnerHpRatio < LOW_HP_THRESHOLD) score *= 0.6

  // Target weakest enemy for efficient kills
  const weakest = ctx.enemies.reduce((a, b) => (a.hp / a.maxHp) < (b.hp / b.maxHp) ? a : b)
  const targetId = weakest.distanceToPartner < 300 ? weakest.id : nearestEnemy.id

  return { score: clamp(score, 0, 1), reasoning: `attack: ${ctx.enemies.length} enemies, nearest at ${Math.round(nearestEnemy.distanceToPartner)}px`, targetId }
}

function scoreDefend(ctx: UtilityContext): { score: number; reasoning: string } {
  const personality = ctx.personality.behaviorWeights

  let score = 0.3 // base desire to defend

  const playerHpRatio = ctx.playerHp / ctx.playerMaxHp

  // Player low HP = defend score rises sharply
  if (playerHpRatio < CRITICAL_HP_THRESHOLD) score += 0.4
  else if (playerHpRatio < LOW_HP_THRESHOLD) score += 0.2

  // Many enemies = defend mode
  if (ctx.enemies.length >= 4) score += 0.2
  if (ctx.enemies.length >= 6) score += 0.15

  // High tension = more defensive
  if (ctx.directorTension > 0.7) score += 0.2

  // Personality: player proximity bias boosts defend
  score *= 0.5 + personality.playerProximity * 0.7

  // If enemies are close to the player, defend is more urgent
  const enemiesNearPlayer = ctx.enemies.filter(e => e.distanceToPlayer < 100)
  if (enemiesNearPlayer.length >= 2) score += 0.15

  return { score: clamp(score, 0, 1), reasoning: `defend: playerHP ${Math.round(playerHpRatio * 100)}%, ${ctx.enemies.length} enemies` }
}

function scoreRetreat(ctx: UtilityContext): { score: number; reasoning: string } {
  const personality = ctx.personality.behaviorWeights

  let score = 0.1 // base retreat desire is low

  const partnerHpRatio = ctx.partnerHp / ctx.partnerMaxHp

  // Partner critically low = retreat strongly
  if (partnerHpRatio < CRITICAL_HP_THRESHOLD) score += 0.5
  else if (partnerHpRatio < LOW_HP_THRESHOLD) score += 0.2

  // Self-preservation personality modifier
  score *= 0.3 + personality.selfPreservation * 1.0

  // Many enemies nearby = more reason to retreat
  const nearbyEnemies = ctx.enemies.filter(e => e.distanceToPartner < 80)
  if (nearbyEnemies.length >= 3) score += 0.2

  // High tension = consider retreat
  if (ctx.directorTension > 0.8) score += 0.1

  return { score: clamp(score, 0, 1), reasoning: `retreat: partnerHP ${Math.round(partnerHpRatio * 100)}%, ${ctx.enemies.filter(e => e.distanceToPartner < 80).length} nearby` }
}

function scoreFlank(ctx: UtilityContext): { score: number; reasoning: string; targetId?: string } {
  if (ctx.enemies.length === 0) return { score: 0, reasoning: 'no enemies to flank' }

  const personality = ctx.personality.behaviorWeights

  let score = 0.3 // flanking is a tactical choice

  // Need at least one enemy that the player is already engaging
  const enemiesNearPlayer = ctx.enemies.filter(e => e.distanceToPlayer < 150)
  if (enemiesNearPlayer.length > 0) score += 0.2

  // Works best with 1-3 enemies (too many = risky flank)
  if (ctx.enemies.length >= 1 && ctx.enemies.length <= 3) score += 0.15
  if (ctx.enemies.length > 5) score -= 0.15

  // Initiative rate from personality drives flanking
  score *= 0.4 + personality.initiativeRate * 0.6

  // Partner needs decent HP to flank (it's risky)
  const partnerHpRatio = ctx.partnerHp / ctx.partnerMaxHp
  if (partnerHpRatio < LOW_HP_THRESHOLD) score *= 0.3

  // Low tension = good time to take initiative
  if (ctx.directorTension < 0.4) score += 0.1

  const target = enemiesNearPlayer[0] ?? ctx.enemies[0]

  return { score: clamp(score, 0, 1), reasoning: `flank: ${enemiesNearPlayer.length} enemies near player`, targetId: target.id }
}

function scoreFollow(ctx: UtilityContext): { score: number; reasoning: string } {
  const personality = ctx.personality.behaviorWeights

  let score = 0.35 // follow is the default/safe option

  // Distance from player: far away = want to follow more
  const dx = ctx.partnerPos.x - ctx.playerPos.x
  const dy = ctx.partnerPos.y - ctx.playerPos.y
  const distToPlayer = Math.sqrt(dx * dx + dy * dy)

  if (distToPlayer > 200) score += 0.25
  else if (distToPlayer > 120) score += 0.1

  // No enemies = follow is natural
  if (ctx.enemies.length === 0) score += 0.3

  // Player proximity personality modifier
  score *= 0.4 + personality.playerProximity * 0.6

  // Breathe phase of director = follow is good
  if (ctx.directorTension < 0.2) score += 0.1

  return { score: clamp(score, 0, 1), reasoning: `follow: ${Math.round(distToPlayer)}px from player, ${ctx.enemies.length} enemies` }
}

function scoreHeal(ctx: UtilityContext): { score: number; reasoning: string } {
  // "Heal" means moving to a defensive position and prioritizing survival
  // (The partner can't literally heal, but this directive signals self-care)
  let score = 0.05 // very low base

  const partnerHpRatio = ctx.partnerHp / ctx.partnerMaxHp
  const playerHpRatio = ctx.playerHp / ctx.playerMaxHp

  // Both low HP = heal mode (retreat to safe position together)
  if (partnerHpRatio < LOW_HP_THRESHOLD && playerHpRatio < LOW_HP_THRESHOLD) {
    score += 0.4
  }

  // Partner critically low = heal is a strong option
  if (partnerHpRatio < CRITICAL_HP_THRESHOLD) score += 0.3

  // Very high tension = heal/survival mode
  if (ctx.directorTension > 0.85) score += 0.15

  return { score: clamp(score, 0, 1), reasoning: `heal: partnerHP ${Math.round(partnerHpRatio * 100)}%, playerHP ${Math.round(playerHpRatio * 100)}%` }
}

// ── Main evaluation function ─────────────────────────────────────────

export function evaluatePartnerAction(ctx: UtilityContext): UtilityResult {
  const actions: Array<{ action: DirectiveType; score: number; reasoning: string; targetId?: string }> = [
    { action: 'attack', ...scoreAttack(ctx) },
    { action: 'defend', ...scoreDefend(ctx) },
    { action: 'retreat', ...scoreRetreat(ctx) },
    { action: 'flank', ...scoreFlank(ctx) },
    { action: 'follow', ...scoreFollow(ctx) },
    { action: 'heal', ...scoreHeal(ctx) },
  ]

  // Apply momentum bonus: current action gets +20% so we don't flicker
  for (const a of actions) {
    if (a.action === ctx.currentAction) {
      a.score *= (1 + MOMENTUM_BONUS)
      a.reasoning += ' [momentum]'
    }
  }

  // Pick the highest-scoring action
  actions.sort((a, b) => b.score - a.score)
  const best = actions[0]

  return {
    action: best.action,
    score: best.score,
    reasoning: best.reasoning,
    targetId: best.targetId,
  }
}

// ── Utility ──────────────────────────────────────────────────────────

function clamp(v: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, v))
}
