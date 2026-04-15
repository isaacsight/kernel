import type { CSSProperties } from 'react'
import './PopShape.css'

/**
 * PopShape — the "Illustrator layer" shape primitive.
 *
 * A small, tokenized decorative mark that composes inside any
 * feature (essay, interview, future modules). Renders as inline
 * SVG so it takes `currentColor`, scales cleanly at any DPR, and
 * uses `clamp()` for size so mobile-first sizing is automatic.
 *
 * Use sparingly — these are editorial ornaments, not UI chrome.
 */

export type PopShapeName =
  | 'circle'
  | 'ring'
  | 'dot'
  | 'square'
  | 'lozenge'
  | 'triangle'
  | 'star'
  | 'slash'

export type PopShapeSize = 'sm' | 'md' | 'lg'
export type PopShapeColor = 'tomato' | 'ink' | 'coffee' | 'ivory' | 'current'

interface PopShapeProps {
  name: PopShapeName
  size?: PopShapeSize
  color?: PopShapeColor
  /** Optional mono label rendered centered inside the shape —
   *  POPEYE editorial badge style (e.g. "NEW", "03", "00"). */
  label?: string
  /** Additional className for composition. */
  className?: string
  style?: CSSProperties
  'aria-label'?: string
}

/* ── SVG paths — clean geometry, viewBox 24x24 ────────────────── */

function ShapePath({ name }: { name: PopShapeName }) {
  switch (name) {
    case 'circle':
      return <circle cx="12" cy="12" r="11" fill="currentColor" />
    case 'ring':
      return (
        <circle
          cx="12"
          cy="12"
          r="10.5"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.5"
        />
      )
    case 'dot':
      return <circle cx="12" cy="12" r="5" fill="currentColor" />
    case 'square':
      return <rect x="2" y="2" width="20" height="20" fill="currentColor" />
    case 'lozenge':
      return (
        <polygon
          points="12,1 23,12 12,23 1,12"
          fill="currentColor"
        />
      )
    case 'triangle':
      return (
        <polygon
          points="12,2 22,21 2,21"
          fill="currentColor"
        />
      )
    case 'star':
      // Five-point star
      return (
        <polygon
          points="12,1 14.9,8.6 23,9.2 16.8,14.4 18.9,22.2 12,17.8 5.1,22.2 7.2,14.4 1,9.2 9.1,8.6"
          fill="currentColor"
        />
      )
    case 'slash':
      return (
        <line
          x1="2"
          y1="22"
          x2="22"
          y2="2"
          stroke="currentColor"
          strokeWidth="2"
        />
      )
  }
}

export function PopShape({
  name,
  size = 'md',
  color = 'tomato',
  label,
  className = '',
  style,
  'aria-label': ariaLabel,
}: PopShapeProps) {
  const classes = [
    'pop-shape',
    `pop-shape--${name}`,
    `pop-shape--${size}`,
    `pop-shape--${color}`,
    label ? 'pop-shape--has-label' : '',
    className,
  ].filter(Boolean).join(' ')

  return (
    <span
      className={classes}
      style={style}
      role={ariaLabel ? 'img' : 'presentation'}
      aria-label={ariaLabel}
    >
      <svg
        viewBox="0 0 24 24"
        className="pop-shape-svg"
        aria-hidden={!!label || !ariaLabel}
        focusable="false"
      >
        <ShapePath name={name} />
      </svg>
      {label && <span className="pop-shape-label">{label}</span>}
    </span>
  )
}
