// nut.js adapter tests.
// The pure mapping helpers are exhaustively tested and host-independent.
// The nut-backed primitives are availability-gated: @nut-tree-fork/nut-js is an
// OPTIONAL dependency, so it may or may not be installed depending on whether a
// given host's `npm install` resolved it. We therefore test the not-installed
// degradation path ONLY when nut.js is genuinely absent, and we never invoke the
// action primitives when it is present — nutClick/nutType/nutKey perform real
// input on the host, which a test must not do.
import { describe, it, expect } from 'vitest'
import {
  resolveKeyName,
  parseKeyCombo,
  resolveButtonName,
  nutAvailable,
  nutScreenshot,
  nutClick,
  nutKey,
  nutType,
} from './index.js'

describe('resolveKeyName', () => {
  it('maps named keys (case-insensitive)', () => {
    expect(resolveKeyName('enter')).toBe('Enter')
    expect(resolveKeyName('ENTER')).toBe('Enter')
    expect(resolveKeyName('esc')).toBe('Escape')
    expect(resolveKeyName('pageup')).toBe('PageUp')
  })

  it('maps modifier aliases to the platform members', () => {
    expect(resolveKeyName('ctrl')).toBe('LeftControl')
    expect(resolveKeyName('control')).toBe('LeftControl')
    expect(resolveKeyName('cmd')).toBe('LeftSuper')
    expect(resolveKeyName('win')).toBe('LeftSuper')
    expect(resolveKeyName('alt')).toBe('LeftAlt')
    expect(resolveKeyName('option')).toBe('LeftAlt')
    expect(resolveKeyName('shift')).toBe('LeftShift')
  })

  it('maps letters, digits, and function keys', () => {
    expect(resolveKeyName('a')).toBe('A')
    expect(resolveKeyName('Z')).toBe('Z')
    expect(resolveKeyName('5')).toBe('Num5')
    expect(resolveKeyName('f1')).toBe('F1')
    expect(resolveKeyName('f12')).toBe('F12')
  })

  it('returns null for unknown / out-of-range tokens', () => {
    expect(resolveKeyName('f13')).toBeNull()
    expect(resolveKeyName('hyper')).toBeNull()
    expect(resolveKeyName('ab')).toBeNull()
    expect(resolveKeyName('')).toBeNull()
  })
})

describe('parseKeyCombo', () => {
  it('parses single keys', () => {
    expect(parseKeyCombo('enter')).toEqual(['Enter'])
    expect(parseKeyCombo('a')).toEqual(['A'])
  })

  it('parses combos with modifiers first, main key last', () => {
    expect(parseKeyCombo('ctrl+c')).toEqual(['LeftControl', 'C'])
    expect(parseKeyCombo('ctrl+shift+s')).toEqual(['LeftControl', 'LeftShift', 'S'])
    expect(parseKeyCombo('cmd+space')).toEqual(['LeftSuper', 'Space'])
  })

  it('tolerates whitespace and empty segments', () => {
    expect(parseKeyCombo(' ctrl + c ')).toEqual(['LeftControl', 'C'])
  })

  it('returns null if any segment is unrecognized', () => {
    expect(parseKeyCombo('ctrl+nope')).toBeNull()
    expect(parseKeyCombo('')).toBeNull()
    expect(parseKeyCombo('+')).toBeNull()
  })
})

describe('resolveButtonName', () => {
  it('maps button names, defaulting to LEFT', () => {
    expect(resolveButtonName('left')).toBe('LEFT')
    expect(resolveButtonName('right')).toBe('RIGHT')
    expect(resolveButtonName('middle')).toBe('MIDDLE')
    expect(resolveButtonName('double')).toBe('LEFT') // double handled separately
    expect(resolveButtonName('garbage')).toBe('LEFT')
  })
})

describe('nut.js availability + not-installed fallback', () => {
  it('reports availability as a stable boolean', async () => {
    const a = await nutAvailable()
    expect(typeof a).toBe('boolean')
    expect(await nutAvailable()).toBe(a) // consistent across calls
  })

  it('when nut.js is absent, primitives degrade with an install hint instead of throwing', async () => {
    if (await nutAvailable()) {
      // nut.js IS installed on this host — the action primitives perform real
      // mouse/keyboard input and screen capture, so we deliberately skip the
      // side-effecting calls. The not-installed degradation path is what this
      // case asserts, and it only exists when nut.js is absent.
      return
    }
    for (const r of [
      await nutScreenshot(),
      await nutClick(10, 10, 'left'),
      await nutType('hi'),
      await nutKey('ctrl+c'),
    ]) {
      expect(r.ok).toBe(false)
      if (!r.ok) expect(r.error).toMatch(/nut\.js not available/i)
    }
  })
})
