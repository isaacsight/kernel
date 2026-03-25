// SYNTH -- Mod Effects: Frame-level implementations for weapon mods
// These functions are called from DungeonScene to execute mod behaviors
// that need per-frame updates or spawn-time side effects.

import Phaser from 'phaser'
import type { ProjectileOwner } from '../types'
import type { WeaponMod, PlayerWeapon, ModContext, DebuffType } from './WeaponMods'
import { hasMod } from './WeaponMods'

// ── Debuff State ───────────────────────────────────────────────────────

export interface ActiveDebuff {
  type: DebuffType
  /** Enemy id this debuff is on */
  enemyId: string
  /** When the debuff expires (Date.now() timestamp) */
  expiresAt: number
  /** Magnitude: for 'burn' = total remaining damage; for 'slow' = speed reduction ratio */
  magnitude: number
  /** For burn: last tick timestamp */
  lastTick: number
  /** For burn: tick interval ms */
  tickInterval: number
}

// ── Split: spawn extra projectiles at fire time ────────────────────────

/**
 * If weapon has the 'split' mod, spawns 2 extra projectiles at ±15° spread.
 * Call this right after firing the main projectile.
 * Returns the number of extra projectiles spawned.
 */
export function applySplit(
  weapon: PlayerWeapon,
  scene: Phaser.Scene,
  originX: number,
  originY: number,
  angle: number,
  damage: number,
  owner: ProjectileOwner,
  spawnFn: (x: number, y: number, angle: number, damage: number, owner: ProjectileOwner) => void,
): number {
  if (!hasMod(weapon, 'split')) return 0

  const spreadAngle = Math.PI / 12  // 15 degrees
  spawnFn(originX, originY, angle - spreadAngle, damage, owner)
  spawnFn(originX, originY, angle + spreadAngle, damage, owner)
  return 2
}

// ── Homing: adjust projectile velocity toward nearest enemy ────────────

/**
 * Adjust a projectile sprite's velocity to track the nearest enemy.
 * Call once per frame for each active projectile that has homing.
 */
export function applyHoming(
  sprite: Phaser.Physics.Arcade.Sprite,
  homingStrength: number,
  enemies: Array<{ x: number; y: number; hp: number }>,
  currentSpeed: number,
): void {
  if (homingStrength <= 0 || !sprite.active) return

  // Find nearest alive enemy
  let closest: { x: number; y: number } | null = null
  let closestDist = 200  // max homing detection range
  for (const enemy of enemies) {
    if (enemy.hp <= 0) continue
    const dist = Phaser.Math.Distance.Between(sprite.x, sprite.y, enemy.x, enemy.y)
    if (dist < closestDist) {
      closestDist = dist
      closest = enemy
    }
  }

  if (!closest) return

  // Calculate desired angle toward target
  const desiredAngle = Math.atan2(closest.y - sprite.y, closest.x - sprite.x)

  // Current velocity angle
  const body = sprite.body as Phaser.Physics.Arcade.Body
  const currentAngle = Math.atan2(body.velocity.y, body.velocity.x)

  // Lerp angle toward desired (homingStrength controls turn rate)
  let angleDiff = desiredAngle - currentAngle
  // Normalize to [-PI, PI]
  while (angleDiff > Math.PI) angleDiff -= Math.PI * 2
  while (angleDiff < -Math.PI) angleDiff += Math.PI * 2

  const newAngle = currentAngle + angleDiff * homingStrength
  body.setVelocity(
    Math.cos(newAngle) * currentSpeed,
    Math.sin(newAngle) * currentSpeed,
  )
}

// ── Debuff Management ──────────────────────────────────────────────────

const BURN_TICK_MS = 500  // burn ticks every 500ms

/**
 * Create a new debuff. If a debuff of the same type already exists on the
 * same enemy, refresh its duration (don't stack).
 */
export function addDebuff(
  debuffs: ActiveDebuff[],
  enemyId: string,
  type: DebuffType,
  durationMs: number,
  magnitude: number,
): void {
  const now = Date.now()

  // Check for existing debuff of same type on same enemy
  const existing = debuffs.find(d => d.enemyId === enemyId && d.type === type)
  if (existing) {
    // Refresh duration and magnitude (take the higher)
    existing.expiresAt = now + durationMs
    existing.magnitude = Math.max(existing.magnitude, magnitude)
    return
  }

  debuffs.push({
    type,
    enemyId,
    expiresAt: now + durationMs,
    magnitude,
    lastTick: now,
    tickInterval: type === 'burn' ? BURN_TICK_MS : 0,
  })
}

/**
 * Tick all active debuffs. Applies burn damage, manages slow state.
 * Returns the list of still-active debuffs.
 */
export function tickDebuffs(
  debuffs: ActiveDebuff[],
  enemies: Array<{ id: string; hp: number; speed: number; baseSpeed: number; sprite: { x: number; y: number; active: boolean } }>,
  dealDamageToEnemy: (enemyId: string, damage: number) => void,
  scene: Phaser.Scene,
): ActiveDebuff[] {
  const now = Date.now()
  const alive: ActiveDebuff[] = []

  for (const debuff of debuffs) {
    // Remove expired debuffs
    if (now >= debuff.expiresAt) {
      // If this was a slow, restore enemy speed
      if (debuff.type === 'slow') {
        const enemy = enemies.find(e => e.id === debuff.enemyId)
        if (enemy) {
          enemy.speed = enemy.baseSpeed
        }
      }
      continue
    }

    const enemy = enemies.find(e => e.id === debuff.enemyId)
    if (!enemy || enemy.hp <= 0 || !enemy.sprite.active) continue

    if (debuff.type === 'burn') {
      // Tick burn damage
      if (now - debuff.lastTick >= debuff.tickInterval) {
        const tickCount = Math.ceil((debuff.expiresAt - now) / debuff.tickInterval)
        const tickDamage = Math.max(1, Math.round(debuff.magnitude / Math.max(1, tickCount + 1)))
        dealDamageToEnemy(debuff.enemyId, tickDamage)
        debuff.lastTick = now

        // Burn VFX: small orange particles
        drawBurnTick(scene, enemy.sprite.x, enemy.sprite.y)
      }
    } else if (debuff.type === 'slow') {
      // Apply speed reduction
      enemy.speed = enemy.baseSpeed * (1 - debuff.magnitude)

      // Frost VFX: subtle blue tint on enemy (once per second)
      if (now - debuff.lastTick >= 1000) {
        drawFrostIndicator(scene, enemy.sprite.x, enemy.sprite.y)
        debuff.lastTick = now
      }
    }

    alive.push(debuff)
  }

  return alive
}

/**
 * Get the speed multiplier for an enemy based on active slow debuffs.
 * Used if you need to check before the tick cycle.
 */
export function getSlowMultiplier(debuffs: ActiveDebuff[], enemyId: string): number {
  let mult = 1.0
  const now = Date.now()
  for (const d of debuffs) {
    if (d.enemyId === enemyId && d.type === 'slow' && now < d.expiresAt) {
      mult = Math.min(mult, 1 - d.magnitude)
    }
  }
  return mult
}

// ── VFX Helpers ────────────────────────────────────────────────────────

function drawBurnTick(scene: Phaser.Scene, x: number, y: number): void {
  for (let i = 0; i < 3; i++) {
    const ox = (Math.random() - 0.5) * 12
    const oy = (Math.random() - 0.5) * 12
    const particle = scene.add.circle(x + ox, y + oy, 1.5, 0xff6622, 0.9).setDepth(14)
    scene.tweens.add({
      targets: particle,
      y: y + oy - 8 - Math.random() * 6,
      alpha: 0,
      scale: 0.3,
      duration: 300 + Math.random() * 200,
      ease: 'Quad.easeOut',
      onComplete: () => particle.destroy(),
    })
  }
}

function drawFrostIndicator(scene: Phaser.Scene, x: number, y: number): void {
  // Small blue snowflake-like particles
  for (let i = 0; i < 2; i++) {
    const angle = Math.random() * Math.PI * 2
    const dist = 6 + Math.random() * 6
    const px = x + Math.cos(angle) * dist
    const py = y + Math.sin(angle) * dist
    const particle = scene.add.circle(px, py, 1, 0x44ddff, 0.8).setDepth(14)
    scene.tweens.add({
      targets: particle,
      alpha: 0,
      scale: 2,
      duration: 400,
      ease: 'Quad.easeOut',
      onComplete: () => particle.destroy(),
    })
  }
}
