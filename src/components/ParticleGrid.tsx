// ─── ParticleGrid — CMYK Particle Simulation ───────────────
//
// Canvas-based fluid particle system on a print-style grid.
// Physics: gravity, pressure, viscosity, mouse repulsion.
// Renders quantized CMYK layers (yellow field, magenta links, cyan particles).

import { useRef, useEffect, useCallback } from 'react'

const CELL = 20
const BIT_DEPTH = 8
const PARTICLE_COUNT = 55
const GRAVITY = 0.006
const DAMPING = 0.985
const PRESSURE_RADIUS = 4.5
const PRESSURE_STRENGTH = 0.08
const VISCOSITY = 0.04
const MOUSE_RADIUS = 7
const MOUSE_FORCE = 0.05
const SUB_STEPS = 3

// Rubin palette — matches Kernel's visual identity
const PAL_LIGHT = {
  bg:      '#FAF9F6',  // --rubin-ivory
  gridMin: '#E8E6DC',  // --rubin-ivory-dark
  gridMaj: '#D4C5A9',  // --rubin-sepia
  particle: '#6B5B95', // --agent-kernel (amethyst)
  link:    '#A0768C',  // --agent-analyst (mauve)
  field:   '#B8875C',  // --agent-writer (warm brown)
  key:     '#1F1E1D',  // --rubin-slate
}

const PAL_DARK = {
  bg:      '#1C1A18',  // --dark-bg
  gridMin: '#262320',  // --dark-bg-elevated
  gridMaj: '#36322E',  // --dark-border
  particle: '#8B7BB5', // amethyst lightened for dark bg
  link:    '#C096AC',  // mauve lightened
  field:   '#D4A774',  // warm brown lightened
  key:     '#e8e6e3',  // --dark-text
}

type Palette = typeof PAL_LIGHT

function isDarkMode(): boolean {
  return document.documentElement.getAttribute('data-theme') === 'dark'
}

function getPal(): Palette {
  return isDarkMode() ? PAL_DARK : PAL_LIGHT
}

function hexRgb(hex: string): [number, number, number] {
  return [parseInt(hex.slice(1, 3), 16), parseInt(hex.slice(3, 5), 16), parseInt(hex.slice(5, 7), 16)]
}

function getPalRgb(pal: Palette) {
  return {
    linkRgb: hexRgb(pal.link),
    fieldRgb: hexRgb(pal.field),
    bgRgb: hexRgb(pal.bg),
  }
}

function quantize(val: number, steps: number): number {
  return Math.round(val * steps) / steps
}

function blendQuantized(srcRgb: [number, number, number], alpha: number, bg: [number, number, number]): string | null {
  const qa = quantize(Math.min(Math.max(alpha, 0), 1), BIT_DEPTH)
  if (qa <= 0) return null
  const r = Math.round(srcRgb[0] * qa + bg[0] * (1 - qa))
  const g = Math.round(srcRgb[1] * qa + bg[1] * (1 - qa))
  const b = Math.round(srcRgb[2] * qa + bg[2] * (1 - qa))
  return `rgb(${r},${g},${b})`
}

interface Particle {
  gx: number; gy: number
  vx: number; vy: number
}

function createParticle(cols: number, rows: number): Particle {
  return {
    gx: Math.random() * cols * 0.6 + cols * 0.2,
    gy: Math.random() * rows * 0.5 + rows * 0.15,
    vx: (Math.random() - 0.5) * 0.05,
    vy: (Math.random() - 0.5) * 0.05,
  }
}

function updateParticle(
  p: Particle, all: Particle[], cols: number, rows: number,
  mouseGx: number, mouseGy: number, mouseActive: boolean,
  gravity = GRAVITY, damping = DAMPING,
) {
  p.vy += gravity
  for (const o of all) {
    if (o === p) continue
    const dx = o.gx - p.gx, dy = o.gy - p.gy
    const d2 = dx * dx + dy * dy
    if (d2 < PRESSURE_RADIUS * PRESSURE_RADIUS && d2 > 0.001) {
      const d = Math.sqrt(d2)
      const f = (1 - d / PRESSURE_RADIUS) * PRESSURE_STRENGTH
      const nx = dx / d, ny = dy / d
      p.vx -= nx * f
      p.vy -= ny * f
      p.vx += (o.vx - p.vx) * VISCOSITY
      p.vy += (o.vy - p.vy) * VISCOSITY
    }
  }
  if (mouseActive) {
    const dx = p.gx - mouseGx, dy = p.gy - mouseGy
    const d2 = dx * dx + dy * dy
    if (d2 < MOUSE_RADIUS * MOUSE_RADIUS && d2 > 0.01) {
      const d = Math.sqrt(d2)
      const falloff = 1 - d / MOUSE_RADIUS
      p.vx += (dx / d) * MOUSE_FORCE * falloff
      p.vy += (dy / d) * MOUSE_FORCE * falloff
    }
  }
  p.vx *= damping
  p.vy *= damping
  p.gx += p.vx
  p.gy += p.vy
  if (p.gx < 0.5) { p.gx = 0.5; p.vx *= -0.3 }
  if (p.gx > cols - 0.5) { p.gx = cols - 0.5; p.vx *= -0.3 }
  if (p.gy < 0.5) { p.gy = 0.5; p.vy *= -0.3 }
  if (p.gy > rows - 0.5) { p.gy = rows - 0.5; p.vy *= -0.3 }
}

function buildGridImage(size: number, cols: number, rows: number, pal: Palette, cell: number): HTMLCanvasElement {
  const c = document.createElement('canvas')
  c.width = size; c.height = size
  const g = c.getContext('2d')!
  g.fillStyle = pal.bg
  g.fillRect(0, 0, size, size)
  // Minor grid
  g.strokeStyle = pal.gridMin; g.lineWidth = cell < 8 ? 0.2 : 0.5; g.beginPath()
  for (let x = 0; x <= cols; x++) { g.moveTo(x * cell, 0); g.lineTo(x * cell, size) }
  for (let y = 0; y <= rows; y++) { g.moveTo(0, y * cell); g.lineTo(size, y * cell) }
  g.stroke()
  // Major grid
  g.strokeStyle = pal.gridMaj; g.lineWidth = cell < 8 ? 0.3 : 1; g.beginPath()
  const majStep = cell < 8 ? 10 : 5
  for (let x = 0; x <= cols; x += majStep) { g.moveTo(x * cell, 0); g.lineTo(x * cell, size) }
  for (let y = 0; y <= rows; y += majStep) { g.moveTo(0, y * cell); g.lineTo(size, y * cell) }
  g.stroke()
  // Registration marks (skip for small grids)
  if (cell >= 8) {
    const m = 14
    g.strokeStyle = pal.key; g.lineWidth = 0.8
    for (const [x, y] of [[m, m], [size - m, m], [m, size - m], [size - m, size - m]]) {
      g.beginPath(); g.moveTo(x - 5, y); g.lineTo(x + 5, y); g.moveTo(x, y - 5); g.lineTo(x, y + 5); g.stroke()
      g.beginPath(); g.arc(x, y, 3.5, 0, Math.PI * 2); g.stroke()
    }
    // Color bar
    const bw = 20, bh = 4, by = size - 10
    ;[pal.particle, pal.link, pal.field, pal.key].forEach((cl, i) => {
      g.fillStyle = cl
      g.fillRect(size / 2 - 50 + i * (bw + 3), by, bw, bh)
    })
  }
  return c
}

interface ParticleGridProps {
  palette?: { particle: string; link: string; field: string }
  size?: number
  interactive?: boolean
  energetic?: boolean
}

export function ParticleGrid({ palette: paletteProp, size: sizeProp, interactive = true, energetic = false }: ParticleGridProps = {}) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const propsRef = useRef({ paletteProp, energetic })
  propsRef.current = { paletteProp, energetic }

  const stateRef = useRef<{
    particles: Particle[]
    gridImage: HTMLCanvasElement | null
    pal: Palette
    cell: number
    cols: number; rows: number; size: number
    mouseGx: number; mouseGy: number; mouseActive: boolean
    raf: number
  }>({
    particles: [], gridImage: null,
    pal: getPal(),
    cell: CELL,
    cols: 0, rows: 0, size: 0,
    mouseGx: -100, mouseGy: -100, mouseActive: false,
    raf: 0,
  })

  const setup = useCallback(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const container = canvas.parentElement
    if (!container) return
    const maxSize = sizeProp || 400
    // Adaptive cell size: tiny grids get 4px, loading grids get 10px, full gets 20px
    const cell = maxSize <= 80 ? 4 : maxSize <= 120 ? 6 : maxSize <= 300 ? 10 : CELL
    const raw = Math.min(container.clientWidth, container.clientHeight, maxSize)
    const size = Math.floor(raw / cell) * cell
    if (size < cell) return
    canvas.width = size; canvas.height = size
    const cols = size / cell, rows = size / cell
    const s = stateRef.current
    s.pal = getPal()
    s.cell = cell
    s.cols = cols; s.rows = rows; s.size = size
    s.gridImage = buildGridImage(size, cols, rows, s.pal, cell)
    const count = Math.min(PARTICLE_COUNT, Math.max(10, Math.floor(cols * rows * 0.4)))
    const boost = cell < CELL ? 0.6 : 0.05
    s.particles = Array.from({ length: count }, () => ({
      ...createParticle(cols, rows),
      vx: (Math.random() - 0.5) * boost,
      vy: (Math.random() - 0.5) * boost,
    }))
  }, [sizeProp])

  useEffect(() => {
    setup()
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return
    const s = stateRef.current

    const cleanups: (() => void)[] = []

    if (interactive) {
      const onMove = (e: MouseEvent) => {
        const r = canvas.getBoundingClientRect()
        s.mouseGx = (e.clientX - r.left) / s.cell
        s.mouseGy = (e.clientY - r.top) / s.cell
        s.mouseActive = true
      }
      const onLeave = () => { s.mouseActive = false }
      const onTouch = (e: TouchEvent) => {
        e.preventDefault()
        const r = canvas.getBoundingClientRect()
        s.mouseGx = (e.touches[0].clientX - r.left) / s.cell
        s.mouseGy = (e.touches[0].clientY - r.top) / s.cell
        s.mouseActive = true
      }
      const onTouchEnd = () => { s.mouseActive = false }

      canvas.addEventListener('mousemove', onMove)
      canvas.addEventListener('mouseleave', onLeave)
      canvas.addEventListener('touchmove', onTouch, { passive: false })
      canvas.addEventListener('touchend', onTouchEnd)
      cleanups.push(() => {
        canvas.removeEventListener('mousemove', onMove)
        canvas.removeEventListener('mouseleave', onLeave)
        canvas.removeEventListener('touchmove', onTouch)
        canvas.removeEventListener('touchend', onTouchEnd)
      })
    }

    const draw = () => {
      if (!s.gridImage || s.cols === 0) { s.raf = requestAnimationFrame(draw); return }
      const cell = s.cell

      // Detect theme changes and rebuild grid
      const currentPal = getPal()
      if (currentPal.bg !== s.pal.bg) {
        s.pal = currentPal
        s.gridImage = buildGridImage(s.size, s.cols, s.rows, s.pal, cell)
      }

      // Apply palette overrides from props
      const { paletteProp: pp, energetic: en } = propsRef.current
      const drawPal = pp
        ? { ...s.pal, particle: pp.particle, link: pp.link, field: pp.field }
        : s.pal

      ctx.drawImage(s.gridImage, 0, 0)

      const gravity = en ? GRAVITY * 15 : GRAVITY
      const damping = en ? 0.998 : DAMPING
      const subSteps = en ? SUB_STEPS * 3 : SUB_STEPS
      for (let step = 0; step < subSteps; step++) {
        for (const p of s.particles) {
          updateParticle(p, s.particles, s.cols, s.rows, s.mouseGx, s.mouseGy, s.mouseActive, gravity, damping)
        }
      }

      const { cols, rows } = s
      const { linkRgb: lr, fieldRgb: fr, bgRgb: br } = getPalRgb(drawPal)
      const fieldA = new Float32Array(cols * rows)
      const partA = new Float32Array(cols * rows)
      const linkA = new Float32Array(cols * rows)

      // Density field
      for (const p of s.particles) {
        const cx = Math.round(p.gx), cy = Math.round(p.gy)
        for (let dy = -3; dy <= 3; dy++) {
          for (let dx = -3; dx <= 3; dx++) {
            const nx = cx + dx, ny = cy + dy
            if (nx < 0 || nx >= cols || ny < 0 || ny >= rows) continue
            const d = Math.sqrt(dx * dx + dy * dy)
            if (d < 3.5) fieldA[ny * cols + nx] += Math.max(0, (1 - d / 3.5) * 0.35)
          }
        }
      }

      // Particle cells
      for (const p of s.particles) {
        const cx = Math.round(p.gx), cy = Math.round(p.gy)
        if (cx >= 0 && cx < cols && cy >= 0 && cy < rows) partA[cy * cols + cx] = 1.0
      }

      // Link cells
      for (let i = 0; i < s.particles.length; i++) {
        const a = s.particles[i]
        const acx = Math.round(a.gx), acy = Math.round(a.gy)
        for (let j = i + 1; j < s.particles.length; j++) {
          const b = s.particles[j]
          const bcx = Math.round(b.gx), bcy = Math.round(b.gy)
          const ddx = Math.abs(bcx - acx), ddy = Math.abs(bcy - acy)
          const manhattan = ddx + ddy
          if (manhattan > 5 || manhattan < 2) continue
          const euclidean = Math.sqrt(ddx * ddx + ddy * ddy)
          if (euclidean > 5) continue
          const strength = (1 - euclidean / 5.5) * 0.6
          const lineSteps = Math.max(ddx, ddy)
          for (let t = 0; t <= lineSteps; t++) {
            const frac = lineSteps === 0 ? 0 : t / lineSteps
            const lx = Math.round(acx + (bcx - acx) * frac)
            const ly = Math.round(acy + (bcy - acy) * frac)
            if (lx >= 0 && lx < cols && ly >= 0 && ly < rows) {
              linkA[ly * cols + lx] = Math.max(linkA[ly * cols + lx], strength)
            }
          }
        }
      }

      // Render cells
      for (let y = 0; y < rows; y++) {
        for (let x = 0; x < cols; x++) {
          const idx = y * cols + x
          const px = x * cell, py = y * cell

          if (fieldA[idx] > 0.02) {
            const c = blendQuantized(fr, fieldA[idx] * 0.4, br)
            if (c) { ctx.fillStyle = c; ctx.fillRect(px, py, cell, cell) }
          }
          if (linkA[idx] > 0.02 && partA[idx] < 0.5) {
            const c = blendQuantized(lr, linkA[idx] * 0.5, br)
            if (c) { ctx.fillStyle = c; ctx.fillRect(px, py, cell, cell) }
          }
          if (partA[idx] > 0.5) {
            ctx.fillStyle = drawPal.particle
            ctx.fillRect(px, py, cell, cell)
            const inset = Math.max(1, Math.floor(cell / 3))
            ctx.fillStyle = drawPal.key
            ctx.fillRect(px + inset, py + inset, cell - inset * 2, cell - inset * 2)
          }
        }
      }

      s.raf = requestAnimationFrame(draw)
    }

    s.raf = requestAnimationFrame(draw)

    const onResize = () => { setup() }
    window.addEventListener('resize', onResize)

    return () => {
      cancelAnimationFrame(s.raf)
      cleanups.forEach(fn => fn())
      window.removeEventListener('resize', onResize)
    }
  }, [setup, interactive])

  return (
    <div className="ka-particle-grid">
      <canvas
        ref={canvasRef}
        style={{ display: 'block', imageRendering: 'pixelated' }}
      />
    </div>
  )
}
