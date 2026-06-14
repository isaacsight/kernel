// Repo-map tree formatting tests.
// The Windows-separator guard: generateRepoMap builds relPaths via
// path.relative(), which emits backslashes on Windows. The tree formatter
// splits on '/', so without normalization the tree collapses (no directory
// grouping) and backslash paths leak in. These tests exercise the real
// relative() -> toPosix() -> formatTree() pipeline on a temp dir; the
// no-backslash assertion fails on Windows CI if the normalization regresses.
import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { generateRepoMap } from './repo-map.js'

let root: string

beforeAll(() => {
  root = mkdtempSync(join(tmpdir(), 'kbot-repomap-'))
  writeFileSync(join(root, 'top.ts'), 'export const x = 1\n')
  mkdirSync(join(root, 'sub'))
  writeFileSync(join(root, 'sub', 'nested.ts'), 'export const y = 2\n')
  mkdirSync(join(root, 'sub', 'deep'))
  writeFileSync(join(root, 'sub', 'deep', 'leaf.ts'), 'export const z = 3\n')
})

afterAll(() => {
  rmSync(root, { recursive: true, force: true })
})

describe('generateRepoMap', () => {
  it('lists files and groups nested directories', async () => {
    const map = await generateRepoMap(root)
    expect(map).toContain('top.ts')
    expect(map).toContain('sub/')
    expect(map).toContain('nested.ts')
    expect(map).toContain('deep/')
    expect(map).toContain('leaf.ts')
  })

  it('never leaks OS-native backslash separators into the tree', async () => {
    const map = await generateRepoMap(root)
    expect(map).not.toContain('\\')
  })

  it('indents nested files under their directory header', async () => {
    const map = await generateRepoMap(root)
    // nested.ts should appear with leading indentation, not as "sub/nested.ts"
    expect(map).toMatch(/(^|\n)\s+nested\.ts/)
    expect(map).not.toContain('sub/nested.ts')
  })

  it('returns a sentinel for an empty repository', async () => {
    const empty = mkdtempSync(join(tmpdir(), 'kbot-repomap-empty-'))
    try {
      expect(await generateRepoMap(empty)).toBe('(empty repository)')
    } finally {
      rmSync(empty, { recursive: true, force: true })
    }
  })
})
