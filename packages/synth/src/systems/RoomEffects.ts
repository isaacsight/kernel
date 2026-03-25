// SYNTH — Room Effects
// Visual identity per room type. Each room should FEEL different the instant you enter.
// Design Bible §VI: "Rooms need IDENTITY, not just different wall layouts."

import Phaser from 'phaser'
import type { RoomType } from '../types'

// ── Room Theme Palettes ──────────────────────────────────────────────

interface RoomPalette {
  /** Ambient overlay color (full-screen tint) */
  ambientColor: number
  /** Ambient overlay alpha */
  ambientAlpha: number
  /** Camera background color */
  bgColor: number
  /** Particle color for floating motes */
  particleColor: number
  /** Particle alpha */
  particleAlpha: number
  /** Particle count */
  particleCount: number
  /** Vignette intensity (0 = none, 1 = heavy) */
  vignette: number
}

// Diablo-style palettes: dark, desaturated, warm highlights
const ROOM_PALETTES: Record<RoomType, RoomPalette> = {
  arena: {
    ambientColor: 0x1a1208,
    ambientAlpha: 0.06,
    bgColor: 0x0a0806,
    particleColor: 0xaa8844,
    particleAlpha: 0.10,
    particleCount: 10,
    vignette: 0.28,
  },
  treasure: {
    ambientColor: 0x2a1a08,
    ambientAlpha: 0.08,
    bgColor: 0x0e0a04,
    particleColor: 0xddaa33,
    particleAlpha: 0.15,
    particleCount: 18,
    vignette: 0.22,
  },
  boss: {
    ambientColor: 0x220008,
    ambientAlpha: 0.12,
    bgColor: 0x0a0004,
    particleColor: 0xff2244,
    particleAlpha: 0.12,
    particleCount: 14,
    vignette: 0.30,
  },
  corridor: {
    ambientColor: 0x0a0a10,
    ambientAlpha: 0.15,
    bgColor: 0x060608,
    particleColor: 0x556644,
    particleAlpha: 0.06,
    particleCount: 6,
    vignette: 0.35,
  },
}

// ── Active effect tracking ──

/** Tracks all game objects created by the current theme so we can tear them down. */
interface ActiveTheme {
  overlay: Phaser.GameObjects.Rectangle
  vignette: Phaser.GameObjects.Graphics
  particles: Phaser.GameObjects.Arc[]
  tweens: Phaser.Tweens.Tween[]
  edgePulse?: Phaser.Tweens.Tween
}

const themeMap = new WeakMap<Phaser.Scene, ActiveTheme>()

// ── Public API ───────────────────────────────────────────────────────

export class RoomEffects {
  /**
   * Apply a visual theme to the scene based on room type.
   * Tears down any existing theme first, then layers in:
   *   - Camera background tint
   *   - Full-screen ambient overlay
   *   - Floating ambient particles
   *   - Vignette overlay
   *   - Boss-specific pulsing edge glow
   */
  static applyTheme(scene: Phaser.Scene, roomType: RoomType): void {
    // Clean previous theme
    RoomEffects.clearTheme(scene)

    const palette = ROOM_PALETTES[roomType]
    const cam = scene.cameras.main

    // Camera background
    cam.setBackgroundColor(palette.bgColor)

    // Full-screen ambient overlay
    const overlay = scene.add.rectangle(
      cam.centerX, cam.centerY,
      cam.width, cam.height,
      palette.ambientColor, palette.ambientAlpha,
    ).setDepth(80).setScrollFactor(0)

    // Vignette
    const vignette = RoomEffects.buildVignette(scene, palette.vignette)

    // Floating particles
    const particles: Phaser.GameObjects.Arc[] = []
    const tweens: Phaser.Tweens.Tween[] = []

    for (let i = 0; i < palette.particleCount; i++) {
      const px = Math.random() * cam.width
      const py = Math.random() * cam.height
      const size = 0.5 + Math.random() * 1.5
      const p = scene.add.circle(px, py, size, palette.particleColor, palette.particleAlpha)
        .setDepth(2)
        .setScrollFactor(0.3)
      particles.push(p)

      const tw = scene.tweens.add({
        targets: p,
        y: py - 20 - Math.random() * 30,
        x: px + (Math.random() - 0.5) * 15,
        alpha: 0,
        duration: 4000 + Math.random() * 3000,
        ease: 'Sine.easeInOut',
        repeat: -1,
        yoyo: true,
      })
      tweens.push(tw)
    }

    const activeTheme: ActiveTheme = { overlay, vignette, particles, tweens }

    // Boss-specific: pulsing red edges
    if (roomType === 'boss') {
      const edgeRect = scene.add.rectangle(
        cam.centerX, cam.centerY,
        cam.width, cam.height,
      ).setDepth(81).setScrollFactor(0).setFillStyle()
      edgeRect.setStrokeStyle(6, 0xff0022, 0.15)

      particles.push(edgeRect as unknown as Phaser.GameObjects.Arc) // track for cleanup

      const edgeTween = scene.tweens.add({
        targets: edgeRect,
        alpha: 0.6,
        duration: 1500,
        ease: 'Sine.easeInOut',
        yoyo: true,
        repeat: -1,
      })
      activeTheme.edgePulse = edgeTween
      tweens.push(edgeTween)
    }

    themeMap.set(scene, activeTheme)
  }

  /** Remove all theme objects from the scene. */
  static clearTheme(scene: Phaser.Scene): void {
    const prev = themeMap.get(scene)
    if (!prev) return

    for (const tw of prev.tweens) {
      tw.destroy()
    }
    for (const p of prev.particles) {
      p.destroy()
    }
    prev.overlay.destroy()
    prev.vignette.destroy()
    themeMap.delete(scene)
  }

  // ── Transition Effects ─────────────────────────────────────────────

  /**
   * Fade to black. Returns a promise that resolves when the fade is complete.
   * Default duration: 300ms.
   */
  static fadeToBlack(scene: Phaser.Scene, duration = 300): Promise<void> {
    return new Promise<void>((resolve) => {
      const cam = scene.cameras.main
      const overlay = scene.add.rectangle(
        cam.centerX, cam.centerY,
        cam.width, cam.height,
        0x000000, 0,
      ).setDepth(200).setScrollFactor(0)

      scene.tweens.add({
        targets: overlay,
        alpha: 1,
        duration,
        ease: 'Quad.easeIn',
        onComplete: () => {
          // Keep the overlay alive — fadeFromBlack will handle it
          ;(scene as unknown as Record<string, unknown>).__synthFadeOverlay = overlay
          resolve()
        },
      })
    })
  }

  /**
   * Fade from black (reveal). Cleans up the overlay left by fadeToBlack.
   * If no prior overlay exists, creates one at full opacity and fades it out.
   * Default duration: 300ms.
   */
  static fadeFromBlack(scene: Phaser.Scene, duration = 300): Promise<void> {
    return new Promise<void>((resolve) => {
      const cam = scene.cameras.main
      let overlay = (scene as unknown as Record<string, unknown>).__synthFadeOverlay as
        Phaser.GameObjects.Rectangle | undefined

      if (!overlay || !overlay.active) {
        overlay = scene.add.rectangle(
          cam.centerX, cam.centerY,
          cam.width, cam.height,
          0x000000, 1,
        ).setDepth(200).setScrollFactor(0)
      }

      scene.tweens.add({
        targets: overlay,
        alpha: 0,
        duration,
        ease: 'Quad.easeOut',
        onComplete: () => {
          overlay!.destroy()
          ;(scene as unknown as Record<string, unknown>).__synthFadeOverlay = undefined
          resolve()
        },
      })
    })
  }

  // ── Room-Clear Celebration ─────────────────────────────────────────

  /**
   * Big satisfying feedback when all enemies are dead:
   *   1. Brief slow-mo (200ms)
   *   2. Bright white flash
   *   3. Particle burst from screen center
   *   4. Doors glow (handled externally by DoorSystem)
   */
  static roomClearEffect(scene: Phaser.Scene): void {
    const cam = scene.cameras.main

    // 1. Slow-mo
    scene.time.timeScale = 0.3
    scene.tweens.add({
      targets: scene.time,
      timeScale: 1,
      duration: 200,
      ease: 'Cubic.easeIn',
    })

    // 2. White flash
    const flash = scene.add.rectangle(
      cam.centerX, cam.centerY,
      cam.width, cam.height,
      0xffffff, 0.35,
    ).setDepth(150).setScrollFactor(0)

    scene.tweens.add({
      targets: flash,
      alpha: 0,
      duration: 400,
      ease: 'Expo.easeOut',
      onComplete: () => flash.destroy(),
    })

    // 3. Particle burst from screen center
    const cx = cam.scrollX + cam.width / 2
    const cy = cam.scrollY + cam.height / 2
    const burstCount = 20

    for (let i = 0; i < burstCount; i++) {
      const angle = (Math.PI * 2 * i) / burstCount + (Math.random() - 0.5) * 0.4
      const dist = 60 + Math.random() * 80
      const size = 1.5 + Math.random() * 2
      const color = Math.random() > 0.5 ? 0x44ff88 : 0xffffff

      const p = scene.add.circle(cx, cy, size, color, 0.8).setDepth(151)
      scene.tweens.add({
        targets: p,
        x: cx + Math.cos(angle) * dist,
        y: cy + Math.sin(angle) * dist,
        alpha: 0,
        scale: 0.2,
        duration: 350 + Math.random() * 200,
        ease: 'Cubic.easeOut',
        onComplete: () => p.destroy(),
      })
    }

    // Expanding ring
    const ring = scene.add.circle(cx, cy, 4, 0x44ff88, 0).setDepth(151)
    ring.setStrokeStyle(2, 0x44ff88, 0.8)
    scene.tweens.add({
      targets: ring,
      radius: 100,
      alpha: 0,
      duration: 400,
      ease: 'Expo.easeOut',
      onComplete: () => ring.destroy(),
    })
  }

  // ── Helpers ────────────────────────────────────────────────────────

  /** Build a vignette overlay (concentric rect approximation). */
  private static buildVignette(scene: Phaser.Scene, intensity: number): Phaser.GameObjects.Graphics {
    const w = scene.cameras.main.width
    const h = scene.cameras.main.height
    const g = scene.add.graphics().setDepth(90).setScrollFactor(0)

    const steps = 8
    for (let i = 0; i < steps; i++) {
      const ratio = i / steps
      const alpha = ratio * ratio * intensity
      const inset = ratio * Math.min(w, h) * 0.15
      g.fillStyle(0x000000, alpha)
      g.fillRect(
        inset * (i === 0 ? 0 : 1),
        inset * (i === 0 ? 0 : 1),
        w - inset * 2,
        h - inset * 2,
      )
    }

    return g
  }
}
