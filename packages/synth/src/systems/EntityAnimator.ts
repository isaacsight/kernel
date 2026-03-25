// SYNTH — Entity Animator
// Design Bible §IV + §V: "Nothing is static."
// Every entity gets automatic idle animations:
//   1. Idle bob — gentle vertical oscillation
//   2. Breathing pulse — scale oscillation
//   3. Glow pulse — alpha oscillation on a child glow sprite
//   4. State-based visual changes — tint, scale, speed adjustments

import Phaser from 'phaser'

export interface EntityAnimatorOptions {
  /** Pixels of vertical bob (default 2) */
  bobAmount?: number
  /** Milliseconds per bob cycle (default 800) */
  bobSpeed?: number
  /** Scale delta for breathing effect (default 0.04) */
  breatheAmount?: number
  /** Milliseconds per breathe cycle (default 600) */
  breatheSpeed?: number
  /** Glow color (default: white) */
  glowColor?: number
  /** Glow radius in pixels (default 8) */
  glowRadius?: number
}

type AnimState = 'idle' | 'alert' | 'attacking' | 'hurt' | 'dead'

export class EntityAnimator {
  private scene: Phaser.Scene
  private sprite: Phaser.Physics.Arcade.Sprite
  private glow: Phaser.GameObjects.Arc

  // Config
  private bobAmount: number
  private bobSpeed: number
  private breatheAmount: number
  private breatheSpeed: number

  // Runtime accumulators (ms)
  private bobTimer = 0
  private breatheTimer = 0
  private glowTimer = 0

  // Baseline captured at construction
  private baseY: number
  private baseScaleX: number
  private baseScaleY: number
  private baseGlowAlpha = 0.25

  // State
  private animState: AnimState = 'idle'
  private hurtFlashRemaining = 0
  private shakeRemaining = 0
  private shakeIntensity = 2
  private dissolveProgress = -1 // -1 = not dissolving

  // Speed multipliers applied per-state
  private speedMultiplier = 1
  private glowIntensityMultiplier = 1

  private destroyed = false

  constructor(
    scene: Phaser.Scene,
    sprite: Phaser.Physics.Arcade.Sprite,
    options?: EntityAnimatorOptions,
  ) {
    this.scene = scene
    this.sprite = sprite

    this.bobAmount = options?.bobAmount ?? 2
    this.bobSpeed = options?.bobSpeed ?? 800
    this.breatheAmount = options?.breatheAmount ?? 0.04
    this.breatheSpeed = options?.breatheSpeed ?? 600

    const glowColor = options?.glowColor ?? 0xffffff
    const glowRadius = options?.glowRadius ?? 8

    this.baseY = sprite.y
    this.baseScaleX = sprite.scaleX
    this.baseScaleY = sprite.scaleY

    // Phase-randomize so entities don't pulse in unison
    this.bobTimer = Math.random() * this.bobSpeed
    this.breatheTimer = Math.random() * this.breatheSpeed
    this.glowTimer = Math.random() * 1000

    // Create glow child — soft circle behind the sprite
    this.glow = scene.add.circle(sprite.x, sprite.y, glowRadius, glowColor, this.baseGlowAlpha)
    this.glow.setDepth(sprite.depth - 1)
    this.glow.setBlendMode(Phaser.BlendModes.ADD)
  }

  // ── Per-frame Update ────────────────────────────────────────────────

  update(dt: number): void {
    if (this.destroyed) return
    if (!this.sprite?.active) return

    // Dissolve overrides everything
    if (this.dissolveProgress >= 0) {
      this.updateDissolve(dt)
      return
    }

    // Hurt flash countdown
    if (this.hurtFlashRemaining > 0) {
      this.hurtFlashRemaining -= dt
      // Red/white flicker
      const flicker = Math.floor(this.hurtFlashRemaining / 50) % 2 === 0
      this.sprite.setTint(flicker ? 0xff2222 : 0xffffff)
      if (this.hurtFlashRemaining <= 0) {
        this.sprite.clearTint()
        if (this.animState === 'hurt') {
          this.animState = 'idle'
          this.resetVisuals()
        }
      }
    }

    // Shake countdown
    if (this.shakeRemaining > 0) {
      this.shakeRemaining -= dt
      const ox = (Math.random() - 0.5) * this.shakeIntensity * 2
      const oy = (Math.random() - 0.5) * this.shakeIntensity * 2
      this.sprite.x += ox
      this.sprite.y += oy
    }

    // 1. Bob — vertical oscillation
    this.bobTimer += dt * this.speedMultiplier
    const bobOffset = Math.sin((this.bobTimer / this.bobSpeed) * Math.PI * 2) * this.bobAmount
    // We offset relative to the sprite's current physics position by adjusting
    // the display origin. Since physics owns the position, we use setY only
    // for the visual offset via a body offset trick — but the simplest safe
    // approach is storing the bob as a render offset via the sprite's own y.
    // However, physics also writes to y each frame. So we apply the bob
    // *after* physics by directly adjusting the display body offset.
    // In practice, the cleanest Phaser 3 pattern is to not fight the physics
    // body and instead adjust the sprite's body offset. We'll use the sprite's
    // built-in body offset for the visual bob.
    if (this.sprite.body) {
      (this.sprite.body as Phaser.Physics.Arcade.Body).offset.y = -bobOffset
    }

    // 2. Breathe — scale oscillation
    this.breatheTimer += dt * this.speedMultiplier
    const breathePhase = Math.sin((this.breatheTimer / this.breatheSpeed) * Math.PI * 2)
    const sxDelta = breathePhase * this.breatheAmount
    const syDelta = -breathePhase * this.breatheAmount // inverse for squash
    this.sprite.setScale(
      this.baseScaleX + sxDelta,
      this.baseScaleY + syDelta,
    )

    // 3. Glow pulse
    this.glowTimer += dt
    const glowPhase = Math.sin((this.glowTimer / 1200) * Math.PI * 2)
    const glowAlpha = (this.baseGlowAlpha + glowPhase * 0.1) * this.glowIntensityMultiplier
    this.glow.setAlpha(Phaser.Math.Clamp(glowAlpha, 0, 1))
    this.glow.setPosition(this.sprite.x, this.sprite.y)
  }

  // ── State Changes ───────────────────────────────────────────────────

  /** Enemy is alert — faster bob, brighter glow. */
  setAlert(): void {
    if (this.animState === 'dead') return
    this.animState = 'alert'
    this.speedMultiplier = 1.8
    this.glowIntensityMultiplier = 1.6
  }

  /** Entity is attacking — squash sprite, flash white. */
  setAttacking(): void {
    if (this.animState === 'dead') return
    this.animState = 'attacking'
    this.speedMultiplier = 2.5

    // Squash effect
    this.sprite.setScale(this.baseScaleX * 1.15, this.baseScaleY * 0.85)

    // Brief white flash
    this.sprite.setTint(0xffffff)
    this.scene.time.delayedCall(60, () => {
      if (this.sprite?.active && this.animState === 'attacking') {
        this.sprite.clearTint()
      }
    })
  }

  /** Entity took damage — red flash + shake. */
  setHurt(): void {
    if (this.animState === 'dead') return
    this.animState = 'hurt'
    this.hurtFlashRemaining = 300
    this.shakeRemaining = 200
    this.shakeIntensity = 2
  }

  /** Entity died — stop all animations, begin dissolve. */
  setDead(): void {
    this.animState = 'dead'
    this.speedMultiplier = 0
    this.dissolveProgress = 0
    this.hurtFlashRemaining = 0
    this.shakeRemaining = 0
  }

  /** Return to calm idle defaults. */
  setIdle(): void {
    if (this.animState === 'dead') return
    this.animState = 'idle'
    this.resetVisuals()
  }

  // ── Internals ───────────────────────────────────────────────────────

  private resetVisuals(): void {
    this.speedMultiplier = 1
    this.glowIntensityMultiplier = 1
    this.sprite.clearTint()
    this.sprite.setScale(this.baseScaleX, this.baseScaleY)
  }

  private updateDissolve(dt: number): void {
    const dissolveDurationMs = 600
    this.dissolveProgress += dt / dissolveDurationMs

    if (this.dissolveProgress >= 1) {
      this.sprite.setAlpha(0)
      this.glow.setAlpha(0)
      return
    }

    // Fade out sprite + glow
    const alpha = 1 - this.dissolveProgress
    this.sprite.setAlpha(alpha)
    this.glow.setAlpha(alpha * this.baseGlowAlpha)

    // Shrink slightly
    const shrink = 1 - this.dissolveProgress * 0.4
    this.sprite.setScale(this.baseScaleX * shrink, this.baseScaleY * shrink)
  }

  destroy(): void {
    if (this.destroyed) return
    this.destroyed = true
    if (this.glow?.active) this.glow.destroy()
  }
}
