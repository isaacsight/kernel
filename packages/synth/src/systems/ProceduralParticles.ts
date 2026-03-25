// SYNTH — Procedural Particle Engine (Noise-Driven)
//
// Replaces manual tween-based particles with a pooled, noise-driven system.
// Particles follow curl noise fields for organic, Houdini-style motion
// instead of straight lines.
//
// Key concepts:
// - Object pooling: no allocation during gameplay
// - Curl noise influence: particles swirl organically
// - Recipes: parameterized effects, not hand-animated tweens
// - Color interpolation over lifetime for rich visual progression
//
// All client-side, zero API calls, zero cost.

import Phaser from 'phaser'
import { noise } from './NoiseField'

// ── Particle Recipe ──────────────────────────────────────────────────

export interface ParticleRecipe {
  name: string
  count: number
  lifetime: { min: number; max: number }    // ms
  speed: { min: number; max: number }        // px/s initial speed
  size: { start: number; end: number }       // radius
  alpha: { start: number; end: number }      // opacity
  colors: number[]                            // palette to lerp through over lifetime
  noiseInfluence: number                      // 0 = straight lines, 1 = full curl noise
  gravity: number                             // downward acceleration (px/s^2)
  drag: number                                // velocity damping per second (0 = none, 1 = full stop)
  /** Optional: spread angle (radians). 0 = omnidirectional, PI/4 = narrow cone */
  spreadAngle?: number
  /** Optional: base emission angle (radians). Used with spreadAngle for directional emitters */
  baseAngle?: number
}

// ── Internal Particle State ──────────────────────────────────────────

interface Particle {
  active: boolean
  graphic: Phaser.GameObjects.Arc
  x: number
  y: number
  vx: number
  vy: number
  age: number           // ms
  lifetime: number      // ms
  sizeStart: number
  sizeEnd: number
  alphaStart: number
  alphaEnd: number
  colors: number[]
  noiseInfluence: number
  gravity: number
  drag: number
  noiseSeed: number     // per-particle seed for unique curl patterns
}

// ── Color Utilities ──────────────────────────────────────────────────

function lerpColor(a: number, b: number, t: number): number {
  const ar = (a >> 16) & 0xff
  const ag = (a >> 8) & 0xff
  const ab = a & 0xff
  const br = (b >> 16) & 0xff
  const bg = (b >> 8) & 0xff
  const bb = b & 0xff
  const r = Math.round(ar + (br - ar) * t)
  const g = Math.round(ag + (bg - ag) * t)
  const b2 = Math.round(ab + (bb - ab) * t)
  return (r << 16) | (g << 8) | b2
}

function sampleColorPalette(colors: number[], t: number): number {
  if (colors.length === 0) return 0xffffff
  if (colors.length === 1) return colors[0]

  const scaledT = t * (colors.length - 1)
  const idx = Math.floor(scaledT)
  const frac = scaledT - idx

  if (idx >= colors.length - 1) return colors[colors.length - 1]
  return lerpColor(colors[idx], colors[idx + 1], frac)
}

// ── Procedural Particles Engine ──────────────────────────────────────

export class ProceduralParticles {
  private pool: Particle[] = []
  private scene: Phaser.Scene
  private activeCount = 0
  private timeSeconds = 0

  constructor(scene: Phaser.Scene, poolSize: number = 200) {
    this.scene = scene

    // Pre-allocate particle pool
    for (let i = 0; i < poolSize; i++) {
      const graphic = scene.add.circle(0, 0, 2, 0xffffff, 0)
        .setDepth(15)
        .setActive(false)
        .setVisible(false)

      this.pool.push({
        active: false,
        graphic,
        x: 0, y: 0,
        vx: 0, vy: 0,
        age: 0,
        lifetime: 1000,
        sizeStart: 2, sizeEnd: 0,
        alphaStart: 1, alphaEnd: 0,
        colors: [0xffffff],
        noiseInfluence: 0,
        gravity: 0,
        drag: 0,
        noiseSeed: 0,
      })
    }
  }

  /**
   * Emit particles at a world position using a recipe.
   */
  emit(x: number, y: number, recipe: ParticleRecipe): void {
    for (let i = 0; i < recipe.count; i++) {
      const particle = this.getPooledParticle()
      if (!particle) return  // pool exhausted

      // Randomize lifetime and speed within recipe range
      const lifetime = recipe.lifetime.min + Math.random() * (recipe.lifetime.max - recipe.lifetime.min)
      const speed = recipe.speed.min + Math.random() * (recipe.speed.max - recipe.speed.min)

      // Emission direction
      let angle: number
      if (recipe.spreadAngle !== undefined && recipe.baseAngle !== undefined) {
        // Directional cone
        angle = recipe.baseAngle + (Math.random() - 0.5) * recipe.spreadAngle
      } else {
        // Omnidirectional
        angle = Math.random() * Math.PI * 2
      }

      particle.active = true
      particle.x = x
      particle.y = y
      particle.vx = Math.cos(angle) * speed
      particle.vy = Math.sin(angle) * speed
      particle.age = 0
      particle.lifetime = lifetime
      particle.sizeStart = recipe.size.start
      particle.sizeEnd = recipe.size.end
      particle.alphaStart = recipe.alpha.start
      particle.alphaEnd = recipe.alpha.end
      particle.colors = recipe.colors
      particle.noiseInfluence = recipe.noiseInfluence
      particle.gravity = recipe.gravity
      particle.drag = recipe.drag
      particle.noiseSeed = Math.random() * 1000

      particle.graphic
        .setPosition(x, y)
        .setRadius(recipe.size.start)
        .setFillStyle(recipe.colors[0], recipe.alpha.start)
        .setActive(true)
        .setVisible(true)

      this.activeCount++
    }
  }

  /**
   * Update all active particles. Call every frame.
   */
  update(dt: number): void {
    const dtSec = dt / 1000
    this.timeSeconds += dtSec

    for (const p of this.pool) {
      if (!p.active) continue

      p.age += dt

      // Kill expired particles
      if (p.age >= p.lifetime) {
        this.deactivateParticle(p)
        continue
      }

      // Normalized lifetime progress (0 to 1)
      const t = p.age / p.lifetime

      // Apply curl noise influence
      if (p.noiseInfluence > 0) {
        const curl = noise.getCurl2D(
          p.x * 0.008,
          p.y * 0.008,
          this.timeSeconds + p.noiseSeed,
        )
        const noiseStrength = p.noiseInfluence * 80 // scale to reasonable pixel velocity
        p.vx += curl.x * noiseStrength * dtSec
        p.vy += curl.y * noiseStrength * dtSec
      }

      // Apply gravity
      if (p.gravity !== 0) {
        p.vy += p.gravity * dtSec
      }

      // Apply drag
      if (p.drag > 0) {
        const dragFactor = 1 - p.drag * dtSec
        p.vx *= Math.max(0, dragFactor)
        p.vy *= Math.max(0, dragFactor)
      }

      // Move
      p.x += p.vx * dtSec
      p.y += p.vy * dtSec

      // Interpolate visual properties
      const size = p.sizeStart + (p.sizeEnd - p.sizeStart) * t
      const alpha = p.alphaStart + (p.alphaEnd - p.alphaStart) * t
      const color = sampleColorPalette(p.colors, t)

      // Update graphic
      p.graphic
        .setPosition(p.x, p.y)
        .setRadius(Math.max(0.1, size))
        .setFillStyle(color, Math.max(0, alpha))
    }
  }

  /**
   * Get the current number of active particles.
   */
  getActiveCount(): number {
    return this.activeCount
  }

  /**
   * Destroy all particles and clean up graphics.
   */
  destroy(): void {
    for (const p of this.pool) {
      p.graphic.destroy()
    }
    this.pool = []
    this.activeCount = 0
  }

  // ── Pool Management ────────────────────────────────────────────────

  private getPooledParticle(): Particle | null {
    for (const p of this.pool) {
      if (!p.active) return p
    }
    return null  // pool exhausted
  }

  private deactivateParticle(p: Particle): void {
    p.active = false
    p.graphic.setActive(false).setVisible(false)
    this.activeCount--
  }
}

// ══════════════════════════════════════════════════════════════════════
// PRE-BUILT RECIPES — Real game effects
// ══════════════════════════════════════════════════════════════════════

/**
 * Death burst — 20 particles, curl noise spirals, entity color palette,
 * lingering embers that float upward.
 */
export const RECIPE_DEATH_BURST: ParticleRecipe = {
  name: 'death_burst',
  count: 20,
  lifetime: { min: 400, max: 900 },
  speed: { min: 40, max: 120 },
  size: { start: 3, end: 0.5 },
  alpha: { start: 0.9, end: 0 },
  colors: [0xff4444, 0xff6644, 0xdd2222, 0xff8844, 0xffaa22],
  noiseInfluence: 0.7,    // strong curl = organic spirals
  gravity: -15,           // slight float upward (embers)
  drag: 0.8,              // slow down over time
}

/**
 * Hit sparks — 8 fast particles, slight curl, gold/white.
 * Snappy, immediate, confirming impact.
 */
export const RECIPE_HIT_SPARKS: ParticleRecipe = {
  name: 'hit_sparks',
  count: 8,
  lifetime: { min: 80, max: 200 },
  speed: { min: 100, max: 250 },
  size: { start: 2, end: 0.3 },
  alpha: { start: 1, end: 0 },
  colors: [0xffffff, 0xffff44, 0xffaa22],
  noiseInfluence: 0.15,   // slight curl for organic feel
  gravity: 0,
  drag: 2.0,              // heavy drag = fast stop
}

/**
 * Ambient dust — 4 slow particles, high noise influence, warm tones.
 * Drifting motes in the dungeon air.
 */
export const RECIPE_AMBIENT_DUST: ParticleRecipe = {
  name: 'ambient_dust',
  count: 4,
  lifetime: { min: 2000, max: 4000 },
  speed: { min: 2, max: 8 },
  size: { start: 0.8, end: 0.3 },
  alpha: { start: 0.2, end: 0 },
  colors: [0xaa8844, 0x886633, 0x664422],
  noiseInfluence: 0.9,    // almost fully noise-driven
  gravity: -3,            // slow float up
  drag: 0.1,
}

/**
 * Combat smoke — 12 particles, medium curl, gray with heat tint.
 * Lingers in combat zones.
 */
export const RECIPE_COMBAT_SMOKE: ParticleRecipe = {
  name: 'combat_smoke',
  count: 12,
  lifetime: { min: 500, max: 1200 },
  speed: { min: 15, max: 50 },
  size: { start: 4, end: 1 },
  alpha: { start: 0.3, end: 0 },
  colors: [0x888888, 0x666666, 0x443322, 0x332211],
  noiseInfluence: 0.5,
  gravity: -10,           // rises like smoke
  drag: 0.6,
}

/**
 * Dash trail — 6 fast-fading particles, player color, low noise.
 * Marks the player's dodge path.
 */
export const RECIPE_DASH_TRAIL: ParticleRecipe = {
  name: 'dash_trail',
  count: 6,
  lifetime: { min: 100, max: 250 },
  speed: { min: 10, max: 30 },
  size: { start: 2.5, end: 0.5 },
  alpha: { start: 0.6, end: 0 },
  colors: [0x4488ff, 0x66aaff, 0x2266dd],
  noiseInfluence: 0.1,    // minimal noise — clean trail
  gravity: 0,
  drag: 3.0,              // very fast stop
}

/**
 * Create a death burst recipe with custom colors for the dying entity.
 */
export function createDeathRecipe(entityColors: number[]): ParticleRecipe {
  return {
    ...RECIPE_DEATH_BURST,
    colors: entityColors.length > 0 ? entityColors : RECIPE_DEATH_BURST.colors,
  }
}

/**
 * Create a hit sparks recipe with a custom base color.
 */
export function createHitRecipe(color: number): ParticleRecipe {
  return {
    ...RECIPE_HIT_SPARKS,
    colors: [0xffffff, color, 0xffaa22],
  }
}
