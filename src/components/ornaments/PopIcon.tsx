import type { CSSProperties } from 'react'
import './PopIcon.css'

/**
 * PopIcon — small editorial pictograms.
 *
 * Hand-tuned inline SVGs (not Unicode, not Lucide/Feather) so
 * they speak the magazine's typographic weight — slightly
 * thicker strokes, editorial proportions, tomato-ready. Every
 * icon is rendered from viewBox 24x24 with `stroke="currentColor"`
 * where possible so it takes the surrounding color.
 *
 * Use sparingly for section markers, sign-offs, or to punctuate
 * a byline. Never as a UI button icon — this is a publication,
 * not a toolbar.
 */

export type PopIconName =
  | 'arrow'
  | 'asterisk'
  | 'sparkle'
  | 'leaf'
  | 'coffee'
  | 'sun'
  | 'moon'
  | 'book'
  | 'pin'
  | 'quote'
  | 'thread'
  | 'pilcrow'

export type PopIconSize = 'sm' | 'md' | 'lg'

interface PopIconProps {
  name: PopIconName
  size?: PopIconSize
  className?: string
  style?: CSSProperties
  'aria-label'?: string
}

function IconBody({ name }: { name: PopIconName }) {
  const s: React.SVGAttributes<SVGElement> = {
    fill: 'none',
    stroke: 'currentColor',
    strokeWidth: 1.75,
    strokeLinecap: 'round',
    strokeLinejoin: 'round',
  }
  switch (name) {
    case 'arrow':
      // Right-pointing editorial arrow with serif flag
      return (
        <>
          <line x1="3" y1="12" x2="20" y2="12" {...s} />
          <polyline points="14 6 20 12 14 18" {...s} />
        </>
      )
    case 'asterisk':
      return (
        <>
          <line x1="12" y1="3" x2="12" y2="21" {...s} />
          <line x1="4.1" y1="7.5" x2="19.9" y2="16.5" {...s} />
          <line x1="4.1" y1="16.5" x2="19.9" y2="7.5" {...s} />
        </>
      )
    case 'sparkle':
      return (
        <path
          {...s}
          d="M12 3 L13.3 10.7 L21 12 L13.3 13.3 L12 21 L10.7 13.3 L3 12 L10.7 10.7 Z"
        />
      )
    case 'leaf':
      return (
        <>
          <path
            {...s}
            d="M4 20 C4 10, 14 4, 20 4 C20 14, 14 20, 4 20 Z"
          />
          <line x1="5" y1="19" x2="14" y2="10" {...s} />
        </>
      )
    case 'coffee':
      return (
        <>
          <path {...s} d="M5 9 H17 V16 C17 18.2 15.2 20 13 20 H9 C6.8 20 5 18.2 5 16 Z" />
          <path {...s} d="M17 11 H19 C20.1 11 21 11.9 21 13 C21 14.1 20.1 15 19 15 H17" />
          <line x1="8" y1="3" x2="8" y2="6" {...s} />
          <line x1="12" y1="3" x2="12" y2="6" {...s} />
        </>
      )
    case 'sun':
      return (
        <>
          <circle cx="12" cy="12" r="4" {...s} />
          <line x1="12" y1="2" x2="12" y2="4" {...s} />
          <line x1="12" y1="20" x2="12" y2="22" {...s} />
          <line x1="2" y1="12" x2="4" y2="12" {...s} />
          <line x1="20" y1="12" x2="22" y2="12" {...s} />
          <line x1="4.9" y1="4.9" x2="6.3" y2="6.3" {...s} />
          <line x1="17.7" y1="17.7" x2="19.1" y2="19.1" {...s} />
          <line x1="4.9" y1="19.1" x2="6.3" y2="17.7" {...s} />
          <line x1="17.7" y1="6.3" x2="19.1" y2="4.9" {...s} />
        </>
      )
    case 'moon':
      return (
        <path
          {...s}
          d="M20 14.5 A8 8 0 1 1 9.5 4 A6 6 0 0 0 20 14.5 Z"
        />
      )
    case 'book':
      return (
        <>
          <path {...s} d="M4 4 H11 C12.1 4 13 4.9 13 6 V21 L11 19 H4 Z" />
          <path {...s} d="M20 4 H13 C11.9 4 11 4.9 11 6 V21 L13 19 H20 Z" />
        </>
      )
    case 'pin':
      return (
        <>
          <path {...s} d="M12 2 C8.7 2 6 4.7 6 8 C6 13 12 22 12 22 C12 22 18 13 18 8 C18 4.7 15.3 2 12 2 Z" />
          <circle cx="12" cy="8" r="2.5" {...s} />
        </>
      )
    case 'quote':
      return (
        <>
          <path {...s} d="M6 17 C6 13 9 11 10 11 L10 8 C7 8 4 10 4 14 V17 Z" />
          <path {...s} d="M16 17 C16 13 19 11 20 11 L20 8 C17 8 14 10 14 14 V17 Z" />
        </>
      )
    case 'thread':
      // Three dots vertical — editorial column marker
      return (
        <>
          <circle cx="12" cy="5" r="1.4" fill="currentColor" stroke="none" />
          <circle cx="12" cy="12" r="1.4" fill="currentColor" stroke="none" />
          <circle cx="12" cy="19" r="1.4" fill="currentColor" stroke="none" />
        </>
      )
    case 'pilcrow':
      return (
        <>
          <path {...s} d="M16 3 H10 C7.8 3 6 4.8 6 7 C6 9.2 7.8 11 10 11 H11 V21" />
          <line x1="15" y1="3" x2="15" y2="21" {...s} />
        </>
      )
  }
}

export function PopIcon({
  name,
  size = 'md',
  className = '',
  style,
  'aria-label': ariaLabel,
}: PopIconProps) {
  const classes = [
    'pop-icon',
    `pop-icon--${name}`,
    `pop-icon--${size}`,
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
        className="pop-icon-svg"
        aria-hidden={!ariaLabel}
        focusable="false"
      >
        <IconBody name={name} />
      </svg>
    </span>
  )
}
