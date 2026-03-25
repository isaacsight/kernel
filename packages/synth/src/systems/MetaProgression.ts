// SYNTH — Meta-Progression System
// Persistent between-run upgrades stored in localStorage.
// Players earn Synthesis Points by clearing floors and defeating bosses.
// 30 nodes in a web-connected tree across 6 categories.

// ── Types ────────────────────────────────────────────────────────────

export type MetaCategory = 'combat' | 'defense' | 'speed' | 'partner' | 'special' | 'keystone'

export interface MetaNode {
  id: string
  name: string
  description: string
  category: MetaCategory
  cost: number
  /** IDs of nodes that must be unlocked to reach this one */
  requires: string[]
  /** Stat key → value for applying bonuses */
  effect: MetaEffect
  /** Position in the tree display (normalized 0-1) */
  position: { x: number; y: number }
  /** Whether this is a keystone (game-changing rule) */
  isKeystone: boolean
}

export interface MetaEffect {
  /** Multiplicative damage bonus (e.g. 1.05 = +5%) */
  damageMult?: number
  /** Additive crit chance (e.g. 0.05 = +5%) */
  critChance?: number
  /** Multiplicative attack speed (e.g. 1.1 = +10% faster = 0.9x cooldown) */
  attackSpeedMult?: number
  /** Additive projectile count */
  projectileCount?: number
  /** Additive max HP */
  maxHp?: number
  /** Additive flat armor (damage reduction per hit) */
  armor?: number
  /** Additive shield charges */
  shieldCharges?: number
  /** Additive dodge cooldown reduction in ms (negative = faster) */
  dodgeCooldownMs?: number
  /** Multiplicative move speed */
  moveSpeedMult?: number
  /** Multiplicative dash distance */
  dashDistanceMult?: number
  /** Additive dash cooldown reduction in ms (negative = faster) */
  dashCooldownMs?: number
  /** Multiplicative partner damage */
  partnerDamageMult?: number
  /** Additive partner HP */
  partnerMaxHp?: number
  /** Partner regen HP/s */
  partnerRegen?: number
  /** Partner starts with a random mod */
  partnerStartMod?: boolean
  /** Multiplicative mod drop rate */
  modDropRateMult?: number
  /** Start run with 1 random mod */
  startWithMod?: boolean
  /** Additive weapon mod slots */
  extraModSlots?: number
  /** Multiplicative rare mod chance */
  rareModChanceMult?: number
  /** Multiplicative mod effect strength */
  modEffectMult?: number
  /** Multiplicative mod duration (< 1 = shorter) */
  modDurationMult?: number

  // ── Keystone flags ──
  /** Glass Cannon: +50% damage, -30% HP */
  glassCannon?: boolean
  /** Fortress: -25% speed, +50% HP, +5 armor */
  fortress?: boolean
  /** Blink: dash teleports instead of sliding */
  blinkDash?: boolean
  /** Lone Wolf: no partner, +80% player damage */
  loneWolf?: boolean
  /** Synthesis Master: mods 2x effect, -50% duration */
  synthesisMaster?: boolean
}

// ── Node Definitions (30 nodes) ──────────────────────────────────────

export const META_NODES: MetaNode[] = [
  // ── COMBAT (6 nodes) ──
  {
    id: 'c1_dmg1',
    name: 'Sharpened Core',
    description: '+5% damage',
    category: 'combat',
    cost: 1,
    requires: [],
    effect: { damageMult: 1.05 },
    position: { x: 0.15, y: 0.25 },
    isKeystone: false,
  },
  {
    id: 'c2_dmg2',
    name: 'Hardened Edge',
    description: '+5% damage',
    category: 'combat',
    cost: 1,
    requires: ['c1_dmg1'],
    effect: { damageMult: 1.05 },
    position: { x: 0.10, y: 0.40 },
    isKeystone: false,
  },
  {
    id: 'c3_crit',
    name: 'Precision Matrix',
    description: '+5% crit chance',
    category: 'combat',
    cost: 2,
    requires: ['c1_dmg1'],
    effect: { critChance: 0.05 },
    position: { x: 0.22, y: 0.40 },
    isKeystone: false,
  },
  {
    id: 'c4_aspd',
    name: 'Overclock',
    description: '+10% attack speed',
    category: 'combat',
    cost: 2,
    requires: ['c2_dmg2'],
    effect: { attackSpeedMult: 1.1 },
    position: { x: 0.08, y: 0.55 },
    isKeystone: false,
  },
  {
    id: 'c5_proj',
    name: 'Split Beam',
    description: '+1 projectile',
    category: 'combat',
    cost: 3,
    requires: ['c3_crit', 'c4_aspd'],
    effect: { projectileCount: 1 },
    position: { x: 0.15, y: 0.65 },
    isKeystone: false,
  },
  {
    id: 'c6_glass_cannon',
    name: 'Glass Cannon',
    description: '+50% damage, -30% HP',
    category: 'keystone',
    cost: 3,
    requires: ['c5_proj'],
    effect: { glassCannon: true, damageMult: 1.5, maxHp: -36 },
    position: { x: 0.15, y: 0.82 },
    isKeystone: true,
  },

  // ── DEFENSE (6 nodes) ──
  {
    id: 'd1_hp1',
    name: 'Reinforced Shell',
    description: '+10 max HP',
    category: 'defense',
    cost: 1,
    requires: [],
    effect: { maxHp: 10 },
    position: { x: 0.38, y: 0.15 },
    isKeystone: false,
  },
  {
    id: 'd2_hp2',
    name: 'Vitality Core',
    description: '+10 max HP',
    category: 'defense',
    cost: 1,
    requires: ['d1_hp1'],
    effect: { maxHp: 10 },
    position: { x: 0.32, y: 0.30 },
    isKeystone: false,
  },
  {
    id: 'd3_armor',
    name: 'Plating',
    description: '+2 armor',
    category: 'defense',
    cost: 2,
    requires: ['d1_hp1'],
    effect: { armor: 2 },
    position: { x: 0.44, y: 0.30 },
    isKeystone: false,
  },
  {
    id: 'd4_shield',
    name: 'Energy Shield',
    description: '+1 shield charge',
    category: 'defense',
    cost: 2,
    requires: ['d2_hp2'],
    effect: { shieldCharges: 1 },
    position: { x: 0.30, y: 0.48 },
    isKeystone: false,
  },
  {
    id: 'd5_dodge',
    name: 'Phase Shifter',
    description: '-100ms dodge cooldown',
    category: 'defense',
    cost: 2,
    requires: ['d3_armor'],
    effect: { dodgeCooldownMs: -100 },
    position: { x: 0.46, y: 0.48 },
    isKeystone: false,
  },
  {
    id: 'd6_fortress',
    name: 'Fortress',
    description: '-25% speed, +50% HP, +5 armor',
    category: 'keystone',
    cost: 3,
    requires: ['d4_shield', 'd5_dodge'],
    effect: { fortress: true, moveSpeedMult: 0.75, maxHp: 60, armor: 5 },
    position: { x: 0.38, y: 0.65 },
    isKeystone: true,
  },

  // ── SPEED (5 nodes) ──
  {
    id: 's1_move1',
    name: 'Thruster Boost',
    description: '+8% move speed',
    category: 'speed',
    cost: 1,
    requires: [],
    effect: { moveSpeedMult: 1.08 },
    position: { x: 0.60, y: 0.15 },
    isKeystone: false,
  },
  {
    id: 's2_move2',
    name: 'Afterburner',
    description: '+8% move speed',
    category: 'speed',
    cost: 1,
    requires: ['s1_move1'],
    effect: { moveSpeedMult: 1.08 },
    position: { x: 0.55, y: 0.30 },
    isKeystone: false,
  },
  {
    id: 's3_dash_dist',
    name: 'Extended Dash',
    description: '+15% dash distance',
    category: 'speed',
    cost: 2,
    requires: ['s1_move1'],
    effect: { dashDistanceMult: 1.15 },
    position: { x: 0.66, y: 0.30 },
    isKeystone: false,
  },
  {
    id: 's4_dash_cd',
    name: 'Quick Recovery',
    description: '-200ms dash cooldown',
    category: 'speed',
    cost: 2,
    requires: ['s2_move2', 's3_dash_dist'],
    effect: { dashCooldownMs: -200 },
    position: { x: 0.60, y: 0.48 },
    isKeystone: false,
  },
  {
    id: 's5_blink',
    name: 'Blink',
    description: 'Dash teleports instead of sliding',
    category: 'keystone',
    cost: 3,
    requires: ['s4_dash_cd'],
    effect: { blinkDash: true },
    position: { x: 0.60, y: 0.65 },
    isKeystone: true,
  },

  // ── PARTNER (5 nodes) ──
  {
    id: 'p1_pdmg',
    name: 'Synth Upgrade',
    description: '+10% partner damage',
    category: 'partner',
    cost: 1,
    requires: [],
    effect: { partnerDamageMult: 1.1 },
    position: { x: 0.82, y: 0.15 },
    isKeystone: false,
  },
  {
    id: 'p2_php',
    name: 'Synth Armor',
    description: '+15 partner HP',
    category: 'partner',
    cost: 1,
    requires: ['p1_pdmg'],
    effect: { partnerMaxHp: 15 },
    position: { x: 0.78, y: 0.30 },
    isKeystone: false,
  },
  {
    id: 'p3_pregen',
    name: 'Repair Protocol',
    description: 'Partner regens 1 HP/s',
    category: 'partner',
    cost: 2,
    requires: ['p2_php'],
    effect: { partnerRegen: 1 },
    position: { x: 0.86, y: 0.30 },
    isKeystone: false,
  },
  {
    id: 'p4_pmod',
    name: 'Synth Arsenal',
    description: 'Partner starts with random mod',
    category: 'partner',
    cost: 2,
    requires: ['p3_pregen'],
    effect: { partnerStartMod: true },
    position: { x: 0.82, y: 0.48 },
    isKeystone: false,
  },
  {
    id: 'p5_lone_wolf',
    name: 'Lone Wolf',
    description: 'No partner, +80% player damage',
    category: 'keystone',
    cost: 3,
    requires: ['p4_pmod'],
    effect: { loneWolf: true, damageMult: 1.8 },
    position: { x: 0.82, y: 0.65 },
    isKeystone: true,
  },

  // ── SPECIAL (5 nodes) ──
  {
    id: 'x1_drop',
    name: 'Loot Scanner',
    description: '+10% mod drop rate',
    category: 'special',
    cost: 1,
    requires: [],
    effect: { modDropRateMult: 1.1 },
    position: { x: 0.48, y: 0.72 },
    isKeystone: false,
  },
  {
    id: 'x2_start_mod',
    name: 'Preloaded',
    description: 'Start with 1 random mod',
    category: 'special',
    cost: 2,
    requires: ['x1_drop'],
    effect: { startWithMod: true },
    position: { x: 0.40, y: 0.82 },
    isKeystone: false,
  },
  {
    id: 'x3_slots',
    name: 'Expanded Sockets',
    description: '+1 weapon mod slot (max 4)',
    category: 'special',
    cost: 2,
    requires: ['x1_drop'],
    effect: { extraModSlots: 1 },
    position: { x: 0.56, y: 0.82 },
    isKeystone: false,
  },
  {
    id: 'x4_rare',
    name: 'Rare Attunement',
    description: 'Rare mods +50% chance',
    category: 'special',
    cost: 2,
    requires: ['x2_start_mod', 'x3_slots'],
    effect: { rareModChanceMult: 1.5 },
    position: { x: 0.48, y: 0.90 },
    isKeystone: false,
  },
  {
    id: 'x5_synth_master',
    name: 'Synthesis Master',
    description: 'Mods have 2x effect, -50% duration',
    category: 'keystone',
    cost: 3,
    requires: ['x4_rare'],
    effect: { synthesisMaster: true, modEffectMult: 2, modDurationMult: 0.5 },
    position: { x: 0.48, y: 1.0 },
    isKeystone: true,
  },

  // ── BRIDGE NODES (3 cross-category connectors to reach 30 total) ──
  {
    id: 'b1_combat_defense',
    name: 'Battle Hardened',
    description: '+3% damage, +5 max HP',
    category: 'combat',
    cost: 2,
    requires: ['c2_dmg2', 'd2_hp2'],
    effect: { damageMult: 1.03, maxHp: 5 },
    position: { x: 0.24, y: 0.52 },
    isKeystone: false,
  },
  {
    id: 'b2_speed_partner',
    name: 'Shared Velocity',
    description: '+5% move speed, +10 partner HP',
    category: 'speed',
    cost: 2,
    requires: ['s2_move2', 'p2_php'],
    effect: { moveSpeedMult: 1.05, partnerMaxHp: 10 },
    position: { x: 0.68, y: 0.42 },
    isKeystone: false,
  },
  {
    id: 'b3_defense_special',
    name: 'Fortified Arsenal',
    description: '+1 armor, +5% mod drop rate',
    category: 'defense',
    cost: 2,
    requires: ['d5_dodge', 'x1_drop'],
    effect: { armor: 1, modDropRateMult: 1.05 },
    position: { x: 0.48, y: 0.60 },
    isKeystone: false,
  },
]

// ── Adjacency (for visual connections) ───────────────────────────────

/** All edges in the tree: [fromId, toId] */
export const META_EDGES: [string, string][] = META_NODES.flatMap(node =>
  node.requires.map(reqId => [reqId, node.id] as [string, string])
)

// ── Persistent State ─────────────────────────────────────────────────

export interface MetaProgressionState {
  synthesisPoints: number
  totalPointsEarned: number
  unlockedNodes: string[]
  totalRuns: number
  bestFloor: number
}

const STORAGE_KEY = 'synth_meta_progression'

function defaultState(): MetaProgressionState {
  return {
    synthesisPoints: 0,
    totalPointsEarned: 0,
    unlockedNodes: [],
    totalRuns: 0,
    bestFloor: 0,
  }
}

// ── Load / Save ──────────────────────────────────────────────────────

export function loadMetaProgression(): MetaProgressionState {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return defaultState()
    const parsed = JSON.parse(raw) as Partial<MetaProgressionState>
    return {
      synthesisPoints: parsed.synthesisPoints ?? 0,
      totalPointsEarned: parsed.totalPointsEarned ?? 0,
      unlockedNodes: Array.isArray(parsed.unlockedNodes) ? parsed.unlockedNodes : [],
      totalRuns: parsed.totalRuns ?? 0,
      bestFloor: parsed.bestFloor ?? 0,
    }
  } catch {
    return defaultState()
  }
}

export function saveMetaProgression(state: MetaProgressionState): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state))
  } catch {
    // Storage full or unavailable — silently fail
  }
}

// ── Point Calculation ────────────────────────────────────────────────

export interface RunResult {
  floorsCleared: number
  bossKilled: boolean
  floorNumber: number
}

/**
 * Calculate Synthesis Points earned from a run.
 * - 1 point per floor cleared
 * - 3 bonus for boss kill
 * - 5 bonus for completing floor 5+
 */
export function calculateRunPoints(result: RunResult): number {
  let points = result.floorsCleared

  if (result.bossKilled) {
    points += 3
  }

  if (result.floorNumber >= 5) {
    points += 5
  }

  return Math.max(points, 0)
}

/**
 * Award points from a completed run and update persistent state.
 */
export function awardRunPoints(result: RunResult): { pointsEarned: number; state: MetaProgressionState } {
  const state = loadMetaProgression()
  const pointsEarned = calculateRunPoints(result)

  state.synthesisPoints += pointsEarned
  state.totalPointsEarned += pointsEarned
  state.totalRuns++
  if (result.floorNumber > state.bestFloor) {
    state.bestFloor = result.floorNumber
  }

  saveMetaProgression(state)
  return { pointsEarned, state }
}

// ── Node Queries ─────────────────────────────────────────────────────

function getNodeById(id: string): MetaNode | undefined {
  return META_NODES.find(n => n.id === id)
}

/**
 * Check if a node can be unlocked given current state.
 * - Not already unlocked
 * - All prerequisite nodes are unlocked
 * - Player has enough points
 */
export function canUnlockNode(nodeId: string, state: MetaProgressionState): boolean {
  const node = getNodeById(nodeId)
  if (!node) return false
  if (state.unlockedNodes.includes(nodeId)) return false
  if (state.synthesisPoints < node.cost) return false

  // Root nodes (no requires) are always reachable
  if (node.requires.length === 0) return true

  // At least one prerequisite must be unlocked (web, not chain)
  return node.requires.some(reqId => state.unlockedNodes.includes(reqId))
}

/**
 * Unlock a node, spending Synthesis Points.
 * Returns the updated state, or null if unlock is not possible.
 */
export function unlockNode(nodeId: string, state: MetaProgressionState): MetaProgressionState | null {
  if (!canUnlockNode(nodeId, state)) return null

  const node = getNodeById(nodeId)
  if (!node) return null

  const newState: MetaProgressionState = {
    ...state,
    synthesisPoints: state.synthesisPoints - node.cost,
    unlockedNodes: [...state.unlockedNodes, nodeId],
  }

  saveMetaProgression(newState)
  return newState
}

// ── Compute Merged Bonuses ───────────────────────────────────────────

export interface MetaBonuses {
  damageMult: number
  critChance: number
  attackSpeedMult: number
  projectileCount: number
  maxHp: number
  armor: number
  shieldCharges: number
  dodgeCooldownMs: number
  moveSpeedMult: number
  dashDistanceMult: number
  dashCooldownMs: number
  partnerDamageMult: number
  partnerMaxHp: number
  partnerRegen: number
  partnerStartMod: boolean
  modDropRateMult: number
  startWithMod: boolean
  extraModSlots: number
  rareModChanceMult: number
  modEffectMult: number
  modDurationMult: number
  // Keystones
  glassCannon: boolean
  fortress: boolean
  blinkDash: boolean
  loneWolf: boolean
  synthesisMaster: boolean
}

/**
 * Merge all unlocked node effects into a single bonus object.
 * Multiplicative stats stack multiplicatively. Additive stats stack additively.
 */
export function computeMetaBonuses(state?: MetaProgressionState): MetaBonuses {
  const s = state ?? loadMetaProgression()

  const bonuses: MetaBonuses = {
    damageMult: 1,
    critChance: 0,
    attackSpeedMult: 1,
    projectileCount: 0,
    maxHp: 0,
    armor: 0,
    shieldCharges: 0,
    dodgeCooldownMs: 0,
    moveSpeedMult: 1,
    dashDistanceMult: 1,
    dashCooldownMs: 0,
    partnerDamageMult: 1,
    partnerMaxHp: 0,
    partnerRegen: 0,
    partnerStartMod: false,
    modDropRateMult: 1,
    startWithMod: false,
    extraModSlots: 0,
    rareModChanceMult: 1,
    modEffectMult: 1,
    modDurationMult: 1,
    glassCannon: false,
    fortress: false,
    blinkDash: false,
    loneWolf: false,
    synthesisMaster: false,
  }

  for (const nodeId of s.unlockedNodes) {
    const node = getNodeById(nodeId)
    if (!node) continue
    const e = node.effect

    // Multiplicative stacking
    if (e.damageMult !== undefined) bonuses.damageMult *= e.damageMult
    if (e.attackSpeedMult !== undefined) bonuses.attackSpeedMult *= e.attackSpeedMult
    if (e.moveSpeedMult !== undefined) bonuses.moveSpeedMult *= e.moveSpeedMult
    if (e.dashDistanceMult !== undefined) bonuses.dashDistanceMult *= e.dashDistanceMult
    if (e.partnerDamageMult !== undefined) bonuses.partnerDamageMult *= e.partnerDamageMult
    if (e.modDropRateMult !== undefined) bonuses.modDropRateMult *= e.modDropRateMult
    if (e.rareModChanceMult !== undefined) bonuses.rareModChanceMult *= e.rareModChanceMult
    if (e.modEffectMult !== undefined) bonuses.modEffectMult *= e.modEffectMult
    if (e.modDurationMult !== undefined) bonuses.modDurationMult *= e.modDurationMult

    // Additive stacking
    if (e.critChance !== undefined) bonuses.critChance += e.critChance
    if (e.projectileCount !== undefined) bonuses.projectileCount += e.projectileCount
    if (e.maxHp !== undefined) bonuses.maxHp += e.maxHp
    if (e.armor !== undefined) bonuses.armor += e.armor
    if (e.shieldCharges !== undefined) bonuses.shieldCharges += e.shieldCharges
    if (e.dodgeCooldownMs !== undefined) bonuses.dodgeCooldownMs += e.dodgeCooldownMs
    if (e.dashCooldownMs !== undefined) bonuses.dashCooldownMs += e.dashCooldownMs
    if (e.partnerMaxHp !== undefined) bonuses.partnerMaxHp += e.partnerMaxHp
    if (e.partnerRegen !== undefined) bonuses.partnerRegen += e.partnerRegen
    if (e.extraModSlots !== undefined) bonuses.extraModSlots += e.extraModSlots

    // Boolean flags
    if (e.partnerStartMod) bonuses.partnerStartMod = true
    if (e.startWithMod) bonuses.startWithMod = true
    if (e.glassCannon) bonuses.glassCannon = true
    if (e.fortress) bonuses.fortress = true
    if (e.blinkDash) bonuses.blinkDash = true
    if (e.loneWolf) bonuses.loneWolf = true
    if (e.synthesisMaster) bonuses.synthesisMaster = true
  }

  return bonuses
}

/**
 * Reset all meta-progression (for testing / prestige).
 */
export function resetMetaProgression(): void {
  localStorage.removeItem(STORAGE_KEY)
}
