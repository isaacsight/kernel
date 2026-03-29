// Tests for kbot Memory — persistent memory + session history
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

// Mock node:fs before importing the module under test
vi.mock('node:fs', () => ({
  existsSync: vi.fn(),
  readFileSync: vi.fn(),
  writeFileSync: vi.fn(),
  mkdirSync: vi.fn(),
  appendFileSync: vi.fn(),
}))

vi.mock('node:os', () => ({
  homedir: vi.fn(() => '/mock-home'),
}))

import {
  loadMemory,
  appendMemory,
  clearMemory,
  getMemoryPrompt,
  addTurn,
  getHistory,
  clearHistory,
  getPreviousMessages,
  compactHistory,
  restoreHistory,
  type ConversationTurn,
} from './memory.js'

import { existsSync, readFileSync, writeFileSync, mkdirSync, appendFileSync } from 'node:fs'

const mockedExistsSync = vi.mocked(existsSync)
const mockedReadFileSync = vi.mocked(readFileSync)
const mockedWriteFileSync = vi.mocked(writeFileSync)
const mockedMkdirSync = vi.mocked(mkdirSync)
const mockedAppendFileSync = vi.mocked(appendFileSync)

const MEMORY_DIR = '/mock-home/.kbot/memory'
const CONTEXT_FILE = '/mock-home/.kbot/memory/context.md'

beforeEach(() => {
  vi.clearAllMocks()
  clearHistory()
})

// ─── loadMemory ──────────────────────────────────────────────────────────

describe('loadMemory', () => {
  it('creates memory dir if it does not exist', () => {
    mockedExistsSync.mockReturnValueOnce(false) // dir check
    mockedExistsSync.mockReturnValueOnce(false) // file check
    loadMemory()
    expect(mockedMkdirSync).toHaveBeenCalledWith(MEMORY_DIR, { recursive: true })
  })

  it('returns empty string when context file does not exist', () => {
    mockedExistsSync.mockReturnValueOnce(true)  // dir exists
    mockedExistsSync.mockReturnValueOnce(false) // file does not exist
    expect(loadMemory()).toBe('')
  })

  it('reads and returns content when file exists and is under size limit', () => {
    mockedExistsSync.mockReturnValue(true)
    mockedReadFileSync.mockReturnValue('Some memory content')
    expect(loadMemory()).toBe('Some memory content')
    expect(mockedReadFileSync).toHaveBeenCalledWith(CONTEXT_FILE, 'utf-8')
  })

  it('truncates content that exceeds MAX_MEMORY_SIZE (50KB)', () => {
    mockedExistsSync.mockReturnValue(true)
    // Build content that exceeds 50,000 chars — 600 lines of ~100 chars each
    const lines = Array.from({ length: 600 }, (_, i) => `Line ${i}: ${'x'.repeat(90)}`)
    const bigContent = lines.join('\n')
    expect(bigContent.length).toBeGreaterThan(50_000)

    mockedReadFileSync.mockReturnValue(bigContent)
    const result = loadMemory()

    // Should have written truncated content back to file
    expect(mockedWriteFileSync).toHaveBeenCalledWith(CONTEXT_FILE, expect.any(String))
    // Truncated to last 500 lines
    const writtenContent = mockedWriteFileSync.mock.calls[0][1] as string
    expect(writtenContent.split('\n')).toHaveLength(500)
    // Result should match what was written
    expect(result).toBe(writtenContent)
  })

  it('returns empty string when readFileSync throws', () => {
    mockedExistsSync.mockReturnValue(true)
    mockedReadFileSync.mockImplementation(() => {
      throw new Error('EACCES: permission denied')
    })
    expect(loadMemory()).toBe('')
  })

  it('does not truncate content exactly at the 50KB boundary', () => {
    mockedExistsSync.mockReturnValue(true)
    const exactContent = 'a'.repeat(50_000)
    mockedReadFileSync.mockReturnValue(exactContent)
    const result = loadMemory()
    // At exactly 50,000 chars, the > check should NOT truncate
    expect(mockedWriteFileSync).not.toHaveBeenCalled()
    expect(result).toBe(exactContent)
  })

  it('does not create dir if it already exists', () => {
    mockedExistsSync.mockReturnValueOnce(true)  // dir exists
    mockedExistsSync.mockReturnValueOnce(false)  // file doesn't exist
    loadMemory()
    expect(mockedMkdirSync).not.toHaveBeenCalled()
  })
})

// ─── appendMemory ────────────────────────────────────────────────────────

describe('appendMemory', () => {
  it('appends a timestamped entry to the context file', () => {
    mockedExistsSync.mockReturnValue(true)
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-03-29T12:00:00Z'))

    appendMemory('User prefers TypeScript.')

    expect(mockedAppendFileSync).toHaveBeenCalledWith(
      CONTEXT_FILE,
      '\n## 2026-03-29\nUser prefers TypeScript.\n',
    )

    vi.useRealTimers()
  })

  it('creates memory dir if it does not exist', () => {
    mockedExistsSync.mockReturnValueOnce(false)
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-01-01T00:00:00Z'))

    appendMemory('test')

    expect(mockedMkdirSync).toHaveBeenCalledWith(MEMORY_DIR, { recursive: true })
    vi.useRealTimers()
  })

  it('handles empty entry string', () => {
    mockedExistsSync.mockReturnValue(true)
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-06-15T00:00:00Z'))

    appendMemory('')

    expect(mockedAppendFileSync).toHaveBeenCalledWith(
      CONTEXT_FILE,
      '\n## 2026-06-15\n\n',
    )
    vi.useRealTimers()
  })
})

// ─── clearMemory ─────────────────────────────────────────────────────────

describe('clearMemory', () => {
  it('writes the default header to the context file', () => {
    mockedExistsSync.mockReturnValue(true)
    clearMemory()
    expect(mockedWriteFileSync).toHaveBeenCalledWith(
      CONTEXT_FILE,
      '# kbot Memory\n\nPersistent knowledge across sessions.\n',
    )
  })

  it('creates memory dir if needed', () => {
    mockedExistsSync.mockReturnValueOnce(false)
    clearMemory()
    expect(mockedMkdirSync).toHaveBeenCalledWith(MEMORY_DIR, { recursive: true })
  })
})

// ─── getMemoryPrompt ─────────────────────────────────────────────────────

describe('getMemoryPrompt', () => {
  it('returns empty string when memory is empty', () => {
    mockedExistsSync.mockReturnValueOnce(true)  // dir
    mockedExistsSync.mockReturnValueOnce(false)  // file
    expect(getMemoryPrompt()).toBe('')
  })

  it('returns empty string when memory is only whitespace', () => {
    mockedExistsSync.mockReturnValue(true)
    mockedReadFileSync.mockReturnValue('   \n\n  ')
    expect(getMemoryPrompt()).toBe('')
  })

  it('wraps memory content in [Persistent Memory] block', () => {
    mockedExistsSync.mockReturnValue(true)
    mockedReadFileSync.mockReturnValue('User uses Ableton Live.')
    const result = getMemoryPrompt()
    expect(result).toContain('[Persistent Memory]')
    expect(result).toContain('User uses Ableton Live.')
  })
})

// ─── addTurn / getHistory ────────────────────────────────────────────────

describe('addTurn / getHistory', () => {
  it('starts with empty history', () => {
    expect(getHistory()).toEqual([])
  })

  it('adds a user turn', () => {
    addTurn({ role: 'user', content: 'Hello' })
    expect(getHistory()).toHaveLength(1)
    expect(getHistory()[0]).toEqual({ role: 'user', content: 'Hello' })
  })

  it('adds multiple turns in order', () => {
    addTurn({ role: 'user', content: 'Hi' })
    addTurn({ role: 'assistant', content: 'Hello!' })
    addTurn({ role: 'user', content: 'How are you?' })

    const history = getHistory()
    expect(history).toHaveLength(3)
    expect(history[0].role).toBe('user')
    expect(history[1].role).toBe('assistant')
    expect(history[2].role).toBe('user')
  })

  it('caps history at 20 turns, keeping the most recent', () => {
    for (let i = 0; i < 25; i++) {
      addTurn({ role: i % 2 === 0 ? 'user' : 'assistant', content: `msg-${i}` })
    }
    const history = getHistory()
    expect(history).toHaveLength(20)
    // First entry should be msg-5 (25 - 20 = 5)
    expect(history[0].content).toBe('msg-5')
    // Last entry should be msg-24
    expect(history[19].content).toBe('msg-24')
  })

  it('handles empty content in a turn', () => {
    addTurn({ role: 'user', content: '' })
    expect(getHistory()).toHaveLength(1)
    expect(getHistory()[0].content).toBe('')
  })
})

// ─── clearHistory ────────────────────────────────────────────────────────

describe('clearHistory', () => {
  it('resets history to empty', () => {
    addTurn({ role: 'user', content: 'test' })
    addTurn({ role: 'assistant', content: 'reply' })
    expect(getHistory()).toHaveLength(2)

    clearHistory()
    expect(getHistory()).toEqual([])
  })

  it('is safe to call when already empty', () => {
    clearHistory()
    expect(getHistory()).toEqual([])
  })
})

// ─── getPreviousMessages ─────────────────────────────────────────────────

describe('getPreviousMessages', () => {
  it('returns empty array when history is empty', () => {
    expect(getPreviousMessages()).toEqual([])
  })

  it('returns all turns when fewer than 16', () => {
    addTurn({ role: 'user', content: 'a' })
    addTurn({ role: 'assistant', content: 'b' })
    const msgs = getPreviousMessages()
    expect(msgs).toHaveLength(2)
    expect(msgs[0]).toEqual({ role: 'user', content: 'a' })
  })

  it('returns only the last 16 turns when history is larger', () => {
    for (let i = 0; i < 20; i++) {
      addTurn({ role: i % 2 === 0 ? 'user' : 'assistant', content: `m-${i}` })
    }
    const msgs = getPreviousMessages()
    expect(msgs).toHaveLength(16)
    // First message in the slice should be m-4 (20 - 16 = 4)
    expect(msgs[0].content).toBe('m-4')
    expect(msgs[15].content).toBe('m-19')
  })

  it('returns plain objects with role and content only', () => {
    addTurn({ role: 'user', content: 'test' })
    const msgs = getPreviousMessages()
    expect(Object.keys(msgs[0])).toEqual(['role', 'content'])
  })
})

// ─── compactHistory ──────────────────────────────────────────────────────

describe('compactHistory', () => {
  it('does not compact when history has 4 or fewer turns', () => {
    addTurn({ role: 'user', content: 'one' })
    addTurn({ role: 'assistant', content: 'two' })
    const result = compactHistory()
    expect(result.before).toBe(2)
    expect(result.after).toBe(2)
    expect(result.summary).toContain('too short')
  })

  it('does not compact when history has exactly 4 turns', () => {
    for (let i = 0; i < 4; i++) {
      addTurn({ role: i % 2 === 0 ? 'user' : 'assistant', content: `turn-${i}` })
    }
    const result = compactHistory()
    expect(result.before).toBe(4)
    expect(result.after).toBe(4)
    expect(result.summary).toContain('too short')
  })

  it('compacts history with more than 4 turns', () => {
    for (let i = 0; i < 10; i++) {
      addTurn({ role: i % 2 === 0 ? 'user' : 'assistant', content: `turn-${i}` })
    }
    const result = compactHistory()
    expect(result.before).toBe(10)
    // After: 1 summary turn + 4 verbatim = 5
    expect(result.after).toBe(5)
    expect(result.summary).toContain('Compacted 10 turns')
  })

  it('preserves the last 4 turns verbatim after compaction', () => {
    for (let i = 0; i < 8; i++) {
      addTurn({ role: i % 2 === 0 ? 'user' : 'assistant', content: `msg-${i}` })
    }
    compactHistory()
    const history = getHistory()
    // Last 4 should be msg-4, msg-5, msg-6, msg-7
    expect(history[history.length - 4].content).toBe('msg-4')
    expect(history[history.length - 3].content).toBe('msg-5')
    expect(history[history.length - 2].content).toBe('msg-6')
    expect(history[history.length - 1].content).toBe('msg-7')
  })

  it('creates a summary turn as the first entry', () => {
    for (let i = 0; i < 6; i++) {
      addTurn({ role: i % 2 === 0 ? 'user' : 'assistant', content: `topic-${i}` })
    }
    compactHistory()
    const history = getHistory()
    expect(history[0].role).toBe('assistant')
    expect(history[0].content).toContain('Conversation summary')
  })

  it('includes user messages in the summary', () => {
    addTurn({ role: 'user', content: 'How do I deploy to production?' })
    addTurn({ role: 'assistant', content: 'You can use the deploy command.' })
    addTurn({ role: 'user', content: 'What about staging?' })
    addTurn({ role: 'assistant', content: 'Use the staging flag.' })
    addTurn({ role: 'user', content: 'Thanks!' })
    addTurn({ role: 'assistant', content: 'Welcome!' })
    // First 2 turns will be summarized (the rest are kept verbatim)
    compactHistory()
    const summary = getHistory()[0].content
    expect(summary).toContain('User asked about')
    expect(summary).toContain('deploy to production')
  })

  it('includes assistant topics in the summary', () => {
    addTurn({ role: 'user', content: 'Help me' })
    addTurn({ role: 'assistant', content: 'I can help with deployments.\nHere are the details...' })
    addTurn({ role: 'user', content: 'Next' })
    addTurn({ role: 'assistant', content: 'Moving on...' })
    addTurn({ role: 'user', content: 'Final' })
    addTurn({ role: 'assistant', content: 'Done' })
    compactHistory()
    const summary = getHistory()[0].content
    expect(summary).toContain('Topics covered')
    expect(summary).toContain('I can help with deployments')
  })

  it('truncates long user messages in summary to 100 chars', () => {
    const longMessage = 'A'.repeat(200)
    addTurn({ role: 'user', content: longMessage })
    addTurn({ role: 'assistant', content: 'ok' })
    addTurn({ role: 'user', content: 'keep1' })
    addTurn({ role: 'assistant', content: 'keep2' })
    addTurn({ role: 'user', content: 'keep3' })
    addTurn({ role: 'assistant', content: 'keep4' })
    compactHistory()
    const summary = getHistory()[0].content
    // The long message should be sliced to 100 chars in the summary
    expect(summary).not.toContain('A'.repeat(200))
    expect(summary).toContain('A'.repeat(100))
  })

  it('is idempotent on already-compacted history', () => {
    for (let i = 0; i < 10; i++) {
      addTurn({ role: i % 2 === 0 ? 'user' : 'assistant', content: `x-${i}` })
    }
    const first = compactHistory()
    // Now history is 5 turns — compacting again should produce 5 again
    const second = compactHistory()
    expect(second.before).toBe(first.after)
    expect(second.after).toBe(5)
  })
})

// ─── restoreHistory ──────────────────────────────────────────────────────

describe('restoreHistory', () => {
  it('restores turns into session history', () => {
    const turns: ConversationTurn[] = [
      { role: 'user', content: 'restored message' },
      { role: 'assistant', content: 'restored reply' },
    ]
    restoreHistory(turns)
    expect(getHistory()).toHaveLength(2)
    expect(getHistory()[0].content).toBe('restored message')
  })

  it('caps restored history at 20 turns', () => {
    const turns: ConversationTurn[] = Array.from({ length: 30 }, (_, i) => ({
      role: (i % 2 === 0 ? 'user' : 'assistant') as 'user' | 'assistant',
      content: `restored-${i}`,
    }))
    restoreHistory(turns)
    const history = getHistory()
    expect(history).toHaveLength(20)
    // Should keep the last 20 (indices 10-29)
    expect(history[0].content).toBe('restored-10')
    expect(history[19].content).toBe('restored-29')
  })

  it('does not mutate the original array', () => {
    const turns: ConversationTurn[] = [
      { role: 'user', content: 'original' },
    ]
    restoreHistory(turns)
    addTurn({ role: 'assistant', content: 'new' })
    // The original array should still have just 1 element
    expect(turns).toHaveLength(1)
  })

  it('replaces any existing history', () => {
    addTurn({ role: 'user', content: 'old' })
    addTurn({ role: 'assistant', content: 'old reply' })
    restoreHistory([{ role: 'user', content: 'fresh' }])
    expect(getHistory()).toHaveLength(1)
    expect(getHistory()[0].content).toBe('fresh')
  })

  it('handles empty array', () => {
    addTurn({ role: 'user', content: 'something' })
    restoreHistory([])
    expect(getHistory()).toEqual([])
  })
})
