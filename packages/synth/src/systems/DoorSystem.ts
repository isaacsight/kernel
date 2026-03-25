// SYNTH — Door System
// Interactive doors between rooms. Locked during combat, unlocked on room clear.
// Design Bible §VI: "Satisfying 'all dead' feedback — doors open."

import Phaser from 'phaser'
import type { RoomData, DoorData, Vec2 } from '../types'
import { TILE_SIZE } from '../constants'

// ── Constants ──

const DOOR_WIDTH = TILE_SIZE * 2
const DOOR_HEIGHT = TILE_SIZE * 0.6
const DOOR_LOCKED_COLOR = 0x993333
const DOOR_LOCKED_ALPHA = 0.6
const DOOR_UNLOCKED_COLOR = 0x33ff88
const DOOR_UNLOCKED_ALPHA = 0.85
const DOOR_PULSE_DURATION = 1200
const DOOR_OVERLAP_DISTANCE = TILE_SIZE * 1.2

// ── Door Sprite Wrapper ──

interface DoorSprite {
  rect: Phaser.GameObjects.Rectangle
  glow: Phaser.GameObjects.Rectangle
  data: DoorData
  pulseTween?: Phaser.Tweens.Tween
}

// ── Public API ──

export class DoorSystem {
  private scene: Phaser.Scene
  private doors: DoorSprite[] = []
  private locked = true

  constructor(scene: Phaser.Scene) {
    this.scene = scene
  }

  /**
   * Create door sprites at each DoorData position.
   * Doors start locked (red tint, blocking feel).
   */
  createDoors(_scene: Phaser.Scene, room: RoomData): void {
    this.destroy()
    this.locked = true

    for (const door of room.doors) {
      const isVertical = door.direction === 'north' || door.direction === 'south'
      const w = isVertical ? DOOR_WIDTH : DOOR_HEIGHT
      const h = isVertical ? DOOR_HEIGHT : DOOR_WIDTH

      const px = door.position.x * TILE_SIZE + TILE_SIZE / 2
      const py = door.position.y * TILE_SIZE + TILE_SIZE / 2

      // Background glow (slightly larger, behind the door)
      const glow = this.scene.add.rectangle(px, py, w + 6, h + 6, DOOR_LOCKED_COLOR, 0.15)
        .setDepth(8)

      // Main door rect
      const rect = this.scene.add.rectangle(px, py, w, h, DOOR_LOCKED_COLOR, DOOR_LOCKED_ALPHA)
        .setDepth(9)

      this.doors.push({ rect, glow, data: door })
    }
  }

  /**
   * Unlock all doors — called when the room is cleared.
   * Green glow, satisfying pulse animation.
   */
  unlockDoors(): void {
    this.locked = false

    for (const door of this.doors) {
      // Transition to unlocked color
      door.rect.setFillStyle(DOOR_UNLOCKED_COLOR, DOOR_UNLOCKED_ALPHA)
      door.glow.setFillStyle(DOOR_UNLOCKED_COLOR, 0.25)

      // Brief "pop" scale on unlock
      this.scene.tweens.add({
        targets: door.rect,
        scaleX: 1.3,
        scaleY: 1.3,
        duration: 150,
        ease: 'Back.easeOut',
        yoyo: true,
      })

      // Continuous pulse to draw the player's eye
      door.pulseTween = this.scene.tweens.add({
        targets: door.glow,
        alpha: 0.5,
        scaleX: 1.15,
        scaleY: 1.15,
        duration: DOOR_PULSE_DURATION,
        ease: 'Sine.easeInOut',
        yoyo: true,
        repeat: -1,
      })
    }
  }

  /**
   * Per-frame check: returns the DoorData if the player is overlapping an unlocked door,
   * or null otherwise.
   */
  update(playerPos: Vec2): DoorData | null {
    if (this.locked) return null

    for (const door of this.doors) {
      const dx = Math.abs(playerPos.x - door.rect.x)
      const dy = Math.abs(playerPos.y - door.rect.y)

      if (dx < DOOR_OVERLAP_DISTANCE && dy < DOOR_OVERLAP_DISTANCE) {
        return door.data
      }
    }

    return null
  }

  /** Clean up all door objects. */
  destroy(): void {
    for (const door of this.doors) {
      if (door.pulseTween) {
        door.pulseTween.destroy()
      }
      door.rect.destroy()
      door.glow.destroy()
    }
    this.doors = []
  }
}
