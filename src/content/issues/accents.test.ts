import { describe, it, expect } from 'vitest'
import {
  INK_SEEDS,
  isPopeyeSafe,
  contrastRatio,
  resolveAccentHex,
  defaultAccentFor,
  auditAccents,
  STOCK_HEX,
} from './accents'

describe('isPopeyeSafe', () => {
  it('accepts every named seed hex', () => {
    for (const seed of Object.values(INK_SEEDS)) {
      expect(isPopeyeSafe(seed.hex).ok, `${seed.name} ${seed.hex}`).toBe(true)
    }
  })

  it('rejects a non-hex string (e.g. a seed name passed by mistake)', () => {
    expect(isPopeyeSafe('cobalt').ok).toBe(false)
    expect(isPopeyeSafe('#12').ok).toBe(false)
  })

  it('rejects a zero-chroma gray', () => {
    expect(isPopeyeSafe('#808080').ok).toBe(false)
  })

  it('rejects an over-saturated / neon value', () => {
    expect(isPopeyeSafe('#00FF01').ok).toBe(false)
  })

  it('rejects a pure digital primary', () => {
    expect(isPopeyeSafe('#FF0000').ok).toBe(false)
  })
})

describe('contrastRatio', () => {
  it('is symmetric', () => {
    const r = contrastRatio(STOCK_HEX.ink, STOCK_HEX.ivory)
    expect(contrastRatio(STOCK_HEX.ivory, STOCK_HEX.ink)).toBeCloseTo(r, 5)
  })

  it('reports ink-on-ivory as high contrast', () => {
    expect(contrastRatio(STOCK_HEX.ink, STOCK_HEX.ivory)).toBeGreaterThan(10)
  })

  it('reports identical colors as 1:1', () => {
    expect(contrastRatio(INK_SEEDS.tomato.hex, INK_SEEDS.tomato.hex)).toBeCloseTo(1, 5)
  })

  it('confirms the documented tomato-on-cream case sits below a 3.5 gate', () => {
    // This is why auditAccents does NOT auto-warn on contrast: the
    // house default pairing would trip a naive raw-hex gate.
    expect(contrastRatio(INK_SEEDS.tomato.hex, STOCK_HEX.cream)).toBeLessThan(3.5)
  })
})

describe('resolveAccentHex / defaultAccentFor', () => {
  it('resolves a named seed to its hex', () => {
    expect(resolveAccentHex('tomato')).toBe(INK_SEEDS.tomato.hex)
  })

  it('passes a raw hex through unchanged', () => {
    expect(resolveAccentHex('#123456')).toBe('#123456')
  })

  it('falls back to the spread-type default when accent is omitted', () => {
    expect(resolveAccentHex(undefined, 'interview')).toBe(INK_SEEDS.coffee.hex)
    expect(defaultAccentFor('dispatch')).toBe('brick')
  })

  it('falls back to tomato when neither accent nor spread type is known', () => {
    expect(resolveAccentHex(undefined)).toBe(INK_SEEDS.tomato.hex)
  })
})

describe('auditAccents', () => {
  it('passes named-seed accents (and no-accent issues) clean', () => {
    expect(
      auditAccents([
        { number: '405', accent: 'pool' },
        { number: '426', accent: 'cobalt' },
        { number: '360' },
      ]),
    ).toEqual([])
  })

  it('accepts a POPEYE-safe raw-hex accent', () => {
    expect(auditAccents([{ number: '998', accent: '#9E3A2B' }])).toEqual([])
  })

  it('flags a non-POPEYE raw-hex accent', () => {
    const warnings = auditAccents([{ number: '999', accent: '#808080' }])
    expect(warnings).toHaveLength(1)
    expect(warnings[0]).toContain('not POPEYE-safe')
  })
})
