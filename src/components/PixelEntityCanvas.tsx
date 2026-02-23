// ─── PixelEntityCanvas — Canvas particle overlay ──────────────
//
// A <canvas> positioned over the CSS creature for enhanced effects:
// 1. Particle physics — floating pollen with gravity, wind, cursor attraction
// 2. Tap ripple — concentric circles from tap point
//
// Performance guards:
// - 30fps throttle on mobile
// - IntersectionObserver pause when not visible
// - Max 30 particles
// - prefers-reduced-motion: don't mount at all
//
// The CSS creature remains the source of truth for shape/mood.
// Canvas is purely additive decoration.

import { useRef, useEffect, useCallback } from 'react'
import type { MoodState } from '../hooks/useCompanionMood'

interface PixelEntityCanvasProps {
  width: number
  height: number
  tier: number
  mood: MoodState
  topicColor: string
}

interface Particle {
  x: number
  y: number
  vx: number
  vy: number
  size: number
  opacity: number
  life: number
  maxLife: number
  active: boolean
}

interface Ripple {
  x: number
  y: number
  radius: number
  maxRadius: number
  opacity: number
}

// ─── Mood-driven particle configs ──────────────────────────

const MOOD_CONFIGS: Record<MoodState, { spawnRate: number; gravity: number; wind: number; color: string }> = {
  excited: { spawnRate: 0.15, gravity: -0.02, wind: 0.01, color: '255, 220, 140' },
  happy:   { spawnRate: 0.08, gravity: -0.015, wind: 0.005, color: '220, 200, 160' },
  content: { spawnRate: 0.04, gravity: -0.01, wind: 0.003, color: '200, 190, 160' },
  bored:   { spawnRate: 0.02, gravity: -0.008, wind: 0.002, color: '180, 170, 150' },
  sad:     { spawnRate: 0.02, gravity: 0.01, wind: 0, color: '140, 160, 190' },
  lonely:  { spawnRate: 0.01, gravity: -0.005, wind: 0.001, color: '160, 150, 180' },
  sleepy:  { spawnRate: 0.005, gravity: -0.003, wind: 0, color: '170, 160, 190' },
}

const MAX_PARTICLES = 30

// Pre-allocate particle pool to avoid GC pressure
function createPool(): Particle[] {
  return Array.from({ length: MAX_PARTICLES }, () => ({
    x: 0, y: 0, vx: 0, vy: 0, size: 0, opacity: 0, life: 0, maxLife: 0, active: false,
  }))
}

export function PixelEntityCanvas({ width, height, tier, mood, topicColor }: PixelEntityCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const pool = useRef<Particle[]>(createPool())
  const activeCount = useRef(0)
  const ripples = useRef<Ripple[]>([])
  const animFrame = useRef<number>(0)
  const isVisible = useRef(true)
  const lastFrame = useRef(0)
  const isMobile = useRef(typeof window !== 'undefined' && window.innerWidth < 768)

  // Parse topic color for tinting
  const hexToRgb = useCallback((hex: string) => {
    const r = /^#([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex)
    return r ? `${parseInt(r[1], 16)}, ${parseInt(r[2], 16)}, ${parseInt(r[3], 16)}` : '107, 91, 149'
  }, [])

  const topicRgb = hexToRgb(topicColor)

  // Spawn a new particle from the pool (zero allocation)
  const spawnParticle = useCallback(() => {
    if (activeCount.current >= MAX_PARTICLES) return
    const config = MOOD_CONFIGS[mood]
    const p = pool.current[activeCount.current]
    p.x = Math.random() * width
    p.y = height * 0.3 + Math.random() * height * 0.4
    p.vx = (Math.random() - 0.5) * 0.5 + config.wind
    p.vy = config.gravity * (1 + Math.random())
    p.size = 1.5 + Math.random() * 2.5
    p.opacity = 0
    p.life = 0
    p.maxLife = 120 + Math.random() * 180
    p.active = true
    activeCount.current++
  }, [mood, width, height])

  // Add tap ripple
  const handleCanvasClick = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
    const rect = canvasRef.current?.getBoundingClientRect()
    if (!rect) return
    const x = e.clientX - rect.left
    const y = e.clientY - rect.top
    ripples.current.push({
      x, y,
      radius: 0,
      maxRadius: 40 + tier * 10,
      opacity: 0.4,
    })
  }, [tier])

  // Main animation loop
  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    // Scale for DPI
    const dpr = window.devicePixelRatio || 1
    canvas.width = width * dpr
    canvas.height = height * dpr
    ctx.scale(dpr, dpr)

    const config = MOOD_CONFIGS[mood]
    const targetFps = isMobile.current ? 30 : 60
    const frameInterval = 1000 / targetFps

    const animate = (timestamp: number) => {
      if (!isVisible.current) {
        animFrame.current = requestAnimationFrame(animate)
        return
      }

      const elapsed = timestamp - lastFrame.current
      if (elapsed < frameInterval) {
        animFrame.current = requestAnimationFrame(animate)
        return
      }
      lastFrame.current = timestamp

      ctx.clearRect(0, 0, width, height)

      // Spawn particles
      if (Math.random() < config.spawnRate * (1 + tier * 0.3)) {
        spawnParticle()
      }

      // Update particles — compact pool in-place (no slice/allocation)
      let writeIdx = 0
      for (let i = 0; i < activeCount.current; i++) {
        const p = pool.current[i]
        p.life++
        p.x += p.vx
        p.y += p.vy

        // Fade in/out
        const progress = p.life / p.maxLife
        if (progress < 0.2) p.opacity = progress / 0.2
        else if (progress > 0.8) p.opacity = (1 - progress) / 0.2
        else p.opacity = 1

        // Gentle wander
        p.vx += (Math.random() - 0.5) * 0.02
        p.vy += (Math.random() - 0.5) * 0.01

        if (p.life < p.maxLife && p.x > -10 && p.x < width + 10) {
          // Compact: swap alive particle to front of pool
          if (writeIdx !== i) {
            pool.current[i] = pool.current[writeIdx]
            pool.current[writeIdx] = p
          }
          writeIdx++
        }
      }
      activeCount.current = writeIdx

      // Draw pass — separated from update for cache coherence
      const mixColor = tier >= 3 ? topicRgb : config.color
      for (let i = 0; i < activeCount.current; i++) {
        const p = pool.current[i]
        ctx.fillStyle = `rgba(${mixColor}, ${p.opacity * 0.35})`
        ctx.beginPath()
        ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2)
        ctx.fill()
      }

      // Glow pass — additive blend for soft halos
      ctx.globalCompositeOperation = 'lighter'
      for (let i = 0; i < activeCount.current; i++) {
        const p = pool.current[i]
        ctx.fillStyle = `rgba(${mixColor}, ${p.opacity * 0.08})`
        ctx.beginPath()
        ctx.arc(p.x, p.y, p.size * 2.5, 0, Math.PI * 2)
        ctx.fill()
      }
      ctx.globalCompositeOperation = 'source-over'

      // Update & draw ripples
      const activeRipples: Ripple[] = []
      for (const r of ripples.current) {
        r.radius += 2
        r.opacity *= 0.95

        if (r.opacity > 0.02 && r.radius < r.maxRadius) {
          activeRipples.push(r)
          ctx.beginPath()
          ctx.arc(r.x, r.y, r.radius, 0, Math.PI * 2)
          ctx.strokeStyle = `rgba(${topicRgb}, ${r.opacity})`
          ctx.lineWidth = 1.5
          ctx.stroke()
        }
      }
      ripples.current = activeRipples

      animFrame.current = requestAnimationFrame(animate)
    }

    animFrame.current = requestAnimationFrame(animate)

    return () => {
      cancelAnimationFrame(animFrame.current)
    }
  }, [mood, tier, width, height, topicRgb, spawnParticle])

  // IntersectionObserver — pause when not visible
  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const observer = new IntersectionObserver(
      ([entry]) => { isVisible.current = entry.isIntersecting },
      { threshold: 0.1 },
    )
    observer.observe(canvas)
    return () => observer.disconnect()
  }, [])

  return (
    <canvas
      ref={canvasRef}
      className="ka-entity-canvas"
      onClick={handleCanvasClick}
      aria-hidden="true"
      style={{
        position: 'absolute',
        top: 0,
        left: 0,
        width,
        height,
        pointerEvents: 'auto',
      }}
    />
  )
}
