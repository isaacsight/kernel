// SYNTH — Room Manager
// Manages the flow of a dungeon run: entering rooms, combat pacing, room clears,
// and transitions between rooms.
//
// Design Bible §VI Room Pacing:
//   1. Enter — 1 second of peace. Player surveys the room.
//   2. Alert — Enemies wake up with staggered timing (not all at once).
//   3. Combat — 30-60 seconds of intense fighting.
//   4. Clear — Satisfying "all dead" feedback (sound, flash, doors open).
//   5. Reward — Brief moment to collect drops before moving on.

import Phaser from 'phaser'
import type { FloorData, RoomData, DoorData, Vec2 } from '../types'
import { TILE_SIZE } from '../constants'
import { eventBus } from './EventBus'
import { RoomEffects } from './RoomEffects'
import { DoorSystem } from './DoorSystem'

// ── Timing Constants ──

/** Seconds of peace before enemies start waking up */
const ENTER_PEACE_DURATION = 1000
/** Base delay between each enemy waking up (ms) */
const STAGGER_BASE_MS = 300
/** Random jitter added per enemy (ms) */
const STAGGER_JITTER_MS = 200
/** Pause after room clear before doors visually open (ms) */
const CLEAR_PAUSE_MS = 1000
/** Fade duration for room transitions (ms) */
const FADE_MS = 300

// ── Room State ──

export type RoomState = 'entering' | 'alert' | 'combat' | 'cleared' | 'transitioning'

// ── Public API ──

export class RoomManager {
  private scene: Phaser.Scene
  private currentRoomIndex: number
  private floor: FloorData
  private roomState: RoomState = 'entering'
  private doorSystem: DoorSystem
  private stateTimer = 0

  /** Indices of enemies that have been "woken up" in the alert phase. */
  private wokenEnemies: Set<number> = new Set()
  /** Total number of enemies to wake in the current room. */
  private totalEnemyCount = 0
  /** How many enemies are still alive (set externally via setEnemyCount). */
  private aliveEnemyCount = 0
  /** Whether the clear-effect has already been played. */
  private clearEffectPlayed = false
  /** Blocks door transitions during an active transition. */
  private transitioning = false

  constructor(scene: Phaser.Scene, floor: FloorData) {
    this.scene = scene
    this.floor = floor
    this.currentRoomIndex = floor.startRoom
    this.doorSystem = new DoorSystem(scene)
  }

  // ── Room Lifecycle ─────────────────────────────────────────────────

  /**
   * Called when the player enters a room.
   * Sets up the dramatic arc: peace -> alert -> combat.
   */
  enterRoom(roomIndex: number): void {
    this.currentRoomIndex = roomIndex
    this.roomState = 'entering'
    this.stateTimer = 0
    this.wokenEnemies.clear()
    this.clearEffectPlayed = false
    this.transitioning = false

    const room = this.getCurrentRoom()
    this.totalEnemyCount = room.enemySpawns.length
    this.aliveEnemyCount = this.totalEnemyCount

    // Apply room-type visual theme
    RoomEffects.applyTheme(this.scene, room.roomType ?? 'arena')

    // Create doors (locked)
    this.doorSystem.createDoors(this.scene, room)

    // Emit event so other systems can react (e.g. minimap)
    eventBus.emit('room:enter', roomIndex)

    // If there are no enemies, skip straight to cleared
    if (this.totalEnemyCount === 0) {
      this.roomState = 'cleared'
      this.onRoomCleared()
    }
  }

  /**
   * Called when all enemies in the room are dead.
   * Plays satisfying clear feedback: flash, particle burst, doors unlock.
   */
  onRoomCleared(): void {
    if (this.clearEffectPlayed) return
    this.clearEffectPlayed = true
    this.roomState = 'cleared'

    // Brief pause for dramatic effect, then celebrate
    this.scene.time.delayedCall(CLEAR_PAUSE_MS, () => {
      // Room-clear VFX
      RoomEffects.roomClearEffect(this.scene)

      // Unlock doors
      this.doorSystem.unlockDoors()

      eventBus.emit('room:cleared', this.currentRoomIndex)
    })
  }

  /**
   * Called when the player overlaps an unlocked door.
   * Triggers a fade-to-black transition, loads the new room, fades back in.
   */
  onDoorReached(door: DoorData): void {
    if (this.transitioning) return
    if (this.roomState !== 'cleared') return

    this.transitioning = true
    this.roomState = 'transitioning'

    eventBus.emit('room:transition:start', door.leadsTo)

    // Fade out → load room → fade in
    RoomEffects.fadeToBlack(this.scene, FADE_MS).then(() => {
      // Clean up current room visuals
      this.doorSystem.destroy()
      RoomEffects.clearTheme(this.scene)

      // Move to the new room
      eventBus.emit('room:load', door.leadsTo)

      // Fade back in after a frame for the new room to render
      this.scene.time.delayedCall(50, () => {
        this.enterRoom(door.leadsTo)

        RoomEffects.fadeFromBlack(this.scene, FADE_MS).then(() => {
          eventBus.emit('room:transition:end', door.leadsTo)
        })
      })
    })
  }

  // ── Per-Frame Update ───────────────────────────────────────────────

  /**
   * Tick the room pacing state machine.
   * @param dt - Frame delta in milliseconds.
   */
  update(dt: number): void {
    this.stateTimer += dt

    switch (this.roomState) {
      case 'entering':
        this.updateEntering()
        break

      case 'alert':
        this.updateAlert()
        break

      case 'combat':
        this.updateCombat()
        break

      case 'cleared':
        this.updateCleared()
        break

      case 'transitioning':
        // Nothing to tick — waiting for fade
        break
    }
  }

  // ── State Updaters ─────────────────────────────────────────────────

  /** Peace phase: 1s of quiet before enemies start waking. */
  private updateEntering(): void {
    if (this.stateTimer >= ENTER_PEACE_DURATION) {
      this.roomState = 'alert'
      this.stateTimer = 0
      eventBus.emit('room:alert', this.currentRoomIndex)
    }
  }

  /**
   * Alert phase: enemies wake up one by one with staggered timing.
   * Each enemy "wakes" after STAGGER_BASE_MS + random jitter.
   */
  private updateAlert(): void {
    if (this.totalEnemyCount === 0) {
      this.roomState = 'combat'
      this.stateTimer = 0
      return
    }

    // Determine which enemy should wake based on elapsed time
    const nextIndex = this.wokenEnemies.size
    if (nextIndex >= this.totalEnemyCount) {
      // All enemies are awake — combat begins
      this.roomState = 'combat'
      this.stateTimer = 0
      eventBus.emit('room:combat', this.currentRoomIndex)
      return
    }

    const threshold = nextIndex * STAGGER_BASE_MS + Math.random() * STAGGER_JITTER_MS
    if (this.stateTimer >= threshold) {
      this.wokenEnemies.add(nextIndex)
      eventBus.emit('enemy:wake', nextIndex, this.currentRoomIndex)
    }
  }

  /** Combat phase: check if all enemies are dead. */
  private updateCombat(): void {
    if (this.aliveEnemyCount <= 0) {
      this.onRoomCleared()
    }
  }

  /** Cleared phase: doors are open, check for player-door overlap. */
  private updateCleared(): void {
    // Door overlap is checked by the caller via checkDoorOverlap()
  }

  // ── External Accessors ─────────────────────────────────────────────

  /**
   * Inform the room manager how many enemies remain alive.
   * Called each frame by the scene.
   */
  setAliveEnemyCount(count: number): void {
    this.aliveEnemyCount = count
  }

  /**
   * Check if the player is overlapping an unlocked door.
   * Returns the DoorData if so, null otherwise.
   */
  checkDoorOverlap(playerPos: Vec2): DoorData | null {
    return this.doorSystem.update(playerPos)
  }

  /**
   * Check whether a specific enemy (by spawn index) has been woken up.
   * During 'entering' no enemies are awake; during 'alert' they wake one by one;
   * during 'combat' and beyond, all are awake.
   */
  isEnemyAwake(spawnIndex: number): boolean {
    if (this.roomState === 'entering') return false
    if (this.roomState === 'combat' || this.roomState === 'cleared' || this.roomState === 'transitioning') {
      return true
    }
    // Alert phase: check individually
    return this.wokenEnemies.has(spawnIndex)
  }

  getRoomState(): RoomState {
    return this.roomState
  }

  getCurrentRoom(): RoomData {
    return this.floor.rooms[this.currentRoomIndex]
  }

  getCurrentRoomIndex(): number {
    return this.currentRoomIndex
  }

  getFloor(): FloorData {
    return this.floor
  }

  getDoorSystem(): DoorSystem {
    return this.doorSystem
  }

  destroy(): void {
    this.doorSystem.destroy()
    RoomEffects.clearTheme(this.scene)
  }
}
