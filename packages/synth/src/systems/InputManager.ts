import Phaser from 'phaser'
import type { Vec2 } from '../types'
import { TouchControls, isMobile } from './TouchControls'

export class InputManager {
  private keys: {
    up: Phaser.Input.Keyboard.Key
    down: Phaser.Input.Keyboard.Key
    left: Phaser.Input.Keyboard.Key
    right: Phaser.Input.Keyboard.Key
    dodge: Phaser.Input.Keyboard.Key
    switchWeapon: Phaser.Input.Keyboard.Key
    secondary: Phaser.Input.Keyboard.Key
  }
  private scene: Phaser.Scene
  private touchControls: TouchControls | null = null
  readonly mobile: boolean

  /** Accumulated scroll delta for weapon switching (positive = scroll down) */
  private scrollDelta = 0

  constructor(scene: Phaser.Scene) {
    this.scene = scene
    this.mobile = isMobile()

    const kb = scene.input.keyboard!
    this.keys = {
      up: kb.addKey(Phaser.Input.Keyboard.KeyCodes.W),
      down: kb.addKey(Phaser.Input.Keyboard.KeyCodes.S),
      left: kb.addKey(Phaser.Input.Keyboard.KeyCodes.A),
      right: kb.addKey(Phaser.Input.Keyboard.KeyCodes.D),
      dodge: kb.addKey(Phaser.Input.Keyboard.KeyCodes.SPACE),
      switchWeapon: kb.addKey(Phaser.Input.Keyboard.KeyCodes.Q),
      secondary: kb.addKey(Phaser.Input.Keyboard.KeyCodes.E),
    }

    // Listen for scroll wheel events for weapon cycling
    // Phaser 'wheel' callback: (pointer, gameObjects, deltaX, deltaY, deltaZ)
    scene.input.on('wheel', (_pointer: Phaser.Input.Pointer, _gameObjects: Phaser.GameObjects.GameObject[], _deltaX: number, deltaY: number) => {
      this.scrollDelta += deltaY
    })

    if (this.mobile) {
      this.touchControls = new TouchControls(scene)
    }
  }

  getMovement(): Vec2 {
    // On mobile, prefer virtual joystick
    if (this.touchControls) {
      const touch = this.touchControls.getMovement()
      if (touch.x !== 0 || touch.y !== 0) {
        return touch
      }
    }

    // Keyboard fallback (also used on desktop)
    let x = 0, y = 0
    if (this.keys.left.isDown) x -= 1
    if (this.keys.right.isDown) x += 1
    if (this.keys.up.isDown) y -= 1
    if (this.keys.down.isDown) y += 1
    // Normalize diagonal movement
    const len = Math.sqrt(x * x + y * y)
    if (len > 0) { x /= len; y /= len }
    return { x, y }
  }

  getAimAngle(): number {
    const pointer = this.scene.input.activePointer
    const cx = this.scene.cameras.main.centerX
    const cy = this.scene.cameras.main.centerY
    return Math.atan2(pointer.y - cy, pointer.x - cx)
  }

  getPointerWorld(): Vec2 {
    const p = this.scene.input.activePointer
    return { x: p.worldX, y: p.worldY }
  }

  isAttacking(): boolean {
    // On mobile, attacking is handled by auto-aim in DungeonScene
    if (this.mobile) return false
    return this.scene.input.activePointer.isDown
  }

  isDodging(): boolean {
    // On mobile, consume dodge from touch button
    if (this.touchControls) {
      const touchDodge = this.touchControls.consumeDodge()
      if (touchDodge) return true
    }
    return Phaser.Input.Keyboard.JustDown(this.keys.dodge)
  }

  /** Returns true on the frame the Q key is pressed (weapon switch) */
  isSwitchingWeapon(): boolean {
    return Phaser.Input.Keyboard.JustDown(this.keys.switchWeapon)
  }

  /** Returns true while E key is held down (secondary attack / charge) */
  isSecondaryDown(): boolean {
    return this.keys.secondary.isDown
  }

  /** Returns true on the frame the E key is released (secondary fire) */
  isSecondaryJustUp(): boolean {
    return Phaser.Input.Keyboard.JustUp(this.keys.secondary)
  }

  /** Returns true on the frame the E key is pressed */
  isSecondaryJustDown(): boolean {
    return Phaser.Input.Keyboard.JustDown(this.keys.secondary)
  }

  /**
   * Consume scroll wheel delta for weapon cycling.
   * Returns -1 (scroll up / prev weapon), +1 (scroll down / next weapon), or 0 (no change).
   */
  consumeScrollCycle(): -1 | 0 | 1 {
    const threshold = 50  // Minimum scroll delta to trigger a switch
    if (this.scrollDelta > threshold) {
      this.scrollDelta = 0
      return 1
    } else if (this.scrollDelta < -threshold) {
      this.scrollDelta = 0
      return -1
    }
    return 0
  }

  destroy(): void {
    this.touchControls?.destroy()
  }
}
