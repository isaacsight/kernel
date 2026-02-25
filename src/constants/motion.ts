/**
 * Animation Token System — Physics-Driven Motion
 *
 * Inspired by ParticleGrid's simulation model:
 *   GRAVITY  → how things settle        → spring stiffness
 *   DAMPING  → how quickly motion dies   → spring damping
 *   PRESSURE → how elements push apart   → overshoot / bounce
 *   VISCOSITY → how motion spreads       → stagger timing
 *
 * All durations are quantized to a 50ms grid (like ParticleGrid's
 * BIT_DEPTH quantization). No arbitrary magic numbers.
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
 *   --ease-settle:      cubic-bezier(0.22, 1, 0.36, 1)
 */

// ─── Quantization Grid ──────────────────────────────────────
// Like ParticleGrid's BIT_DEPTH, motion snaps to discrete steps.
// This prevents arbitrary values and creates rhythmic consistency.
const GRID_MS = 50
function q(ms: number): number { return Math.round(ms / GRID_MS) * GRID_MS / 1000 }

// ─── Spring Configs ─────────────────────────────────────────
// Derived from physics metaphors. Each spring has a personality
// defined by its relationship to gravity (stiffness) and
// damping (how quickly energy dissipates).

export const SPRING = {
  /** Snappy — panels, drawers, bottom sheets. Firm settling. */
  DEFAULT: { type: 'spring' as const, stiffness: 300, damping: 30 },
  /** Gentle — pills, tooltips, subtle reveals. Soft landing. */
  GENTLE: { type: 'spring' as const, stiffness: 200, damping: 25 },
  /** Bouncy — buttons, interactive feedback. Visible overshoot like particle pressure. */
  BOUNCY: { type: 'spring' as const, stiffness: 400, damping: 15, mass: 0.8 },
  /** Heavy — full overlays, page transitions. High mass = deliberate, weighty motion. */
  HEAVY: { type: 'spring' as const, stiffness: 200, damping: 35, mass: 1.5 },
  /** Quick — micro-interactions, toggles. Critically damped = no overshoot. */
  QUICK: { type: 'spring' as const, stiffness: 500, damping: 35 },
} as const

// ─── Quantized Duration Grid ────────────────────────────────
// All durations snap to 50ms increments. Like ParticleGrid's
// cell grid, this creates visual rhythm across all animations.

export const DURATION = {
  /** 0.1s — instant feedback (hover, press) */
  INSTANT: q(100),
  /** 0.15s — fast micro-interactions (focus rings, toggles) */
  FAST: q(150),
  /** 0.2s — quick transitions (message entry, fade) */
  QUICK: q(200),
  /** 0.3s — standard transitions (modals, cards, slides) */
  NORMAL: q(300),
  /** 0.4s — deliberate motion (bar fills, image entry) */
  MODERATE: q(400),
  /** 0.5s — slow emphasis (gate cards, section reveals) */
  SLOW: q(500),
  /** 0.6s — dramatic entrance (feature sections) */
  DRAMATIC: q(600),
  /** 0.8s — hero entrance (landing page) */
  HERO: q(800),
  /** 1.0s — full settle (page transitions) */
  SETTLE: q(1000),
} as const

// ─── Easing Curves ──────────────────────────────────────────
// Physical curves inspired by how particles decelerate.
// GRAVITY creates the initial impulse, DAMPING shapes the landing.

export const EASE = {
  /** Rubin ease-out — smooth deceleration, iOS-like feel.
   *  Matches ParticleGrid's damped settling motion. */
  OUT: [0.16, 1, 0.3, 1] as [number, number, number, number],
  /** Settle — gentler deceleration, like viscous fluid settling */
  SETTLE: [0.22, 1, 0.36, 1] as [number, number, number, number],
  /** Overshoot — slight bounce past target, like particle pressure */
  OVERSHOOT: [0.34, 1.56, 0.64, 1] as [number, number, number, number],
  /** Standard ease-out string (for simple cases) */
  OUT_STR: 'easeOut' as const,
} as const

// ─── Composable Transitions ─────────────────────────────────
// Like ParticleGrid's layered rendering (field → links → particles),
// transitions compose from fundamental timing + easing.

export const TRANSITION = {
  /** Message appear — quick fade + slight slide */
  MESSAGE: { duration: DURATION.QUICK, ease: EASE.OUT },
  /** Card/modal — standard duration with Rubin ease */
  CARD: { duration: DURATION.NORMAL, ease: EASE.OUT },
  /** Overlay backdrop — fast fade, no ease needed */
  OVERLAY: { duration: DURATION.FAST },
  /** Bar fill — moderate with Rubin ease (conviction bars, progress) */
  BAR_FILL: { duration: DURATION.MODERATE, ease: EASE.OUT },
  /** Image/embed — moderate fade-scale */
  MEDIA: { duration: DURATION.MODERATE, ease: EASE.OUT },
  /** Hero section — slow entrance with settling */
  HERO: { duration: DURATION.HERO, ease: EASE.SETTLE },
  /** Section reveal — dramatic entrance with Rubin ease */
  SECTION: { duration: DURATION.DRAMATIC, ease: EASE.OUT },
  /** Feature section — staggered dramatic entrance */
  FEATURE: (delay: number) => ({ duration: DURATION.DRAMATIC, ease: EASE.OUT, delay }),
  /** Pulse — infinite looping animation (like particle field oscillation) */
  PULSE: { duration: 2, repeat: Infinity, ease: 'easeInOut' as const },
  /** Staggered children — viscosity-based delay spreading.
   *  Like ParticleGrid's VISCOSITY spreading motion between neighbors. */
  STAGGER: (index: number, base = 0.03) => ({ delay: index * base }),
  /** Cascade — longer stagger for page-level reveals (onboarding, landing) */
  CASCADE: (index: number) => ({
    duration: DURATION.SLOW, ease: EASE.OUT, delay: 0.15 + index * 0.1,
  }),
} as const

// ─── Animation Variants ─────────────────────────────────────
// Composable enter/exit pairs. Like ParticleGrid's layered
// density fields, each variant defines a complete motion arc.
//
// Usage:
//   <motion.div variants={VARIANT.FADE_UP} initial="hidden" animate="visible" exit="hidden" />

export const VARIANT = {
  /** Fade in/out — simplest entrance. Overlay backdrops, subtle reveals. */
  FADE: {
    hidden: { opacity: 0 },
    visible: { opacity: 1 },
  },
  /** Fade + slide up — the workhorse. Messages, cards, form fields. */
  FADE_UP: {
    hidden: { opacity: 0, y: 12 },
    visible: { opacity: 1, y: 0 },
  },
  /** Fade + larger slide — sections, page-level content. */
  FADE_UP_LG: {
    hidden: { opacity: 0, y: 40 },
    visible: { opacity: 1, y: 0 },
  },
  /** Fade + scale — modals, dialogs, focused content. */
  FADE_SCALE: {
    hidden: { opacity: 0, scale: 0.95, y: 20 },
    visible: { opacity: 1, scale: 1, y: 0 },
  },
  /** Hero scale — large entrance with bigger scale delta. */
  HERO_SCALE: {
    hidden: { opacity: 0, scale: 0.9 },
    visible: { opacity: 1, scale: 1 },
  },
  /** Slide from bottom — bottom sheets, banners, toasts. */
  SLIDE_UP: {
    hidden: { y: 100, opacity: 0 },
    visible: { y: 0, opacity: 1 },
  },
  /** Slide from bottom (full) — bottom sheet panels. */
  SLIDE_UP_FULL: {
    hidden: { y: '100%' },
    visible: { y: 0 },
  },
  /** Container with staggered children */
  STAGGER_CONTAINER: {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: { staggerChildren: 0.1, delayChildren: 0.15 },
    },
  },
  /** Child item for use inside STAGGER_CONTAINER */
  STAGGER_ITEM: {
    hidden: { opacity: 0, y: 12 },
    visible: { opacity: 1, y: 0 },
  },
} as const

// ─── Reduced Motion ─────────────────────────────────────────
// Graceful degradation. Like ParticleGrid's adaptive cell size,
// animations scale down for users who prefer reduced motion.
// Replaces all motion with instant opacity transitions.

export const REDUCED = {
  SPRING: { type: 'tween' as const, duration: 0.01 },
  TRANSITION: { duration: 0.01 },
  VARIANT_FADE: {
    hidden: { opacity: 0 },
    visible: { opacity: 1 },
  },
} as const

// ─── CSS Loop Durations ─────────────────────────────────────
// For @keyframes infinite animations (like ParticleGrid's
// continuous simulation loop). Quantized to 100ms for loops.

export const LOOP = {
  /** 1.2s — fast pulse (typing indicators, active states) */
  FAST: 1.2,
  /** 1.5s — standard pulse (voice, status indicators) */
  NORMAL: 1.5,
  /** 2.0s — slow pulse (ambient glow, idle states) */
  SLOW: 2.0,
  /** 3.0s — drift (background animation, float effects) */
  DRIFT: 3.0,
} as const
