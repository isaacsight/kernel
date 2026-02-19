import { describe, it, expect } from 'vitest'
import { calculateNextRunAt, type TaskSchedule } from './Scheduler'

// Use a fixed reference date to avoid timezone flakiness
function refDate(hours: number, minutes: number): Date {
  const d = new Date(2026, 1, 18, hours, minutes, 0, 0) // Feb 18, 2026 (Wednesday)
  return d
}

describe('calculateNextRunAt', () => {
  it('daily — returns today if time not yet passed', () => {
    const schedule: TaskSchedule = { type: 'daily', time: '14:00' }
    const from = refDate(10, 0) // 10:00 AM
    const result = calculateNextRunAt(schedule, from)
    expect(result.getHours()).toBe(14)
    expect(result.getMinutes()).toBe(0)
    expect(result.getDate()).toBe(from.getDate())
  })

  it('daily — returns tomorrow if time has passed', () => {
    const schedule: TaskSchedule = { type: 'daily', time: '08:00' }
    const from = refDate(10, 0) // 10:00 AM, past 8 AM
    const result = calculateNextRunAt(schedule, from)
    expect(result.getHours()).toBe(8)
    expect(result.getDate()).toBe(from.getDate() + 1)
  })

  it('weekdays — skips to Monday on Friday', () => {
    // Feb 20, 2026 is a Friday
    const friday = new Date(2026, 1, 20, 10, 0, 0, 0)
    const schedule: TaskSchedule = { type: 'weekdays', time: '09:00' }
    const result = calculateNextRunAt(schedule, friday)
    // Should skip Saturday (21) and Sunday (22), land on Monday (23)
    expect(result.getDay()).toBe(1) // Monday
    expect(result.getDate()).toBe(23)
  })

  it('weekly — returns target day this week if ahead', () => {
    // Wed Feb 18, target Friday (day 5)
    const from = refDate(10, 0)
    const schedule: TaskSchedule = { type: 'weekly', time: '09:00', dayOfWeek: 5 }
    const result = calculateNextRunAt(schedule, from)
    expect(result.getDay()).toBe(5) // Friday
    expect(result.getDate()).toBe(20) // Feb 20
  })

  it('once — returns today if time not yet passed', () => {
    const schedule: TaskSchedule = { type: 'once', time: '15:00' }
    const from = refDate(10, 0)
    const result = calculateNextRunAt(schedule, from)
    expect(result.getHours()).toBe(15)
    expect(result.getDate()).toBe(from.getDate())
  })

  it('once — returns tomorrow if time has passed', () => {
    const schedule: TaskSchedule = { type: 'once', time: '08:00' }
    const from = refDate(10, 0)
    const result = calculateNextRunAt(schedule, from)
    expect(result.getHours()).toBe(8)
    expect(result.getDate()).toBe(from.getDate() + 1)
  })
})
