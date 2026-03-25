// SYNTH — XP & Leveling System
// Kill enemies → gain XP → level up → choose an upgrade.

export type EnemyType = 'basic' | 'fast' | 'heavy' | 'boss'

export type UpgradeId =
  | 'max_hp'
  | 'damage'
  | 'speed'
  | 'attack_speed'
  | 'partner_damage'
  | 'partner_hp'

export interface Upgrade {
  id: UpgradeId
  name: string
  description: string
  /** Color used in the level-up UI card */
  color: number
}

export interface ProgressionState {
  xp: number
  level: number
  totalKills: number
}

// ── XP Table ─────────────────────────────────────────────────────────

const XP_PER_ENEMY: Record<EnemyType, number> = {
  basic: 10,
  fast: 15,
  heavy: 25,
  boss: 100,
}

/**
 * XP awarded for killing an enemy of the given type.
 */
export function getXPForKill(enemyType: EnemyType): number {
  return XP_PER_ENEMY[enemyType] ?? XP_PER_ENEMY.basic
}

// ── Level Thresholds ─────────────────────────────────────────────────

/**
 * XP required to reach the next level from `currentLevel`.
 * Formula: level * 100  (level 1 → 100 XP, level 2 → 200 XP, ...)
 */
export function xpForNextLevel(currentLevel: number): number {
  return currentLevel * 100
}

/**
 * Check if the player should level up.
 * Returns the number of pending level-ups (usually 0 or 1, but can stack).
 */
export function checkLevelUp(currentXP: number, currentLevel: number): number {
  let lvl = currentLevel
  let remaining = currentXP
  let levels = 0

  while (remaining >= xpForNextLevel(lvl)) {
    remaining -= xpForNextLevel(lvl)
    lvl++
    levels++
  }

  return levels
}

/**
 * Consume XP for level-ups and return the new state.
 */
export function applyLevelUps(state: ProgressionState, count: number): ProgressionState {
  let { xp, level } = state
  for (let i = 0; i < count; i++) {
    xp -= xpForNextLevel(level)
    level++
  }
  return { ...state, xp, level }
}

// ── Upgrade Catalog ──────────────────────────────────────────────────

const ALL_UPGRADES: Upgrade[] = [
  {
    id: 'max_hp',
    name: '+10 Max HP',
    description: 'Increase your maximum health by 10.',
    color: 0x44ff88,
  },
  {
    id: 'damage',
    name: '+5 Damage',
    description: 'Each shot deals 5 more damage.',
    color: 0xff6644,
  },
  {
    id: 'speed',
    name: '+15% Speed',
    description: 'Move 15% faster.',
    color: 0x44ddff,
  },
  {
    id: 'attack_speed',
    name: '+20% Attack Speed',
    description: 'Fire 20% faster.',
    color: 0xffff44,
  },
  {
    id: 'partner_damage',
    name: 'Partner +5 DMG',
    description: 'Your partner deals 5 more damage per shot.',
    color: 0x44ff88,
  },
  {
    id: 'partner_hp',
    name: 'Partner +15 HP',
    description: 'Your partner gains 15 max HP (and heals that amount).',
    color: 0x88ffaa,
  },
]

/**
 * Return 3 random, non-duplicate upgrade choices.
 */
export function getUpgradeChoices(): Upgrade[] {
  const shuffled = [...ALL_UPGRADES].sort(() => Math.random() - 0.5)
  return shuffled.slice(0, 3)
}

/**
 * Create an initial progression state.
 */
export function createProgressionState(): ProgressionState {
  return { xp: 0, level: 1, totalKills: 0 }
}
