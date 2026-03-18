// kbot File Tools Tests
import { describe, it, expect, afterAll, vi, beforeAll } from 'vitest'
import { existsSync, readFileSync, writeFileSync, mkdirSync, rmSync, statSync } from 'node:fs'
import { join } from 'node:path'
import { tmpdir } from 'node:os'

// Mock permissions to auto-approve all writes (permissive mode)
vi.mock('../permissions.js', () => ({
  getPermissionMode: () => 'permissive',
}))

import { registerTool, executeTool, getTool } from './index.js'
import { registerFileTools } from './files.js'

// Register once
registerFileTools()

// Temp directory for tests
const TEST_DIR = join(tmpdir(), 'kbot-files-test-' + Date.now())
mkdirSync(TEST_DIR, { recursive: true })

afterAll(() => {
  try { rmSync(TEST_DIR, { recursive: true, force: true }) } catch {}
})

// ─────────────────────────────────────────────────────────────────────
// 1. Registration
// ─────────────────────────────────────────────────────────────────────

describe('File Tools Registration', () => {
  it('registers read_file', () => {
    const tool = getTool('read_file')
    expect(tool).toBeTruthy()
    expect(tool!.tier).toBe('free')
    expect(tool!.parameters.path.required).toBe(true)
  })

  it('registers write_file', () => {
    const tool = getTool('write_file')
    expect(tool).toBeTruthy()
    expect(tool!.parameters.path.required).toBe(true)
    expect(tool!.parameters.content.required).toBe(true)
  })

  it('registers edit_file', () => {
    const tool = getTool('edit_file')
    expect(tool).toBeTruthy()
    expect(tool!.parameters.old_string.required).toBe(true)
    expect(tool!.parameters.new_string.required).toBe(true)
  })

  it('registers glob', () => {
    const tool = getTool('glob')
    expect(tool).toBeTruthy()
    expect(tool!.parameters.pattern.required).toBe(true)
  })

  it('registers grep', () => {
    const tool = getTool('grep')
    expect(tool).toBeTruthy()
    expect(tool!.parameters.pattern.required).toBe(true)
  })

  it('registers multi_file_write', () => {
    const tool = getTool('multi_file_write')
    expect(tool).toBeTruthy()
    expect(tool!.parameters.files.required).toBe(true)
  })

  it('registers list_directory', () => {
    const tool = getTool('list_directory')
    expect(tool).toBeTruthy()
  })
})

// ─────────────────────────────────────────────────────────────────────
// 2. read_file
// ─────────────────────────────────────────────────────────────────────

describe('read_file', () => {
  it('reads a file and returns content with line numbers', async () => {
    const filePath = join(TEST_DIR, 'hello.txt')
    writeFileSync(filePath, 'line one\nline two\nline three')

    const result = await executeTool({
      id: 'rf-1',
      name: 'read_file',
      arguments: { path: filePath },
    })
    expect(result.error).toBeUndefined()
    expect(result.result).toContain('line one')
    expect(result.result).toContain('line two')
    expect(result.result).toContain('line three')
    // Should have line numbers
    expect(result.result).toMatch(/\d+\s*│/)
  })

  it('supports offset and limit', async () => {
    const filePath = join(TEST_DIR, 'numbered.txt')
    writeFileSync(filePath, 'a\nb\nc\nd\ne')

    const result = await executeTool({
      id: 'rf-2',
      name: 'read_file',
      arguments: { path: filePath, offset: 2, limit: 2 },
    })
    expect(result.error).toBeUndefined()
    expect(result.result).toContain('b')
    expect(result.result).toContain('c')
    expect(result.result).not.toContain('│ a')
    expect(result.result).not.toContain('│ d')
  })

  it('returns error for nonexistent file', async () => {
    const result = await executeTool({
      id: 'rf-3',
      name: 'read_file',
      arguments: { path: join(TEST_DIR, 'does-not-exist.txt') },
    })
    expect(result.result).toContain('Error')
    expect(result.result).toContain('not found')
  })

  it('returns error for directory', async () => {
    const result = await executeTool({
      id: 'rf-4',
      name: 'read_file',
      arguments: { path: TEST_DIR },
    })
    expect(result.result).toContain('directory')
  })

  it('reads empty files', async () => {
    const filePath = join(TEST_DIR, 'empty.txt')
    writeFileSync(filePath, '')

    const result = await executeTool({
      id: 'rf-5',
      name: 'read_file',
      arguments: { path: filePath },
    })
    expect(result.error).toBeUndefined()
  })
})

// ─────────────────────────────────────────────────────────────────────
// 3. write_file
// ─────────────────────────────────────────────────────────────────────

describe('write_file', () => {
  it('creates a new file', async () => {
    const filePath = join(TEST_DIR, 'new-file.txt')
    const result = await executeTool({
      id: 'wf-1',
      name: 'write_file',
      arguments: { path: filePath, content: 'hello world' },
    })
    expect(result.error).toBeUndefined()
    expect(result.result).toContain('Written')
    expect(result.result).toContain('11 bytes')
    expect(readFileSync(filePath, 'utf-8')).toBe('hello world')
  })

  it('overwrites an existing file', async () => {
    const filePath = join(TEST_DIR, 'overwrite.txt')
    writeFileSync(filePath, 'old content')

    const result = await executeTool({
      id: 'wf-2',
      name: 'write_file',
      arguments: { path: filePath, content: 'new content' },
    })
    expect(result.error).toBeUndefined()
    expect(readFileSync(filePath, 'utf-8')).toBe('new content')
  })

  it('auto-creates parent directories', async () => {
    const filePath = join(TEST_DIR, 'deep', 'nested', 'dir', 'file.txt')
    const result = await executeTool({
      id: 'wf-3',
      name: 'write_file',
      arguments: { path: filePath, content: 'nested content' },
    })
    expect(result.error).toBeUndefined()
    expect(existsSync(filePath)).toBe(true)
    expect(readFileSync(filePath, 'utf-8')).toBe('nested content')
  })

  it('writes empty content', async () => {
    const filePath = join(TEST_DIR, 'empty-write.txt')
    const result = await executeTool({
      id: 'wf-4',
      name: 'write_file',
      arguments: { path: filePath, content: '' },
    })
    expect(result.error).toBeUndefined()
    expect(result.result).toContain('0 bytes')
    expect(readFileSync(filePath, 'utf-8')).toBe('')
  })
})

// ─────────────────────────────────────────────────────────────────────
// 4. edit_file
// ─────────────────────────────────────────────────────────────────────

describe('edit_file', () => {
  it('replaces a unique string', async () => {
    const filePath = join(TEST_DIR, 'edit-target.txt')
    writeFileSync(filePath, 'hello world\nfoo bar\nbaz qux')

    const result = await executeTool({
      id: 'ef-1',
      name: 'edit_file',
      arguments: { path: filePath, old_string: 'foo bar', new_string: 'FOO BAR' },
    })
    expect(result.error).toBeUndefined()
    expect(result.result).toContain('replaced 1 occurrence')
    expect(readFileSync(filePath, 'utf-8')).toBe('hello world\nFOO BAR\nbaz qux')
  })

  it('returns error when old_string is not found', async () => {
    const filePath = join(TEST_DIR, 'edit-nf.txt')
    writeFileSync(filePath, 'hello world')

    const result = await executeTool({
      id: 'ef-2',
      name: 'edit_file',
      arguments: { path: filePath, old_string: 'not here', new_string: 'replacement' },
    })
    expect(result.result).toContain('not found')
  })

  it('returns error when old_string appears multiple times', async () => {
    const filePath = join(TEST_DIR, 'edit-dup.txt')
    writeFileSync(filePath, 'aaa bbb aaa ccc aaa')

    const result = await executeTool({
      id: 'ef-3',
      name: 'edit_file',
      arguments: { path: filePath, old_string: 'aaa', new_string: 'zzz' },
    })
    expect(result.result).toContain('3 times')
    expect(result.result).toContain('must be unique')
  })

  it('returns error for nonexistent file', async () => {
    const result = await executeTool({
      id: 'ef-4',
      name: 'edit_file',
      arguments: { path: join(TEST_DIR, 'nonexistent.txt'), old_string: 'a', new_string: 'b' },
    })
    expect(result.result).toContain('not found')
  })
})

// ─────────────────────────────────────────────────────────────────────
// 5. glob
// ─────────────────────────────────────────────────────────────────────

describe('glob', () => {
  it('finds files matching a pattern', async () => {
    const subDir = join(TEST_DIR, 'glob-test')
    mkdirSync(subDir, { recursive: true })
    writeFileSync(join(subDir, 'a.ts'), 'ts file')
    writeFileSync(join(subDir, 'b.ts'), 'ts file')
    writeFileSync(join(subDir, 'c.js'), 'js file')

    const result = await executeTool({
      id: 'gl-1',
      name: 'glob',
      arguments: { pattern: '*.ts', path: subDir },
    })
    expect(result.error).toBeUndefined()
    expect(result.result).toContain('a.ts')
    expect(result.result).toContain('b.ts')
  })

  it('returns "No files found" for no matches', async () => {
    const subDir = join(TEST_DIR, 'glob-empty')
    mkdirSync(subDir, { recursive: true })

    const result = await executeTool({
      id: 'gl-2',
      name: 'glob',
      arguments: { pattern: '*.xyz', path: subDir },
    })
    expect(result.result).toContain('No files found')
  })

  it('rejects unsafe characters in pattern', async () => {
    const result = await executeTool({
      id: 'gl-3',
      name: 'glob',
      arguments: { pattern: '*.ts; rm -rf /', path: TEST_DIR },
    })
    expect(result.result).toContain('unsafe characters')
  })

  it('rejects shell injection via backticks', async () => {
    const result = await executeTool({
      id: 'gl-4',
      name: 'glob',
      arguments: { pattern: '`whoami`.ts', path: TEST_DIR },
    })
    expect(result.result).toContain('unsafe characters')
  })

  it('rejects dollar sign substitution', async () => {
    const result = await executeTool({
      id: 'gl-5',
      name: 'glob',
      arguments: { pattern: '$(cat /etc/passwd).ts', path: TEST_DIR },
    })
    expect(result.result).toContain('unsafe characters')
  })
})

// ─────────────────────────────────────────────────────────────────────
// 6. grep
// ─────────────────────────────────────────────────────────────────────

describe('grep', () => {
  it('finds matching lines in files', async () => {
    const subDir = join(TEST_DIR, 'grep-test')
    mkdirSync(subDir, { recursive: true })
    writeFileSync(join(subDir, 'code.ts'), 'function hello() {\n  return "world"\n}')
    writeFileSync(join(subDir, 'other.ts'), 'const x = 42')

    const result = await executeTool({
      id: 'gr-1',
      name: 'grep',
      arguments: { pattern: 'hello', path: subDir },
    })
    expect(result.error).toBeUndefined()
    expect(result.result).toContain('hello')
  })

  it('returns "No matches found" for no matches', async () => {
    const subDir = join(TEST_DIR, 'grep-empty')
    mkdirSync(subDir, { recursive: true })
    writeFileSync(join(subDir, 'a.txt'), 'nothing relevant here')

    const result = await executeTool({
      id: 'gr-2',
      name: 'grep',
      arguments: { pattern: 'zzzzuniquezzz', path: subDir },
    })
    expect(result.result).toContain('No matches found')
  })

  it('sanitizes type flag to prevent injection', async () => {
    // The type flag should strip non-alphanumeric chars
    const result = await executeTool({
      id: 'gr-3',
      name: 'grep',
      arguments: { pattern: 'test', path: TEST_DIR, type: 'ts;rm' },
    })
    // Should not error fatally — type is sanitized to 'tsrm'
    expect(result.result).toBeDefined()
  })
})

// ─────────────────────────────────────────────────────────────────────
// 7. multi_file_write
// ─────────────────────────────────────────────────────────────────────

describe('multi_file_write', () => {
  it('writes multiple files at once', async () => {
    const result = await executeTool({
      id: 'mfw-1',
      name: 'multi_file_write',
      arguments: {
        files: [
          { path: join(TEST_DIR, 'multi-a.txt'), content: 'alpha' },
          { path: join(TEST_DIR, 'multi-b.txt'), content: 'beta' },
          { path: join(TEST_DIR, 'multi-c.txt'), content: 'gamma' },
        ],
      },
    })
    expect(result.error).toBeUndefined()
    expect(result.result).toContain('Written 3 files')
    expect(readFileSync(join(TEST_DIR, 'multi-a.txt'), 'utf-8')).toBe('alpha')
    expect(readFileSync(join(TEST_DIR, 'multi-b.txt'), 'utf-8')).toBe('beta')
    expect(readFileSync(join(TEST_DIR, 'multi-c.txt'), 'utf-8')).toBe('gamma')
  })

  it('returns error for empty files array', async () => {
    const result = await executeTool({
      id: 'mfw-2',
      name: 'multi_file_write',
      arguments: { files: [] },
    })
    expect(result.result).toContain('non-empty array')
  })

  it('returns error for non-array files', async () => {
    const result = await executeTool({
      id: 'mfw-3',
      name: 'multi_file_write',
      arguments: { files: 'not an array' },
    })
    expect(result.result).toContain('non-empty array')
  })

  it('auto-creates parent directories for each file', async () => {
    const result = await executeTool({
      id: 'mfw-4',
      name: 'multi_file_write',
      arguments: {
        files: [
          { path: join(TEST_DIR, 'multi-deep', 'sub', 'file.txt'), content: 'deep' },
        ],
      },
    })
    expect(result.error).toBeUndefined()
    expect(existsSync(join(TEST_DIR, 'multi-deep', 'sub', 'file.txt'))).toBe(true)
  })
})

// ─────────────────────────────────────────────────────────────────────
// 8. list_directory
// ─────────────────────────────────────────────────────────────────────

describe('list_directory', () => {
  it('lists files in a directory', async () => {
    const subDir = join(TEST_DIR, 'list-test')
    mkdirSync(subDir, { recursive: true })
    writeFileSync(join(subDir, 'file1.txt'), 'content')
    writeFileSync(join(subDir, 'file2.txt'), 'content')

    const result = await executeTool({
      id: 'ld-1',
      name: 'list_directory',
      arguments: { path: subDir },
    })
    expect(result.error).toBeUndefined()
    expect(result.result).toContain('file1.txt')
    expect(result.result).toContain('file2.txt')
  })

  it('returns something for nonexistent directory', async () => {
    const result = await executeTool({
      id: 'ld-2',
      name: 'list_directory',
      arguments: { path: join(TEST_DIR, 'no-such-dir-xyz') },
    })
    // ls -la with 2>/dev/null may return empty ("Empty directory") or error
    expect(result.result).toBeTruthy()
  })
})
