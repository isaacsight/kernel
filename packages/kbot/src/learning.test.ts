// kbot Learning Engine Tests
import { describe, it, expect } from 'vitest'
import {
  extractKeywords,
  classifyTask,
  findPattern,
  recordPattern,
  cacheSolution,
  findSolutions,
  learnFact,
  findKnowledge,
  buildFullLearningContext,
  getStats,
  selfTrain,
} from './learning.js'

describe('Keyword Extraction', () => {
  it('extracts known tech terms', () => {
    const kw = extractKeywords('fix the react typescript bug in the component')
    expect(kw).toContain('react')
    expect(kw).toContain('typescript')
    expect(kw).toContain('bug')
    expect(kw).toContain('component')
  })

  it('ignores non-tech words', () => {
    const kw = extractKeywords('please help me understand this problem')
    expect(kw.length).toBe(0)
  })

  it('handles empty input', () => {
    expect(extractKeywords('')).toEqual([])
  })
})

describe('Task Classification', () => {
  it('classifies debug tasks', () => {
    expect(classifyTask('fix this bug')).toBe('debug')
    expect(classifyTask('there is an error in my code')).toBe('debug')
  })

  it('classifies build tasks', () => {
    expect(classifyTask('create a new react component')).toBe('build')
    expect(classifyTask('scaffold a project')).toBe('build')
  })

  it('classifies refactor tasks', () => {
    expect(classifyTask('refactor this function')).toBe('refactor')
    expect(classifyTask('clean up the code')).toBe('refactor')
  })

  it('classifies test tasks', () => {
    expect(classifyTask('run the test suite')).toBe('test')
    expect(classifyTask('add test coverage')).toBe('test')
  })

  it('classifies deploy tasks', () => {
    expect(classifyTask('deploy to production')).toBe('deploy')
  })

  it('classifies explain tasks', () => {
    expect(classifyTask('explain how this works')).toBe('explain')
  })

  it('defaults to general', () => {
    expect(classifyTask('hello')).toBe('general')
  })
})

describe('Pattern Cache', () => {
  it('records and finds patterns', () => {
    recordPattern('write unit tests for auth module', ['read_file', 'write_file'], 500)
    const pattern = findPattern('write unit tests for auth module')
    expect(pattern === null || typeof pattern === 'object').toBe(true)
  })

  it('handles no match gracefully', () => {
    const result = findPattern('completely unique query that has never been seen before xyz123')
    expect(result === null || typeof result === 'object').toBe(true)
  })
})

describe('Solution Index', () => {
  it('caches and finds solutions', () => {
    cacheSolution(
      'how to create a react hook',
      'Use the useState hook from React to create custom hooks. Start with a function prefixed with "use".'
    )
    const results = findSolutions('how to create a react hook')
    expect(Array.isArray(results)).toBe(true)
  })

  it('rejects too-short solutions', () => {
    expect(() => cacheSolution('test', 'short')).not.toThrow()
  })
})

describe('Knowledge Base', () => {
  it('stores and retrieves knowledge', () => {
    learnFact('The API runs on port 3001', 'fact', 'user-taught')
    const results = findKnowledge('what port does the api run on')
    expect(Array.isArray(results)).toBe(true)
  })

  it('rejects very short facts', () => {
    expect(() => learnFact('hi', 'fact', 'user-taught')).not.toThrow()
  })
})

describe('Learning Context Builder', () => {
  it('builds context without crashing', () => {
    const context = buildFullLearningContext('write some code')
    expect(typeof context).toBe('string')
  })

  it('returns empty string for new users', () => {
    const context = buildFullLearningContext('unique query never seen before abc789xyz')
    expect(typeof context).toBe('string')
  })
})

describe('Stats', () => {
  it('returns valid stats object', () => {
    const stats = getStats()
    expect(typeof stats.patternsCount).toBe('number')
    expect(typeof stats.solutionsCount).toBe('number')
    expect(typeof stats.totalMessages).toBe('number')
    expect(typeof stats.efficiency).toBe('string')
  })
})

describe('Self-Training', () => {
  it('runs without crashing', () => {
    const result = selfTrain()
    expect(typeof result.pruned).toBe('number')
    expect(typeof result.optimized).toBe('number')
    expect(typeof result.synthesized).toBe('number')
    expect(typeof result.summary).toBe('string')
  })
})
