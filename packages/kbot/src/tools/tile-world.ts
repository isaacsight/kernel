// kbot Tile World Engine — Minecraft-inspired 2D tile world for the stream
//
// Procedurally generated, explorable, buildable, persistent tile world.
// Replaces flat painted backgrounds with an actual tile grid.
// Renders 16x16px blocks with 3D-style shading, animated water/lava, ore flecks.

import { registerTool } from './index.js'
import { homedir } from 'node:os'
import { join } from 'node:path'
import { existsSync, readFileSync, writeFileSync, mkdirSync } from 'node:fs'
import type { CanvasRenderingContext2D } from 'canvas'

// ─── Constants ────────────────────────────────────────────────

export const TILE_SIZE = 16   // pixels per tile
export const CHUNK_WIDTH = 36  // tiles visible horizontally (576px in the 580px robot panel)
export const CHUNK_HEIGHT = 26 // tiles visible vertically
export const WORLD_HEIGHT = 40 // total height including underground (26 visible + 14 below)

// ─── Types ────────────────────────────────────────────────────

export type BlockType =
  | 'air' | 'grass' | 'dirt' | 'stone' | 'sand' | 'water'
  | 'wood' | 'leaves' | 'ore_iron' | 'ore_gold' | 'ore_diamond'
  | 'lava' | 'snow' | 'ice' | 'brick' | 'glass'

export interface Chunk {
  x: number               // chunk X coordinate (world position index)
  tiles: BlockType[][]     // [y][x] grid, WORLD_HEIGHT rows x CHUNK_WIDTH cols
  generated: boolean
  modified: boolean        // has chat changed any tiles?
}

export interface TileWorld {
  chunks: Map<number, Chunk>   // chunk X index -> chunk data
  cameraX: number              // camera position in world pixels
  surfaceLevel: number         // Y index where surface starts (default: 12)
  seed: number                 // for procedural generation
  timeOfDay: 'day' | 'night' | 'sunset' | 'dawn'
  weather: string
}

// ─── Block Colors (pixel art palette) ─────────────────────────

interface BlockColor {
  top: string
  face: string
  dark: string
}

const BLOCK_COLORS: Record<BlockType, BlockColor> = {
  air:          { top: 'transparent', face: 'transparent', dark: 'transparent' },
  grass:        { top: '#4ade80', face: '#65a30d', dark: '#3f6212' },
  dirt:         { top: '#92400e', face: '#78350f', dark: '#451a03' },
  stone:        { top: '#9ca3af', face: '#6b7280', dark: '#4b5563' },
  sand:         { top: '#fde68a', face: '#fbbf24', dark: '#d97706' },
  water:        { top: '#38bdf8', face: '#0284c7', dark: '#0369a1' },
  wood:         { top: '#a16207', face: '#854d0e', dark: '#713f12' },
  leaves:       { top: '#22c55e', face: '#16a34a', dark: '#15803d' },
  ore_iron:     { top: '#9ca3af', face: '#78716c', dark: '#57534e' },
  ore_gold:     { top: '#9ca3af', face: '#6b7280', dark: '#4b5563' },
  ore_diamond:  { top: '#9ca3af', face: '#6b7280', dark: '#4b5563' },
  lava:         { top: '#f97316', face: '#ea580c', dark: '#c2410c' },
  snow:         { top: '#f0f9ff', face: '#e0f2fe', dark: '#bae6fd' },
  ice:          { top: '#a5f3fc', face: '#67e8f9', dark: '#22d3ee' },
  brick:        { top: '#dc2626', face: '#b91c1c', dark: '#991b1b' },
  glass:        { top: '#dbeafe', face: '#bfdbfe', dark: '#93c5fd' },
}

// Ore fleck colors
const ORE_FLECK_COLORS: Record<string, string> = {
  ore_iron:    '#a0826d',
  ore_gold:    '#fbbf24',
  ore_diamond: '#22d3ee',
}

// Valid placeable block types (water/lava only by natural generation)
const PLACEABLE_BLOCKS = new Set<BlockType>([
  'grass', 'dirt', 'stone', 'sand', 'wood', 'leaves',
  'snow', 'ice', 'brick', 'glass',
])

// ─── Seeded PRNG ──────────────────────────────────────────────

/** Simple seeded pseudo-random number generator (mulberry32) */
function seededRandom(seed: number): () => number {
  let s = seed | 0
  return () => {
    s = (s + 0x6D2B79F5) | 0
    let t = Math.imul(s ^ (s >>> 15), 1 | s)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

// ─── Terrain Generation ───────────────────────────────────────

// Water level: water fills enclosed basins up to this Y (absolute).
// Set during chunk generation relative to surfaceLevel.
const WATER_LEVEL_OFFSET = 2  // water surface sits 2 rows below surfaceLevel

/** Hash-based deterministic value for tile variation (returns 0-2) */
function tileHash(x: number, y: number, seed: number): number {
  let h = (x * 374761393 + y * 668265263 + seed * 1274126177) | 0
  h = (h ^ (h >> 13)) * 1103515245
  h = h ^ (h >> 16)
  return ((h >>> 0) % 3)
}

/**
 * 1D value noise: hash-based pseudo-random values at integer points,
 * smoothly interpolated between them using cosine interpolation.
 */
function valueNoise1D(x: number, seed: number): number {
  const xi = Math.floor(x)
  const frac = x - xi

  // Hash integer positions to pseudo-random values in [0, 1]
  const hash = (n: number): number => {
    let h = ((n + seed * 7919) * 374761393) | 0
    h = (h ^ (h >> 13)) * 1103515245
    h = h ^ (h >> 16)
    return ((h >>> 0) % 10000) / 10000
  }

  const a = hash(xi)
  const b = hash(xi + 1)

  // Cosine interpolation for smooth curves
  const t = (1 - Math.cos(frac * Math.PI)) * 0.5
  return a + (b - a) * t
}

/**
 * Multi-octave noise using layered value noise.
 * 6 octaves, each half the amplitude and double the frequency.
 * Returns a value in [0, 1].
 */
function multiOctaveNoise(x: number, seed: number, octaves: number = 6): number {
  let value = 0
  let amplitude = 1
  let frequency = 0.02   // base frequency — gentle hills
  let maxValue = 0

  for (let i = 0; i < octaves; i++) {
    value += amplitude * valueNoise1D(x * frequency, seed + i * 31337)
    maxValue += amplitude
    amplitude *= 0.5
    frequency *= 2
  }

  return value / maxValue  // normalized to [0, 1]
}

/** Compute terrain surface height for a given world X coordinate.
 *  Uses multi-octave noise with power redistribution for flatter lowlands
 *  and sharper peaks.  Surface level sits at 40% of WORLD_HEIGHT.
 */
function terrainHeight(worldX: number, seed: number, _surfaceLevel: number): number {
  const baseLevel = Math.floor(WORLD_HEIGHT * 0.40)  // surface at 40%

  // Get noise in [0, 1], then center it to [-0.5, 0.5]
  const raw = multiOctaveNoise(worldX, seed, 6) - 0.5

  // Power redistribution: preserve sign, flatten near zero, amplify extremes
  const sign = raw >= 0 ? 1 : -1
  const shaped = sign * Math.pow(Math.abs(raw) * 2, 1.8) / 2

  // Scale to tile offset: gentle undulation of +/- 8 tiles from base
  const maxSwing = 8
  const offset = Math.round(shaped * maxSwing * 2)

  return Math.max(2, Math.min(WORLD_HEIGHT - 3, baseLevel + offset))
}

/** Check if a position should be a cave.  Uses cellular-automata-style
 *  density from layered noise.  Caves form coherent tunnels instead of
 *  random holes.
 */
function isCave(worldX: number, y: number, seed: number): boolean {
  // Two noise fields at different scales
  const n1 = Math.sin(worldX * 0.06 + y * 0.09 + seed * 1.3) *
             Math.cos(worldX * 0.04 + y * 0.07 + seed * 0.7)
  const n2 = Math.sin(worldX * 0.12 + y * 0.05 + seed * 2.1) *
             Math.cos(worldX * 0.09 + y * 0.13 + seed * 3.3)

  // Combine: the product of two sine waves creates natural-looking voids
  const density = (n1 + n2) / 2

  // Threshold: only open caves where both noise fields agree (narrow band)
  return density > 0.28 && density < 0.5
}

/** Generate a chunk at the given chunk X index */
export function generateChunk(world: TileWorld, chunkX: number): Chunk {
  const tiles: BlockType[][] = []

  // Initialize all tiles to air
  for (let y = 0; y < WORLD_HEIGHT; y++) {
    tiles.push(new Array<BlockType>(CHUNK_WIDTH).fill('air'))
  }

  const rng = seededRandom(world.seed * 7919 + chunkX * 104729)

  // Water level: absolute Y coordinate for water surface
  const waterLevel = Math.floor(WORLD_HEIGHT * 0.40) + WATER_LEVEL_OFFSET

  // Pre-compute surface heights for all columns (needed for basin detection + slope)
  const surfaces: number[] = []
  for (let lx = 0; lx < CHUNK_WIDTH; lx++) {
    const worldX = chunkX * CHUNK_WIDTH + lx
    const surface = terrainHeight(worldX, world.seed, world.surfaceLevel)
    surfaces[lx] = Math.max(2, Math.min(WORLD_HEIGHT - 3, surface))
  }

  // Compute neighbor surfaces outside chunk bounds for edge-basin detection.
  // Look up to 8 columns beyond each edge to find the nearest bank.
  const BANK_SEARCH = 8
  let leftNeighborSurface = WORLD_HEIGHT  // default: no bank found (deep)
  for (let d = 1; d <= BANK_SEARCH; d++) {
    const s = Math.max(2, Math.min(WORLD_HEIGHT - 3,
      terrainHeight(chunkX * CHUNK_WIDTH - d, world.seed, world.surfaceLevel)))
    if (s <= waterLevel) { leftNeighborSurface = s; break }
  }
  let rightNeighborSurface = WORLD_HEIGHT
  for (let d = 0; d < BANK_SEARCH; d++) {
    const s = Math.max(2, Math.min(WORLD_HEIGHT - 3,
      terrainHeight((chunkX + 1) * CHUNK_WIDTH + d, world.seed, world.surfaceLevel)))
    if (s <= waterLevel) { rightNeighborSurface = s; break }
  }

  // ── Pass 1: Fill terrain (surface + underground) ──

  for (let lx = 0; lx < CHUNK_WIDTH; lx++) {
    const worldX = chunkX * CHUNK_WIDTH + lx
    const clampedSurface = surfaces[lx]

    // Biome tinting: use a slow noise to pick between grass/sand/snow at surface
    const biomeNoise = multiOctaveNoise(worldX, world.seed + 50000, 3)
    // Default to grass; sand near water level, snow at high elevations
    let surfaceBlock: BlockType = 'grass'
    if (clampedSurface >= waterLevel - 1 && clampedSurface <= waterLevel + 1) {
      surfaceBlock = 'sand'  // beaches near water level
    } else if (clampedSurface <= Math.floor(WORLD_HEIGHT * 0.15)) {
      surfaceBlock = biomeNoise > 0.5 ? 'snow' : 'grass'
    }

    // Fill from surface down
    for (let y = clampedSurface; y < WORLD_HEIGHT; y++) {
      const depth = y - clampedSurface

      if (depth === 0) {
        tiles[y][lx] = surfaceBlock
      } else if (depth <= 3 + Math.floor(rng() * 2)) {
        // Dirt layer (3-4 blocks); sand under sand surfaces
        tiles[y][lx] = surfaceBlock === 'sand' ? 'sand' : 'dirt'
      } else {
        // Stone layer — check for caves
        if (isCave(worldX, y, world.seed)) {
          if (y >= WORLD_HEIGHT - 4 && rng() < 0.3) {
            tiles[y][lx] = 'lava'
          } else {
            tiles[y][lx] = 'air'
          }
        } else {
          // Place stone with possible ores
          const oreRoll = rng()
          if (oreRoll < 0.005 && depth > 15) {
            tiles[y][lx] = 'ore_diamond'
          } else if (oreRoll < 0.025 && depth > 8) {
            tiles[y][lx] = 'ore_gold'
          } else if (oreRoll < 0.075) {
            tiles[y][lx] = 'ore_iron'
          } else {
            tiles[y][lx] = 'stone'
          }
        }
      }
    }
  }

  // ── Pass 2: Fill ENCLOSED basins with water (not every air gap) ──
  // A basin is a contiguous run of columns where the surface dips below
  // waterLevel AND is enclosed on both sides by terrain at or above waterLevel.
  // We scan left-to-right, finding basins, then fill only those.

  {
    let lx = 0
    let waterColumns = 0
    const maxWaterColumns = Math.floor(CHUNK_WIDTH * 0.30)  // max 30% water

    while (lx < CHUNK_WIDTH && waterColumns < maxWaterColumns) {
      // Skip columns at or above water level
      if (surfaces[lx] <= waterLevel) {
        lx++
        continue
      }

      // Found a column below water level — scan for basin extent
      const basinStart = lx
      while (lx < CHUNK_WIDTH && surfaces[lx] > waterLevel) {
        lx++
      }
      const basinEnd = lx  // exclusive

      // Check enclosure: left bank and right bank must be at or above waterLevel
      const leftBank = basinStart > 0 ? surfaces[basinStart - 1] : leftNeighborSurface
      const rightBank = basinEnd < CHUNK_WIDTH ? surfaces[basinEnd] : rightNeighborSurface

      const leftEnclosed = leftBank <= waterLevel
      const rightEnclosed = rightBank <= waterLevel

      if (leftEnclosed && rightEnclosed) {
        // Enclosed basin — fill air between waterLevel and surface with water.
        // In our coordinate system, higher Y = deeper.  The surface Y is
        // greater than waterLevel for basin columns.  Fill from waterLevel
        // downward to the surface.
        for (let bx = basinStart; bx < basinEnd && waterColumns < maxWaterColumns; bx++) {
          for (let y = waterLevel; y < surfaces[bx]; y++) {
            if (tiles[y][bx] === 'air') {
              tiles[y][bx] = 'water'
            }
          }
          // Convert the surface block and adjacent blocks to sand (beach effect)
          if (tiles[surfaces[bx]][bx] === 'grass' || tiles[surfaces[bx]][bx] === 'dirt') {
            tiles[surfaces[bx]][bx] = 'sand'
          }
          waterColumns++
        }
      }
    }
  }

  // ── Pass 3: Trees — only on flat areas (slope < 2 between adjacent columns) ──

  // Track last tree position to avoid clustering
  let lastTreeX = -5

  for (let lx = 2; lx < CHUNK_WIDTH - 2; lx++) {
    if (lx - lastTreeX < 4) continue  // minimum spacing between trees

    const clampedSurface = surfaces[lx]

    // Slope check: compare with left and right neighbor heights
    const slopeLeft = Math.abs(surfaces[lx] - surfaces[lx - 1])
    const slopeRight = Math.abs(surfaces[lx] - surfaces[lx + 1])
    if (slopeLeft >= 2 || slopeRight >= 2) continue  // too steep

    // Must be on grass (not sand, water, snow)
    if (tiles[clampedSurface]?.[lx] !== 'grass') continue

    // 12% base chance
    if (rng() > 0.12) continue

    if (clampedSurface < 6) continue  // need headroom

    lastTreeX = lx

    const trunkHeight = 3 + Math.floor(rng() * 3) // 3-5 blocks tall
    // Place trunk
    for (let th = 1; th <= trunkHeight; th++) {
      const ty = clampedSurface - th
      if (ty >= 0) tiles[ty][lx] = 'wood'
    }
    // Place leaves crown (3x3 centered on trunk top, plus 1 block above)
    const crownY = clampedSurface - trunkHeight
    for (let dy = -1; dy <= 1; dy++) {
      for (let dx = -1; dx <= 1; dx++) {
        const ly = crownY + dy
        const llx = lx + dx
        if (ly >= 0 && ly < WORLD_HEIGHT && llx >= 0 && llx < CHUNK_WIDTH) {
          if (tiles[ly][llx] === 'air') tiles[ly][llx] = 'leaves'
        }
      }
    }
    // Extra leaf on top
    if (crownY - 1 >= 0 && tiles[crownY - 1][lx] === 'air') {
      tiles[crownY - 1][lx] = 'leaves'
    }
  }

  return {
    x: chunkX,
    tiles,
    generated: true,
    modified: false,
  }
}

// ─── World Init / Load / Save ─────────────────────────────────

const KBOT_DIR = join(homedir(), '.kbot')
const WORLD_FILE = join(KBOT_DIR, 'stream-world.json')

/** Initialize a fresh tile world */
export function initTileWorld(seed?: number): TileWorld {
  const world: TileWorld = {
    chunks: new Map(),
    cameraX: 0,
    surfaceLevel: Math.floor(WORLD_HEIGHT * 0.40),  // 40% of world height
    seed: seed ?? Math.floor(Math.random() * 999999),
    timeOfDay: 'day',
    weather: 'clear',
  }

  // Pre-generate the starting chunk (chunk 0)
  const startChunk = generateChunk(world, 0)
  world.chunks.set(0, startChunk)

  // Also generate chunk -1 so the camera can look left
  const leftChunk = generateChunk(world, -1)
  world.chunks.set(-1, leftChunk)

  return world
}

/** Save world to disk (only modified chunks to keep file small) */
export function saveWorld(world: TileWorld): void {
  try {
    if (!existsSync(KBOT_DIR)) {
      mkdirSync(KBOT_DIR, { recursive: true })
    }

    const data = {
      seed: world.seed,
      cameraX: world.cameraX,
      surfaceLevel: world.surfaceLevel,
      timeOfDay: world.timeOfDay,
      weather: world.weather,
      chunks: Array.from(world.chunks.entries())
        .filter(([_, c]) => c.modified)
        .map(([x, c]) => ({ x, tiles: c.tiles })),
    }

    writeFileSync(WORLD_FILE, JSON.stringify(data))
  } catch {
    // Silently fail — don't crash the stream
  }
}

/** Load world from disk, returns null if no save exists */
export function loadWorld(): TileWorld | null {
  try {
    if (!existsSync(WORLD_FILE)) return null

    const raw = JSON.parse(readFileSync(WORLD_FILE, 'utf-8'))
    const world: TileWorld = {
      chunks: new Map(),
      cameraX: raw.cameraX ?? 0,
      surfaceLevel: raw.surfaceLevel ?? 12,
      seed: raw.seed ?? 42,
      timeOfDay: raw.timeOfDay ?? 'day',
      weather: raw.weather ?? 'clear',
    }

    // Restore modified chunks
    if (Array.isArray(raw.chunks)) {
      for (const saved of raw.chunks) {
        world.chunks.set(saved.x, {
          x: saved.x,
          tiles: saved.tiles,
          generated: true,
          modified: true,
        })
      }
    }

    return world
  } catch {
    return null
  }
}

// ─── Camera / Scrolling ───────────────────────────────────────

/** Update camera to follow the robot with smooth lerp */
export function updateCamera(world: TileWorld, robotWorldX: number, panelWidth: number = 576): void {
  const targetX = robotWorldX - panelWidth / 2
  world.cameraX += (targetX - world.cameraX) * 0.1
}

// ─── Coordinate Conversion ────────────────────────────────────

/** Convert world pixel X to tile X (absolute) */
export function worldXToTile(worldPixelX: number): number {
  return Math.floor(worldPixelX / TILE_SIZE)
}

/** Convert tile X to world pixel X */
export function tileToWorldX(tileX: number): number {
  return tileX * TILE_SIZE
}

/** Get which chunk a tile X belongs to */
function tileXToChunkIndex(tileX: number): number {
  return Math.floor(tileX / CHUNK_WIDTH)
}

/** Get local X within a chunk */
function tileXToLocalX(tileX: number): number {
  return ((tileX % CHUNK_WIDTH) + CHUNK_WIDTH) % CHUNK_WIDTH
}

// ─── Tile Access Helpers ──────────────────────────────────────

/** Get a tile at absolute tile coordinates, generating chunk if needed */
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

/** Set a tile at absolute tile coordinates */
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

// ─── Hex color utilities ──────────────────────────────────────

function hexToRgb(hex: string): [number, number, number] {
  const h = hex.startsWith('#') ? hex.slice(1) : hex
  return [
    parseInt(h.slice(0, 2), 16),
    parseInt(h.slice(2, 4), 16),
    parseInt(h.slice(4, 6), 16),
  ]
}

function adjustBrightness(hex: string, factor: number): string {
  const [r, g, b] = hexToRgb(hex)
  const clamp = (v: number) => Math.max(0, Math.min(255, Math.round(v * factor)))
  return `rgb(${clamp(r)},${clamp(g)},${clamp(b)})`
}

// ─── Autotile Types ──────────────────────────────────────────

/** Block types that receive autotiling (soft edges based on neighbors) */
const AUTOTILE_BLOCKS = new Set<BlockType>(['grass', 'sand', 'snow', 'water'])

// ─── Rendering ────────────────────────────────────────────────

/**
 * Compute 4-bit autotile mask for a block.
 * Bits: North=1, West=2, East=4, South=8.
 * A bit is set if the neighbor in that direction is the SAME block type.
 */
function autotileMask(world: TileWorld, tileX: number, tileY: number, blockType: BlockType): number {
  let mask = 0
  if (getTile(world, tileX, tileY - 1) === blockType) mask |= 1   // North
  if (getTile(world, tileX - 1, tileY) === blockType) mask |= 2   // West
  if (getTile(world, tileX + 1, tileY) === blockType) mask |= 4   // East
  if (getTile(world, tileX, tileY + 1) === blockType) mask |= 8   // South
  return mask
}

/**
 * Draw tile variation details.  Uses tileHash to pick 1 of 3 visual variants.
 * Each variant adds minor pixel-level details (cracks, grass blades, grain).
 */
function drawTileVariation(
  ctx: CanvasRenderingContext2D,
  screenX: number,
  screenY: number,
  block: BlockType,
  seed: number,
  tileWorldX: number,
  tileWorldY: number,
): void {
  const S = TILE_SIZE
  const variant = tileHash(tileWorldX, tileWorldY, seed)
  const colors = BLOCK_COLORS[block]

  switch (block) {
    case 'grass': {
      // Variant grass blade positions (tiny 1px darker marks)
      ctx.fillStyle = colors.dark
      if (variant === 0) {
        ctx.fillRect(screenX + 3, screenY + 2, 1, 2)
        ctx.fillRect(screenX + 10, screenY + 1, 1, 3)
      } else if (variant === 1) {
        ctx.fillRect(screenX + 6, screenY + 2, 1, 2)
        ctx.fillRect(screenX + 13, screenY + 3, 1, 2)
        ctx.fillRect(screenX + 1, screenY + 1, 1, 2)
      } else {
        ctx.fillRect(screenX + 4, screenY + 3, 1, 2)
        ctx.fillRect(screenX + 11, screenY + 2, 1, 2)
      }
      break
    }
    case 'dirt': {
      // Small rock/crack details
      ctx.fillStyle = adjustBrightness(colors.face, variant === 0 ? 0.8 : variant === 1 ? 1.15 : 0.9)
      if (variant === 0) {
        ctx.fillRect(screenX + 4, screenY + 5, 2, 1)
        ctx.fillRect(screenX + 10, screenY + 10, 2, 1)
      } else if (variant === 1) {
        ctx.fillRect(screenX + 7, screenY + 3, 1, 2)
        ctx.fillRect(screenX + 2, screenY + 9, 2, 2)
      } else {
        ctx.fillRect(screenX + 5, screenY + 7, 3, 1)
        ctx.fillRect(screenX + 12, screenY + 4, 1, 1)
      }
      break
    }
    case 'stone': {
      // Crack lines and shade variation
      const shade = variant === 0 ? 0.85 : variant === 1 ? 0.92 : 1.08
      ctx.fillStyle = adjustBrightness(colors.face, shade)
      if (variant === 0) {
        ctx.fillRect(screenX + 2, screenY + 6, 4, 1)
        ctx.fillRect(screenX + 5, screenY + 6, 1, 3)
      } else if (variant === 1) {
        ctx.fillRect(screenX + 8, screenY + 4, 1, 5)
        ctx.fillRect(screenX + 3, screenY + 11, 3, 1)
      } else {
        ctx.fillRect(screenX + 6, screenY + 2, 3, 1)
        ctx.fillRect(screenX + 10, screenY + 8, 2, 2)
      }
      break
    }
    case 'sand': {
      // Subtle grain dots
      ctx.fillStyle = adjustBrightness(colors.face, variant === 0 ? 1.1 : 0.9)
      const offsets = variant === 0
        ? [[3,4],[9,7],[13,11]]
        : variant === 1
          ? [[5,3],[7,10],[12,5]]
          : [[2,8],[8,3],[11,12]]
      for (const [ox, oy] of offsets) {
        ctx.fillRect(screenX + ox, screenY + oy, 1, 1)
      }
      break
    }
    case 'snow': {
      // Sparkle dots
      ctx.fillStyle = '#ffffff'
      ctx.globalAlpha = 0.4
      const sparkles = variant === 0
        ? [[4,3],[11,8]]
        : variant === 1
          ? [[7,5],[2,11],[13,3]]
          : [[5,9],[10,4]]
      for (const [ox, oy] of sparkles) {
        ctx.fillRect(screenX + ox, screenY + oy, 1, 1)
      }
      ctx.globalAlpha = 1
      break
    }
    default:
      break
  }
}

/**
 * Draw autotile softened edges.  For each edge where the neighbor is NOT
 * the same type, we draw a rounded/softened transition (2px inset with the
 * face color of whatever is adjacent — typically air → sky gradient fakes).
 * This makes grass-to-air edges look curved rather than blocky.
 */
function drawAutotileEdges(
  ctx: CanvasRenderingContext2D,
  screenX: number,
  screenY: number,
  mask: number,
  colors: BlockColor,
): void {
  const S = TILE_SIZE
  const INSET = 2  // how many pixels to soften

  // For missing neighbors, draw a subtle rounded corner effect
  // by drawing the dark shade in the corner pixels

  ctx.fillStyle = colors.dark

  // If no north neighbor → soften top-left and top-right corners
  if (!(mask & 1)) {
    ctx.fillRect(screenX, screenY, INSET, 1)
    ctx.fillRect(screenX + S - INSET, screenY, INSET, 1)
    ctx.fillRect(screenX, screenY + 1, 1, 1)
    ctx.fillRect(screenX + S - 1, screenY + 1, 1, 1)
  }

  // If no south neighbor → soften bottom corners
  if (!(mask & 8)) {
    ctx.fillRect(screenX, screenY + S - 1, INSET, 1)
    ctx.fillRect(screenX + S - INSET, screenY + S - 1, INSET, 1)
    ctx.fillRect(screenX, screenY + S - 2, 1, 1)
    ctx.fillRect(screenX + S - 1, screenY + S - 2, 1, 1)
  }

  // If no west neighbor → soften left edge
  if (!(mask & 2)) {
    ctx.fillRect(screenX, screenY, 1, INSET)
    ctx.fillRect(screenX, screenY + S - INSET, 1, INSET)
    ctx.fillRect(screenX + 1, screenY, 1, 1)
    ctx.fillRect(screenX + 1, screenY + S - 1, 1, 1)
  }

  // If no east neighbor → soften right edge
  if (!(mask & 4)) {
    ctx.fillRect(screenX + S - 1, screenY, 1, INSET)
    ctx.fillRect(screenX + S - 1, screenY + S - INSET, 1, INSET)
    ctx.fillRect(screenX + S - 2, screenY, 1, 1)
    ctx.fillRect(screenX + S - 2, screenY + S - 1, 1, 1)
  }
}

/** Draw a single tile block with 3D-style shading, autotiling, and variation */
function drawBlock(
  ctx: CanvasRenderingContext2D,
  screenX: number,
  screenY: number,
  block: BlockType,
  frame: number,
  tileWorldX: number,
  tileWorldY: number,
  world: TileWorld,
): void {
  if (block === 'air') return

  const colors = BLOCK_COLORS[block]
  const S = TILE_SIZE

  // Special: water at 60% opacity with autotile
  if (block === 'water') {
    ctx.save()
    ctx.globalAlpha = 0.6

    const waveOffset = Math.sin(frame * 0.15 + tileWorldX * 0.5) * 2

    // Main body
    ctx.fillStyle = colors.face
    ctx.fillRect(screenX, screenY + 1, S, S - 1)

    // Top row with wave
    ctx.fillStyle = colors.top
    ctx.fillRect(screenX + Math.round(waveOffset), screenY, S, 1)

    // Dark edge (right + bottom)
    ctx.fillStyle = colors.dark
    ctx.fillRect(screenX + S - 1, screenY, 1, S)
    ctx.fillRect(screenX, screenY + S - 1, S, 1)

    // Autotile softened edges
    const mask = autotileMask(world, tileWorldX, tileWorldY, block)
    drawAutotileEdges(ctx, screenX, screenY, mask, colors)

    // Tile variation: subtle wave lines
    drawTileVariation(ctx, screenX, screenY, block, world.seed, tileWorldX, tileWorldY)

    ctx.restore()
    return
  }

  // Special: glass at 30% opacity
  if (block === 'glass') {
    ctx.save()
    ctx.globalAlpha = 0.3

    ctx.fillStyle = colors.face
    ctx.fillRect(screenX, screenY, S, S)
    ctx.fillStyle = colors.top
    ctx.fillRect(screenX, screenY, S, 1)
    ctx.fillStyle = colors.dark
    ctx.fillRect(screenX + S - 1, screenY, 1, S)
    ctx.fillRect(screenX, screenY + S - 1, S, 1)

    ctx.restore()
    return
  }

  // Special: lava with brightness pulse
  if (block === 'lava') {
    const pulse = 0.85 + Math.sin(frame * 0.3 + tileWorldX * 0.2) * 0.15

    ctx.fillStyle = adjustBrightness(colors.face, pulse)
    ctx.fillRect(screenX, screenY, S, S)

    ctx.fillStyle = adjustBrightness(colors.top, pulse * 1.1)
    ctx.fillRect(screenX, screenY, S, 1)

    ctx.fillStyle = adjustBrightness(colors.dark, pulse * 0.9)
    ctx.fillRect(screenX + S - 1, screenY, 1, S)
    ctx.fillRect(screenX, screenY + S - 1, S, 1)

    // Occasional bubble
    if (Math.sin(frame * 0.7 + tileWorldX * 3.1) > 0.9) {
      const bubbleY = screenY - 1 - Math.floor(Math.abs(Math.sin(frame * 0.5 + tileWorldX)) * 3)
      ctx.fillStyle = '#ff9f43'
      ctx.fillRect(screenX + Math.floor(S / 2), bubbleY, 1, 1)
    }

    return
  }

  // Special: leaves with slight sway
  if (block === 'leaves') {
    const sway = Math.sin(frame * 0.1 + tileWorldX * 0.8) * 0.5
    const sx = screenX + Math.round(sway)

    ctx.fillStyle = colors.face
    ctx.fillRect(sx, screenY, S, S)
    ctx.fillStyle = colors.top
    ctx.fillRect(sx, screenY, S, 1)
    ctx.fillStyle = colors.dark
    ctx.fillRect(sx + S - 1, screenY, 1, S)
    ctx.fillRect(sx, screenY + S - 1, S, 1)
    return
  }

  // ── Default block rendering with autotile + variation ──

  // Main face
  ctx.fillStyle = colors.face
  ctx.fillRect(screenX, screenY, S, S)

  // Top highlight row
  ctx.fillStyle = colors.top
  ctx.fillRect(screenX, screenY, S, 1)

  // Right shadow edge
  ctx.fillStyle = colors.dark
  ctx.fillRect(screenX + S - 1, screenY, 1, S)

  // Bottom shadow edge
  ctx.fillRect(screenX, screenY + S - 1, S, 1)

  // Autotile: soften edges for grass, sand, snow
  if (AUTOTILE_BLOCKS.has(block)) {
    const mask = autotileMask(world, tileWorldX, tileWorldY, block)
    drawAutotileEdges(ctx, screenX, screenY, mask, colors)
  }

  // Tile variation: minor pixel details per block type
  drawTileVariation(ctx, screenX, screenY, block, world.seed, tileWorldX, tileWorldY)

  // Ore fleck rendering
  if (block === 'ore_iron' || block === 'ore_gold' || block === 'ore_diamond') {
    const fleckColor = ORE_FLECK_COLORS[block]
    ctx.fillStyle = fleckColor

    const fleckSeed = tileWorldX * 31 + tileWorldY * 17
    const numFlecks = 2 + (fleckSeed % 2)
    for (let i = 0; i < numFlecks; i++) {
      const fx = 3 + ((fleckSeed * (i + 1) * 7) % (S - 6))
      const fy = 3 + ((fleckSeed * (i + 1) * 13) % (S - 6))
      ctx.fillRect(screenX + fx, screenY + fy, 2, 2)
    }
  }
}

/** Draw the sky gradient behind the tile world */
function drawSky(
  ctx: CanvasRenderingContext2D,
  panelX: number,
  panelY: number,
  panelWidth: number,
  panelHeight: number,
  timeOfDay: string,
): void {
  const grad = ctx.createLinearGradient(panelX, panelY, panelX, panelY + panelHeight)

  switch (timeOfDay) {
    case 'night':
      grad.addColorStop(0, '#0a0e1a')
      grad.addColorStop(1, '#1a1f3a')
      break
    case 'sunset':
      grad.addColorStop(0, '#1a1040')
      grad.addColorStop(0.4, '#4a2060')
      grad.addColorStop(0.7, '#c05030')
      grad.addColorStop(1, '#e08040')
      break
    case 'dawn':
      grad.addColorStop(0, '#1a1a3a')
      grad.addColorStop(0.5, '#4a3060')
      grad.addColorStop(0.8, '#c07050')
      grad.addColorStop(1, '#e0a060')
      break
    default: // day
      grad.addColorStop(0, '#1a3a5a')
      grad.addColorStop(0.5, '#2a5a8a')
      grad.addColorStop(1, '#4a8aba')
      break
  }

  ctx.fillStyle = grad
  ctx.fillRect(panelX, panelY, panelWidth, panelHeight)
}

/** Render the visible tile world */
export function renderTileWorld(
  ctx: CanvasRenderingContext2D,
  world: TileWorld,
  panelX: number,
  panelY: number,
  panelWidth: number,
  panelHeight: number,
  robotWorldX: number,
  frame: number,
): void {
  // Draw sky background first
  drawSky(ctx, panelX, panelY, panelWidth, panelHeight, world.timeOfDay)

  // Calculate visible tile range from camera position
  const startTileX = Math.floor(world.cameraX / TILE_SIZE)
  const tilesVisibleX = Math.ceil(panelWidth / TILE_SIZE) + 1
  const tilesVisibleY = Math.ceil(panelHeight / TILE_SIZE) + 1

  // The Y offset determines which row of the world appears at the top of the panel.
  // We want the surface (around surfaceLevel) to appear roughly in the upper third.
  const viewStartY = Math.max(0, world.surfaceLevel - Math.floor(tilesVisibleY * 0.35))

  // Sub-tile pixel offset for smooth scrolling
  const pixelOffsetX = Math.floor(world.cameraX) % TILE_SIZE

  // Ensure chunks exist for all visible columns
  for (let dx = -1; dx <= Math.ceil(tilesVisibleX / CHUNK_WIDTH) + 1; dx++) {
    const chunkIdx = tileXToChunkIndex(startTileX) + dx
    if (!world.chunks.has(chunkIdx)) {
      world.chunks.set(chunkIdx, generateChunk(world, chunkIdx))
    }
  }

  // Render visible tiles
  for (let screenTileY = 0; screenTileY < tilesVisibleY; screenTileY++) {
    const tileY = viewStartY + screenTileY
    if (tileY < 0 || tileY >= WORLD_HEIGHT) continue

    for (let screenTileX = 0; screenTileX <= tilesVisibleX; screenTileX++) {
      const tileX = startTileX + screenTileX

      const block = getTile(world, tileX, tileY)
      if (block === 'air') continue

      const screenX = panelX + screenTileX * TILE_SIZE - pixelOffsetX
      const screenY = panelY + screenTileY * TILE_SIZE

      // Clip to panel bounds
      if (screenX + TILE_SIZE < panelX || screenX > panelX + panelWidth) continue
      if (screenY + TILE_SIZE < panelY || screenY > panelY + panelHeight) continue

      drawBlock(ctx, screenX, screenY, block, frame, tileX, tileY, world)
    }
  }

  // Draw some stars in the sky if night
  if (world.timeOfDay === 'night') {
    ctx.fillStyle = '#ffffff'
    const starSeed = world.seed * 13
    for (let i = 0; i < 30; i++) {
      const sx = panelX + ((starSeed * (i + 1) * 37) % panelWidth)
      const sy = panelY + ((starSeed * (i + 1) * 53) % Math.floor(panelHeight * 0.3))
      const twinkle = Math.sin(frame * 0.2 + i) > 0.3 ? 1 : 0.3
      ctx.globalAlpha = twinkle
      ctx.fillRect(sx, sy, 1, 1)
    }
    ctx.globalAlpha = 1
  }
}

// ─── Pre-built Structures ─────────────────────────────────────

/** Build a house (5 wide, 4 tall brick box with door) */
function buildHouse(world: TileWorld, baseTileX: number, baseTileY: number): string {
  // Walls
  for (let dy = 0; dy < 4; dy++) {
    for (let dx = 0; dx < 5; dx++) {
      const isWall = dy === 0 || dy === 3 || dx === 0 || dx === 4
      const isDoor = dx === 2 && (dy === 2 || dy === 3)
      const isWindow = (dx === 1 || dx === 3) && dy === 1

      if (isDoor) {
        setTile(world, baseTileX + dx, baseTileY - dy, 'air')
      } else if (isWindow) {
        setTile(world, baseTileX + dx, baseTileY - dy, 'glass')
      } else if (isWall) {
        setTile(world, baseTileX + dx, baseTileY - dy, 'brick')
      } else {
        setTile(world, baseTileX + dx, baseTileY - dy, 'air')
      }
    }
  }
  // Roof
  for (let dx = -1; dx <= 5; dx++) {
    setTile(world, baseTileX + dx, baseTileY - 4, 'wood')
  }
  return 'Built a house!'
}

/** Build a tower (3 wide, 8 tall brick column) */
function buildTower(world: TileWorld, baseTileX: number, baseTileY: number): string {
  for (let dy = 0; dy < 8; dy++) {
    for (let dx = 0; dx < 3; dx++) {
      const isWall = dx === 0 || dx === 2
      const isTop = dy === 7
      const isDoor = dx === 1 && dy <= 1
      if (isDoor) {
        setTile(world, baseTileX + dx, baseTileY - dy, 'air')
      } else if (isWall || isTop) {
        setTile(world, baseTileX + dx, baseTileY - dy, 'brick')
      } else {
        setTile(world, baseTileX + dx, baseTileY - dy, 'air')
      }
    }
  }
  // Parapet
  setTile(world, baseTileX - 1, baseTileY - 8, 'stone')
  setTile(world, baseTileX + 3, baseTileY - 8, 'stone')
  return 'Built a tower!'
}

/** Build a tree */
function buildTree(world: TileWorld, baseTileX: number, baseTileY: number): string {
  // Trunk (4 high)
  for (let dy = 1; dy <= 4; dy++) {
    setTile(world, baseTileX, baseTileY - dy, 'wood')
  }
  // Leaves crown (3x3 at top + 1 above)
  for (let dx = -1; dx <= 1; dx++) {
    for (let dy = 4; dy <= 6; dy++) {
      setTile(world, baseTileX + dx, baseTileY - dy, 'leaves')
    }
  }
  setTile(world, baseTileX, baseTileY - 7, 'leaves')
  return 'Planted a tree!'
}

/** Build a bridge (wood planks spanning a gap, 8 tiles wide) */
function buildBridge(world: TileWorld, baseTileX: number, baseTileY: number): string {
  for (let dx = 0; dx < 8; dx++) {
    setTile(world, baseTileX + dx, baseTileY, 'wood')
    // Railing
    setTile(world, baseTileX + dx, baseTileY - 1, 'air')
    if (dx === 0 || dx === 7) {
      setTile(world, baseTileX + dx, baseTileY - 1, 'wood')
      setTile(world, baseTileX + dx, baseTileY - 2, 'wood')
    }
  }
  return 'Built a bridge!'
}

// ─── Chat Commands ────────────────────────────────────────────

/** Parse and handle tile world chat commands. Returns response string or null if not a tile command. */
export function handleTileCommand(
  text: string,
  username: string,
  world: TileWorld,
  robotWorldPixelX: number,
): string | null {
  const t = text.trim().toLowerCase()
  const robotTileX = worldXToTile(robotWorldPixelX)
  // Robot stands on the surface — find ground level at robot position
  const robotTileY = findSurfaceY(world, robotTileX)

  // !place <block> <x> <y>
  const placeMatch = t.match(/^!place\s+(\w+)\s+(-?\d+)\s+(-?\d+)$/)
  if (placeMatch) {
    const blockName = placeMatch[1] as BlockType
    const rx = parseInt(placeMatch[2])
    const ry = parseInt(placeMatch[3])

    if (!PLACEABLE_BLOCKS.has(blockName)) {
      return `Can't place "${blockName}". Use: ${[...PLACEABLE_BLOCKS].join(', ')}`
    }
    if (Math.abs(rx) > 5 || Math.abs(ry) > 5) {
      return 'Too far! Max distance is 5 tiles from the robot.'
    }

    const targetX = robotTileX + rx
    const targetY = robotTileY - ry  // negative Y = up in world coords

    // Don't place in robot position
    if (rx === 0 && ry === 0) {
      return "Can't place a block on the robot!"
    }

    setTile(world, targetX, targetY, blockName)
    return `${username} placed ${blockName} at (${rx},${ry})`
  }

  // !break <x> <y>
  const breakMatch = t.match(/^!break\s+(-?\d+)\s+(-?\d+)$/)
  if (breakMatch) {
    const rx = parseInt(breakMatch[1])
    const ry = parseInt(breakMatch[2])

    if (Math.abs(rx) > 5 || Math.abs(ry) > 5) {
      return 'Too far! Max distance is 5 tiles.'
    }

    const targetX = robotTileX + rx
    const targetY = robotTileY - ry

    const existing = getTile(world, targetX, targetY)
    if (existing === 'air') {
      return 'Nothing to break there!'
    }

    setTile(world, targetX, targetY, 'air')
    return `${username} broke ${existing} at (${rx},${ry})`
  }

  // !dig
  if (t === '!dig') {
    const below = getTile(world, robotTileX, robotTileY + 1)
    if (below === 'air' || below === 'water' || below === 'lava') {
      return "Nothing solid to dig!"
    }
    setTile(world, robotTileX, robotTileY + 1, 'air')
    return `${username} dug through ${below}!`
  }

  // !build <structure>
  const buildMatch = t.match(/^!build\s+(\w+)$/)
  if (buildMatch) {
    const structure = buildMatch[1]
    // Place structures relative to robot, on the surface
    const buildX = robotTileX + 2  // offset slightly to the right
    const buildY = robotTileY

    switch (structure) {
      case 'house':  return buildHouse(world, buildX, buildY)
      case 'tower':  return buildTower(world, buildX, buildY)
      case 'tree':   return buildTree(world, buildX, buildY)
      case 'bridge': return buildBridge(world, buildX, buildY)
      default:
        return `Unknown structure "${structure}". Available: house, tower, tree, bridge`
    }
  }

  // !fill <block> <x1> <y1> <x2> <y2>
  const fillMatch = t.match(/^!fill\s+(\w+)\s+(-?\d+)\s+(-?\d+)\s+(-?\d+)\s+(-?\d+)$/)
  if (fillMatch) {
    const blockName = fillMatch[1] as BlockType
    const x1 = parseInt(fillMatch[2])
    const y1 = parseInt(fillMatch[3])
    const x2 = parseInt(fillMatch[4])
    const y2 = parseInt(fillMatch[5])

    if (!PLACEABLE_BLOCKS.has(blockName)) {
      return `Can't fill with "${blockName}". Use: ${[...PLACEABLE_BLOCKS].join(', ')}`
    }

    const minX = Math.min(x1, x2)
    const maxX = Math.max(x1, x2)
    const minY = Math.min(y1, y2)
    const maxY = Math.max(y1, y2)

    if (maxX - minX > 9 || maxY - minY > 9) {
      return 'Max fill area is 10x10!'
    }

    if (Math.abs(maxX) > 10 || Math.abs(maxY) > 10 || Math.abs(minX) > 10 || Math.abs(minY) > 10) {
      return 'Too far from robot! Keep coordinates within 10.'
    }

    let count = 0
    for (let ry = minY; ry <= maxY; ry++) {
      for (let rx = minX; rx <= maxX; rx++) {
        const tx = robotTileX + rx
        const ty = robotTileY - ry
        setTile(world, tx, ty, blockName)
        count++
      }
    }
    return `${username} filled ${count} blocks with ${blockName}!`
  }

  // !biome
  if (t === '!biome') {
    const surface = findSurfaceY(world, robotTileX)
    const depth = WORLD_HEIGHT - surface
    let biomeDesc = 'Overworld (grass terrain)'
    if (surface > world.surfaceLevel + 4) biomeDesc = 'Valley (low terrain, possible lake)'
    if (surface < world.surfaceLevel - 4) biomeDesc = 'Hills (elevated terrain)'
    return `Biome: ${biomeDesc} | Surface: y=${surface} | Depth to bedrock: ${depth} tiles | Seed: ${world.seed}`
  }

  // !seed
  if (t === '!seed') {
    return `World seed: ${world.seed}`
  }

  // !save
  if (t === '!save') {
    saveWorld(world)
    const modifiedCount = Array.from(world.chunks.values()).filter(c => c.modified).length
    return `World saved! (${modifiedCount} modified chunks, ${world.chunks.size} total loaded)`
  }

  return null
}

/** Find the surface Y (first non-air tile from top) at a given tile X */
function findSurfaceY(world: TileWorld, tileX: number): number {
  for (let y = 0; y < WORLD_HEIGHT; y++) {
    const block = getTile(world, tileX, y)
    if (block !== 'air' && block !== 'leaves' && block !== 'water') {
      return y
    }
  }
  return world.surfaceLevel
}

// ─── Tool Registration ────────────────────────────────────────

export function registerTileWorldTools(): void {
  registerTool({
    name: 'tile_world_info',
    description: 'Show current tile world state — seed, camera position, loaded chunks, modified chunks',
    parameters: {},
    tier: 'free',
    execute: async () => {
      // Try to load world from disk to report on it
      const world = loadWorld()
      if (!world) {
        return 'No tile world exists yet. Start the stream to generate one, or call tile_world_reset.'
      }

      const totalChunks = world.chunks.size
      const modifiedChunks = Array.from(world.chunks.values()).filter(c => c.modified).length

      return [
        `Tile World Info`,
        `  Seed: ${world.seed}`,
        `  Camera X: ${Math.round(world.cameraX)}px`,
        `  Surface level: ${world.surfaceLevel}`,
        `  Time of day: ${world.timeOfDay}`,
        `  Weather: ${world.weather}`,
        `  Loaded chunks: ${totalChunks}`,
        `  Modified chunks: ${modifiedChunks}`,
        `  Tile size: ${TILE_SIZE}px`,
        `  Chunk size: ${CHUNK_WIDTH}x${WORLD_HEIGHT} tiles`,
        `  World file: ${WORLD_FILE}`,
        `  File exists: ${existsSync(WORLD_FILE)}`,
      ].join('\n')
    },
  })

  registerTool({
    name: 'tile_world_reset',
    description: 'Generate a fresh tile world with a new seed. Destroys the current saved world.',
    parameters: {
      seed: {
        type: 'number',
        description: 'Optional seed for the new world. Random if not provided.',
      },
    },
    tier: 'free',
    execute: async (params: Record<string, unknown>) => {
      const seed = typeof params.seed === 'number' ? params.seed : undefined
      const world = initTileWorld(seed)
      saveWorld(world)

      return `Fresh tile world generated!\n  Seed: ${world.seed}\n  Surface level: ${world.surfaceLevel}\n  Pre-generated chunks: ${world.chunks.size}\n  Saved to: ${WORLD_FILE}`
    },
  })
}
