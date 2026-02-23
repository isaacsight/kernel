// ─── PixelEntity — Evolving Digital Companion ───────────────
//
// Renders the correct tier's pixels from pixelGrids data,
// applies evolution CSS vars/data-attrs, handles tap interaction.
// Mood expressions (mouth, thought bubbles) layered on top.
// Accessories rendered as pixel overlays.
// Canvas particle overlay for enhanced visual effects.

import { useRef, useCallback, useEffect, useMemo, useState } from 'react'
import { ENTITY_PIXELS, GROUND_GLOW, PARTICLES, ENTITY_PIXELS_BY_TOPIC } from './pixelGrids'
import { getExpression } from './pixelExpressions'
import { getEquippedAccessoryPixels } from './pixelAccessories'
import { PixelEntityCanvas } from './PixelEntityCanvas'
import type { EntityEvolutionState } from '../hooks/useEntityEvolution'

interface PixelEntityProps {
  evolution: EntityEvolutionState
}

// Check reduced motion preference
function prefersReducedMotion(): boolean {
  if (typeof window === 'undefined') return false
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches
}

export function PixelEntity({ evolution }: PixelEntityProps) {
  const creatureRef = useRef<HTMLDivElement>(null)
  const [showCanvas] = useState(() => !prefersReducedMotion())

  const handleTap = useCallback(() => {
    const el = creatureRef.current
    if (!el || el.classList.contains('ka-entity--react')) return
    el.classList.add('ka-entity--react')
    setTimeout(() => el.classList.remove('ka-entity--react'), 700)
    evolution.companion.petCreature()
  }, [evolution.companion])

  // Idle wiggle — periodic happy shimmy every 6-12s
  useEffect(() => {
    const scheduleWiggle = () => {
      const delay = 6000 + Math.random() * 6000
      return setTimeout(() => {
        const el = creatureRef.current
        if (el && !el.classList.contains('ka-entity--react')) {
          el.classList.add('ka-entity--wiggle')
          setTimeout(() => el.classList.remove('ka-entity--wiggle'), 600)
        }
        timerId = scheduleWiggle()
      }, delay)
    }
    let timerId = scheduleWiggle()
    return () => clearTimeout(timerId)
  }, [])

  const { tier, cssVars, dataAttrs, moodState, topic, topicColor } = evolution

  // Select topic-specific pixel grid (fallback to default garden)
  const topicPixels = ENTITY_PIXELS_BY_TOPIC[topic] || ENTITY_PIXELS

  // Filter pixels visible at current tier
  const visibleBody = topicPixels.filter(p => p.tier <= tier)
  const visibleGlow = GROUND_GLOW.filter(p => p.tier <= tier)
  const visibleParticles = PARTICLES.filter(p => p.tier <= tier)

  // Overlay pixels (core heart, crown flower) replace body pixels at the same position.
  const overlayPositions = new Set<string>()
  const overlays: typeof visibleBody = []
  for (const p of visibleBody) {
    if (p.variant === 'core' || p.variant === 'crown') {
      overlayPositions.add(`${p.x},${p.y}`)
      overlays.push(p)
    }
  }

  // Mood expression overlays
  const expression = useMemo(() => getExpression(moodState), [moodState])

  // Equipped accessories
  const accessoryPixels = useMemo(
    () => getEquippedAccessoryPixels(evolution.companion.tapCount, tier, evolution.companion.streak),
    [evolution.companion.tapCount, tier, evolution.companion.streak],
  )

  return (
    <div
      className="ka-empty-constellation"
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

      {/* Floating entity */}
      <div
        ref={creatureRef}
        className={`ka-pixel-creature${evolution.isEvolving ? ' ka-entity--evolving' : ''}`}
      >
        {visibleBody.map((p, i) => {
          // Skip body pixels that are overlaid by higher-tier variants
          if (p.variant === '' && overlayPositions.has(`${p.x},${p.y}`)) return null
          // Skip overlay pixels — rendered separately below
          if (p.variant === 'core' || p.variant === 'crown') return null

          const cls = p.variant ? `ka-pixel ka-pixel--${p.variant}` : 'ka-pixel'
          return (
            <span
              key={`b${i}`}
              className={cls}
              style={{ left: p.x, top: p.y }}
            />
          )
        })}

        {/* Overlay pixels: core (heart), crown (flower bud) */}
        {overlays.map((p, i) => {
          const cls = `ka-pixel ka-pixel--${p.variant}`
          return (
            <span
              key={`o${i}`}
              className={cls}
              style={{ left: p.x, top: p.y }}
            />
          )
        })}

        {/* Mood mouth pixels */}
        {expression.mouthPixels.map((p, i) => (
          <span
            key={`m${i}`}
            className={`ka-pixel ka-pixel--${p.variant}`}
            style={{ left: p.x, top: p.y }}
          />
        ))}

        {/* Accessory pixels */}
        {accessoryPixels.map((p: { x: number; y: number; variant: string }, i: number) => (
          <span
            key={`acc${i}`}
            className={`ka-pixel ka-pixel--${p.variant}`}
            style={{ left: p.x, top: p.y }}
          />
        ))}

        {/* Notification pixel — briefing indicator near sprout */}
        {evolution.hasUnreadBriefing && tier >= 1 && (
          <span
            className="ka-pixel ka-pixel--notif"
            style={{ left: 76, top: 4 }}
          />
        )}
      </div>

      {/* Thought bubble — mood-specific floating symbols */}
      {expression.thoughtBubble.map((p, i) => (
        <span
          key={`t${i}`}
          className={`ka-pixel--${p.variant}`}
          style={{ left: p.x + 55, top: p.y + 30 }}
        />
      ))}

      {/* Ground glow */}
      {visibleGlow.map((p, i) => (
        <span
          key={`g${i}`}
          className="ka-pixel ka-pixel--glow"
          style={{ left: p.x, top: p.y }}
        />
      ))}

      {/* Ambient particles */}
      {visibleParticles.map((p, i) => (
        <span
          key={`p${i}`}
          className="ka-pixel ka-pixel--sim"
          style={{ left: p.x, top: p.y }}
        />
      ))}
    </div>
  )
}
