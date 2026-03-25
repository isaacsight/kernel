// SYNTH — Latent Dissolution Texture Generation
// Art Style: The game world exists in latent space — the mathematical space
// where AI diffusion models generate images. Everything looks like it's
// partway through the denoising process. Shapes are coherent but edges
// blur and dissolve. Colors bleed. Deeper floors = more noise, less resolution.
//
// Every entity is readable at the core but dissolving at the edges,
// like a shape emerging from static.

import Phaser from 'phaser'
import { TEX, TILE_SIZE } from '../constants'

// ── Noise & Helpers ───────────────────────────────────────────────────

/** Deterministic hash noise — returns 0..1 for any (x, y, seed) */
function hashNoise(x: number, y: number, seed: number): number {
  let h = (Math.floor(x) * 374761393 + Math.floor(y) * 668265263 + Math.floor(seed * 1000)) | 0
  h = (h ^ (h >> 13)) * 1274126177
  h = h ^ (h >> 16)
  return (Math.abs(h) % 1000) / 1000
}

/** Distance between two points */
function dist(x1: number, y1: number, x2: number, y2: number): number {
  const dx = x1 - x2
  const dy = y1 - y2
  return Math.sqrt(dx * dx + dy * dy)
}

/** Draw a single pixel at native coordinates with alpha */
function pixel(g: Phaser.GameObjects.Graphics, x: number, y: number, color: number, alpha: number, s: number = 1): void {
  if (alpha < 0.02) return
  g.fillStyle(color, Math.min(alpha, 1))
  g.fillRect(x * s, y * s, s, s)
}

/** Lerp between two colors */
function lerpColor(a: number, b: number, t: number): number {
  const ar = (a >> 16) & 0xff, ag = (a >> 8) & 0xff, ab = a & 0xff
  const br = (b >> 16) & 0xff, bg = (b >> 8) & 0xff, bb = b & 0xff
  const r = Math.round(ar + (br - ar) * t)
  const gg = Math.round(ag + (bg - ag) * t)
  const bl = Math.round(ab + (bb - ab) * t)
  return (r << 16) | (gg << 8) | bl
}

/** Lighten a color */
function lighter(color: number, amount: number): number {
  const r = Math.min(255, ((color >> 16) & 0xff) + amount)
  const g = Math.min(255, ((color >> 8) & 0xff) + amount)
  const b = Math.min(255, (color & 0xff) + amount)
  return (r << 16) | (g << 8) | b
}

/** Darken a color */
function darker(color: number, amount: number): number {
  const r = Math.max(0, ((color >> 16) & 0xff) - amount)
  const g = Math.max(0, ((color >> 8) & 0xff) - amount)
  const b = Math.max(0, (color & 0xff) - amount)
  return (r << 16) | (g << 8) | b
}

/** Create a graphics context and generate a texture from it. */
function makeTexture(scene: Phaser.Scene, key: string, w: number, h: number, draw: (g: Phaser.GameObjects.Graphics) => void): void {
  // Remove existing texture so we can regenerate for new floor
  if (scene.textures.exists(key)) {
    scene.textures.remove(key)
  }
  const g = scene.make.graphics({ x: 0, y: 0 }, false)
  draw(g)
  g.generateTexture(key, w, h)
  g.destroy()
}

// ── Dissolution level (set per floor) ─────────────────────────────────

let currentDissolution = 0.1
let currentSeed = 42

/** Set the dissolution level for texture generation (0 = coherent, 1 = abstract) */
export function setDissolutionLevel(floorNumber: number): void {
  // Floor 1: 0.1, Floor 3: 0.3, Floor 5: 0.5, Floor 8: 0.7, Floor 10+: 0.9
  currentDissolution = Math.min(0.9, 0.05 + (floorNumber - 1) * 0.1)
  currentSeed = floorNumber * 7 + 13
}

// ── Dissolving Edge Drawing ───────────────────────────────────────────
// Core technique: draw a solid core shape, then dissolve edges using
// noise-modulated alpha falloff. Scatter noise pixels around the entity.

interface DissolveParams {
  g: Phaser.GameObjects.Graphics
  cx: number          // center x
  cy: number          // center y
  coreRadius: number  // radius of solid core
  maxRadius: number   // radius including dissolving edge
  color: number       // main color
  seedColor: number   // bright core seed color
  s: number           // pixel scale
  seed: number        // noise seed for this entity
  dissolution: number // 0..1 dissolution level
  shape: 'diamond' | 'circle' | 'hex' | 'square' | 'triangle' | 'cross' | 'ring'
  scatterColor?: number // color of noise scatter (defaults to color)
  scatterCount?: number // number of scatter pixels
}

/** Test if a point is inside the given shape */
function insideShape(
  px: number, py: number, cx: number, cy: number, radius: number,
  shape: DissolveParams['shape'],
): boolean {
  const dx = px - cx
  const dy = py - cy
  switch (shape) {
    case 'diamond':
      return (Math.abs(dx) + Math.abs(dy)) <= radius
    case 'circle':
      return (dx * dx + dy * dy) <= radius * radius
    case 'hex': {
      const ax = Math.abs(dx)
      const ay = Math.abs(dy)
      return ay <= radius * 0.85 && (ax + ay * 0.5) <= radius
    }
    case 'square':
      return Math.abs(dx) <= radius && Math.abs(dy) <= radius
    case 'triangle':
      return dy >= -radius * 0.6 && dy <= radius * 0.8 &&
        Math.abs(dx) <= radius * (1 - (dy + radius * 0.6) / (radius * 1.4)) * 0.9
    case 'cross': {
      const armW = radius * 0.35
      return (Math.abs(dx) <= armW && Math.abs(dy) <= radius) ||
             (Math.abs(dy) <= armW && Math.abs(dx) <= radius)
    }
    case 'ring': {
      const d = Math.sqrt(dx * dx + dy * dy)
      return d >= radius * 0.5 && d <= radius
    }
  }
}

/** Draw a dissolving entity with the latent dissolution technique */
function drawDissolving(params: DissolveParams): void {
  const { g, cx, cy, coreRadius, maxRadius, color, seedColor, s, seed, dissolution, shape, scatterColor, scatterCount } = params
  const dissolveThreshold = coreRadius * (1 - dissolution * 0.5) // solid core shrinks with dissolution
  const sColor = scatterColor ?? color

  // Draw all pixels in the bounding box
  const extent = Math.ceil(maxRadius) + 2
  for (let py = cy - extent; py <= cy + extent; py++) {
    for (let px = cx - extent; px <= cx + extent; px++) {
      const d = dist(px, py, cx, cy)
      if (d > maxRadius + 1) continue

      const inShape = insideShape(px, py, cx, cy, maxRadius, shape)
      if (!inShape && d > maxRadius) continue

      const noiseVal = hashNoise(px, py, seed)

      if (inShape && d < dissolveThreshold) {
        // Solid core — full alpha, slight noise variation in color
        const colorVar = noiseVal > 0.85 ? lighter(color, 15) : noiseVal < 0.15 ? darker(color, 10) : color
        pixel(g, px, py, colorVar, 1.0, s)
      } else if (inShape) {
        // Dissolving edge zone — alpha decreases with distance, modulated by noise
        const edgeProgress = (d - dissolveThreshold) / (maxRadius - dissolveThreshold + 0.01)
        const baseAlpha = (1 - edgeProgress)
        const alpha = baseAlpha * (0.3 + noiseVal * 0.7) * (1 - dissolution * 0.3)
        if (alpha > 0.08) {
          // Color shifts toward noise at edges
          const edgeColor = noiseVal > 0.5 ? lighter(color, Math.floor(edgeProgress * 30)) : color
          pixel(g, px, py, edgeColor, alpha, s)
        }
      }
    }
  }

  // Bright core seed — the point of maximum coherence (always sharp)
  const seedRadius = Math.max(1, Math.floor(coreRadius * 0.25))
  for (let sy = cy - seedRadius; sy <= cy + seedRadius; sy++) {
    for (let sx = cx - seedRadius; sx <= cx + seedRadius; sx++) {
      const d = dist(sx, sy, cx, cy)
      if (d <= seedRadius) {
        const alpha = 1 - (d / seedRadius) * 0.3
        pixel(g, sx, sy, seedColor, alpha, s)
      }
    }
  }

  // Noise scatter — pixels that dissolve into the void around the entity
  const actualScatter = scatterCount ?? Math.floor(12 + dissolution * 30)
  for (let i = 0; i < actualScatter; i++) {
    const angle = hashNoise(i, seed, 0) * Math.PI * 2
    const scatterDist = maxRadius + hashNoise(i, seed, 1) * maxRadius * (0.5 + dissolution)
    const px = cx + Math.cos(angle) * scatterDist
    const py = cy + Math.sin(angle) * scatterDist
    const alpha = 0.1 + hashNoise(i, seed, 2) * 0.3 * (1 - dissolution * 0.3)
    pixel(g, Math.round(px), Math.round(py), sColor, alpha, s)
  }
}

// ── Target display sizes ────────────────────────────────────────────

const TARGET_SIZES: Record<string, number> = {
  [TEX.PLAYER]: 40,
  [TEX.PARTNER]: 40,
  [TEX.ENEMY]: 32,
  [TEX.ENEMY_RANGED]: 28,
  [TEX.ENEMY_FAST_TANK]: 36,
  [TEX.ENEMY_BOSS]: 64,
  [TEX.ENEMY_SHIELDED]: 32,
  [TEX.ENEMY_EXPLODER]: 28,
  [TEX.ENEMY_HEALER]: 28,
  [TEX.ENEMY_SUMMONER]: 32,
  [TEX.WALL]: TILE_SIZE,
  [TEX.FLOOR]: TILE_SIZE,
  [TEX.PROJECTILE]: 16,
}

export function getSpriteScale(scene: Phaser.Scene, textureKey: string): number {
  const target = TARGET_SIZES[textureKey]
  if (!target) return 1
  if (!scene.textures.exists(textureKey)) return target / 40
  const tex = scene.textures.get(textureKey)
  const frame = tex.get()
  const maxDim = Math.max(frame.width, frame.height)
  if (maxDim === 0) return 1
  return target / maxDim
}

export function getEnemyScale(scene: Phaser.Scene, textureKey: string, enemyType: string): number {
  const typeTargets: Record<string, number> = {
    melee: 32,
    ranged: 28,
    fast: 24,
    tank: 36,
    shielded: 32,
    exploder: 28,
    healer: 28,
    summoner: 32,
  }
  const target = typeTargets[enemyType] ?? 28
  if (!scene.textures.exists(textureKey)) return target / 40
  const tex = scene.textures.get(textureKey)
  const frame = tex.get()
  const maxDim = Math.max(frame.width, frame.height)
  if (maxDim === 0) return 1
  return target / maxDim
}

// ── Preload (Midjourney sprites — overridden by procedural) ──────────

export function preloadTextures(_scene: Phaser.Scene): void {
  // Latent dissolution sprites are fully procedural — no external assets needed
}

// ── Master generation ───────────────────────────────────────────────

export function generateTextures(scene: Phaser.Scene): void {
  generatePlayer(scene)
  generatePartner(scene)
  generateEnemyMelee(scene)
  generateEnemyRanged(scene)
  generateEnemyFastTank(scene)
  generateEnemyShielded(scene)
  generateEnemyExploder(scene)
  generateEnemyHealer(scene)
  generateEnemySummoner(scene)
  generateEnemyBoss(scene)
  generateWall(scene)
  generateFloor(scene)
  generateProjectile(scene)
}

/** Regenerate all textures for a new floor (called on floor transitions) */
export function regenerateTextures(scene: Phaser.Scene, floorNumber: number): void {
  setDissolutionLevel(floorNumber)
  generateTextures(scene)
}

// ═══════════════════════════════════════════════════════════════════
// PLAYER — Crystal Guardian
// 20x20 at 2x = 40x40
// Diamond core in cyan (#4488ff), dissolving edges, bright white seed
// The player is the most coherent entity — reality anchors around them
// ═══════════════════════════════════════════════════════════════════

export function generatePlayer(scene: Phaser.Scene): void {
  const S = 2
  const W = 20
  const color = 0x4488ff
  const seedColor = 0xeeffff
  const accentColor = 0x66aaff

  makeTexture(scene, TEX.PLAYER, W * S, W * S, (g) => {
    const cx = 10
    const cy = 10
    const coreR = 6
    const maxR = 9

    // Draw dissolving diamond
    drawDissolving({
      g, cx, cy,
      coreRadius: coreR,
      maxRadius: maxR,
      color,
      seedColor,
      s: S,
      seed: currentSeed + 1,
      dissolution: currentDissolution * 0.7, // player is more coherent
      shape: 'diamond',
      scatterColor: accentColor,
      scatterCount: Math.floor(8 + currentDissolution * 15),
    })

    // Visor line — a horizontal band of bright pixels across the face area
    const visorY = cy - 2
    for (let vx = cx - 3; vx <= cx + 3; vx++) {
      const visorNoise = hashNoise(vx, visorY, currentSeed + 10)
      if (visorNoise > 0.3 - currentDissolution * 0.2) {
        const alpha = 0.7 + visorNoise * 0.3
        pixel(g, vx, visorY, 0xffffff, alpha, S)
      }
    }
  })
}

// ═══════════════════════════════════════════════════════════════════
// PARTNER — AI Companion
// 20x20 at 2x = 40x40
// Hexagonal green shape (#44ff88) — more coherent than enemies
// Circuit-like traces extend beyond the body and fade
// The partner is dreaming the dungeon into existence
// ═══════════════════════════════════════════════════════════════════

export function generatePartner(scene: Phaser.Scene): void {
  const S = 2
  const W = 20
  const color = 0x44ff88
  const seedColor = 0xeeffee
  const circuitColor = 0x33cc66

  makeTexture(scene, TEX.PARTNER, W * S, W * S, (g) => {
    const cx = 10
    const cy = 10
    const coreR = 6
    const maxR = 9

    // Draw dissolving hex — partner is the MOST coherent (it's generating everything)
    drawDissolving({
      g, cx, cy,
      coreRadius: coreR,
      maxRadius: maxR,
      color,
      seedColor,
      s: S,
      seed: currentSeed + 2,
      dissolution: currentDissolution * 0.5, // most coherent entity
      shape: 'hex',
      scatterColor: circuitColor,
      scatterCount: Math.floor(6 + currentDissolution * 10),
    })

    // Circuit traces extending outward — the partner's influence on reality
    const traceCount = 4 + Math.floor(currentDissolution * 4)
    for (let i = 0; i < traceCount; i++) {
      const angle = (i / traceCount) * Math.PI * 2 + hashNoise(i, 0, currentSeed + 20) * 0.5
      const length = 3 + hashNoise(i, 1, currentSeed + 20) * 5
      for (let step = 0; step < length; step++) {
        const px = cx + Math.cos(angle) * (maxR + step)
        const py = cy + Math.sin(angle) * (maxR + step)
        const alpha = 0.4 * (1 - step / length)
        pixel(g, Math.round(px), Math.round(py), circuitColor, alpha, S)
      }
    }

    // Antenna tip — bright dot above
    pixel(g, cx, cy - maxR - 1, 0xeeffdd, 0.8, S)
    pixel(g, cx, cy - maxR - 2, 0xeeffdd, 0.4 * (1 - currentDissolution), S)
  })
}

// ═══════════════════════════════════════════════════════════════════
// ENEMIES — Less coherent (further from the model's "intent")
// Each type has a recognizable shape but with heavy edge dissolution
// ═══════════════════════════════════════════════════════════════════

// Melee: red circular mass with spikes dissolving into noise at the tips
export function generateEnemyMelee(scene: Phaser.Scene): void {
  const S = 2
  const W = 16
  // Enemies are drawn in grayscale — setTint() colorizes per enemy type
  const color = 0xcccccc
  const seedColor = 0xffffff

  makeTexture(scene, TEX.ENEMY, W * S, W * S, (g) => {
    const cx = 8
    const cy = 8
    const coreR = 5
    const maxR = 7

    // Main circular body
    drawDissolving({
      g, cx, cy,
      coreRadius: coreR,
      maxRadius: maxR,
      color,
      seedColor,
      s: S,
      seed: currentSeed + 3,
      dissolution: currentDissolution * 1.2, // enemies are less coherent
      shape: 'circle',
      scatterCount: Math.floor(10 + currentDissolution * 25),
    })

    // Spikes — dissolving outward at cardinal + diagonal directions
    const spikeAngles = [0, Math.PI / 4, Math.PI / 2, Math.PI * 0.75, Math.PI, Math.PI * 1.25, Math.PI * 1.5, Math.PI * 1.75]
    for (const angle of spikeAngles) {
      const spikeLen = 2 + hashNoise(angle * 10, 0, currentSeed + 30) * 2
      for (let step = 0; step < spikeLen; step++) {
        const px = cx + Math.cos(angle) * (coreR + step)
        const py = cy + Math.sin(angle) * (coreR + step)
        const noise = hashNoise(step, angle * 10, currentSeed + 31)
        const alpha = (1 - step / spikeLen) * (0.5 + noise * 0.5) * (1 - currentDissolution * 0.4)
        if (alpha > 0.1) {
          pixel(g, Math.round(px), Math.round(py), color, alpha, S)
        }
      }
    }

    // Eye — angry pupil at center (stays sharp even as body dissolves)
    pixel(g, cx - 1, cy, 0xffffff, 0.9, S)
    pixel(g, cx, cy, 0x111111, 1, S)
    pixel(g, cx + 1, cy, 0xffffff, 0.9, S)
    pixel(g, cx, cy - 1, 0xffffff, 0.6, S)
  })
}

// Ranged: orange eye-shape, pupil sharp but everything around dissolves
export function generateEnemyRanged(scene: Phaser.Scene): void {
  const S = 2
  const W = 12
  const color = 0xcccccc
  const seedColor = 0xffffff

  makeTexture(scene, TEX.ENEMY_RANGED, W * S, W * S, (g) => {
    const cx = 6
    const cy = 6
    const coreR = 4
    const maxR = 5

    // Eye shape — horizontally elongated circle
    const extent = maxR + 2
    const dissolveThreshold = coreR * (1 - currentDissolution * 0.5)
    for (let py = cy - extent; py <= cy + extent; py++) {
      for (let px = cx - extent - 2; px <= cx + extent + 2; px++) {
        const dx = (px - cx) * 0.7 // stretch horizontally
        const dy = py - cy
        const d = Math.sqrt(dx * dx + dy * dy)
        if (d > maxR + 1) continue

        const noiseVal = hashNoise(px, py, currentSeed + 4)

        if (d < dissolveThreshold) {
          const colorVar = noiseVal > 0.8 ? lighter(color, 15) : color
          pixel(g, px, py, colorVar, 1.0, S)
        } else if (d < maxR) {
          const edgeProgress = (d - dissolveThreshold) / (maxR - dissolveThreshold + 0.01)
          const alpha = (1 - edgeProgress) * (0.3 + noiseVal * 0.7) * (1 - currentDissolution * 0.3)
          if (alpha > 0.08) {
            pixel(g, px, py, color, alpha, S)
          }
        }
      }
    }

    // Sharp pupil — always fully resolved
    pixel(g, cx, cy, 0x111111, 1, S)
    pixel(g, cx - 1, cy, 0x111111, 1, S)
    pixel(g, cx + 1, cy, 0xdddddd, 1, S) // iris highlight
    pixel(g, cx, cy - 1, 0xdddddd, 0.8, S)
    pixel(g, cx, cy + 1, 0xdddddd, 0.8, S)

    // Scatter
    const scatterCount = Math.floor(8 + currentDissolution * 20)
    for (let i = 0; i < scatterCount; i++) {
      const angle = hashNoise(i, 0, currentSeed + 40) * Math.PI * 2
      const sd = maxR + hashNoise(i, 1, currentSeed + 40) * maxR * 0.6
      const px = cx + Math.cos(angle) * sd
      const py = cy + Math.sin(angle) * sd
      pixel(g, Math.round(px), Math.round(py), color, 0.15 + hashNoise(i, 2, currentSeed + 40) * 0.2, S)
    }
  })
}

// Fast: small red triangle trailing dissolution particles
export function generateEnemyFastTank(scene: Phaser.Scene): void {
  const S = 2
  const W = 18
  const color = 0xaaaaaa
  const seedColor = 0xffffff

  makeTexture(scene, TEX.ENEMY_FAST_TANK, W * S, W * S, (g) => {
    const cx = 9
    const cy = 9
    const coreR = 6
    const maxR = 8

    // Tank: large dark block — unstable mass, edges dissolving and reforming
    drawDissolving({
      g, cx, cy,
      coreRadius: coreR,
      maxRadius: maxR,
      color,
      seedColor,
      s: S,
      seed: currentSeed + 5,
      dissolution: currentDissolution * 1.3, // tanks are unstable masses
      shape: 'square',
      scatterCount: Math.floor(14 + currentDissolution * 30),
    })

    // Armor plate lines — horizontal bands of slightly different shade
    for (let py = cy - coreR; py <= cy + coreR; py++) {
      if ((py + cy) % 3 === 0) {
        for (let px = cx - coreR; px <= cx + coreR; px++) {
          if (insideShape(px, py, cx, cy, maxR, 'square')) {
            const noise = hashNoise(px, py, currentSeed + 50)
            if (noise > 0.5) {
              pixel(g, px, py, darker(color, 25), 0.4, S)
            }
          }
        }
      }
    }

    // Eyes — two glowing dots
    pixel(g, cx - 2, cy - 1, 0xffffff, 0.9, S)
    pixel(g, cx + 2, cy - 1, 0xffffff, 0.9, S)
    pixel(g, cx - 2, cy, 0x111111, 1, S)
    pixel(g, cx + 2, cy, 0x111111, 1, S)
  })
}

// Shielded: blue shape with one solid edge (shield) and others dissolved
export function generateEnemyShielded(scene: Phaser.Scene): void {
  const S = 2
  const W = 14
  const color = 0xaaaaaa
  const shieldColor = 0xdddddd
  const seedColor = 0xffffff

  makeTexture(scene, TEX.ENEMY_SHIELDED, W * S, W * S, (g) => {
    const cx = 8
    const cy = 7
    const coreR = 4
    const maxR = 6

    // Body — circle with extra dissolution
    drawDissolving({
      g, cx, cy,
      coreRadius: coreR,
      maxRadius: maxR,
      color,
      seedColor,
      s: S,
      seed: currentSeed + 6,
      dissolution: currentDissolution * 1.1,
      shape: 'circle',
      scatterCount: Math.floor(8 + currentDissolution * 15),
    })

    // Shield bar on left side — SOLID, no dissolution (the shield IS coherence)
    for (let sy = cy - 5; sy <= cy + 5; sy++) {
      pixel(g, cx - maxR, sy, shieldColor, 1.0, S)
      pixel(g, cx - maxR - 1, sy, shieldColor, 0.8, S)
      pixel(g, cx - maxR + 1, sy, lighter(shieldColor, 30), 0.6, S)
    }
    // Shield highlight
    pixel(g, cx - maxR - 1, cy - 4, 0xffffff, 0.9, S)
    pixel(g, cx - maxR - 1, cy - 3, 0xffffff, 0.7, S)

    // Eye
    pixel(g, cx + 1, cy, 0xffffff, 0.9, S)
    pixel(g, cx + 1, cy + 1, 0x111111, 1, S)
  })
}

// Exploder: orange pulsing sphere, entire body looks unstable
export function generateEnemyExploder(scene: Phaser.Scene): void {
  const S = 2
  const W = 12
  const color = 0xdddddd
  const seedColor = 0xffffaa

  makeTexture(scene, TEX.ENEMY_EXPLODER, W * S, W * S, (g) => {
    const cx = 6
    const cy = 6
    const coreR = 3
    const maxR = 5

    // Unstable sphere — EXTRA dissolution (this thing is about to blow)
    drawDissolving({
      g, cx, cy,
      coreRadius: coreR,
      maxRadius: maxR,
      color,
      seedColor,
      s: S,
      seed: currentSeed + 7,
      dissolution: Math.min(0.95, currentDissolution * 1.5 + 0.2), // always unstable
      shape: 'circle',
      scatterCount: Math.floor(15 + currentDissolution * 35),
    })

    // Flickering pixels throughout the body — instability
    for (let py = cy - coreR; py <= cy + coreR; py++) {
      for (let px = cx - coreR; px <= cx + coreR; px++) {
        const noise = hashNoise(px, py, currentSeed + 70)
        if (noise > 0.7) {
          pixel(g, px, py, 0xffffff, 0.3 + noise * 0.4, S)
        }
      }
    }

    // Fuse spark on top
    pixel(g, cx, cy - maxR - 1, 0xffffaa, 0.9, S)
    pixel(g, cx - 1, cy - maxR - 1, 0xffffaa, 0.5, S)
    pixel(g, cx + 1, cy - maxR - 1, 0xffffaa, 0.5, S)
    pixel(g, cx, cy - maxR, 0xffffff, 0.7, S)
  })
}

// Healer: green cross, arms dissolve into tendrils of healing energy
export function generateEnemyHealer(scene: Phaser.Scene): void {
  const S = 2
  const W = 12
  const color = 0xcccccc
  const crossColor = 0xeeeeee
  const seedColor = 0xeeffee

  makeTexture(scene, TEX.ENEMY_HEALER, W * S, W * S, (g) => {
    const cx = 6
    const cy = 6
    const coreR = 4
    const maxR = 5

    // Cross shape with dissolution
    drawDissolving({
      g, cx, cy,
      coreRadius: coreR,
      maxRadius: maxR,
      color,
      seedColor,
      s: S,
      seed: currentSeed + 8,
      dissolution: currentDissolution * 1.1,
      shape: 'cross',
      scatterColor: crossColor,
      scatterCount: Math.floor(10 + currentDissolution * 20),
    })

    // Cross arm highlights — brighter pixels along the cross
    for (let dx = -1; dx <= 1; dx++) {
      for (let dy = -coreR; dy <= coreR; dy++) {
        if (Math.abs(dx) <= 0 || Math.abs(dy) <= 1) {
          const noise = hashNoise(cx + dx, cy + dy, currentSeed + 80)
          if (noise > 0.5) {
            pixel(g, cx + dx, cy + dy, crossColor, 0.4, S)
          }
        }
      }
    }

    // Healing tendrils — extend from cross arm tips
    const armDirs = [[0, -1], [0, 1], [-1, 0], [1, 0]]
    for (const [ddx, ddy] of armDirs) {
      const tendrilLen = 2 + Math.floor(hashNoise(ddx + 2, ddy + 2, currentSeed + 81) * 3)
      for (let step = 0; step < tendrilLen; step++) {
        const tx = cx + ddx * (maxR + step)
        const ty = cy + ddy * (maxR + step)
        const wobble = hashNoise(step, ddx + ddy, currentSeed + 82) - 0.5
        const alpha = 0.3 * (1 - step / tendrilLen)
        pixel(g, Math.round(tx + wobble), Math.round(ty + wobble), crossColor, alpha, S)
      }
    }
  })
}

// Summoner: purple void with coherent ring, center is pure noise
export function generateEnemySummoner(scene: Phaser.Scene): void {
  const S = 2
  const W = 14
  const color = 0xbbbbbb
  const portalColor = 0xffffff
  const seedColor = 0xddccff

  makeTexture(scene, TEX.ENEMY_SUMMONER, W * S, W * S, (g) => {
    const cx = 7
    const cy = 7
    const coreR = 5
    const maxR = 6

    // Ring shape — coherent outer boundary, void in center
    drawDissolving({
      g, cx, cy,
      coreRadius: coreR,
      maxRadius: maxR,
      color,
      seedColor,
      s: S,
      seed: currentSeed + 9,
      dissolution: currentDissolution * 1.0,
      shape: 'ring',
      scatterCount: Math.floor(12 + currentDissolution * 25),
    })

    // Center void — pure noise (a portal in latent space)
    const voidR = Math.floor(coreR * 0.45)
    for (let py = cy - voidR; py <= cy + voidR; py++) {
      for (let px = cx - voidR; px <= cx + voidR; px++) {
        const d = dist(px, py, cx, cy)
        if (d <= voidR) {
          const noise = hashNoise(px * 3, py * 3, currentSeed + 90)
          // Pure noise — random bright/dark pixels
          const noiseColor = noise > 0.6 ? portalColor : noise > 0.3 ? darker(color, 40) : 0x111111
          const alpha = 0.3 + noise * 0.5
          pixel(g, px, py, noiseColor, alpha, S)
        }
      }
    }
  })
}

// ═══════════════════════════════════════════════════════════════════
// BOSS — The most abstract entity
// 32x32 at 2x = 64x64
// A massive concentration of noise with a coherent eye/core
// Orbiting fragments that are half-resolved shapes
// The boss IS the latent space trying to maintain coherence
// ═══════════════════════════════════════════════════════════════════

export function generateEnemyBoss(scene: Phaser.Scene): void {
  const S = 2
  const W = 32
  const color = 0xbbbbbb
  const bodyDark = 0x888888
  const seedColor = 0xddaaff
  const veinColor = 0xccbbdd

  makeTexture(scene, TEX.ENEMY_BOSS, W * S, W * S, (g) => {
    const cx = 16
    const cy = 16
    const coreR = 10
    const maxR = 14

    // Main body — massive dissolving circle
    drawDissolving({
      g, cx, cy,
      coreRadius: coreR,
      maxRadius: maxR,
      color,
      seedColor,
      s: S,
      seed: currentSeed + 10,
      dissolution: Math.min(0.85, currentDissolution * 1.4 + 0.1), // boss is always somewhat abstract
      shape: 'circle',
      scatterCount: Math.floor(30 + currentDissolution * 60),
      scatterColor: veinColor,
    })

    // Vein network — purple-ish lines radiating from center
    const veinCount = 6 + Math.floor(currentDissolution * 4)
    for (let i = 0; i < veinCount; i++) {
      const angle = (i / veinCount) * Math.PI * 2 + hashNoise(i, 0, currentSeed + 100) * 0.3
      const length = coreR + hashNoise(i, 1, currentSeed + 100) * 4
      for (let step = 2; step < length; step++) {
        const wobble = (hashNoise(step, i, currentSeed + 101) - 0.5) * 1.5
        const px = cx + Math.cos(angle) * step + Math.sin(angle) * wobble
        const py = cy + Math.sin(angle) * step - Math.cos(angle) * wobble
        const alpha = 0.3 * (1 - step / length)
        pixel(g, Math.round(px), Math.round(py), veinColor, alpha, S)
      }
    }

    // Central eye — sharp, imposing
    // Eye white
    for (let ey = cy - 3; ey <= cy + 3; ey++) {
      for (let ex = cx - 5; ex <= cx + 5; ex++) {
        const dx = (ex - cx) * 0.6
        const dy = ey - cy
        if (Math.sqrt(dx * dx + dy * dy) < 3) {
          pixel(g, ex, ey, 0xffffff, 0.95, S)
        }
      }
    }
    // Iris
    for (let ey = cy - 2; ey <= cy + 2; ey++) {
      for (let ex = cx - 2; ex <= cx + 2; ex++) {
        const d = dist(ex, ey, cx, cy)
        if (d < 2.5) {
          pixel(g, ex, ey, 0xdddddd, 0.9, S)
        }
      }
    }
    // Pupil
    pixel(g, cx, cy, 0x111111, 1, S)
    pixel(g, cx - 1, cy, 0x111111, 1, S)
    pixel(g, cx, cy - 1, 0x111111, 1, S)
    pixel(g, cx - 1, cy - 1, 0x111111, 1, S)
    // Pupil highlight
    pixel(g, cx - 1, cy - 1, 0x333333, 0.5, S)

    // Orbiting fragments — half-resolved shapes at the edges
    const orbCount = 4
    for (let i = 0; i < orbCount; i++) {
      const angle = (i / orbCount) * Math.PI * 2
      const orbX = cx + Math.cos(angle) * (maxR - 1)
      const orbY = cy + Math.sin(angle) * (maxR - 1)
      const orbR = 2
      // Small dissolving circles
      for (let py = orbY - orbR; py <= orbY + orbR; py++) {
        for (let px = orbX - orbR; px <= orbX + orbR; px++) {
          const d = dist(px, py, orbX, orbY)
          if (d <= orbR) {
            const noise = hashNoise(px, py, currentSeed + 110 + i)
            const alpha = (1 - d / orbR) * (0.4 + noise * 0.5)
            pixel(g, Math.round(px), Math.round(py), 0xeeeeee, alpha, S)
          }
        }
      }
    }
  })
}

// ═══════════════════════════════════════════════════════════════════
// WALL — Latent space boundary
// 32x32 (1:1)
// Solid enough to read as walls, surface has noise texture
// Edges between wall and floor bleed — no sharp boundaries
// Deeper floors: walls become more abstract
// ═══════════════════════════════════════════════════════════════════

export function generateWall(scene: Phaser.Scene): void {
  const W = 32
  const base = 0x2a2535
  const baseLight = 0x342f40
  const baseDark = 0x201c2a

  makeTexture(scene, TEX.WALL, W, W, (g) => {
    // Fill with base color
    for (let y = 0; y < W; y++) {
      for (let x = 0; x < W; x++) {
        const noise = hashNoise(x, y, currentSeed + 200)
        const noise2 = hashNoise(x * 3, y * 3, currentSeed + 201)

        // Base color with noise variation
        let color = base
        if (noise > 0.7) color = baseLight
        else if (noise < 0.3) color = baseDark

        pixel(g, x, y, color, 1.0)

        // Subtle color noise — pixels slightly off-hue (not all same shade)
        if (noise2 > 0.85) {
          // Occasional warm or cool shift
          const shift = noise2 > 0.92 ? 0x0a0505 : 0x050508 // warm red or cool blue tint
          pixel(g, x, y, lighter(color, 8), 0.3)
          pixel(g, x, y, shift, 0.15)
        }

        // Dissolution noise — more with depth
        if (currentDissolution > 0.2) {
          const dissNoise = hashNoise(x * 7, y * 7, currentSeed + 202)
          if (dissNoise > (1 - currentDissolution * 0.5)) {
            pixel(g, x, y, dissNoise > 0.9 ? 0x443366 : 0x111118, 0.2 + currentDissolution * 0.3)
          }
        }
      }
    }

    // Brick pattern hint — very subtle, fading with dissolution
    const brickAlpha = 0.15 * (1 - currentDissolution * 0.7)
    if (brickAlpha > 0.03) {
      // Horizontal grout lines
      for (let x = 0; x < W; x++) {
        pixel(g, x, 8, baseDark, brickAlpha)
        pixel(g, x, 16, baseDark, brickAlpha)
        pixel(g, x, 24, baseDark, brickAlpha)
      }
      // Vertical grout — offset per row
      for (let y = 0; y < 8; y++) pixel(g, 10, y, baseDark, brickAlpha)
      for (let y = 0; y < 8; y++) pixel(g, 22, y, baseDark, brickAlpha)
      for (let y = 9; y < 16; y++) pixel(g, 5, y, baseDark, brickAlpha)
      for (let y = 9; y < 16; y++) pixel(g, 16, y, baseDark, brickAlpha)
      for (let y = 17; y < 24; y++) pixel(g, 12, y, baseDark, brickAlpha)
      for (let y = 17; y < 24; y++) pixel(g, 22, y, baseDark, brickAlpha)
    }

    // Edge dissolution — border pixels fade out for wall-floor blending
    const edgeFade = 0.3 + currentDissolution * 0.4
    for (let i = 0; i < W; i++) {
      const noise1 = hashNoise(i, 0, currentSeed + 210)
      const noise2 = hashNoise(i, W - 1, currentSeed + 211)
      // Top and bottom edges
      pixel(g, i, 0, 0x0d0d1a, noise1 * edgeFade)
      pixel(g, i, 1, 0x0d0d1a, noise1 * edgeFade * 0.5)
      pixel(g, i, W - 1, 0x0d0d1a, noise2 * edgeFade)
      pixel(g, i, W - 2, 0x0d0d1a, noise2 * edgeFade * 0.5)
      // Left and right edges
      const noise3 = hashNoise(0, i, currentSeed + 212)
      const noise4 = hashNoise(W - 1, i, currentSeed + 213)
      pixel(g, 0, i, 0x0d0d1a, noise3 * edgeFade)
      pixel(g, 1, i, 0x0d0d1a, noise3 * edgeFade * 0.5)
      pixel(g, W - 1, i, 0x0d0d1a, noise4 * edgeFade)
      pixel(g, W - 2, i, 0x0d0d1a, noise4 * edgeFade * 0.5)
    }
  })
}

// ═══════════════════════════════════════════════════════════════════
// FLOOR — The substrate of latent space
// 32x32 (1:1)
// Dark base with subtle noise grain (TV static at low opacity)
// Faint grid pattern that sometimes misaligns
// Occasional bright noise pixels ("hot pixels" in the generation)
// Deeper floors: more visible noise, grid distortion
// ═══════════════════════════════════════════════════════════════════

export function generateFloor(scene: Phaser.Scene): void {
  const W = 32
  const base = 0x0d0d1a
  const baseLighter = 0x10101f
  const baseDarker = 0x0a0a15

  makeTexture(scene, TEX.FLOOR, W, W, (g) => {
    // Fill base with subtle variation
    for (let y = 0; y < W; y++) {
      for (let x = 0; x < W; x++) {
        const noise = hashNoise(x, y, currentSeed + 300)
        let color = base
        if (noise > 0.7) color = baseLighter
        else if (noise < 0.3) color = baseDarker

        pixel(g, x, y, color, 1.0)

        // Noise grain — TV static at very low opacity
        const grainNoise = hashNoise(x * 5, y * 5, currentSeed + 301)
        const grainAlpha = 0.03 + currentDissolution * 0.08 // more visible on deeper floors
        if (grainNoise > 0.6) {
          pixel(g, x, y, grainNoise > 0.85 ? 0x333344 : 0x1a1a2a, grainAlpha)
        }
      }
    }

    // Faint grid pattern — latent space grid showing through
    const gridAlpha = 0.08 + currentDissolution * 0.12
    const gridMisalign = currentDissolution * 0.5 // grid distortion increases with depth
    for (let i = 0; i < W; i++) {
      // Horizontal grid every 8px with possible misalignment
      const hOffset = Math.floor(hashNoise(i, 0, currentSeed + 310) * gridMisalign)
      for (const gridY of [8, 16, 24]) {
        const actualY = gridY + hOffset
        if (actualY >= 0 && actualY < W) {
          pixel(g, i, actualY, 0x1a1a2e, gridAlpha)
        }
      }
      // Vertical grid every 8px
      const vOffset = Math.floor(hashNoise(0, i, currentSeed + 311) * gridMisalign)
      for (const gridX of [8, 16, 24]) {
        const actualX = gridX + vOffset
        if (actualX >= 0 && actualX < W) {
          pixel(g, actualX, i, 0x1a1a2e, gridAlpha)
        }
      }
    }

    // Hot pixels — occasional bright noise specks
    const hotPixelChance = 0.01 + currentDissolution * 0.03
    for (let y = 0; y < W; y++) {
      for (let x = 0; x < W; x++) {
        const hotNoise = hashNoise(x * 11, y * 11, currentSeed + 320)
        if (hotNoise > (1 - hotPixelChance)) {
          const brightness = hotNoise > 0.995 ? 0x6666aa : 0x4444aa
          pixel(g, x, y, brightness, 0.3 + hotNoise * 0.4)
        }
      }
    }
  })
}

// ═══════════════════════════════════════════════════════════════════
// PROJECTILE — Pure signal in the noise
// 8x8 at 2x = 16x16
// The most "resolved" thing in the game — a bright concentrated point
// Surrounded by dissolving halo
// ═══════════════════════════════════════════════════════════════════

export function generateProjectile(scene: Phaser.Scene): void {
  const S = 2
  const W = 8
  const core = 0xffff44
  const coreHot = 0xffffcc
  const tip = 0xffffff
  const haloColor = 0xffee22

  makeTexture(scene, TEX.PROJECTILE, W * S, W * S, (g) => {
    const cx = 4
    const cy = 4
    const coreR = 1.5
    const haloR = 3

    // Bright core — maximum coherence (pure signal)
    pixel(g, cx, cy, tip, 1.0, S)
    pixel(g, cx - 1, cy, coreHot, 1.0, S)
    pixel(g, cx + 1, cy, coreHot, 1.0, S)
    pixel(g, cx, cy - 1, coreHot, 1.0, S)
    pixel(g, cx, cy + 1, coreHot, 0.9, S)

    // Dissolving halo
    for (let py = cy - haloR - 1; py <= cy + haloR + 1; py++) {
      for (let px = cx - haloR - 1; px <= cx + haloR + 1; px++) {
        const d = dist(px, py, cx, cy)
        if (d <= coreR || d > haloR) continue
        const noise = hashNoise(px, py, currentSeed + 400)
        const alpha = (1 - (d - coreR) / (haloR - coreR)) * (0.3 + noise * 0.4)
        if (alpha > 0.05) {
          pixel(g, px, py, noise > 0.5 ? core : haloColor, alpha, S)
        }
      }
    }

    // Scatter sparks
    const scatterCount = 4 + Math.floor(currentDissolution * 6)
    for (let i = 0; i < scatterCount; i++) {
      const angle = hashNoise(i, 0, currentSeed + 410) * Math.PI * 2
      const sd = haloR + hashNoise(i, 1, currentSeed + 410) * 1.5
      const px = cx + Math.cos(angle) * sd
      const py = cy + Math.sin(angle) * sd
      pixel(g, Math.round(px), Math.round(py), haloColor, 0.15 + hashNoise(i, 2, currentSeed + 410) * 0.2, S)
    }
  })
}
