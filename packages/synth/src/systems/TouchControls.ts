import Phaser from 'phaser'
import type { Vec2 } from '../types'

/**
 * Mobile touch controls: virtual joystick (left) + dodge button (right).
 * Only created on touch-capable devices.
 */

const JOYSTICK_BASE_RADIUS = 60
const JOYSTICK_THUMB_RADIUS = 25
const DODGE_BUTTON_RADIUS = 30
const IDLE_ALPHA = 0.3
const ACTIVE_ALPHA = 0.6
const LABEL_FONT = '14px monospace'

export function isMobile(): boolean {
  return 'ontouchstart' in window
}

export class TouchControls {
  private scene: Phaser.Scene
  private joystickBase: Phaser.GameObjects.Arc
  private joystickThumb: Phaser.GameObjects.Arc
  private dodgeButton: Phaser.GameObjects.Arc
  private dodgeLabel: Phaser.GameObjects.Text

  /** Normalised movement vector from virtual joystick */
  private moveVector: Vec2 = { x: 0, y: 0 }

  /** True on the frame the dodge button is first pressed */
  private dodgePressed = false
  /** Internal: whether the dodge touch is currently held */
  private dodgeDown = false

  /** Pointer ID currently controlling the joystick (-1 = none) */
  private joystickPointerId = -1

  /** Centre of the joystick base in screen coords */
  private baseX: number
  private baseY: number

  constructor(scene: Phaser.Scene) {
    this.scene = scene

    const { width, height } = scene.scale

    // ── Virtual Joystick (bottom-left) ──
    this.baseX = 100
    this.baseY = height - 120

    this.joystickBase = scene.add.circle(this.baseX, this.baseY, JOYSTICK_BASE_RADIUS, 0xffffff, IDLE_ALPHA)
      .setScrollFactor(0)
      .setDepth(1000)

    this.joystickThumb = scene.add.circle(this.baseX, this.baseY, JOYSTICK_THUMB_RADIUS, 0xffffff, IDLE_ALPHA)
      .setScrollFactor(0)
      .setDepth(1001)

    // ── Dodge Button (bottom-right) ──
    const dodgeX = width - 90
    const dodgeY = height - 120

    this.dodgeButton = scene.add.circle(dodgeX, dodgeY, DODGE_BUTTON_RADIUS, 0xffffff, IDLE_ALPHA)
      .setScrollFactor(0)
      .setDepth(1000)
      .setInteractive()

    this.dodgeLabel = scene.add.text(dodgeX, dodgeY, 'DASH', {
      fontFamily: 'monospace',
      fontSize: LABEL_FONT,
      color: '#ffffff',
      align: 'center',
    })
      .setOrigin(0.5)
      .setScrollFactor(0)
      .setDepth(1001)
      .setAlpha(IDLE_ALPHA)

    // ── Touch event listeners ──
    scene.input.on('pointerdown', this.onPointerDown, this)
    scene.input.on('pointermove', this.onPointerMove, this)
    scene.input.on('pointerup', this.onPointerUp, this)
  }

  // ── Public API ──

  getMovement(): Vec2 {
    return this.moveVector
  }

  /** Returns true only on the first frame the dodge button is pressed (like JustDown). */
  consumeDodge(): boolean {
    if (this.dodgePressed) {
      this.dodgePressed = false
      return true
    }
    return false
  }

  destroy(): void {
    this.scene.input.off('pointerdown', this.onPointerDown, this)
    this.scene.input.off('pointermove', this.onPointerMove, this)
    this.scene.input.off('pointerup', this.onPointerUp, this)
    this.joystickBase.destroy()
    this.joystickThumb.destroy()
    this.dodgeButton.destroy()
    this.dodgeLabel.destroy()
  }

  // ── Internals ──

  private isInJoystickZone(x: number, y: number): boolean {
    const dx = x - this.baseX
    const dy = y - this.baseY
    // Accept touches within 1.5x the base radius for easier grab
    return Math.sqrt(dx * dx + dy * dy) < JOYSTICK_BASE_RADIUS * 1.5
  }

  private isInDodgeZone(x: number, y: number): boolean {
    const bx = this.dodgeButton.x
    const by = this.dodgeButton.y
    const dx = x - bx
    const dy = y - by
    return Math.sqrt(dx * dx + dy * dy) < DODGE_BUTTON_RADIUS * 2
  }

  private onPointerDown(pointer: Phaser.Input.Pointer): void {
    // Dodge button takes priority if in zone
    if (this.isInDodgeZone(pointer.x, pointer.y)) {
      this.dodgeDown = true
      this.dodgePressed = true
      this.dodgeButton.setAlpha(ACTIVE_ALPHA)
      this.dodgeLabel.setAlpha(ACTIVE_ALPHA)
      return
    }

    // Joystick: claim this pointer
    if (this.joystickPointerId === -1 && this.isInJoystickZone(pointer.x, pointer.y)) {
      this.joystickPointerId = pointer.id
      this.joystickBase.setAlpha(ACTIVE_ALPHA)
      this.joystickThumb.setAlpha(ACTIVE_ALPHA)
      this.updateJoystickThumb(pointer.x, pointer.y)
    }
  }

  private onPointerMove(pointer: Phaser.Input.Pointer): void {
    if (pointer.id === this.joystickPointerId) {
      this.updateJoystickThumb(pointer.x, pointer.y)
    }
  }

  private onPointerUp(pointer: Phaser.Input.Pointer): void {
    // Dodge button release
    if (this.dodgeDown && this.isInDodgeZone(pointer.x, pointer.y)) {
      this.dodgeDown = false
      this.dodgeButton.setAlpha(IDLE_ALPHA)
      this.dodgeLabel.setAlpha(IDLE_ALPHA)
    }

    // Joystick release
    if (pointer.id === this.joystickPointerId) {
      this.joystickPointerId = -1
      this.moveVector = { x: 0, y: 0 }
      this.joystickThumb.setPosition(this.baseX, this.baseY)
      this.joystickBase.setAlpha(IDLE_ALPHA)
      this.joystickThumb.setAlpha(IDLE_ALPHA)
    }
  }

  private updateJoystickThumb(px: number, py: number): void {
    const dx = px - this.baseX
    const dy = py - this.baseY
    const dist = Math.sqrt(dx * dx + dy * dy)
    const maxDist = JOYSTICK_BASE_RADIUS

    // Clamp thumb to base circle
    const clampedDist = Math.min(dist, maxDist)
    const angle = Math.atan2(dy, dx)
    const thumbX = this.baseX + Math.cos(angle) * clampedDist
    const thumbY = this.baseY + Math.sin(angle) * clampedDist
    this.joystickThumb.setPosition(thumbX, thumbY)

    // Normalise: 0..1 based on distance from centre
    if (dist > 5) { // small deadzone
      const normMag = Math.min(dist / maxDist, 1)
      this.moveVector = {
        x: Math.cos(angle) * normMag,
        y: Math.sin(angle) * normMag,
      }
    } else {
      this.moveVector = { x: 0, y: 0 }
    }
  }
}
