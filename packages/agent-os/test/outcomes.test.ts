import { describe, expect, it } from 'vitest'
import {
  withOutcome,
  predicateEvaluator,
  weightedAverage,
  classify,
} from '../src/outcomes.js'
import type { Rubric, RubricEvaluation, RubricEvaluator, CriterionScore } from '../src/outcomes.js'

const SIMPLE_RUBRIC: Rubric = {
  criteria: [{ name: 'has_marker', description: 'contains the literal "OK"' }],
  satisfied_at: 0.85,
}

describe('withOutcome — happy path', () => {
  it('terminates with `satisfied` when the first attempt passes', async () => {
    const evaluator = predicateEvaluator(
      (work) => work.includes('OK'),
      SIMPLE_RUBRIC,
      'add the word OK',
    )
    const result = await withOutcome<string>(
      SIMPLE_RUBRIC,
      async () => 'this is OK',
      evaluator,
      { max_iterations: 5 },
    )
    expect(result.code).toBe('satisfied')
    expect(result.iterations_used).toBe(1)
    expect(result.final_work).toBe('this is OK')
  })

  it('iterates with feedback when the first attempt fails', async () => {
    const evaluator = predicateEvaluator(
      (work) => work.includes('OK'),
      SIMPLE_RUBRIC,
      'add the word OK',
    )
    let attempts = 0
    const result = await withOutcome<string>(
      SIMPLE_RUBRIC,
      async (feedback) => {
        attempts++
        if (attempts === 1) return 'first try'
        // On revision, the agent sees the feedback and acts on it.
        expect(feedback).toContain('add the word OK')
        return 'revised: OK'
      },
      evaluator,
      { max_iterations: 5 },
    )
    expect(result.code).toBe('satisfied')
    expect(result.iterations_used).toBe(2)
    expect(result.history).toHaveLength(2)
    expect(result.history[0]?.evaluation.verdict).toBe('needs_revision')
    expect(result.history[1]?.evaluation.verdict).toBe('satisfied')
  })
})

describe('withOutcome — termination paths', () => {
  it('returns `max_iterations_reached` when revision never succeeds', async () => {
    const evaluator = predicateEvaluator(
      () => false,
      SIMPLE_RUBRIC,
      'never satisfied',
    )
    const result = await withOutcome<string>(
      SIMPLE_RUBRIC,
      async () => 'always failing',
      evaluator,
      { max_iterations: 3 },
    )
    expect(result.code).toBe('max_iterations_reached')
    expect(result.iterations_used).toBe(3)
    expect(result.history).toHaveLength(3)
  })

  it('returns `failed` when the attempt function throws', async () => {
    const evaluator = predicateEvaluator(() => true, SIMPLE_RUBRIC, '')
    const result = await withOutcome<string>(
      SIMPLE_RUBRIC,
      async () => {
        throw new Error('boom')
      },
      evaluator,
      { max_iterations: 3 },
    )
    expect(result.code).toBe('failed')
    expect(result.iterations_used).toBe(0)
  })

  it('returns `failed` when the evaluator returns failed', async () => {
    const customEvaluator: RubricEvaluator = {
      async evaluate(): Promise<RubricEvaluation> {
        return {
          per_criterion: [{ name: 'has_marker', score: 0, feedback: 'fatal' }],
          overall_score: 0,
          verdict: 'failed',
        }
      },
    }
    const result = await withOutcome<string>(
      SIMPLE_RUBRIC,
      async () => 'anything',
      customEvaluator,
      { max_iterations: 5 },
    )
    expect(result.code).toBe('failed')
    expect(result.iterations_used).toBe(1)
  })

  it('returns `interrupted` when the signal is aborted before iteration', async () => {
    const evaluator = predicateEvaluator(() => false, SIMPLE_RUBRIC, '')
    const controller = new AbortController()
    controller.abort()
    const result = await withOutcome<string>(
      SIMPLE_RUBRIC,
      async () => 'unused',
      evaluator,
      { max_iterations: 3, signal: controller.signal },
    )
    expect(result.code).toBe('interrupted')
    expect(result.iterations_used).toBe(0)
  })
})

describe('weightedAverage', () => {
  const rubric: Rubric = {
    criteria: [
      { name: 'a', description: 'a', weight: 2 },
      { name: 'b', description: 'b', weight: 1 },
    ],
  }

  it('computes weighted average correctly', () => {
    const scores: CriterionScore[] = [
      { name: 'a', score: 1.0, feedback: '' },
      { name: 'b', score: 0.0, feedback: '' },
    ]
    // (1.0 * 2 + 0.0 * 1) / (2 + 1) = 0.6667
    expect(weightedAverage(scores, rubric)).toBeCloseTo(0.6667, 3)
  })

  it('treats missing weights as 1.0', () => {
    const noWeights: Rubric = {
      criteria: [
        { name: 'a', description: 'a' },
        { name: 'b', description: 'b' },
      ],
    }
    const scores: CriterionScore[] = [
      { name: 'a', score: 1.0, feedback: '' },
      { name: 'b', score: 0.0, feedback: '' },
    ]
    expect(weightedAverage(scores, noWeights)).toBe(0.5)
  })

  it('returns 0 for empty scores', () => {
    expect(weightedAverage([], rubric)).toBe(0)
  })
})

describe('classify', () => {
  it('uses default 0.85 threshold when satisfied_at is undefined', () => {
    const r: Rubric = { criteria: [{ name: 'a', description: 'a' }] }
    expect(classify(0.84, r)).toBe('needs_revision')
    expect(classify(0.85, r)).toBe('satisfied')
    expect(classify(1.0, r)).toBe('satisfied')
  })

  it('uses the specified threshold when satisfied_at is set', () => {
    const r: Rubric = { criteria: [{ name: 'a', description: 'a' }], satisfied_at: 0.5 }
    expect(classify(0.49, r)).toBe('needs_revision')
    expect(classify(0.5, r)).toBe('satisfied')
  })
})
