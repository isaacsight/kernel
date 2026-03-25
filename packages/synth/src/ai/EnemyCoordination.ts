// SYNTH — Enemy Coordination System
//
// Enemies fight SMART, not just individually.
// Flanking, focus fire, retreat cascades, pack waves.
// All client-side, zero API calls.

import type { Vec2, EnemyType } from '../types'

// ── Types ────────────────────────────────────────────────────────────

export interface CoordinationEnemy {
  id: string
  position: Vec2
  hp: number
  maxHp: number
  enemyType: EnemyType
  state: string
  distanceToPlayer: number
  distanceToPartner: number
}

export interface EnemyDirective {
  enemyId: string
  /** Override target: 'player' or 'partner' */
  preferredTarget: 'player' | 'partner' | null
  /** Position offset to apply (for flanking) */
  positionOffset: Vec2 | null
  /** Speed multiplier (for caution/aggression) */
  speedMod: number
  /** Whether this enemy should hold back (pack wave timing) */
  holdBack: boolean
  /** Tactical role assigned by coordination */
  role: 'flanker' | 'focus' | 'cautious' | 'wave_lead' | 'wave_follow' | 'default'
}

// ── Constants ────────────────────────────────────────────────────────

const FLANK_DISTANCE = 60             // how far to offset for flanking
const FOCUS_FIRE_HP_THRESHOLD = 0.35  // target player when below this HP ratio
const RETREAT_CASCADE_RANGE = 120     // range for retreat cascade effect
const RETREAT_CASCADE_CAUTION = 0.7   // speed mod when nearby ally is fleeing
const PACK_WAVE_INTERVAL_MS = 2000    // stagger between wave groups
const PACK_WAVE_SIZE = 2             // max enemies per wave

// ── Main coordination function ───────────────────────────────────────

export function coordinateEnemies(
  enemies: CoordinationEnemy[],
  playerPos: Vec2,
  partnerPos: Vec2,
  playerHpRatio: number,
  elapsedMs: number,
): EnemyDirective[] {
  if (enemies.length === 0) return []

  const directives: EnemyDirective[] = enemies.map(e => ({
    enemyId: e.id,
    preferredTarget: null,
    positionOffset: null,
    speedMod: 1.0,
    holdBack: false,
    role: 'default' as const,
  }))

  const directiveMap = new Map<string, EnemyDirective>()
  for (const d of directives) {
    directiveMap.set(d.enemyId, d)
  }

  // ── 1. Focus Fire: when player is low HP, prioritize the player ──
  applyFocusFire(enemies, directiveMap, playerHpRatio)

  // ── 2. Flanking: when 2+ enemies target the player, one circles around ──
  applyFlanking(enemies, directiveMap, playerPos, partnerPos)

  // ── 3. Retreat Cascade: fleeing enemies make nearby ones cautious ──
  applyRetreatCascade(enemies, directiveMap)

  // ── 4. Pack Behavior: fast enemies attack in coordinated waves ──
  applyPackWaves(enemies, directiveMap, elapsedMs)

  return directives
}

// ── Focus Fire ───────────────────────────────────────────────────────

function applyFocusFire(
  enemies: CoordinationEnemy[],
  directives: Map<string, EnemyDirective>,
  playerHpRatio: number,
): void {
  if (playerHpRatio > FOCUS_FIRE_HP_THRESHOLD) return

  // The lower the player HP, the more enemies switch to player
  const focusChance = 1 - (playerHpRatio / FOCUS_FIRE_HP_THRESHOLD)

  for (const enemy of enemies) {
    if (enemy.state === 'flee') continue
    const d = directives.get(enemy.id)
    if (!d) continue

    // Enemies already closer to the player get priority
    if (enemy.distanceToPlayer < enemy.distanceToPartner || Math.random() < focusChance) {
      d.preferredTarget = 'player'
      d.role = 'focus'
    }
  }
}

// ── Flanking ─────────────────────────────────────────────────────────

function applyFlanking(
  enemies: CoordinationEnemy[],
  directives: Map<string, EnemyDirective>,
  playerPos: Vec2,
  partnerPos: Vec2,
): void {
  // Find enemies targeting the player (within chase range)
  const playerTargeters = enemies.filter(e =>
    e.state !== 'flee' &&
    e.state !== 'idle' &&
    e.distanceToPlayer < 250,
  )

  if (playerTargeters.length < 2) return

  // Sort by distance: the SECOND closest becomes the flanker
  playerTargeters.sort((a, b) => a.distanceToPlayer - b.distanceToPlayer)

  // Assign flanker role to every other enemy (starting from the 2nd)
  for (let i = 1; i < playerTargeters.length; i += 2) {
    const flanker = playerTargeters[i]
    const d = directives.get(flanker.id)
    if (!d || d.role === 'focus') continue // don't override focus fire

    // Calculate flank position: opposite side of the player from the nearest ally
    const nearest = playerTargeters[0]
    const angleFromPlayer = Math.atan2(
      nearest.position.y - playerPos.y,
      nearest.position.x - playerPos.x,
    )

    // Flanker goes to the opposite side
    const flankAngle = angleFromPlayer + Math.PI
    d.positionOffset = {
      x: Math.cos(flankAngle) * FLANK_DISTANCE,
      y: Math.sin(flankAngle) * FLANK_DISTANCE,
    }
    d.role = 'flanker'
    d.preferredTarget = 'player'
  }

  // If partner is far from the combat, send one enemy to pressure the partner
  const partnerDx = partnerPos.x - playerPos.x
  const partnerDy = partnerPos.y - playerPos.y
  const partnerDist = Math.sqrt(partnerDx * partnerDx + partnerDy * partnerDy)

  if (partnerDist > 150 && playerTargeters.length >= 3) {
    const splitter = playerTargeters[playerTargeters.length - 1]
    const d = directives.get(splitter.id)
    if (d && d.role !== 'focus') {
      d.preferredTarget = 'partner'
      d.positionOffset = null
      d.role = 'flanker'
    }
  }
}

// ── Retreat Cascade ──────────────────────────────────────────────────

function applyRetreatCascade(
  enemies: CoordinationEnemy[],
  directives: Map<string, EnemyDirective>,
): void {
  const fleeing = enemies.filter(e => e.state === 'flee')
  if (fleeing.length === 0) return

  for (const fleeingEnemy of fleeing) {
    for (const nearby of enemies) {
      if (nearby.id === fleeingEnemy.id) continue
      if (nearby.state === 'flee') continue

      const dx = nearby.position.x - fleeingEnemy.position.x
      const dy = nearby.position.y - fleeingEnemy.position.y
      const dist = Math.sqrt(dx * dx + dy * dy)

      if (dist < RETREAT_CASCADE_RANGE) {
        const d = directives.get(nearby.id)
        if (!d) continue

        // Nearby enemies become cautious (slow down)
        d.speedMod = Math.min(d.speedMod, RETREAT_CASCADE_CAUTION)
        if (d.role === 'default') {
          d.role = 'cautious'
        }
      }
    }
  }
}

// ── Pack Waves ───────────────────────────────────────────────────────
// Fast enemies don't all rush at once. They attack in staggered waves.

function applyPackWaves(
  enemies: CoordinationEnemy[],
  directives: Map<string, EnemyDirective>,
  elapsedMs: number,
): void {
  const fastEnemies = enemies.filter(e =>
    e.enemyType === 'fast' &&
    e.state !== 'flee' &&
    e.state !== 'idle',
  )

  if (fastEnemies.length < 3) return

  // Determine current wave group
  const waveIndex = Math.floor(elapsedMs / PACK_WAVE_INTERVAL_MS) % Math.ceil(fastEnemies.length / PACK_WAVE_SIZE)

  for (let i = 0; i < fastEnemies.length; i++) {
    const enemyWaveGroup = Math.floor(i / PACK_WAVE_SIZE)
    const d = directives.get(fastEnemies[i].id)
    if (!d) continue

    if (enemyWaveGroup === waveIndex) {
      // This group attacks NOW
      d.speedMod = Math.max(d.speedMod, 1.1)  // slightly faster
      d.holdBack = false
      d.role = d.role === 'default' ? 'wave_lead' : d.role
    } else {
      // This group holds back
      d.holdBack = true
      d.speedMod = Math.min(d.speedMod, 0.4) // much slower, hanging back
      d.role = d.role === 'default' ? 'wave_follow' : d.role
    }
  }
}
