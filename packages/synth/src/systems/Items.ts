// SYNTH — Item Definitions & Pickup System
// Floating pickups that boost the player with instant heals, timed buffs, or passive shields.

import Phaser from 'phaser'
import { hitSparks } from './VFX'

// ── Types ────────────────────────────────────────────────────────────

export type ItemEffectType = 'instant' | 'timed' | 'passive'

export type ItemId = 'health_crystal' | 'damage_boost' | 'speed_boost' | 'shield'

export interface ItemDef {
  id: ItemId
  name: string
  type: ItemEffectType
  /** Duration in ms (0 for instant, Infinity for passive-until-consumed) */
  duration: number
  /** Effect magnitude — meaning depends on type */
  magnitude: number
  /** Sprite tint color */
  color: number
}

export interface ActiveBuff {
  itemId: ItemId
  expiresAt: number         // Date.now() timestamp, Infinity for passive
  magnitude: number
  /** For shield: remaining absorb HP */
  remaining?: number
}

export interface Pickup {
  sprite: Phaser.GameObjects.Arc
  glow: Phaser.GameObjects.Arc
  def: ItemDef
  bobTween: Phaser.Tweens.Tween
}

// ── Item Catalog ─────────────────────────────────────────────────────

export const ITEM_DEFS: Record<ItemId, ItemDef> = {
  health_crystal: {
    id: 'health_crystal',
    name: 'Health Crystal',
    type: 'instant',
    duration: 0,
    magnitude: 25,            // restore 25 HP
    color: 0x44ff88,
  },
  damage_boost: {
    id: 'damage_boost',
    name: 'Damage Boost',
    type: 'timed',
    duration: 30_000,         // 30 seconds
    magnitude: 0.2,           // +20% damage
    color: 0xff6644,
  },
  speed_boost: {
    id: 'speed_boost',
    name: 'Speed Boost',
    type: 'timed',
    duration: 20_000,         // 20 seconds
    magnitude: 0.3,           // +30% speed
    color: 0x44ddff,
  },
  shield: {
    id: 'shield',
    name: 'Shield',
    type: 'passive',
    duration: Infinity,       // lasts until absorbed
    magnitude: 30,            // absorb 30 damage
    color: 0xcccc44,
  },
}

// ── Pickup Spawn ─────────────────────────────────────────────────────

const PICKUP_RADIUS = 6
const PICKUP_COLLECT_RANGE = 24

/**
 * Spawn a floating, bobbing pickup at world position (x, y).
 */
export function spawnPickup(scene: Phaser.Scene, x: number, y: number, itemType: ItemId): Pickup {
  const def = ITEM_DEFS[itemType]

  // Soft glow behind
  const glow = scene.add.circle(x, y, PICKUP_RADIUS * 2.5, def.color, 0.15).setDepth(3)

  // Core sprite
  const sprite = scene.add.circle(x, y, PICKUP_RADIUS, def.color, 0.9).setDepth(4)

  // Pulsing glow
  scene.tweens.add({
    targets: glow,
    alpha: 0.3,
    scale: 1.3,
    duration: 800,
    ease: 'Sine.easeInOut',
    yoyo: true,
    repeat: -1,
  })

  // Floating bob
  const bobTween = scene.tweens.add({
    targets: [sprite, glow],
    y: y - 4,
    duration: 1200,
    ease: 'Sine.easeInOut',
    yoyo: true,
    repeat: -1,
  })

  return { sprite, glow, def, bobTween }
}

// ── Pickup Collection ────────────────────────────────────────────────

export interface CollectResult {
  collected: boolean
  healAmount?: number
  buff?: ActiveBuff
}

/**
 * Check if player is close enough and collect the pickup.
 * Returns the effect to be applied by the caller.
 */
export function collectPickup(
  scene: Phaser.Scene,
  playerX: number,
  playerY: number,
  pickup: Pickup,
): CollectResult {
  const dx = playerX - pickup.sprite.x
  const dy = playerY - pickup.sprite.y
  const dist = Math.sqrt(dx * dx + dy * dy)

  if (dist > PICKUP_COLLECT_RANGE) return { collected: false }

  const def = pickup.def
  const now = Date.now()

  // VFX: collection burst
  hitSparks(scene, pickup.sprite.x, pickup.sprite.y, def.color, 8)

  // Flash text
  const label = scene.add.text(pickup.sprite.x, pickup.sprite.y - 12, def.name, {
    fontFamily: 'monospace',
    fontSize: '9px',
    color: `#${def.color.toString(16).padStart(6, '0')}`,
    fontStyle: 'bold',
  }).setOrigin(0.5).setDepth(25)

  scene.tweens.add({
    targets: label,
    y: pickup.sprite.y - 35,
    alpha: 0,
    duration: 800,
    ease: 'Cubic.easeOut',
    onComplete: () => label.destroy(),
  })

  // Destroy pickup
  pickup.bobTween.destroy()
  pickup.glow.destroy()
  pickup.sprite.destroy()

  // Build result
  switch (def.type) {
    case 'instant':
      return { collected: true, healAmount: def.magnitude }

    case 'timed':
      return {
        collected: true,
        buff: {
          itemId: def.id,
          expiresAt: now + def.duration,
          magnitude: def.magnitude,
        },
      }

    case 'passive':
      return {
        collected: true,
        buff: {
          itemId: def.id,
          expiresAt: Infinity,
          magnitude: def.magnitude,
          remaining: def.magnitude,
        },
      }
  }
}

// ── Buff Management ──────────────────────────────────────────────────

/**
 * Tick active buffs — remove expired ones.
 * Returns the list of still-active buffs.
 */
export function tickBuffs(buffs: ActiveBuff[]): ActiveBuff[] {
  const now = Date.now()
  return buffs.filter(b => {
    // Passive (shield): remove when absorbed
    if (b.itemId === 'shield') return (b.remaining ?? 0) > 0
    // Timed: remove when expired
    return now < b.expiresAt
  })
}

/**
 * Get the total damage multiplier from active buffs.
 */
export function getDamageMultiplier(buffs: ActiveBuff[]): number {
  let mult = 1.0
  for (const b of buffs) {
    if (b.itemId === 'damage_boost') mult += b.magnitude
  }
  return mult
}

/**
 * Get the total speed multiplier from active buffs.
 */
export function getSpeedMultiplier(buffs: ActiveBuff[]): number {
  let mult = 1.0
  for (const b of buffs) {
    if (b.itemId === 'speed_boost') mult += b.magnitude
  }
  return mult
}

/**
 * Absorb damage through shield buffs. Returns the remaining damage after absorption.
 */
export function absorbDamage(buffs: ActiveBuff[], incomingDamage: number): number {
  let remaining = incomingDamage
  for (const b of buffs) {
    if (b.itemId === 'shield' && (b.remaining ?? 0) > 0) {
      const absorb = Math.min(b.remaining!, remaining)
      b.remaining! -= absorb
      remaining -= absorb
      if (remaining <= 0) break
    }
  }
  return remaining
}

/**
 * Check whether a shield buff is currently active.
 */
export function hasShield(buffs: ActiveBuff[]): boolean {
  return buffs.some(b => b.itemId === 'shield' && (b.remaining ?? 0) > 0)
}
