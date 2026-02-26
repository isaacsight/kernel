// ─── OG Image Generator ──────────────────────────────────
//
// Generates a 1200x630 OG preview image replicating the
// ParticleGrid aesthetic: CMYK-style layered rendering with
// amethyst particles, mauve links, warm brown field halos,
// and the print-style quantized grid background.
//
// Usage: node tools/generate-og-image.cjs

const { createCanvas } = require('canvas')
const fs = require('fs')
const path = require('path')

const W = 1200
const H = 630
const CELL = 16
const COLS = Math.floor(W / CELL)
const ROWS = Math.floor(H / CELL)
const PARTICLE_COUNT = 140
const LINK_DIST = 7 // in cells
const FIELD_RADIUS = 6 // in cells

// Rubin palette
const IVORY = '#FAF9F6'
const GRID_MINOR = '#E8E6DC'
const GRID_MAJOR = '#D4C5A9'
const SLATE = '#1F1E1D'
const AMETHYST = '#6B5B95'
const MAUVE = '#A0768C'
const WARM_BROWN = '#B8875C'

// ── Helpers ──

function hexToRgb(hex) {
  const r = parseInt(hex.slice(1, 3), 16)
  const g = parseInt(hex.slice(3, 5), 16)
  const b = parseInt(hex.slice(5, 7), 16)
  return { r, g, b }
}

function seedRandom(seed) {
  let s = seed
  return () => {
    s = (s * 16807 + 0) % 2147483647
    return (s - 1) / 2147483646
  }
}

// ── Particle simulation ──

function generateParticles(rand) {
  const particles = []
  for (let i = 0; i < PARTICLE_COUNT; i++) {
    // Wide spread across full canvas, gentle center bias
    const cx = COLS / 2
    const cy = ROWS / 2
    const spreadX = COLS * 0.48
    const spreadY = ROWS * 0.48
    const x = cx + (rand() - 0.5 + rand() - 0.5 + rand() - 0.5) * spreadX * 0.67
    const y = cy + (rand() - 0.5 + rand() - 0.5 + rand() - 0.5) * spreadY * 0.67
    particles.push({
      x: Math.max(2, Math.min(COLS - 3, x)),
      y: Math.max(2, Math.min(ROWS - 3, y)),
    })
  }
  return particles
}

function simulate(particles, rand, steps) {
  // No gravity — pressure-only simulation for even spread
  const damping = 0.98
  const pressureRadius = 4.0
  const pressureStrength = 0.08

  const vx = new Float32Array(particles.length)
  const vy = new Float32Array(particles.length)

  for (let step = 0; step < steps; step++) {
    for (let i = 0; i < particles.length; i++) {
      // Pressure from neighbors (repulsion only — keeps them spread)
      for (let j = i + 1; j < particles.length; j++) {
        const dx = particles[j].x - particles[i].x
        const dy = particles[j].y - particles[i].y
        const dist = Math.sqrt(dx * dx + dy * dy)
        if (dist < pressureRadius && dist > 0.01) {
          const force = pressureStrength * (1 - dist / pressureRadius)
          const fx = (dx / dist) * force
          const fy = (dy / dist) * force
          vx[i] -= fx
          vy[i] -= fy
          vx[j] += fx
          vy[j] += fy
        }
      }

      vx[i] *= damping
      vy[i] *= damping
      particles[i].x += vx[i]
      particles[i].y += vy[i]

      // Boundary bounce
      if (particles[i].x < 2) { particles[i].x = 2; vx[i] *= -0.7 }
      if (particles[i].x > COLS - 3) { particles[i].x = COLS - 3; vx[i] *= -0.7 }
      if (particles[i].y < 2) { particles[i].y = 2; vy[i] *= -0.7 }
      if (particles[i].y > ROWS - 3) { particles[i].y = ROWS - 3; vy[i] *= -0.7 }
    }
  }

  return particles
}

// ── Rendering ──

function render(canvas, ctx, particles) {
  // Background
  ctx.fillStyle = IVORY
  ctx.fillRect(0, 0, W, H)

  // Minor grid
  ctx.strokeStyle = GRID_MINOR
  ctx.lineWidth = 0.5
  for (let c = 0; c <= COLS; c++) {
    ctx.beginPath()
    ctx.moveTo(c * CELL, 0)
    ctx.lineTo(c * CELL, H)
    ctx.stroke()
  }
  for (let r = 0; r <= ROWS; r++) {
    ctx.beginPath()
    ctx.moveTo(0, r * CELL)
    ctx.lineTo(W, r * CELL)
    ctx.stroke()
  }

  // Major grid (every 5 cells)
  ctx.strokeStyle = GRID_MAJOR
  ctx.lineWidth = 1
  for (let c = 0; c <= COLS; c += 5) {
    ctx.beginPath()
    ctx.moveTo(c * CELL, 0)
    ctx.lineTo(c * CELL, H)
    ctx.stroke()
  }
  for (let r = 0; r <= ROWS; r += 5) {
    ctx.beginPath()
    ctx.moveTo(0, r * CELL)
    ctx.lineTo(W, r * CELL)
    ctx.stroke()
  }

  // Registration marks
  drawRegistrationMarks(ctx)

  // Layer 1: Field (warm brown density halo) — boosted opacity
  const fieldRgb = hexToRgb(WARM_BROWN)
  for (const p of particles) {
    for (let dy = -FIELD_RADIUS; dy <= FIELD_RADIUS; dy++) {
      for (let dx = -FIELD_RADIUS; dx <= FIELD_RADIUS; dx++) {
        const dist = Math.sqrt(dx * dx + dy * dy)
        if (dist > FIELD_RADIUS) continue
        const falloff = 1 - dist / FIELD_RADIUS
        const alpha = 0.22 * falloff * falloff
        const gx = Math.round(p.x) + dx
        const gy = Math.round(p.y) + dy
        if (gx < 0 || gx >= COLS || gy < 0 || gy >= ROWS) continue
        ctx.fillStyle = `rgba(${fieldRgb.r},${fieldRgb.g},${fieldRgb.b},${alpha})`
        ctx.fillRect(gx * CELL, gy * CELL, CELL, CELL)
      }
    }
  }

  // Layer 2: Links (mauve connections) — boosted opacity and width
  const mauveRgb = hexToRgb(MAUVE)
  ctx.lineWidth = 2
  for (let i = 0; i < particles.length; i++) {
    for (let j = i + 1; j < particles.length; j++) {
      const dx = particles[j].x - particles[i].x
      const dy = particles[j].y - particles[i].y
      const dist = Math.sqrt(dx * dx + dy * dy)
      if (dist < LINK_DIST) {
        const alpha = 0.5 * (1 - dist / LINK_DIST)
        ctx.strokeStyle = `rgba(${mauveRgb.r},${mauveRgb.g},${mauveRgb.b},${alpha})`
        ctx.beginPath()
        ctx.moveTo(particles[i].x * CELL + CELL / 2, particles[i].y * CELL + CELL / 2)
        ctx.lineTo(particles[j].x * CELL + CELL / 2, particles[j].y * CELL + CELL / 2)
        ctx.stroke()
      }
    }
  }

  // Layer 3: Particles (amethyst dots) — larger cells = more visible
  for (const p of particles) {
    const gx = Math.round(p.x)
    const gy = Math.round(p.y)
    if (gx < 0 || gx >= COLS || gy < 0 || gy >= ROWS) continue

    // Solid particle
    ctx.fillStyle = AMETHYST
    ctx.fillRect(gx * CELL + 1, gy * CELL + 1, CELL - 2, CELL - 2)

    // Inset highlight
    ctx.fillStyle = 'rgba(147,131,181,0.45)'
    ctx.fillRect(gx * CELL + 4, gy * CELL + 4, CELL - 8, CELL - 8)
  }

  // Branding — no radial gradient, just text shadow for readability
  drawBranding(ctx)
}

function drawRegistrationMarks(ctx) {
  const markLen = 20
  const offset = 15
  ctx.strokeStyle = SLATE
  ctx.lineWidth = 1

  ctx.beginPath()
  ctx.moveTo(offset, offset + markLen)
  ctx.lineTo(offset, offset)
  ctx.lineTo(offset + markLen, offset)
  ctx.stroke()

  ctx.beginPath()
  ctx.moveTo(W - offset - markLen, offset)
  ctx.lineTo(W - offset, offset)
  ctx.lineTo(W - offset, offset + markLen)
  ctx.stroke()

  ctx.beginPath()
  ctx.moveTo(offset, H - offset - markLen)
  ctx.lineTo(offset, H - offset)
  ctx.lineTo(offset + markLen, H - offset)
  ctx.stroke()

  ctx.beginPath()
  ctx.moveTo(W - offset - markLen, H - offset)
  ctx.lineTo(W - offset, H - offset)
  ctx.lineTo(W - offset, H - offset - markLen)
  ctx.stroke()
}

function drawBranding(ctx) {
  // Text sits directly on the particle field — shadow for legibility
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'

  // "Kernel" — slightly above center (OG cards crop bottom)
  const titleY = H * 0.38

  // Shadow pass
  ctx.fillStyle = 'rgba(250,249,246,0.9)'
  ctx.font = '700 80px Georgia, serif'
  // Draw a thick ivory shadow behind the text
  for (let ox = -3; ox <= 3; ox++) {
    for (let oy = -3; oy <= 3; oy++) {
      ctx.fillText('Kernel', W / 2 + ox, titleY + oy)
    }
  }

  // Actual title
  ctx.fillStyle = SLATE
  ctx.font = '700 80px Georgia, serif'
  ctx.fillText('Kernel', W / 2, titleY)

  // Tagline
  const tagY = H * 0.52

  // Shadow pass for tagline
  ctx.fillStyle = 'rgba(250,249,246,0.9)'
  ctx.font = '400 24px "Courier New", monospace'
  for (let ox = -2; ox <= 2; ox++) {
    for (let oy = -2; oy <= 2; oy++) {
      ctx.fillText('AI That Learns You', W / 2 + ox, tagY + oy)
    }
  }

  ctx.fillStyle = AMETHYST
  ctx.font = '400 24px "Courier New", monospace'
  ctx.fillText('AI That Learns You', W / 2, tagY)
}

// ── Main ──

const rand = seedRandom(42)
let particles = generateParticles(rand)
particles = simulate(particles, rand, 300)

const canvas = createCanvas(W, H)
const ctx = canvas.getContext('2d')
render(canvas, ctx, particles)

const outPath = path.join(__dirname, '..', 'public', 'og-image.png')
const buffer = canvas.toBuffer('image/png')
fs.writeFileSync(outPath, buffer)
console.log(`OG image written to ${outPath} (${(buffer.length / 1024).toFixed(1)} KB)`)
