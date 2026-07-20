import { describe, it, expect } from 'vitest'
import { bodyFor } from './bodies'
import type { IssueRecord } from '../content/issues/schema'

describe('bodyFor', () => {
  it('resolves every issue to a sheet in M1', () => {
    expect(bodyFor({ number: '360' } as IssueRecord)).toBe('sheet')
    expect(bodyFor({ number: '427' } as IssueRecord)).toBe('sheet')
  })
})
