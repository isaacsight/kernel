// SYNTH — Procedural Noise Engine
//
// Central noise service that replaces Math.random() across the game.
// Seeded per dungeon run for reproducibility. Uses simplex-noise for
// coherent 2D noise, layered fBM for organic texture, curl noise for
// divergence-free particle trajectories.
//
// The Houdini philosophy: noise is the language of proceduralism.
// Every organic motion, every timing variation, every visual wobble
// should come from coherent noise, not Math.random().

import { createNoise2D, type NoiseFunction2D } from 'simplex-noise'

// ── Seedable PRNG (Mulberry32) ────────────────────────────────────────
// Used to seed simplex-noise deterministically per dungeon run.

function mulberry32(seed: number): () => number {
  return () => {
    seed |= 0
    seed = (seed + 0x6d2b79f5) | 0
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

export class NoiseField {
  private noise2d: NoiseFunction2D
  private seed: number
  private rng: () => number

  constructor(seed?: number) {
    this.seed = seed ?? Math.floor(Math.random() * 2147483647)
    this.rng = mulberry32(this.seed)
    this.noise2d = createNoise2D(this.rng)
  }

  /** Re-seed for a new dungeon run */
  reseed(seed: number): void {
    this.seed = seed
    this.rng = mulberry32(seed)
    this.noise2d = createNoise2D(this.rng)
  }

  /** Get the current seed (for save/restore) */
  getSeed(): number {
    return this.seed
  }

  // ── Core Samplers ──────────────────────────────────────────────────

  /**
   * Raw 2D simplex noise sample.
   * Returns value in range [-1, 1].
   */
  sample2D(x: number, y: number): number {
    return this.noise2d(x, y)
  }

  /**
   * Fractal Brownian Motion — layered octaves of noise for organic texture.
   * Higher octaves add finer detail. Lacunarity controls frequency scaling
   * between octaves, gain controls amplitude scaling.
   *
   * Returns value in range approximately [-1, 1] (varies with parameters).
   */
  sampleFBM(
    x: number,
    y: number,
    octaves: number = 4,
    lacunarity: number = 2.0,
    gain: number = 0.5,
  ): number {
    let value = 0
    let amplitude = 1.0
    let frequency = 1.0
    let maxAmplitude = 0

    for (let i = 0; i < octaves; i++) {
      value += this.noise2d(x * frequency, y * frequency) * amplitude
      maxAmplitude += amplitude
      amplitude *= gain
      frequency *= lacunarity
    }

    // Normalize to [-1, 1]
    return value / maxAmplitude
  }

  /**
   * Curl noise — divergence-free velocity field.
   * Particles following this field will swirl organically
   * without converging or diverging. This is the secret to
   * Houdini-style particle motion.
   *
   * Returns a 2D velocity vector.
   */
  getCurl2D(x: number, y: number, time: number): { x: number; y: number } {
    const eps = 0.001

    // Sample noise field at offset positions to compute gradient
    const nx = x + time * 0.1
    const ny = y + time * 0.1

    // Partial derivatives via finite differences
    const dndx = (this.noise2d(nx + eps, ny) - this.noise2d(nx - eps, ny)) / (2 * eps)
    const dndy = (this.noise2d(nx, ny + eps) - this.noise2d(nx, ny - eps)) / (2 * eps)

    // Curl in 2D: rotate the gradient 90 degrees
    // This guarantees zero divergence (no sources/sinks)
    return {
      x: dndy,
      y: -dndx,
    }
  }

  /**
   * Flow field — scaled curl noise for driving particle movement.
   * Scale controls how "zoomed in" the flow pattern is.
   * Larger scale = broader, sweeping currents.
   * Smaller scale = tight, detailed swirls.
   */
  getFlowField(
    x: number,
    y: number,
    time: number,
    scale: number = 0.01,
  ): { x: number; y: number } {
    const curl = this.getCurl2D(x * scale, y * scale, time)
    return curl
  }

  // ── Game-Specific Helpers ──────────────────────────────────────────

  /**
   * Jittered value — adds coherent noise variation to a base value.
   * Used for AI timing so enemies don't feel metronomic.
   *
   * @param base    The base value (e.g., attack cooldown)
   * @param seed    Per-entity seed for unique jitter patterns
   * @param time    Current time (seconds)
   * @param range   Maximum deviation from base (e.g., 0.2 = +/-20%)
   * @returns       base +/- (base * range * noise)
   */
  jitteredValue(base: number, seed: number, time: number, range: number): number {
    const n = this.noise2d(time * 0.5, seed * 73.7)
    return base + base * n * range
  }

  /**
   * Organic edge — generates a wobbly radius for light circles.
   * Instead of a perfect circle, the light boundary breathes and shifts.
   *
   * @param angle   Angle around the circle (radians)
   * @param radius  Base radius
   * @param time    Current time (seconds)
   * @param wobble  Wobble intensity (0-1, default 0.1 = 10% variance)
   * @returns       Perturbed radius at this angle
   */
  organicEdge(angle: number, radius: number, time: number, wobble: number = 0.1): number {
    // Use angle as one axis and time as the other for smooth animation
    const n = this.sampleFBM(
      Math.cos(angle) * 2 + time * 0.3,
      Math.sin(angle) * 2 + time * 0.2,
      3,  // 3 octaves for medium detail
      2.0,
      0.5,
    )
    return radius * (1 + n * wobble)
  }

  /**
   * Smooth random walk using noise. Returns a position offset
   * that wanders organically over time.
   *
   * @param seed    Per-entity seed
   * @param time    Current time (seconds)
   * @param scale   Movement scale in pixels
   */
  randomWalk(seed: number, time: number, scale: number = 20): { x: number; y: number } {
    return {
      x: this.noise2d(time * 0.3, seed * 31.7) * scale,
      y: this.noise2d(seed * 31.7, time * 0.3 + 100) * scale,
    }
  }
}

// ── Singleton ─────────────────────────────────────────────────────────
// One noise field per game. Reseed on each dungeon run.

export const noise = new NoiseField()
