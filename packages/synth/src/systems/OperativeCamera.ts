// SYNTH — Operative Camera System
// Hybrid MOBA/ARPG camera: deadzone, context-sensitive zoom, tactical scout,
// parallax depth, enhanced kill cam, room transitions, adaptive lookahead.

import Phaser from 'phaser'
import {
  CAMERA_DEADZONE_W, CAMERA_DEADZONE_H,
  CAMERA_ZOOM_EXPLORE, CAMERA_ZOOM_LIGHT, CAMERA_ZOOM_HEAVY, CAMERA_ZOOM_BOSS,
  CAMERA_ZOOM_LERP,
  CAMERA_SCOUT_SNAP_MS,
  CAMERA_LOOKAHEAD_EXPLORE, CAMERA_LOOKAHEAD_COMBAT,
  CAMERA_ROOM_ZOOM_START, CAMERA_ROOM_ZOOM_DURATION,
} from '../constants'

// ── Types ──────────────────────────────────────────────────────────

export interface CameraContext {
  enemyCount: number
  bossPresent: boolean
  bossEnraged: boolean
  inCombat: boolean
  playerVelocity: { x: number; y: number }
  roomWidth: number
  roomHeight: number
}

// ── Operative Camera ───────────────────────────────────────────────

export class OperativeCamera {
  private scene: Phaser.Scene
  private cam: Phaser.Cameras.Scene2D.Camera
  private target: Phaser.GameObjects.Container

  // Zoom state
  private currentZoom = CAMERA_ZOOM_EXPLORE
  private targetZoom = CAMERA_ZOOM_EXPLORE
  /** When true, kill cam tween is in control — skip context zoom lerp */
  private killCamActive = false

  // Scout (middle mouse drag)
  private scouting = false
  private scoutOffsetX = 0
  private scoutOffsetY = 0
  /** Saved camera target position before scout started */
  private preScouttargetX = 0
  private preScoutTargetY = 0
  private scoutVignette: Phaser.GameObjects.Rectangle | null = null

  // Lookahead
  private lookaheadX = 0
  private lookaheadY = 0

  // Room transition state
  private roomTransitionActive = false

  // Player position (updated externally via target container)
  private playerX = 0
  private playerY = 0

  constructor(scene: Phaser.Scene, target: Phaser.GameObjects.Container) {
    this.scene = scene
    this.cam = scene.cameras.main
    this.target = target

    // ── Feature 1: Deadzone ──
    // Player moves freely in center 30% of viewport before camera follows.
    const w = this.cam.width
    const h = this.cam.height
    this.cam.setDeadzone(w * CAMERA_DEADZONE_W, h * CAMERA_DEADZONE_H)

    // Store initial target pos
    this.playerX = target.x
    this.playerY = target.y
  }

  // ── Public API ─────────────────────────────────────────────────

  /**
   * Call every frame from the scene update loop.
   * Handles context-sensitive zoom, adaptive lookahead, and scout clamping.
   */
  update(_dt: number, context: CameraContext): void {
    this.playerX = this.target.x
    this.playerY = this.target.y

    // ── Feature 2: Context-Sensitive Zoom ──
    if (!this.killCamActive && !this.roomTransitionActive) {
      this.targetZoom = this.computeContextZoom(context)
      // Smooth lerp toward target zoom
      this.currentZoom += (this.targetZoom - this.currentZoom) * CAMERA_ZOOM_LERP
      this.cam.setZoom(this.currentZoom)
    }

    // ── Feature 7: Adaptive Lookahead ──
    this.updateLookahead(context)

    // ── Feature 3: Scout clamp ──
    if (this.scouting) {
      this.clampScoutOffset(context.roomWidth, context.roomHeight)
      this.target.setPosition(
        this.preScouttargetX + this.scoutOffsetX + this.lookaheadX,
        this.preScoutTargetY + this.scoutOffsetY + this.lookaheadY,
      )
    }
  }

  /**
   * Update the camera target position (call with player pos + lookahead).
   * Only applies when NOT in scout mode (scout overrides target).
   */
  setTargetPosition(x: number, y: number): void {
    if (!this.scouting) {
      this.target.setPosition(x + this.lookaheadX, y + this.lookaheadY)
    }
    this.playerX = x
    this.playerY = y
  }

  /**
   * Get the current adaptive lookahead offset.
   * DungeonScene should use this instead of raw CAMERA_LOOKAHEAD.
   */
  getLookahead(): { x: number; y: number } {
    return { x: this.lookaheadX, y: this.lookaheadY }
  }

  // ── Feature 3: Tactical Scout (Middle Mouse) ──────────────────

  startScout(): void {
    if (this.scouting) return
    this.scouting = true
    this.scoutOffsetX = 0
    this.scoutOffsetY = 0
    this.preScouttargetX = this.target.x
    this.preScoutTargetY = this.target.y

    // Subtle vignette while scouting
    this.scoutVignette = this.scene.add.rectangle(
      this.cam.centerX, this.cam.centerY,
      this.cam.width, this.cam.height,
      0x000000, 0.12,
    ).setDepth(89).setScrollFactor(0)
  }

  updateScout(dx: number, dy: number): void {
    if (!this.scouting) return
    // Dota grip style: camera moves opposite to mouse drag
    this.scoutOffsetX -= dx
    this.scoutOffsetY -= dy
  }

  endScout(): void {
    if (!this.scouting) return
    this.scouting = false

    // Destroy vignette
    if (this.scoutVignette) {
      this.scene.tweens.add({
        targets: this.scoutVignette,
        alpha: 0,
        duration: CAMERA_SCOUT_SNAP_MS,
        ease: 'Sine.easeOut',
        onComplete: () => {
          this.scoutVignette?.destroy()
          this.scoutVignette = null
        },
      })
    }

    // Smooth 300ms pan back to player — tween the target container back
    const returnX = this.playerX + this.lookaheadX
    const returnY = this.playerY + this.lookaheadY
    this.scene.tweens.add({
      targets: this.target,
      x: returnX,
      y: returnY,
      duration: CAMERA_SCOUT_SNAP_MS,
      ease: 'Cubic.easeOut',
    })
  }

  isScoutMode(): boolean {
    return this.scouting
  }

  // ── Feature 4: Parallax Depth Layers ─────────────────────────

  /**
   * Apply scroll factors to layer containers/groups for parallax depth.
   * Call once after room is built.
   * - floorLayer: the floor tiles group/container → scrollFactor 0.95
   * - foregroundLayer: optional particles/fog → scrollFactor 1.08
   * Entity layer stays at default 1.0.
   */
  applyParallaxLayers(
    floorChildren: Phaser.GameObjects.GameObject[],
    foregroundChildren?: Phaser.GameObjects.GameObject[],
  ): void {
    for (const child of floorChildren) {
      if ('setScrollFactor' in child) {
        (child as Phaser.GameObjects.Components.ScrollFactor & Phaser.GameObjects.GameObject)
          .setScrollFactor(0.95)
      }
    }
    if (foregroundChildren) {
      for (const child of foregroundChildren) {
        if ('setScrollFactor' in child) {
          (child as Phaser.GameObjects.Components.ScrollFactor & Phaser.GameObjects.GameObject)
            .setScrollFactor(1.08)
        }
      }
    }
  }

  // ── Feature 5: Enhanced Kill Cam ──────────────────────────────

  triggerKillCam(type: 'normal' | 'multi' | 'boss' | 'death'): void {
    switch (type) {
      case 'normal':
        // Existing subtle zoom punch (1.02x, 100ms) — keep as is
        // Handled in VFX.killZoomPunch, no override needed
        break

      case 'multi':
        // Multi-kill (3+ in 1s): zoom to 1.05x + 0.5x timescale for 250ms
        this.killCamActive = true
        this.cam.setZoom(1.05)
        this.scene.time.timeScale = 0.5
        this.scene.tweens.add({
          targets: this.cam,
          zoom: this.currentZoom,
          duration: 250,
          ease: 'Sine.easeOut',
          onComplete: () => { this.killCamActive = false },
        })
        this.scene.tweens.add({
          targets: this.scene.time,
          timeScale: 1,
          duration: 250,
          ease: 'Cubic.easeIn',
        })
        break

      case 'boss':
        // Full cinematic — 0.3x timescale, zoom to 1.15x, hold 600ms, then release
        this.killCamActive = true
        this.cam.setZoom(1.15)
        this.scene.time.timeScale = 0.3
        this.scene.time.delayedCall(600, () => {
          this.scene.tweens.add({
            targets: this.cam,
            zoom: this.currentZoom,
            duration: 400,
            ease: 'Sine.easeOut',
            onComplete: () => { this.killCamActive = false },
          })
          this.scene.tweens.add({
            targets: this.scene.time,
            timeScale: 1,
            duration: 400,
            ease: 'Cubic.easeIn',
          })
        })
        break

      case 'death':
        // Player death: zoom in to 1.15x + desaturate
        this.killCamActive = true
        this.scene.tweens.add({
          targets: this.cam,
          zoom: 1.15,
          duration: 400,
          ease: 'Sine.easeOut',
          onComplete: () => { this.killCamActive = false },
        })
        // Desaturate via a dark overlay with low alpha
        const deathOverlay = this.scene.add.rectangle(
          this.cam.centerX, this.cam.centerY,
          this.cam.width * 2, this.cam.height * 2,
          0x111122, 0,
        ).setDepth(98).setScrollFactor(0)
        this.scene.tweens.add({
          targets: deathOverlay,
          alpha: 0.35,
          duration: 500,
          ease: 'Sine.easeIn',
          onComplete: () => {
            // Fade out after 1s
            this.scene.tweens.add({
              targets: deathOverlay,
              alpha: 0,
              duration: 600,
              ease: 'Sine.easeOut',
              onComplete: () => deathOverlay.destroy(),
            })
          },
        })
        break
    }
  }

  // ── Feature 6: Room Transition Camera ─────────────────────────

  /**
   * Call when entering a new room. Starts the establishing shot.
   * Camera begins at 0.75x zoom and smoothly zooms to target over 800ms.
   */
  onRoomEnter(): void {
    this.roomTransitionActive = true
    this.killCamActive = false

    // Compute what the resting zoom should be (exploration default)
    const restingZoom = CAMERA_ZOOM_EXPLORE
    this.currentZoom = CAMERA_ROOM_ZOOM_START
    this.cam.setZoom(CAMERA_ROOM_ZOOM_START)

    this.scene.tweens.add({
      targets: this,
      currentZoom: restingZoom,
      duration: CAMERA_ROOM_ZOOM_DURATION,
      ease: 'Cubic.easeOut',
      onUpdate: () => {
        this.cam.setZoom(this.currentZoom)
      },
      onComplete: () => {
        this.roomTransitionActive = false
        this.targetZoom = restingZoom
      },
    })
  }

  // ── Getters ──────────────────────────────────────────────────

  getZoom(): number {
    return this.currentZoom
  }

  // ── Internals ────────────────────────────────────────────────

  private computeContextZoom(context: CameraContext): number {
    if (context.bossPresent) return CAMERA_ZOOM_BOSS
    if (context.enemyCount >= 6) return CAMERA_ZOOM_HEAVY
    if (context.enemyCount >= 3) return CAMERA_ZOOM_LIGHT
    return CAMERA_ZOOM_EXPLORE
  }

  private updateLookahead(context: CameraContext): void {
    const vx = context.playerVelocity.x
    const vy = context.playerVelocity.y
    const speed = Math.sqrt(vx * vx + vy * vy)
    if (speed < 10) {
      // Lerp lookahead toward 0 when still
      this.lookaheadX *= 0.9
      this.lookaheadY *= 0.9
      return
    }

    const maxLookahead = context.inCombat ? CAMERA_LOOKAHEAD_COMBAT : CAMERA_LOOKAHEAD_EXPLORE
    const targetLX = (vx / speed) * maxLookahead
    const targetLY = (vy / speed) * maxLookahead
    // Smooth toward target
    this.lookaheadX += (targetLX - this.lookaheadX) * 0.08
    this.lookaheadY += (targetLY - this.lookaheadY) * 0.08
  }

  private clampScoutOffset(roomWidthPx: number, roomHeightPx: number): void {
    // Max scout distance: 60% of room size from player
    const maxX = roomWidthPx * 0.6
    const maxY = roomHeightPx * 0.6
    this.scoutOffsetX = Phaser.Math.Clamp(this.scoutOffsetX, -maxX, maxX)
    this.scoutOffsetY = Phaser.Math.Clamp(this.scoutOffsetY, -maxY, maxY)
  }
}
