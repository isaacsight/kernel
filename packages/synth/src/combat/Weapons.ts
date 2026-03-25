// SYNTH -- Weapon Definitions
// Each weapon is a different heroic identity (Design Bible, Pillar 1: FEEL).
// Pulse = precise marksman, Nova = area controller, Blade = melee warrior, Arc = chain lightning.

export type WeaponId = 'pulse' | 'nova' | 'blade' | 'arc'

export interface WeaponDef {
  id: WeaponId
  name: string
  description: string
  color: number
  // Primary attack
  primaryDamage: number
  primaryCooldown: number  // ms
  primaryRange: number     // px
  primaryType: 'projectile' | 'melee' | 'cone' | 'bounce'
  // Secondary attack (E key)
  secondaryDamage: number
  secondaryCooldown: number
  secondaryType: 'charge' | 'aoe' | 'dash' | 'field'
  secondaryDescription: string
}

// ── Blade-specific: combo damage per hit ──

export const BLADE_COMBO_DAMAGE = [12, 15, 20] as const
export const BLADE_COMBO_INTERVAL = 200  // ms between hits

// ── Arc-specific: bounce config ──

export const ARC_BOUNCE_COUNT = 3
export const ARC_BOUNCE_RANGE = 100  // px search radius for next target

// ── Tesla field config ──

export const TESLA_FIELD_RADIUS = 60
export const TESLA_FIELD_DPS = 5
export const TESLA_FIELD_DURATION = 4000  // ms

// ── Weapon Registry ──

export const WEAPONS: Record<WeaponId, WeaponDef> = {
  pulse: {
    id: 'pulse',
    name: 'Pulse',
    description: 'Precise marksman. Fast single projectile with a charged piercing shot.',
    color: 0x44aaff,
    primaryDamage: 15,
    primaryCooldown: 300,
    primaryRange: 400,
    primaryType: 'projectile',
    secondaryDamage: 45,       // 3x primary
    secondaryCooldown: 1200,   // charge time + recovery
    secondaryType: 'charge',
    secondaryDescription: 'Hold E to charge (0-1s). Release for a 3x damage piercing shot.',
  },
  nova: {
    id: 'nova',
    name: 'Nova',
    description: 'Area controller. Short-range cone burst and ground slam.',
    color: 0xff8844,
    primaryDamage: 12,
    primaryCooldown: 500,
    primaryRange: 100,
    primaryType: 'cone',
    secondaryDamage: 20,
    secondaryCooldown: 2000,
    secondaryType: 'aoe',
    secondaryDescription: 'Ground slam: 80px AoE circle that knocks enemies back.',
  },
  blade: {
    id: 'blade',
    name: 'Blade',
    description: 'Melee warrior. 3-hit combo and a dashing lunge attack.',
    color: 0xeeeeff,
    primaryDamage: 12,         // first hit; combo escalates via BLADE_COMBO_DAMAGE
    primaryCooldown: 200,
    primaryRange: 40,
    primaryType: 'melee',
    secondaryDamage: 25,
    secondaryCooldown: 1500,
    secondaryType: 'dash',
    secondaryDescription: 'Dash 120px forward, dealing 25 damage on contact.',
  },
  arc: {
    id: 'arc',
    name: 'Arc',
    description: 'Chain lightning. Bouncing projectile and deployable tesla field.',
    color: 0xaa44ff,
    primaryDamage: 10,
    primaryCooldown: 600,
    primaryRange: 300,
    primaryType: 'bounce',
    secondaryDamage: 5,        // per second
    secondaryCooldown: 3000,
    secondaryType: 'field',
    secondaryDescription: 'Place a tesla field (60px radius, 5 dmg/s, 4s duration).',
  },
}

export const WEAPON_IDS: WeaponId[] = ['pulse', 'nova', 'blade', 'arc']
