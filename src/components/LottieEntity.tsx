// ─── LottieEntity — Evolving Digital Companion (Lottie) ─────
//
// Renders a Lottie jellyfish animation with mood/evolution modulation.
// Mood → playback speed + CSS filter (brightness/saturation).
// Tap → weighted random reactions (speed burst + scale bounce).
// Tier → CSS scale. Topic color → CSS hue-rotate at tier 3+.
// Canvas particle overlay (PixelEntityCanvas) stays as separate layer.

import { useRef, useCallback, useEffect, useState, useMemo } from 'react'
import { DotLottieReact } from '@lottiefiles/dotlottie-react'
import type { DotLottie } from '@lottiefiles/dotlottie-react'
import { PixelEntityCanvas } from './PixelEntityCanvas'
import type { EntityEvolutionState } from '../hooks/useEntityEvolution'
import type { MoodState } from '../hooks/useCompanionMood'

interface LottieEntityProps {
  evolution: EntityEvolutionState
}

// ─── Mood → Speed mapping ────────────────────────────────────

const MOOD_SPEEDS: Record<MoodState, number> = {
  excited: 1.4,
  happy: 1.1,
  content: 0.9,
  bored: 0.6,
  lonely: 0.5,
  sad: 0.5,
  sleepy: 0.4,
}

// ─── Helpers ─────────────────────────────────────────────────

function prefersReducedMotion(): boolean {
  if (typeof window === 'undefined') return false
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches
}

// Convert hex to hue for hue-rotate offset
function hexToHue(hex: string): number {
  const result = /^#([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex)
  if (!result) return 0
  const r = parseInt(result[1], 16) / 255
  const g = parseInt(result[2], 16) / 255
  const b = parseInt(result[3], 16) / 255
  const max = Math.max(r, g, b), min = Math.min(r, g, b)
  if (max === min) return 0
  const d = max - min
  let h = 0
  if (max === r) h = ((g - b) / d + (g < b ? 6 : 0)) / 6
  else if (max === g) h = ((b - r) / d + 2) / 6
  else h = ((r - g) / d + 4) / 6
  return Math.round(h * 360)
}

// Jellyfish base hue is ~270 (purple). Compute rotation needed for topic.
const JELLYFISH_BASE_HUE = 270

export function LottieEntity({ evolution }: LottieEntityProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const lottieRef = useRef<DotLottie | null>(null)
  const [showCanvas] = useState(() => !prefersReducedMotion())
  const reducedMotion = useMemo(() => prefersReducedMotion(), [])

  const { tier, moodState, topicColor, isEvolving, hasUnreadBriefing, cssVars, dataAttrs } = evolution

  // ─── Lottie instance callback ──────────────────────────────
  const dotLottieRefCallback = useCallback((instance: DotLottie | null) => {
    if (!instance) return
    lottieRef.current = instance
    // Set initial speed based on mood
    instance.setSpeed(reducedMotion ? 0.1 : (MOOD_SPEEDS[moodState] ?? 0.9))
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  // ─── Mood → Speed sync ─────────────────────────────────────
  useEffect(() => {
    const inst = lottieRef.current
    if (!inst) return
    inst.setSpeed(reducedMotion ? 0.1 : (MOOD_SPEEDS[moodState] ?? 0.9))
  }, [moodState, reducedMotion])

  // ─── Tap reactions ─────────────────────────────────────────
  const handleTap = useCallback(() => {
    const el = containerRef.current
    const inst = lottieRef.current
    if (!el || !inst) return
    // Don't stack reactions
    if (el.classList.contains('ka-lottie--react')) return

    // Weighted random: speed burst + CSS bounce
    const roll = Math.random()
    let speedMultiplier: number
    let duration: number
    if (roll < 0.55) {
      speedMultiplier = 2.0   // happy bounce (55%)
      duration = 700
    } else if (roll < 0.75) {
      speedMultiplier = 2.5   // excited hop (20%)
      duration = 500
    } else if (roll < 0.9) {
      speedMultiplier = 1.5   // shy wobble (15%)
      duration = 800
    } else {
      speedMultiplier = 0.3   // sleepy blink (10%)
      duration = 600
    }

    // Burst speed
    const baseSpeed = MOOD_SPEEDS[moodState] ?? 0.9
    inst.setSpeed(baseSpeed * speedMultiplier)

    // CSS bounce class
    el.classList.add('ka-lottie--react')
    setTimeout(() => {
      el.classList.remove('ka-lottie--react')
      if (lottieRef.current) {
        lottieRef.current.setSpeed(reducedMotion ? 0.1 : baseSpeed)
      }
    }, duration)

    evolution.companion.petCreature()
  }, [evolution.companion, moodState, reducedMotion])

  // ─── Idle wiggle — periodic gentle pulse ───────────────────
  useEffect(() => {
    if (reducedMotion) return
    const scheduleWiggle = () => {
      const delay = 8000 + Math.random() * 8000
      return setTimeout(() => {
        const el = containerRef.current
        if (el && !el.classList.contains('ka-lottie--react')) {
          el.classList.add('ka-lottie--wiggle')
          setTimeout(() => el.classList.remove('ka-lottie--wiggle'), 600)
        }
        timerId = scheduleWiggle()
      }, delay)
    }
    let timerId = scheduleWiggle()
    return () => clearTimeout(timerId)
  }, [reducedMotion])

  // ─── Topic hue rotation (tier 3+) ─────────────────────────
  const hueRotation = useMemo(() => {
    if (tier < 3) return 0
    const topicHue = hexToHue(topicColor)
    return topicHue - JELLYFISH_BASE_HUE
  }, [tier, topicColor])

  return (
    <div
      className="ka-lottie-constellation"
      onClick={handleTap}
      role="img"
      aria-label={`Kernel entity — ${evolution.tierName}, feeling ${moodState}`}
      style={cssVars as React.CSSProperties}
      {...dataAttrs}
    >
      {/* Canvas particle overlay — additive effects */}
      {showCanvas && (
        <PixelEntityCanvas
          width={240}
          height={220}
          tier={tier}
          mood={moodState}
          topicColor={topicColor}
        />
      )}

      {/* Ambient glow behind creature */}
      <div className="ka-lottie-glow" />

      {/* Lottie jellyfish */}
      <div
        ref={containerRef}
        className={`ka-lottie-player${isEvolving ? ' ka-lottie--evolving' : ''}`}
        data-mood={moodState}
        data-tier={String(tier)}
        style={{
          ...(hueRotation !== 0 ? { '--lottie-hue': `${hueRotation}deg` } as React.CSSProperties : {}),
        }}
      >
        <DotLottieReact
          src="/creature/creature.lottie"
          loop
          autoplay
          dotLottieRefCallback={dotLottieRefCallback}
          style={{ width: '100%', height: '100%' }}
        />
      </div>

      {/* Notification dot — briefing indicator */}
      {hasUnreadBriefing && tier >= 1 && (
        <span className="ka-lottie-notif" />
      )}
    </div>
  )
}
