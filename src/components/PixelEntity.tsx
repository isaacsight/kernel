// ─── PixelEntity — Evolving Digital Companion ───────────────
//
// Renders the correct tier's pixels from pixelGrids data,
// applies evolution CSS vars/data-attrs, handles tap interaction.
// Replaces the inline pixel JSX that was in EnginePage.

import { useRef, useCallback } from 'react'
import { ENTITY_PIXELS, GROUND_GLOW, PARTICLES } from './pixelGrids'
import type { EntityEvolutionState } from '../hooks/useEntityEvolution'

interface PixelEntityProps {
  evolution: EntityEvolutionState
}

export function PixelEntity({ evolution }: PixelEntityProps) {
  const creatureRef = useRef<HTMLDivElement>(null)

  const handleTap = useCallback(() => {
    const el = creatureRef.current
    if (!el || el.classList.contains('ka-entity--react')) return
    el.classList.add('ka-entity--react')
    setTimeout(() => el.classList.remove('ka-entity--react'), 700)
  }, [])

  const { tier, cssVars, dataAttrs } = evolution

  // Filter pixels visible at current tier
  const visibleBody = ENTITY_PIXELS.filter(p => p.tier <= tier)
  const visibleGlow = GROUND_GLOW.filter(p => p.tier <= tier)
  const visibleParticles = PARTICLES.filter(p => p.tier <= tier)

  // Tier 2+ second eye: the pixel at (48, 48) variant 'eye' replaces the body pixel there.
  // We need to track which positions have overlay variants (core, crown, eye at tier 2+)
  // so we skip the underlying body pixel.
  const overlayPositions = new Set<string>()
  const overlays: typeof visibleBody = []
  for (const p of visibleBody) {
    if (p.variant === 'core' || (p.variant === 'eye' && p.tier >= 2) || p.variant === 'crown') {
      overlayPositions.add(`${p.x},${p.y}`)
      overlays.push(p)
    }
  }

  return (
    <div
      className="ka-empty-constellation"
      onClick={handleTap}
      role="img"
      aria-label={`Kernel entity — ${evolution.tierName}`}
      style={cssVars as React.CSSProperties}
      {...dataAttrs}
    >
      {/* Floating entity */}
      <div
        ref={creatureRef}
        className={`ka-pixel-creature${evolution.isEvolving ? ' ka-entity--evolving' : ''}`}
      >
        {visibleBody.map((p, i) => {
          // Skip body pixels that are overlaid by higher-tier variants
          if (p.variant === '' && overlayPositions.has(`${p.x},${p.y}`)) return null
          // Skip overlay pixels themselves — rendered separately below
          if (p.variant === 'core' || p.variant === 'crown') return null
          if (p.variant === 'eye' && p.tier >= 2) return null

          const cls = p.variant ? `ka-pixel ka-pixel--${p.variant}` : 'ka-pixel'
          return (
            <span
              key={`b${i}`}
              className={cls}
              style={{ left: p.x, top: p.y }}
            />
          )
        })}

        {/* Overlay pixels: core (heart), crown, second eye */}
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

        {/* Notification pixel — briefing indicator */}
        {evolution.hasUnreadBriefing && tier >= 1 && (
          <span
            className="ka-pixel ka-pixel--notif"
            style={{ left: 96, top: 24 }}
          />
        )}
      </div>

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
