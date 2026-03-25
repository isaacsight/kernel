// SYNTH — Visual Effects System
// This is what makes colored shapes look like art.
// Particles, trails, screen effects, atmosphere.

import Phaser from 'phaser'

// ── Screen Shake ──────────────────────────────────────────────────────

export function screenShake(scene: Phaser.Scene, intensity = 4, duration = 120): void {
  scene.cameras.main.shake(duration, intensity / 1000)
}

export function screenShakeDirectional(scene: Phaser.Scene, angle: number, intensity = 6): void {
  const cam = scene.cameras.main
  const ox = Math.cos(angle) * intensity
  const oy = Math.sin(angle) * intensity
  cam.setScroll(cam.scrollX + ox, cam.scrollY + oy)
  scene.tweens.add({
    targets: cam,
    scrollX: cam.scrollX - ox,
    scrollY: cam.scrollY - oy,
    duration: 80,
    ease: 'Expo.easeOut',
  })
}

// ── Hitstop (freeze frames) — Diablo weight ─────────────────────────
// Every hit should LAND. 60-80ms for normal, 120ms for crits.

export function hitstop(scene: Phaser.Scene, durationMs = 70): void {
  scene.physics.world.timeScale = 20 // nearly frozen
  scene.time.delayedCall(durationMs, () => {
    scene.physics.world.timeScale = 1
  })
}

// ── Camera Zoom Punch on Kill ────────────────────────────────────────
// Subtle 1.02x zoom that Diablo does — makes kills feel definitive.

export function killZoomPunch(scene: Phaser.Scene, scale = 1.02, durationMs = 100): void {
  scene.cameras.main.setZoom(scale)
  scene.tweens.add({
    targets: scene.cameras.main,
    zoom: 1.0,
    duration: durationMs,
    ease: 'Sine.easeOut',
  })
}

// ── Critical Hit Sparks — bigger, bolder ─────────────────────────────

export function critSparks(scene: Phaser.Scene, x: number, y: number, color = 0xffff44): void {
  // More sparks, bigger, brighter — the crit should feel SPECIAL
  hitSparks(scene, x, y, color, 12)
  hitSparks(scene, x, y, 0xffffff, 6)

  // Extra flash ring
  const ring = scene.add.circle(x, y, 4, 0xffffff, 0.9).setDepth(16)
  scene.tweens.add({
    targets: ring,
    scale: 5,
    alpha: 0,
    duration: 200,
    ease: 'Expo.easeOut',
    onComplete: () => ring.destroy(),
  })

  // "CRIT" floating text
  const text = scene.add.text(x, y - 20, 'CRIT!', {
    fontFamily: 'monospace',
    fontSize: '14px',
    color: '#ffff44',
    fontStyle: 'bold',
    stroke: '#000000',
    strokeThickness: 2,
  }).setOrigin(0.5).setDepth(26)
  scene.tweens.add({
    targets: text,
    y: y - 50,
    alpha: 0,
    scale: 1.5,
    duration: 800,
    ease: 'Cubic.easeOut',
    onComplete: () => text.destroy(),
  })
}

// ── Time Dilation (slow-mo on kill) ──────────────────────────────────

export function killSlowmo(scene: Phaser.Scene): void {
  scene.time.timeScale = 0.3
  scene.tweens.add({
    targets: scene.time,
    timeScale: 1,
    duration: 200,
    ease: 'Cubic.easeIn',
  })
}

// ── Flash Overlay ────────────────────────────────────────────────────

export function flashWhite(scene: Phaser.Scene, alpha = 0.3, duration = 60): void {
  const flash = scene.add.rectangle(
    scene.cameras.main.centerX, scene.cameras.main.centerY,
    scene.cameras.main.width, scene.cameras.main.height,
    0xffffff, alpha
  ).setDepth(100).setScrollFactor(0)

  scene.tweens.add({
    targets: flash,
    alpha: 0,
    duration,
    ease: 'Expo.easeOut',
    onComplete: () => flash.destroy(),
  })
}

// ── Hit Sparks (particle burst) ──────────────────────────────────────

export function hitSparks(scene: Phaser.Scene, x: number, y: number, color = 0xffffff, count = 6): void {
  for (let i = 0; i < count; i++) {
    const angle = (Math.PI * 2 * i) / count + (Math.random() - 0.5) * 0.5
    const speed = 80 + Math.random() * 120
    const size = 1 + Math.random() * 2

    const spark = scene.add.circle(x, y, size, color).setDepth(15)

    scene.tweens.add({
      targets: spark,
      x: x + Math.cos(angle) * speed * 0.3,
      y: y + Math.sin(angle) * speed * 0.3,
      alpha: 0,
      scale: 0,
      duration: 150 + Math.random() * 100,
      ease: 'Expo.easeOut',
      onComplete: () => spark.destroy(),
    })
  }
}

// ── Death Dissolve — Dramatic pixel scatter ─────────────────────────
// Entities don't just disappear — their pixels scatter outward in a
// dramatic dissolve. More particles, varied colors based on entity type,
// multiple rings, lingering embers.

/** Color palette variations per entity type for richer death effects */
const DEATH_PALETTES: Record<string, number[]> = {
  player: [0x4488ff, 0x66aaff, 0x2266dd, 0xffffff],
  partner: [0x44ff88, 0x66ffaa, 0x22dd66, 0xffffff],
  enemy: [0xff4444, 0xff6644, 0xdd2222, 0xff8844, 0xffaa22],
  boss: [0xcc00ff, 0xff44ff, 0x8800cc, 0xff88ff, 0xffffff],
}

function getDeathPalette(color: number): number[] {
  if (color === 0x4488ff) return DEATH_PALETTES.player
  if (color === 0x44ff88) return DEATH_PALETTES.partner
  if (color === 0xcc00ff || color === 0x8844ff) return DEATH_PALETTES.boss
  return [color, 0xff6644, 0xdd2222, 0xff8844, 0xffaa22]
}

export function deathExplosion(scene: Phaser.Scene, x: number, y: number, color: number, size = 12): void {
  const palette = getDeathPalette(color)
  const pickColor = (): number => palette[Math.floor(Math.random() * palette.length)]

  // Double ring expansion (inner fast, outer slow)
  const ring1 = scene.add.circle(x, y, 2, color, 0).setDepth(14)
  ring1.setStrokeStyle(2, color, 1)
  scene.tweens.add({
    targets: ring1,
    radius: size * 3,
    alpha: 0,
    duration: 300,
    ease: 'Expo.easeOut',
    onComplete: () => ring1.destroy(),
  })

  const ring2 = scene.add.circle(x, y, 2, 0xffffff, 0).setDepth(14)
  ring2.setStrokeStyle(1, 0xffffff, 0.6)
  scene.tweens.add({
    targets: ring2,
    radius: size * 5,
    alpha: 0,
    duration: 500,
    ease: 'Cubic.easeOut',
    delay: 50,
    onComplete: () => ring2.destroy(),
  })

  // Primary particle burst — 24 particles with varied sizes and colors
  const particleCount = 24
  for (let i = 0; i < particleCount; i++) {
    const angle = (Math.PI * 2 * i) / particleCount + (Math.random() - 0.5) * 0.5
    const dist = 25 + Math.random() * 55
    const pSize = 1 + Math.random() * 3.5
    const pColor = pickColor()

    const p = scene.add.circle(x, y, pSize, pColor).setDepth(15)
    scene.tweens.add({
      targets: p,
      x: x + Math.cos(angle) * dist,
      y: y + Math.sin(angle) * dist,
      alpha: 0,
      scale: 0.1,
      duration: 250 + Math.random() * 300,
      ease: 'Cubic.easeOut',
      onComplete: () => p.destroy(),
    })
  }

  // Slow-drifting embers that linger and float upward
  const emberCount = 10
  for (let i = 0; i < emberCount; i++) {
    const angle = Math.random() * Math.PI * 2
    const dist = 15 + Math.random() * 35
    const pSize = 0.5 + Math.random() * 1.5
    const pColor = pickColor()

    const ember = scene.add.circle(x, y, pSize, pColor, 0.8).setDepth(15)
    scene.tweens.add({
      targets: ember,
      x: x + Math.cos(angle) * dist,
      y: y + Math.sin(angle) * dist - 10 - Math.random() * 20,
      alpha: 0,
      scale: 0.3,
      duration: 500 + Math.random() * 400,
      ease: 'Sine.easeOut',
      onComplete: () => ember.destroy(),
    })
  }

  // Pixel scatter squares for dissolve feel
  const pixelCount = 8
  for (let i = 0; i < pixelCount; i++) {
    const angle = Math.random() * Math.PI * 2
    const dist = 10 + Math.random() * 30
    const pxSize = 2 + Math.random() * 2
    const pColor = pickColor()

    const px = scene.add.rectangle(x, y, pxSize, pxSize, pColor, 0.9).setDepth(15)
    px.setRotation(Math.random() * Math.PI)
    scene.tweens.add({
      targets: px,
      x: x + Math.cos(angle) * dist,
      y: y + Math.sin(angle) * dist,
      alpha: 0,
      rotation: px.rotation + (Math.random() - 0.5) * 3,
      scale: 0.2,
      duration: 300 + Math.random() * 250,
      ease: 'Cubic.easeOut',
      onComplete: () => px.destroy(),
    })
  }

  // Core flash (brighter, larger)
  const core = scene.add.circle(x, y, size * 0.8, 0xffffff, 0.9).setDepth(16)
  scene.tweens.add({
    targets: core,
    scale: 2.5,
    alpha: 0,
    duration: 180,
    ease: 'Expo.easeOut',
    onComplete: () => core.destroy(),
  })

  // Ground scorch mark that fades slowly
  const scorch = scene.add.circle(x, y, size * 0.6, color, 0.15).setDepth(1)
  scene.tweens.add({
    targets: scorch,
    alpha: 0,
    duration: 2000,
    ease: 'Sine.easeIn',
    onComplete: () => scorch.destroy(),
  })
}

// ── Dash Trail ───────────────────────────────────────────────────────

export function dashTrail(scene: Phaser.Scene, x: number, y: number, color: number, width = 24, height = 24): void {
  const ghost = scene.add.rectangle(x, y, width, height, color, 0.4).setDepth(5)
  scene.tweens.add({
    targets: ghost,
    alpha: 0,
    scale: 0.6,
    duration: 200,
    ease: 'Quad.easeOut',
    onComplete: () => ghost.destroy(),
  })
}

// ── Ambient Floating Particles ───────────────────────────────────────

export function startAmbientParticles(scene: Phaser.Scene, color = 0x4488ff, count = 15): Phaser.GameObjects.Group {
  const group = scene.add.group()

  for (let i = 0; i < count; i++) {
    const x = Math.random() * scene.cameras.main.width
    const y = Math.random() * scene.cameras.main.height
    const size = 0.5 + Math.random() * 1.5
    const p = scene.add.circle(x, y, size, color, 0.15 + Math.random() * 0.15).setDepth(1)
    group.add(p)

    // Slow floating drift
    scene.tweens.add({
      targets: p,
      y: y - 30 - Math.random() * 40,
      x: x + (Math.random() - 0.5) * 20,
      alpha: 0,
      duration: 3000 + Math.random() * 4000,
      ease: 'Sine.easeInOut',
      repeat: -1,
      yoyo: true,
    })
  }

  return group
}

// ── Muzzle Flash ─────────────────────────────────────────────────────

export function muzzleFlash(scene: Phaser.Scene, x: number, y: number, angle: number, color = 0xffff44): void {
  const fx = x + Math.cos(angle) * 12
  const fy = y + Math.sin(angle) * 12

  const flash = scene.add.circle(fx, fy, 4, color, 0.9).setDepth(15)
  scene.tweens.add({
    targets: flash,
    scale: 2.5,
    alpha: 0,
    duration: 80,
    ease: 'Expo.easeOut',
    onComplete: () => flash.destroy(),
  })
}

// ── Damage Number — PoE/Diablo style ────────────────────────────────
// Larger, spread horizontally, dark outline for readability
// White for normal damage, yellow for crits, red for damage taken

export function damageNumber(scene: Phaser.Scene, x: number, y: number, amount: number, color = '#ff4444', isCrit = false): void {
  const fontSize = isCrit ? '20px' : '14px'
  const displayText = isCrit ? `${amount}!` : `${amount}`
  // Spread horizontally AND vertically (not just straight up)
  const spreadX = (Math.random() - 0.5) * 30
  const startX = x + spreadX
  const startY = y - 12

  const text = scene.add.text(startX, startY, displayText, {
    fontFamily: 'monospace',
    fontSize,
    color: isCrit ? '#ffff44' : color,
    fontStyle: 'bold',
    stroke: '#000000',
    strokeThickness: isCrit ? 4 : 3,
    shadow: {
      offsetX: 1,
      offsetY: 1,
      color: '#000000',
      blur: 4,
      fill: true,
      stroke: true,
    },
  }).setOrigin(0.5).setDepth(25)

  if (isCrit) {
    text.setScale(1.5)
  }

  scene.tweens.add({
    targets: text,
    y: startY - 30 - Math.random() * 15,
    x: startX + (Math.random() - 0.5) * 10,
    alpha: 0,
    scale: isCrit ? 1.0 : 0.7,
    duration: 800,
    ease: 'Cubic.easeOut',
    onComplete: () => text.destroy(),
  })
}

// ── Projectile Trail (afterimage) — PoE bright glowing trails ────────
// 2-3 frame afterimage trail with fading copies

export function projectileTrail(scene: Phaser.Scene, x: number, y: number, color = 0xffff44, fadeDuration = 200): void {
  // Primary ghost (brightest, largest)
  const ghost1 = scene.add.circle(x, y, 3.5, color, 0.7).setDepth(4)
    .setBlendMode(Phaser.BlendModes.ADD)
  scene.tweens.add({
    targets: ghost1,
    alpha: 0,
    scale: 0.15,
    duration: fadeDuration,
    ease: 'Quad.easeOut',
    onComplete: () => ghost1.destroy(),
  })

  // Secondary ghost (dimmer, slightly offset back)
  const ghost2 = scene.add.circle(x, y, 2.5, color, 0.35).setDepth(4)
    .setBlendMode(Phaser.BlendModes.ADD)
  scene.tweens.add({
    targets: ghost2,
    alpha: 0,
    scale: 0.1,
    duration: fadeDuration * 0.7,
    ease: 'Quad.easeOut',
    delay: 15,
    onComplete: () => ghost2.destroy(),
  })

  // Tertiary ghost (faintest)
  const ghost3 = scene.add.circle(x, y, 1.5, color, 0.15).setDepth(4)
  scene.tweens.add({
    targets: ghost3,
    alpha: 0,
    scale: 0.05,
    duration: fadeDuration * 0.5,
    ease: 'Quad.easeOut',
    delay: 30,
    onComplete: () => ghost3.destroy(),
  })
}

// ── Impact Light Spot — brief floor glow on projectile impact ────────

export function impactFlash(scene: Phaser.Scene, x: number, y: number, color = 0xffff44): void {
  const spot = scene.add.circle(x, y, 8, color, 0.05).setDepth(1)
    .setBlendMode(Phaser.BlendModes.ADD)
  scene.tweens.add({
    targets: spot,
    alpha: 0,
    scale: 1.5,
    duration: 200,
    ease: 'Quad.easeOut',
    onComplete: () => spot.destroy(),
  })
}

// ── Screen Flash Effects (combat feedback) ──────────────────────────

/** Red screen flash when player takes a big hit (>20% HP) */
export function flashRedDamage(scene: Phaser.Scene, alpha = 0.1, duration = 100): void {
  const flash = scene.add.rectangle(
    scene.cameras.main.centerX, scene.cameras.main.centerY,
    scene.cameras.main.width, scene.cameras.main.height,
    0xff0000, alpha,
  ).setDepth(100).setScrollFactor(0)

  scene.tweens.add({
    targets: flash,
    alpha: 0,
    duration,
    ease: 'Expo.easeOut',
    onComplete: () => flash.destroy(),
  })
}

/** Brief white flash on crit */
export function flashCritWhite(scene: Phaser.Scene): void {
  const flash = scene.add.rectangle(
    scene.cameras.main.centerX, scene.cameras.main.centerY,
    scene.cameras.main.width, scene.cameras.main.height,
    0xffffff, 0.05,
  ).setDepth(100).setScrollFactor(0)

  scene.tweens.add({
    targets: flash,
    alpha: 0,
    duration: 50,
    ease: 'Expo.easeOut',
    onComplete: () => flash.destroy(),
  })
}

/** Golden flash when room clears */
export function flashRoomClear(scene: Phaser.Scene): void {
  const flash = scene.add.rectangle(
    scene.cameras.main.centerX, scene.cameras.main.centerY,
    scene.cameras.main.width, scene.cameras.main.height,
    0xddaa44, 0.08,
  ).setDepth(100).setScrollFactor(0)

  scene.tweens.add({
    targets: flash,
    alpha: 0,
    duration: 300,
    ease: 'Expo.easeOut',
    onComplete: () => flash.destroy(),
  })
}

// ── Enemy Telegraph (pre-attack warning flash) ──────────────────────

export function enemyTelegraph(scene: Phaser.Scene, sprite: Phaser.Physics.Arcade.Sprite, duration = 400): void {
  // Rapid white/normal flicker to warn of incoming attack — accelerating frequency
  const flashes = Math.floor(duration / 80)
  for (let i = 0; i < flashes; i++) {
    // Accelerate the flash frequency: later flashes are closer together
    const progress = i / flashes
    const delayMs = i * 80 * (1 - progress * 0.3)
    scene.time.delayedCall(delayMs, () => {
      if (!sprite?.active) return
      if (i % 2 === 0) {
        sprite.setTint(0xffffff)
        sprite.setAlpha(1)
      } else {
        sprite.clearTint()
        sprite.setAlpha(0.6)
      }
    })
  }
  // Restore after telegraph completes
  scene.time.delayedCall(duration, () => {
    if (!sprite?.active) return
    sprite.clearTint()
    sprite.setAlpha(1)
  })

  // Ground warning ring: expanding red circle under enemy
  const ring = scene.add.circle(sprite.x, sprite.y, 4, 0xff0000, 0).setDepth(3)
  ring.setStrokeStyle(2, 0xff4444, 0.8)
  scene.tweens.add({
    targets: ring,
    radius: 22,
    alpha: 0,
    duration: duration,
    ease: 'Sine.easeIn',
    onUpdate: () => {
      if (sprite?.active) {
        ring.setPosition(sprite.x, sprite.y)
      }
    },
    onComplete: () => ring.destroy(),
  })

  // Inner pulsing glow that intensifies as attack approaches
  const glow = scene.add.circle(sprite.x, sprite.y, 10, 0xff2222, 0.15).setDepth(3)
  scene.tweens.add({
    targets: glow,
    alpha: 0.5,
    scale: 1.8,
    duration: duration,
    ease: 'Quad.easeIn',
    onUpdate: () => {
      if (sprite?.active) {
        glow.setPosition(sprite.x, sprite.y)
      }
    },
    onComplete: () => glow.destroy(),
  })
}

// ── Knockback with easing — Diablo DRAMATIC knockback ────────────────
// Enemies should FLY back when hit hard, slide across the floor.
// Easing: exponential out = fast start, slow stop (like slamming into ground).

export function knockbackTween(
  scene: Phaser.Scene,
  sprite: Phaser.Physics.Arcade.Sprite,
  angle: number,
  distance: number,
  durationMs: number,
  ease: string,
): void {
  if (!sprite?.active) return

  const destX = sprite.x + Math.cos(angle) * distance
  const destY = sprite.y + Math.sin(angle) * distance

  // Kill any existing knockback tween on this sprite first
  scene.tweens.killTweensOf(sprite)

  scene.tweens.add({
    targets: sprite,
    x: destX,
    y: destY,
    duration: durationMs,
    ease,
  })

  // Dust trail behind the knockback for that Diablo "sliding across stone" feel
  const dustCount = 3
  for (let i = 0; i < dustCount; i++) {
    const delay = (durationMs / dustCount) * i
    scene.time.delayedCall(delay, () => {
      if (!sprite?.active) return
      const dust = scene.add.circle(sprite.x, sprite.y, 1.5, 0x888888, 0.3).setDepth(2)
      scene.tweens.add({
        targets: dust,
        alpha: 0,
        scale: 2,
        duration: 300,
        ease: 'Quad.easeOut',
        onComplete: () => dust.destroy(),
      })
    })
  }
}

// ── Vignette Overlay ─────────────────────────────────────────────────

export function createVignette(scene: Phaser.Scene, intensity = 0.4): Phaser.GameObjects.Graphics {
  const w = scene.cameras.main.width
  const h = scene.cameras.main.height
  const g = scene.add.graphics().setDepth(90).setScrollFactor(0)

  // Radial gradient approximation with concentric rectangles
  const steps = 12 // More steps for smoother Diablo-style darkening
  for (let i = 0; i < steps; i++) {
    const ratio = i / steps
    const alpha = ratio * ratio * intensity
    const inset = ratio * Math.min(w, h) * 0.18
    g.fillStyle(0x000000, alpha)
    g.fillRect(inset * (i === 0 ? 0 : 1), inset * (i === 0 ? 0 : 1), w - inset * 2, h - inset * 2)
  }

  return g
}

// ── Squash & Stretch ────────────────────────────────────────────────
// Juice for entity movement: compress horizontally and stretch vertically
// on dash, squash on landing/stopping. Uses tweens for smooth transitions.

/**
 * Dash stretch: compress horizontally, stretch vertically.
 * Called when an entity begins a dash.
 */
export function dashStretch(scene: Phaser.Scene, sprite: Phaser.Physics.Arcade.Sprite, baseScaleX: number, baseScaleY: number): void {
  if (!sprite?.active) return

  // Kill any existing squash/stretch tweens on this sprite
  scene.tweens.killTweensOf(sprite)

  // Stretch: narrow X, tall Y
  sprite.setScale(baseScaleX * 0.7, baseScaleY * 1.3)

  // Return to base scale with overshoot
  scene.tweens.add({
    targets: sprite,
    scaleX: baseScaleX,
    scaleY: baseScaleY,
    duration: 200,
    ease: 'Back.easeOut',
  })
}

/**
 * Landing squash: compress vertically, expand horizontally.
 * Called when an entity stops moving abruptly or takes a hit.
 */
export function landingSquash(scene: Phaser.Scene, sprite: Phaser.Physics.Arcade.Sprite, baseScaleX: number, baseScaleY: number): void {
  if (!sprite?.active) return

  scene.tweens.killTweensOf(sprite)

  // Squash: wide X, short Y
  sprite.setScale(baseScaleX * 1.25, baseScaleY * 0.75)

  // Bounce back to base
  scene.tweens.add({
    targets: sprite,
    scaleX: baseScaleX,
    scaleY: baseScaleY,
    duration: 180,
    ease: 'Elastic.easeOut',
  })
}

// ── Dynamic Entity Glow ─────────────────────────────────────────────
// Subtle light circle under/around entities for visual identity.
// Player: blue, Partner: green, Enemies: red.

export interface EntityGlow {
  graphic: Phaser.GameObjects.Ellipse
  destroy(): void
}

/**
 * Create a glow circle beneath an entity.
 * Returns a handle to update position and destroy.
 */
export function createEntityGlow(
  scene: Phaser.Scene,
  x: number,
  y: number,
  color: number,
  radius = 14,
  alpha = 0.15,
): EntityGlow {
  // Ellipse: wider than tall for ground-plane perspective
  const graphic = scene.add.ellipse(x, y + 4, radius * 2, radius * 1.2, color, alpha)
    .setDepth(3)

  // Subtle pulsing animation
  scene.tweens.add({
    targets: graphic,
    alpha: alpha * 0.5,
    scaleX: 0.9,
    scaleY: 0.9,
    duration: 1200 + Math.random() * 400,
    ease: 'Sine.easeInOut',
    repeat: -1,
    yoyo: true,
  })

  return {
    graphic,
    destroy() {
      scene.tweens.killTweensOf(graphic)
      graphic.destroy()
    },
  }
}

/**
 * Update a glow's position to follow its entity.
 */
export function updateEntityGlow(glow: EntityGlow, x: number, y: number): void {
  if (glow.graphic?.active) {
    glow.graphic.setPosition(x, y + 4)
  }
}

// ── Depth Scaling ───────────────────────────────────────────────────
// Entities slightly larger when lower on screen (closer to camera).
// Creates a subtle pseudo-3D perspective effect.

/**
 * Compute depth-adjusted scale based on Y position within the room.
 * baseScale: the normal scale of the entity
 * y: current Y position in world space
 * roomHeightPx: total room height in pixels
 * Returns adjusted scale (baseScale + up to 10% increase at bottom)
 */
export function depthScale(baseScale: number, y: number, roomHeightPx: number): number {
  const t = Math.max(0, Math.min(1, y / roomHeightPx))
  return baseScale + t * 0.1
}

// ── Entity Shadow (dark ellipse under entities) ─────────────────────
// Every entity casts a small dark shadow beneath them for grounding.

export function createEntityShadow(scene: Phaser.Scene, x: number, y: number, width = 16, height = 6): Phaser.GameObjects.Ellipse {
  const shadow = scene.add.ellipse(x, y + 10, width, height, 0x000000, 0.35)
    .setDepth(0)
  return shadow
}

export function updateEntityShadow(shadow: Phaser.GameObjects.Ellipse, x: number, y: number): void {
  if (!shadow?.active) return
  shadow.setPosition(x, y + 10)
}

// ── Enemy Fog-of-War Visibility ─────────────────────────────────────
// Enemies outside the player's light radius fade to 20% opacity.
// This is THE signature Diablo visual mechanic.

export function updateEnemyVisibility(
  sprite: Phaser.Physics.Arcade.Sprite,
  playerX: number,
  playerY: number,
  lightRadius: number,
): void {
  if (!sprite?.active) return

  const dist = Phaser.Math.Distance.Between(sprite.x, sprite.y, playerX, playerY)

  if (dist <= lightRadius) {
    // Inside light: fully visible
    sprite.setAlpha(1)
  } else {
    // Outside light: dim but still VISIBLE (gameplay over aesthetics)
    const beyondDist = dist - lightRadius
    const fadeRatio = Math.max(0.4, 0.8 - beyondDist * 0.002)
    sprite.setAlpha(fadeRatio)
  }
}

// ══════════════════════════════════════════════════════════════════════
// DIGITAL / AI AESTHETIC — The Art of Technology
// The game is BUILT BY AI. The visuals should reflect that.
// ══════════════════════════════════════════════════════════════════════

// ── Scanline Overlay ────────────────────────────────────────────────
// Very subtle 3-5% opacity horizontal lines — CRT monitor aesthetic.
// Creates the feeling of looking through a digital display.

export interface ScanlineOverlay {
  graphics: Phaser.GameObjects.Graphics
  destroy(): void
}

export function createScanlineOverlay(scene: Phaser.Scene, opacity = 0.035): ScanlineOverlay {
  const w = scene.cameras.main.width
  const h = scene.cameras.main.height
  const g = scene.add.graphics().setDepth(95).setScrollFactor(0)

  // Draw thin horizontal lines every 2 pixels
  g.fillStyle(0x000000, opacity)
  for (let y = 0; y < h; y += 3) {
    g.fillRect(0, y, w, 1)
  }

  return {
    graphics: g,
    destroy() {
      g.destroy()
    },
  }
}

// ── Glitch Effect (single-frame screen tear on damage) ──────────────
// Shifts the screen 2px horizontally for 1 frame. Fast, visceral, digital.

export function glitchEffect(scene: Phaser.Scene, intensity = 2): void {
  const cam = scene.cameras.main

  // Horizontal offset for 1 frame (~16ms)
  const offset = (Math.random() > 0.5 ? 1 : -1) * intensity
  cam.setScroll(cam.scrollX + offset, cam.scrollY)

  // Restore next frame
  scene.time.delayedCall(16, () => {
    cam.setScroll(cam.scrollX - offset, cam.scrollY)
  })
}

// ── Chromatic Aberration at Screen Edges ─────────────────────────────
// Subtle 1-2px color split at the borders. Indie film quality.
// Implemented as thin colored strips along the edges.

export interface ChromaticAberration {
  left: Phaser.GameObjects.Rectangle
  right: Phaser.GameObjects.Rectangle
  top: Phaser.GameObjects.Rectangle
  bottom: Phaser.GameObjects.Rectangle
  destroy(): void
}

export function createChromaticAberration(scene: Phaser.Scene, spread = 2, alpha = 0.12): ChromaticAberration {
  const w = scene.cameras.main.width
  const h = scene.cameras.main.height

  // Red/cyan color split at edges
  const left = scene.add.rectangle(spread / 2, h / 2, spread, h, 0xff0000, alpha)
    .setDepth(96).setScrollFactor(0).setBlendMode(Phaser.BlendModes.ADD)
  const right = scene.add.rectangle(w - spread / 2, h / 2, spread, h, 0x00ffff, alpha)
    .setDepth(96).setScrollFactor(0).setBlendMode(Phaser.BlendModes.ADD)
  const top = scene.add.rectangle(w / 2, spread / 2, w, spread, 0xff0000, alpha * 0.7)
    .setDepth(96).setScrollFactor(0).setBlendMode(Phaser.BlendModes.ADD)
  const bottom = scene.add.rectangle(w / 2, h - spread / 2, w, spread, 0x00ffff, alpha * 0.7)
    .setDepth(96).setScrollFactor(0).setBlendMode(Phaser.BlendModes.ADD)

  return {
    left, right, top, bottom,
    destroy() {
      left.destroy()
      right.destroy()
      top.destroy()
      bottom.destroy()
    },
  }
}
