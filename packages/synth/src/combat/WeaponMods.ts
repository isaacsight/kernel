// SYNTH -- Weapon Mod Socket System
// Inspired by Path of Exile's gem/socket system.
// Mods are the adjectives — they transform how a weapon base behaves.
// Up to 3 mods per weapon. Mods drop as loot, stack multiplicatively.

import Phaser from 'phaser'
import type { ProjectileOwner } from '../types'

// ── Types ──────────────────────────────────────────────────────────────

export type ModRarity = 'common' | 'rare' | 'epic'

export interface ModContext {
  scene: Phaser.Scene
  /** World X of the projectile origin */
  originX: number
  /** World Y of the projectile origin */
  originY: number
  /** Fire angle in radians */
  angle: number
  /** Owner of the projectile */
  owner: ProjectileOwner
  /** Spawn extra projectile callback — used by split/chain/lightning */
  spawnProjectile: (x: number, y: number, angle: number, damage: number, owner: ProjectileOwner, mods: WeaponMod[]) => void
  /** All alive enemies with positions */
  enemies: Array<{ x: number; y: number; id: string; hp: number; speed: number }>
  /** Player entity ref for vampire heal */
  playerHp: number
  playerMaxHp: number
  healPlayer: (amount: number) => void
  /** Deal AoE damage to enemies in radius */
  dealAoeDamage: (x: number, y: number, radius: number, damage: number) => void
  /** Apply debuff to an enemy */
  applyDebuff: (enemyId: string, type: DebuffType, duration: number, magnitude: number) => void
  /** Current floor number (affects drop quality) */
  floorNumber: number
}

export type DebuffType = 'slow' | 'burn'

export interface ProjectileData {
  damage: number
  speed: number
  pierceCount: number
  /** Color tint override */
  tint: number
  /** Scale multiplier */
  scale: number
  /** Homing strength 0-1 (0 = none) */
  homingStrength: number
  /** Fire rate multiplier (applied to cooldown) */
  fireRateMultiplier: number
}

export interface WeaponMod {
  id: string
  name: string
  description: string
  rarity: ModRarity
  /** Display color for pickup/UI */
  color: number
  /** Tint contribution blended onto the projectile */
  tintColor: number
  /** Modify projectile stats before firing */
  apply(projectile: ProjectileData, context: ModContext): void
  /** Called when a projectile with this mod hits an enemy */
  onHit?(targetId: string, targetX: number, targetY: number, damage: number, context: ModContext): void
}

export interface PlayerWeapon {
  base: WeaponBase
  mods: WeaponMod[]
  maxSlots: number
}

export type WeaponBase = 'pulse' | 'nova' | 'blade' | 'arc'

// ── Rarity Colors ──────────────────────────────────────────────────────

export const RARITY_COLORS: Record<ModRarity, number> = {
  common: 0xaaaaaa,
  rare: 0x4488ff,
  epic: 0xaa44ff,
}

// ── Default Projectile Data ────────────────────────────────────────────

export function createDefaultProjectileData(baseDamage: number, baseSpeed: number): ProjectileData {
  return {
    damage: baseDamage,
    speed: baseSpeed,
    pierceCount: 0,
    tint: 0xffff44,
    scale: 1.0,
    homingStrength: 0,
    fireRateMultiplier: 1.0,
  }
}

// ── Mod Pool ───────────────────────────────────────────────────────────

export const MOD_POOL: WeaponMod[] = [
  // ── COMMON ──
  {
    id: 'split',
    name: 'Split',
    description: 'Fires 2 additional projectiles at ±15° spread',
    rarity: 'common',
    color: 0xcccccc,
    tintColor: 0xccddff,
    apply(proj) {
      // Split doesn't modify the base projectile — it spawns extras in onHit-less context
      // The extra projectiles are spawned by ModEffects.applySplit()
    },
    // No onHit — split fires extra projectiles at launch time, handled externally
  },
  {
    id: 'pierce',
    name: 'Pierce',
    description: 'Projectiles pass through 1 enemy',
    rarity: 'common',
    color: 0x88ccff,
    tintColor: 0x88ccff,
    apply(proj) {
      proj.pierceCount += 1
    },
  },
  {
    id: 'rapid',
    name: 'Rapid',
    description: '30% faster fire rate',
    rarity: 'common',
    color: 0xffdd44,
    tintColor: 0xffee88,
    apply(proj) {
      proj.fireRateMultiplier *= 0.7  // 30% faster = 0.7x cooldown
    },
  },
  {
    id: 'heavy',
    name: 'Heavy',
    description: '50% more damage, 20% slower fire rate',
    rarity: 'common',
    color: 0x886644,
    tintColor: 0xffaa66,
    apply(proj) {
      proj.damage = Math.round(proj.damage * 1.5)
      proj.fireRateMultiplier *= 1.2  // 20% slower = 1.2x cooldown
      proj.scale *= 1.15
    },
  },

  // ── RARE ──
  {
    id: 'chain',
    name: 'Chain',
    description: 'On hit, projectile bounces to nearest enemy within 120px',
    rarity: 'rare',
    color: 0x44aaff,
    tintColor: 0x44aaff,
    apply(proj) {
      // Chain is an onHit effect
    },
    onHit(targetId, targetX, targetY, damage, ctx) {
      // Find nearest enemy within 120px that isn't the hit target
      let closest: { x: number; y: number; id: string } | null = null
      let closestDist = 120
      for (const enemy of ctx.enemies) {
        if (enemy.id === targetId || enemy.hp <= 0) continue
        const dist = Math.sqrt((enemy.x - targetX) ** 2 + (enemy.y - targetY) ** 2)
        if (dist < closestDist) {
          closestDist = dist
          closest = enemy
        }
      }
      if (closest) {
        const chainAngle = Math.atan2(closest.y - targetY, closest.x - targetX)
        // Chain projectile deals 70% of original damage, no further mods to prevent infinite loops
        ctx.spawnProjectile(targetX, targetY, chainAngle, Math.round(damage * 0.7), ctx.owner, [])
      }
    },
  },
  {
    id: 'ignite',
    name: 'Ignite',
    description: 'Projectiles deal 30% damage over 2s as burning',
    rarity: 'rare',
    color: 0xff6622,
    tintColor: 0xff6622,
    apply(proj) {
      // Slight orange tint
      proj.tint = blendColors(proj.tint, 0xff6622, 0.4)
    },
    onHit(targetId, _tx, _ty, damage, ctx) {
      const burnDamage = Math.round(damage * 0.3)
      ctx.applyDebuff(targetId, 'burn', 2000, burnDamage)
    },
  },
  {
    id: 'frost',
    name: 'Frost',
    description: 'Projectiles slow enemy 40% for 1.5s',
    rarity: 'rare',
    color: 0x44ddff,
    tintColor: 0x44ddff,
    apply(proj) {
      proj.tint = blendColors(proj.tint, 0x44ddff, 0.4)
    },
    onHit(targetId, _tx, _ty, _damage, ctx) {
      ctx.applyDebuff(targetId, 'slow', 1500, 0.4)
    },
  },
  {
    id: 'homing',
    name: 'Homing',
    description: 'Slight tracking toward nearest enemy',
    rarity: 'rare',
    color: 0x88ff88,
    tintColor: 0x88ffaa,
    apply(proj) {
      proj.homingStrength = Math.min(proj.homingStrength + 0.04, 0.12)  // cap at 0.12 turn per frame
    },
  },

  // ── EPIC ──
  {
    id: 'lightning',
    name: 'Lightning',
    description: '20% chance to chain lightning to 2 nearby enemies',
    rarity: 'epic',
    color: 0xaa44ff,
    tintColor: 0xcc88ff,
    apply(proj) {
      proj.tint = blendColors(proj.tint, 0xaa44ff, 0.3)
    },
    onHit(targetId, targetX, targetY, damage, ctx) {
      if (Math.random() > 0.2) return  // 20% chance
      // Find up to 2 nearby enemies
      const nearby = ctx.enemies
        .filter(e => e.id !== targetId && e.hp > 0)
        .map(e => ({ ...e, dist: Math.sqrt((e.x - targetX) ** 2 + (e.y - targetY) ** 2) }))
        .filter(e => e.dist < 120)
        .sort((a, b) => a.dist - b.dist)
        .slice(0, 2)

      const chainDmg = Math.round(damage * 0.4)
      for (const enemy of nearby) {
        ctx.dealAoeDamage(enemy.x, enemy.y, 8, chainDmg)  // point-blank AoE acts as direct hit
        // Lightning VFX: draw jagged line from hit point to chained enemy
        drawLightningChain(ctx.scene, targetX, targetY, enemy.x, enemy.y, 0xaa44ff)
      }
    },
  },
  {
    id: 'explosive',
    name: 'Explosive',
    description: 'Projectiles explode on hit (32px AoE, 50% damage)',
    rarity: 'epic',
    color: 0xff4400,
    tintColor: 0xff6622,
    apply(proj) {
      proj.tint = blendColors(proj.tint, 0xff4400, 0.3)
      proj.scale *= 1.1
    },
    onHit(_targetId, targetX, targetY, damage, ctx) {
      const aoeDamage = Math.round(damage * 0.5)
      ctx.dealAoeDamage(targetX, targetY, 32, aoeDamage)
      // Explosion VFX
      drawExplosion(ctx.scene, targetX, targetY, 32, 0xff4400)
    },
  },
  {
    id: 'vampire',
    name: 'Vampire',
    description: '5% of damage dealt heals player',
    rarity: 'epic',
    color: 0xff44aa,
    tintColor: 0xff66cc,
    apply(proj) {
      proj.tint = blendColors(proj.tint, 0xff44aa, 0.2)
    },
    onHit(_targetId, _tx, _ty, damage, ctx) {
      const healAmount = Math.max(1, Math.round(damage * 0.05))
      ctx.healPlayer(healAmount)
    },
  },
]

// ── Weapon Functions ───────────────────────────────────────────────────

export function createDefaultWeapon(): PlayerWeapon {
  return {
    base: 'pulse',
    mods: [],
    maxSlots: 3,
  }
}

/** Add a mod to the weapon. Returns true if added. If full, replaces oldest. */
export function addMod(weapon: PlayerWeapon, mod: WeaponMod): boolean {
  if (weapon.mods.length >= weapon.maxSlots) {
    // Replace oldest mod
    weapon.mods.shift()
  }
  weapon.mods.push(mod)
  return true
}

/** Remove a mod from a specific slot index. Returns the removed mod or null. */
export function removeMod(weapon: PlayerWeapon, slotIndex: number): WeaponMod | null {
  if (slotIndex < 0 || slotIndex >= weapon.mods.length) return null
  return weapon.mods.splice(slotIndex, 1)[0]
}

/** Apply all mods to a projectile's data before firing. */
export function applyMods(weapon: PlayerWeapon, projectileData: ProjectileData, context: ModContext): ProjectileData {
  for (const mod of weapon.mods) {
    mod.apply(projectileData, context)
  }
  // Scale projectile size with mod count (more mods = slightly larger)
  projectileData.scale *= 1 + weapon.mods.length * 0.08
  // Blend tint colors from all mods
  if (weapon.mods.length > 0) {
    let blended = projectileData.tint
    for (const mod of weapon.mods) {
      blended = blendColors(blended, mod.tintColor, 0.3)
    }
    projectileData.tint = blended
  }
  return projectileData
}

/** Fire onHit callbacks for all mods on the weapon. */
export function fireModOnHit(
  weapon: PlayerWeapon,
  targetId: string,
  targetX: number,
  targetY: number,
  damage: number,
  context: ModContext,
): void {
  for (const mod of weapon.mods) {
    if (mod.onHit) {
      mod.onHit(targetId, targetX, targetY, damage, context)
    }
  }
}

/** Check if the weapon has a specific mod by id. */
export function hasMod(weapon: PlayerWeapon, modId: string): boolean {
  return weapon.mods.some(m => m.id === modId)
}

/** Get the effective attack cooldown multiplier from mods. */
export function getFireRateMultiplier(weapon: PlayerWeapon): number {
  let mult = 1.0
  for (const mod of weapon.mods) {
    const tempData = createDefaultProjectileData(0, 0)
    mod.apply(tempData, {} as ModContext)
    mult *= tempData.fireRateMultiplier
  }
  return mult
}

// ── Mod Drop System ────────────────────────────────────────────────────

const RARITY_WEIGHTS: Record<ModRarity, number> = {
  common: 60,
  rare: 30,
  epic: 10,
}

/** Roll a random mod drop. Floor number improves rare/epic odds. */
export function rollModDrop(floorNumber: number): WeaponMod {
  // Floor bonus: each floor adds +2% to rare, +1% to epic
  const floorBonus = Math.min(floorNumber - 1, 10)  // cap at floor 11
  const weights = {
    common: Math.max(20, RARITY_WEIGHTS.common - floorBonus * 3),
    rare: RARITY_WEIGHTS.rare + floorBonus * 2,
    epic: RARITY_WEIGHTS.epic + floorBonus * 1,
  }

  const total = weights.common + weights.rare + weights.epic
  const roll = Math.random() * total

  let targetRarity: ModRarity
  if (roll < weights.common) {
    targetRarity = 'common'
  } else if (roll < weights.common + weights.rare) {
    targetRarity = 'rare'
  } else {
    targetRarity = 'epic'
  }

  // Pick a random mod of that rarity
  const candidates = MOD_POOL.filter(m => m.rarity === targetRarity)
  return candidates[Math.floor(Math.random() * candidates.length)]
}

// ── Mod Pickup (world drop) ────────────────────────────────────────────

export interface ModPickup {
  sprite: Phaser.GameObjects.Arc
  glow: Phaser.GameObjects.Arc
  label: Phaser.GameObjects.Text
  mod: WeaponMod
  bobTween: Phaser.Tweens.Tween
}

const MOD_PICKUP_RADIUS = 7
const MOD_PICKUP_COLLECT_RANGE = 28

export function spawnModPickup(scene: Phaser.Scene, x: number, y: number, mod: WeaponMod): ModPickup {
  const rarityColor = RARITY_COLORS[mod.rarity]

  // Glow background
  const glow = scene.add.circle(x, y, MOD_PICKUP_RADIUS * 3, mod.color, 0.12).setDepth(3)
  scene.tweens.add({
    targets: glow,
    alpha: 0.28,
    scale: 1.4,
    duration: 900,
    ease: 'Sine.easeInOut',
    yoyo: true,
    repeat: -1,
  })

  // Core diamond shape (using circle for simplicity, tinted by mod)
  const sprite = scene.add.circle(x, y, MOD_PICKUP_RADIUS, mod.color, 0.95).setDepth(4)
  sprite.setStrokeStyle(1.5, rarityColor, 1)

  // Rarity name label floating above
  const label = scene.add.text(x, y - 14, mod.name, {
    fontFamily: 'monospace',
    fontSize: '7px',
    color: `#${rarityColor.toString(16).padStart(6, '0')}`,
    fontStyle: 'bold',
  }).setOrigin(0.5).setDepth(5).setAlpha(0.85)

  // Floating bob
  const bobTween = scene.tweens.add({
    targets: [sprite, glow, label],
    y: '-=4',
    duration: 1100,
    ease: 'Sine.easeInOut',
    yoyo: true,
    repeat: -1,
  })

  return { sprite, glow, label, mod, bobTween }
}

export interface ModCollectResult {
  collected: boolean
  mod: WeaponMod | null
}

export function collectModPickup(
  playerX: number,
  playerY: number,
  pickup: ModPickup,
): ModCollectResult {
  const dx = playerX - pickup.sprite.x
  const dy = playerY - pickup.sprite.y
  const dist = Math.sqrt(dx * dx + dy * dy)

  if (dist > MOD_PICKUP_COLLECT_RANGE) return { collected: false, mod: null }

  return { collected: true, mod: pickup.mod }
}

export function destroyModPickup(scene: Phaser.Scene, pickup: ModPickup): void {
  // Collection burst VFX
  const color = pickup.mod.color
  const x = pickup.sprite.x
  const y = pickup.sprite.y

  // Sparkle burst
  for (let i = 0; i < 8; i++) {
    const angle = (Math.PI * 2 * i) / 8
    const spark = scene.add.circle(x, y, 2, color, 1).setDepth(15)
    scene.tweens.add({
      targets: spark,
      x: x + Math.cos(angle) * 18,
      y: y + Math.sin(angle) * 18,
      alpha: 0,
      duration: 300,
      ease: 'Expo.easeOut',
      onComplete: () => spark.destroy(),
    })
  }

  pickup.bobTween.destroy()
  pickup.glow.destroy()
  pickup.label.destroy()
  pickup.sprite.destroy()
}

/** Show a floating mod-name announcement on screen. */
export function showModPickupFlash(scene: Phaser.Scene, mod: WeaponMod, screenX: number, screenY: number): void {
  const rarityColor = RARITY_COLORS[mod.rarity]
  const rarityLabel = mod.rarity.toUpperCase()

  const text = scene.add.text(screenX, screenY, `+ ${mod.name} [${rarityLabel}]`, {
    fontFamily: 'monospace',
    fontSize: '11px',
    color: `#${rarityColor.toString(16).padStart(6, '0')}`,
    fontStyle: 'bold',
    stroke: '#000000',
    strokeThickness: 2,
  }).setOrigin(0.5).setDepth(100).setScrollFactor(0)

  scene.tweens.add({
    targets: text,
    y: screenY - 40,
    alpha: 0,
    duration: 1500,
    ease: 'Cubic.easeOut',
    onComplete: () => text.destroy(),
  })
}

// ── Helpers ────────────────────────────────────────────────────────────

/** Blend two hex colors by a ratio (0 = all colorA, 1 = all colorB). */
function blendColors(colorA: number, colorB: number, ratio: number): number {
  const rA = (colorA >> 16) & 0xff
  const gA = (colorA >> 8) & 0xff
  const bA = colorA & 0xff
  const rB = (colorB >> 16) & 0xff
  const gB = (colorB >> 8) & 0xff
  const bB = colorB & 0xff

  const r = Math.round(rA + (rB - rA) * ratio)
  const g = Math.round(gA + (gB - gA) * ratio)
  const b = Math.round(bA + (bB - bA) * ratio)

  return (r << 16) | (g << 8) | b
}

/** Draw a jagged lightning chain between two points (VFX). */
function drawLightningChain(
  scene: Phaser.Scene,
  x1: number, y1: number,
  x2: number, y2: number,
  color: number,
): void {
  const gfx = scene.add.graphics().setDepth(14)
  gfx.lineStyle(2, color, 0.9)
  gfx.beginPath()
  gfx.moveTo(x1, y1)

  // 2-3 jagged midpoints
  const segments = 2 + Math.floor(Math.random() * 2)
  for (let i = 1; i <= segments; i++) {
    const t = i / (segments + 1)
    const mx = x1 + (x2 - x1) * t + (Math.random() - 0.5) * 16
    const my = y1 + (y2 - y1) * t + (Math.random() - 0.5) * 16
    gfx.lineTo(mx, my)
  }
  gfx.lineTo(x2, y2)
  gfx.strokePath()

  scene.tweens.add({
    targets: gfx,
    alpha: 0,
    duration: 180,
    ease: 'Expo.easeOut',
    onComplete: () => gfx.destroy(),
  })
}

/** Draw an explosion circle VFX. */
function drawExplosion(scene: Phaser.Scene, x: number, y: number, radius: number, color: number): void {
  // Core flash
  const core = scene.add.circle(x, y, radius * 0.3, color, 0.8).setDepth(15)
  scene.tweens.add({
    targets: core,
    scale: 2.5,
    alpha: 0,
    duration: 200,
    ease: 'Expo.easeOut',
    onComplete: () => core.destroy(),
  })

  // Expanding ring
  const ring = scene.add.circle(x, y, 4, color, 0).setDepth(14)
  ring.setStrokeStyle(2, color, 0.8)
  scene.tweens.add({
    targets: ring,
    radius,
    alpha: 0,
    duration: 300,
    ease: 'Expo.easeOut',
    onComplete: () => ring.destroy(),
  })

  // Debris particles
  for (let i = 0; i < 6; i++) {
    const angle = (Math.PI * 2 * i) / 6 + (Math.random() - 0.5) * 0.5
    const dist = radius * (0.4 + Math.random() * 0.6)
    const particle = scene.add.circle(x, y, 1.5, color, 0.9).setDepth(14)
    scene.tweens.add({
      targets: particle,
      x: x + Math.cos(angle) * dist,
      y: y + Math.sin(angle) * dist,
      alpha: 0,
      duration: 250,
      ease: 'Expo.easeOut',
      onComplete: () => particle.destroy(),
    })
  }
}
