// SYNTH -- Weapon System
// Manages current weapon, fires primary/secondary attacks, spawns VFX per weapon type.
// Each weapon creates distinct visual patterns (Design Bible: "different heroic identity").

import Phaser from 'phaser'
import {
  WEAPONS,
  WEAPON_IDS,
  BLADE_COMBO_DAMAGE,
  BLADE_COMBO_INTERVAL,
  ARC_BOUNCE_COUNT,
  ARC_BOUNCE_RANGE,
  TESLA_FIELD_RADIUS,
  TESLA_FIELD_DPS,
  TESLA_FIELD_DURATION,
} from './Weapons'
import type { WeaponId, WeaponDef } from './Weapons'
import { Projectile } from './Projectile'
import { muzzleFlash, hitSparks, screenShake, dashTrail } from '../systems/VFX'
import { PROJECTILE_SPEED, TEX } from '../constants'
import type { ProjectileOwner } from '../types'

// ── Types ──

/** Lightweight handle for effects that the scene can collision-check */
export interface AttackEffect {
  type: 'projectile' | 'melee_arc' | 'cone' | 'bounce' | 'aoe' | 'dash' | 'field'
  /** Physics sprite (projectiles/bounces) or null for instant effects */
  sprite: Phaser.Physics.Arcade.Sprite | null
  damage: number
  owner: ProjectileOwner
  /** For bouncing projectiles: remaining bounces */
  bouncesLeft?: number
  /** For piercing projectiles: passes through enemies */
  piercing?: boolean
  /** For tesla fields: interval timer */
  fieldTimer?: Phaser.Time.TimerEvent
  /** For tesla fields: visual graphics */
  fieldGraphics?: Phaser.GameObjects.Graphics
  /** Radius for area effects */
  radius?: number
  /** Position for area effects */
  x?: number
  y?: number
  /** Cleanup callback */
  destroy: () => void
}

// ── Weapon System ──

export class WeaponSystem {
  private currentId: WeaponId = 'pulse'
  private lastPrimary = 0
  private lastSecondary = 0

  // Blade combo tracking
  private bladeComboIndex = 0
  private lastBladeHit = 0

  // Pulse charge tracking
  private chargeStart = 0
  private isCharging = false

  /** All live attack effects for the scene to check collisions against */
  readonly effects: AttackEffect[] = []

  // ── Public API ──

  get current(): WeaponDef {
    return WEAPONS[this.currentId]
  }

  get weaponId(): WeaponId {
    return this.currentId
  }

  switchWeapon(id: WeaponId): void {
    if (!WEAPON_IDS.includes(id)) return
    this.currentId = id
    // Reset combo state when switching
    this.bladeComboIndex = 0
    this.isCharging = false
    this.chargeStart = 0
  }

  /** Cycle to the next weapon (for scroll-wheel or tab) */
  cycleWeapon(): void {
    const idx = WEAPON_IDS.indexOf(this.currentId)
    this.switchWeapon(WEAPON_IDS[(idx + 1) % WEAPON_IDS.length])
  }

  // ── Primary Attack ──

  primaryAttack(scene: Phaser.Scene, x: number, y: number, angle: number): AttackEffect | null {
    const now = Date.now()
    const wep = this.current

    if (now - this.lastPrimary < wep.primaryCooldown) return null
    this.lastPrimary = now

    switch (wep.primaryType) {
      case 'projectile':
        return this.firePulseProjectile(scene, x, y, angle, wep.primaryDamage, false)
      case 'cone':
        return this.fireCone(scene, x, y, angle)
      case 'melee':
        return this.fireMeleeCombo(scene, x, y, angle)
      case 'bounce':
        return this.fireBounceProjectile(scene, x, y, angle)
      default:
        return null
    }
  }

  // ── Secondary Attack ──

  /** Begin charging (for Pulse). Call on E key down. */
  beginCharge(): void {
    if (this.currentId !== 'pulse') return
    this.isCharging = true
    this.chargeStart = Date.now()
  }

  /** Returns current charge ratio 0-1 (for UI feedback). */
  getChargeRatio(): number {
    if (!this.isCharging) return 0
    const elapsed = Date.now() - this.chargeStart
    return Math.min(elapsed / 1000, 1)
  }

  secondaryAttack(scene: Phaser.Scene, x: number, y: number, angle: number): AttackEffect | null {
    const now = Date.now()
    const wep = this.current

    if (now - this.lastSecondary < wep.secondaryCooldown) return null
    this.lastSecondary = now

    switch (wep.secondaryType) {
      case 'charge':
        return this.fireChargedShot(scene, x, y, angle)
      case 'aoe':
        return this.fireGroundSlam(scene, x, y)
      case 'dash':
        return this.fireDashAttack(scene, x, y, angle)
      case 'field':
        return this.placeTeslaField(scene, x, y, angle)
      default:
        return null
    }
  }

  // ── Cleanup ──

  /** Remove dead effects. Call every frame. */
  cleanup(): void {
    for (let i = this.effects.length - 1; i >= 0; i--) {
      const eff = this.effects[i]
      if (eff.sprite && !eff.sprite.active) {
        this.effects.splice(i, 1)
      }
    }
  }

  // ── Private: Pulse ──

  private firePulseProjectile(
    scene: Phaser.Scene, x: number, y: number, angle: number, damage: number, piercing: boolean,
  ): AttackEffect {
    const wep = WEAPONS.pulse

    // Thin fast projectile VFX: small muzzle flash + narrow trail
    muzzleFlash(scene, x, y, angle, wep.color)

    const proj = new Projectile(scene, x, y, angle, damage, 'player')
    // Speed boost for pulse: 1.5x default
    const speed = PROJECTILE_SPEED * 1.5
    proj.sprite.setVelocity(Math.cos(angle) * speed, Math.sin(angle) * speed)

    // Visual: tint projectile and make it narrow
    proj.sprite.setTint(wep.color)
    proj.sprite.setScale(0.6, 0.3)

    const effect: AttackEffect = {
      type: 'projectile',
      sprite: proj.sprite,
      damage,
      owner: 'player',
      piercing,
      destroy: () => proj.destroy(),
    }
    this.effects.push(effect)
    return effect
  }

  private fireChargedShot(scene: Phaser.Scene, x: number, y: number, angle: number): AttackEffect {
    const wep = WEAPONS.pulse
    const chargeRatio = this.getChargeRatio()
    this.isCharging = false
    this.chargeStart = 0

    // Damage scales with charge: min 1x, max 3x
    const multiplier = 1 + chargeRatio * 2
    const damage = Math.round(wep.primaryDamage * multiplier)

    // Bigger muzzle flash for charged shot
    muzzleFlash(scene, x, y, angle, wep.color)
    // Additional flash ring
    const ring = scene.add.circle(x, y, 6, wep.color, 0.8).setDepth(15)
    scene.tweens.add({
      targets: ring,
      scale: 3 + chargeRatio * 3,
      alpha: 0,
      duration: 150,
      ease: 'Expo.easeOut',
      onComplete: () => ring.destroy(),
    })

    const proj = new Projectile(scene, x, y, angle, damage, 'player')
    const speed = PROJECTILE_SPEED * 1.8
    proj.sprite.setVelocity(Math.cos(angle) * speed, Math.sin(angle) * speed)
    proj.sprite.setTint(wep.color)
    // Larger based on charge
    proj.sprite.setScale(0.8 + chargeRatio * 0.6, 0.4 + chargeRatio * 0.3)

    screenShake(scene, 2 + chargeRatio * 3, 80)

    const effect: AttackEffect = {
      type: 'projectile',
      sprite: proj.sprite,
      damage,
      owner: 'player',
      piercing: true,
      destroy: () => proj.destroy(),
    }
    this.effects.push(effect)
    return effect
  }

  // ── Private: Nova ──

  private fireCone(scene: Phaser.Scene, x: number, y: number, angle: number): AttackEffect {
    const wep = WEAPONS.nova
    const coneHalfAngle = Math.PI / 6  // 30 degrees = 60 degree total arc
    const range = wep.primaryRange

    // VFX: wide cone flash made of arc segments
    muzzleFlash(scene, x, y, angle, wep.color)

    const graphics = scene.add.graphics().setDepth(14)
    graphics.fillStyle(wep.color, 0.5)
    graphics.beginPath()
    graphics.moveTo(x, y)
    const segments = 12
    for (let i = 0; i <= segments; i++) {
      const a = angle - coneHalfAngle + (coneHalfAngle * 2 * i) / segments
      graphics.lineTo(x + Math.cos(a) * range, y + Math.sin(a) * range)
    }
    graphics.closePath()
    graphics.fillPath()

    // Fade the cone
    scene.tweens.add({
      targets: graphics,
      alpha: 0,
      duration: 200,
      ease: 'Expo.easeOut',
      onComplete: () => graphics.destroy(),
    })

    // Spark particles at the edge of the cone
    for (let i = 0; i < 8; i++) {
      const a = angle - coneHalfAngle + Math.random() * coneHalfAngle * 2
      const dist = range * (0.5 + Math.random() * 0.5)
      hitSparks(scene, x + Math.cos(a) * dist, y + Math.sin(a) * dist, wep.color, 3)
    }

    screenShake(scene, 3, 80)

    // Cone is an instant area effect -- no sprite, checked by the scene
    const effect: AttackEffect = {
      type: 'cone',
      sprite: null,
      damage: wep.primaryDamage,
      owner: 'player',
      radius: range,
      x,
      y,
      destroy: () => { /* instant, already cleaned up */ },
    }
    this.effects.push(effect)

    // Auto-remove after 1 frame (instant hit check)
    scene.time.delayedCall(50, () => {
      const idx = this.effects.indexOf(effect)
      if (idx !== -1) this.effects.splice(idx, 1)
    })

    return effect
  }

  private fireGroundSlam(scene: Phaser.Scene, x: number, y: number): AttackEffect {
    const wep = WEAPONS.nova
    const radius = 80

    // VFX: expanding ring + shockwave
    const ring = scene.add.circle(x, y, 4, wep.color, 0).setDepth(14)
    ring.setStrokeStyle(3, wep.color, 1)
    scene.tweens.add({
      targets: ring,
      radius,
      alpha: 0,
      duration: 350,
      ease: 'Expo.easeOut',
      onComplete: () => ring.destroy(),
    })

    // Core impact flash
    const core = scene.add.circle(x, y, radius * 0.3, wep.color, 0.6).setDepth(15)
    scene.tweens.add({
      targets: core,
      scale: 2.5,
      alpha: 0,
      duration: 250,
      ease: 'Expo.easeOut',
      onComplete: () => core.destroy(),
    })

    // Ground cracks (radial lines)
    const crackGfx = scene.add.graphics().setDepth(13)
    crackGfx.lineStyle(2, wep.color, 0.7)
    for (let i = 0; i < 8; i++) {
      const a = (Math.PI * 2 * i) / 8 + (Math.random() - 0.5) * 0.3
      const len = radius * (0.5 + Math.random() * 0.5)
      crackGfx.beginPath()
      crackGfx.moveTo(x, y)
      crackGfx.lineTo(x + Math.cos(a) * len, y + Math.sin(a) * len)
      crackGfx.strokePath()
    }
    scene.tweens.add({
      targets: crackGfx,
      alpha: 0,
      duration: 400,
      ease: 'Quad.easeOut',
      onComplete: () => crackGfx.destroy(),
    })

    hitSparks(scene, x, y, wep.color, 10)
    screenShake(scene, 6, 150)

    const effect: AttackEffect = {
      type: 'aoe',
      sprite: null,
      damage: wep.secondaryDamage,
      owner: 'player',
      radius,
      x,
      y,
      destroy: () => { /* instant */ },
    }
    this.effects.push(effect)

    // Auto-remove after 1 frame
    scene.time.delayedCall(50, () => {
      const idx = this.effects.indexOf(effect)
      if (idx !== -1) this.effects.splice(idx, 1)
    })

    return effect
  }

  // ── Private: Blade ──

  private fireMeleeCombo(scene: Phaser.Scene, x: number, y: number, angle: number): AttackEffect {
    const wep = WEAPONS.blade
    const now = Date.now()

    // Advance combo if within timing window, else reset
    if (now - this.lastBladeHit <= BLADE_COMBO_INTERVAL * 3 && this.bladeComboIndex > 0) {
      this.bladeComboIndex = (this.bladeComboIndex + 1) % 3
    } else {
      this.bladeComboIndex = 0
    }
    this.lastBladeHit = now

    const comboDamage = BLADE_COMBO_DAMAGE[this.bladeComboIndex]
    const range = wep.primaryRange

    // VFX: close-range arc slash -- wider arc per combo step
    const arcHalfAngle = (Math.PI / 4) + (this.bladeComboIndex * Math.PI / 8)  // 45, 67.5, 90 degrees
    const arcGraphics = scene.add.graphics().setDepth(14)

    // Slash arc
    arcGraphics.lineStyle(3 + this.bladeComboIndex, wep.color, 0.9)
    arcGraphics.beginPath()
    const segments = 10
    for (let i = 0; i <= segments; i++) {
      const a = angle - arcHalfAngle + (arcHalfAngle * 2 * i) / segments
      const px = x + Math.cos(a) * range
      const py = y + Math.sin(a) * range
      if (i === 0) arcGraphics.moveTo(px, py)
      else arcGraphics.lineTo(px, py)
    }
    arcGraphics.strokePath()

    // Fill arc with semi-transparent color
    arcGraphics.fillStyle(wep.color, 0.15 + this.bladeComboIndex * 0.1)
    arcGraphics.beginPath()
    arcGraphics.moveTo(x, y)
    for (let i = 0; i <= segments; i++) {
      const a = angle - arcHalfAngle + (arcHalfAngle * 2 * i) / segments
      arcGraphics.lineTo(x + Math.cos(a) * range, y + Math.sin(a) * range)
    }
    arcGraphics.closePath()
    arcGraphics.fillPath()

    // Fade
    scene.tweens.add({
      targets: arcGraphics,
      alpha: 0,
      duration: 120,
      ease: 'Expo.easeOut',
      onComplete: () => arcGraphics.destroy(),
    })

    // Edge sparks on final combo hit
    if (this.bladeComboIndex === 2) {
      hitSparks(scene, x + Math.cos(angle) * range, y + Math.sin(angle) * range, wep.color, 8)
      screenShake(scene, 4, 100)
    } else {
      screenShake(scene, 1 + this.bladeComboIndex, 50)
    }

    const effect: AttackEffect = {
      type: 'melee_arc',
      sprite: null,
      damage: comboDamage,
      owner: 'player',
      radius: range,
      x,
      y,
      destroy: () => { /* instant */ },
    }
    this.effects.push(effect)

    // Auto-remove after 1 frame
    scene.time.delayedCall(50, () => {
      const idx = this.effects.indexOf(effect)
      if (idx !== -1) this.effects.splice(idx, 1)
    })

    return effect
  }

  private fireDashAttack(scene: Phaser.Scene, x: number, y: number, angle: number): AttackEffect {
    const wep = WEAPONS.blade
    const dashDistance = 120

    // Endpoint
    const ex = x + Math.cos(angle) * dashDistance
    const ey = y + Math.sin(angle) * dashDistance

    // Trail VFX: series of afterimages along dash path
    const steps = 6
    for (let i = 0; i < steps; i++) {
      const t = i / steps
      const tx = x + (ex - x) * t
      const ty = y + (ey - y) * t
      scene.time.delayedCall(i * 15, () => {
        dashTrail(scene, tx, ty, wep.color, 16, 16)
      })
    }

    // Slash VFX at endpoint
    const slashGfx = scene.add.graphics().setDepth(15)
    slashGfx.lineStyle(4, wep.color, 1)
    // X-shaped slash
    const slashSize = 14
    slashGfx.beginPath()
    slashGfx.moveTo(ex - slashSize, ey - slashSize)
    slashGfx.lineTo(ex + slashSize, ey + slashSize)
    slashGfx.moveTo(ex + slashSize, ey - slashSize)
    slashGfx.lineTo(ex - slashSize, ey + slashSize)
    slashGfx.strokePath()
    scene.tweens.add({
      targets: slashGfx,
      alpha: 0,
      duration: 200,
      ease: 'Expo.easeOut',
      onComplete: () => slashGfx.destroy(),
    })

    hitSparks(scene, ex, ey, wep.color, 6)
    screenShake(scene, 4, 100)

    const effect: AttackEffect = {
      type: 'dash',
      sprite: null,
      damage: wep.secondaryDamage,
      owner: 'player',
      radius: 20,  // hit radius around the dash endpoint
      x: ex,
      y: ey,
      destroy: () => { /* instant */ },
    }
    this.effects.push(effect)

    // Auto-remove after 1 frame
    scene.time.delayedCall(50, () => {
      const idx = this.effects.indexOf(effect)
      if (idx !== -1) this.effects.splice(idx, 1)
    })

    return effect
  }

  // ── Private: Arc ──

  private fireBounceProjectile(scene: Phaser.Scene, x: number, y: number, angle: number): AttackEffect {
    const wep = WEAPONS.arc

    muzzleFlash(scene, x, y, angle, wep.color)

    const proj = new Projectile(scene, x, y, angle, wep.primaryDamage, 'player')
    proj.sprite.setTint(wep.color)

    // Lightning bolt visual: slightly jagged trail via tint + scale
    proj.sprite.setScale(0.7, 0.5)

    // Electric crackle particles at origin
    for (let i = 0; i < 3; i++) {
      const sparkAngle = angle + (Math.random() - 0.5) * 1.2
      const sparkDist = 6 + Math.random() * 8
      const spark = scene.add.circle(
        x + Math.cos(sparkAngle) * sparkDist,
        y + Math.sin(sparkAngle) * sparkDist,
        1, wep.color, 0.9,
      ).setDepth(14)
      scene.tweens.add({
        targets: spark,
        alpha: 0,
        duration: 100,
        onComplete: () => spark.destroy(),
      })
    }

    const effect: AttackEffect = {
      type: 'bounce',
      sprite: proj.sprite,
      damage: wep.primaryDamage,
      owner: 'player',
      bouncesLeft: ARC_BOUNCE_COUNT,
      destroy: () => proj.destroy(),
    }
    this.effects.push(effect)
    return effect
  }

  private placeTeslaField(scene: Phaser.Scene, x: number, y: number, _angle: number): AttackEffect {
    const wep = WEAPONS.arc
    const radius = TESLA_FIELD_RADIUS

    // Place at aim position: offset forward from player
    const fieldX = x + Math.cos(_angle) * 60
    const fieldY = y + Math.sin(_angle) * 60

    // Visual: pulsing circle with electric arcs
    const fieldGraphics = scene.add.graphics().setDepth(5)

    const drawField = (alpha: number) => {
      fieldGraphics.clear()
      // Base circle
      fieldGraphics.fillStyle(wep.color, 0.08 * alpha)
      fieldGraphics.fillCircle(fieldX, fieldY, radius)
      // Border ring
      fieldGraphics.lineStyle(1.5, wep.color, 0.4 * alpha)
      fieldGraphics.strokeCircle(fieldX, fieldY, radius)
      // Random electric arcs inside
      fieldGraphics.lineStyle(1, wep.color, 0.6 * alpha)
      for (let i = 0; i < 3; i++) {
        const a1 = Math.random() * Math.PI * 2
        const a2 = a1 + (Math.random() - 0.5) * 2
        const r1 = Math.random() * radius * 0.8
        const r2 = Math.random() * radius * 0.8
        fieldGraphics.beginPath()
        fieldGraphics.moveTo(fieldX + Math.cos(a1) * r1, fieldY + Math.sin(a1) * r1)
        // Jagged midpoint
        const mx = fieldX + (Math.cos(a1) * r1 + Math.cos(a2) * r2) / 2 + (Math.random() - 0.5) * 10
        const my = fieldY + (Math.sin(a1) * r1 + Math.sin(a2) * r2) / 2 + (Math.random() - 0.5) * 10
        fieldGraphics.lineTo(mx, my)
        fieldGraphics.lineTo(fieldX + Math.cos(a2) * r2, fieldY + Math.sin(a2) * r2)
        fieldGraphics.strokePath()
      }
    }

    drawField(1)

    // Pulse the field visually
    const pulseTimer = scene.time.addEvent({
      delay: 200,
      loop: true,
      callback: () => drawField(1),
    })

    // Damage tick timer
    const tickRate = 500  // check every 500ms, apply DPS proportionally
    const damagePerTick = Math.round(TESLA_FIELD_DPS * (tickRate / 1000))
    const fieldTimer = scene.time.addEvent({
      delay: tickRate,
      loop: true,
      callback: () => { /* Scene checks for enemies in radius */ },
    })

    const effect: AttackEffect = {
      type: 'field',
      sprite: null,
      damage: damagePerTick,
      owner: 'player',
      radius,
      x: fieldX,
      y: fieldY,
      fieldTimer,
      fieldGraphics,
      destroy: () => {
        fieldTimer.destroy()
        pulseTimer.destroy()
        fieldGraphics.destroy()
      },
    }
    this.effects.push(effect)

    // Self-destruct after duration
    scene.time.delayedCall(TESLA_FIELD_DURATION, () => {
      // Fade out
      scene.tweens.add({
        targets: fieldGraphics,
        alpha: 0,
        duration: 300,
        ease: 'Quad.easeOut',
        onComplete: () => {
          effect.destroy()
          const idx = this.effects.indexOf(effect)
          if (idx !== -1) this.effects.splice(idx, 1)
        },
      })
    })

    return effect
  }

  // ── Bounce Helper ──

  /**
   * Called by the scene when a bouncing projectile hits an enemy.
   * Finds the next closest enemy and redirects the projectile.
   * Returns true if a bounce occurred, false if bounces are exhausted.
   */
  handleBounce(
    scene: Phaser.Scene,
    effect: AttackEffect,
    hitX: number,
    hitY: number,
    enemies: Array<{ x: number; y: number; id: string }>,
    hitEnemyId: string,
  ): boolean {
    if (!effect.bouncesLeft || effect.bouncesLeft <= 0 || !effect.sprite?.active) return false
    effect.bouncesLeft--

    // Find closest un-hit enemy within bounce range
    let closest: { x: number; y: number } | null = null
    let closestDist = ARC_BOUNCE_RANGE

    for (const enemy of enemies) {
      if (enemy.id === hitEnemyId) continue
      const dist = Phaser.Math.Distance.Between(hitX, hitY, enemy.x, enemy.y)
      if (dist < closestDist) {
        closestDist = dist
        closest = { x: enemy.x, y: enemy.y }
      }
    }

    if (!closest) {
      // No target to bounce to
      return false
    }

    // Redirect projectile
    const bounceAngle = Math.atan2(closest.y - hitY, closest.x - hitX)
    const speed = PROJECTILE_SPEED
    effect.sprite.setPosition(hitX, hitY)
    effect.sprite.setVelocity(Math.cos(bounceAngle) * speed, Math.sin(bounceAngle) * speed)

    // Lightning chain VFX: line from hit point toward next target
    const chainGfx = scene.add.graphics().setDepth(14)
    const wep = WEAPONS.arc
    chainGfx.lineStyle(2, wep.color, 0.8)
    chainGfx.beginPath()
    chainGfx.moveTo(hitX, hitY)
    // Jagged midpoint for lightning look
    const mx = (hitX + closest.x) / 2 + (Math.random() - 0.5) * 20
    const my = (hitY + closest.y) / 2 + (Math.random() - 0.5) * 20
    chainGfx.lineTo(mx, my)
    chainGfx.lineTo(closest.x, closest.y)
    chainGfx.strokePath()

    scene.tweens.add({
      targets: chainGfx,
      alpha: 0,
      duration: 150,
      ease: 'Expo.easeOut',
      onComplete: () => chainGfx.destroy(),
    })

    hitSparks(scene, hitX, hitY, wep.color, 4)

    return true
  }

  // ── Cone Hit Check Helper ──

  /**
   * Check if a point is inside the last cone attack.
   * Used by the scene for cone/melee_arc collision detection.
   */
  static isInCone(
    originX: number, originY: number, angle: number,
    halfAngle: number, range: number,
    targetX: number, targetY: number,
  ): boolean {
    const dist = Phaser.Math.Distance.Between(originX, originY, targetX, targetY)
    if (dist > range) return false

    const targetAngle = Math.atan2(targetY - originY, targetX - originX)
    let diff = targetAngle - angle
    // Normalize to [-PI, PI]
    while (diff > Math.PI) diff -= Math.PI * 2
    while (diff < -Math.PI) diff += Math.PI * 2

    return Math.abs(diff) <= halfAngle
  }
}
