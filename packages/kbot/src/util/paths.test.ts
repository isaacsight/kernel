// Cross-platform path helper tests.
// These run in CI on Linux/macOS but assert Windows-path behavior, because the
// helpers are separator-agnostic by design (not host-OS-aware like node:path).
import { describe, it, expect } from 'vitest'
import { toPosix, baseName } from './paths.js'

describe('toPosix', () => {
  it('converts Windows separators to POSIX', () => {
    expect(toPosix('src\\tools\\bash.ts')).toBe('src/tools/bash.ts')
    expect(toPosix('C:\\Users\\isaac\\kernel')).toBe('C:/Users/isaac/kernel')
  })

  it('leaves POSIX paths unchanged (idempotent)', () => {
    expect(toPosix('src/tools/bash.ts')).toBe('src/tools/bash.ts')
    expect(toPosix(toPosix('a\\b'))).toBe('a/b')
  })

  it('handles empty and separatorless input', () => {
    expect(toPosix('')).toBe('')
    expect(toPosix('bash.ts')).toBe('bash.ts')
  })
})

describe('baseName', () => {
  it('extracts the basename from a POSIX path', () => {
    expect(baseName('src/tools/bash.ts')).toBe('bash.ts')
  })

  it('extracts the basename from a Windows path on any host', () => {
    expect(baseName('src\\tools\\bash.ts')).toBe('bash.ts')
    expect(baseName('C:\\Users\\isaac\\kernel')).toBe('kernel')
  })

  it('returns the input when there is no separator', () => {
    expect(baseName('bash.ts')).toBe('bash.ts')
  })

  it('returns empty string for empty input', () => {
    expect(baseName('')).toBe('')
  })

  // DESIGN-DECISION CASES — adjust these to match your chosen behavior in
  // baseName(). The defaults below assume Unix-`basename`-style: a trailing
  // separator is ignored.
  it('ignores a trailing separator (Unix basename style)', () => {
    expect(baseName('src/tools/')).toBe('tools')
    expect(baseName('src\\tools\\')).toBe('tools')
  })
})
