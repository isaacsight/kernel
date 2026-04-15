import type { CSSProperties } from 'react'
import './PopPathText.css'

/**
 * PopPathText — writing along a path.
 *
 * SVG <textPath> primitive for curved / arched / angled
 * headlines. Comes with three preset paths used in editorial
 * work and supports a custom `d` when those don't suit.
 *
 *   - arc-top       — semicircle opening downward (text rides up
 *                      and over, like a stamp)
 *   - arc-bottom    — semicircle opening upward (text scoops down,
 *                      like a smile)
 *   - wave          — sine-wave curve (text lopes along)
 *
 * Mobile-first: scales via clamp() on the viewBox width; text
 * font-size is relative so it tracks with the surrounding type.
 *
 * Use for cover ornaments, section transitions, signoffs. Not for
 * body prose.
 */

export type PopPathTextPreset = 'arc-top' | 'arc-bottom' | 'wave'

interface PopPathTextProps {
  /** The text that rides the curve. Keep it short — one phrase. */
  text: string
  /** Preset path. Ignored if `d` is provided. */
  preset?: PopPathTextPreset
  /** Custom SVG path data. Overrides `preset`. Coordinate space
   *  is 0 0 400 120 — design paths inside that box. */
  d?: string
  /** Font size in px on desktop; scales down automatically. */
  fontSize?: number
  /** Color mapping onto pop-* tokens. */
  color?: 'tomato' | 'ink' | 'coffee' | 'ivory' | 'current'
  /** Optional size tier. Wider = roomier for long text. */
  size?: 'sm' | 'md' | 'lg'
  className?: string
  style?: CSSProperties
  'aria-label'?: string
}

const PRESETS: Record<PopPathTextPreset, string> = {
  'arc-top': 'M 30 100 Q 200 10, 370 100',
  'arc-bottom': 'M 30 20 Q 200 110, 370 20',
  'wave': 'M 10 60 Q 110 10, 200 60 T 390 60',
}

export function PopPathText({
  text,
  preset = 'arc-top',
  d,
  fontSize = 22,
  color = 'tomato',
  size = 'md',
  className = '',
  style,
  'aria-label': ariaLabel,
}: PopPathTextProps) {
  const pathD = d ?? PRESETS[preset]
  const pathId = `pop-path-${Math.random().toString(36).slice(2, 9)}`

  const classes = [
    'pop-path-text',
    `pop-path-text--${size}`,
    `pop-path-text--${color}`,
    className,
  ].filter(Boolean).join(' ')

  return (
    <span
      className={classes}
      style={style}
      role={ariaLabel ? 'img' : 'presentation'}
      aria-label={ariaLabel ?? text}
    >
      <svg
        viewBox="0 0 400 120"
        className="pop-path-text-svg"
        aria-hidden={!!ariaLabel}
        focusable="false"
      >
        <defs>
          <path id={pathId} d={pathD} fill="none" />
        </defs>
        <text className="pop-path-text-label" fontSize={fontSize}>
          <textPath href={`#${pathId}`} startOffset="50%" textAnchor="middle">
            {text}
          </textPath>
        </text>
      </svg>
    </span>
  )
}
