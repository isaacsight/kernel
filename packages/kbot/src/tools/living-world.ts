// kbot Living World Engine — Ecology, Memory, Emotion, and AI-driven Evolution
//
// Goes beyond Minecraft's static blocks: blocks interact, terrain remembers,
// places have moods, conversations become geology, and dreams change the world.
//
// This module exports functions the renderer calls each frame and between streams.
// It does NOT register any tools itself.

import { homedir } from 'node:os'
import { join } from 'node:path'
import { existsSync, readFileSync, writeFileSync, mkdirSync } from 'node:fs'
import type { CanvasRenderingContext2D } from 'canvas'
import type { TileWorld, BlockType, Chunk } from './tile-world.js'
import {
  TILE_SIZE,
  CHUNK_WIDTH,
  WORLD_HEIGHT,
  generateChunk,
} from './tile-world.js'

// ─── Constants ────────────────────────────────────────────────

const KBOT_DIR = join(homedir(), '.kbot')
const LIVING_WORLD_FILE = join(KBOT_DIR, 'stream-living-world.json')

/** How many frames between ecology ticks (60 frames = ~10 seconds at 6 FPS) */
const ECOLOGY_TICK_INTERVAL = 60

/** Max block changes per evolution pass (between-stream simulation) */
const MAX_EVOLUTION_CHANGES = 100

// ─── Types ────────────────────────────────────────────────────

export interface BlockChange {
  chunkX: number
  tileX: number
  tileY: number
  from: BlockType
  to: BlockType
  reason: string
}

export interface EcologyState {
  growthMap: Map<string, number>     // "chunkX:tileX:tileY" -> growth stage (0-1)
  moistureMap: Map<string, number>   // tiles near water get moisture
  fireSpread: Array<{ x: number; y: number; life: number }>
  vineCoverage: Map<string, number>  // how much vines cover a block
  flowerMap: Map<string, string>     // "tileX:tileY" -> flower color hex
}

export interface WorldMemory {
  footpaths: Map<string, number>
  landmarks: Array<{
    x: number; y: number
    name: string
    creator: string
    type: 'build' | 'event' | 'discovery' | 'dream'
    timestamp: number
    description: string
  }>
  chatHeatmap: Map<string, number>
  events: Array<{
    x: number; y: number
    type: string
    timestamp: number
  }>
}

export interface ZoneEmotion {
  warmth: number      // 0-1
  mystery: number     // 0-1
  nostalgia: number   // 0-1
  energy: number      // 0-1
}

export interface EmotionalMap {
  zones: Map<string, ZoneEmotion>
}

export interface ConversationDeposit {
  x: number; y: number
  topic: string
  username: string
  type: 'crystal' | 'fossil' | 'artifact' | 'inscription'
  depth: number
}

export interface ConversationLayer {
  deposits: ConversationDeposit[]
}

// ─── Seeded PRNG (matches tile-world.ts) ─────────────────────

function seededRandom(seed: number): () => number {
  let s = seed | 0
  return () => {
    s = (s + 0x6D2B79F5) | 0
    let t = Math.imul(s ^ (s >>> 15), 1 | s)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

// ─── Coordinate Helpers ──────────────────────────────────────

function tileXToChunkIndex(tileX: number): number {
  return Math.floor(tileX / CHUNK_WIDTH)
}

function tileXToLocalX(tileX: number): number {
  return ((tileX % CHUNK_WIDTH) + CHUNK_WIDTH) % CHUNK_WIDTH
}

function getTile(world: TileWorld, tileX: number, tileY: number): BlockType {
  if (tileY < 0 || tileY >= WORLD_HEIGHT) return 'air'
  const chunkIdx = tileXToChunkIndex(tileX)
  let chunk = world.chunks.get(chunkIdx)
  if (!chunk) {
    chunk = generateChunk(world, chunkIdx)
    world.chunks.set(chunkIdx, chunk)
  }
  const lx = tileXToLocalX(tileX)
  return chunk.tiles[tileY][lx]
}

function setTile(world: TileWorld, tileX: number, tileY: number, block: BlockType): boolean {
  if (tileY < 0 || tileY >= WORLD_HEIGHT) return false
  const chunkIdx = tileXToChunkIndex(tileX)
  let chunk = world.chunks.get(chunkIdx)
  if (!chunk) {
    chunk = generateChunk(world, chunkIdx)
    world.chunks.set(chunkIdx, chunk)
  }
  const lx = tileXToLocalX(tileX)
  chunk.tiles[tileY][lx] = block
  chunk.modified = true
  return true
}

// ─── 1. ECOLOGY SYSTEM ───────────────────────────────────────

const FLOWER_COLORS = ['#ff6b9d', '#c084fc', '#fbbf24', '#f472b6', '#fb923c', '#a78bfa', '#34d399']

/**
 * Process one ecology tick. Called every ECOLOGY_TICK_INTERVAL frames (~10 seconds).
 * Returns list of block changes for the renderer to know what to redraw.
 */
export function tickEcology(
  world: TileWorld,
  ecology: EcologyState,
  frame: number,
): BlockChange[] {
  const changes: BlockChange[] = []
  const rng = seededRandom(frame * 7 + (world.seed || 42))

  // Process only loaded chunks to keep it performant
  for (const [chunkX, chunk] of world.chunks) {
    if (!chunk.generated) continue

    for (let y = 0; y < WORLD_HEIGHT; y++) {
      for (let lx = 0; lx < CHUNK_WIDTH; lx++) {
        const block = chunk.tiles[y][lx]
        const worldTileX = chunkX * CHUNK_WIDTH + lx
        const roll = rng()

        // --- Grass spreads to adjacent dirt (10% per tick) ---
        if (block === 'dirt' && roll < 0.10) {
          const hasAdjacentGrass =
            getTile(world, worldTileX - 1, y) === 'grass' ||
            getTile(world, worldTileX + 1, y) === 'grass' ||
            getTile(world, worldTileX, y - 1) === 'grass' ||
            getTile(world, worldTileX, y + 1) === 'grass'

          if (hasAdjacentGrass) {
            chunk.tiles[y][lx] = 'grass'
            chunk.modified = true
            changes.push({ chunkX, tileX: lx, tileY: y, from: 'dirt', to: 'grass', reason: 'grass_spread' })
          }
        }

        // --- Trees grow from grass (2% chance to sprout sapling) ---
        if (block === 'grass' && roll < 0.02) {
          // Must have air above and not be at edges
          if (y > 6 && lx >= 2 && lx < CHUNK_WIDTH - 2 && getTile(world, worldTileX, y - 1) === 'air') {
            const key = `${chunkX}:${lx}:${y}`
            const currentGrowth = ecology.growthMap.get(key) || 0

            if (currentGrowth === 0) {
              // Start a sapling — mark growth stage
              ecology.growthMap.set(key, 0.05)
            }
          }
        }

        // --- Water flows to adjacent air at same or lower Y ---
        if (block === 'water' && roll < 0.15) {
          const directions = [
            { dx: -1, dy: 0 },
            { dx: 1, dy: 0 },
            { dx: 0, dy: 1 },  // down
          ]
          for (const { dx, dy } of directions) {
            const nx = worldTileX + dx
            const ny = y + dy
            if (ny >= 0 && ny < WORLD_HEIGHT && getTile(world, nx, ny) === 'air') {
              const nChunkX = tileXToChunkIndex(nx)
              const nLocalX = tileXToLocalX(nx)
              setTile(world, nx, ny, 'water')
              changes.push({ chunkX: nChunkX, tileX: nLocalX, tileY: ny, from: 'air', to: 'water', reason: 'water_flow' })
              break  // Only spread one direction per tick
            }
          }
        }

        // --- Vines creep downward from leaves ---
        if (block === 'leaves' && roll < 0.02) {
          const key = `${worldTileX}:${y}`
          const coverage = ecology.vineCoverage.get(key) || 0
          ecology.vineCoverage.set(key, coverage + 1)

          // After 50 ticks of vine growth, the block below becomes a vine (leaves block)
          if (coverage >= 50 && y + 1 < WORLD_HEIGHT) {
            const below = getTile(world, worldTileX, y + 1)
            if (below === 'air') {
              const bChunkX = tileXToChunkIndex(worldTileX)
              const bLocalX = tileXToLocalX(worldTileX)
              setTile(world, worldTileX, y + 1, 'leaves')
              changes.push({ chunkX: bChunkX, tileX: bLocalX, tileY: y + 1, from: 'air', to: 'leaves', reason: 'vine_growth' })
              ecology.vineCoverage.delete(key)
            }
          }
        }

        // --- Erosion: dirt/sand exposed to water (1% chance to erode) ---
        if ((block === 'dirt' || block === 'sand') && roll < 0.01) {
          const hasWater =
            getTile(world, worldTileX - 1, y) === 'water' ||
            getTile(world, worldTileX + 1, y) === 'water' ||
            getTile(world, worldTileX, y - 1) === 'water' ||
            getTile(world, worldTileX, y + 1) === 'water'

          if (hasWater) {
            if (block === 'sand') {
              // Sand falls: check if air below
              if (y + 1 < WORLD_HEIGHT && getTile(world, worldTileX, y + 1) === 'air') {
                chunk.tiles[y][lx] = 'air'
                setTile(world, worldTileX, y + 1, 'sand')
                chunk.modified = true
                changes.push({ chunkX, tileX: lx, tileY: y, from: 'sand', to: 'air', reason: 'erosion_sand_fall' })
              }
            } else {
              chunk.tiles[y][lx] = 'air'
              chunk.modified = true
              changes.push({ chunkX, tileX: lx, tileY: y, from: 'dirt', to: 'air', reason: 'erosion' })
            }
          }
        }

        // --- Fire: lava adjacent to wood ignites ---
        if (block === 'lava') {
          const adjacents = [
            { dx: -1, dy: 0 }, { dx: 1, dy: 0 },
            { dx: 0, dy: -1 }, { dx: 0, dy: 1 },
          ]
          for (const { dx, dy } of adjacents) {
            const nx = worldTileX + dx
            const ny = y + dy
            const neighbor = getTile(world, nx, ny)
            if (neighbor === 'wood' || neighbor === 'leaves') {
              ecology.fireSpread.push({ x: nx, y: ny, life: 20 })
            }
          }
        }

        // --- Snow melts in daytime (0.5% per tick) ---
        if (block === 'snow' && world.timeOfDay === 'day' && roll < 0.005) {
          chunk.tiles[y][lx] = 'water'
          chunk.modified = true
          changes.push({ chunkX, tileX: lx, tileY: y, from: 'snow', to: 'water', reason: 'snow_melt' })
        }

        // --- Flowers: grass randomly sprouts decorative flowers (1% per tick) ---
        if (block === 'grass' && roll < 0.01 && y > 0 && getTile(world, worldTileX, y - 1) === 'air') {
          const flowerKey = `${worldTileX}:${y}`
          if (!ecology.flowerMap.has(flowerKey)) {
            const colorIdx = Math.floor(rng() * FLOWER_COLORS.length)
            ecology.flowerMap.set(flowerKey, FLOWER_COLORS[colorIdx])
          }
        }
      }
    }
  }

  // --- Process fire spread ---
  const remainingFires: typeof ecology.fireSpread = []
  for (const fire of ecology.fireSpread) {
    fire.life--

    if (fire.life <= 0) {
      // Fire burns out — block becomes air
      const block = getTile(world, fire.x, fire.y)
      if (block === 'wood' || block === 'leaves') {
        const fChunkX = tileXToChunkIndex(fire.x)
        const fLocalX = tileXToLocalX(fire.x)
        setTile(world, fire.x, fire.y, 'air')
        changes.push({ chunkX: fChunkX, tileX: fLocalX, tileY: fire.y, from: block, to: 'air', reason: 'fire_burnout' })
      }
      continue
    }

    // Fire spreads to adjacent wood/leaves
    if (fire.life % 5 === 0) {
      const directions = [
        { dx: -1, dy: 0 }, { dx: 1, dy: 0 },
        { dx: 0, dy: -1 }, { dx: 0, dy: 1 },
      ]
      for (const { dx, dy } of directions) {
        const nx = fire.x + dx
        const ny = fire.y + dy
        const neighbor = getTile(world, nx, ny)
        if (neighbor === 'wood' || neighbor === 'leaves') {
          // Check not already on fire
          const alreadyBurning = ecology.fireSpread.some(f => f.x === nx && f.y === ny)
          if (!alreadyBurning) {
            remainingFires.push({ x: nx, y: ny, life: 20 })
          }
        }
      }
    }

    remainingFires.push(fire)
  }
  ecology.fireSpread = remainingFires

  // --- Process tree growth (saplings in growthMap) ---
  for (const [key, growth] of ecology.growthMap) {
    const newGrowth = growth + (1 / 30)  // full tree in 30 ticks (~5 minutes)
    if (newGrowth >= 1.0) {
      // Fully grown — place a tree
      const parts = key.split(':')
      const cX = parseInt(parts[0])
      const localX = parseInt(parts[1])
      const baseY = parseInt(parts[2])
      const worldTileX = cX * CHUNK_WIDTH + localX

      // Place trunk (3 blocks)
      for (let dy = 1; dy <= 3; dy++) {
        if (baseY - dy >= 0) {
          setTile(world, worldTileX, baseY - dy, 'wood')
          const tChunkX = tileXToChunkIndex(worldTileX)
          const tLocalX = tileXToLocalX(worldTileX)
          changes.push({ chunkX: tChunkX, tileX: tLocalX, tileY: baseY - dy, from: 'air', to: 'wood', reason: 'tree_growth' })
        }
      }
      // Place leaves crown (3x3)
      const crownY = baseY - 3
      for (let dy = -1; dy <= 1; dy++) {
        for (let dx = -1; dx <= 1; dx++) {
          const ly = crownY + dy
          const lx = worldTileX + dx
          if (ly >= 0 && ly < WORLD_HEIGHT && getTile(world, lx, ly) === 'air') {
            setTile(world, lx, ly, 'leaves')
            const lChunkX = tileXToChunkIndex(lx)
            const lLocalX = tileXToLocalX(lx)
            changes.push({ chunkX: lChunkX, tileX: lLocalX, tileY: ly, from: 'air', to: 'leaves', reason: 'tree_growth' })
          }
        }
      }
      // Top leaf
      if (crownY - 1 >= 0 && getTile(world, worldTileX, crownY - 1) === 'air') {
        setTile(world, worldTileX, crownY - 1, 'leaves')
        const topChunkX = tileXToChunkIndex(worldTileX)
        const topLocalX = tileXToLocalX(worldTileX)
        changes.push({ chunkX: topChunkX, tileX: topLocalX, tileY: crownY - 1, from: 'air', to: 'leaves', reason: 'tree_growth' })
      }

      ecology.growthMap.delete(key)
    } else {
      ecology.growthMap.set(key, newGrowth)
    }
  }

  return changes
}

// ─── 2. MEMORY IN TERRAIN ────────────────────────────────────

export function recordFootstep(memory: WorldMemory, worldX: number, worldY: number): void {
  const key = `${worldX}:${worldY}`
  memory.footpaths.set(key, (memory.footpaths.get(key) || 0) + 1)
}

export function recordLandmark(
  memory: WorldMemory,
  x: number,
  y: number,
  name: string,
  creator: string,
  type: string,
  description: string,
): void {
  const validType = (type === 'build' || type === 'event' || type === 'discovery' || type === 'dream')
    ? type as 'build' | 'event' | 'discovery' | 'dream'
    : 'build'

  memory.landmarks.push({
    x, y, name, creator,
    type: validType,
    timestamp: Date.now(),
    description,
  })
}

export function recordChatActivity(memory: WorldMemory, chunkX: number): void {
  const key = String(chunkX)
  memory.chatHeatmap.set(key, (memory.chatHeatmap.get(key) || 0) + 1)
}

export function recordEvent(memory: WorldMemory, x: number, y: number, type: string): void {
  memory.events.push({ x, y, type, timestamp: Date.now() })
}

/**
 * Render memory effects as overlays on the tile world.
 * Called after tile rendering, before UI.
 */
export function renderMemoryEffects(
  ctx: CanvasRenderingContext2D,
  memory: WorldMemory,
  cameraX: number,
  tileSize: number,
  frame: number,
): void {
  ctx.save()

  // --- Footpath overlays: lighter pixels on walked tiles ---
  for (const [key, count] of memory.footpaths) {
    if (count < 10) continue

    const [xStr, yStr] = key.split(':')
    const tileX = parseInt(xStr)
    const tileY = parseInt(yStr)

    const screenX = tileX * tileSize - Math.floor(cameraX)
    const screenY = tileY * tileSize

    // Skip off-screen
    if (screenX < -tileSize || screenX > 800 || screenY < -tileSize || screenY > 600) continue

    if (count >= 50) {
      // Proper trail — stone-like color
      ctx.fillStyle = 'rgba(156, 163, 175, 0.35)'
    } else {
      // Worn path — lighter dirt
      ctx.fillStyle = 'rgba(200, 180, 150, 0.2)'
    }
    ctx.fillRect(screenX + 2, screenY + tileSize - 3, tileSize - 4, 2)
  }

  // --- Landmark markers: tiny flags ---
  for (const landmark of memory.landmarks) {
    const screenX = landmark.x * tileSize - Math.floor(cameraX)
    const screenY = landmark.y * tileSize

    if (screenX < -tileSize || screenX > 800 || screenY < -tileSize || screenY > 600) continue

    // Flagpole (thin white line)
    ctx.fillStyle = '#ffffff'
    ctx.fillRect(screenX + Math.floor(tileSize / 2), screenY - 8, 1, 8)

    // Flag (colored by type)
    switch (landmark.type) {
      case 'build':     ctx.fillStyle = '#fbbf24'; break  // gold
      case 'event':     ctx.fillStyle = '#f87171'; break  // red
      case 'discovery': ctx.fillStyle = '#34d399'; break  // green
      case 'dream':     ctx.fillStyle = '#a78bfa'; break  // purple
    }
    ctx.fillRect(screenX + Math.floor(tileSize / 2) + 1, screenY - 8, 4, 3)

    // Pulse animation for recent landmarks (< 60 seconds old)
    const age = Date.now() - landmark.timestamp
    if (age < 60_000) {
      const pulse = Math.sin(frame * 0.2) * 0.3 + 0.3
      ctx.globalAlpha = pulse
      ctx.fillRect(screenX + Math.floor(tileSize / 2) - 1, screenY - 10, 7, 5)
      ctx.globalAlpha = 1
    }
  }

  // --- Chat heatmap tint: warm/cool color wash per chunk ---
  // (Applied per-chunk as a large overlay rectangle)
  for (const [chunkKey, count] of memory.chatHeatmap) {
    const chunkX = parseInt(chunkKey)
    const chunkScreenX = chunkX * CHUNK_WIDTH * tileSize - Math.floor(cameraX)
    const chunkPixelWidth = CHUNK_WIDTH * tileSize

    if (chunkScreenX + chunkPixelWidth < 0 || chunkScreenX > 800) continue

    if (count > 5) {
      // Warm tint — active area
      const intensity = Math.min(0.08, count * 0.005)
      ctx.fillStyle = `rgba(255, 160, 60, ${intensity})`
    } else {
      // Cool tint — quiet area
      ctx.fillStyle = 'rgba(60, 100, 200, 0.03)'
    }
    ctx.fillRect(chunkScreenX, 0, chunkPixelWidth, WORLD_HEIGHT * tileSize)
  }

  ctx.restore()
}

// ─── 3. EMOTIONAL GEOGRAPHY ──────────────────────────────────

/**
 * Update the emotional map based on activity, memory, and time.
 */
export function updateEmotionalMap(
  emotions: EmotionalMap,
  memory: WorldMemory,
  currentChunkX: number,
  chatActive: boolean,
  frame: number,
): void {
  const key = String(currentChunkX)

  // Initialize zone if new
  if (!emotions.zones.has(key)) {
    emotions.zones.set(key, {
      warmth: 0,
      mystery: 1.0,
      nostalgia: 0,
      energy: 0,
    })
  }

  const zone = emotions.zones.get(key)!

  // Warmth: increases when chat active, decays slowly
  if (chatActive) {
    zone.warmth = Math.min(1.0, zone.warmth + 0.02)
  } else {
    zone.warmth = Math.max(0, zone.warmth - 0.001)
  }

  // Mystery: decreases each visit, never reaches 0
  zone.mystery = Math.max(0.05, zone.mystery - 0.005)

  // Nostalgia: increases over time for visited chunks
  zone.nostalgia = Math.min(1.0, zone.nostalgia + 0.001)

  // Energy: check for recent events near this chunk
  const recentEvents = memory.events.filter(e => {
    const eventChunk = tileXToChunkIndex(e.x)
    return eventChunk === currentChunkX && (Date.now() - e.timestamp) < 30_000
  })
  if (recentEvents.length > 0) {
    zone.energy = Math.min(1.0, zone.energy + 0.1 * recentEvents.length)
  } else {
    zone.energy = Math.max(0, zone.energy - 0.02)
  }

  // Decay all zones slightly (time passes)
  for (const [zoneKey, z] of emotions.zones) {
    if (zoneKey === key) continue  // Current zone already processed
    z.warmth = Math.max(0, z.warmth - 0.0005)
    z.energy = Math.max(0, z.energy - 0.005)
    z.nostalgia = Math.min(1.0, z.nostalgia + 0.0005)
  }
}

/**
 * Get the emotional tint color for a chunk.
 */
export function getEmotionalTint(
  emotions: EmotionalMap,
  chunkX: number,
): { r: number; g: number; b: number; a: number } {
  const key = String(chunkX)
  const zone = emotions.zones.get(key)

  if (!zone) {
    // Unvisited — high mystery
    return { r: 0, g: 0, b: 20, a: 0.08 }
  }

  let r = 0, g = 0, b = 0, a = 0

  // High warmth: warm orange tint
  if (zone.warmth > 0.1) {
    r += 20 * zone.warmth
    g += 10 * zone.warmth
    a += 0.05 * zone.warmth
  }

  // High mystery: cool blue tint
  if (zone.mystery > 0.3) {
    b += 20 * zone.mystery
    a += 0.08 * zone.mystery
  }

  // High nostalgia: golden haze
  if (zone.nostalgia > 0.2) {
    r += 15 * zone.nostalgia
    g += 12 * zone.nostalgia
    a += 0.04 * zone.nostalgia
  }

  // High energy: bright white flash (pulsing)
  if (zone.energy > 0.1) {
    const pulse = Math.sin(Date.now() * 0.005) * 0.5 + 0.5
    r += 10 * zone.energy * pulse
    g += 10 * zone.energy * pulse
    b += 10 * zone.energy * pulse
    a += 0.03 * zone.energy * pulse
  }

  return {
    r: Math.min(30, Math.round(r)),
    g: Math.min(25, Math.round(g)),
    b: Math.min(30, Math.round(b)),
    a: Math.min(0.15, a),
  }
}

// ─── 4. CONVERSATION GEOLOGY ─────────────────────────────────

const TOPIC_MAPPING: Record<string, { type: ConversationDeposit['type']; color: string }> = {
  music:    { type: 'crystal',     color: '#a78bfa' },  // purple crystal
  code:     { type: 'artifact',    color: '#34d399' },  // green circuit
  ai:       { type: 'artifact',    color: '#c084fc' },  // purple neural
  security: { type: 'inscription', color: '#f87171' },  // red shield
  nature:   { type: 'fossil',      color: '#a16207' },  // brown fossil
  art:      { type: 'crystal',     color: '#fb923c' },  // orange crystal
  science:  { type: 'artifact',    color: '#38bdf8' },  // blue circuit
  gaming:   { type: 'crystal',     color: '#fbbf24' },  // gold crystal
  math:     { type: 'inscription', color: '#22d3ee' },  // cyan inscription
}

/**
 * Generate a conversation deposit from a chat topic.
 */
export function generateConversationDeposit(
  topic: string,
  username: string,
  worldX: number,
): ConversationDeposit {
  const mapping = TOPIC_MAPPING[topic.toLowerCase()] || { type: 'fossil' as const, color: '#9ca3af' }
  const rng = seededRandom(worldX * 31 + topic.length * 17 + Date.now())

  // Place at random depth underground (deeper = older conversations over time)
  const minDepth = 15  // below surface
  const maxDepth = WORLD_HEIGHT - 3
  const depth = minDepth + Math.floor(rng() * (maxDepth - minDepth))

  return {
    x: worldX,
    y: depth,
    topic,
    username,
    type: mapping.type,
    depth,
  }
}

/**
 * Render a conversation deposit as a special block pattern.
 */
export function renderConversationDeposit(
  ctx: CanvasRenderingContext2D,
  deposit: ConversationDeposit,
  screenX: number,
  screenY: number,
  tileSize: number,
): void {
  const mapping = TOPIC_MAPPING[deposit.topic.toLowerCase()] || { type: 'fossil', color: '#9ca3af' }
  const S = tileSize

  ctx.save()

  switch (deposit.type) {
    case 'crystal':
      // Crystal: diamond-shaped bright pattern (2x2)
      ctx.fillStyle = mapping.color
      ctx.globalAlpha = 0.7
      // Center diamond
      ctx.fillRect(screenX + Math.floor(S / 2) - 1, screenY + 2, 2, S - 4)
      ctx.fillRect(screenX + 2, screenY + Math.floor(S / 2) - 1, S - 4, 2)
      // Sparkle dots
      ctx.globalAlpha = 0.4
      ctx.fillRect(screenX + 3, screenY + 3, 1, 1)
      ctx.fillRect(screenX + S - 4, screenY + S - 4, 1, 1)
      break

    case 'artifact':
      // Circuit: grid-like green/purple pattern
      ctx.fillStyle = mapping.color
      ctx.globalAlpha = 0.6
      // Horizontal lines
      ctx.fillRect(screenX + 2, screenY + 4, S - 4, 1)
      ctx.fillRect(screenX + 2, screenY + S - 5, S - 4, 1)
      // Vertical lines
      ctx.fillRect(screenX + 4, screenY + 2, 1, S - 4)
      ctx.fillRect(screenX + S - 5, screenY + 2, 1, S - 4)
      // Nodes at intersections
      ctx.globalAlpha = 0.9
      ctx.fillRect(screenX + 4, screenY + 4, 2, 2)
      ctx.fillRect(screenX + S - 6, screenY + S - 6, 2, 2)
      break

    case 'inscription':
      // Shield/rune: bordered rectangle with inner mark
      ctx.strokeStyle = mapping.color
      ctx.globalAlpha = 0.6
      ctx.lineWidth = 1
      ctx.strokeRect(screenX + 3, screenY + 2, S - 6, S - 4)
      // Inner glyph (X mark)
      ctx.fillStyle = mapping.color
      ctx.globalAlpha = 0.8
      ctx.fillRect(screenX + 5, screenY + 5, 1, 1)
      ctx.fillRect(screenX + S - 6, screenY + 5, 1, 1)
      ctx.fillRect(screenX + Math.floor(S / 2), screenY + Math.floor(S / 2), 1, 1)
      ctx.fillRect(screenX + 5, screenY + S - 6, 1, 1)
      ctx.fillRect(screenX + S - 6, screenY + S - 6, 1, 1)
      break

    case 'fossil':
      // Leaf/spiral fossil pattern
      ctx.fillStyle = mapping.color
      ctx.globalAlpha = 0.5
      // Spiral approximation
      ctx.fillRect(screenX + 5, screenY + 4, 4, 1)
      ctx.fillRect(screenX + 8, screenY + 5, 1, 3)
      ctx.fillRect(screenX + 5, screenY + 7, 4, 1)
      ctx.fillRect(screenX + 5, screenY + 5, 1, 2)
      ctx.fillRect(screenX + 6, screenY + 6, 2, 1)
      break
  }

  ctx.restore()
}

// ─── 5. DREAM TERRAIN ────────────────────────────────────────

const DREAM_KEYWORD_MAP: Record<string, { block: BlockType; action: string }> = {
  mountain:  { block: 'stone',        action: 'raise' },
  mountains: { block: 'stone',        action: 'raise' },
  hill:      { block: 'dirt',         action: 'raise' },
  ocean:     { block: 'water',        action: 'pool' },
  water:     { block: 'water',        action: 'pool' },
  river:     { block: 'water',        action: 'pool' },
  star:      { block: 'ore_diamond',  action: 'underground' },
  stars:     { block: 'ore_diamond',  action: 'underground' },
  fire:      { block: 'lava',         action: 'underground' },
  flame:     { block: 'lava',         action: 'underground' },
  forest:    { block: 'leaves',       action: 'raise' },
  tree:      { block: 'wood',         action: 'raise' },
  ice:       { block: 'ice',          action: 'surface' },
  snow:      { block: 'snow',         action: 'surface' },
  gold:      { block: 'ore_gold',     action: 'underground' },
  crystal:   { block: 'ore_diamond',  action: 'underground' },
  brick:     { block: 'brick',        action: 'surface' },
  sand:      { block: 'sand',         action: 'surface' },
  desert:    { block: 'sand',         action: 'surface' },
}

/**
 * Apply dream-induced terrain changes. Called when the robot wakes from dreaming.
 * Returns 3-5 subtle block changes based on dream content keywords.
 */
export function applyDreamChanges(
  world: TileWorld,
  dreamInsights: string[],
): BlockChange[] {
  const changes: BlockChange[] = []
  const combined = dreamInsights.join(' ').toLowerCase()
  const rng = seededRandom(Date.now())

  // Find matching dream keywords
  const matches: Array<{ block: BlockType; action: string }> = []
  for (const [keyword, mapping] of Object.entries(DREAM_KEYWORD_MAP)) {
    if (combined.includes(keyword)) {
      matches.push(mapping)
    }
  }

  // Default: random gentle change if no keywords matched
  if (matches.length === 0) {
    matches.push({ block: 'grass', action: 'surface' })
  }

  // Apply 3-5 changes
  const numChanges = 3 + Math.floor(rng() * 3)
  const cameraChunk = tileXToChunkIndex(Math.floor(world.cameraX / TILE_SIZE))

  for (let i = 0; i < Math.min(numChanges, matches.length + 2); i++) {
    const match = matches[i % matches.length]
    const offsetX = Math.floor(rng() * CHUNK_WIDTH)
    const worldTileX = cameraChunk * CHUNK_WIDTH + offsetX

    switch (match.action) {
      case 'raise': {
        // Find surface and raise 3-4 blocks
        let surfaceY = -1
        for (let y = 0; y < WORLD_HEIGHT; y++) {
          const block = getTile(world, worldTileX, y)
          if (block !== 'air' && block !== 'water' && block !== 'leaves') {
            surfaceY = y
            break
          }
        }
        if (surfaceY > 3) {
          const raiseHeight = 2 + Math.floor(rng() * 3)
          for (let dy = 1; dy <= raiseHeight; dy++) {
            const ty = surfaceY - dy
            if (ty >= 0 && getTile(world, worldTileX, ty) === 'air') {
              setTile(world, worldTileX, ty, match.block)
              const cX = tileXToChunkIndex(worldTileX)
              const lX = tileXToLocalX(worldTileX)
              changes.push({ chunkX: cX, tileX: lX, tileY: ty, from: 'air', to: match.block, reason: 'dream' })
            }
          }
        }
        break
      }
      case 'pool': {
        // Find surface and place water pool (3 wide, 1 deep)
        let surfaceY = -1
        for (let y = 0; y < WORLD_HEIGHT; y++) {
          const block = getTile(world, worldTileX, y)
          if (block !== 'air' && block !== 'water' && block !== 'leaves') {
            surfaceY = y
            break
          }
        }
        if (surfaceY > 0 && surfaceY < WORLD_HEIGHT - 1) {
          for (let dx = -1; dx <= 1; dx++) {
            const tx = worldTileX + dx
            const prevBlock = getTile(world, tx, surfaceY)
            if (prevBlock !== 'water' && prevBlock !== 'lava') {
              setTile(world, tx, surfaceY, 'water')
              const cX = tileXToChunkIndex(tx)
              const lX = tileXToLocalX(tx)
              changes.push({ chunkX: cX, tileX: lX, tileY: surfaceY, from: prevBlock, to: 'water', reason: 'dream' })
            }
          }
        }
        break
      }
      case 'underground': {
        // Place ore/lava deep underground
        const depth = 25 + Math.floor(rng() * (WORLD_HEIGHT - 28))
        if (depth < WORLD_HEIGHT) {
          const prevBlock = getTile(world, worldTileX, depth)
          if (prevBlock === 'stone' || prevBlock === 'dirt') {
            setTile(world, worldTileX, depth, match.block)
            const cX = tileXToChunkIndex(worldTileX)
            const lX = tileXToLocalX(worldTileX)
            changes.push({ chunkX: cX, tileX: lX, tileY: depth, from: prevBlock, to: match.block, reason: 'dream' })
          }
        }
        break
      }
      case 'surface': {
        // Replace surface block
        let surfaceY = -1
        for (let y = 0; y < WORLD_HEIGHT; y++) {
          const block = getTile(world, worldTileX, y)
          if (block !== 'air' && block !== 'water' && block !== 'leaves') {
            surfaceY = y
            break
          }
        }
        if (surfaceY >= 0) {
          const prevBlock = getTile(world, worldTileX, surfaceY)
          setTile(world, worldTileX, surfaceY, match.block)
          const cX = tileXToChunkIndex(worldTileX)
          const lX = tileXToLocalX(worldTileX)
          changes.push({ chunkX: cX, tileX: lX, tileY: surfaceY, from: prevBlock, to: match.block, reason: 'dream' })
        }
        break
      }
    }
  }

  return changes
}

// ─── 6. WORLD EVOLUTION (Between Streams) ────────────────────

/**
 * Simulate what happened while the stream was off.
 * Called when a stream starts with a previously saved world.
 * Accelerated: 1 tick per simulated hour.
 */
export function evolveWorld(
  world: TileWorld,
  ecology: EcologyState,
  hoursElapsed: number,
): BlockChange[] {
  const changes: BlockChange[] = []
  const ticksToSimulate = Math.min(hoursElapsed, MAX_EVOLUTION_CHANGES)  // Cap simulation
  const rng = seededRandom(Date.now())

  for (let tick = 0; tick < ticksToSimulate && changes.length < MAX_EVOLUTION_CHANGES; tick++) {
    for (const [chunkX, chunk] of world.chunks) {
      if (changes.length >= MAX_EVOLUTION_CHANGES) break

      for (let y = 0; y < WORLD_HEIGHT && changes.length < MAX_EVOLUTION_CHANGES; y++) {
        for (let lx = 0; lx < CHUNK_WIDTH && changes.length < MAX_EVOLUTION_CHANGES; lx++) {
          const block = chunk.tiles[y][lx]
          const worldTileX = chunkX * CHUNK_WIDTH + lx
          const roll = rng()

          // Grass spreads (accelerated)
          if (block === 'dirt' && roll < 0.10) {
            const hasGrass =
              getTile(world, worldTileX - 1, y) === 'grass' ||
              getTile(world, worldTileX + 1, y) === 'grass' ||
              getTile(world, worldTileX, y - 1) === 'grass' ||
              getTile(world, worldTileX, y + 1) === 'grass'

            if (hasGrass) {
              chunk.tiles[y][lx] = 'grass'
              chunk.modified = true
              changes.push({ chunkX, tileX: lx, tileY: y, from: 'dirt', to: 'grass', reason: 'evolution_grass' })
            }
          }

          // Trees grow (saplings become full trees instantly in evolution)
          // Process existing saplings from growthMap
          const growthKey = `${chunkX}:${lx}:${y}`
          const growth = ecology.growthMap.get(growthKey)
          if (growth !== undefined && growth < 1.0) {
            ecology.growthMap.set(growthKey, Math.min(1.0, growth + 0.2))  // 5 hours to full tree
          }

          // Vines extend
          if (block === 'leaves' && roll < 0.05) {
            const vineKey = `${worldTileX}:${y}`
            const coverage = ecology.vineCoverage.get(vineKey) || 0
            ecology.vineCoverage.set(vineKey, coverage + 10)  // Accelerated

            if (coverage + 10 >= 50 && y + 1 < WORLD_HEIGHT) {
              const below = getTile(world, worldTileX, y + 1)
              if (below === 'air') {
                setTile(world, worldTileX, y + 1, 'leaves')
                const bChunkX = tileXToChunkIndex(worldTileX)
                const bLocalX = tileXToLocalX(worldTileX)
                changes.push({ chunkX: bChunkX, tileX: bLocalX, tileY: y + 1, from: 'air', to: 'leaves', reason: 'evolution_vine' })
                ecology.vineCoverage.delete(vineKey)
              }
            }
          }

          // Erosion progresses
          if ((block === 'dirt' || block === 'sand') && roll < 0.005) {
            const hasWater =
              getTile(world, worldTileX - 1, y) === 'water' ||
              getTile(world, worldTileX + 1, y) === 'water' ||
              getTile(world, worldTileX, y - 1) === 'water' ||
              getTile(world, worldTileX, y + 1) === 'water'
            if (hasWater) {
              chunk.tiles[y][lx] = 'air'
              chunk.modified = true
              changes.push({ chunkX, tileX: lx, tileY: y, from: block, to: 'air', reason: 'evolution_erosion' })
            }
          }
        }
      }
    }
  }

  return changes
}

// ─── 7. PERSISTENCE ──────────────────────────────────────────

/** Serialize a Map to a plain object for JSON */
function mapToObj<V>(map: Map<string, V>): Record<string, V> {
  const obj: Record<string, V> = {}
  for (const [k, v] of map) {
    obj[k] = v
  }
  return obj
}

/** Deserialize a plain object back to a Map */
function objToMap<V>(obj: Record<string, V> | undefined): Map<string, V> {
  const map = new Map<string, V>()
  if (obj) {
    for (const [k, v] of Object.entries(obj)) {
      map.set(k, v)
    }
  }
  return map
}

/**
 * Save living world state to disk alongside tile data.
 */
export function saveLivingWorldState(
  ecology: EcologyState,
  memory: WorldMemory,
  emotions: EmotionalMap,
  conversations: ConversationLayer,
): void {
  try {
    if (!existsSync(KBOT_DIR)) {
      mkdirSync(KBOT_DIR, { recursive: true })
    }

    const data = {
      version: 1,
      savedAt: Date.now(),
      ecology: {
        growthMap: mapToObj(ecology.growthMap),
        moistureMap: mapToObj(ecology.moistureMap),
        fireSpread: ecology.fireSpread,
        vineCoverage: mapToObj(ecology.vineCoverage),
        flowerMap: mapToObj(ecology.flowerMap),
      },
      memory: {
        footpaths: mapToObj(memory.footpaths),
        landmarks: memory.landmarks,
        chatHeatmap: mapToObj(memory.chatHeatmap),
        events: memory.events,
      },
      emotions: {
        zones: mapToObj(emotions.zones),
      },
      conversations: {
        deposits: conversations.deposits,
      },
    }

    writeFileSync(LIVING_WORLD_FILE, JSON.stringify(data))
  } catch {
    // Silently fail — don't crash the stream
  }
}

/**
 * Load living world state from disk.
 */
export function loadLivingWorldState(): {
  ecology: EcologyState
  memory: WorldMemory
  emotions: EmotionalMap
  conversations: ConversationLayer
} | null {
  try {
    if (!existsSync(LIVING_WORLD_FILE)) return null

    const raw = JSON.parse(readFileSync(LIVING_WORLD_FILE, 'utf-8'))
    if (!raw || raw.version !== 1) return null

    return {
      ecology: {
        growthMap: objToMap<number>(raw.ecology?.growthMap),
        moistureMap: objToMap<number>(raw.ecology?.moistureMap),
        fireSpread: Array.isArray(raw.ecology?.fireSpread) ? raw.ecology.fireSpread : [],
        vineCoverage: objToMap<number>(raw.ecology?.vineCoverage),
        flowerMap: objToMap<string>(raw.ecology?.flowerMap),
      },
      memory: {
        footpaths: objToMap<number>(raw.memory?.footpaths),
        landmarks: Array.isArray(raw.memory?.landmarks) ? raw.memory.landmarks : [],
        chatHeatmap: objToMap<number>(raw.memory?.chatHeatmap),
        events: Array.isArray(raw.memory?.events) ? raw.memory.events : [],
      },
      emotions: {
        zones: objToMap<ZoneEmotion>(raw.emotions?.zones),
      },
      conversations: {
        deposits: Array.isArray(raw.conversations?.deposits) ? raw.conversations.deposits : [],
      },
    }
  } catch {
    return null
  }
}

// ─── Integration Points ──────────────────────────────────────

/**
 * Initialize all living world subsystems.
 * Call at stream start. Loads from disk if available.
 */
export function initLivingWorld(): {
  ecology: EcologyState
  memory: WorldMemory
  emotions: EmotionalMap
  conversations: ConversationLayer
} {
  // Try loading from disk first
  const saved = loadLivingWorldState()
  if (saved) return saved

  // Fresh state
  return {
    ecology: {
      growthMap: new Map(),
      moistureMap: new Map(),
      fireSpread: [],
      vineCoverage: new Map(),
      flowerMap: new Map(),
    },
    memory: {
      footpaths: new Map(),
      landmarks: [],
      chatHeatmap: new Map(),
      events: [],
    },
    emotions: {
      zones: new Map(),
    },
    conversations: {
      deposits: [],
    },
  }
}

/**
 * Main tick function. Call every ECOLOGY_TICK_INTERVAL frames (~10 seconds).
 * Processes ecology, updates emotional map, records robot footstep.
 */
export function tickLivingWorld(
  world: TileWorld,
  ecology: EcologyState,
  memory: WorldMemory,
  emotions: EmotionalMap,
  conversations: ConversationLayer,
  robotX: number,
  chatActive: boolean,
  frame: number,
): { changes: BlockChange[]; newLandmarks: string[] } {
  // Only tick ecology every ECOLOGY_TICK_INTERVAL frames
  const changes = (frame % ECOLOGY_TICK_INTERVAL === 0)
    ? tickEcology(world, ecology, frame)
    : []

  // Record robot footstep
  const robotTileX = Math.floor(robotX / TILE_SIZE)
  let robotTileY = -1
  for (let y = 0; y < WORLD_HEIGHT; y++) {
    const block = getTile(world, robotTileX, y)
    if (block !== 'air' && block !== 'water' && block !== 'leaves') {
      robotTileY = y - 1  // robot stands on top of the block
      break
    }
  }
  if (robotTileY >= 0) {
    recordFootstep(memory, robotTileX, robotTileY)
  }

  // Update emotional map
  const currentChunkX = tileXToChunkIndex(robotTileX)
  updateEmotionalMap(emotions, memory, currentChunkX, chatActive, frame)

  // Check if robot found a conversation deposit while digging
  const newLandmarks: string[] = []
  if (robotTileY >= 0) {
    for (let i = conversations.deposits.length - 1; i >= 0; i--) {
      const deposit = conversations.deposits[i]
      const depositTileX = Math.floor(deposit.x / TILE_SIZE)

      // Check proximity (within 2 tiles)
      if (Math.abs(depositTileX - robotTileX) <= 2 && Math.abs(deposit.y - robotTileY) <= 2) {
        const label = `Found a ${deposit.type} from when @${deposit.username} was talking about ${deposit.topic}!`
        newLandmarks.push(label)

        // Record as landmark
        recordLandmark(memory, robotTileX, robotTileY, `${deposit.topic} ${deposit.type}`, deposit.username, 'discovery', label)

        // Remove the deposit (it's been found)
        conversations.deposits.splice(i, 1)
      }
    }
  }

  // Auto-save periodically (every 300 frames = ~50 seconds)
  if (frame % 300 === 0) {
    saveLivingWorldState(ecology, memory, emotions, conversations)
  }

  return { changes, newLandmarks }
}

/**
 * Render all living world overlays on top of the tile world.
 * Call after tile rendering, before UI layer.
 */
export function renderLivingWorldOverlays(
  ctx: CanvasRenderingContext2D,
  memory: WorldMemory,
  emotions: EmotionalMap,
  conversations: ConversationLayer,
  cameraX: number,
  tileSize: number,
  frame: number,
): void {
  ctx.save()

  // 1. Emotional tint per chunk (background wash)
  const startChunk = tileXToChunkIndex(Math.floor(cameraX / tileSize)) - 1
  const endChunk = startChunk + 3
  for (let cx = startChunk; cx <= endChunk; cx++) {
    const tint = getEmotionalTint(emotions, cx)
    if (tint.a > 0.005) {
      const chunkScreenX = cx * CHUNK_WIDTH * tileSize - Math.floor(cameraX)
      const chunkPixelWidth = CHUNK_WIDTH * tileSize
      ctx.fillStyle = `rgba(${tint.r}, ${tint.g}, ${tint.b}, ${tint.a})`
      ctx.fillRect(chunkScreenX, 0, chunkPixelWidth, WORLD_HEIGHT * tileSize)
    }
  }

  // 2. Memory effects (footpaths, landmarks, heatmap)
  renderMemoryEffects(ctx, memory, cameraX, tileSize, frame)

  // 3. Visible conversation deposits (underground patterns)
  for (const deposit of conversations.deposits) {
    const screenX = Math.floor(deposit.x / tileSize) * tileSize - Math.floor(cameraX)
    const screenY = deposit.y * tileSize

    // Only render if on screen
    if (screenX >= -tileSize && screenX <= 800 && screenY >= -tileSize && screenY <= 800) {
      renderConversationDeposit(ctx, deposit, screenX, screenY, tileSize)
    }
  }

  // 4. Flower decorations (tiny colored dots on grass)
  const ecology = undefined  // Flowers stored in ecology but rendered here via closure
  // (The caller should pass ecology.flowerMap, but we render from the data we have)

  ctx.restore()
}

/**
 * Handle a chat message — record activity and generate conversation deposits.
 */
export function onChatMessage(
  memory: WorldMemory,
  conversations: ConversationLayer,
  username: string,
  text: string,
  robotWorldX: number,
  topics: string[],
): void {
  // Record chat activity in the current chunk
  const robotTileX = Math.floor(robotWorldX / TILE_SIZE)
  const chunkX = tileXToChunkIndex(robotTileX)
  recordChatActivity(memory, chunkX)

  // Generate conversation deposits for recognized topics
  for (const topic of topics) {
    if (TOPIC_MAPPING[topic.toLowerCase()]) {
      const deposit = generateConversationDeposit(topic, username, robotWorldX)
      conversations.deposits.push(deposit)
    }
  }
}

/**
 * Render flower decorations from ecology state.
 * Call this separately if you have access to ecology.flowerMap.
 */
export function renderFlowers(
  ctx: CanvasRenderingContext2D,
  flowerMap: Map<string, string>,
  cameraX: number,
  tileSize: number,
  frame: number,
): void {
  ctx.save()
  for (const [key, color] of flowerMap) {
    const [xStr, yStr] = key.split(':')
    const tileX = parseInt(xStr)
    const tileY = parseInt(yStr)

    const screenX = tileX * tileSize - Math.floor(cameraX)
    const screenY = tileY * tileSize

    if (screenX < -tileSize || screenX > 800 || screenY < -tileSize || screenY > 600) continue

    // Tiny flower: 2px colored dot on top of the grass block, with gentle sway
    const sway = Math.sin(frame * 0.08 + tileX * 1.3) * 1
    ctx.fillStyle = color
    ctx.fillRect(screenX + 5 + Math.round(sway), screenY - 2, 2, 2)

    // Stem (1px green line)
    ctx.fillStyle = '#22c55e'
    ctx.fillRect(screenX + 6 + Math.round(sway), screenY - 1, 1, 1)
  }
  ctx.restore()
}

/**
 * Render fire effects (flickering orange/red on burning blocks).
 * Call this if you have access to ecology.fireSpread.
 */
export function renderFire(
  ctx: CanvasRenderingContext2D,
  fireSpread: Array<{ x: number; y: number; life: number }>,
  cameraX: number,
  tileSize: number,
  frame: number,
): void {
  ctx.save()
  for (const fire of fireSpread) {
    const screenX = fire.x * tileSize - Math.floor(cameraX)
    const screenY = fire.y * tileSize

    if (screenX < -tileSize || screenX > 800 || screenY < -tileSize || screenY > 600) continue

    // Flickering fire overlay
    const flicker = Math.sin(frame * 0.5 + fire.x * 2.3) * 0.3 + 0.5
    ctx.globalAlpha = flicker * (fire.life / 20)

    // Orange-red gradient effect
    ctx.fillStyle = '#f97316'
    ctx.fillRect(screenX + 2, screenY + 2, tileSize - 4, tileSize - 4)

    // Yellow-white core
    ctx.fillStyle = '#fbbf24'
    ctx.fillRect(screenX + 4, screenY + 4, tileSize - 8, tileSize - 8)

    // Spark particles above
    if (Math.sin(frame * 0.8 + fire.x * 1.7) > 0.7) {
      ctx.fillStyle = '#ff6b6b'
      const sparkY = screenY - Math.floor(Math.abs(Math.sin(frame * 0.3 + fire.x)) * 5)
      ctx.fillRect(screenX + Math.floor(tileSize / 2), sparkY, 1, 1)
    }
  }
  ctx.globalAlpha = 1
  ctx.restore()
}
