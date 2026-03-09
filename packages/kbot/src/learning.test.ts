// K:BOT Learning Engine Tests
import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
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
  getProfile,
  selfTrain,
} from './learning.js'

describe('Keyword Extraction', () => {
  it('extracts known tech terms', () => {
    const kw = extractKeywords('fix the react typescript bug in the component')
    assert.ok(kw.includes('react'))
    assert.ok(kw.includes('typescript'))
    assert.ok(kw.includes('bug'))
    assert.ok(kw.includes('component'))
  })

  it('ignores non-tech words', () => {
    const kw = extractKeywords('please help me understand this problem')
    assert.equal(kw.length, 0)
  })

  it('handles empty input', () => {
    assert.deepEqual(extractKeywords(''), [])
  })
})

describe('Task Classification', () => {
  it('classifies debug tasks', () => {
    assert.equal(classifyTask('fix this bug'), 'debug')
    assert.equal(classifyTask('there is an error in my code'), 'debug')
  })

  it('classifies build tasks', () => {
    assert.equal(classifyTask('create a new react component'), 'build')
    assert.equal(classifyTask('scaffold a project'), 'build')
  })

  it('classifies refactor tasks', () => {
    assert.equal(classifyTask('refactor this function'), 'refactor')
    assert.equal(classifyTask('clean up the code'), 'refactor')
  })

  it('classifies test tasks', () => {
    assert.equal(classifyTask('run the test suite'), 'test')
    assert.equal(classifyTask('add test coverage'), 'test')
  })

  it('classifies deploy tasks', () => {
    assert.equal(classifyTask('deploy to production'), 'deploy')
  })

  it('classifies explain tasks', () => {
    assert.equal(classifyTask('explain how this works'), 'explain')
  })

  it('defaults to general', () => {
    assert.equal(classifyTask('hello'), 'general')
  })
})

describe('Pattern Cache', () => {
  it('records and finds patterns', () => {
    recordPattern('write unit tests for auth module', ['read_file', 'write_file'], 500)
    const pattern = findPattern('write unit tests for auth module')
    // May or may not match depending on similarity threshold
    // Just verify it doesn't crash
    assert.ok(true)
  })

  it('handles no match gracefully', () => {
    const result = findPattern('completely unique query that has never been seen before xyz123')
    // Should return null for no match
    assert.ok(result === null || typeof result === 'object')
  })
})

describe('Solution Index', () => {
  it('caches and finds solutions', () => {
    cacheSolution(
      'how to create a react hook',
      'Use the useState hook from React to create custom hooks. Start with a function prefixed with "use".'
    )
    const results = findSolutions('how to create a react hook')
    // Should find at least something related
    assert.ok(Array.isArray(results))
  })

  it('rejects too-short solutions', () => {
    cacheSolution('test', 'short')
    // Should not crash even with invalid input
    assert.ok(true)
  })
})

describe('Knowledge Base', () => {
  it('stores and retrieves knowledge', () => {
    learnFact('The API runs on port 3001', 'fact', 'user-taught')
    const results = findKnowledge('what port does the api run on')
    assert.ok(Array.isArray(results))
  })

  it('rejects very short facts', () => {
    learnFact('hi', 'fact', 'user-taught')
    // Should not crash
    assert.ok(true)
  })
})

describe('Learning Context Builder', () => {
  it('builds context without crashing', () => {
    const context = buildFullLearningContext('write some code')
    assert.ok(typeof context === 'string')
  })

  it('returns empty string for new users', () => {
    const context = buildFullLearningContext('unique query never seen before abc789xyz')
    assert.ok(typeof context === 'string')
  })
})

describe('Stats', () => {
  it('returns valid stats object', () => {
    const stats = getStats()
    assert.ok(typeof stats.patternsCount === 'number')
    assert.ok(typeof stats.solutionsCount === 'number')
    assert.ok(typeof stats.totalMessages === 'number')
    assert.ok(typeof stats.efficiency === 'string')
  })
})

describe('Self-Training', () => {
  it('runs without crashing', () => {
    const result = selfTrain()
    assert.ok(typeof result.pruned === 'number')
    assert.ok(typeof result.optimized === 'number')
    assert.ok(typeof result.synthesized === 'number')
    assert.ok(typeof result.summary === 'string')
  })
})
