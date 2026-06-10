// kbot Bash Tool Tests
import { describe, it, expect, afterAll } from 'vitest'
import { mkdirSync, rmSync, writeFileSync, existsSync } from 'node:fs'
import { join } from 'node:path'
import { tmpdir } from 'node:os'

import { executeTool, getTool } from './index.js'
import { registerBashTools, translatePosixForWindows } from './bash.js'

// Many bash-tool tests invoke POSIX shell commands (echo with shell-quoted
// strings, wc, cat, rm, sleep, $VAR expansion). On Windows the user shell
// is cmd.exe, which lacks these commands by design. The bash *tool* itself
// is platform-correct (it forwards whatever command the user passes to the
// system shell); these tests verify Unix-shell behaviour and are skipped
// on Windows. Windows test coverage of the bash tool would require a
// separate set of tests using cmd.exe-native commands.
const itUnix = it.skipIf(process.platform === 'win32')

// Register once
registerBashTools()

// Temp directory for tests
const TEST_DIR = join(tmpdir(), 'kbot-bash-test-' + Date.now())
mkdirSync(TEST_DIR, { recursive: true })

afterAll(() => {
  try { rmSync(TEST_DIR, { recursive: true, force: true }) } catch {}
})

// ─────────────────────────────────────────────────────────────────────
// 1. Registration
// ─────────────────────────────────────────────────────────────────────

describe('Bash Tool Registration', () => {
  it('registers the bash tool', () => {
    const tool = getTool('bash')
    expect(tool).toBeTruthy()
    expect(tool!.tier).toBe('free')
    expect(tool!.parameters.command.required).toBe(true)
  })
})

// ─────────────────────────────────────────────────────────────────────
// 2. Basic execution
// ─────────────────────────────────────────────────────────────────────

describe('Bash Execution', () => {
  itUnix('executes a simple command', async () => {
    const result = await executeTool({
      id: 'b-1',
      name: 'bash',
      arguments: { command: 'echo "hello kbot"' },
    })
    expect(result.error).toBeUndefined()
    expect(result.result).toBe('hello kbot')
  })

  itUnix('returns stdout from piped commands', async () => {
    const result = await executeTool({
      id: 'b-2',
      name: 'bash',
      arguments: { command: 'echo "aaa\nbbb\nccc" | wc -l' },
    })
    expect(result.error).toBeUndefined()
    expect(result.result.trim()).toBe('3')
  })

  itUnix('returns "(no output)" for silent commands', async () => {
    const result = await executeTool({
      id: 'b-3',
      name: 'bash',
      arguments: { command: 'true' },
    })
    expect(result.error).toBeUndefined()
    expect(result.result).toBe('(no output)')
  })

  it('returns exit code and stderr for failed commands', async () => {
    const result = await executeTool({
      id: 'b-4',
      name: 'bash',
      arguments: { command: 'ls /nonexistent-path-xyz-12345' },
    })
    expect(result.result).toContain('Exit code')
  })

  it('handles commands that produce both stdout and stderr on failure', async () => {
    const result = await executeTool({
      id: 'b-5',
      name: 'bash',
      arguments: { command: 'echo "partial" && false' },
    })
    expect(result.result).toContain('Exit code')
  })

  it('respects custom timeout', async () => {
    const result = await executeTool({
      id: 'b-6',
      name: 'bash',
      arguments: { command: 'sleep 30', timeout: 500 },
    })
    // Should fail with timeout or exit code
    expect(result.result).toContain('Exit code')
  })

  itUnix('caps timeout at 600000ms', async () => {
    // Passing a huge timeout should be capped
    const tool = getTool('bash')
    expect(tool).toBeTruthy()
    // The execute function caps at 600_000 internally — we test it won't crash
    const result = await executeTool({
      id: 'b-7',
      name: 'bash',
      arguments: { command: 'echo "fast"', timeout: 999999999 },
    })
    expect(result.error).toBeUndefined()
    expect(result.result).toBe('fast')
  })
})

// ─────────────────────────────────────────────────────────────────────
// 3. Safety checks — blocked patterns
// ─────────────────────────────────────────────────────────────────────

describe('Bash Safety - Blocked Patterns', () => {
  it('blocks rm -rf /', async () => {
    const result = await executeTool({
      id: 's-1',
      name: 'bash',
      arguments: { command: 'rm -rf /' },
    })
    expect(result.result).toContain('blocked')
  })

  it('blocks rm -rf ~ (home dir)', async () => {
    const result = await executeTool({
      id: 's-2',
      name: 'bash',
      arguments: { command: 'rm -rf ~' },
    })
    expect(result.result).toContain('blocked')
  })

  it('blocks rm with reversed flags', async () => {
    const result = await executeTool({
      id: 's-3',
      name: 'bash',
      arguments: { command: 'rm -fr /' },
    })
    expect(result.result).toContain('blocked')
  })

  it('blocks sudo rm', async () => {
    const result = await executeTool({
      id: 's-4',
      name: 'bash',
      arguments: { command: 'sudo rm -rf /tmp' },
    })
    expect(result.result).toContain('blocked')
  })

  it('blocks mkfs', async () => {
    const result = await executeTool({
      id: 's-5',
      name: 'bash',
      arguments: { command: 'mkfs.ext4 /dev/sda1' },
    })
    expect(result.result).toContain('blocked')
  })

  it('blocks dd if=', async () => {
    const result = await executeTool({
      id: 's-6',
      name: 'bash',
      arguments: { command: 'dd if=/dev/zero of=/dev/sda' },
    })
    expect(result.result).toContain('blocked')
  })

  it('blocks shutdown', async () => {
    const result = await executeTool({
      id: 's-7',
      name: 'bash',
      arguments: { command: 'shutdown -h now' },
    })
    expect(result.result).toContain('blocked')
  })

  it('blocks reboot', async () => {
    const result = await executeTool({
      id: 's-8',
      name: 'bash',
      arguments: { command: 'reboot' },
    })
    expect(result.result).toContain('blocked')
  })

  it('blocks fork bombs', async () => {
    const result = await executeTool({
      id: 's-9',
      name: 'bash',
      arguments: { command: ':(){ :|:& };:' },
    })
    expect(result.result).toContain('blocked')
  })

  it('blocks raw disk writes', async () => {
    const result = await executeTool({
      id: 's-10',
      name: 'bash',
      arguments: { command: 'echo bad > /dev/sda' },
    })
    expect(result.result).toContain('blocked')
  })
})

// ─────────────────────────────────────────────────────────────────────
// 4. Safety checks — command substitution
// ─────────────────────────────────────────────────────────────────────

describe('Bash Safety - Substitution Patterns', () => {
  it('blocks $(rm ...) substitution', async () => {
    const result = await executeTool({
      id: 'sub-1',
      name: 'bash',
      arguments: { command: 'echo $(rm -rf /)' },
    })
    expect(result.result).toContain('blocked')
  })

  it('blocks backtick rm substitution', async () => {
    const result = await executeTool({
      id: 'sub-2',
      name: 'bash',
      arguments: { command: 'echo `rm -rf /`' },
    })
    expect(result.result).toContain('blocked')
  })

  it('blocks $(shutdown) substitution', async () => {
    const result = await executeTool({
      id: 'sub-3',
      name: 'bash',
      arguments: { command: 'echo $(shutdown -h now)' },
    })
    expect(result.result).toContain('blocked')
  })
})

// ─────────────────────────────────────────────────────────────────────
// 5. Safe commands should pass
// ─────────────────────────────────────────────────────────────────────

describe('Bash Safety - Allowed Commands', () => {
  itUnix('allows rm on normal files (not root/home)', async () => {
    const filePath = join(TEST_DIR, 'deleteme.txt')
    writeFileSync(filePath, 'temp')

    const result = await executeTool({
      id: 'safe-1',
      name: 'bash',
      arguments: { command: `rm "${filePath}"` },
    })
    // Should not be blocked (rm without -rf on /)
    expect(result.result).not.toContain('blocked')
    expect(existsSync(filePath)).toBe(false)
  })

  it('allows git status', async () => {
    const result = await executeTool({
      id: 'safe-2',
      name: 'bash',
      arguments: { command: 'git --version' },
    })
    expect(result.error).toBeUndefined()
    expect(result.result).toContain('git version')
  })

  it('allows node commands', async () => {
    const result = await executeTool({
      id: 'safe-3',
      name: 'bash',
      arguments: { command: 'node -e "console.log(2+2)"' },
    })
    expect(result.error).toBeUndefined()
    expect(result.result).toBe('4')
  })

  itUnix('allows cat and standard file operations', async () => {
    const filePath = join(TEST_DIR, 'cattest.txt')
    writeFileSync(filePath, 'cat content')

    const result = await executeTool({
      id: 'safe-4',
      name: 'bash',
      arguments: { command: `cat "${filePath}"` },
    })
    expect(result.error).toBeUndefined()
    expect(result.result).toBe('cat content')
  })
})

// ─────────────────────────────────────────────────────────────────────
// 6. Working directory behavior
// ─────────────────────────────────────────────────────────────────────

describe('Bash Working Directory', () => {
  itUnix('executes commands in a working directory', async () => {
    const result = await executeTool({
      id: 'wd-1',
      name: 'bash',
      arguments: { command: 'pwd' },
    })
    expect(result.error).toBeUndefined()
    // Should return some valid path
    expect(result.result).toMatch(/^\//)
  })

  itUnix('handles environment variables', async () => {
    const result = await executeTool({
      id: 'wd-2',
      name: 'bash',
      arguments: { command: 'echo $HOME' },
    })
    expect(result.error).toBeUndefined()
    expect(result.result).toMatch(/^\//)
  })
})

// ─────────────────────────────────────────────────────────────────────
// 7. Windows POSIX polyfill — pure translation function
//
// On Windows the tool translates simple POSIX commands to PowerShell
// before executing (models habitually emit ls/cat/pwd, which cmd.exe
// rejects). translatePosixForWindows is a pure function, so these
// tests run on every platform.
// ─────────────────────────────────────────────────────────────────────

describe('Windows POSIX Polyfill - translations', () => {
  it('translates pwd', () => {
    expect(translatePosixForWindows('pwd')).toBe('(Get-Location).Path')
  })

  it('translates bare ls', () => {
    expect(translatePosixForWindows('ls')).toBe('Get-ChildItem')
  })

  it('translates ls -la with a path', () => {
    expect(translatePosixForWindows('ls -la src')).toBe("Get-ChildItem -Force 'src'")
  })

  it('translates cat with multiple files', () => {
    expect(translatePosixForWindows('cat a.txt b.txt')).toBe("Get-Content 'a.txt','b.txt'")
  })

  it('translates head and tail with counts', () => {
    expect(translatePosixForWindows('head -n 5 log.txt')).toBe("Get-Content 'log.txt' -TotalCount 5")
    expect(translatePosixForWindows('head -5 log.txt')).toBe("Get-Content 'log.txt' -TotalCount 5")
    expect(translatePosixForWindows('tail -20 log.txt')).toBe("Get-Content 'log.txt' -Tail 20")
    expect(translatePosixForWindows('tail log.txt')).toBe("Get-Content 'log.txt' -Tail 10")
  })

  it('translates rm -rf on a normal directory', () => {
    expect(translatePosixForWindows('rm -rf build')).toBe("Remove-Item -Recurse -Force 'build'")
  })

  it('translates cp -r and mv', () => {
    expect(translatePosixForWindows('cp -r src dest')).toBe("Copy-Item -Recurse 'src' -Destination 'dest'")
    expect(translatePosixForWindows('mv old.txt new.txt')).toBe("Move-Item 'old.txt' -Destination 'new.txt'")
  })

  it('translates mkdir -p', () => {
    expect(translatePosixForWindows('mkdir -p a/b/c')).toBe(
      "New-Item -ItemType Directory -Force -Path 'a/b/c' | Out-Null"
    )
  })

  it('translates touch without truncating existing files', () => {
    const result = translatePosixForWindows('touch notes.md')
    expect(result).toContain("if (Test-Path 'notes.md')")
    expect(result).toContain('LastWriteTime = Get-Date')
    expect(result).toContain('New-Item -ItemType File')
  })

  it('translates which', () => {
    expect(translatePosixForWindows('which node')).toBe("(Get-Command 'node').Source")
  })

  it('translates grep, case-sensitive by default', () => {
    expect(translatePosixForWindows('grep TODO src.ts')).toBe(
      "Select-String -CaseSensitive -Pattern 'TODO' -Path 'src.ts' | ForEach-Object { $_.Line }"
    )
    expect(translatePosixForWindows('grep -i todo src.ts')).toBe(
      "Select-String -Pattern 'todo' -Path 'src.ts' | ForEach-Object { $_.Line }"
    )
  })

  it('respects quoted arguments and escapes for PowerShell', () => {
    expect(translatePosixForWindows('cat "my file.txt"')).toBe("Get-Content 'my file.txt'")
    expect(translatePosixForWindows('cat "it\'s.txt"')).toBe("Get-Content 'it''s.txt'")
  })
})

describe('Windows POSIX Polyfill - passthrough (returns null)', () => {
  it('passes through pipelines and operators', () => {
    expect(translatePosixForWindows('ls | head -5')).toBeNull()
    expect(translatePosixForWindows('cat a.txt && echo done')).toBeNull()
    expect(translatePosixForWindows('echo $HOME')).toBeNull()
    expect(translatePosixForWindows('ls > out.txt')).toBeNull()
    expect(translatePosixForWindows('cd src; ls')).toBeNull()
  })

  it('passes through commands outside the table', () => {
    expect(translatePosixForWindows('git status')).toBeNull()
    expect(translatePosixForWindows('npm install')).toBeNull()
    expect(translatePosixForWindows('dir')).toBeNull()
  })

  it('passes through flags it cannot map faithfully', () => {
    expect(translatePosixForWindows('ls -t')).toBeNull() // sort order
    expect(translatePosixForWindows('tail -f log.txt')).toBeNull() // follow
    expect(translatePosixForWindows('grep -r TODO src')).toBeNull() // recursive
    expect(translatePosixForWindows('rm --recursive build')).toBeNull() // long flags
  })

  it('passes through unbalanced quotes and empty input', () => {
    expect(translatePosixForWindows('cat "unclosed')).toBeNull()
    expect(translatePosixForWindows('   ')).toBeNull()
  })
})
