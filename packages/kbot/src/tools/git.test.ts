// kbot Git Tools Tests
import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { mkdirSync, rmSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import { execSync } from 'node:child_process'

import { executeTool, getTool } from './index.js'
import { registerGitTools } from './git.js'

// Register once
registerGitTools()

// Temp git repo for tests
const TEST_DIR = join(tmpdir(), 'kbot-git-test-' + Date.now())

/** Run a command in the test repo */
function run(cmd: string): string {
  return execSync(cmd, { cwd: TEST_DIR, encoding: 'utf-8' }).trim()
}

beforeAll(() => {
  mkdirSync(TEST_DIR, { recursive: true })
  // Initialize a git repo with an initial commit
  run('git init')
  run('git config user.email "test@kbot.dev"')
  run('git config user.name "KBot Test"')
  run('git config commit.gpgsign false')
  writeFileSync(join(TEST_DIR, 'README.md'), '# Test Repo')
  run('git add .')
  run('git commit --no-gpg-sign -m "initial commit"')

  // Override cwd so git tools operate on our test repo
  process.chdir(TEST_DIR)
})

afterAll(() => {
  try { rmSync(TEST_DIR, { recursive: true, force: true }) } catch {}
})

// ─────────────────────────────────────────────────────────────────────
// 1. Registration
// ─────────────────────────────────────────────────────────────────────

describe('Git Tools Registration', () => {
  it('registers git_status', () => {
    const tool = getTool('git_status')
    expect(tool).toBeTruthy()
    expect(tool!.tier).toBe('free')
  })

  it('registers git_diff', () => {
    const tool = getTool('git_diff')
    expect(tool).toBeTruthy()
    expect(tool!.parameters.staged).toBeTruthy()
  })

  it('registers git_log', () => {
    const tool = getTool('git_log')
    expect(tool).toBeTruthy()
  })

  it('registers git_commit', () => {
    const tool = getTool('git_commit')
    expect(tool).toBeTruthy()
    expect(tool!.parameters.message.required).toBe(true)
  })

  it('registers git_branch', () => {
    const tool = getTool('git_branch')
    expect(tool).toBeTruthy()
    expect(tool!.parameters.name.required).toBe(true)
  })

  it('registers git_push', () => {
    const tool = getTool('git_push')
    expect(tool).toBeTruthy()
  })
})

// ─────────────────────────────────────────────────────────────────────
// 2. git_status
// ─────────────────────────────────────────────────────────────────────

describe('git_status', () => {
  it('returns empty on clean repo', async () => {
    const result = await executeTool({
      id: 'gs-1',
      name: 'git_status',
      arguments: {},
    })
    expect(result.error).toBeUndefined()
    // Clean repo should return empty or whitespace
    expect(result.result.trim()).toBe('')
  })

  it('shows modified files', async () => {
    writeFileSync(join(TEST_DIR, 'README.md'), '# Modified')

    const result = await executeTool({
      id: 'gs-2',
      name: 'git_status',
      arguments: {},
    })
    expect(result.error).toBeUndefined()
    expect(result.result).toContain('README.md')
    expect(result.result).toMatch(/M\s/)

    // Restore
    run('git checkout -- README.md')
  })

  it('shows untracked files', async () => {
    writeFileSync(join(TEST_DIR, 'newfile.txt'), 'new')

    const result = await executeTool({
      id: 'gs-3',
      name: 'git_status',
      arguments: {},
    })
    expect(result.error).toBeUndefined()
    expect(result.result).toContain('newfile.txt')
    expect(result.result).toContain('??')

    // Cleanup
    run('rm newfile.txt')
  })
})

// ─────────────────────────────────────────────────────────────────────
// 3. git_diff
// ─────────────────────────────────────────────────────────────────────

describe('git_diff', () => {
  it('returns "No changes" on clean repo', async () => {
    const result = await executeTool({
      id: 'gd-1',
      name: 'git_diff',
      arguments: {},
    })
    expect(result.error).toBeUndefined()
    expect(result.result).toBe('No changes')
  })

  it('shows unstaged changes', async () => {
    writeFileSync(join(TEST_DIR, 'README.md'), '# Changed Content')

    const result = await executeTool({
      id: 'gd-2',
      name: 'git_diff',
      arguments: {},
    })
    expect(result.error).toBeUndefined()
    expect(result.result).toContain('Changed Content')
    expect(result.result).toContain('diff --git')

    // Restore
    run('git checkout -- README.md')
  })

  it('shows staged changes with staged flag', async () => {
    writeFileSync(join(TEST_DIR, 'README.md'), '# Staged Change')
    run('git add README.md')

    const result = await executeTool({
      id: 'gd-3',
      name: 'git_diff',
      arguments: { staged: true },
    })
    expect(result.error).toBeUndefined()
    expect(result.result).toContain('Staged Change')

    // Unstage and restore
    run('git reset HEAD README.md')
    run('git checkout -- README.md')
  })

  it('limits diff to a specific path', async () => {
    writeFileSync(join(TEST_DIR, 'README.md'), '# Path Diff')
    writeFileSync(join(TEST_DIR, 'other.txt'), 'other change')
    run('git add other.txt')

    const result = await executeTool({
      id: 'gd-4',
      name: 'git_diff',
      arguments: { path: 'README.md' },
    })
    expect(result.error).toBeUndefined()
    expect(result.result).toContain('Path Diff')
    expect(result.result).not.toContain('other change')

    // Restore
    run('git checkout -- README.md')
    run('git reset HEAD other.txt')
    run('rm -f other.txt')
  })
})

// ─────────────────────────────────────────────────────────────────────
// 4. git_log
// ─────────────────────────────────────────────────────────────────────

describe('git_log', () => {
  it('shows commit history', async () => {
    const result = await executeTool({
      id: 'gl-1',
      name: 'git_log',
      arguments: {},
    })
    expect(result.error).toBeUndefined()
    expect(result.result).toContain('initial commit')
  })

  it('respects count parameter', async () => {
    // Add a second commit
    writeFileSync(join(TEST_DIR, 'log-test.txt'), 'log test')
    run('git add log-test.txt')
    run('git commit -m "second commit"')

    const result = await executeTool({
      id: 'gl-2',
      name: 'git_log',
      arguments: { count: 1 },
    })
    expect(result.error).toBeUndefined()
    expect(result.result).toContain('second commit')
    // With count=1, should not show initial commit (oneline format = 1 line)
    expect(result.result.split('\n').length).toBe(1)
  })

  it('uses oneline format by default', async () => {
    const result = await executeTool({
      id: 'gl-3',
      name: 'git_log',
      arguments: { count: 2 },
    })
    expect(result.error).toBeUndefined()
    // Oneline format: hash + message per line
    const lines = result.result.trim().split('\n')
    expect(lines.length).toBe(2)
  })
})

// ─────────────────────────────────────────────────────────────────────
// 5. git_commit
// ─────────────────────────────────────────────────────────────────────

describe('git_commit', () => {
  it('commits staged files with a message', async () => {
    writeFileSync(join(TEST_DIR, 'commit-test.txt'), 'commit me')
    run('git add commit-test.txt')

    const result = await executeTool({
      id: 'gc-1',
      name: 'git_commit',
      arguments: { message: 'test commit via tool' },
    })
    expect(result.error).toBeUndefined()
    expect(result.result).toContain('test commit via tool')

    // Verify it's in the log
    const log = run('git log --oneline -1')
    expect(log).toContain('test commit via tool')
  })

  it('stages and commits specified files', async () => {
    writeFileSync(join(TEST_DIR, 'auto-stage.txt'), 'auto staged')

    const result = await executeTool({
      id: 'gc-2',
      name: 'git_commit',
      arguments: { message: 'auto-stage commit', files: ['auto-stage.txt'] },
    })
    expect(result.error).toBeUndefined()
    expect(result.result).toContain('auto-stage commit')
  })

  it('handles commit with nothing staged', async () => {
    const result = await executeTool({
      id: 'gc-3',
      name: 'git_commit',
      arguments: { message: 'empty commit attempt' },
    })
    // git commit with nothing staged should error
    expect(result.error).toBe(true)
    expect(result.result).toBeTruthy()
  })
})

// ─────────────────────────────────────────────────────────────────────
// 6. git_branch
// ─────────────────────────────────────────────────────────────────────

describe('git_branch', () => {
  it('creates a new branch', async () => {
    const result = await executeTool({
      id: 'gb-1',
      name: 'git_branch',
      arguments: { name: 'test-branch-create', create: true },
    })
    expect(result.error).toBeUndefined()
    // git checkout -b outputs to stderr — stdout may be empty, which is fine
    // Verify the branch was created by checking git branch list
    const branches = run('git branch')
    expect(branches).toContain('test-branch-create')

    // Switch back
    run('git checkout master 2>/dev/null || git checkout main 2>/dev/null')
  })

  it('switches to an existing branch', async () => {
    // First ensure the branch exists
    run('git branch test-branch-switch 2>/dev/null || true')

    const result = await executeTool({
      id: 'gb-2',
      name: 'git_branch',
      arguments: { name: 'test-branch-switch' },
    })
    expect(result.error).toBeUndefined()

    // Verify we're on the branch
    const current = run('git rev-parse --abbrev-ref HEAD')
    expect(current).toBe('test-branch-switch')

    // Switch back
    run('git checkout master 2>/dev/null || git checkout main 2>/dev/null')
  })

  it('returns error for nonexistent branch', async () => {
    const result = await executeTool({
      id: 'gb-3',
      name: 'git_branch',
      arguments: { name: 'nonexistent-branch-xyz' },
    })
    expect(result.error).toBe(true)
  })
})

// ─────────────────────────────────────────────────────────────────────
// 7. git_push (should fail — no remote configured)
// ─────────────────────────────────────────────────────────────────────

describe('git_push', () => {
  it('returns error when no remote is configured', async () => {
    const result = await executeTool({
      id: 'gp-1',
      name: 'git_push',
      arguments: {},
    })
    expect(result.error).toBe(true)
    // No remote configured, so it should fail
    expect(result.result).toBeTruthy()
  })
})
