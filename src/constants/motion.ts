/**
 * Centralized Framer Motion animation tokens.
 *
 * Usage:
 *   import { SPRING, DURATION, EASE } from '@/constants/motion'
 *   <motion.div transition={{ ...SPRING.DEFAULT }} />
 *   <motion.div transition={{ duration: DURATION.FAST, ease: EASE.OUT }} />
 *
 * CSS counterparts (defined in src/index.css :root):
 *   --duration-instant: 100ms  ↔  DURATION.INSTANT
 *   --duration-fast:    150ms  ↔  DURATION.FAST
 *   --duration-quick:   200ms  ↔  DURATION.QUICK
 *   --duration-normal:  300ms  ↔  DURATION.NORMAL
 *   --duration-moderate:400ms  ↔  DURATION.MODERATE
 *   --duration-slow:    500ms  ↔  DURATION.SLOW
 *   --duration-dramatic:600ms  ↔  DURATION.DRAMATIC
 *   --ease-out:         cubic-bezier(0.16, 1, 0.3, 1)  ↔  EASE.OUT
 *   --ease-spring:      cubic-bezier(0.34, 1.56, 0.64, 1)
 */

// ─── Spring Configs ─────────────────────────────────────────
export const SPRING = {
  /** Standard spring — panels, drawers, bottom sheets */
  DEFAULT: { type: 'spring' as const, damping: 30, stiffness: 300 },
  /** Gentle spring — pills, subtle motion */
  GENTLE: { type: 'spring' as const, damping: 25, stiffness: 200 },
} as const

// ─── Duration Values (seconds) ──────────────────────────────
export const DURATION = {
  /** 0.1s — instant feedback (hover, press) */
  INSTANT: 0.1,
  /** 0.15s — fast micro-interactions (focus rings, toggles) */
  FAST: 0.15,
  /** 0.2s — quick transitions (message entry, fade) */
  QUICK: 0.2,
  /** 0.3s — standard transitions (modals, cards, slides) */
  NORMAL: 0.3,
  /** 0.4s — deliberate motion (bar fills, image entry) */
  MODERATE: 0.4,
  /** 0.5s — slow emphasis (gate cards, hero entry) */
  SLOW: 0.5,
  /** 0.6s — dramatic entrance (feature sections) */
  DRAMATIC: 0.6,
  /** 0.8s — hero entrance (landing page) */
  HERO: 0.8,
} as const

// ─── Easing Curves ──────────────────────────────────────────
export const EASE = {
  /** Rubin ease-out — smooth deceleration, iOS-like feel */
  OUT: [0.16, 1, 0.3, 1] as [number, number, number, number],
  /** Standard ease-out string (for simple cases) */
  OUT_STR: 'easeOut' as const,
} as const

// ─── Preset Transitions ────────────────────────────────────
export const TRANSITION = {
  /** Message appear — quick fade + slight slide */
  MESSAGE: { duration: DURATION.QUICK },
  /** Card/modal — standard duration with Rubin ease */
  CARD: { duration: DURATION.NORMAL, ease: EASE.OUT },
  /** Bar fill — moderate with Rubin ease */
  BAR_FILL: { duration: DURATION.MODERATE, ease: EASE.OUT },
  /** Image/embed — moderate fade-scale */
  MEDIA: { duration: DURATION.MODERATE },
  /** Hero section — slow entrance */
  HERO: { duration: DURATION.HERO },
  /** Feature section — staggered dramatic entrance */
  FEATURE: (delay: number) => ({ duration: DURATION.DRAMATIC, delay }),
  /** Staggered children — per-item delay */
  STAGGER: (index: number, base = 0.03) => ({ delay: index * base }),
} as const
