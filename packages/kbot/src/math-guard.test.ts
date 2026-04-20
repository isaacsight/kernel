import { describe, it } from 'vitest'
import assert from 'node:assert/strict'
import { extractArithmetic, buildMathGuardBlock } from './math-guard.js'

describe('math-guard — word-form operators', () => {
  it('"847 times 239" = 202433', () => {
    const out = extractArithmetic('Calculate 847 times 239.')
    assert.equal(out.length, 1)
    assert.equal(out[0].result, 202433)
  })

  it('"3 plus 4" = 7', () => {
    assert.equal(extractArithmetic('3 plus 4')[0].result, 7)
  })

  it('"10 divided by 2" = 5', () => {
    assert.equal(extractArithmetic('10 divided by 2')[0].result, 5)
  })

  it('"8 minus 3" = 5', () => {
    assert.equal(extractArithmetic('what is 8 minus 3')[0].result, 5)
  })
})

describe('math-guard — extract single expressions', () => {
  it('catches the original probe failure: 847 * 239 = 202433', () => {
    const out = extractArithmetic('What is 847 * 239?')
    assert.equal(out.length, 1)
    assert.equal(out[0].result, 202433)
  })

  it('handles × unicode multiplication', () => {
    const out = extractArithmetic('compute 12 × 11')
    assert.equal(out[0].result, 132)
  })

  it('handles addition, subtraction, division, modulo', () => {
    assert.equal(extractArithmetic('9 + 7')[0].result, 16)
    assert.equal(extractArithmetic('9 - 7')[0].result, 2)
    assert.equal(extractArithmetic('84 / 7')[0].result, 12)
    assert.equal(extractArithmetic('84 % 9')[0].result, 3)
  })

  it('handles decimals', () => {
    const out = extractArithmetic('what is 3.14 * 2')
    assert.equal(out[0].result, 6.28)
  })

  it('skips divide by zero', () => {
    assert.equal(extractArithmetic('5 / 0').length, 0)
  })
})

describe('math-guard — skip non-arithmetic', () => {
  it('no expressions → empty array', () => {
    assert.deepEqual(extractArithmetic('hello world'), [])
  })

  it('does not match version numbers like v3.99.22', () => {
    const out = extractArithmetic('What version is v3.99.22?')
    assert.equal(out.length, 0)
  })

  it('does not match inside words like abc123*456xyz', () => {
    // Negative lookarounds prevent word-embedded matches.
    const out = extractArithmetic('token abc123*456xyz')
    assert.equal(out.length, 0)
  })

  it('does match 123 * 456 when whitespace-delimited', () => {
    const out = extractArithmetic('compute 123 * 456 please')
    assert.equal(out.length, 1)
    assert.equal(out[0].result, 56088)
  })
})

describe('math-guard — dedupe and cap', () => {
  it('deduplicates identical expressions', () => {
    const out = extractArithmetic('2 + 2 and 2 + 2 and again 2 + 2')
    assert.equal(out.length, 1)
  })

  it('caps at 10 distinct expressions', () => {
    const exprs = Array.from({ length: 15 }, (_, i) => `${i + 1} + 1`).join(', ')
    const out = extractArithmetic(exprs)
    assert.equal(out.length, 10)
  })
})

describe('math-guard — block builder', () => {
  it('returns empty string when no arithmetic', () => {
    assert.equal(buildMathGuardBlock('hello'), '')
  })

  it('emits a formatted ground-truth block', () => {
    const block = buildMathGuardBlock('What is 847 * 239?')
    assert.match(block, /MATH GUARD/)
    assert.match(block, /847 \* 239 = 202433/)
  })

  it('lists multiple expressions on separate lines', () => {
    const block = buildMathGuardBlock('compute 2+2 and 3*4')
    const lines = block.trim().split('\n')
    assert.equal(lines.length, 3) // header + 2 expressions
  })
})
