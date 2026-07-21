import { describe, it, expect } from 'vitest'
import { webglAvailable } from './webgl'

describe('webglAvailable', () => {
  it('is true when the probe yields a webgl2 context', () => {
    expect(webglAvailable(() => ({}))).toBe(true)
  })
  it('is false when the probe yields nothing', () => {
    expect(webglAvailable(() => null)).toBe(false)
  })
  it('is false when the probe throws', () => {
    expect(webglAvailable(() => { throw new Error('blocked') })).toBe(false)
  })
})
