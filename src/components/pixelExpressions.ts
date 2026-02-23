// ─── Pixel Expressions — Per-mood face & thought overlays ──────
//
// Each mood gets unique eye adjustments, mouth pixels, and
// thought bubble content. Rendered as additional pixel layers
// by PixelEntity on top of the base creature.
//
// Eye positions (x:48,y:36 and x:72,y:36) are shared across all
// topic variants so expressions work universally.

import type { MoodState } from '../hooks/useCompanionMood'

export interface ExpressionPixel {
  x: number
  y: number
  variant: string   // CSS class suffix
}

export interface ExpressionDef {
  mood: MoodState
  mouthPixels: ExpressionPixel[]
  blushPixels: ExpressionPixel[]     // anime-style cheek blush
  thoughtBubble: ExpressionPixel[]   // dots + content
}

// ─── Expression Definitions ──────────────────────────────────

const EXPRESSIONS: Record<MoodState, ExpressionDef> = {
  happy: {
    mood: 'happy',
    mouthPixels: [
      { x: 57, y: 46, variant: 'mouth' },  // centered smile under eyes
    ],
    blushPixels: [
      { x: 32, y: 42, variant: 'blush' },  // left cheek
      { x: 88, y: 42, variant: 'blush' },  // right cheek
    ],
    thoughtBubble: [
      // Trail dots rising from top-right
      { x: 96, y: 18, variant: 'thought-dot' },
      { x: 102, y: 10, variant: 'thought' },
      // Heart content
      { x: 108, y: 0, variant: 'thought-content' },
    ],
  },

  excited: {
    mood: 'excited',
    mouthPixels: [
      { x: 57, y: 46, variant: 'mouth' },  // wide smile
    ],
    blushPixels: [
      { x: 30, y: 42, variant: 'blush' },  // left cheek (wider spread)
      { x: 38, y: 44, variant: 'blush' },
      { x: 82, y: 44, variant: 'blush' },  // right cheek
      { x: 90, y: 42, variant: 'blush' },
    ],
    thoughtBubble: [
      { x: 96, y: 16, variant: 'thought-dot' },
      { x: 104, y: 8, variant: 'thought' },
      // Exclamation content
      { x: 110, y: -2, variant: 'thought-content' },
    ],
  },

  sad: {
    mood: 'sad',
    mouthPixels: [
      { x: 57, y: 47, variant: 'mouth' },  // inverted frown
    ],
    blushPixels: [],
    thoughtBubble: [
      { x: 96, y: 18, variant: 'thought-dot' },
      { x: 100, y: 12, variant: 'thought' },
      // Raindrop content
      { x: 104, y: 2, variant: 'thought-content' },
    ],
  },

  sleepy: {
    mood: 'sleepy',
    mouthPixels: [],  // no mouth when sleeping
    blushPixels: [],
    thoughtBubble: [
      { x: 94, y: 20, variant: 'thought-dot' },
      { x: 100, y: 12, variant: 'thought' },
      // Zzz content
      { x: 106, y: 2, variant: 'thought-content' },
    ],
  },

  lonely: {
    mood: 'lonely',
    mouthPixels: [],  // no mouth — withdrawn
    blushPixels: [],
    thoughtBubble: [
      { x: 94, y: 20, variant: 'thought-dot' },
      { x: 100, y: 14, variant: 'thought' },
      // Dots content
      { x: 106, y: 4, variant: 'thought-content' },
    ],
  },

  content: {
    mood: 'content',
    mouthPixels: [],  // serene — no mouth needed
    blushPixels: [
      { x: 34, y: 43, variant: 'blush' },  // subtle single blush
      { x: 86, y: 43, variant: 'blush' },
    ],
    thoughtBubble: [
      // Star appears periodically (animation handles timing)
      { x: 96, y: 18, variant: 'thought-dot' },
      { x: 102, y: 10, variant: 'thought' },
      { x: 108, y: 0, variant: 'thought-content' },
    ],
  },

  bored: {
    mood: 'bored',
    mouthPixels: [],
    blushPixels: [],
    thoughtBubble: [],  // nothing to think about
  },
}

export function getExpression(mood: MoodState): ExpressionDef {
  return EXPRESSIONS[mood]
}

export const ALL_MOODS: MoodState[] = [
  'sleepy', 'lonely', 'excited', 'happy', 'content', 'sad', 'bored',
]
