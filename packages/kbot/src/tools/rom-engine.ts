/**
 * rom-engine.ts — ROM-hack-inspired rendering engine
 *
 * Core rendering engine that brings SNES/GBA-era visual techniques to Canvas 2D:
 *   1. Indexed color palette system (256 entries, packed RGBA uint32)
 *   2. Palette cycling (Mark Ferrari technique — loop & pingpong modes)
 *   3. HDMA-style per-scanline sky gradient (night/day/sunset/dawn)
 *   4. Parallax layer system (4-5 layers per biome)
 *   5. Frame budget tracking with adaptive quality
 *
 * References:
 *   - SNES PPU: H-Blank DMA (HDMA) for per-scanline register writes
 *   - Mark Ferrari / CanvasCycle: palette rotation as animation primitive
 *   - GBA ROM hacks: HBlank parallax, hardware blending, 15-bit palettes
 */

// ---------------------------------------------------------------------------
// 1. RGBA Pack / Unpack
// ---------------------------------------------------------------------------

export function packRGBA(r: number, g: number, b: number, a: number = 255): number {
  return ((a & 0xFF) << 24) | ((b & 0xFF) << 16) | ((g & 0xFF) << 8) | (r & 0xFF)
}

export function unpackRGBA(packed: number): [number, number, number, number] {
  return [
    packed & 0xFF,
    (packed >>> 8) & 0xFF,
    (packed >>> 16) & 0xFF,
    (packed >>> 24) & 0xFF,
  ]
}

/** Convert hex string (#RRGGBB) to packed RGBA uint32 */
function hexToPackedRGBA(hex: string, a: number = 255): number {
  const h = hex.replace('#', '')
  const r = parseInt(h.substring(0, 2), 16)
  const g = parseInt(h.substring(2, 4), 16)
  const b = parseInt(h.substring(4, 6), 16)
  return packRGBA(r, g, b, a)
}

/** Linearly interpolate between two packed RGBA colors */
function lerpColor(a: number, b: number, t: number): number {
  const [ar, ag, ab, aa] = unpackRGBA(a)
  const [br, bg, bb, ba] = unpackRGBA(b)
  return packRGBA(
    Math.round(ar + (br - ar) * t),
    Math.round(ag + (bg - ag) * t),
    Math.round(ab + (bb - ab) * t),
    Math.round(aa + (ba - aa) * t),
  )
}

/** Build a gradient ramp between two hex colors across N entries */
function buildGradient(hexA: string, hexB: string, count: number): number[] {
  const a = hexToPackedRGBA(hexA)
  const b = hexToPackedRGBA(hexB)
  const out: number[] = []
  for (let i = 0; i < count; i++) {
    out.push(lerpColor(a, b, i / Math.max(count - 1, 1)))
  }
  return out
}

/** Build a multi-stop gradient. stops: [hex, hex, ...], evenly spaced across count entries */
function buildMultiGradient(stops: string[], count: number): number[] {
  if (stops.length < 2) {
    const c = hexToPackedRGBA(stops[0] || '#000000')
    return new Array(count).fill(c)
  }
  const out: number[] = []
  const segments = stops.length - 1
  for (let i = 0; i < count; i++) {
    const t = i / Math.max(count - 1, 1)
    const seg = Math.min(Math.floor(t * segments), segments - 1)
    const localT = (t * segments) - seg
    const a = hexToPackedRGBA(stops[seg])
    const b = hexToPackedRGBA(stops[seg + 1])
    out.push(lerpColor(a, b, localT))
  }
  return out
}

// ---------------------------------------------------------------------------
// 2. Indexed Color Palette
// ---------------------------------------------------------------------------

export interface RomPalette {
  colors: Uint32Array   // 256 RGBA entries (each as 0xAABBGGRR packed)
  base: Uint32Array     // original colors for reset
}

export function createPalette(): RomPalette {
  const colors = new Uint32Array(256)
  const base = new Uint32Array(256)

  // 0: transparent
  colors[0] = packRGBA(0, 0, 0, 0)

  // 1-15: UI colors
  const uiColors = [
    '#FFFFFF', '#E0E0E0', '#C0C0C0', '#A0A0A0', '#808080',
    '#606060', '#404040', '#202020', '#6B5B95', '#D4A574',
    '#7BC67E', '#5BA3CF', '#CF5B5B', '#CFB85B', '#5BCFCF',
  ]
  for (let i = 0; i < 15; i++) {
    colors[i + 1] = hexToPackedRGBA(uiColors[i])
  }

  // 16-31: Grass (4 shades of green, hue-shifted across 16 entries)
  const grassColors = buildMultiGradient(
    ['#0A3A0A', '#1A5A1A', '#2A7A2A', '#4A9A3A', '#3A8A2A', '#1A6A1A', '#0A4A0A', '#1A5A1A'],
    16,
  )
  for (let i = 0; i < 16; i++) colors[16 + i] = grassColors[i]

  // 32-47: Water (dark blue -> light blue -> white -> dark blue — cycling range)
  const waterColors = buildMultiGradient(
    ['#0A1628', '#1A3A5C', '#2E6090', '#4A8ABF', '#87CEEB', '#B0D8F0', '#D0E8F8', '#FFFFFF',
     '#D0E8F8', '#B0D8F0', '#87CEEB', '#4A8ABF', '#2E6090', '#1A3A5C', '#0A1628', '#0F2040'],
    16,
  )
  for (let i = 0; i < 16; i++) colors[32 + i] = waterColors[i]

  // 48-63: Stone (grays with subtle brown)
  const stoneColors = buildMultiGradient(
    ['#3A3530', '#4A4540', '#5A5550', '#6A6560', '#7A7570',
     '#8A8580', '#9A9590', '#AAA5A0'],
    16,
  )
  for (let i = 0; i < 16; i++) colors[48 + i] = stoneColors[i]

  // 64-79: Lava (black -> red -> orange -> yellow — cycling range)
  const lavaColors = buildMultiGradient(
    ['#100000', '#3A0000', '#6A0A00', '#A02000', '#D04010',
     '#E06020', '#F09030', '#FFC040', '#FFE060', '#FFC040',
     '#F09030', '#E06020', '#D04010', '#A02000', '#6A0A00', '#3A0000'],
    16,
  )
  for (let i = 0; i < 16; i++) colors[64 + i] = lavaColors[i]

  // 80-95: Sand (warm yellows)
  const sandColors = buildMultiGradient(
    ['#8A7050', '#A08860', '#B8A070', '#D0B880', '#E0C890',
     '#E8D0A0', '#F0D8B0', '#F8E0C0'],
    16,
  )
  for (let i = 0; i < 16; i++) colors[80 + i] = sandColors[i]

  // 96-111: Snow/ice (whites and light blues)
  const snowColors = buildMultiGradient(
    ['#C0D0E0', '#D0E0F0', '#E0E8F8', '#F0F0FF', '#FFFFFF',
     '#F0F8FF', '#E0F0FF', '#D0E8FF'],
    16,
  )
  for (let i = 0; i < 16; i++) colors[96 + i] = snowColors[i]

  // 112-127: Sky (deep blue -> horizon colors — cycling during sunset)
  const skyColors = buildMultiGradient(
    ['#0A1628', '#1A2A4A', '#2A3A5A', '#3A4A6A', '#4A5A7A',
     '#5A6A8A', '#6A7A9A', '#7A8AAA', '#8A9ABA', '#9AAACA',
     '#AAB8DA', '#BAC8EA', '#C8D8F0', '#D0E0F8', '#D8E8FF', '#E0F0FF'],
    16,
  )
  for (let i = 0; i < 16; i++) colors[112 + i] = skyColors[i]

  // 128-143: Ore highlights (gray -> white -> gray — cycling)
  const oreColors = buildMultiGradient(
    ['#606060', '#707070', '#808080', '#909090', '#A0A0A0',
     '#B0B0B0', '#C0C0C0', '#D0D0D0', '#E0E0E0', '#F0F0F0',
     '#FFFFFF', '#F0F0F0', '#E0E0E0', '#D0D0D0', '#C0C0C0', '#B0B0B0'],
    16,
  )
  for (let i = 0; i < 16; i++) colors[128 + i] = oreColors[i]

  // 144-159: Fire (red -> orange -> yellow -> white — cycling)
  const fireColors = buildMultiGradient(
    ['#200000', '#500000', '#801000', '#A03000', '#C05000',
     '#E07000', '#F09000', '#FFB000', '#FFD040', '#FFE070',
     '#FFF0A0', '#FFFFD0', '#FFFFFF', '#FFE070', '#FFB000', '#C05000'],
    16,
  )
  for (let i = 0; i < 16; i++) colors[144 + i] = fireColors[i]

  // 160-175: Aurora (green -> cyan -> purple — cycling, night only)
  const auroraColors = buildMultiGradient(
    ['#00FF60', '#00FFAA', '#00FFD0', '#00FFF0', '#00E0FF',
     '#00C0FF', '#20A0FF', '#4080FF', '#6060FF', '#8040FF',
     '#A020FF', '#C000E0', '#A020FF', '#6060FF', '#20A0FF', '#00E0FF'],
    16,
  )
  for (let i = 0; i < 16; i++) colors[160 + i] = auroraColors[i]

  // 176-191: Wood/leaves (browns and greens)
  const woodColors = buildMultiGradient(
    ['#3A2A1A', '#4A3A2A', '#5A4A3A', '#6A5A4A', '#5A5030',
     '#4A5A20', '#3A5A1A', '#2A5A10'],
    16,
  )
  for (let i = 0; i < 16; i++) colors[176 + i] = woodColors[i]

  // 192-207: Brick/glass (reds and light blues)
  const brickColors = buildMultiGradient(
    ['#5A2020', '#7A3030', '#9A4040', '#BA5050', '#A06060',
     '#8090B0', '#90A8C8', '#A0C0E0'],
    16,
  )
  for (let i = 0; i < 16; i++) colors[192 + i] = brickColors[i]

  // 208-223: Decorative (flower colors, moss)
  const decoColors = buildMultiGradient(
    ['#FF6090', '#FF80A0', '#FFA0B0', '#D0A0FF', '#A090E0',
     '#80D080', '#60B060', '#409040'],
    16,
  )
  for (let i = 0; i < 16; i++) colors[208 + i] = decoColors[i]

  // 224-239: Star twinkle (dim -> bright — cycling)
  const starColors = buildMultiGradient(
    ['#101020', '#181828', '#202040', '#303060', '#404880',
     '#5060A0', '#6878C0', '#8090E0', '#A0B0FF', '#C0D0FF',
     '#E0E8FF', '#FFFFFF', '#E0E8FF', '#C0D0FF', '#A0B0FF', '#8090E0'],
    16,
  )
  for (let i = 0; i < 16; i++) colors[224 + i] = starColors[i]

  // 240-255: Reserved (default to dark gray)
  for (let i = 240; i < 256; i++) colors[i] = packRGBA(32, 32, 32, 255)

  // Copy to base for reset capability
  base.set(colors)

  return { colors, base }
}

/** Reset palette to base colors */
export function resetPalette(palette: RomPalette): void {
  palette.colors.set(palette.base)
}

// ---------------------------------------------------------------------------
// 3. Palette Cycling
// ---------------------------------------------------------------------------

export interface PaletteCycle {
  start: number        // first palette index
  end: number          // last palette index
  speed: number        // ms between rotations
  direction: 1 | -1
  mode: 'loop' | 'pingpong'
  accumulator: number  // ms accumulated since last rotation
  pingpongDir: 1 | -1  // current direction for pingpong mode
}

const DEFAULT_CYCLES: Omit<PaletteCycle, 'accumulator' | 'pingpongDir'>[] = [
  { start: 32, end: 39, speed: 100, direction: 1, mode: 'loop' },       // water surface
  { start: 40, end: 47, speed: 150, direction: 1, mode: 'loop' },       // water depth
  { start: 64, end: 71, speed: 60, direction: 1, mode: 'pingpong' },    // lava
  { start: 128, end: 131, speed: 80, direction: 1, mode: 'pingpong' },  // ore shimmer
  { start: 144, end: 149, speed: 40, direction: 1, mode: 'loop' },      // fire
  { start: 160, end: 169, speed: 120, direction: 1, mode: 'loop' },     // aurora
  { start: 224, end: 225, speed: 300, direction: 1, mode: 'pingpong' }, // stars
]

export function createDefaultCycles(): PaletteCycle[] {
  return DEFAULT_CYCLES.map(c => ({
    ...c,
    accumulator: 0,
    pingpongDir: c.direction,
  }))
}

function rotateCycleRange(palette: RomPalette, start: number, end: number, dir: 1 | -1): void {
  const len = end - start + 1
  if (len < 2) return
  if (dir === 1) {
    // Forward: save last, shift right, put saved at start
    const saved = palette.colors[end]
    for (let i = end; i > start; i--) palette.colors[i] = palette.colors[i - 1]
    palette.colors[start] = saved
  } else {
    // Reverse: save first, shift left, put saved at end
    const saved = palette.colors[start]
    for (let i = start; i < end; i++) palette.colors[i] = palette.colors[i + 1]
    palette.colors[end] = saved
  }
}

export function tickPaletteCycles(palette: RomPalette, cycles: PaletteCycle[], deltaMs: number): boolean {
  let anyTicked = false

  for (const cycle of cycles) {
    cycle.accumulator += deltaMs

    while (cycle.accumulator >= cycle.speed) {
      cycle.accumulator -= cycle.speed

      if (cycle.mode === 'loop') {
        rotateCycleRange(palette, cycle.start, cycle.end, cycle.direction)
      } else {
        // pingpong mode
        rotateCycleRange(palette, cycle.start, cycle.end, cycle.pingpongDir)
        // Track position and reverse at boundaries
        // We use a simple approach: reverse direction after (end - start) rotations
        const rangeLen = cycle.end - cycle.start
        if (!('_bounceCount' in cycle)) {
          (cycle as PaletteCycle & { _bounceCount: number })._bounceCount = 0
        }
        const c = cycle as PaletteCycle & { _bounceCount: number }
        c._bounceCount++
        if (c._bounceCount >= rangeLen) {
          cycle.pingpongDir = (cycle.pingpongDir === 1 ? -1 : 1) as 1 | -1
          c._bounceCount = 0
        }
      }

      anyTicked = true
    }
  }

  return anyTicked
}

// ---------------------------------------------------------------------------
// 4. HDMA Sky Gradient
// ---------------------------------------------------------------------------

export interface HdmaEntry {
  r: number
  g: number
  b: number
  fogDensity: number
  scrollOffset: number   // for wavy distortion
}

/** Parse hex to RGB tuple */
function hexToRGB(hex: string): [number, number, number] {
  const h = hex.replace('#', '')
  return [
    parseInt(h.substring(0, 2), 16),
    parseInt(h.substring(2, 4), 16),
    parseInt(h.substring(4, 6), 16),
  ]
}

/** Interpolate between two RGB triplets */
function lerpRGB(a: [number, number, number], b: [number, number, number], t: number): [number, number, number] {
  return [
    Math.round(a[0] + (b[0] - a[0]) * t),
    Math.round(a[1] + (b[1] - a[1]) * t),
    Math.round(a[2] + (b[2] - a[2]) * t),
  ]
}

interface GradientStop {
  line: number
  color: string
  fog: number
}

function buildGradientTable(stops: GradientStop[], totalLines: number): HdmaEntry[] {
  const table: HdmaEntry[] = []

  for (let y = 0; y < totalLines; y++) {
    // Find the two stops that bracket this scanline
    let lo = stops[0]
    let hi = stops[stops.length - 1]
    for (let s = 0; s < stops.length - 1; s++) {
      if (y >= stops[s].line && y < stops[s + 1].line) {
        lo = stops[s]
        hi = stops[s + 1]
        break
      }
    }

    const range = hi.line - lo.line
    const t = range > 0 ? Math.min(1, Math.max(0, (y - lo.line) / range)) : 0
    const loRGB = hexToRGB(lo.color)
    const hiRGB = hexToRGB(hi.color)
    const [r, g, b] = lerpRGB(loRGB, hiRGB, t)
    const fog = lo.fog + (hi.fog - lo.fog) * t

    table.push({
      r, g, b,
      fogDensity: fog,
      scrollOffset: 0,
    })
  }

  return table
}

export function buildHdmaTable(timeOfDay: string, _weather: string, height: number): HdmaEntry[] {
  const h = height

  // Scale stop positions proportionally to height
  const s = (line: number, base: number) => Math.round((line / base) * h)

  switch (timeOfDay) {
    case 'night':
      return buildGradientTable([
        { line: 0,             color: '#050510', fog: 0.0 },
        { line: s(50, 720),    color: '#050510', fog: 0.0 },
        { line: s(200, 720),   color: '#0a1628', fog: 0.05 },
        { line: s(350, 720),   color: '#1a2a4a', fog: 0.1 },
        { line: s(720, 720),   color: '#1a3050', fog: 0.15 },
      ], h)

    case 'day':
      return buildGradientTable([
        { line: 0,             color: '#1a3a5c', fog: 0.0 },
        { line: s(100, 720),   color: '#1a3a5c', fog: 0.0 },
        { line: s(300, 720),   color: '#4a7aaa', fog: 0.02 },
        { line: s(400, 720),   color: '#87ceeb', fog: 0.05 },
        { line: s(720, 720),   color: '#b0d8f0', fog: 0.08 },
      ], h)

    case 'sunset':
      return buildGradientTable([
        { line: 0,             color: '#1a0a2e', fog: 0.0 },
        { line: s(80, 720),    color: '#1a0a2e', fog: 0.0 },
        { line: s(200, 720),   color: '#6b2f5f', fog: 0.05 },
        { line: s(300, 720),   color: '#e85d3a', fog: 0.1 },
        { line: s(400, 720),   color: '#f4a460', fog: 0.12 },
        { line: s(720, 720),   color: '#ffd27f', fog: 0.15 },
      ], h)

    case 'dawn':
      return buildGradientTable([
        { line: 0,             color: '#0a1628', fog: 0.0 },
        { line: s(100, 720),   color: '#0a1628', fog: 0.0 },
        { line: s(250, 720),   color: '#3a2a5c', fog: 0.05 },
        { line: s(350, 720),   color: '#d4926b', fog: 0.1 },
        { line: s(720, 720),   color: '#ffe0b0', fog: 0.12 },
      ], h)

    default:
      // Fallback to day
      return buildHdmaTable('day', _weather, height)
  }
}

export function renderHdmaSky(ctx: CanvasRenderingContext2D, hdma: HdmaEntry[], width: number): void {
  if (hdma.length === 0) return

  // Batch runs of identical colors into single rects for performance
  let startLine = 0
  let prevR = hdma[0].r
  let prevG = hdma[0].g
  let prevB = hdma[0].b

  for (let y = 1; y <= hdma.length; y++) {
    const entry = y < hdma.length ? hdma[y] : null

    if (!entry || entry.r !== prevR || entry.g !== prevG || entry.b !== prevB) {
      // Flush the accumulated run
      ctx.fillStyle = `rgb(${prevR},${prevG},${prevB})`
      ctx.fillRect(0, startLine, width, y - startLine)

      if (entry) {
        startLine = y
        prevR = entry.r
        prevG = entry.g
        prevB = entry.b
      }
    }
  }
}

// ---------------------------------------------------------------------------
// 5. Parallax Layer System
// ---------------------------------------------------------------------------

export interface ParallaxLayer {
  canvas: OffscreenCanvas | null  // null in Node.js; layer data stored as imageData
  imageData: ImageData | null     // fallback for node-canvas
  scrollFactor: number            // 0.0-2.0 (0.0 = fixed, 1.0 = camera speed, >1 = foreground)
  yOffset: number                 // vertical position
  opacity: number                 // 0-1
  width: number
  height: number
  renderFn: ((ctx: CanvasRenderingContext2D, w: number, h: number) => void) | null
}

export interface BiomeParallax {
  layers: ParallaxLayer[]
  biome: string
}

// Parallax layer generator functions per biome

function drawMountainSilhouettes(ctx: CanvasRenderingContext2D, w: number, h: number): void {
  ctx.fillStyle = '#1a2a3a'
  // 4 mountain peaks at varied positions
  const peaks = [
    { x: w * 0.15, peakY: h * 0.2, baseW: w * 0.25 },
    { x: w * 0.35, peakY: h * 0.1, baseW: w * 0.3 },
    { x: w * 0.65, peakY: h * 0.15, baseW: w * 0.28 },
    { x: w * 0.85, peakY: h * 0.25, baseW: w * 0.22 },
  ]
  for (const p of peaks) {
    ctx.beginPath()
    ctx.moveTo(p.x - p.baseW / 2, h)
    ctx.lineTo(p.x, p.peakY)
    ctx.lineTo(p.x + p.baseW / 2, h)
    ctx.closePath()
    ctx.fill()
  }
}

function drawRollingHills(ctx: CanvasRenderingContext2D, w: number, h: number): void {
  ctx.fillStyle = '#153a15'
  // Sine-wave hills
  ctx.beginPath()
  ctx.moveTo(0, h)
  for (let x = 0; x <= w; x += 2) {
    const y = h * 0.4 + Math.sin(x * 0.008) * h * 0.15 + Math.sin(x * 0.003) * h * 0.1
    ctx.lineTo(x, y)
  }
  ctx.lineTo(w, h)
  ctx.closePath()
  ctx.fill()

  // Small triangle trees on hilltops
  ctx.fillStyle = '#0a2a0a'
  for (let x = 30; x < w; x += 60 + Math.floor(pseudoRandom(x) * 40)) {
    const hillY = h * 0.4 + Math.sin(x * 0.008) * h * 0.15 + Math.sin(x * 0.003) * h * 0.1
    const treeH = 12 + pseudoRandom(x + 1) * 10
    ctx.beginPath()
    ctx.moveTo(x - 5, hillY)
    ctx.lineTo(x, hillY - treeH)
    ctx.lineTo(x + 5, hillY)
    ctx.closePath()
    ctx.fill()
  }
}

function drawNearHills(ctx: CanvasRenderingContext2D, w: number, h: number): void {
  ctx.fillStyle = '#1a4d1a'
  // Taller hills
  ctx.beginPath()
  ctx.moveTo(0, h)
  for (let x = 0; x <= w; x += 2) {
    const y = h * 0.3 + Math.sin(x * 0.005 + 1.5) * h * 0.2 + Math.sin(x * 0.012) * h * 0.05
    ctx.lineTo(x, y)
  }
  ctx.lineTo(w, h)
  ctx.closePath()
  ctx.fill()

  // Bigger trees and bushes
  ctx.fillStyle = '#0f3f0f'
  for (let x = 20; x < w; x += 40 + Math.floor(pseudoRandom(x + 100) * 30)) {
    const hillY = h * 0.3 + Math.sin(x * 0.005 + 1.5) * h * 0.2 + Math.sin(x * 0.012) * h * 0.05
    const treeH = 18 + pseudoRandom(x + 101) * 14
    // Tree trunk
    ctx.fillStyle = '#2a1a0a'
    ctx.fillRect(x - 1, hillY - treeH * 0.4, 3, treeH * 0.4)
    // Canopy
    ctx.fillStyle = '#0f3f0f'
    ctx.beginPath()
    ctx.moveTo(x - 8, hillY - treeH * 0.3)
    ctx.lineTo(x, hillY - treeH)
    ctx.lineTo(x + 8, hillY - treeH * 0.3)
    ctx.closePath()
    ctx.fill()
    // Bush beside tree
    if (pseudoRandom(x + 200) > 0.5) {
      ctx.beginPath()
      ctx.arc(x + 12, hillY - 3, 5, 0, Math.PI * 2)
      ctx.fill()
    }
  }
}

function drawForegroundGrass(ctx: CanvasRenderingContext2D, w: number, h: number): void {
  // Small vertical green lines at random positions
  ctx.strokeStyle = '#2a6a2a'
  ctx.lineWidth = 1
  for (let x = 0; x < w; x += 3 + Math.floor(pseudoRandom(x + 300) * 4)) {
    const baseY = h * 0.7 + pseudoRandom(x + 301) * h * 0.3
    const bladeH = 4 + pseudoRandom(x + 302) * 8
    ctx.beginPath()
    ctx.moveTo(x, baseY)
    ctx.lineTo(x + (pseudoRandom(x + 303) - 0.5) * 3, baseY - bladeH)
    ctx.stroke()
  }

  // Fog wisps: semi-transparent horizontal streaks
  for (let i = 0; i < 5; i++) {
    const y = h * 0.3 + pseudoRandom(i + 400) * h * 0.5
    const xStart = pseudoRandom(i + 401) * w * 0.5
    const wispW = 80 + pseudoRandom(i + 402) * 120
    ctx.fillStyle = `rgba(200, 210, 220, 0.08)`
    ctx.fillRect(xStart, y, wispW, 2)
  }
}

// Volcanic biome layers

function drawVolcanicMountains(ctx: CanvasRenderingContext2D, w: number, h: number): void {
  ctx.fillStyle = '#1a0a05'
  const peaks = [
    { x: w * 0.2, peakY: h * 0.15, baseW: w * 0.3 },
    { x: w * 0.5, peakY: h * 0.05, baseW: w * 0.35 },
    { x: w * 0.8, peakY: h * 0.2, baseW: w * 0.25 },
  ]
  for (const p of peaks) {
    ctx.beginPath()
    ctx.moveTo(p.x - p.baseW / 2, h)
    ctx.lineTo(p.x, p.peakY)
    ctx.lineTo(p.x + p.baseW / 2, h)
    ctx.closePath()
    ctx.fill()
  }
  // Glow at crater
  ctx.fillStyle = '#3a1000'
  ctx.beginPath()
  ctx.arc(w * 0.5, h * 0.05 + 8, 15, 0, Math.PI * 2)
  ctx.fill()
}

function drawVolcanicRocks(ctx: CanvasRenderingContext2D, w: number, h: number): void {
  ctx.fillStyle = '#2a1a10'
  ctx.beginPath()
  ctx.moveTo(0, h)
  for (let x = 0; x <= w; x += 2) {
    const y = h * 0.5 + Math.sin(x * 0.006) * h * 0.1 + Math.abs(Math.sin(x * 0.015)) * h * 0.08
    ctx.lineTo(x, y)
  }
  ctx.lineTo(w, h)
  ctx.closePath()
  ctx.fill()
}

// Desert biome layers

function drawDesertDunes(ctx: CanvasRenderingContext2D, w: number, h: number): void {
  ctx.fillStyle = '#c0a060'
  ctx.beginPath()
  ctx.moveTo(0, h)
  for (let x = 0; x <= w; x += 2) {
    const y = h * 0.5 + Math.sin(x * 0.004) * h * 0.12 + Math.sin(x * 0.009 + 2) * h * 0.06
    ctx.lineTo(x, y)
  }
  ctx.lineTo(w, h)
  ctx.closePath()
  ctx.fill()
}

function drawDesertFarDunes(ctx: CanvasRenderingContext2D, w: number, h: number): void {
  ctx.fillStyle = '#a08858'
  ctx.beginPath()
  ctx.moveTo(0, h)
  for (let x = 0; x <= w; x += 2) {
    const y = h * 0.4 + Math.sin(x * 0.003 + 1) * h * 0.15
    ctx.lineTo(x, y)
  }
  ctx.lineTo(w, h)
  ctx.closePath()
  ctx.fill()
}

// Tundra biome layers

function drawTundraMountains(ctx: CanvasRenderingContext2D, w: number, h: number): void {
  ctx.fillStyle = '#a0b0c0'
  const peaks = [
    { x: w * 0.15, peakY: h * 0.2, baseW: w * 0.3 },
    { x: w * 0.45, peakY: h * 0.08, baseW: w * 0.35 },
    { x: w * 0.75, peakY: h * 0.18, baseW: w * 0.28 },
  ]
  for (const p of peaks) {
    ctx.beginPath()
    ctx.moveTo(p.x - p.baseW / 2, h)
    ctx.lineTo(p.x, p.peakY)
    ctx.lineTo(p.x + p.baseW / 2, h)
    ctx.closePath()
    ctx.fill()
    // Snow caps
    ctx.fillStyle = '#e0e8f0'
    ctx.beginPath()
    ctx.moveTo(p.x - p.baseW * 0.12, p.peakY + h * 0.08)
    ctx.lineTo(p.x, p.peakY)
    ctx.lineTo(p.x + p.baseW * 0.12, p.peakY + h * 0.08)
    ctx.closePath()
    ctx.fill()
    ctx.fillStyle = '#a0b0c0'
  }
}

function drawTundraSnowfield(ctx: CanvasRenderingContext2D, w: number, h: number): void {
  ctx.fillStyle = '#d0d8e0'
  ctx.beginPath()
  ctx.moveTo(0, h)
  for (let x = 0; x <= w; x += 2) {
    const y = h * 0.5 + Math.sin(x * 0.005) * h * 0.05
    ctx.lineTo(x, y)
  }
  ctx.lineTo(w, h)
  ctx.closePath()
  ctx.fill()
}

// Forest biome layers

function drawForestFarTrees(ctx: CanvasRenderingContext2D, w: number, h: number): void {
  ctx.fillStyle = '#0a1a08'
  // Dense canopy silhouette
  ctx.beginPath()
  ctx.moveTo(0, h)
  for (let x = 0; x <= w; x += 2) {
    const y = h * 0.3 + Math.sin(x * 0.02) * h * 0.05 + Math.abs(Math.sin(x * 0.07)) * h * 0.08
    ctx.lineTo(x, y)
  }
  ctx.lineTo(w, h)
  ctx.closePath()
  ctx.fill()
}

function drawForestMidTrees(ctx: CanvasRenderingContext2D, w: number, h: number): void {
  ctx.fillStyle = '#0f2a0a'
  ctx.beginPath()
  ctx.moveTo(0, h)
  for (let x = 0; x <= w; x += 2) {
    const y = h * 0.35 + Math.sin(x * 0.015 + 1) * h * 0.06 + Math.abs(Math.sin(x * 0.05 + 0.5)) * h * 0.1
    ctx.lineTo(x, y)
  }
  ctx.lineTo(w, h)
  ctx.closePath()
  ctx.fill()

  // Individual tree tops
  ctx.fillStyle = '#143a10'
  for (let x = 15; x < w; x += 25 + Math.floor(pseudoRandom(x + 500) * 20)) {
    const baseY = h * 0.35 + Math.sin(x * 0.015 + 1) * h * 0.06 + Math.abs(Math.sin(x * 0.05 + 0.5)) * h * 0.1
    const treeH = 20 + pseudoRandom(x + 501) * 15
    ctx.beginPath()
    ctx.moveTo(x - 7, baseY)
    ctx.lineTo(x, baseY - treeH)
    ctx.lineTo(x + 7, baseY)
    ctx.closePath()
    ctx.fill()
  }
}

// Ocean biome layers

function drawOceanWaves(ctx: CanvasRenderingContext2D, w: number, h: number): void {
  // Far ocean
  ctx.fillStyle = '#0a2a5a'
  ctx.fillRect(0, 0, w, h)
  // Wave bands
  for (let band = 0; band < 8; band++) {
    const y = h * 0.2 + band * h * 0.1
    ctx.fillStyle = `rgba(60, 120, 200, ${0.1 + band * 0.03})`
    ctx.beginPath()
    ctx.moveTo(0, y)
    for (let x = 0; x <= w; x += 2) {
      const wy = y + Math.sin(x * 0.01 + band * 1.2) * 4
      ctx.lineTo(x, wy)
    }
    ctx.lineTo(w, h)
    ctx.lineTo(0, h)
    ctx.closePath()
    ctx.fill()
  }
}

/** Simple deterministic pseudo-random based on seed (for reproducible layer generation) */
function pseudoRandom(seed: number): number {
  const x = Math.sin(seed * 12.9898 + seed * 78.233) * 43758.5453
  return x - Math.floor(x)
}

function createLayerCanvas(
  width: number,
  height: number,
  drawFn: (ctx: CanvasRenderingContext2D, w: number, h: number) => void,
  createCanvasFn: (w: number, h: number) => { canvas: unknown; ctx: CanvasRenderingContext2D },
): { canvas: unknown; ctx: CanvasRenderingContext2D } {
  const { canvas, ctx } = createCanvasFn(width, height)
  drawFn(ctx, width, height)
  return { canvas, ctx }
}

/** Factory to create a canvas, works in both browser (OffscreenCanvas) and Node (canvas package) */
function defaultCanvasFactory(w: number, h: number): { canvas: unknown; ctx: CanvasRenderingContext2D } {
  // Try node-canvas first (for Node.js / server-side rendering tests)
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { createCanvas } = require('canvas')
    const c = createCanvas(w, h)
    return { canvas: c, ctx: c.getContext('2d') as CanvasRenderingContext2D }
  } catch {
    // No canvas package available — return a dummy
    // In browser this would use OffscreenCanvas
    if (typeof OffscreenCanvas !== 'undefined') {
      const c = new OffscreenCanvas(w, h)
      return { canvas: c, ctx: c.getContext('2d') as unknown as CanvasRenderingContext2D }
    }
    // Absolute fallback — no rendering possible, return stubs
    return {
      canvas: null,
      ctx: {
        fillStyle: '',
        strokeStyle: '',
        lineWidth: 1,
        fillRect: () => {},
        strokeRect: () => {},
        beginPath: () => {},
        moveTo: () => {},
        lineTo: () => {},
        closePath: () => {},
        fill: () => {},
        stroke: () => {},
        arc: () => {},
        drawImage: () => {},
        save: () => {},
        restore: () => {},
        globalAlpha: 1,
      } as unknown as CanvasRenderingContext2D,
    }
  }
}

export function buildBiomeParallax(biome: string, width: number, height: number): BiomeParallax {
  const layers: ParallaxLayer[] = []

  // We use 2x width for seamless scrolling (wrap-around)
  const layerW = width * 2

  const layerDefs: Array<{
    scrollFactor: number
    yOffset: number
    opacity: number
    heightFraction: number
    drawFn: (ctx: CanvasRenderingContext2D, w: number, h: number) => void
  }>[] = []

  let defs: typeof layerDefs[0]

  switch (biome) {
    case 'volcanic':
      defs = [
        { scrollFactor: 0.05, yOffset: height * 0.1, opacity: 0.5, heightFraction: 0.35, drawFn: drawVolcanicMountains },
        { scrollFactor: 0.15, yOffset: height * 0.25, opacity: 0.7, heightFraction: 0.35, drawFn: drawVolcanicRocks },
        { scrollFactor: 1.3, yOffset: height * 0.75, opacity: 0.3, heightFraction: 0.25, drawFn: drawForegroundGrass },
      ]
      break
    case 'desert':
      defs = [
        { scrollFactor: 0.08, yOffset: height * 0.15, opacity: 0.5, heightFraction: 0.35, drawFn: drawDesertFarDunes },
        { scrollFactor: 0.25, yOffset: height * 0.3, opacity: 0.7, heightFraction: 0.35, drawFn: drawDesertDunes },
        { scrollFactor: 1.3, yOffset: height * 0.75, opacity: 0.25, heightFraction: 0.25, drawFn: drawForegroundGrass },
      ]
      break
    case 'tundra':
      defs = [
        { scrollFactor: 0.05, yOffset: height * 0.05, opacity: 0.5, heightFraction: 0.35, drawFn: drawTundraMountains },
        { scrollFactor: 0.2, yOffset: height * 0.3, opacity: 0.7, heightFraction: 0.3, drawFn: drawTundraSnowfield },
        { scrollFactor: 1.3, yOffset: height * 0.75, opacity: 0.2, heightFraction: 0.25, drawFn: drawForegroundGrass },
      ]
      break
    case 'forest':
      defs = [
        { scrollFactor: 0.05, yOffset: height * 0.05, opacity: 0.4, heightFraction: 0.35, drawFn: drawMountainSilhouettes },
        { scrollFactor: 0.12, yOffset: height * 0.15, opacity: 0.6, heightFraction: 0.35, drawFn: drawForestFarTrees },
        { scrollFactor: 0.3, yOffset: height * 0.3, opacity: 0.8, heightFraction: 0.35, drawFn: drawForestMidTrees },
        { scrollFactor: 1.3, yOffset: height * 0.75, opacity: 0.3, heightFraction: 0.25, drawFn: drawForegroundGrass },
      ]
      break
    case 'ocean':
      defs = [
        { scrollFactor: 0.03, yOffset: height * 0.2, opacity: 0.5, heightFraction: 0.8, drawFn: drawOceanWaves },
      ]
      break
    case 'plains':
    default:
      defs = [
        { scrollFactor: 0.05, yOffset: height * 0.1, opacity: 0.4, heightFraction: 0.3, drawFn: drawMountainSilhouettes },
        { scrollFactor: 0.15, yOffset: height * 0.25, opacity: 0.6, heightFraction: 0.3, drawFn: drawRollingHills },
        { scrollFactor: 0.4, yOffset: height * 0.4, opacity: 0.8, heightFraction: 0.25, drawFn: drawNearHills },
        { scrollFactor: 1.3, yOffset: height * 0.75, opacity: 0.3, heightFraction: 0.15, drawFn: drawForegroundGrass },
      ]
      break
  }

  for (const def of defs) {
    const layerH = Math.round(height * def.heightFraction)
    const { canvas } = createLayerCanvas(layerW, layerH, def.drawFn, defaultCanvasFactory)
    layers.push({
      canvas: canvas as OffscreenCanvas | null,
      imageData: null,
      scrollFactor: def.scrollFactor,
      yOffset: def.yOffset,
      opacity: def.opacity,
      width: layerW,
      height: layerH,
      renderFn: def.drawFn,
    })
  }

  return { layers, biome }
}

export function renderParallax(
  ctx: CanvasRenderingContext2D,
  parallax: BiomeParallax,
  cameraX: number,
  _frame: number,
): void {
  for (const layer of parallax.layers) {
    if (!layer.canvas) continue

    const savedAlpha = ctx.globalAlpha
    ctx.globalAlpha = layer.opacity

    // Calculate scroll offset, wrapping within layer width
    const offset = (-cameraX * layer.scrollFactor) % layer.width
    const drawX = offset < 0 ? offset + layer.width : offset

    // Draw the layer (with wrap-around for seamless scrolling)
    ctx.drawImage(layer.canvas as unknown as CanvasImageSource, drawX - layer.width, layer.yOffset)
    ctx.drawImage(layer.canvas as unknown as CanvasImageSource, drawX, layer.yOffset)

    ctx.globalAlpha = savedAlpha
  }
}

// ---------------------------------------------------------------------------
// 6. Frame Budget Tracker
// ---------------------------------------------------------------------------

export interface FrameBudget {
  timings: number[]     // last 30 frame render times in ms
  budget: number        // target ms (default: 150)
  overBudget: boolean
  dropLevel: number     // 0=full quality, 1=skip far parallax, 2=skip all parallax
}

export function createFrameBudget(budgetMs: number = 150): FrameBudget {
  return {
    timings: [],
    budget: budgetMs,
    overBudget: false,
    dropLevel: 0,
  }
}

export function startFrameTiming(): number {
  return typeof performance !== 'undefined' ? performance.now() : Date.now()
}

export function endFrameTiming(budget: FrameBudget, startTime: number): void {
  const now = typeof performance !== 'undefined' ? performance.now() : Date.now()
  const elapsed = now - startTime

  budget.timings.push(elapsed)
  if (budget.timings.length > 30) {
    budget.timings.shift()
  }

  budget.dropLevel = shouldDropQuality(budget)
  budget.overBudget = budget.dropLevel > 0
}

export function shouldDropQuality(budget: FrameBudget): number {
  if (budget.timings.length < 10) return 0

  // Average of last 10 frames
  const recent = budget.timings.slice(-10)
  const avg = recent.reduce((a, b) => a + b, 0) / recent.length

  if (avg > budget.budget) {
    // Already dropping? Escalate
    if (budget.dropLevel >= 1 && avg > budget.budget * 1.2) {
      return 2 // skip all parallax
    }
    return 1 // skip farthest parallax
  }

  // Recovery: drop back when average falls below 80% of budget
  if (avg < budget.budget * 0.8 && budget.dropLevel > 0) {
    return Math.max(0, budget.dropLevel - 1)
  }

  return budget.dropLevel
}

// ---------------------------------------------------------------------------
// 7. Integration / Engine State
// ---------------------------------------------------------------------------

export interface RomEngineState {
  palette: RomPalette
  cycles: PaletteCycle[]
  hdmaTable: HdmaEntry[]
  parallax: BiomeParallax | null
  frameBudget: FrameBudget
  currentBiome: string
  currentTimeOfDay: string
}

export function initRomEngine(biome: string = 'plains', timeOfDay: string = 'day'): RomEngineState {
  const palette = createPalette()
  const cycles = createDefaultCycles()
  const hdmaTable = buildHdmaTable(timeOfDay, 'clear', 720)
  let parallax: BiomeParallax | null = null

  try {
    parallax = buildBiomeParallax(biome, 1280, 720)
  } catch {
    // Canvas not available in this environment — parallax will be null
  }

  return {
    palette,
    cycles,
    hdmaTable,
    parallax,
    frameBudget: createFrameBudget(),
    currentBiome: biome,
    currentTimeOfDay: timeOfDay,
  }
}

export function tickRomEngine(state: RomEngineState, deltaMs: number): void {
  tickPaletteCycles(state.palette, state.cycles, deltaMs)
}

export function renderRomBackground(
  ctx: CanvasRenderingContext2D,
  state: RomEngineState,
  cameraX: number,
  frame: number,
  width: number,
  height: number,
): void {
  const start = startFrameTiming()

  // 1. Render HDMA sky gradient
  // Scale HDMA table to current height if needed
  let hdma = state.hdmaTable
  if (hdma.length !== height) {
    hdma = buildHdmaTable(state.currentTimeOfDay, 'clear', height)
    state.hdmaTable = hdma
  }
  renderHdmaSky(ctx, hdma, width)

  // 2. Render parallax layers (respecting dropLevel)
  if (state.parallax && state.frameBudget.dropLevel < 2) {
    const layers = state.parallax.layers
    const skipCount = state.frameBudget.dropLevel >= 1 ? 1 : 0

    // Render layers, skipping the farthest N based on dropLevel
    for (let i = skipCount; i < layers.length; i++) {
      const layer = layers[i]
      if (!layer.canvas) continue

      const savedAlpha = ctx.globalAlpha
      ctx.globalAlpha = layer.opacity

      const offset = (-cameraX * layer.scrollFactor) % layer.width
      const drawX = offset < 0 ? offset + layer.width : offset

      ctx.drawImage(layer.canvas as unknown as CanvasImageSource, drawX - layer.width, layer.yOffset)
      ctx.drawImage(layer.canvas as unknown as CanvasImageSource, drawX, layer.yOffset)

      ctx.globalAlpha = savedAlpha
    }
  }

  // 3. Record frame timing
  endFrameTiming(state.frameBudget, start)
}

// ---------------------------------------------------------------------------
// 8. Phase 3 — Palette-Cycled Element Rendering
// ---------------------------------------------------------------------------
//
// These functions render water, lava, fire, and sky using the indexed palette
// colors directly. As tickPaletteCycles rotates the palette entries, the
// visuals animate with ZERO new frames — pure Mark Ferrari technique.

/**
 * Convert a packed RGBA uint32 to a CSS rgba() string.
 * Used by all palette-cycled renderers to set ctx.fillStyle.
 */
function paletteToCSS(palette: RomPalette, index: number): string {
  const [r, g, b, a] = unpackRGBA(palette.colors[index])
  return `rgba(${r},${g},${b},${a / 255})`
}

/**
 * renderWaterSurface — Draws an animated water body using palette cycling colors.
 *
 * Draws horizontal strips where each strip uses a different palette index from
 * the water range (32-47). As tickPaletteCycles rotates indices 32-39 and 40-47,
 * the strips shift color — creating flowing water animation with ZERO new frames.
 *
 * The water surface includes sine-wave distortion for a ripple effect and
 * highlight bands at the top for specular reflection.
 */
export function renderWaterSurface(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  width: number,
  height: number,
  palette: RomPalette,
  frame: number,
): void {
  const stripCount = 16 // palette indices 32-47
  const stripH = Math.max(1, Math.ceil(height / stripCount))

  for (let i = 0; i < stripCount; i++) {
    const paletteIdx = 32 + i
    const stripY = y + i * stripH

    // Skip strips that are off-screen
    if (stripY + stripH < y || stripY > y + height) continue

    // Sine-wave horizontal offset per strip — ripple effect
    const waveOffset = Math.sin((frame * 0.15) + (i * 0.8)) * 3

    ctx.fillStyle = paletteToCSS(palette, paletteIdx)

    // Clamp strip height to not exceed the water body bounds
    const clampedH = Math.min(stripH, (y + height) - stripY)
    ctx.fillRect(x + waveOffset, stripY, width, clampedH)
  }

  // Specular highlights: thin white-ish lines near the top using the brightest
  // water palette entries (indices 38-39 are the bright end of the surface cycle)
  const savedAlpha = ctx.globalAlpha
  ctx.globalAlpha = 0.25
  for (let h = 0; h < 3; h++) {
    const highlightY = y + h * 2 + Math.sin(frame * 0.2 + h) * 1.5
    // Use surface-cycle bright indices
    ctx.fillStyle = paletteToCSS(palette, 38 + (h % 2))
    ctx.fillRect(x, highlightY, width, 1)
  }
  ctx.globalAlpha = savedAlpha
}

/**
 * renderLavaPool — Draws animated lava using palette cycling + dithering.
 *
 * Uses palette range 64-79 (lava). The dithered checkerboard pattern makes
 * adjacent pixels use offset palette indices, so when the palette cycles in
 * pingpong mode the lava appears to bubble and pulse.
 */
export function renderLavaPool(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  width: number,
  height: number,
  palette: RomPalette,
  frame: number,
): void {
  // Pixel size for the dither grid — 4px blocks for performance at 1280x720
  const blockSize = 4
  const cols = Math.ceil(width / blockSize)
  const rows = Math.ceil(height / blockSize)

  for (let row = 0; row < rows; row++) {
    for (let col = 0; col < cols; col++) {
      // Dithered checkerboard: offset palette index by 1 on alternate cells
      const dither = ((row + col) & 1)

      // Map row position to lava palette range (64-79, 16 entries)
      // Add a slow vertical wave so the lava appears to churn
      const waveShift = Math.sin((frame * 0.1) + (row * 0.3) + (col * 0.05)) * 2
      const baseIdx = Math.floor((row / rows) * 8) // 0-7 within lava range
      const paletteIdx = 64 + ((baseIdx + dither + Math.round(Math.abs(waveShift))) % 16)

      ctx.fillStyle = paletteToCSS(palette, paletteIdx)
      const bx = x + col * blockSize
      const by = y + row * blockSize
      const bw = Math.min(blockSize, (x + width) - bx)
      const bh = Math.min(blockSize, (y + height) - by)
      ctx.fillRect(bx, by, bw, bh)
    }
  }

  // Lava glow: bright emission along the top surface
  const savedAlpha = ctx.globalAlpha
  ctx.globalAlpha = 0.4
  const glowH = Math.min(6, height)
  for (let g = 0; g < glowH; g++) {
    // Use the hot end of the lava palette (indices 71-73 are the bright orange/yellow)
    const glowIdx = 64 + 7 + (g % 4) // 71-74
    ctx.fillStyle = paletteToCSS(palette, Math.min(glowIdx, 79))
    ctx.globalAlpha = 0.4 - (g * 0.06)
    ctx.fillRect(x, y + g, width, 1)
  }
  ctx.globalAlpha = savedAlpha
}

/**
 * renderCycledSky — Draws animated sky using palette range 112-127 during
 * sunset/dawn for color shifting. During day/night, renders a subtle gradient
 * overlay using the sky palette.
 *
 * The sky palette has 16 entries from deep blue to light horizon. During
 * sunset/dawn the cycling rotates these entries, creating a smooth color shift
 * across the sky height.
 */
export function renderCycledSky(
  ctx: CanvasRenderingContext2D,
  width: number,
  skyHeight: number,
  palette: RomPalette,
  timeOfDay: string,
): void {
  // Number of palette entries in the sky range
  const skyEntries = 16 // indices 112-127
  const bandH = Math.max(1, Math.ceil(skyHeight / skyEntries))

  for (let i = 0; i < skyEntries; i++) {
    const paletteIdx = 112 + i
    const bandY = i * bandH

    if (bandY >= skyHeight) break

    ctx.fillStyle = paletteToCSS(palette, paletteIdx)
    const clampedH = Math.min(bandH, skyHeight - bandY)
    ctx.fillRect(0, bandY, width, clampedH)
  }

  // For sunset/dawn, add a warm overlay tint that intensifies near the horizon
  if (timeOfDay === 'sunset' || timeOfDay === 'dawn') {
    const savedAlpha = ctx.globalAlpha
    for (let i = 0; i < skyEntries; i++) {
      const t = i / (skyEntries - 1) // 0 at top, 1 at horizon
      const warmth = t * t * 0.3 // quadratic fade — stronger near horizon
      ctx.globalAlpha = warmth
      // Use the fire palette for warm tinting (144-159)
      const fireIdx = 144 + Math.floor(t * 6) // pull from the warm end
      ctx.fillStyle = paletteToCSS(palette, fireIdx)
      const bandY = i * bandH
      const clampedH = Math.min(bandH, skyHeight - bandY)
      ctx.fillRect(0, bandY, width, clampedH)
    }
    ctx.globalAlpha = savedAlpha
  }
}

/**
 * renderFireColumn — Draws animated fire using palette range 144-159.
 * Each column of the fire has a randomized height offset seeded by position,
 * and the palette cycling creates the flickering animation.
 */
export function renderFireColumn(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  width: number,
  height: number,
  palette: RomPalette,
  frame: number,
): void {
  const colWidth = 3 // 3px wide flame tongues
  const cols = Math.ceil(width / colWidth)

  for (let col = 0; col < cols; col++) {
    const cx = x + col * colWidth
    // Flame height varies per column using pseudo-random + time
    const seed = col * 7.13 + frame * 0.25
    const flameHeight = height * (0.5 + 0.5 * Math.abs(Math.sin(seed)))
    const strips = Math.ceil(flameHeight / 3)

    for (let s = 0; s < strips; s++) {
      // Bottom = hot (high palette index), top = cool (low index)
      const t = s / Math.max(strips - 1, 1)
      const paletteIdx = 144 + Math.floor((1 - t) * 12) // 156 at base, 144 at tip
      const sy = y + height - flameHeight + s * 3

      if (sy < y || sy >= y + height) continue

      ctx.fillStyle = paletteToCSS(palette, Math.min(paletteIdx, 159))
      ctx.fillRect(cx, sy, Math.min(colWidth, (x + width) - cx), 3)
    }
  }
}

/**
 * renderPaletteCycledElement — Master dispatcher. Draws a named element type
 * at the given position using the palette-cycled colors.
 *
 * Element types: 'water', 'lava', 'fire', 'sky'
 */
export function renderPaletteCycledElement(
  ctx: CanvasRenderingContext2D,
  element: 'water' | 'lava' | 'fire' | 'sky',
  x: number,
  y: number,
  width: number,
  height: number,
  palette: RomPalette,
  frame: number,
  timeOfDay: string = 'day',
): void {
  switch (element) {
    case 'water':
      renderWaterSurface(ctx, x, y, width, height, palette, frame)
      break
    case 'lava':
      renderLavaPool(ctx, x, y, width, height, palette, frame)
      break
    case 'fire':
      renderFireColumn(ctx, x, y, width, height, palette, frame)
      break
    case 'sky':
      renderCycledSky(ctx, width, height, palette, timeOfDay)
      break
  }
}

// ---------------------------------------------------------------------------
// 9. Tool Registration (kbot integration)
// ---------------------------------------------------------------------------

import { registerTool } from './index.js'

registerTool({
  name: 'rom_engine_init',
  description: 'Initialize the ROM-hack rendering engine with a biome and time of day. Returns engine state summary.',
  parameters: {
    biome: {
      type: 'string',
      description: 'Biome type: plains, forest, volcanic, desert, tundra, ocean',
      required: false,
      default: 'plains',
    },
    timeOfDay: {
      type: 'string',
      description: 'Time of day: night, day, sunset, dawn',
      required: false,
      default: 'day',
    },
  },
  tier: 'free',
  execute: async (args) => {
    const biome = (args.biome as string) || 'plains'
    const timeOfDay = (args.timeOfDay as string) || 'day'
    const state = initRomEngine(biome, timeOfDay)
    return JSON.stringify({
      biome: state.currentBiome,
      timeOfDay: state.currentTimeOfDay,
      paletteEntries: 256,
      activeCycles: state.cycles.length,
      hdmaLines: state.hdmaTable.length,
      parallaxLayers: state.parallax?.layers.length ?? 0,
      frameBudgetMs: state.frameBudget.budget,
    }, null, 2)
  },
})

registerTool({
  name: 'rom_engine_palette_info',
  description: 'Get information about the ROM engine palette layout and cycling ranges.',
  parameters: {},
  tier: 'free',
  execute: async () => {
    const palette = createPalette()
    const cycles = createDefaultCycles()

    const layout = {
      '0': 'transparent',
      '1-15': 'UI colors',
      '16-31': 'Grass',
      '32-47': 'Water (cycling)',
      '48-63': 'Stone',
      '64-79': 'Lava (cycling)',
      '80-95': 'Sand',
      '96-111': 'Snow/ice',
      '112-127': 'Sky',
      '128-143': 'Ore highlights (cycling)',
      '144-159': 'Fire (cycling)',
      '160-175': 'Aurora (cycling)',
      '176-191': 'Wood/leaves',
      '192-207': 'Brick/glass',
      '208-223': 'Decorative',
      '224-239': 'Star twinkle (cycling)',
      '240-255': 'Reserved',
    }

    const cycleInfo = cycles.map(c => ({
      range: `${c.start}-${c.end}`,
      speed: `${c.speed}ms`,
      mode: c.mode,
      direction: c.direction === 1 ? 'forward' : 'reverse',
    }))

    // Sample some colors
    const sampleColors: Record<string, string> = {}
    for (const idx of [0, 1, 16, 32, 48, 64, 80, 96, 112, 128, 144, 160, 176, 192, 208, 224]) {
      const [r, g, b, a] = unpackRGBA(palette.colors[idx])
      sampleColors[`[${idx}]`] = `rgba(${r},${g},${b},${a})`
    }

    return JSON.stringify({ layout, cycles: cycleInfo, sampleColors }, null, 2)
  },
})

registerTool({
  name: 'rom_engine_cycle_render',
  description: 'Render palette-cycled elements (water, lava, fire, sky) to a test PNG. Generates 6 sequential frames showing the palette cycling in action.',
  parameters: {
    outputDir: {
      type: 'string',
      description: 'Directory to save PNGs (default: /tmp)',
      required: false,
      default: '/tmp',
    },
    prefix: {
      type: 'string',
      description: 'Filename prefix (default: kbot-cycle)',
      required: false,
      default: 'kbot-cycle',
    },
  },
  tier: 'free',
  execute: async (args) => {
    const outDir = (args.outputDir as string) || '/tmp'
    const prefix = (args.prefix as string) || 'kbot-cycle'
    return await renderCycleTestFrames(outDir, prefix)
  },
})

/**
 * Render 6 test frames showing palette cycling for water, lava, fire, and sky.
 * Each frame advances the palette cycles by 100ms, demonstrating the animation.
 */
export async function renderCycleTestFrames(outDir: string, prefix: string): Promise<string> {
  try {
    const fs = await import('fs')
    const path = await import('path')
    // Dynamic import for optional 'canvas' dependency
    const canvasMod = await import('canvas')
    const createCanvas = canvasMod.createCanvas

    const W = 1280
    const H = 720
    const palette = createPalette()
    const cycles = createDefaultCycles()
    const frameCount = 6
    const deltaMs = 100 // ms between frames

    const files: string[] = []

    for (let f = 0; f < frameCount; f++) {
      const canvas = createCanvas(W, H)
      const ctx = canvas.getContext('2d') as unknown as CanvasRenderingContext2D

      // Clear to dark
      ctx.fillStyle = '#0a0a0a'
      ctx.fillRect(0, 0, W, H)

      // Layout: 4 quadrants
      // Top-left: Sky (sunset with cycling)
      // Top-right: Water surface
      // Bottom-left: Lava pool
      // Bottom-right: Fire columns

      const halfW = W / 2
      const halfH = H / 2
      const padding = 10

      // Labels
      ctx.fillStyle = '#FFFFFF'
      ctx.font = '16px monospace'

      // --- Top-left: Cycled Sky (sunset) ---
      ctx.fillText(`SKY (sunset, frame ${f + 1})`, padding + 4, 20)
      renderCycledSky(ctx, halfW - padding * 2, halfH - padding * 2 - 24, palette, 'sunset')
      // Translate the sky down a bit for the label
      ctx.save()
      ctx.translate(padding, 28)
      renderCycledSky(ctx, halfW - padding * 2, halfH - padding * 2 - 28, palette, 'sunset')
      ctx.restore()

      // --- Top-right: Water ---
      ctx.fillStyle = '#FFFFFF'
      ctx.fillText(`WATER (frame ${f + 1})`, halfW + padding + 4, 20)
      renderWaterSurface(
        ctx,
        halfW + padding,
        28,
        halfW - padding * 2,
        halfH - padding * 2 - 28,
        palette,
        f,
      )

      // --- Bottom-left: Lava ---
      ctx.fillStyle = '#FFFFFF'
      ctx.fillText(`LAVA (frame ${f + 1})`, padding + 4, halfH + 20)
      renderLavaPool(
        ctx,
        padding,
        halfH + 28,
        halfW - padding * 2,
        halfH - padding * 2 - 28,
        palette,
        f,
      )

      // --- Bottom-right: Fire ---
      ctx.fillStyle = '#FFFFFF'
      ctx.fillText(`FIRE (frame ${f + 1})`, halfW + padding + 4, halfH + 20)
      renderFireColumn(
        ctx,
        halfW + padding,
        halfH + 28,
        halfW - padding * 2,
        halfH - padding * 2 - 28,
        palette,
        f,
      )

      // Divider lines
      ctx.strokeStyle = '#404040'
      ctx.lineWidth = 1
      ctx.beginPath()
      ctx.moveTo(halfW, 0)
      ctx.lineTo(halfW, H)
      ctx.moveTo(0, halfH)
      ctx.lineTo(W, halfH)
      ctx.stroke()

      // Frame indicator
      ctx.fillStyle = '#6B5B95'
      ctx.font = 'bold 14px monospace'
      ctx.fillText(`PALETTE CYCLE FRAME ${f + 1}/${frameCount}  (${(f + 1) * deltaMs}ms elapsed)`, W - 400, H - 10)

      // Save PNG
      const filename = `${prefix}-${String(f + 1).padStart(3, '0')}.png`
      const filepath = path.join(outDir, filename)
      const buffer = canvas.toBuffer('image/png')
      fs.writeFileSync(filepath, buffer)
      files.push(filepath)

      // Advance palette cycles for next frame
      tickPaletteCycles(palette, cycles, deltaMs)
    }

    return JSON.stringify({
      success: true,
      frames: frameCount,
      deltaMs,
      files,
      message: `Rendered ${frameCount} palette cycle test frames. Water shimmers, lava pulses, fire flickers, sky shifts.`,
    }, null, 2)
  } catch (err) {
    return JSON.stringify({
      success: false,
      error: `Canvas rendering failed: ${err instanceof Error ? err.message : String(err)}. Install the "canvas" npm package for PNG output.`,
    }, null, 2)
  }
}
