// SYNTH — Floor Modifier System (PoE Map Mods)
//
// Before each floor, offer 3-5 optional modifiers the player can accept.
// Each modifier makes the floor harder but increases rewards.
// Inspired by Path of Exile's map modifier system — risk/reward self-selection.

// ── Modifier Types ──────────────────────────────────────────────────

export type FloorModifierId =
  | 'lethal'
  | 'hastened'
  | 'armored'
  | 'cursed_ground'
  | 'volatile'
  | 'swarm'
  | 'darkness'
  | 'berserker'

export interface FloorModifierDef {
  id: FloorModifierId
  name: string
  description: string
  /** Color used in the modifier card UI */
  color: number
  /** Icon character (monospace-safe) */
  icon: string
  /** Multipliers applied to enemy/player stats and drop rates */
  effects: FloorModifierEffects
}

export interface FloorModifierEffects {
  /** Multiplier on enemy attack damage (1.0 = no change) */
  enemyDamageMult: number
  /** Multiplier on enemy speed (1.0 = no change) */
  enemySpeedMult: number
  /** Multiplier on enemy HP (1.0 = no change) */
  enemyHpMult: number
  /** Extra enemies to add per room (0 = no change) */
  extraEnemiesPerRoom: number
  /** Multiplier on item drop chance (1.0 = no change) */
  lootDropMult: number
  /** Multiplier on weapon mod drop chance (1.0 = no change) */
  modDropMult: number
  /** Multiplier on XP gained (1.0 = no change) */
  xpMult: number
  /** If true, no health pickups drop from enemies or director */
  noHealthDrops: boolean
  /** Multiplier on player damage dealt (1.0 = no change) */
  playerDamageMult: number
  /** Multiplier on player damage taken (1.0 = no change) */
  playerDamageTakenMult: number
  /** If true, enemies explode on death dealing area damage */
  enemiesExplodeOnDeath: boolean
  /** Reduced visibility radius (0 = no effect, >0 = darken outside radius) */
  visibilityReduction: number
}

// ── Default (neutral) effects ───────────────────────────────────────

function defaultEffects(): FloorModifierEffects {
  return {
    enemyDamageMult: 1.0,
    enemySpeedMult: 1.0,
    enemyHpMult: 1.0,
    extraEnemiesPerRoom: 0,
    lootDropMult: 1.0,
    modDropMult: 1.0,
    xpMult: 1.0,
    noHealthDrops: false,
    playerDamageMult: 1.0,
    playerDamageTakenMult: 1.0,
    enemiesExplodeOnDeath: false,
    visibilityReduction: 0,
  }
}

// ── Modifier Catalog ────────────────────────────────────────────────

const ALL_MODIFIERS: FloorModifierDef[] = [
  {
    id: 'lethal',
    name: 'Lethal',
    description: 'Enemies deal +40% damage.\n+30% loot drops.',
    color: 0xff4444,
    icon: '!',
    effects: {
      ...defaultEffects(),
      enemyDamageMult: 1.4,
      lootDropMult: 1.3,
      modDropMult: 1.3,
    },
  },
  {
    id: 'hastened',
    name: 'Hastened',
    description: 'Enemies move +25% faster.\n+20% loot drops.',
    color: 0xffaa22,
    icon: '>',
    effects: {
      ...defaultEffects(),
      enemySpeedMult: 1.25,
      lootDropMult: 1.2,
      modDropMult: 1.2,
    },
  },
  {
    id: 'armored',
    name: 'Armored',
    description: 'Enemies have +50% HP.\n+25% loot drops.',
    color: 0x8888cc,
    icon: '#',
    effects: {
      ...defaultEffects(),
      enemyHpMult: 1.5,
      lootDropMult: 1.25,
      modDropMult: 1.25,
    },
  },
  {
    id: 'cursed_ground',
    name: 'Cursed Ground',
    description: 'No health drops this floor.\n+50% mod drops.',
    color: 0xaa44ff,
    icon: '~',
    effects: {
      ...defaultEffects(),
      noHealthDrops: true,
      modDropMult: 1.5,
    },
  },
  {
    id: 'volatile',
    name: 'Volatile',
    description: 'Enemies explode on death.\n+35% loot drops.',
    color: 0xff6600,
    icon: '*',
    effects: {
      ...defaultEffects(),
      enemiesExplodeOnDeath: true,
      lootDropMult: 1.35,
      modDropMult: 1.35,
    },
  },
  {
    id: 'swarm',
    name: 'Swarm',
    description: '+5 extra enemies per room.\n+40% loot drops.',
    color: 0xdd2222,
    icon: '%',
    effects: {
      ...defaultEffects(),
      extraEnemiesPerRoom: 5,
      lootDropMult: 1.4,
      modDropMult: 1.4,
    },
  },
  {
    id: 'darkness',
    name: 'Darkness',
    description: 'Reduced visibility.\n+30% loot drops.',
    color: 0x4444aa,
    icon: '.',
    effects: {
      ...defaultEffects(),
      visibilityReduction: 120,
      lootDropMult: 1.3,
      modDropMult: 1.3,
    },
  },
  {
    id: 'berserker',
    name: 'Berserker',
    description: 'Deal 2x damage, take 2x damage.\n+20% XP.',
    color: 0xff2288,
    icon: 'X',
    effects: {
      ...defaultEffects(),
      playerDamageMult: 2.0,
      playerDamageTakenMult: 2.0,
      xpMult: 1.2,
    },
  },
]

// ── Floor Modifier Manager ──────────────────────────────────────────

export class FloorModifierManager {
  /** Modifiers active for the current floor */
  private activeModifiers: FloorModifierDef[] = []
  /** Cached merged effects for the current floor */
  private mergedEffects: FloorModifierEffects = defaultEffects()

  /**
   * Generate a random selection of modifier choices for the player.
   * Returns 3-5 modifiers, shuffled from the full catalog.
   */
  rollChoices(): FloorModifierDef[] {
    const count = 3 + Math.floor(Math.random() * 3) // 3, 4, or 5
    const shuffled = [...ALL_MODIFIERS].sort(() => Math.random() - 0.5)
    return shuffled.slice(0, count)
  }

  /**
   * Set the active modifiers for this floor and recompute merged effects.
   * Called after the player has accepted/rejected modifiers.
   */
  setActiveModifiers(mods: FloorModifierDef[]): void {
    this.activeModifiers = [...mods]
    this.mergedEffects = this.computeMergedEffects()
  }

  /**
   * Clear all modifiers (e.g., on run start / game over).
   */
  clear(): void {
    this.activeModifiers = []
    this.mergedEffects = defaultEffects()
  }

  /**
   * Get the list of currently active modifier definitions.
   */
  getActiveModifiers(): FloorModifierDef[] {
    return this.activeModifiers
  }

  /**
   * Get the merged effects of all active modifiers.
   * Multiplicative stats stack multiplicatively.
   * Additive stats (extra enemies) stack additively.
   * Boolean flags OR together.
   */
  getEffects(): FloorModifierEffects {
    return this.mergedEffects
  }

  /**
   * Check if a specific modifier is active.
   */
  hasModifier(id: FloorModifierId): boolean {
    return this.activeModifiers.some(m => m.id === id)
  }

  /**
   * Compute combined effects from all active modifiers.
   */
  private computeMergedEffects(): FloorModifierEffects {
    const base = defaultEffects()

    for (const mod of this.activeModifiers) {
      const fx = mod.effects
      base.enemyDamageMult *= fx.enemyDamageMult
      base.enemySpeedMult *= fx.enemySpeedMult
      base.enemyHpMult *= fx.enemyHpMult
      base.extraEnemiesPerRoom += fx.extraEnemiesPerRoom
      base.lootDropMult *= fx.lootDropMult
      base.modDropMult *= fx.modDropMult
      base.xpMult *= fx.xpMult
      base.playerDamageMult *= fx.playerDamageMult
      base.playerDamageTakenMult *= fx.playerDamageTakenMult
      if (fx.noHealthDrops) base.noHealthDrops = true
      if (fx.enemiesExplodeOnDeath) base.enemiesExplodeOnDeath = true
      base.visibilityReduction = Math.max(base.visibilityReduction, fx.visibilityReduction)
    }

    return base
  }
}

// ── Singleton ───────────────────────────────────────────────────────

export const floorModifiers = new FloorModifierManager()
