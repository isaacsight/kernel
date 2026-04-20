/* ──────────────────────────────────────────────────────────────
   kernel.chat — The Ink Cabinet (adaptive issue palette)

   Every issue declares ONE base accent hex (named or free-form).
   From that single value, CSS derives five tones via
   `oklch(from var(--issue-accent-base) ...)` formulas on the
   cover / spread root. The palette adapts across:

     • Surface — five tones (base, strong, muted, whisper, ink)
       map to different roles (kicker, monument, pull-quote
       ground, dossier tint, woven emphasis).
     • Stock — each paper stock sets --issue-accent-lift, so the
       same base hex reads correctly on ivory, butter, kraft,
       cream, and ink without hand-tuning per issue.
     • Mode — dark mode / high-contrast inherit automatically.

   Inputs:
     • A seed name from INK_SEEDS (e.g., 'brick')  OR
     • A raw hex ('#9E3A2B'), validated against POPEYE constraints

   Guardrail:
     The magazine's grammar is warm, paper-register, slightly
     aged. Neon colors, pure digital primaries, and zero-chroma
     grays are rejected. See isPopeyeSafe().

   Usage:
     accent: 'cobalt'          // named seed
     accent: '#9E3A2B'         // free-form; validator runs in dev

   Omit `accent` entirely → resolves to the spread type's default
   (essay→tomato, interview→coffee, forecast→cobalt, dispatch→brick).
   Every pre-adaptive issue inherits the default naturally.

   Motion is NOT part of this system. Per-issue motion would
   over-engineer what the magazine actually needs; motion stays
   authored-per-issue when an issue genuinely requires distinctive
   motion, not derived systematically from the palette.
   ────────────────────────────────────────────────────────────── */

import type { IssueSpread } from './index'

export interface InkSeed {
  /** Display name of the seed. */
  name: string
  /** Base hex — the single input from which all tones derive. */
  hex: string
  /** Color family; informational only (warm / cool / neutral). */
  family: 'warm' | 'cool' | 'green' | 'deep' | 'neutral'
  /** One-line editorial note — when this seed fits. */
  fit: string
}

/** The named seeds — 9 anchors the magazine has verified as
 *  POPEYE-safe. Each is magazine-register: earth-grounded,
 *  CMYK-reachable, readable on ivory and ink alike. Issues can
 *  reference by name OR by the seed's hex directly.
 *
 *  Trimmed from an initial 12-seed proposal: terracotta, slate
 *  blue, and ochre were cut — terracotta overlapped brick, slate
 *  blue overlapped cobalt, ochre overlapped kraft (the paper
 *  stock already carries that yellow-brown register). Less is
 *  more; curators get sharper issues when they have fewer but
 *  more distinct choices. */
export const INK_SEEDS = {
  // ── warm reds ───────────────────────────────────────────────
  tomato: {
    name: 'Tomato',
    hex: '#E24E1B',
    family: 'warm',
    fit: 'THE default — house accent, 370+ issues.',
  },
  brick: {
    name: 'Brick',
    hex: '#9E3A2B',
    family: 'warm',
    fit: 'Deeper, archival — literature, memory, record-of-record.',
  },

  // ── cool blues ──────────────────────────────────────────────
  cobalt: {
    name: 'Cobalt',
    hex: '#1D4E89',
    family: 'cool',
    fit: 'Deep print blue — winter, nocturnal, nightlife, cold-weather.',
  },
  pool: {
    name: 'Pool',
    hex: '#4FB5C8',
    family: 'cool',
    fit: 'Teal — systems, terminal, code, infrastructure; summer-water.',
  },

  // ── greens ──────────────────────────────────────────────────
  ivy: {
    name: 'Ivy',
    hex: '#2E4A2E',
    family: 'green',
    fit: 'Deep forest — nature, outdoor, agriculture, environmental.',
  },
  olive: {
    name: 'Olive',
    hex: '#6B7A3D',
    family: 'green',
    fit: 'Fatigue-olive — field work, labor, cartography, maps.',
  },

  // ── deep / purples ──────────────────────────────────────────
  amethyst: {
    name: 'Amethyst',
    hex: '#6B5B95',
    family: 'deep',
    fit: 'When the issue is about kernel.chat itself — mastheads, anniversaries, year-in-review.',
  },
  oxblood: {
    name: 'Oxblood',
    hex: '#5E2328',
    family: 'deep',
    fit: 'Burgundy, archival — literature, wine, memory, endings.',
  },

  // ── neutral ─────────────────────────────────────────────────
  coffee: {
    name: 'Coffee',
    hex: '#6B4E3D',
    family: 'neutral',
    fit: 'Rich brown — interviews, craft, slow work; carries quietly on every stock.',
  },
} as const satisfies Record<string, InkSeed>

/** The seed identifier type — derived from INK_SEEDS keys. */
export type InkSeedName = keyof typeof INK_SEEDS

/** What an issue declares: either a named seed or a raw hex.
 *  Named seeds are preferred for discoverability in the archive;
 *  raw hexes are allowed for one-off issues that need a specific
 *  shade (validated against POPEYE constraints). */
export type IssueAccent = InkSeedName | (string & {})

/** Default accent when an issue omits the `accent` field. Each
 *  spread type gets a sensible default so writers never have to
 *  think about color unless they want to. The defaults reflect
 *  editorial temperament:
 *    essay     → tomato   (house warmth; most common)
 *    interview → coffee   (craft, conversation, slow work)
 *    forecast  → cobalt   (manifesto, cold clarity, declaration)
 *    dispatch  → brick    (wire, archival, printed-today red)
 */
export const DEFAULT_ACCENT_BY_SPREAD: Record<IssueSpread['type'], InkSeedName> = {
  essay: 'tomato',
  interview: 'coffee',
  forecast: 'cobalt',
  dispatch: 'brick',
}

/** Pick the default accent for a spread type. */
export function defaultAccentFor(spreadType: IssueSpread['type']): InkSeedName {
  return DEFAULT_ACCENT_BY_SPREAD[spreadType]
}

/** Resolve an IssueAccent value to its final hex. Named seeds
 *  look up in INK_SEEDS; raw hexes pass through. When accent is
 *  undefined, falls back to the spread type's default (or tomato
 *  when no spread info is available). */
export function resolveAccentHex(
  accent: IssueAccent | undefined,
  spreadType?: IssueSpread['type'],
): string {
  if (!accent) {
    const fallback = spreadType ? defaultAccentFor(spreadType) : 'tomato'
    return INK_SEEDS[fallback].hex
  }
  if (accent in INK_SEEDS) return INK_SEEDS[accent as InkSeedName].hex
  return accent // raw hex
}

/* ──────────────────────────────────────────────────────────────
   POPEYE-safe validator — called at issue-file load time in dev.

   Rejects values that would read as off-key in the magazine's
   warm, paper-register grammar:
     • Non-hex strings that aren't seed names
     • Neon colors (chroma too high, reads electric)
     • Pure grays (no hue personality — use tomato or coffee)
     • Pure digital primaries (#FF0000 et al — RGB, not CMYK ink)

   In prod, this is a no-op; seed PR review is the check.
   ────────────────────────────────────────────────────────────── */

export function isPopeyeSafe(hex: string): { ok: boolean; reason?: string } {
  if (!/^#[0-9A-Fa-f]{6}$/.test(hex)) {
    return { ok: false, reason: `Not a 6-digit hex: "${hex}"` }
  }

  const r = parseInt(hex.slice(1, 3), 16) / 255
  const g = parseInt(hex.slice(3, 5), 16) / 255
  const b = parseInt(hex.slice(5, 7), 16) / 255

  // Rough OKLCH chroma approximation — good enough for this guardrail.
  const max = Math.max(r, g, b)
  const min = Math.min(r, g, b)
  const chromaApprox = max - min

  if (chromaApprox < 0.015) {
    return {
      ok: false,
      reason: `Too gray (chroma≈${chromaApprox.toFixed(3)}). Use tomato or coffee for a neutral register.`,
    }
  }

  if (chromaApprox > 0.88) {
    return {
      ok: false,
      reason: `Too saturated (chroma≈${chromaApprox.toFixed(3)}). Magazine reads warm + print-register; avoid neon.`,
    }
  }

  const isPureRed = r === 1 && g === 0 && b === 0
  const isPureGreen = r === 0 && g === 1 && b === 0
  const isPureBlue = r === 0 && g === 0 && b === 1
  if (isPureRed || isPureGreen || isPureBlue) {
    return {
      ok: false,
      reason: 'Pure digital primary. The magazine uses CMYK-register inks, not RGB primaries.',
    }
  }

  return { ok: true }
}

/* ──────────────────────────────────────────────────────────────
   Contrast-ratio check — replaces the hand-curated compat matrix.

   Given an accent hex and a paper-stock hex, return the WCAG
   relative-luminance contrast ratio. Values below 3.5 log a
   dev-time warning ("accent disappears against paper"). This
   replaces a maintenance-drift compat table with a function that
   stays accurate as new seeds or stocks are added.
   ────────────────────────────────────────────────────────────── */

function relativeLuminance(hex: string): number {
  const r = parseInt(hex.slice(1, 3), 16) / 255
  const g = parseInt(hex.slice(3, 5), 16) / 255
  const b = parseInt(hex.slice(5, 7), 16) / 255
  const toLin = (c: number) => (c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4))
  return 0.2126 * toLin(r) + 0.7152 * toLin(g) + 0.0722 * toLin(b)
}

export function contrastRatio(accentHex: string, stockHex: string): number {
  const l1 = relativeLuminance(accentHex)
  const l2 = relativeLuminance(stockHex)
  const [a, b] = l1 > l2 ? [l1, l2] : [l2, l1]
  return (a + 0.05) / (b + 0.05)
}

/** Stock-hex lookup for the five paper stocks. Kept in sync with
 *  the --pop-* tokens in src/index.css. Used by the runtime
 *  warning when an accent × stock pair is under-contrast. */
export const STOCK_HEX: Record<'cream' | 'butter' | 'kraft' | 'ivory' | 'ink', string> = {
  cream: '#F3E9D2',
  butter: '#EFD9A0',
  kraft: '#C8A97E',
  ivory: '#FAF9F6',
  ink: '#1F1E1D',
}
