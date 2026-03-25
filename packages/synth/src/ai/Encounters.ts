// SYNTH — Encounter Templates
// Pre-built enemy group compositions for the Director to deploy.
// Each encounter has a difficulty rating and descriptive metadata.

import type { EnemyType } from '../types'

// ── Types ──────────────────────────────────────────────────────────────

export interface EncounterTemplate {
  name: string
  enemies: Array<{ type: EnemyType; count: number }>
  difficulty: number  // 1-10 rating
  description: string // for debugging
}

// ── Encounter Library ──────────────────────────────────────────────────

export const ENCOUNTERS: EncounterTemplate[] = [
  // --- Difficulty 1-2: Early game / breather encounters ---
  {
    name: 'scout_patrol',
    enemies: [{ type: 'fast', count: 3 }],
    difficulty: 2,
    description: 'Quick swarm',
  },
  {
    name: 'skirmishers',
    enemies: [{ type: 'melee', count: 3 }],
    difficulty: 1,
    description: 'Basic melee pack',
  },

  // --- Difficulty 3-4: Mid-early encounters with composition ---
  {
    name: 'heavy_guard',
    enemies: [{ type: 'tank', count: 1 }, { type: 'melee', count: 2 }],
    difficulty: 4,
    description: 'Tank with escorts',
  },
  {
    name: 'suicide_squad',
    enemies: [{ type: 'exploder', count: 4 }],
    difficulty: 4,
    description: 'Explosive rush',
  },
  {
    name: 'ranged_line',
    enemies: [{ type: 'ranged', count: 4 }],
    difficulty: 3,
    description: 'Ranged fire line',
  },

  // --- Difficulty 5-6: Tactical encounters that demand specific play ---
  {
    name: 'sniper_nest',
    enemies: [{ type: 'ranged', count: 3 }, { type: 'shielded', count: 1 }],
    difficulty: 5,
    description: 'Ranged with shield cover',
  },
  {
    name: 'heal_team',
    enemies: [{ type: 'melee', count: 3 }, { type: 'healer', count: 1 }],
    difficulty: 6,
    description: 'Must kill healer first',
  },
  {
    name: 'shield_wall',
    enemies: [{ type: 'shielded', count: 3 }, { type: 'ranged', count: 2 }],
    difficulty: 6,
    description: 'Ranged hiding behind shield line — flank or die',
  },
  {
    name: 'bomber_run',
    enemies: [{ type: 'exploder', count: 2 }, { type: 'fast', count: 3 }],
    difficulty: 5,
    description: 'Exploders mixed with fast distractions',
  },

  // --- Difficulty 7-8: Complex compositions ---
  {
    name: 'summoner_hold',
    enemies: [{ type: 'summoner', count: 1 }, { type: 'shielded', count: 2 }],
    difficulty: 7,
    description: 'Endless waves until summoner dies',
  },
  {
    name: 'mixed_elite',
    enemies: [
      { type: 'tank', count: 1 },
      { type: 'ranged', count: 2 },
      { type: 'healer', count: 1 },
      { type: 'fast', count: 2 },
    ],
    difficulty: 8,
    description: 'Full combined arms',
  },
  {
    name: 'fortified_healer',
    enemies: [
      { type: 'shielded', count: 2 },
      { type: 'healer', count: 1 },
      { type: 'ranged', count: 2 },
    ],
    difficulty: 7,
    description: 'Healer protected by shields and ranged support',
  },

  // --- Difficulty 9-10: Late-game nightmares ---
  {
    name: 'double_summoner',
    enemies: [
      { type: 'summoner', count: 2 },
      { type: 'tank', count: 1 },
      { type: 'healer', count: 1 },
    ],
    difficulty: 9,
    description: 'Two summoners healing behind a tank — overwhelming if not focused',
  },
  {
    name: 'deathball',
    enemies: [
      { type: 'tank', count: 2 },
      { type: 'shielded', count: 2 },
      { type: 'healer', count: 1 },
      { type: 'ranged', count: 2 },
      { type: 'exploder', count: 2 },
    ],
    difficulty: 10,
    description: 'Every archetype in one ball of death',
  },
  {
    name: 'kamikaze_swarm',
    enemies: [
      { type: 'exploder', count: 6 },
      { type: 'fast', count: 4 },
    ],
    difficulty: 9,
    description: 'Massive suicide rush — pure chaos',
  },
  {
    name: 'iron_curtain',
    enemies: [
      { type: 'shielded', count: 4 },
      { type: 'summoner', count: 1 },
      { type: 'healer', count: 1 },
    ],
    difficulty: 10,
    description: 'Shield wall protecting a summoner and healer — break through or be overwhelmed',
  },
]

// ── Encounter Picker ───────────────────────────────────────────────────

/**
 * Pick an encounter template appropriate for the target difficulty.
 * Weights toward the target difficulty but allows some variance.
 * Higher floors unlock harder encounters.
 *
 * @param targetDifficulty - Desired difficulty (1-10)
 * @param floorNumber - Current dungeon floor (gates max difficulty)
 */
export function pickEncounter(targetDifficulty: number, floorNumber: number): EncounterTemplate {
  // Gate max encounter difficulty by floor: floor 1 caps at 4, floor 5+ unlocks all
  const maxDifficulty = Math.min(10, Math.floor(floorNumber * 2) + 2)

  // Filter to encounters that are available on this floor
  const available = ENCOUNTERS.filter(e => e.difficulty <= maxDifficulty)

  if (available.length === 0) {
    // Fallback to the easiest encounter if nothing qualifies
    return ENCOUNTERS[0]
  }

  // Weight each encounter by proximity to target difficulty.
  // Uses a Gaussian-like weighting: closer = higher weight.
  const VARIANCE = 2.0 // controls how much spread is allowed
  const weights = available.map(e => {
    const diff = Math.abs(e.difficulty - targetDifficulty)
    return Math.exp(-(diff * diff) / (2 * VARIANCE * VARIANCE))
  })

  // Weighted random selection
  const totalWeight = weights.reduce((sum, w) => sum + w, 0)
  let roll = Math.random() * totalWeight

  for (let i = 0; i < available.length; i++) {
    roll -= weights[i]
    if (roll <= 0) {
      return available[i]
    }
  }

  // Fallback (should not happen)
  return available[available.length - 1]
}
