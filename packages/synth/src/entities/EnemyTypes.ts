// SYNTH — Enemy Type Definitions
// Each type has unique stats, behavior, and visual identity.

import type { EnemyType } from '../types'
import {
  TEX,
  SHIELDED_HP, SHIELDED_SPEED, SHIELDED_DAMAGE, SHIELDED_ATTACK_RANGE,
  SHIELDED_CHASE_RANGE, SHIELDED_SHIELD_ARC, SHIELDED_COLOR,
  EXPLODER_HP, EXPLODER_SPEED, EXPLODER_DAMAGE, EXPLODER_CHASE_RANGE,
  EXPLODER_DETONATE_RANGE, EXPLODER_FUSE_MS, EXPLODER_EXPLOSION_DAMAGE,
  EXPLODER_EXPLOSION_RADIUS, EXPLODER_COLOR,
  HEALER_HP, HEALER_SPEED, HEALER_DAMAGE, HEALER_CHASE_RANGE,
  HEALER_HEAL_AMOUNT, HEALER_HEAL_COOLDOWN, HEALER_HEAL_RANGE,
  HEALER_FLEE_RANGE, HEALER_COLOR,
  SUMMONER_HP, SUMMONER_SPEED, SUMMONER_DAMAGE, SUMMONER_CHASE_RANGE,
  SUMMONER_SPAWN_COOLDOWN, SUMMONER_SPAWN_COUNT_MIN, SUMMONER_SPAWN_COUNT_MAX,
  SUMMONER_MAX_SUMMONS, SUMMONER_ROTATE_SPEED, SUMMONER_COLOR,
} from '../constants'

export interface EnemyTypeConfig {
  hp: number
  speed: number
  damage: number
  attackRange: number
  chaseRange: number
  color: number
  sprite: string
  /** Ranged enemies only: ms between shots */
  shootCooldown?: number
  /** Fast enemies only: zigzag amplitude in px */
  zigzagAmplitude?: number
  /** Tank enemies only: charge speed multiplier */
  chargeSpeedMultiplier?: number
  /** Tank enemies only: distance threshold to trigger charge */
  chargeDistance?: number
  /** Shielded enemies only: front-facing shield arc in degrees */
  shieldArc?: number
  /** Exploder enemies only: range to start detonation countdown */
  detonateRange?: number
  /** Exploder enemies only: fuse duration in ms */
  fuseMs?: number
  /** Exploder enemies only: explosion damage */
  explosionDamage?: number
  /** Exploder enemies only: explosion radius in px */
  explosionRadius?: number
  /** Healer enemies only: HP healed per tick */
  healAmount?: number
  /** Healer enemies only: ms between heals */
  healCooldown?: number
  /** Healer enemies only: max range to heal target */
  healRange?: number
  /** Healer enemies only: distance at which healer starts fleeing from player */
  fleeRange?: number
  /** Summoner enemies only: ms between spawn events */
  spawnCooldown?: number
  /** Summoner enemies only: min enemies spawned per event */
  spawnCountMin?: number
  /** Summoner enemies only: max enemies spawned per event */
  spawnCountMax?: number
  /** Summoner enemies only: max alive summons at once */
  maxSummons?: number
  /** Summoner enemies only: rotation speed in radians/s */
  rotateSpeed?: number
}

export const ENEMY_TYPES: Record<EnemyType, EnemyTypeConfig> = {
  melee: {
    hp: 30,
    speed: 120,
    damage: 10,
    attackRange: 30,
    chaseRange: 200,
    color: 0xff4444,
    sprite: TEX.ENEMY,
  },
  ranged: {
    hp: 20,
    speed: 60,
    damage: 8,
    attackRange: 250,
    chaseRange: 300,
    color: 0xff8800,
    sprite: TEX.ENEMY_RANGED,
    shootCooldown: 1500,
  },
  fast: {
    hp: 15,
    speed: 220,
    damage: 6,
    attackRange: 25,
    chaseRange: 250,
    color: 0xff2222,
    sprite: TEX.ENEMY,
    zigzagAmplitude: 60,
  },
  tank: {
    hp: 80,
    speed: 60,
    damage: 18,
    attackRange: 40,
    chaseRange: 180,
    color: 0xaa2222,
    sprite: TEX.ENEMY_FAST_TANK,
    chargeSpeedMultiplier: 3.5,
    chargeDistance: 100,
  },
  shielded: {
    hp: SHIELDED_HP,
    speed: SHIELDED_SPEED,
    damage: SHIELDED_DAMAGE,
    attackRange: SHIELDED_ATTACK_RANGE,
    chaseRange: SHIELDED_CHASE_RANGE,
    color: SHIELDED_COLOR,
    sprite: TEX.ENEMY_SHIELDED,
    shieldArc: SHIELDED_SHIELD_ARC,
  },
  exploder: {
    hp: EXPLODER_HP,
    speed: EXPLODER_SPEED,
    damage: EXPLODER_DAMAGE,
    attackRange: EXPLODER_DETONATE_RANGE,
    chaseRange: EXPLODER_CHASE_RANGE,
    color: EXPLODER_COLOR,
    sprite: TEX.ENEMY_EXPLODER,
    detonateRange: EXPLODER_DETONATE_RANGE,
    fuseMs: EXPLODER_FUSE_MS,
    explosionDamage: EXPLODER_EXPLOSION_DAMAGE,
    explosionRadius: EXPLODER_EXPLOSION_RADIUS,
  },
  healer: {
    hp: HEALER_HP,
    speed: HEALER_SPEED,
    damage: HEALER_DAMAGE,
    attackRange: 20,
    chaseRange: HEALER_CHASE_RANGE,
    color: HEALER_COLOR,
    sprite: TEX.ENEMY_HEALER,
    healAmount: HEALER_HEAL_AMOUNT,
    healCooldown: HEALER_HEAL_COOLDOWN,
    healRange: HEALER_HEAL_RANGE,
    fleeRange: HEALER_FLEE_RANGE,
  },
  summoner: {
    hp: SUMMONER_HP,
    speed: SUMMONER_SPEED,
    damage: SUMMONER_DAMAGE,
    attackRange: 0,
    chaseRange: SUMMONER_CHASE_RANGE,
    color: SUMMONER_COLOR,
    sprite: TEX.ENEMY_SUMMONER,
    spawnCooldown: SUMMONER_SPAWN_COOLDOWN,
    spawnCountMin: SUMMONER_SPAWN_COUNT_MIN,
    spawnCountMax: SUMMONER_SPAWN_COUNT_MAX,
    maxSummons: SUMMONER_MAX_SUMMONS,
    rotateSpeed: SUMMONER_ROTATE_SPEED,
  },
}

/** Pick a random enemy type with weighted distribution */
export function randomEnemyType(): EnemyType {
  const roll = Math.random()
  if (roll < 0.30) return 'melee'
  if (roll < 0.45) return 'ranged'
  if (roll < 0.60) return 'fast'
  if (roll < 0.72) return 'tank'
  if (roll < 0.82) return 'shielded'
  if (roll < 0.90) return 'exploder'
  if (roll < 0.96) return 'healer'
  return 'summoner'
}
