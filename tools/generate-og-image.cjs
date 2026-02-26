// ─── OG Image Generator ──────────────────────────────────
//
// Pixel-accurate port of ParticleGrid.tsx to Node canvas.
// Produces a 1200×620 OG image with the exact same rendering:
// quantized CMYK layers, Bresenham links, blendQuantized cells.
//
// Usage: node tools/generate-og-image.cjs

const { createCanvas } = require('canvas')
const fs = require('fs')
const path = require('path')

// ── Match ParticleGrid.tsx constants exactly ──

const CELL = 20
const W = 1200
const H = Math.floor(630 / CELL) * CELL  // 620 — snaps to cell grid
const COLS = W / CELL                     // 60
const ROWS = H / CELL                     // 31
const BIT_DEPTH = 8
const PARTICLE_COUNT = 55
const GRAVITY = 0.006
const DAMPING = 0.985
const PRESSURE_RADIUS = 4.5
const PRESSURE_STRENGTH = 0.08
const VISCOSITY = 0.04
const SUB_STEPS = 3

const PAL = {
  bg:      '#FAF9F6',
  gridMin: '#E8E6DC',
  gridMaj: '#D4C5A9',
  particle: '#6B5B95',
  link:    '#A0768C',
  field:   '#B8875C',
  key:     '#1F1E1D',
}

// ── Helpers (ported from ParticleGrid.tsx) ──

function hexRgb(hex) {
  return [parseInt(hex.slice(1, 3), 16), parseInt(hex.slice(3, 5), 16), parseInt(hex.slice(5, 7), 16)]
}

function quantize(val, steps) {
  return Math.round(val * steps) / steps
}

function blendQuantized(srcRgb, alpha, bgRgb) {
  const qa = quantize(Math.min(Math.max(alpha, 0), 1), BIT_DEPTH)
  if (qa <= 0) return null
  const r = Math.round(srcRgb[0] * qa + bgRgb[0] * (1 - qa))
  const g = Math.round(srcRgb[1] * qa + bgRgb[1] * (1 - qa))
  const b = Math.round(srcRgb[2] * qa + bgRgb[2] * (1 - qa))
  return `rgb(${r},${g},${b})`
}

function seedRandom(seed) {
  let s = seed
  return () => {
    s = (s * 16807 + 0) % 2147483647
    return (s - 1) / 2147483646
  }
}

// ── Particle creation & physics (ported exactly) ──

const rand = seedRandom(42)

function createParticle() {
  return {
    gx: rand() * COLS * 0.6 + COLS * 0.2,
    gy: rand() * ROWS * 0.5 + ROWS * 0.15,
    vx: (rand() - 0.5) * 0.05,
    vy: (rand() - 0.5) * 0.05,
  }
}

function updateParticle(p, all) {
  p.vy += GRAVITY
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
  p.vx *= DAMPING
  p.vy *= DAMPING
  p.gx += p.vx
  p.gy += p.vy
  if (p.gx < 0.5) { p.gx = 0.5; p.vx *= -0.3 }
  if (p.gx > COLS - 0.5) { p.gx = COLS - 0.5; p.vx *= -0.3 }
  if (p.gy < 0.5) { p.gy = 0.5; p.vy *= -0.3 }
  if (p.gy > ROWS - 0.5) { p.gy = ROWS - 0.5; p.vy *= -0.3 }
}

// ── Simulate ──

const particles = Array.from({ length: PARTICLE_COUNT }, () => createParticle())

// Run ~200 frames of physics so particles settle naturally
for (let frame = 0; frame < 200; frame++) {
  for (let step = 0; step < SUB_STEPS; step++) {
    for (const p of particles) {
      updateParticle(p, particles)
    }
  }
}

// ── Render (pixel-accurate port of draw loop) ──

const canvas = createCanvas(W, H)
const ctx = canvas.getContext('2d')

// 1. Grid background (matches buildGridImage)
ctx.fillStyle = PAL.bg
ctx.fillRect(0, 0, W, H)

// Minor grid
ctx.strokeStyle = PAL.gridMin
ctx.lineWidth = 0.5
ctx.beginPath()
for (let x = 0; x <= COLS; x++) { ctx.moveTo(x * CELL, 0); ctx.lineTo(x * CELL, H) }
for (let y = 0; y <= ROWS; y++) { ctx.moveTo(0, y * CELL); ctx.lineTo(W, y * CELL) }
ctx.stroke()

// Major grid (every 5 cells)
ctx.strokeStyle = PAL.gridMaj
ctx.lineWidth = 1
ctx.beginPath()
for (let x = 0; x <= COLS; x += 5) { ctx.moveTo(x * CELL, 0); ctx.lineTo(x * CELL, H) }
for (let y = 0; y <= ROWS; y += 5) { ctx.moveTo(0, y * CELL); ctx.lineTo(W, y * CELL) }
ctx.stroke()

// Registration marks — crosshair + circle (matches ParticleGrid exactly)
const regM = 14
ctx.strokeStyle = PAL.key
ctx.lineWidth = 0.8
for (const [rx, ry] of [[regM, regM], [W - regM, regM], [regM, H - regM], [W - regM, H - regM]]) {
  ctx.beginPath(); ctx.moveTo(rx - 5, ry); ctx.lineTo(rx + 5, ry); ctx.moveTo(rx, ry - 5); ctx.lineTo(rx, ry + 5); ctx.stroke()
  ctx.beginPath(); ctx.arc(rx, ry, 3.5, 0, Math.PI * 2); ctx.stroke()
}

// Color bar (centered at bottom)
const bw = 20, bh = 4, by = H - 10
;[PAL.particle, PAL.link, PAL.field, PAL.key].forEach((cl, i) => {
  ctx.fillStyle = cl
  ctx.fillRect(W / 2 - 50 + i * (bw + 3), by, bw, bh)
})

// 2. Build density arrays (matches draw loop exactly)
const bgRgb = hexRgb(PAL.bg)
const linkRgb = hexRgb(PAL.link)
const fieldRgb = hexRgb(PAL.field)

const fieldA = new Float32Array(COLS * ROWS)
const partA = new Float32Array(COLS * ROWS)
const linkArr = new Float32Array(COLS * ROWS)

// Density field
const fieldR = 3
const fieldRMax = fieldR + 0.5
for (const p of particles) {
  const cx = Math.round(p.gx), cy = Math.round(p.gy)
  for (let dy = -fieldR; dy <= fieldR; dy++) {
    for (let dx = -fieldR; dx <= fieldR; dx++) {
      const nx = cx + dx, ny = cy + dy
      if (nx < 0 || nx >= COLS || ny < 0 || ny >= ROWS) continue
      const d = Math.sqrt(dx * dx + dy * dy)
      if (d < fieldRMax) fieldA[ny * COLS + nx] += Math.max(0, (1 - d / fieldRMax) * 0.35)
    }
  }
}

// Particle cells
for (const p of particles) {
  const cx = Math.round(p.gx), cy = Math.round(p.gy)
  if (cx >= 0 && cx < COLS && cy >= 0 && cy < ROWS) partA[cy * COLS + cx] = 1.0
}

// Link cells (Bresenham rasterization, matches ParticleGrid exactly)
const linkMax = 5
for (let i = 0; i < particles.length; i++) {
  const a = particles[i]
  const acx = Math.round(a.gx), acy = Math.round(a.gy)
  for (let j = i + 1; j < particles.length; j++) {
    const b = particles[j]
    const bcx = Math.round(b.gx), bcy = Math.round(b.gy)
    const ddx = Math.abs(bcx - acx), ddy = Math.abs(bcy - acy)
    const manhattan = ddx + ddy
    if (manhattan > linkMax || manhattan < 2) continue
    const euclidean = Math.sqrt(ddx * ddx + ddy * ddy)
    if (euclidean > linkMax) continue
    const strength = (1 - euclidean / (linkMax + 0.5)) * 0.6
    const lineSteps = Math.max(ddx, ddy)
    for (let t = 0; t <= lineSteps; t++) {
      const frac = lineSteps === 0 ? 0 : t / lineSteps
      const lx = Math.round(acx + (bcx - acx) * frac)
      const ly = Math.round(acy + (bcy - acy) * frac)
      if (lx >= 0 && lx < COLS && ly >= 0 && ly < ROWS) {
        linkArr[ly * COLS + lx] = Math.max(linkArr[ly * COLS + lx], strength)
      }
    }
  }
}

// 3. Render cells (matches draw loop exactly)
for (let y = 0; y < ROWS; y++) {
  for (let x = 0; x < COLS; x++) {
    const idx = y * COLS + x
    const px = x * CELL, py = y * CELL

    if (fieldA[idx] > 0.02) {
      const c = blendQuantized(fieldRgb, fieldA[idx] * 0.4, bgRgb)
      if (c) { ctx.fillStyle = c; ctx.fillRect(px, py, CELL, CELL) }
    }
    if (linkArr[idx] > 0.02 && partA[idx] < 0.5) {
      const c = blendQuantized(linkRgb, linkArr[idx] * 0.5, bgRgb)
      if (c) { ctx.fillStyle = c; ctx.fillRect(px, py, CELL, CELL) }
    }
    if (partA[idx] > 0.5) {
      ctx.fillStyle = PAL.particle
      ctx.fillRect(px, py, CELL, CELL)
      const inset = Math.max(1, Math.floor(CELL / 3))  // 6px
      ctx.fillStyle = PAL.key
      ctx.fillRect(px + inset, py + inset, CELL - inset * 2, CELL - inset * 2)
    }
  }
}

// 4. Branding overlay — "Kernel" + tagline with ivory text shadow
ctx.textAlign = 'center'
ctx.textBaseline = 'middle'

const titleY = H * 0.38
const tagY = H * 0.52

// Ivory shadow behind text for legibility
ctx.fillStyle = 'rgba(250,249,246,0.92)'
ctx.font = '700 76px Georgia, serif'
for (let ox = -3; ox <= 3; ox++) {
  for (let oy = -3; oy <= 3; oy++) {
    ctx.fillText('Kernel', W / 2 + ox, titleY + oy)
  }
}
ctx.font = '400 22px "Courier New", monospace'
for (let ox = -2; ox <= 2; ox++) {
  for (let oy = -2; oy <= 2; oy++) {
    ctx.fillText('AI That Learns You', W / 2 + ox, tagY + oy)
  }
}

// Actual text
ctx.fillStyle = PAL.key
ctx.font = '700 76px Georgia, serif'
ctx.fillText('Kernel', W / 2, titleY)

ctx.fillStyle = PAL.particle
ctx.font = '400 22px "Courier New", monospace'
ctx.fillText('AI That Learns You', W / 2, tagY)

// ── Write output ──

const outPath = path.join(__dirname, '..', 'public', 'og-image.png')
const buffer = canvas.toBuffer('image/png')
fs.writeFileSync(outPath, buffer)
console.log(`OG image written to ${outPath} (${(buffer.length / 1024).toFixed(1)} KB)`)
console.log(`Dimensions: ${W}×${H}, Cell: ${CELL}px, Grid: ${COLS}×${ROWS}, Particles: ${PARTICLE_COUNT}`)
