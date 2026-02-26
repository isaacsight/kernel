// ─── useColorCycle — Agent Color Cycling ──────────────────
//
// Smoothly cycles through the 5 specialist agent palettes.
// Returns interpolated { particle, link, field } for ParticleGrid.
// ~2.8s per palette (2s hold + 0.8s crossfade), ~14s full loop.

import { useRef, useEffect, useState } from 'react'

interface CyclePalette {
  particle: string
  link: string
  field: string
}

// ─── Agent palettes (light / dark) ─────────────────────

const AGENT_PALETTES_LIGHT: CyclePalette[] = [
  { particle: '#6B5B95', link: '#A0768C', field: '#B8875C' },  // kernel (amethyst)
  { particle: '#5B8BA0', link: '#6B5B95', field: '#7BA89B' },  // researcher (slate blue)
  { particle: '#6B8E6B', link: '#5B8BA0', field: '#A0C49D' },  // coder (sage green)
  { particle: '#B8875C', link: '#A0768C', field: '#D4A774' },  // writer (warm brown)
  { particle: '#A0768C', link: '#6B5B95', field: '#C096AC' },  // analyst (mauve)
]

const AGENT_PALETTES_DARK: CyclePalette[] = [
  { particle: '#8B7BB5', link: '#C096AC', field: '#D4A774' },  // kernel
  { particle: '#7BABC0', link: '#8B7BB5', field: '#9BC8BB' },  // researcher
  { particle: '#8BAE8B', link: '#7BABC0', field: '#B8D8B5' },  // coder
  { particle: '#D4A774', link: '#C096AC', field: '#E8C494' },  // writer
  { particle: '#C096AC', link: '#8B7BB5', field: '#D8B0C4' },  // analyst
]

const HOLD_MS = 2000
const FADE_MS = 800
const CYCLE_MS = HOLD_MS + FADE_MS

// ─── Hex color interpolation ───────────────────────────

function hexToRgb(hex: string): [number, number, number] {
  return [
    parseInt(hex.slice(1, 3), 16),
    parseInt(hex.slice(3, 5), 16),
    parseInt(hex.slice(5, 7), 16),
  ]
}

function rgbToHex(r: number, g: number, b: number): string {
  return '#' + [r, g, b].map(c => Math.round(c).toString(16).padStart(2, '0')).join('')
}

function hexLerp(a: string, b: string, t: number): string {
  const [ar, ag, ab] = hexToRgb(a)
  const [br, bg, bb] = hexToRgb(b)
  return rgbToHex(
    ar + (br - ar) * t,
    ag + (bg - ag) * t,
    ab + (bb - ab) * t,
  )
}

function lerpPalette(a: CyclePalette, b: CyclePalette, t: number): CyclePalette {
  return {
    particle: hexLerp(a.particle, b.particle, t),
    link: hexLerp(a.link, b.link, t),
    field: hexLerp(a.field, b.field, t),
  }
}

function isDark(): boolean {
  return document.documentElement.getAttribute('data-theme') === 'dark'
}

// ─── Hook ──────────────────────────────────────────────

export function useColorCycle(active: boolean): CyclePalette | null {
  const [palette, setPalette] = useState<CyclePalette | null>(null)
  const rafRef = useRef(0)
  const startRef = useRef(0)

  useEffect(() => {
    if (!active) {
      setPalette(null)
      return
    }

    startRef.current = performance.now()

    const tick = (now: number) => {
      const elapsed = now - startRef.current
      const palettes = isDark() ? AGENT_PALETTES_DARK : AGENT_PALETTES_LIGHT
      const count = palettes.length
      const totalCycle = count * CYCLE_MS
      const pos = elapsed % totalCycle
      const idx = Math.min(Math.floor(pos / CYCLE_MS), count - 1)
      const phaseTime = pos - idx * CYCLE_MS
      const current = palettes[idx]
      if (!current) { rafRef.current = requestAnimationFrame(tick); return }

      if (phaseTime <= HOLD_MS) {
        // Hold phase — static color
        setPalette(current)
      } else {
        // Crossfade phase
        const t = (phaseTime - HOLD_MS) / FADE_MS
        const next = palettes[(idx + 1) % count] || current
        setPalette(lerpPalette(current, next, t))
      }

      rafRef.current = requestAnimationFrame(tick)
    }

    rafRef.current = requestAnimationFrame(tick)

    return () => cancelAnimationFrame(rafRef.current)
  }, [active])

  return palette
}
