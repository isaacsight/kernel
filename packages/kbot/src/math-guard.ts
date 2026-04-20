/**
 * Math guard — pre-computes arithmetic in user messages.
 *
 * Reality-check probes (2026-04-20) showed kbot answering "847 × 239 = 1,985,633"
 * (correct: 202,433) — an order-of-magnitude RF-16 arithmetic error. This module
 * scans the user message for basic arithmetic expressions, evaluates them in JS,
 * and returns a ground-truth block to prepend so the LLM sees the correct answer
 * as input rather than relying on learned priors.
 *
 * Scope: single-operator expressions only — `a op b` where op ∈ {+,-,*,×,/,÷,%}.
 * Compound expressions, parentheses, unary minus: not handled. The failure mode
 * when this module doesn't match is "guard did not fire" — the LLM sees the raw
 * message unchanged, same as today. So false negatives are safe.
 *
 * No eval(), no Function(). Pure regex + arithmetic.
 */

const EXPR_RE = /(?<!\w)(-?\d+(?:\.\d+)?)\s*([+\-*×/÷%])\s*(-?\d+(?:\.\d+)?)(?!\w)/g

export interface ComputedExpression {
  expression: string
  result: number
}

function normalizeOp(op: string): '+' | '-' | '*' | '/' | '%' | null {
  switch (op) {
    case '+': return '+'
    case '-': return '-'
    case '*':
    case '×': return '*'
    case '/':
    case '÷': return '/'
    case '%': return '%'
    default: return null
  }
}

function compute(a: number, op: string, b: number): number | null {
  const norm = normalizeOp(op)
  if (norm === null) return null
  switch (norm) {
    case '+': return a + b
    case '-': return a - b
    case '*': return a * b
    case '/': return b === 0 ? null : a / b
    case '%': return b === 0 ? null : a % b
  }
}

function formatResult(n: number): string {
  if (!Number.isFinite(n)) return String(n)
  if (Number.isInteger(n)) return n.toString()
  // Trim long floats; six digits is plenty for user-facing answers.
  return Number.parseFloat(n.toFixed(6)).toString()
}

/**
 * Find every `a op b` in the message and compute it.
 *
 * Returns at most 10 distinct expressions per message — more than that and the
 * user is probably pasting a table, not asking for arithmetic help.
 */
export function extractArithmetic(message: string): ComputedExpression[] {
  if (!message) return []
  const out: ComputedExpression[] = []
  const seen = new Set<string>()
  for (const m of message.matchAll(EXPR_RE)) {
    const raw = m[0].trim()
    if (seen.has(raw)) continue
    seen.add(raw)
    const a = Number.parseFloat(m[1])
    const b = Number.parseFloat(m[3])
    const r = compute(a, m[2], b)
    if (r === null || !Number.isFinite(r)) continue
    out.push({ expression: raw, result: r })
    if (out.length >= 10) break
  }
  return out
}

/**
 * Ground-truth preamble to prepend to the user message (or system prompt).
 * Returns empty string when no arithmetic is detected — callers can
 * concatenate unconditionally.
 */
export function buildMathGuardBlock(message: string): string {
  const exprs = extractArithmetic(message)
  if (exprs.length === 0) return ''
  const lines = exprs.map(e => `  ${e.expression} = ${formatResult(e.result)}`)
  return (
    '[MATH GUARD — computed deterministically in JS; use these values verbatim, ' +
    'do not recompute and do not contradict]\n' +
    lines.join('\n') +
    '\n'
  )
}
