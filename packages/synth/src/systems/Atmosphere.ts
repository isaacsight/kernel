// SYNTH — Atmosphere System (Diablo + Indie Art)
// The AI partner's emotional state changes the visual atmosphere.
// Color as Emotion: Calm = HLD blue-purple, Aggressive = Transistor amber,
// Afraid = desaturated cold, Desperate = neon-on-black, Confident = warm gold.
// The world BREATHES with the AI's emotional state.

import Phaser from 'phaser'

export type Mood = 'calm' | 'aggressive' | 'afraid' | 'confident' | 'desperate'

interface MoodPalette {
  ambient: number       // ambient light color
  ambientAlpha: number  // overlay intensity
  bgTint: number        // background tint
  particleColor: number // floating particle color
  vignetteIntensity: number
  saturation: number    // 0-1 (via pipeline if available)
  lightRadiusMod: number // multiplier for player light radius
  warmth: number         // 0-1 how warm the torchlight looks
  // Indie palette additions
  accentColor: number   // secondary highlight color
  voidDarkness: number  // 0-1 how dark the outer void is (1 = true black)
  particleNearPlayer: number  // warm dust motes near player
  particleNearEnemy: number   // cold sharp particles near enemies
  particleEmpty: number       // ghostly wisps in empty space
}

// ── Latent Dissolution Palettes ──────────────────────────────────────
// The game exists in latent space. Moods shift the noise and coherence.
// Calm: deep blue-purple void with cyan dissolution highlights
// Aggressive: warm red-orange bleeding through the noise
// Afraid: desaturated, dissolution accelerates (reality losing coherence)
// Confident: colors saturate, edges slightly more solid
// Desperate: maximum dissolution, neon edges bleeding everywhere

const PALETTES: Record<Mood, MoodPalette> = {
  calm: {
    ambient: 0x0a0820,         // deep blue-purple latent void
    ambientAlpha: 0.06,
    bgTint: 0x050510,          // near-black, the void of latent space
    particleColor: 0x4488cc,   // cyan dissolution highlights
    vignetteIntensity: 0.10,
    saturation: 0.65,
    lightRadiusMod: 1.0,
    warmth: 0.3,
    accentColor: 0x6655aa,     // soft purple noise
    voidDarkness: 0.6,
    particleNearPlayer: 0x4466aa,
    particleNearEnemy: 0x334455,
    particleEmpty: 0x1a1a33,
  },
  aggressive: {
    ambient: 0x200808,         // warm red bleeding through noise
    ambientAlpha: 0.08,
    bgTint: 0x0a0404,          // deep warm void
    particleColor: 0xff5533,   // hot red-orange dissolving
    vignetteIntensity: 0.08,
    saturation: 0.85,
    lightRadiusMod: 1.15,
    warmth: 0.85,
    accentColor: 0xff8822,     // bright amber noise
    voidDarkness: 0.55,
    particleNearPlayer: 0xffaa44,
    particleNearEnemy: 0xff2200,
    particleEmpty: 0x331100,
  },
  afraid: {
    ambient: 0x040408,         // desaturated — coherence failing
    ambientAlpha: 0.14,
    bgTint: 0x020206,          // almost black — noise overtaking signal
    particleColor: 0x334455,   // cold static
    vignetteIntensity: 0.18,
    saturation: 0.25,          // desaturated — the dissolution accelerates
    lightRadiusMod: 0.8,
    warmth: 0.05,
    accentColor: 0x445566,
    voidDarkness: 0.75,
    particleNearPlayer: 0x334455,
    particleNearEnemy: 0x1a2233,
    particleEmpty: 0x0a0a1a,
  },
  confident: {
    ambient: 0x0c0a18,         // richer purple — more signal, less noise
    ambientAlpha: 0.04,
    bgTint: 0x080614,          // warmer void
    particleColor: 0x66aadd,   // brighter dissolution highlights
    vignetteIntensity: 0.06,
    saturation: 0.8,           // saturated — edges slightly more solid
    lightRadiusMod: 1.3,
    warmth: 0.6,
    accentColor: 0x8877cc,     // rich purple
    voidDarkness: 0.4,
    particleNearPlayer: 0x6688bb,
    particleNearEnemy: 0x556677,
    particleEmpty: 0x2a2a44,
  },
  desperate: {
    ambient: 0x0a0004,         // maximum dissolution — neon on black
    ambientAlpha: 0.1,
    bgTint: 0x020002,          // pure void
    particleColor: 0xff0066,   // neon bleeding
    vignetteIntensity: 0.18,
    saturation: 1.0,           // maximum saturation — neon edges
    lightRadiusMod: 0.85,
    warmth: 0.2,
    accentColor: 0x00ffaa,     // neon green noise — clashing with red
    voidDarkness: 0.8,
    particleNearPlayer: 0xff4488,
    particleNearEnemy: 0xff0033,
    particleEmpty: 0x1a000a,
  },
}

// ── Light Radius (Diablo-style fog of war) ──────────────────────────

const BASE_LIGHT_RADIUS = 280        // px radius of player torch (generous — game must be PLAYABLE)
const FLICKER_SPEED = 3              // Hz (flicker cycles per second)
const FLICKER_SIZE_AMOUNT = 0.05     // +/- 5% size variance
const FLICKER_ALPHA_AMOUNT = 0.10    // +/- 10% alpha variance
const MOOD_LERP_SPEED = 0.0004       // palette color lerp speed per ms (~2.5s full transition)

// ── Wall Torch Lights ───────────────────────────────────────────────

interface WallTorch {
  glow: Phaser.GameObjects.Arc
  tween: Phaser.Tweens.Tween
  baseX: number
  baseY: number
}

// ── Dust Motes ──────────────────────────────────────────────────────

interface DustMote {
  sprite: Phaser.GameObjects.Arc
  tween: Phaser.Tweens.Tween
}

// ── Ground Fog ──────────────────────────────────────────────────────

interface FogLayer {
  rect: Phaser.GameObjects.Rectangle
  tween: Phaser.Tweens.Tween
}

// ── Embers ──────────────────────────────────────────────────────────

interface Ember {
  sprite: Phaser.GameObjects.Arc
  tween: Phaser.Tweens.Tween
}

// ── Poetic Particles (purpose-driven, not random noise) ─────────────

interface PoetParticle {
  sprite: Phaser.GameObjects.Arc
  type: 'warm_dust' | 'cold_shard' | 'ghostly_wisp' | 'ai_data'
  baseX: number
  baseY: number
  lifetime: number
  age: number
  speed: number
  angle: number
}

// ── Color lerp utilities ────────────────────────────────────────────

function lerpColor(from: number, to: number, t: number): number {
  const fr = (from >> 16) & 0xff
  const fg = (from >> 8) & 0xff
  const fb = from & 0xff
  const tr = (to >> 16) & 0xff
  const tg = (to >> 8) & 0xff
  const tb = to & 0xff
  const r = Math.round(fr + (tr - fr) * t)
  const g = Math.round(fg + (tg - fg) * t)
  const b = Math.round(fb + (tb - fb) * t)
  return (r << 16) | (g << 8) | b
}

function lerpNum(from: number, to: number, t: number): number {
  return from + (to - from) * t
}

// Simple hash-based noise for organic light edge
function hashNoise(x: number, y: number, seed: number): number {
  let h = (Math.floor(x * 100) * 374761393 + Math.floor(y * 100) * 668265263 + Math.floor(seed * 1000)) | 0
  h = (h ^ (h >> 13)) * 1274126177
  h = h ^ (h >> 16)
  return (Math.abs(h) % 1000) / 1000
}

export class Atmosphere {
  private scene: Phaser.Scene
  private overlay: Phaser.GameObjects.Rectangle
  private currentMood: Mood = 'calm'
  private targetPalette: MoodPalette
  private currentPalette: MoodPalette  // lerped current state
  private particles: Phaser.GameObjects.Arc[] = []

  // Diablo-style light radius
  private lightMask!: Phaser.GameObjects.Graphics
  private lightRadius: number = BASE_LIGHT_RADIUS
  private flickerTime = 0

  // Wall torches
  private torches: WallTorch[] = []

  // Dust motes
  private dustMotes: DustMote[] = []

  // Ground fog
  private fogLayers: FogLayer[] = []

  // Embers
  private embers: Ember[] = []

  // Poetic particles (purposeful ambient)
  private poetParticles: PoetParticle[] = []

  // Track player/partner/enemy positions for particle poetry
  private playerX = 0
  private playerY = 0
  private partnerX = 0
  private partnerY = 0
  private partnerColor = 0x44ff88
  private enemyPositions: Array<{ x: number; y: number }> = []
  private brainThinking = false

  // Data-stream particles on partner (AI thinking visualization)
  private dataStreamParticles: Array<{ sprite: Phaser.GameObjects.Text; age: number; lifetime: number }> = []

  // Neural network flash lines
  private neuralLines: Phaser.GameObjects.Graphics | null = null
  private neuralLineTimer = 0

  constructor(scene: Phaser.Scene) {
    this.scene = scene
    this.targetPalette = { ...PALETTES.calm }
    this.currentPalette = { ...PALETTES.calm }

    const w = scene.cameras.main.width
    const h = scene.cameras.main.height

    // Full-screen mood overlay
    this.overlay = scene.add.rectangle(w / 2, h / 2, w, h, PALETTES.calm.ambient, PALETTES.calm.ambientAlpha)
      .setDepth(80)
      .setScrollFactor(0)
      .setBlendMode(Phaser.BlendModes.NORMAL)

    // Light radius darkness overlay (drawn each frame)
    this.lightMask = scene.add.graphics()
      .setDepth(75)
      .setScrollFactor(0)

    // Neural network lines layer
    this.neuralLines = scene.add.graphics()
      .setDepth(74)
      .setScrollFactor(0)

    // Spawn ambient mood particles (warm dust)
    this.spawnParticles(PALETTES.calm.particleColor)

    // Spawn dust motes in the light radius
    this.spawnDustMotes()

    // DISABLED: ground fog was reducing visibility
    // this.spawnGroundFog()

    // Spawn initial poetic particles
    this.spawnPoetParticles()

    // Register per-frame update
    scene.events.on('update', this.tick, this)
  }

  /** Update player position for light radius centering */
  setPlayerPosition(x: number, y: number): void {
    this.playerX = x
    this.playerY = y
  }

  /** Update partner position for data-stream particles */
  setPartnerPosition(x: number, y: number): void {
    this.partnerX = x
    this.partnerY = y
  }

  /** Set partner color for data particles */
  setPartnerColor(color: number): void {
    this.partnerColor = color
  }

  /** Update enemy positions for cold particle placement */
  setEnemyPositions(positions: Array<{ x: number; y: number }>): void {
    this.enemyPositions = positions
  }

  /** Signal brain is thinking (spawns data-stream particles on partner) */
  setBrainThinking(thinking: boolean): void {
    this.brainThinking = thinking
  }

  /** Flash neural network lines between partner and target */
  flashNeuralLines(targetX: number, targetY: number): void {
    this.neuralLineTimer = 400  // flash for 400ms
    if (!this.neuralLines) return

    const cam = this.scene.cameras.main
    const sx = this.partnerX - cam.scrollX
    const sy = this.partnerY - cam.scrollY
    const tx = targetX - cam.scrollX
    const ty = targetY - cam.scrollY

    this.neuralLines.clear()
    this.neuralLines.lineStyle(1, this.currentPalette.accentColor, 0.6)

    // Main line
    this.neuralLines.lineBetween(sx, sy, tx, ty)

    // Decision graph branches: 3-4 intermediate nodes
    const midX = (sx + tx) / 2
    const midY = (sy + ty) / 2
    const branchCount = 3 + Math.floor(Math.random() * 2)
    for (let i = 0; i < branchCount; i++) {
      const bx = midX + (Math.random() - 0.5) * 60
      const by = midY + (Math.random() - 0.5) * 40
      this.neuralLines.lineStyle(0.5, this.currentPalette.accentColor, 0.3)
      this.neuralLines.lineBetween(sx, sy, bx, by)
      this.neuralLines.lineBetween(bx, by, tx, ty)
      // Node dot
      this.neuralLines.fillStyle(this.currentPalette.accentColor, 0.5)
      this.neuralLines.fillCircle(bx, by, 2)
    }
  }

  /** Spawn wall torches at given world positions */
  spawnWallTorches(positions: Array<{ x: number; y: number }>): void {
    for (const pos of positions) {
      const glow = this.scene.add.circle(pos.x, pos.y, 24, 0xff9933, 0.15)
        .setDepth(3)
        .setBlendMode(Phaser.BlendModes.ADD)

      const tween = this.scene.tweens.add({
        targets: glow,
        alpha: { from: 0.08, to: 0.2 },
        scale: { from: 0.9, to: 1.15 },
        duration: 300 + Math.random() * 200,
        ease: 'Sine.easeInOut',
        yoyo: true,
        repeat: -1,
      })

      this.torches.push({ glow, tween, baseX: pos.x, baseY: pos.y })
    }
  }

  setMood(mood: Mood): void {
    if (mood === this.currentMood) return
    this.currentMood = mood
    this.targetPalette = { ...PALETTES[mood] }

    // NO instant jumps — everything lerps smoothly in tick()
    // Re-spawn mood particles with new target color (they'll fade in naturally)
    this.clearParticles()
    this.spawnParticles(this.targetPalette.particleColor)
  }

  /** Derive mood from game state */
  deriveMood(partnerHpRatio: number, enemyCount: number, playerHpRatio: number): Mood {
    if (playerHpRatio < 0.2 || partnerHpRatio < 0.2) return 'desperate'
    if (partnerHpRatio < 0.4 && enemyCount > 3) return 'afraid'
    if (enemyCount === 0) return 'confident'
    if (enemyCount <= 2 && partnerHpRatio > 0.6) return 'aggressive'
    return 'calm'
  }

  update(partnerHpRatio: number, enemyCount: number, playerHpRatio: number): void {
    const newMood = this.deriveMood(partnerHpRatio, enemyCount, playerHpRatio)
    this.setMood(newMood)
  }

  getMood(): Mood { return this.currentMood }

  /** Get the current effective light radius (for use by other systems) */
  getLightRadius(): number {
    return this.lightRadius * this.currentPalette.lightRadiusMod
  }

  // ── Per-frame tick (smooth palette lerp, light radius flicker, darkness mask) ──

  private tick(_time: number, dt: number): void {
    this.flickerTime += dt * 0.001

    // ── Smooth palette lerp (2-3 second transitions) ──
    const t = Math.min(1, dt * MOOD_LERP_SPEED)
    this.currentPalette.ambient = lerpColor(this.currentPalette.ambient, this.targetPalette.ambient, t)
    this.currentPalette.ambientAlpha = lerpNum(this.currentPalette.ambientAlpha, this.targetPalette.ambientAlpha, t)
    this.currentPalette.bgTint = lerpColor(this.currentPalette.bgTint, this.targetPalette.bgTint, t)
    this.currentPalette.vignetteIntensity = lerpNum(this.currentPalette.vignetteIntensity, this.targetPalette.vignetteIntensity, t)
    this.currentPalette.lightRadiusMod = lerpNum(this.currentPalette.lightRadiusMod, this.targetPalette.lightRadiusMod, t)
    this.currentPalette.warmth = lerpNum(this.currentPalette.warmth, this.targetPalette.warmth, t)
    this.currentPalette.voidDarkness = lerpNum(this.currentPalette.voidDarkness, this.targetPalette.voidDarkness, t)
    this.currentPalette.accentColor = lerpColor(this.currentPalette.accentColor, this.targetPalette.accentColor, t)

    // Update overlay with lerped values
    this.overlay.setFillStyle(this.currentPalette.ambient, this.currentPalette.ambientAlpha)

    // Camera background — lerp toward target
    this.scene.cameras.main.setBackgroundColor(this.currentPalette.bgTint)

    // Torchlight flicker: oscillate radius and alpha at ~3Hz
    const flickerPhase = this.flickerTime * FLICKER_SPEED * Math.PI * 2
    const sizeFlicker = 1 + Math.sin(flickerPhase) * FLICKER_SIZE_AMOUNT
    const alphaFlicker = 1 + Math.cos(flickerPhase * 1.3) * FLICKER_ALPHA_AMOUNT

    const effectiveRadius = BASE_LIGHT_RADIUS * this.currentPalette.lightRadiusMod * sizeFlicker
    this.lightRadius = effectiveRadius

    // DISABLED: darkness mask was making the game unplayable
    // this.drawDarknessMask(effectiveRadius, alphaFlicker)

    // Update poetic particles (purpose-driven ambient)
    this.updatePoetParticles(dt)

    // Data-stream particles on partner (AI thinking)
    if (this.brainThinking) {
      this.spawnDataStreamParticle()
    }
    this.updateDataStreamParticles(dt)

    // Neural network line fadeout
    if (this.neuralLineTimer > 0) {
      this.neuralLineTimer -= dt
      if (this.neuralLineTimer <= 0 && this.neuralLines) {
        this.neuralLines.clear()
      } else if (this.neuralLines) {
        // Fade alpha
        this.neuralLines.setAlpha(Math.max(0, this.neuralLineTimer / 400))
      }
    }
  }

  private drawDarknessMask(radius: number, alphaFlicker: number): void {
    const g = this.lightMask
    g.clear()

    const cam = this.scene.cameras.main
    const w = cam.width
    const h = cam.height

    // Player position in screen space
    const screenX = this.playerX - cam.scrollX
    const screenY = this.playerY - cam.scrollY

    // Draw concentric rings of darkness, denser further from player
    // Organic/noisy edge: perturb radius per angle using noise
    const steps = 14
    const maxDist = Math.max(w, h)
    const voidAlpha = this.currentPalette.voidDarkness  // true black in desperate/afraid

    for (let i = steps; i >= 0; i--) {
      const ratio = i / steps
      const ringRadius = radius + (maxDist - radius) * ratio

      let alpha: number
      if (ringRadius <= radius) {
        alpha = 0
      } else {
        const distBeyondLight = (ringRadius - radius) / (maxDist - radius)
        // Linear falloff, not quadratic — keep the dungeon VISIBLE
        alpha = distBeyondLight * voidAlpha * 0.5 * alphaFlicker
      }

      if (i === steps || ringRadius > radius * 1.5) {
        // Outer rings: simple circle fill
        g.fillStyle(0x000000, Math.min(alpha, 0.35))
        g.fillCircle(screenX, screenY, ringRadius)
      } else if (ringRadius > radius) {
        // Near the light edge: organic/noisy perimeter
        g.fillStyle(0x000000, Math.min(alpha, 0.35))
        g.beginPath()
        const segments = 32
        for (let s = 0; s <= segments; s++) {
          const angle = (s / segments) * Math.PI * 2
          // Noise perturbation: organic wobble at the light boundary
          const noiseVal = hashNoise(
            Math.cos(angle) * 0.5,
            Math.sin(angle) * 0.5,
            this.flickerTime * 0.3 + i * 0.1,
          )
          const perturbation = 1 + (noiseVal - 0.5) * 0.15  // +/- 7.5% radius wobble
          const r = ringRadius * perturbation
          const px = screenX + Math.cos(angle) * r
          const py = screenY + Math.sin(angle) * r
          if (s === 0) {
            g.moveTo(px, py)
          } else {
            g.lineTo(px, py)
          }
        }
        g.closePath()
        g.fillPath()
      }
    }

    // Outer full darkness: fill everything beyond the gradient (capped at 0.4)
    g.fillStyle(0x000000, Math.min(voidAlpha * 0.5 * alphaFlicker, 0.4))
    g.fillRect(0, 0, w, Math.max(0, screenY - maxDist))
    g.fillRect(0, screenY + maxDist, w, h)
    g.fillRect(0, 0, Math.max(0, screenX - maxDist), h)
    g.fillRect(screenX + maxDist, 0, w, h)
  }

  // ── Poetic Particles ─────────────────────────────────────────────

  private spawnPoetParticles(): void {
    // Near player: warm dust motes (8)
    for (let i = 0; i < 8; i++) {
      this.poetParticles.push(this.createPoetParticle('warm_dust'))
    }
    // Near enemies: cold shards (6)
    for (let i = 0; i < 6; i++) {
      this.poetParticles.push(this.createPoetParticle('cold_shard'))
    }
    // Empty space: ghostly wisps (10)
    for (let i = 0; i < 10; i++) {
      this.poetParticles.push(this.createPoetParticle('ghostly_wisp'))
    }
  }

  private createPoetParticle(type: PoetParticle['type']): PoetParticle {
    const cam = this.scene.cameras.main
    const w = cam.width
    const h = cam.height

    let color: number
    let speed: number
    let lifetime: number
    let size: number

    switch (type) {
      case 'warm_dust':
        color = this.currentPalette.particleNearPlayer
        speed = 4 + Math.random() * 6  // slow drift
        lifetime = 4000 + Math.random() * 3000
        size = 0.4 + Math.random() * 0.8
        break
      case 'cold_shard':
        color = this.currentPalette.particleNearEnemy
        speed = 15 + Math.random() * 25  // erratic dart
        lifetime = 1500 + Math.random() * 1500
        size = 0.3 + Math.random() * 0.5
        break
      case 'ghostly_wisp':
        color = this.currentPalette.particleEmpty
        speed = 2 + Math.random() * 4  // very slow
        lifetime = 5000 + Math.random() * 5000
        size = 0.5 + Math.random() * 1.2
        break
      case 'ai_data':
        color = this.partnerColor
        speed = 12 + Math.random() * 8
        lifetime = 1200 + Math.random() * 800
        size = 0.4 + Math.random() * 0.6
        break
    }

    const x = Math.random() * w
    const y = Math.random() * h
    const sprite = this.scene.add.circle(x, y, size, color, 0.03 + Math.random() * 0.08)
      .setDepth(2)
      .setScrollFactor(0.3)
      .setBlendMode(Phaser.BlendModes.ADD)

    return {
      sprite,
      type,
      baseX: x,
      baseY: y,
      lifetime,
      age: Math.random() * lifetime,  // stagger initial ages
      speed,
      angle: Math.random() * Math.PI * 2,
    }
  }

  private updatePoetParticles(dt: number): void {
    const cam = this.scene.cameras.main

    for (const p of this.poetParticles) {
      p.age += dt

      // Respawn when expired
      if (p.age >= p.lifetime) {
        p.age = 0
        // Reposition based on type
        switch (p.type) {
          case 'warm_dust': {
            // Near the player
            const ox = (Math.random() - 0.5) * 80
            const oy = (Math.random() - 0.5) * 80
            p.baseX = (this.playerX - cam.scrollX) + ox
            p.baseY = (this.playerY - cam.scrollY) + oy
            p.sprite.setFillStyle(this.currentPalette.particleNearPlayer, 0.06)
            break
          }
          case 'cold_shard': {
            // Near random enemy
            if (this.enemyPositions.length > 0) {
              const enemy = this.enemyPositions[Math.floor(Math.random() * this.enemyPositions.length)]
              p.baseX = (enemy.x - cam.scrollX) + (Math.random() - 0.5) * 40
              p.baseY = (enemy.y - cam.scrollY) + (Math.random() - 0.5) * 40
            } else {
              p.baseX = Math.random() * cam.width
              p.baseY = Math.random() * cam.height
            }
            p.sprite.setFillStyle(this.currentPalette.particleNearEnemy, 0.05)
            p.angle = Math.random() * Math.PI * 2  // new erratic direction
            break
          }
          case 'ghostly_wisp': {
            // Anywhere not near player or enemies
            p.baseX = Math.random() * cam.width
            p.baseY = Math.random() * cam.height
            p.sprite.setFillStyle(this.currentPalette.particleEmpty, 0.04)
            break
          }
          case 'ai_data': {
            // Near partner, flowing upward
            p.baseX = (this.partnerX - cam.scrollX) + (Math.random() - 0.5) * 12
            p.baseY = (this.partnerY - cam.scrollY)
            p.sprite.setFillStyle(this.partnerColor, 0.08)
            break
          }
        }
        p.sprite.setPosition(p.baseX, p.baseY)
      }

      // Move based on type personality
      const progress = p.age / p.lifetime
      const fadeAlpha = progress < 0.2
        ? progress / 0.2                     // fade in
        : progress > 0.8
          ? (1 - progress) / 0.2             // fade out
          : 1                                 // full

      switch (p.type) {
        case 'warm_dust':
          // Slow upward drift with gentle sway
          p.sprite.setPosition(
            p.baseX + Math.sin(p.age * 0.001 + p.angle) * 8,
            p.baseY - progress * 20,
          )
          p.sprite.setAlpha(fadeAlpha * 0.06)
          break
        case 'cold_shard':
          // Erratic darting movement
          p.sprite.setPosition(
            p.baseX + Math.cos(p.age * 0.005) * p.speed * progress,
            p.baseY + Math.sin(p.age * 0.007) * p.speed * progress,
          )
          p.sprite.setAlpha(fadeAlpha * 0.07)
          break
        case 'ghostly_wisp':
          // Very slow sine-wave drift, fade in and out
          p.sprite.setPosition(
            p.baseX + Math.sin(p.age * 0.0003 + p.angle) * 15,
            p.baseY + Math.cos(p.age * 0.0004 + p.angle * 0.7) * 10,
          )
          p.sprite.setAlpha(fadeAlpha * 0.04)
          break
        case 'ai_data':
          // Flow upward from partner position
          p.sprite.setPosition(
            p.baseX + Math.sin(p.age * 0.004) * 4,
            p.baseY - progress * 30,
          )
          p.sprite.setAlpha(fadeAlpha * 0.1)
          break
      }
    }
  }

  // ── Data-stream particles (AI thinking visualization) ─────────────

  private spawnDataStreamParticle(): void {
    // Throttle: max 3 at once
    if (this.dataStreamParticles.length >= 3) return
    if (Math.random() > 0.1) return  // ~10% chance per frame

    const cam = this.scene.cameras.main
    const chars = '01.:+#*=~'
    const char = chars[Math.floor(Math.random() * chars.length)]

    const sx = (this.partnerX - cam.scrollX) + (Math.random() - 0.5) * 10
    const sy = (this.partnerY - cam.scrollY) + 4

    const text = this.scene.add.text(sx, sy, char, {
      fontFamily: 'monospace',
      fontSize: '6px',
      color: '#' + this.partnerColor.toString(16).padStart(6, '0'),
    }).setOrigin(0.5).setDepth(73).setScrollFactor(0).setAlpha(0.4)

    this.dataStreamParticles.push({
      sprite: text,
      age: 0,
      lifetime: 800 + Math.random() * 400,
    })
  }

  private updateDataStreamParticles(dt: number): void {
    for (let i = this.dataStreamParticles.length - 1; i >= 0; i--) {
      const dp = this.dataStreamParticles[i]
      dp.age += dt
      const progress = dp.age / dp.lifetime

      if (dp.age >= dp.lifetime) {
        dp.sprite.destroy()
        this.dataStreamParticles.splice(i, 1)
        continue
      }

      // Float upward, fade out
      dp.sprite.y -= dt * 0.03
      dp.sprite.x += Math.sin(dp.age * 0.005) * 0.3
      dp.sprite.setAlpha((1 - progress) * 0.4)
    }
  }

  // ── Dust Motes (warm particles floating in the light) ─────────────

  private spawnDustMotes(): void {
    const w = this.scene.cameras.main.width
    const h = this.scene.cameras.main.height
    const count = 20

    for (let i = 0; i < count; i++) {
      const x = Math.random() * w
      const y = Math.random() * h
      const size = 0.3 + Math.random() * 0.8
      const mote = this.scene.add.circle(x, y, size, 0xffcc88, 0.06 + Math.random() * 0.08)
        .setDepth(4)
        .setScrollFactor(0.5)
        .setBlendMode(Phaser.BlendModes.ADD)

      const tween = this.scene.tweens.add({
        targets: mote,
        y: y - 15 - Math.random() * 25,
        x: x + (Math.random() - 0.5) * 20,
        alpha: { from: mote.alpha, to: 0 },
        duration: 5000 + Math.random() * 4000,
        ease: 'Sine.easeInOut',
        repeat: -1,
        yoyo: true,
      })

      this.dustMotes.push({ sprite: mote, tween })
    }
  }

  // ── Ground Fog (semi-transparent dark layer near bottom) ──────────

  private spawnGroundFog(): void {
    const w = this.scene.cameras.main.width
    const h = this.scene.cameras.main.height

    for (let i = 0; i < 2; i++) {
      const fogY = h - 30 + i * 15
      const rect = this.scene.add.rectangle(w / 2, fogY, w * 1.5, 60, 0x0a0a0a, 0.2 + i * 0.08)
        .setDepth(6)
        .setScrollFactor(0.1 + i * 0.05)

      const tween = this.scene.tweens.add({
        targets: rect,
        x: rect.x + 30 - i * 60,
        alpha: { from: rect.alpha, to: rect.alpha * 0.5 },
        duration: 8000 + i * 4000,
        ease: 'Sine.easeInOut',
        yoyo: true,
        repeat: -1,
      })

      this.fogLayers.push({ rect, tween })
    }
  }

  /** Spawn embers floating upward near walls */
  spawnEmbers(wallPositions: Array<{ x: number; y: number }>): void {
    const sources = wallPositions
      .filter(() => Math.random() < 0.08)
      .slice(0, 12)

    for (const pos of sources) {
      const ember = this.scene.add.circle(
        pos.x + (Math.random() - 0.5) * 16,
        pos.y,
        0.5 + Math.random() * 0.8,
        0xff6622,
        0.4 + Math.random() * 0.3,
      ).setDepth(5).setBlendMode(Phaser.BlendModes.ADD)

      const tween = this.scene.tweens.add({
        targets: ember,
        y: pos.y - 30 - Math.random() * 40,
        x: ember.x + (Math.random() - 0.5) * 12,
        alpha: 0,
        scale: 0.3,
        duration: 2000 + Math.random() * 2000,
        ease: 'Sine.easeOut',
        repeat: -1,
        delay: Math.random() * 3000,
      })

      this.embers.push({ sprite: ember, tween })
    }
  }

  // ── Mood Particles ────────────────────────────────────────────────

  private spawnParticles(color: number): void {
    const w = this.scene.cameras.main.width
    const h = this.scene.cameras.main.height

    for (let i = 0; i < 12; i++) {
      const x = Math.random() * w
      const y = Math.random() * h
      const size = 0.5 + Math.random() * 1.5
      const p = this.scene.add.circle(x, y, size, color, 0.1 + Math.random() * 0.15)
        .setDepth(2)
        .setScrollFactor(0.3)

      this.particles.push(p)

      this.scene.tweens.add({
        targets: p,
        y: y - 20 - Math.random() * 30,
        x: x + (Math.random() - 0.5) * 15,
        alpha: 0,
        duration: 4000 + Math.random() * 3000,
        ease: 'Sine.easeInOut',
        repeat: -1,
        yoyo: true,
      })
    }
  }

  private clearParticles(): void {
    for (const p of this.particles) {
      this.scene.tweens.killTweensOf(p)
      p.destroy()
    }
    this.particles = []
  }

  destroy(): void {
    this.scene.events.off('update', this.tick, this)
    this.clearParticles()
    this.overlay.destroy()
    this.lightMask.destroy()

    for (const torch of this.torches) {
      torch.tween.destroy()
      torch.glow.destroy()
    }
    this.torches = []

    for (const mote of this.dustMotes) {
      mote.tween.destroy()
      mote.sprite.destroy()
    }
    this.dustMotes = []

    for (const fog of this.fogLayers) {
      fog.tween.destroy()
      fog.rect.destroy()
    }
    this.fogLayers = []

    for (const ember of this.embers) {
      ember.tween.destroy()
      ember.sprite.destroy()
    }
    this.embers = []

    for (const pp of this.poetParticles) {
      pp.sprite.destroy()
    }
    this.poetParticles = []

    for (const dp of this.dataStreamParticles) {
      dp.sprite.destroy()
    }
    this.dataStreamParticles = []

    if (this.neuralLines) {
      this.neuralLines.destroy()
      this.neuralLines = null
    }
  }
}
