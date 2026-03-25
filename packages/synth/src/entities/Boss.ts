// SYNTH — Boss Entity
// Three-phase boss fight with shield segments, orbit attacks,
// minion summoning, and enrage mechanics.

import Phaser from 'phaser'
import type { Vec2, BossPhase, BossState, ProjectileOwner } from '../types'
import {
  BOSS_HP, BOSS_SPEED, BOSS_DAMAGE, BOSS_SHIELD_SEGMENTS,
  BOSS_SUMMON_INTERVAL, BOSS_ORBIT_INTERVAL, BOSS_ORBIT_PROJECTILE_COUNT,
  BOSS_ENRAGE_THRESHOLD, BOSS_SUMMON_THRESHOLD, BOSS_ENRAGE_SHAKE_INTERVAL,
  BOSS_COLOR, TEX, TILE_SIZE, PROJECTILE_SPEED, INVINCIBILITY_MS,
} from '../constants'
import { HealthBar } from '../combat/HealthBar'
import {
  screenShake, flashWhite, deathExplosion, hitSparks, killSlowmo,
  damageNumber, hitstop,
} from '../systems/VFX'

// ── Shield Segment Visual ───────────────────────────────────────────

class ShieldSegment {
  graphic: Phaser.GameObjects.Arc
  hp = 30
  maxHp = 30
  alive = true
  private index: number
  private totalSegments: number

  constructor(scene: Phaser.Scene, index: number, totalSegments: number) {
    this.index = index
    this.totalSegments = totalSegments
    this.graphic = scene.add.arc(0, 0, 36, 0, 0, false, 0x8844ff, 0.5)
    this.graphic.setStrokeStyle(2, 0xaa66ff, 0.8)
    this.graphic.setDepth(12)
  }

  update(bossX: number, bossY: number, elapsed: number): void {
    if (!this.alive) return
    const baseAngle = (this.index / this.totalSegments) * Math.PI * 2
    const rotation = elapsed * 0.001
    const angle = baseAngle + rotation
    const orbitRadius = 36
    this.graphic.setPosition(
      bossX + Math.cos(angle) * orbitRadius,
      bossY + Math.sin(angle) * orbitRadius,
    )
    // Pulse alpha based on health
    const ratio = this.hp / this.maxHp
    this.graphic.setAlpha(0.3 + ratio * 0.5)
  }

  takeDamage(amount: number, scene: Phaser.Scene): boolean {
    if (!this.alive) return false
    this.hp -= amount
    if (this.hp <= 0) {
      this.alive = false
      deathExplosion(scene, this.graphic.x, this.graphic.y, 0x8844ff, 8)
      this.graphic.destroy()
      return true // segment destroyed
    }
    hitSparks(scene, this.graphic.x, this.graphic.y, 0x8844ff, 3)
    return false
  }

  destroy(): void {
    if (this.graphic?.active) this.graphic.destroy()
  }
}

// ── Boss Projectile (orbit ring) ────────────────────────────────────

export interface BossProjectile {
  sprite: Phaser.GameObjects.Arc
  vx: number
  vy: number
  damage: number
  owner: ProjectileOwner
  born: number
  lifetime: number
}

// ── Boss Entity ─────────────────────────────────────────────────────

export interface BossCallbacks {
  onSpawnMinions: (count: number, bossPos: Vec2) => void
  onBossDeath: (bossPos: Vec2) => void
  onPhaseChange: (phase: BossPhase) => void
}

export class Boss {
  sprite: Phaser.Physics.Arcade.Sprite
  hp: number
  maxHp: number
  speed: number
  damage: number
  healthBar: HealthBar
  invincibleUntil = 0
  id = 'boss'

  private scene: Phaser.Scene
  private state: BossState
  private shields: ShieldSegment[] = []
  private orbitProjectiles: BossProjectile[] = []
  private callbacks: BossCallbacks
  private dead = false
  private deathAnimating = false
  private shieldBarGraphics: Phaser.GameObjects.Graphics
  private phaseText: Phaser.GameObjects.Text

  // Diablo-style boss presence
  private bossAura: Phaser.GameObjects.Arc
  private bossShadow: Phaser.GameObjects.Ellipse
  private trailTimer = 0

  constructor(scene: Phaser.Scene, x: number, y: number, callbacks: BossCallbacks) {
    this.scene = scene
    this.callbacks = callbacks
    this.hp = BOSS_HP
    this.maxHp = BOSS_HP
    this.speed = BOSS_SPEED
    this.damage = BOSS_DAMAGE

    // Boss shadow (larger than normal entities)
    this.bossShadow = scene.add.ellipse(x, y + 14, 32, 10, 0x000000, 0.4)
      .setDepth(0)

    this.sprite = scene.physics.add.sprite(x, y, TEX.ENEMY_BOSS)
    this.sprite.setCollideWorldBounds(true)
    this.sprite.setScale(1.2)
    this.sprite.setTint(BOSS_COLOR)
    this.sprite.setDepth(8)

    // Boss aura glow (larger radius, pulsing)
    this.bossAura = scene.add.circle(x, y, 48, BOSS_COLOR, 0.12)
      .setDepth(3)
      .setBlendMode(Phaser.BlendModes.ADD)

    scene.tweens.add({
      targets: this.bossAura,
      alpha: { from: 0.06, to: 0.2 },
      scale: { from: 0.85, to: 1.2 },
      duration: 1200,
      ease: 'Sine.easeInOut',
      yoyo: true,
      repeat: -1,
    })

    this.healthBar = new HealthBar(scene)

    this.state = {
      phase: 1,
      shieldSegments: BOSS_SHIELD_SEGMENTS,
      maxShieldSegments: BOSS_SHIELD_SEGMENTS,
      lastSummon: 0,
      lastOrbit: 0,
      lastShake: 0,
      enraged: false,
    }

    // Create shield segments
    for (let i = 0; i < BOSS_SHIELD_SEGMENTS; i++) {
      this.shields.push(new ShieldSegment(scene, i, BOSS_SHIELD_SEGMENTS))
    }

    // Shield bar UI
    this.shieldBarGraphics = scene.add.graphics().setDepth(50).setScrollFactor(0)

    // Phase indicator -- dramatic with glow and text shadow
    this.phaseText = scene.add.text(
      scene.cameras.main.width / 2, 36, 'BOSS — PHASE 1',
      {
        fontFamily: 'monospace',
        fontSize: '16px',
        color: '#cc44ff',
        fontStyle: 'bold',
        shadow: {
          offsetX: 0,
          offsetY: 0,
          color: '#cc44ff',
          blur: 8,
          fill: true,
          stroke: true,
        },
      },
    ).setOrigin(0.5).setDepth(50).setScrollFactor(0)

    // Pulse the phase text for presence
    scene.tweens.add({
      targets: this.phaseText,
      alpha: { from: 0.7, to: 1 },
      duration: 1500,
      ease: 'Sine.easeInOut',
      yoyo: true,
      repeat: -1,
    })
  }

  get isDead(): boolean {
    return this.dead
  }

  get isDeathAnimating(): boolean {
    return this.deathAnimating
  }

  get activeShieldCount(): number {
    return this.shields.filter(s => s.alive).length
  }

  get isEnraged(): boolean {
    return this.state.enraged
  }

  get bossProjectiles(): BossProjectile[] {
    return this.orbitProjectiles
  }

  // ── Update Loop ─────────────────────────────────────────────────

  update(playerPos: Vec2, partnerPos: Vec2, now: number, elapsed: number): void {
    if (this.dead) return

    // Update phase based on HP ratio
    this.updatePhase(now)

    // Movement — chase nearest target
    const dPlayer = Phaser.Math.Distance.Between(this.sprite.x, this.sprite.y, playerPos.x, playerPos.y)
    const dPartner = Phaser.Math.Distance.Between(this.sprite.x, this.sprite.y, partnerPos.x, partnerPos.y)
    const targetPos = dPlayer <= dPartner ? playerPos : partnerPos
    const targetDist = Math.min(dPlayer, dPartner)

    const currentSpeed = this.state.enraged ? this.speed * 1.8 : this.speed

    if (targetDist > 50) {
      const angle = Math.atan2(targetPos.y - this.sprite.y, targetPos.x - this.sprite.x)
      this.sprite.setVelocity(
        Math.cos(angle) * currentSpeed,
        Math.sin(angle) * currentSpeed,
      )
    } else {
      this.sprite.setVelocity(0, 0)
    }

    // Update shields
    for (const shield of this.shields) {
      shield.update(this.sprite.x, this.sprite.y, elapsed)
    }

    // Phase-specific attacks
    this.executePhaseAttacks(now, elapsed)

    // Update orbit projectiles
    this.updateOrbitProjectiles(now)

    // Update UI
    this.healthBar.update(this.sprite.x, this.sprite.y - 20, this.hp, this.maxHp)
    this.updateShieldBar()

    // Update boss aura and shadow position
    this.bossAura.setPosition(this.sprite.x, this.sprite.y)
    this.bossShadow.setPosition(this.sprite.x, this.sprite.y + 14)

    // Boss trailing particles (dark energy wisps)
    this.trailTimer += 16 // ~60fps
    if (this.trailTimer > 120) {
      this.trailTimer = 0
      const trail = this.scene.add.circle(
        this.sprite.x + (Math.random() - 0.5) * 20,
        this.sprite.y + (Math.random() - 0.5) * 20,
        1 + Math.random() * 2,
        this.state.enraged ? 0xff0044 : BOSS_COLOR,
        0.5,
      ).setDepth(7).setBlendMode(Phaser.BlendModes.ADD)

      this.scene.tweens.add({
        targets: trail,
        alpha: 0,
        scale: 0.2,
        y: trail.y - 10 - Math.random() * 10,
        duration: 400 + Math.random() * 300,
        ease: 'Sine.easeOut',
        onComplete: () => trail.destroy(),
      })
    }

    // Visual pulse for enrage
    if (this.state.enraged) {
      const pulseAlpha = 0.7 + Math.sin(elapsed * 0.01) * 0.3
      this.sprite.setAlpha(pulseAlpha)
      // Intensify aura when enraged
      this.bossAura.setFillStyle(0xff0044, 0.15)
    }
  }

  // ── Phase Management ────────────────────────────────────────────

  private updatePhase(now: number): void {
    const hpRatio = this.hp / this.maxHp
    let newPhase: BossPhase = 1

    if (hpRatio <= BOSS_ENRAGE_THRESHOLD) {
      newPhase = 3
    } else if (hpRatio <= BOSS_SUMMON_THRESHOLD) {
      newPhase = 2
    }

    if (newPhase !== this.state.phase) {
      this.state.phase = newPhase
      this.callbacks.onPhaseChange(newPhase)

      // Phase transition VFX
      screenShake(this.scene, 8, 300)
      flashWhite(this.scene, 0.4, 200)

      // Update phase text with dramatic animation
      const phaseLabels: Record<BossPhase, string> = {
        1: 'BOSS — PHASE 1',
        2: 'BOSS — PHASE 2: SUMMONER',
        3: 'BOSS — PHASE 3: ENRAGED',
      }
      this.phaseText.setText(phaseLabels[newPhase])
      this.phaseText.setFontSize('20px')

      // Dramatic text entrance: scale up then settle
      this.phaseText.setScale(2)
      this.phaseText.setAlpha(1)
      this.scene.tweens.add({
        targets: this.phaseText,
        scaleX: 1,
        scaleY: 1,
        duration: 600,
        ease: 'Back.easeOut',
      })
      // Settle font size back after dramatic entrance
      this.scene.time.delayedCall(1500, () => {
        if (this.phaseText?.active) this.phaseText.setFontSize('16px')
      })

      if (newPhase === 3) {
        this.state.enraged = true
        this.damage = BOSS_DAMAGE * 2
        this.sprite.setTint(0xff0044)
        this.phaseText.setColor('#ff0044')
        this.phaseText.setShadow(0, 0, '#ff0044', 12, true, true)
      }
    }

    // Enrage periodic screen shakes
    if (this.state.enraged && now - this.state.lastShake > BOSS_ENRAGE_SHAKE_INTERVAL) {
      screenShake(this.scene, 4, 200)
      this.state.lastShake = now
    }
  }

  // ── Phase Attacks ───────────────────────────────────────────────

  private executePhaseAttacks(now: number, elapsed: number): void {
    // Phase 1+: Orbit attack — rotating projectile ring
    if (now - this.state.lastOrbit > BOSS_ORBIT_INTERVAL) {
      this.state.lastOrbit = now
      this.spawnOrbitRing(elapsed)
    }

    // Phase 2+: Summon minions
    if (this.state.phase >= 2 && now - this.state.lastSummon > BOSS_SUMMON_INTERVAL) {
      this.state.lastSummon = now
      const bossPos: Vec2 = { x: this.sprite.x, y: this.sprite.y }
      this.callbacks.onSpawnMinions(2, bossPos)

      // Summon VFX
      hitSparks(this.scene, this.sprite.x, this.sprite.y, 0xff2222, 8)
      screenShake(this.scene, 3, 150)
    }
  }

  private spawnOrbitRing(_elapsed: number): void {
    const count = this.state.enraged
      ? BOSS_ORBIT_PROJECTILE_COUNT + 4
      : BOSS_ORBIT_PROJECTILE_COUNT
    const speed = this.state.enraged ? PROJECTILE_SPEED * 0.7 : PROJECTILE_SPEED * 0.5
    const now = Date.now()

    for (let i = 0; i < count; i++) {
      const angle = (i / count) * Math.PI * 2
      const px = this.sprite.x + Math.cos(angle) * 20
      const py = this.sprite.y + Math.sin(angle) * 20

      const proj = this.scene.add.circle(px, py, 4, BOSS_COLOR, 0.9).setDepth(14)

      this.orbitProjectiles.push({
        sprite: proj,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        damage: this.state.enraged ? BOSS_DAMAGE : Math.floor(BOSS_DAMAGE * 0.6),
        owner: 'boss',
        born: now,
        lifetime: 2000,
      })
    }

    // Spawn VFX
    hitSparks(this.scene, this.sprite.x, this.sprite.y, BOSS_COLOR, 6)
  }

  private updateOrbitProjectiles(now: number): void {
    for (const proj of this.orbitProjectiles) {
      if (!proj.sprite?.active) continue
      proj.sprite.x += proj.vx * (1 / 60)
      proj.sprite.y += proj.vy * (1 / 60)

      // Expire
      if (now - proj.born > proj.lifetime) {
        proj.sprite.destroy()
      }
    }
    this.orbitProjectiles = this.orbitProjectiles.filter(p => p.sprite?.active)
  }

  // ── Damage Handling ─────────────────────────────────────────────

  /** Returns true if damage was applied to boss core */
  takeDamage(amount: number, now: number): boolean {
    if (this.dead || now < this.invincibleUntil) return false

    // Check if shields are up — damage goes to nearest shield
    const aliveShields = this.shields.filter(s => s.alive)
    if (aliveShields.length > 0) {
      // Hit the shield
      const shield = aliveShields[0]
      const destroyed = shield.takeDamage(amount, this.scene)
      if (destroyed) {
        this.state.shieldSegments--
        screenShake(this.scene, 5, 150)
      }
      damageNumber(this.scene, shield.graphic?.x ?? this.sprite.x, shield.graphic?.y ?? this.sprite.y, amount, '#aa66ff')
      return false
    }

    // No shields — damage the core
    this.hp -= amount
    this.invincibleUntil = now + INVINCIBILITY_MS * 0.5

    hitSparks(this.scene, this.sprite.x, this.sprite.y, BOSS_COLOR, 6)
    damageNumber(this.scene, this.sprite.x, this.sprite.y, amount, '#ff44ff')
    hitstop(this.scene, 50)
    screenShake(this.scene, 4, 100)

    // Flash
    this.sprite.setAlpha(0.3)
    this.scene.time.delayedCall(80, () => {
      if (this.sprite?.active && !this.state.enraged) this.sprite.setAlpha(1)
    })

    if (this.hp <= 0) {
      this.die()
    }

    return true
  }

  // ── Contact Damage ──────────────────────────────────────────────

  getContactDamage(): number {
    return this.damage
  }

  getContactRange(): number {
    return 40
  }

  // ── Death ───────────────────────────────────────────────────────

  private die(): void {
    this.dead = true
    this.deathAnimating = true

    // Clean up shields
    for (const shield of this.shields) {
      shield.destroy()
    }

    // Clean up orbit projectiles
    for (const proj of this.orbitProjectiles) {
      if (proj.sprite?.active) proj.sprite.destroy()
    }
    this.orbitProjectiles = []

    const bossX = this.sprite.x
    const bossY = this.sprite.y

    // ── Slow-mo ──
    this.scene.time.timeScale = 0.15

    // ── Screen flash ──
    flashWhite(this.scene, 0.6, 600)

    // ── Big explosion sequence ──
    // Staggered explosions
    const explosionCount = 8
    for (let i = 0; i < explosionCount; i++) {
      this.scene.time.delayedCall(i * 120, () => {
        const offX = (Math.random() - 0.5) * 60
        const offY = (Math.random() - 0.5) * 60
        deathExplosion(this.scene, bossX + offX, bossY + offY, BOSS_COLOR, 18)
        hitSparks(this.scene, bossX + offX, bossY + offY, 0xffffff, 8)
      })
    }

    // ── Final massive explosion ──
    this.scene.time.delayedCall(explosionCount * 120 + 100, () => {
      deathExplosion(this.scene, bossX, bossY, 0xffffff, 40)
      flashWhite(this.scene, 0.8, 400)
      screenShake(this.scene, 12, 500)
    })

    // ── Restore time and trigger victory ──
    this.scene.time.delayedCall(explosionCount * 120 + 600, () => {
      this.scene.tweens.add({
        targets: this.scene.time,
        timeScale: 1,
        duration: 400,
        ease: 'Cubic.easeIn',
      })
    })

    this.scene.time.delayedCall(explosionCount * 120 + 1200, () => {
      this.deathAnimating = false
      this.callbacks.onBossDeath({ x: bossX, y: bossY })
    })

    // Hide sprite and clean up aura/shadow
    this.sprite.setActive(false).setVisible(false)
    if (this.sprite.body) this.sprite.body.enable = false
    this.healthBar.destroy()
    this.shieldBarGraphics.destroy()
    this.bossAura.destroy()
    this.bossShadow.destroy()
  }

  // ── Shield Bar UI ───────────────────────────────────────────────

  private updateShieldBar(): void {
    this.shieldBarGraphics.clear()

    const alive = this.shields.filter(s => s.alive).length
    if (alive === 0) return

    const barWidth = 120
    const barHeight = 6
    const x = this.scene.cameras.main.width / 2 - barWidth / 2
    const y = 50

    // Background
    this.shieldBarGraphics.fillStyle(0x222222, 0.8)
    this.shieldBarGraphics.fillRect(x, y, barWidth, barHeight)

    // Shield fill
    const ratio = alive / this.state.maxShieldSegments
    this.shieldBarGraphics.fillStyle(0x8844ff, 0.9)
    this.shieldBarGraphics.fillRect(x, y, barWidth * ratio, barHeight)

    // Segment dividers
    for (let i = 1; i < this.state.maxShieldSegments; i++) {
      const sx = x + (barWidth / this.state.maxShieldSegments) * i
      this.shieldBarGraphics.fillStyle(0x000000, 1)
      this.shieldBarGraphics.fillRect(sx - 1, y, 2, barHeight)
    }
  }

  // ── Cleanup ─────────────────────────────────────────────────────

  destroy(): void {
    for (const shield of this.shields) shield.destroy()
    for (const proj of this.orbitProjectiles) {
      if (proj.sprite?.active) proj.sprite.destroy()
    }
    if (this.sprite?.active) this.sprite.destroy()
    this.healthBar.destroy()
    this.shieldBarGraphics.destroy()
    this.phaseText.destroy()
    if (this.bossAura?.active) this.bossAura.destroy()
    if (this.bossShadow?.active) this.bossShadow.destroy()
  }
}
