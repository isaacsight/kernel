// SYNTH — Enemy Behavior AI
// Each enemy type has distinct movement, attack, and tactical patterns.

import type { Vec2, EnemyState, EnemyType } from '../types'
import type { EnemyTypeConfig } from '../entities/EnemyTypes'
import { ENEMY_TYPES } from '../entities/EnemyTypes'
import { ENEMY_FLEE_THRESHOLD } from '../constants'

function dist(a: Vec2, b: Vec2): number {
  return Math.sqrt((a.x - b.x) ** 2 + (a.y - b.y) ** 2)
}

function moveToward(from: Vec2, to: Vec2, speed: number): Vec2 {
  const d = dist(from, to)
  if (d < 1) return { x: 0, y: 0 }
  return {
    x: ((to.x - from.x) / d) * speed,
    y: ((to.y - from.y) / d) * speed,
  }
}

/** Returns the angle from `from` toward `to` in radians */
function angleBetween(from: Vec2, to: Vec2): number {
  return Math.atan2(to.y - from.y, to.x - from.x)
}

export interface EnemyBehaviorResult {
  newState: EnemyState
  velocity: Vec2
  shouldAttack: boolean
  /** Ranged enemies: if true, fire a projectile instead of melee */
  shouldShoot: boolean
  /** Angle toward current target (used for ranged shots) */
  targetAngle: number
  /** Facing angle in radians — used by shielded enemies for shield direction */
  facingAngle?: number
  /** Exploder: if true, start the detonation countdown */
  shouldDetonate?: boolean
  /** Healer: if true, perform a heal on the lowest-HP nearby enemy */
  shouldHeal?: boolean
  /** Summoner: if true, spawn enemies */
  shouldSummon?: boolean
}

/** Info about a nearby enemy — used for healer/pack AI */
export interface NearbyEnemyInfo {
  id: string
  position: Vec2
  hp: number
  maxHp: number
}

// ── Melee Behavior ──────────────────────────────────────────────────
// Classic chase-and-bash. Simple, predictable, threatening in groups.

function meleeBehavior(
  pos: Vec2, hp: number, maxHp: number, state: EnemyState,
  targetPos: Vec2, targetDist: number, cfg: EnemyTypeConfig,
): EnemyBehaviorResult {
  const angle = Math.atan2(targetPos.y - pos.y, targetPos.x - pos.x)
  const base: Omit<EnemyBehaviorResult, 'newState' | 'velocity' | 'shouldAttack'> = {
    shouldShoot: false,
    targetAngle: angle,
  }

  if (hp / maxHp < ENEMY_FLEE_THRESHOLD) {
    const away = moveToward(pos, targetPos, cfg.speed)
    return { ...base, newState: 'flee', velocity: { x: -away.x, y: -away.y }, shouldAttack: false }
  }

  switch (state) {
    case 'idle':
      if (targetDist < cfg.chaseRange) {
        return { ...base, newState: 'chase', velocity: { x: 0, y: 0 }, shouldAttack: false }
      }
      return { ...base, newState: 'idle', velocity: { x: 0, y: 0 }, shouldAttack: false }

    case 'chase':
      if (targetDist < cfg.attackRange) {
        return { ...base, newState: 'attack', velocity: { x: 0, y: 0 }, shouldAttack: true }
      }
      if (targetDist > cfg.chaseRange * 1.5) {
        return { ...base, newState: 'idle', velocity: { x: 0, y: 0 }, shouldAttack: false }
      }
      return { ...base, newState: 'chase', velocity: moveToward(pos, targetPos, cfg.speed), shouldAttack: false }

    case 'attack':
      if (targetDist > cfg.attackRange * 1.5) {
        return { ...base, newState: 'chase', velocity: { x: 0, y: 0 }, shouldAttack: false }
      }
      return { ...base, newState: 'attack', velocity: { x: 0, y: 0 }, shouldAttack: true }

    case 'flee': {
      if (hp / maxHp >= ENEMY_FLEE_THRESHOLD) {
        return { ...base, newState: 'chase', velocity: { x: 0, y: 0 }, shouldAttack: false }
      }
      const away = moveToward(pos, targetPos, cfg.speed)
      return { ...base, newState: 'flee', velocity: { x: -away.x, y: -away.y }, shouldAttack: false }
    }

    default:
      return { ...base, newState: 'idle', velocity: { x: 0, y: 0 }, shouldAttack: false }
  }
}

// ── Ranged Behavior ─────────────────────────────────────────────────
// Maintains distance (150-250px), strafes laterally, shoots projectiles.
// Retreats if player gets too close.

function rangedBehavior(
  pos: Vec2, hp: number, maxHp: number, state: EnemyState,
  targetPos: Vec2, targetDist: number, cfg: EnemyTypeConfig, elapsed: number,
): EnemyBehaviorResult {
  const angle = Math.atan2(targetPos.y - pos.y, targetPos.x - pos.x)
  const base: Omit<EnemyBehaviorResult, 'newState' | 'velocity' | 'shouldAttack' | 'shouldShoot'> = {
    targetAngle: angle,
  }

  const IDEAL_MIN = 150
  const IDEAL_MAX = 250

  if (hp / maxHp < ENEMY_FLEE_THRESHOLD) {
    const away = moveToward(pos, targetPos, cfg.speed * 1.5)
    return { ...base, newState: 'flee', velocity: { x: -away.x, y: -away.y }, shouldAttack: false, shouldShoot: false }
  }

  if (targetDist > cfg.chaseRange && state === 'idle') {
    return { ...base, newState: 'idle', velocity: { x: 0, y: 0 }, shouldAttack: false, shouldShoot: false }
  }

  // Too close — back away
  if (targetDist < IDEAL_MIN) {
    const away = moveToward(pos, targetPos, cfg.speed)
    return { ...base, newState: 'strafe', velocity: { x: -away.x, y: -away.y }, shouldAttack: false, shouldShoot: targetDist < cfg.attackRange }
  }

  // In ideal range — strafe laterally and shoot
  if (targetDist <= IDEAL_MAX) {
    // Strafe perpendicular to the player
    const perpAngle = angle + (Math.sin(elapsed * 0.002) > 0 ? Math.PI / 2 : -Math.PI / 2)
    const vel: Vec2 = {
      x: Math.cos(perpAngle) * cfg.speed * 0.7,
      y: Math.sin(perpAngle) * cfg.speed * 0.7,
    }
    return { ...base, newState: 'strafe', velocity: vel, shouldAttack: false, shouldShoot: true }
  }

  // Too far — close in
  return { ...base, newState: 'chase', velocity: moveToward(pos, targetPos, cfg.speed), shouldAttack: false, shouldShoot: false }
}

// ── Fast Behavior ───────────────────────────────────────────────────
// Zigzag approach, attack in rapid bursts, disengage briefly.

function fastBehavior(
  pos: Vec2, hp: number, maxHp: number, state: EnemyState,
  targetPos: Vec2, targetDist: number, cfg: EnemyTypeConfig, elapsed: number,
): EnemyBehaviorResult {
  const angle = Math.atan2(targetPos.y - pos.y, targetPos.x - pos.x)
  const zigzag = cfg.zigzagAmplitude ?? 60
  const base: Omit<EnemyBehaviorResult, 'newState' | 'velocity' | 'shouldAttack'> = {
    shouldShoot: false,
    targetAngle: angle,
  }

  if (hp / maxHp < ENEMY_FLEE_THRESHOLD) {
    const away = moveToward(pos, targetPos, cfg.speed * 1.3)
    return { ...base, newState: 'flee', velocity: { x: -away.x, y: -away.y }, shouldAttack: false }
  }

  if (targetDist > cfg.chaseRange && state === 'idle') {
    return { ...base, newState: 'idle', velocity: { x: 0, y: 0 }, shouldAttack: false }
  }

  // Attack range — burst damage
  if (targetDist < cfg.attackRange) {
    // Brief disengage after attacking (every ~800ms dash away)
    const burstCycle = (elapsed % 1200)
    if (burstCycle > 800) {
      const away = moveToward(pos, targetPos, cfg.speed * 0.6)
      return { ...base, newState: 'chase', velocity: { x: -away.x, y: -away.y }, shouldAttack: false }
    }
    return { ...base, newState: 'attack', velocity: { x: 0, y: 0 }, shouldAttack: true }
  }

  // Chase with zigzag
  if (targetDist < cfg.chaseRange) {
    const direct = moveToward(pos, targetPos, cfg.speed)
    // Perpendicular oscillation for zigzag
    const perpAngle = angle + Math.PI / 2
    const zigOffset = Math.sin(elapsed * 0.006) * zigzag * 0.02
    return {
      ...base,
      newState: 'chase',
      velocity: {
        x: direct.x + Math.cos(perpAngle) * zigOffset * cfg.speed,
        y: direct.y + Math.sin(perpAngle) * zigOffset * cfg.speed,
      },
      shouldAttack: false,
    }
  }

  return { ...base, newState: 'idle', velocity: { x: 0, y: 0 }, shouldAttack: false }
}

// ── Tank Behavior ───────────────────────────────────────────────────
// Slow pursuit, but charges with a speed burst when close enough.
// Charge has a brief wind-up (telegraph), then lunges.

function tankBehavior(
  pos: Vec2, hp: number, maxHp: number, state: EnemyState,
  targetPos: Vec2, targetDist: number, cfg: EnemyTypeConfig,
): EnemyBehaviorResult {
  const angle = Math.atan2(targetPos.y - pos.y, targetPos.x - pos.x)
  const chargeThreshold = cfg.chargeDistance ?? 100
  const chargeMultiplier = cfg.chargeSpeedMultiplier ?? 3.5
  const base: Omit<EnemyBehaviorResult, 'newState' | 'velocity' | 'shouldAttack'> = {
    shouldShoot: false,
    targetAngle: angle,
  }

  // Tanks don't flee — they fight to the death
  if (state === 'idle' && targetDist > cfg.chaseRange) {
    if (targetDist < cfg.chaseRange * 1.2) {
      return { ...base, newState: 'chase', velocity: { x: 0, y: 0 }, shouldAttack: false }
    }
    return { ...base, newState: 'idle', velocity: { x: 0, y: 0 }, shouldAttack: false }
  }

  // Charge! Brief speed burst when within charge distance
  if (targetDist < chargeThreshold && targetDist > cfg.attackRange && state !== 'charge') {
    return {
      ...base,
      newState: 'charge',
      velocity: moveToward(pos, targetPos, cfg.speed * chargeMultiplier),
      shouldAttack: false,
    }
  }

  // Currently charging
  if (state === 'charge') {
    if (targetDist < cfg.attackRange) {
      return { ...base, newState: 'attack', velocity: { x: 0, y: 0 }, shouldAttack: true }
    }
    // Continue charge
    return {
      ...base,
      newState: 'charge',
      velocity: moveToward(pos, targetPos, cfg.speed * chargeMultiplier),
      shouldAttack: false,
    }
  }

  // Attack range
  if (targetDist < cfg.attackRange) {
    return { ...base, newState: 'attack', velocity: { x: 0, y: 0 }, shouldAttack: true }
  }

  // Slow chase
  if (targetDist < cfg.chaseRange * 1.5) {
    return { ...base, newState: 'chase', velocity: moveToward(pos, targetPos, cfg.speed), shouldAttack: false }
  }

  return { ...base, newState: 'idle', velocity: { x: 0, y: 0 }, shouldAttack: false }
}

// ── Shielded Behavior ──────────────────────────────────────────────
// Slow approach toward player, always facing target. Shield blocks frontal
// hits within a 120-degree arc. Must be flanked or hit from behind.

function shieldedBehavior(
  pos: Vec2, hp: number, maxHp: number, state: EnemyState,
  targetPos: Vec2, targetDist: number, cfg: EnemyTypeConfig,
): EnemyBehaviorResult {
  const angle = angleBetween(pos, targetPos)
  const base: Omit<EnemyBehaviorResult, 'newState' | 'velocity' | 'shouldAttack'> = {
    shouldShoot: false,
    targetAngle: angle,
    facingAngle: angle,
    shouldDetonate: false,
    shouldHeal: false,
    shouldSummon: false,
  }

  // Shielded enemies don't flee — they hold the line
  if (state === 'idle' && targetDist > cfg.chaseRange) {
    return { ...base, newState: 'idle', velocity: { x: 0, y: 0 }, shouldAttack: false }
  }

  // In attack range — bash
  if (targetDist < cfg.attackRange) {
    return { ...base, newState: 'attack', velocity: { x: 0, y: 0 }, shouldAttack: true }
  }

  // Slow advance — 60% speed, always facing target
  if (targetDist < cfg.chaseRange * 1.5) {
    return {
      ...base,
      newState: 'chase',
      velocity: moveToward(pos, targetPos, cfg.speed),
      shouldAttack: false,
    }
  }

  return { ...base, newState: 'idle', velocity: { x: 0, y: 0 }, shouldAttack: false }
}

/**
 * Check if a projectile hit comes from within the shielded enemy's front arc.
 * @param enemyFacing - The angle the enemy is facing (radians)
 * @param incomingAngle - The angle FROM the projectile TO the enemy (radians)
 * @param shieldArcDeg - The shield arc in degrees (e.g., 120)
 * @returns true if the hit is blocked by the shield
 */
export function isBlockedByShield(
  enemyFacing: number, incomingAngle: number, shieldArcDeg: number,
): boolean {
  // The shield faces the same direction as the enemy.
  // A hit is blocked if the incoming angle is within ±(arc/2) of the facing.
  // incomingAngle points from projectile to enemy, so the "front" of the shield
  // faces outward: we compare against enemyFacing (which points toward target).
  // The projectile approaches from the opposite side, so we flip incomingAngle.
  const approachAngle = incomingAngle + Math.PI
  let diff = approachAngle - enemyFacing
  // Normalize to [-PI, PI]
  while (diff > Math.PI) diff -= Math.PI * 2
  while (diff < -Math.PI) diff += Math.PI * 2
  const halfArc = (shieldArcDeg / 2) * (Math.PI / 180)
  return Math.abs(diff) <= halfArc
}

// ── Exploder Behavior ──────────────────────────────────────────────
// Rushes at 150% speed toward the player. When within detonateRange,
// enters 'detonate' state — flash rapidly for fuseMs, then explode.

function exploderBehavior(
  pos: Vec2, _hp: number, _maxHp: number, state: EnemyState,
  targetPos: Vec2, targetDist: number, cfg: EnemyTypeConfig,
): EnemyBehaviorResult {
  const angle = angleBetween(pos, targetPos)
  const detonateRange = cfg.detonateRange ?? 32
  const base: Omit<EnemyBehaviorResult, 'newState' | 'velocity' | 'shouldAttack'> = {
    shouldShoot: false,
    targetAngle: angle,
    shouldDetonate: false,
    shouldHeal: false,
    shouldSummon: false,
  }

  // Already detonating — hold position, the scene will handle the countdown
  if (state === 'detonate') {
    return {
      ...base,
      newState: 'detonate',
      velocity: { x: 0, y: 0 },
      shouldAttack: false,
      shouldDetonate: true,
    }
  }

  // Within detonation range — start the fuse
  if (targetDist < detonateRange) {
    return {
      ...base,
      newState: 'detonate',
      velocity: { x: 0, y: 0 },
      shouldAttack: false,
      shouldDetonate: true,
    }
  }

  // Rush toward target at full speed (already 150% in config)
  if (targetDist < cfg.chaseRange) {
    return {
      ...base,
      newState: 'chase',
      velocity: moveToward(pos, targetPos, cfg.speed),
      shouldAttack: false,
    }
  }

  // Idle but start chasing sooner than most enemies
  if (targetDist < cfg.chaseRange * 1.2) {
    return {
      ...base,
      newState: 'chase',
      velocity: moveToward(pos, targetPos, cfg.speed),
      shouldAttack: false,
    }
  }

  return { ...base, newState: 'idle', velocity: { x: 0, y: 0 }, shouldAttack: false }
}

// ── Healer Behavior ────────────────────────────────────────────────
// Cowardly support unit. Flees from the player, stays near other enemies.
// Every healCooldown ms, heals the lowest-HP ally within healRange.

function healerBehavior(
  pos: Vec2, hp: number, maxHp: number, state: EnemyState,
  targetPos: Vec2, targetDist: number, cfg: EnemyTypeConfig,
  _elapsed: number, nearbyEnemies: NearbyEnemyInfo[],
): EnemyBehaviorResult {
  const angle = angleBetween(pos, targetPos)
  const fleeRange = cfg.fleeRange ?? 160
  const base: Omit<EnemyBehaviorResult, 'newState' | 'velocity' | 'shouldAttack'> = {
    shouldShoot: false,
    targetAngle: angle,
    shouldDetonate: false,
    shouldHeal: false,
    shouldSummon: false,
  }

  // Always flee if player is close
  if (targetDist < fleeRange) {
    const away = moveToward(pos, targetPos, cfg.speed * 1.2)
    return {
      ...base,
      newState: 'flee',
      velocity: { x: -away.x, y: -away.y },
      shouldAttack: false,
      shouldHeal: false,
    }
  }

  // Low HP — panic flee
  if (hp / maxHp < ENEMY_FLEE_THRESHOLD) {
    const away = moveToward(pos, targetPos, cfg.speed * 1.4)
    return {
      ...base,
      newState: 'flee',
      velocity: { x: -away.x, y: -away.y },
      shouldAttack: false,
      shouldHeal: false,
    }
  }

  // Check for heal opportunity: find lowest-HP ally within range
  const healRange = cfg.healRange ?? 120
  const woundedAllies = nearbyEnemies.filter(e => {
    const d = dist(pos, e.position)
    return d <= healRange && e.hp < e.maxHp
  })

  if (woundedAllies.length > 0) {
    // Signal a heal — the scene will handle the actual heal application
    return {
      ...base,
      newState: 'heal',
      velocity: { x: 0, y: 0 },
      shouldAttack: false,
      shouldHeal: true,
    }
  }

  // No wounded allies — follow the pack (move toward nearest ally)
  if (nearbyEnemies.length > 0) {
    // Find the nearest ally and stay close
    let nearestAlly = nearbyEnemies[0]
    let nearestDist = dist(pos, nearestAlly.position)
    for (const ally of nearbyEnemies) {
      const d = dist(pos, ally.position)
      if (d < nearestDist) {
        nearestDist = d
        nearestAlly = ally
      }
    }

    // Stay within pack range but not too close
    if (nearestDist > healRange * 0.8) {
      return {
        ...base,
        newState: 'chase',
        velocity: moveToward(pos, nearestAlly.position, cfg.speed * 0.8),
        shouldAttack: false,
      }
    }
  }

  // Nothing to do — idle
  return { ...base, newState: 'idle', velocity: { x: 0, y: 0 }, shouldAttack: false }
}

// ── Summoner Behavior ──────────────────────────────────────────────
// Stationary. Periodically emits a summon event. Rotates slowly.

function summonerBehavior(
  pos: Vec2, _hp: number, _maxHp: number, _state: EnemyState,
  targetPos: Vec2, targetDist: number, cfg: EnemyTypeConfig,
): EnemyBehaviorResult {
  const angle = angleBetween(pos, targetPos)
  const base: Omit<EnemyBehaviorResult, 'newState' | 'velocity' | 'shouldAttack'> = {
    shouldShoot: false,
    targetAngle: angle,
    shouldDetonate: false,
    shouldHeal: false,
    shouldSummon: false,
  }

  // Summoner is always stationary — never moves
  // It only activates (starts summoning) when a target is in detection range
  if (targetDist < cfg.chaseRange) {
    return {
      ...base,
      newState: 'summon',
      velocity: { x: 0, y: 0 },
      shouldAttack: false,
      shouldSummon: true,
    }
  }

  return { ...base, newState: 'idle', velocity: { x: 0, y: 0 }, shouldAttack: false }
}

// ── Public API ──────────────────────────────────────────────────────

export function updateEnemyBehavior(
  pos: Vec2,
  hp: number,
  maxHp: number,
  state: EnemyState,
  playerPos: Vec2,
  partnerPos: Vec2,
  enemyType: EnemyType = 'melee',
  elapsed: number = 0,
  nearbyEnemies: NearbyEnemyInfo[] = [],
): EnemyBehaviorResult {
  const cfg = ENEMY_TYPES[enemyType]

  // Pick closest target
  const dPlayer = dist(pos, playerPos)
  const dPartner = dist(pos, partnerPos)
  const targetPos = dPlayer <= dPartner ? playerPos : partnerPos
  const targetDist = Math.min(dPlayer, dPartner)

  switch (enemyType) {
    case 'ranged':
      return rangedBehavior(pos, hp, maxHp, state, targetPos, targetDist, cfg, elapsed)
    case 'fast':
      return fastBehavior(pos, hp, maxHp, state, targetPos, targetDist, cfg, elapsed)
    case 'tank':
      return tankBehavior(pos, hp, maxHp, state, targetPos, targetDist, cfg)
    case 'shielded':
      return shieldedBehavior(pos, hp, maxHp, state, targetPos, targetDist, cfg)
    case 'exploder':
      return exploderBehavior(pos, hp, maxHp, state, targetPos, targetDist, cfg)
    case 'healer':
      return healerBehavior(pos, hp, maxHp, state, targetPos, targetDist, cfg, elapsed, nearbyEnemies)
    case 'summoner':
      return summonerBehavior(pos, hp, maxHp, state, targetPos, targetDist, cfg)
    default:
      return meleeBehavior(pos, hp, maxHp, state, targetPos, targetDist, cfg)
  }
}
