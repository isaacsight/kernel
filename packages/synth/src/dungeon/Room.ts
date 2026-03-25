import Phaser from 'phaser'
import type { RoomData, TileType, RoomType, DoorData, Vec2 } from '../types'
import { TILE_SIZE, TEX } from '../constants'

// ── Room Templates ──

/** Seed a PRNG-style random from a simple function */
function randInt(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min
}

/** Create an empty grid of floor tiles surrounded by walls */
function createEmptyGrid(width: number, height: number): TileType[][] {
  const grid: TileType[][] = []
  for (let row = 0; row < height; row++) {
    const line: TileType[] = []
    for (let col = 0; col < width; col++) {
      if (row === 0 || row === height - 1 || col === 0 || col === width - 1) {
        line.push('wall')
      } else {
        line.push('floor')
      }
    }
    grid.push(line)
  }
  return grid
}

/** Place 2x2 pillar obstacles at specified tile positions */
function placePillar(grid: TileType[][], r: number, c: number): void {
  const h = grid.length
  const w = grid[0].length
  for (let dr = 0; dr < 2; dr++) {
    for (let dc = 0; dc < 2; dc++) {
      const nr = r + dr
      const nc = c + dc
      if (nr > 0 && nr < h - 1 && nc > 0 && nc < w - 1) {
        grid[nr][nc] = 'wall'
      }
    }
  }
}

/**
 * Arena room: open space with 2-4 pillar obstacles, 4-8 enemy spawns.
 * Width: 15-25, Height: 10-18
 */
export function createArenaRoom(width?: number, height?: number): RoomData {
  const w = width ?? randInt(15, 25)
  const h = height ?? randInt(10, 18)
  const grid = createEmptyGrid(w, h)

  // Place 2-4 pillars in interior
  const pillarCount = randInt(2, 4)
  const pillars: Vec2[] = []
  for (let i = 0; i < pillarCount; i++) {
    const pr = randInt(3, h - 4)
    const pc = randInt(3, w - 4)
    placePillar(grid, pr, pc)
    pillars.push({ x: pc, y: pr })
  }

  // 8-15 enemy spawns spread across the room — ARPG density
  const enemyCount = randInt(8, 15)
  const enemySpawns: Vec2[] = []
  for (let i = 0; i < enemyCount; i++) {
    const ex = randInt(Math.floor(w * 0.3), w - 3)
    const ey = randInt(2, h - 3)
    // Avoid placing on pillars
    if (grid[ey][ex] === 'floor') {
      enemySpawns.push({ x: ex, y: ey })
    } else {
      // Try adjacent tile
      enemySpawns.push({ x: Math.min(ex + 2, w - 3), y: ey })
    }
  }

  return {
    width: w,
    height: h,
    grid,
    playerSpawn: { x: 2, y: Math.floor(h / 2) },
    partnerSpawn: { x: 3, y: Math.floor(h / 2) + 1 },
    enemySpawns,
    doors: [],
    roomType: 'arena',
  }
}

/**
 * Treasure room: small room with 1-2 enemies guarding a chest spawn point.
 * Always uses minimum dimensions.
 */
export function createTreasureRoom(width?: number, height?: number): RoomData {
  const w = width ?? randInt(15, 18)
  const h = height ?? randInt(10, 13)
  const grid = createEmptyGrid(w, h)

  // Place a single pillar near center for cover
  const centerR = Math.floor(h / 2)
  const centerC = Math.floor(w / 2)
  placePillar(grid, centerR - 1, centerC - 3)

  // Chest spawn at far end
  const chestSpawn: Vec2 = { x: w - 3, y: Math.floor(h / 2) }

  // 1-2 guard enemies near the chest
  const guardCount = randInt(1, 2)
  const enemySpawns: Vec2[] = []
  for (let i = 0; i < guardCount; i++) {
    enemySpawns.push({ x: w - 4 - i, y: Math.floor(h / 2) + (i === 0 ? -1 : 1) })
  }

  return {
    width: w,
    height: h,
    grid,
    playerSpawn: { x: 2, y: Math.floor(h / 2) },
    partnerSpawn: { x: 3, y: Math.floor(h / 2) + 1 },
    enemySpawns,
    doors: [],
    roomType: 'treasure',
    chestSpawn,
  }
}

/**
 * Boss room: large 25x20 room, open center, pillars around edges.
 */
export function createBossRoom(): RoomData {
  const w = 25
  const h = 20
  const grid = createEmptyGrid(w, h)

  // Pillars around the edges (not center) — symmetrical pattern
  const pillarPositions: Vec2[] = [
    // Top-left quadrant
    { x: 3, y: 3 }, { x: 7, y: 3 },
    // Top-right quadrant
    { x: w - 5, y: 3 }, { x: w - 9, y: 3 },
    // Bottom-left quadrant
    { x: 3, y: h - 5 }, { x: 7, y: h - 5 },
    // Bottom-right quadrant
    { x: w - 5, y: h - 5 }, { x: w - 9, y: h - 5 },
    // Mid-sides
    { x: 3, y: Math.floor(h / 2) - 1 },
    { x: w - 5, y: Math.floor(h / 2) - 1 },
  ]

  for (const p of pillarPositions) {
    placePillar(grid, p.y, p.x)
  }

  // Boss spawns at center-right
  const enemySpawns: Vec2[] = [
    { x: Math.floor(w / 2) + 4, y: Math.floor(h / 2) },
  ]

  return {
    width: w,
    height: h,
    grid,
    playerSpawn: { x: 3, y: Math.floor(h / 2) },
    partnerSpawn: { x: 4, y: Math.floor(h / 2) + 1 },
    enemySpawns,
    doors: [],
    roomType: 'boss',
  }
}

/**
 * Corridor: narrow 3-tile-wide passage connecting two rooms.
 * Direction determines orientation.
 */
export function createCorridor(
  length: number,
  direction: 'horizontal' | 'vertical',
): RoomData {
  const w = direction === 'horizontal' ? length : 5
  const h = direction === 'horizontal' ? 5 : length
  const grid = createEmptyGrid(w, h)

  // Make corridor interior 3 tiles wide
  if (direction === 'horizontal') {
    // Walls at row 0 and row 4, floor at rows 1-3
    for (let col = 0; col < w; col++) {
      grid[0][col] = 'wall'
      grid[1][col] = 'floor'
      grid[2][col] = 'floor'
      grid[3][col] = 'floor'
      grid[4][col] = 'wall'
    }
  } else {
    // Walls at col 0 and col 4, floor at cols 1-3
    for (let row = 0; row < h; row++) {
      grid[row][0] = 'wall'
      grid[row][1] = 'floor'
      grid[row][2] = 'floor'
      grid[row][3] = 'floor'
      grid[row][4] = 'wall'
    }
  }

  return {
    width: w,
    height: h,
    grid,
    playerSpawn: { x: 2, y: 2 },
    partnerSpawn: { x: 2, y: 2 },
    enemySpawns: [],
    doors: [],
    roomType: 'corridor',
  }
}

/**
 * Create a room by type, with optional custom dimensions.
 */
export function createRoom(type: RoomType, width?: number, height?: number): RoomData {
  switch (type) {
    case 'arena': return createArenaRoom(width, height)
    case 'treasure': return createTreasureRoom(width, height)
    case 'boss': return createBossRoom()
    case 'corridor': return createCorridor(width ?? 8, 'horizontal')
  }
}

/**
 * Carve a door opening into a room grid at the given edge position.
 * Opens a 3-tile-wide gap in the wall.
 */
export function carveDoor(
  room: RoomData,
  direction: 'north' | 'south' | 'east' | 'west',
  offset: number,
  leadsTo: number,
): DoorData {
  const grid = room.grid
  let pos: Vec2

  switch (direction) {
    case 'north': {
      const col = Math.min(Math.max(offset, 1), room.width - 4)
      for (let dc = 0; dc < 3; dc++) grid[0][col + dc] = 'floor'
      pos = { x: col + 1, y: 0 }
      break
    }
    case 'south': {
      const col = Math.min(Math.max(offset, 1), room.width - 4)
      for (let dc = 0; dc < 3; dc++) grid[room.height - 1][col + dc] = 'floor'
      pos = { x: col + 1, y: room.height - 1 }
      break
    }
    case 'east': {
      const row = Math.min(Math.max(offset, 1), room.height - 4)
      for (let dr = 0; dr < 3; dr++) grid[row + dr][room.width - 1] = 'floor'
      pos = { x: room.width - 1, y: row + 1 }
      break
    }
    case 'west': {
      const row = Math.min(Math.max(offset, 1), room.height - 4)
      for (let dr = 0; dr < 3; dr++) grid[row + dr][0] = 'floor'
      pos = { x: 0, y: row + 1 }
      break
    }
  }

  const door: DoorData = { position: pos, leadsTo, direction }
  room.doors.push(door)
  return door
}

// ── Floor Tile Variation ─────────────────────────────────────────────
// Latent Dissolution: tiles look like they're being generated by a
// diffusion model. Floor has noise grain, wall-floor boundaries bleed,
// and noise artifacts scatter across the ground.

const FLOOR_ROTATIONS = [0, Math.PI / 2, Math.PI, Math.PI * 1.5] // 0°, 90°, 180°, 270°

function tileHash(col: number, row: number): number {
  let h = (col * 374761393 + row * 668265263) | 0
  h = (h ^ (h >> 13)) * 1274126177
  h = h ^ (h >> 16)
  return Math.abs(h)
}

// Noise artifact colors — latent space residue
const ARTIFACT_COLORS = [0x334466, 0x443355, 0x335544, 0x554433, 0x445566]

/** Get current dissolution level (synced with TextureFactory) */
function getDissolution(scene: Phaser.Scene): number {
  // Pull floor number from scene data if available, otherwise default to low
  const dungeonScene = scene as unknown as { floorNumber?: number }
  const floor = dungeonScene.floorNumber ?? 1
  return Math.min(0.9, 0.05 + (floor - 1) * 0.1)
}

/** Render a room as Phaser sprites, return wall group for collisions */
export function renderRoom(scene: Phaser.Scene, room: RoomData): Phaser.Physics.Arcade.StaticGroup {
  const walls = scene.physics.add.staticGroup()
  const floorGraphics = scene.add.graphics().setDepth(0)
  const dissolution = getDissolution(scene)

  for (let row = 0; row < room.height; row++) {
    for (let col = 0; col < room.width; col++) {
      const x = col * TILE_SIZE + TILE_SIZE / 2
      const y = row * TILE_SIZE + TILE_SIZE / 2
      const tile = room.grid[row][col]

      if (tile === 'wall') {
        const wall = walls.create(x, y, TEX.WALL) as Phaser.Physics.Arcade.Sprite
        wall.setImmovable(true)
        wall.refreshBody()

        // Subtle depth shading (reduced from original — wall texture handles more)
        const topShadow = scene.add.rectangle(x, y - TILE_SIZE / 2 + 2, TILE_SIZE, 4, 0x000000, 0.15).setDepth(1)
        topShadow.setOrigin(0.5, 0.5)

        // ── Dissolved wall-floor boundary ──
        // Instead of sharp shadow lines, create 2-3px of blended/dissolved pixels
        const blendWidth = 2 + Math.floor(dissolution * 2) // 2-4px blend zone
        const blendAlphaBase = 0.15 + dissolution * 0.15

        // Check each adjacent direction for floor tiles — blend the boundary
        if (row + 1 < room.height && room.grid[row + 1][col] === 'floor') {
          for (let b = 0; b < blendWidth; b++) {
            const bx = col * TILE_SIZE
            const by = (row + 1) * TILE_SIZE - 1 + b
            const alpha = blendAlphaBase * (1 - b / blendWidth)
            const hash = tileHash(col * 7 + b, row * 11)
            // Noise-modulated blend — some pixels blend, others don't
            for (let px = 0; px < TILE_SIZE; px++) {
              const noise = ((hash + px * 374761) & 0x7fffffff) % 100
              if (noise < 60 + dissolution * 30) {
                floorGraphics.fillStyle(0x1a1525, alpha * (0.5 + (noise % 50) / 100))
                floorGraphics.fillRect(bx + px, by, 1, 1)
              }
            }
          }
        }
        if (col + 1 < room.width && room.grid[row][col + 1] === 'floor') {
          for (let b = 0; b < blendWidth; b++) {
            const bx = (col + 1) * TILE_SIZE - 1 + b
            const by = row * TILE_SIZE
            const alpha = blendAlphaBase * (1 - b / blendWidth)
            const hash = tileHash(col * 13 + b, row * 17)
            for (let py = 0; py < TILE_SIZE; py++) {
              const noise = ((hash + py * 668265) & 0x7fffffff) % 100
              if (noise < 60 + dissolution * 30) {
                floorGraphics.fillStyle(0x1a1525, alpha * (0.5 + (noise % 50) / 100))
                floorGraphics.fillRect(bx, by + py, 1, 1)
              }
            }
          }
        }
        if (col - 1 >= 0 && room.grid[row][col - 1] === 'floor') {
          for (let b = 0; b < blendWidth; b++) {
            const bx = col * TILE_SIZE - b
            const by = row * TILE_SIZE
            const alpha = blendAlphaBase * (1 - b / blendWidth)
            const hash = tileHash(col * 19 + b, row * 23)
            for (let py = 0; py < TILE_SIZE; py++) {
              const noise = ((hash + py * 668265) & 0x7fffffff) % 100
              if (noise < 60 + dissolution * 30) {
                floorGraphics.fillStyle(0x1a1525, alpha * (0.5 + (noise % 50) / 100))
                floorGraphics.fillRect(bx, by + py, 1, 1)
              }
            }
          }
        }
      } else {
        const floorImg = scene.add.image(x, y, TEX.FLOOR)

        // Floor tile variation: random rotation + flip per tile
        const hash = tileHash(col, row)
        const rotation = FLOOR_ROTATIONS[hash % 4]
        const flipX = (hash >> 2) % 2 === 1
        const flipY = (hash >> 3) % 2 === 1

        floorImg.setRotation(rotation)
        floorImg.setFlipX(flipX)
        floorImg.setFlipY(flipY)

        // Subtle brightness variation (0.88 - 1.0)
        const brightnessVariation = 0.88 + ((hash >> 4) % 12) / 100
        floorImg.setAlpha(brightnessVariation)

        const tileLeft = col * TILE_SIZE
        const tileTop = row * TILE_SIZE

        // ── Noise grain overlay — random bright pixels at 5-15% alpha ──
        const grainCount = 2 + Math.floor(dissolution * 6) // more grain on deeper floors
        for (let gi = 0; gi < grainCount; gi++) {
          const gh = tileHash(col * 31 + gi, row * 37 + gi)
          const gx = tileLeft + (gh % TILE_SIZE)
          const gy = tileTop + ((gh >> 5) % TILE_SIZE)
          const grainAlpha = 0.05 + ((gh >> 10) % 10) / 100 + dissolution * 0.05
          const grainColor = ((gh >> 15) % 3 === 0) ? 0x4444aa : 0x333355
          floorGraphics.fillStyle(grainColor, grainAlpha)
          floorGraphics.fillRect(gx, gy, 1, 1)
        }

        // ── Noise artifacts — small clusters of colored pixels ──
        // Unresolved generation artifacts that increase with floor depth
        const artifactSeed = (hash >> 5) % 100
        const artifactThreshold = 20 + Math.floor(dissolution * 30) // 20-50% of tiles

        if (artifactSeed < artifactThreshold) {
          const clusterSize = 1 + ((hash >> 8) % 3) // 1-3 pixels per cluster
          const artifactColor = ARTIFACT_COLORS[(hash >> 11) % ARTIFACT_COLORS.length]
          const artifactAlpha = 0.06 + dissolution * 0.08
          for (let ci = 0; ci < clusterSize; ci++) {
            const cx = tileLeft + 3 + ((hash >> (12 + ci * 2)) % (TILE_SIZE - 6))
            const cy = tileTop + 3 + ((hash >> (13 + ci * 2)) % (TILE_SIZE - 6))
            floorGraphics.fillStyle(artifactColor, artifactAlpha)
            floorGraphics.fillRect(cx, cy, 1, 1)
          }
        }
      }
    }
  }

  return walls
}
