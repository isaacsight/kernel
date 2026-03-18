// Tests for kbot Sessions — formatSessionList
import { describe, it, expect } from 'vitest'
import { formatSessionList, type Session } from './sessions.js'

describe('formatSessionList', () => {
  it('shows message for empty list', () => {
    expect(formatSessionList([])).toContain('No saved sessions')
  })

  it('formats sessions with metadata', () => {
    const sessions: Session[] = [
      {
        id: 'test-session-1',
        name: 'Test Session',
        created: '2026-03-13T10:00:00.000Z',
        updated: '2026-03-13T11:00:00.000Z',
        cwd: '/home/user/project',
        turnCount: 10,
        preview: 'How do I fix the auth bug?',
        history: [],
      },
    ]
    const result = formatSessionList(sessions)
    expect(result).toContain('test-session-1')
    expect(result).toContain('10 turns')
    expect(result).toContain('auth bug')
  })

  it('limits display to 15 sessions', () => {
    const sessions: Session[] = Array.from({ length: 20 }, (_, i) => ({
      id: `session-${i}`,
      name: `Session ${i}`,
      created: '2026-03-13T10:00:00.000Z',
      updated: '2026-03-13T10:00:00.000Z',
      cwd: '/tmp',
      turnCount: 1,
      preview: `Message ${i}`,
      history: [],
    }))
    const result = formatSessionList(sessions)
    expect(result).toContain('and 5 more')
  })

  it('truncates long previews', () => {
    const sessions: Session[] = [{
      id: 'long-preview',
      name: 'Long',
      created: '2026-03-13T10:00:00.000Z',
      updated: '2026-03-13T10:00:00.000Z',
      cwd: '/tmp',
      turnCount: 1,
      preview: 'A'.repeat(200),
      history: [],
    }]
    const result = formatSessionList(sessions)
    expect(result).toContain('...')
  })
})
