import Phaser from 'phaser'
import type { FloorData, RoomType } from '../types'

// ── Minimap Constants ──

const MINIMAP_PADDING = 12
const MINIMAP_BG_ALPHA = 0.6
const MINIMAP_BG_COLOR = 0x000000
const MINIMAP_BORDER_COLOR = 0x555555
const MINIMAP_ROOM_SCALE = 0.3
const MINIMAP_MAX_WIDTH = 160
const MINIMAP_MAX_HEIGHT = 120

const ROOM_COLORS: Record<RoomType, number> = {
  arena: 0x4488ff,
  treasure: 0xffcc44,
  boss: 0xff4444,
  corridor: 0x666666,
}

const CURRENT_ROOM_COLOR = 0x44ff88
const UNEXPLORED_ALPHA = 0.2
const EXPLORED_ALPHA = 0.7
const CURRENT_ALPHA = 1.0
const BOSS_DOT_RADIUS = 3

/**
 * Minimap overlay displayed in the top-right corner.
 * Shows room layout as small rectangles:
 * - Current room: highlighted in green
 * - Explored rooms: visible at medium opacity
 * - Unexplored rooms: dimmed
 * - Boss room: marked with a red dot
 */
export class Minimap {
  private scene: Phaser.Scene
  private container: Phaser.GameObjects.Container
  private background: Phaser.GameObjects.Rectangle
  private border: Phaser.GameObjects.Rectangle
  private roomGraphics: Phaser.GameObjects.Graphics
  private connectionGraphics: Phaser.GameObjects.Graphics
  private bossDot: Phaser.GameObjects.Arc | null = null

  private floorData: FloorData
  private exploredRooms: Set<number> = new Set()
  private currentRoom = 0

  /** Positions of rooms on the minimap (for drawing connections) */
  private roomPositions: Array<{ x: number; y: number; w: number; h: number }> = []

  constructor(scene: Phaser.Scene, floorData: FloorData) {
    this.scene = scene
    this.floorData = floorData

    // Calculate minimap dimensions based on room layout
    const { positions, mapWidth, mapHeight } = this.computeLayout()
    this.roomPositions = positions

    const camW = scene.cameras.main.width
    const bgW = Math.min(mapWidth + MINIMAP_PADDING * 2, MINIMAP_MAX_WIDTH)
    const bgH = Math.min(mapHeight + MINIMAP_PADDING * 2, MINIMAP_MAX_HEIGHT)

    // Position in top-right corner
    const containerX = camW - bgW - MINIMAP_PADDING
    const containerY = MINIMAP_PADDING

    this.container = scene.add.container(containerX, containerY)
    this.container.setDepth(100)
    this.container.setScrollFactor(0)

    // Background
    this.background = scene.add.rectangle(
      bgW / 2, bgH / 2,
      bgW, bgH,
      MINIMAP_BG_COLOR, MINIMAP_BG_ALPHA,
    )
    this.container.add(this.background)

    // Border
    this.border = scene.add.rectangle(
      bgW / 2, bgH / 2,
      bgW, bgH,
    )
    this.border.setStrokeStyle(1, MINIMAP_BORDER_COLOR, 0.8)
    this.border.setFillStyle()
    this.container.add(this.border)

    // Graphics layers
    this.connectionGraphics = scene.add.graphics()
    this.container.add(this.connectionGraphics)

    this.roomGraphics = scene.add.graphics()
    this.container.add(this.roomGraphics)

    // Mark start room as explored
    this.exploredRooms.add(floorData.startRoom)
    this.currentRoom = floorData.startRoom

    this.draw()
  }

  /** Compute minimap layout: positions and sizes of room rectangles */
  private computeLayout(): {
    positions: Array<{ x: number; y: number; w: number; h: number }>
    mapWidth: number
    mapHeight: number
  } {
    const rooms = this.floorData.rooms
    const positions: Array<{ x: number; y: number; w: number; h: number }> = []

    // Use a simple grid layout based on room index
    // Arrange rooms in a roughly circular/chain pattern
    const count = rooms.length
    const cols = Math.ceil(Math.sqrt(count))

    let maxX = 0
    let maxY = 0

    for (let i = 0; i < count; i++) {
      const col = i % cols
      const row = Math.floor(i / cols)
      const room = rooms[i]

      const w = Math.max(8, Math.floor(room.width * MINIMAP_ROOM_SCALE))
      const h = Math.max(6, Math.floor(room.height * MINIMAP_ROOM_SCALE))
      const x = MINIMAP_PADDING + col * (MINIMAP_MAX_WIDTH / cols - MINIMAP_PADDING)
      const y = MINIMAP_PADDING + row * (MINIMAP_MAX_HEIGHT / Math.ceil(count / cols) - MINIMAP_PADDING / 2)

      positions.push({ x, y, w, h })

      maxX = Math.max(maxX, x + w)
      maxY = Math.max(maxY, y + h)
    }

    return { positions, mapWidth: maxX, mapHeight: maxY }
  }

  /** Redraw the entire minimap */
  private draw(): void {
    this.roomGraphics.clear()
    this.connectionGraphics.clear()

    // Draw connections first (behind rooms)
    this.connectionGraphics.lineStyle(1, 0x666666, 0.5)

    for (const conn of this.floorData.connections) {
      const from = this.roomPositions[conn.from]
      const to = this.roomPositions[conn.to]
      if (!from || !to) continue

      // Only draw if at least one room is explored
      const fromExplored = this.exploredRooms.has(conn.from)
      const toExplored = this.exploredRooms.has(conn.to)
      if (!fromExplored && !toExplored) continue

      const alpha = (fromExplored && toExplored) ? 0.6 : 0.2
      this.connectionGraphics.lineStyle(1, 0x888888, alpha)
      this.connectionGraphics.lineBetween(
        from.x + from.w / 2, from.y + from.h / 2,
        to.x + to.w / 2, to.y + to.h / 2,
      )
    }

    // Draw rooms
    for (let i = 0; i < this.floorData.rooms.length; i++) {
      const pos = this.roomPositions[i]
      if (!pos) continue

      const room = this.floorData.rooms[i]
      const isCurrent = i === this.currentRoom
      const isExplored = this.exploredRooms.has(i)
      const isBoss = i === this.floorData.bossRoom

      // Determine color and alpha
      const color = isCurrent ? CURRENT_ROOM_COLOR : ROOM_COLORS[room.roomType ?? 'arena']
      const alpha = isCurrent ? CURRENT_ALPHA : isExplored ? EXPLORED_ALPHA : UNEXPLORED_ALPHA

      // Draw room rectangle
      this.roomGraphics.fillStyle(color, alpha)
      this.roomGraphics.fillRect(pos.x, pos.y, pos.w, pos.h)

      // Outline for current room
      if (isCurrent) {
        this.roomGraphics.lineStyle(2, CURRENT_ROOM_COLOR, 1)
        this.roomGraphics.strokeRect(pos.x - 1, pos.y - 1, pos.w + 2, pos.h + 2)
      }

      // Boss room red dot
      if (isBoss) {
        if (this.bossDot) {
          this.bossDot.destroy()
        }
        this.bossDot = this.scene.add.circle(
          pos.x + pos.w / 2,
          pos.y + pos.h / 2,
          BOSS_DOT_RADIUS,
          0xff0000,
          isExplored || isCurrent ? 1.0 : 0.4,
        )
        this.container.add(this.bossDot)
      }
    }
  }

  /** Update the current room and mark it as explored */
  setCurrentRoom(roomIndex: number): void {
    if (roomIndex < 0 || roomIndex >= this.floorData.rooms.length) return
    this.currentRoom = roomIndex
    this.exploredRooms.add(roomIndex)
    this.draw()
  }

  /** Mark a room as explored without changing the current room */
  markExplored(roomIndex: number): void {
    if (roomIndex < 0 || roomIndex >= this.floorData.rooms.length) return
    this.exploredRooms.add(roomIndex)
    this.draw()
  }

  /** Check if a room has been explored */
  isExplored(roomIndex: number): boolean {
    return this.exploredRooms.has(roomIndex)
  }

  /** Get the current room index */
  getCurrentRoom(): number {
    return this.currentRoom
  }

  /** Show/hide the minimap */
  setVisible(visible: boolean): void {
    this.container.setVisible(visible)
  }

  /** Toggle minimap visibility */
  toggle(): void {
    this.container.setVisible(!this.container.visible)
  }

  /** Clean up all minimap objects */
  destroy(): void {
    this.container.destroy()
  }
}
