import { describe, it, expect } from 'vitest'
import { shouldCheckIn, getGoalsDueForCheckIn, getGoalCheckInPrompt, type UserGoal } from './GoalTracker'

function makeGoal(overrides: Partial<UserGoal> = {}): UserGoal {
  return {
    id: 'g1',
    user_id: 'u1',
    title: 'Learn Rust',
    description: 'Learn the Rust programming language',
    category: 'learning',
    status: 'active',
    priority: 'medium',
    target_date: null,
    milestones: [],
    progress_notes: [],
    check_in_frequency: 'daily',
    last_check_in_at: null,
    ...overrides,
  }
}

describe('shouldCheckIn', () => {
  it('returns true for active goal with no last_check_in_at', () => {
    expect(shouldCheckIn(makeGoal())).toBe(true)
  })

  it('returns true for daily goal overdue by 25 hours', () => {
    const lastCheckIn = new Date(Date.now() - 25 * 60 * 60 * 1000).toISOString()
    expect(shouldCheckIn(makeGoal({ last_check_in_at: lastCheckIn }))).toBe(true)
  })

  it('returns false for daily goal checked in 1 hour ago', () => {
    const lastCheckIn = new Date(Date.now() - 60 * 60 * 1000).toISOString()
    expect(shouldCheckIn(makeGoal({ last_check_in_at: lastCheckIn }))).toBe(false)
  })

  it('returns false for completed goal', () => {
    expect(shouldCheckIn(makeGoal({ status: 'completed' }))).toBe(false)
  })

  it('returns true for weekly goal overdue by 8 days', () => {
    const lastCheckIn = new Date(Date.now() - 8 * 24 * 60 * 60 * 1000).toISOString()
    expect(shouldCheckIn(makeGoal({ check_in_frequency: 'weekly', last_check_in_at: lastCheckIn }))).toBe(true)
  })
})

describe('getGoalsDueForCheckIn', () => {
  it('filters correctly from mixed array', () => {
    const goals = [
      makeGoal({ id: 'g1', status: 'active', last_check_in_at: null }), // due
      makeGoal({ id: 'g2', status: 'completed' }), // not due
      makeGoal({ id: 'g3', status: 'active', last_check_in_at: new Date().toISOString() }), // recently checked
    ]
    const due = getGoalsDueForCheckIn(goals)
    expect(due).toHaveLength(1)
    expect(due[0].id).toBe('g1')
  })
})

describe('getGoalCheckInPrompt', () => {
  it('returns formatted prompt when goals are due', () => {
    const goals = [makeGoal({ last_check_in_at: null })]
    const prompt = getGoalCheckInPrompt(goals)
    expect(prompt).toContain('Learn Rust')
    expect(prompt).toContain('Active Goals')
  })

  it('returns empty string when no goals are due', () => {
    const goals = [makeGoal({ status: 'completed' })]
    expect(getGoalCheckInPrompt(goals)).toBe('')
  })
})
