// kbot Lab Math Tools — Pure & Applied Mathematics
// Self-contained implementations: no external dependencies beyond Node.js built-ins.
// Covers symbolic computation, linear algebra, optimization, number theory,
// graph theory, combinatorics, differential equations, probability,
// Fourier analysis, and OEIS lookup.

import { registerTool } from './index.js'

// ─────────────────────────────────────────────────────────────────────────────
// §0  SHARED HELPERS
// ─────────────────────────────────────────────────────────────────────────────

/** Format a number for display, avoiding floating-point noise */
function fmt(n: number, digits = 8): string {
  if (Number.isInteger(n)) return String(n)
  const s = n.toPrecision(digits)
  // strip trailing zeros after decimal
  if (s.includes('.')) return s.replace(/\.?0+$/, '')
  return s
}

/** Safe JSON parse with error message */
function safeParse<T>(s: string, label: string): T {
  try {
    return JSON.parse(s) as T
  } catch {
    throw new Error(`Invalid JSON for ${label}: ${s}`)
  }
}

/** Gamma function via Lanczos approximation (real positive arguments) */
function gammaFn(z: number): number {
  if (z < 0.5) {
    return Math.PI / (Math.sin(Math.PI * z) * gammaFn(1 - z))
  }
  z -= 1
  const g = 7
  const c = [
    0.99999999999980993,
    676.5203681218851,
    -1259.1392167224028,
    771.32342877765313,
    -176.61502916214059,
    12.507343278686905,
    -0.13857109526572012,
    9.9843695780195716e-6,
    1.5056327351493116e-7,
  ]
  let x = c[0]
  for (let i = 1; i < g + 2; i++) {
    x += c[i] / (z + i)
  }
  const t = z + g + 0.5
  return Math.sqrt(2 * Math.PI) * Math.pow(t, z + 0.5) * Math.exp(-t) * x
}

/** Log-gamma for large arguments */
function lgamma(x: number): number {
  return Math.log(gammaFn(x))
}

/** Beta function */
function betaFn(a: number, b: number): number {
  return gammaFn(a) * gammaFn(b) / gammaFn(a + b)
}

/** Regularized incomplete beta function via continued fraction (Lentz) */
function betaInc(x: number, a: number, b: number): number {
  if (x <= 0) return 0
  if (x >= 1) return 1
  const lnBeta = lgamma(a) + lgamma(b) - lgamma(a + b)
  const front = Math.exp(Math.log(x) * a + Math.log(1 - x) * b - lnBeta) / a
  // Use the symmetry relation for better convergence
  if (x > (a + 1) / (a + b + 2)) {
    return 1 - betaInc(1 - x, b, a)
  }
  // Lentz continued fraction
  let f = 1, c = 1, d = 1 - (a + b) * x / (a + 1)
  if (Math.abs(d) < 1e-30) d = 1e-30
  d = 1 / d
  f = d
  for (let m = 1; m <= 200; m++) {
    // even step
    let num = m * (b - m) * x / ((a + 2 * m - 1) * (a + 2 * m))
    d = 1 + num * d; if (Math.abs(d) < 1e-30) d = 1e-30; d = 1 / d
    c = 1 + num / c; if (Math.abs(c) < 1e-30) c = 1e-30
    f *= d * c
    // odd step
    num = -(a + m) * (a + b + m) * x / ((a + 2 * m) * (a + 2 * m + 1))
    d = 1 + num * d; if (Math.abs(d) < 1e-30) d = 1e-30; d = 1 / d
    c = 1 + num / c; if (Math.abs(c) < 1e-30) c = 1e-30
    const delta = d * c
    f *= delta
    if (Math.abs(delta - 1) < 1e-12) break
  }
  return front * f
}

/** Regularized incomplete gamma function P(a,x) via series */
function gammaPSeries(a: number, x: number): number {
  if (x < 0) return 0
  if (x === 0) return 0
  let sum = 1 / a
  let term = 1 / a
  for (let n = 1; n < 300; n++) {
    term *= x / (a + n)
    sum += term
    if (Math.abs(term) < Math.abs(sum) * 1e-14) break
  }
  return sum * Math.exp(-x + a * Math.log(x) - lgamma(a))
}

/** Regularized incomplete gamma function Q(a,x) via continued fraction */
function gammaQCF(a: number, x: number): number {
  let f = x + 1 - a, c = 1e30, d = 1 / f
  let h = d
  for (let i = 1; i <= 300; i++) {
    const an = -i * (i - a)
    const bn = x + 2 * i + 1 - a
    d = bn + an * d; if (Math.abs(d) < 1e-30) d = 1e-30; d = 1 / d
    c = bn + an / c; if (Math.abs(c) < 1e-30) c = 1e-30
    const delta = d * c
    h *= delta
    if (Math.abs(delta - 1) < 1e-14) break
  }
  return Math.exp(-x + a * Math.log(x) - lgamma(a)) * h
}

/** Regularized lower incomplete gamma P(a, x) */
function gammaP(a: number, x: number): number {
  if (x < a + 1) return gammaPSeries(a, x)
  return 1 - gammaQCF(a, x)
}

/** Error function via Abramowitz & Stegun 7.1.26 */
function erf(x: number): number {
  const sign = x < 0 ? -1 : 1
  x = Math.abs(x)
  const t = 1 / (1 + 0.3275911 * x)
  const y = 1 - (((((1.061405429 * t - 1.453152027) * t) + 1.421413741) * t - 0.284496736) * t + 0.254829592) * t * Math.exp(-x * x)
  return sign * y
}

/** Standard normal CDF (Abramowitz & Stegun) */
function normalCDF(x: number): number {
  return 0.5 * (1 + erf(x / Math.SQRT2))
}

/** Standard normal PDF */
function normalPDF(x: number): number {
  return Math.exp(-0.5 * x * x) / Math.sqrt(2 * Math.PI)
}

/** Normal quantile (inverse CDF) via rational approximation (Peter Acklam) */
function normalQuantile(p: number): number {
  if (p <= 0) return -Infinity
  if (p >= 1) return Infinity
  if (p === 0.5) return 0
  const a = [
    -3.969683028665376e+01, 2.209460984245205e+02,
    -2.759285104469687e+02, 1.383577518672690e+02,
    -3.066479806614716e+01, 2.506628277459239e+00,
  ]
  const b = [
    -5.447609879822406e+01, 1.615858368580409e+02,
    -1.556989798598866e+02, 6.680131188771972e+01,
    -1.328068155288572e+01,
  ]
  const c = [
    -7.784894002430293e-03, -3.223964580411365e-01,
    -2.400758277161838e+00, -2.549732539343734e+00,
    4.374664141464968e+00, 2.938163982698783e+00,
  ]
  const d = [
    7.784695709041462e-03, 3.224671290700398e-01,
    2.445134137142996e+00, 3.754408661907416e+00,
  ]
  const pLow = 0.02425, pHigh = 1 - pLow
  let q: number, r: number
  if (p < pLow) {
    q = Math.sqrt(-2 * Math.log(p))
    return (((((c[0] * q + c[1]) * q + c[2]) * q + c[3]) * q + c[4]) * q + c[5]) /
           ((((d[0] * q + d[1]) * q + d[2]) * q + d[3]) * q + 1)
  } else if (p <= pHigh) {
    q = p - 0.5
    r = q * q
    return (((((a[0] * r + a[1]) * r + a[2]) * r + a[3]) * r + a[4]) * r + a[5]) * q /
           (((((b[0] * r + b[1]) * r + b[2]) * r + b[3]) * r + b[4]) * r + 1)
  } else {
    q = Math.sqrt(-2 * Math.log(1 - p))
    return -((((((c[0] * q + c[1]) * q + c[2]) * q + c[3]) * q + c[4]) * q + c[5]) /
            ((((d[0] * q + d[1]) * q + d[2]) * q + d[3]) * q + 1))
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// §1  SYMBOLIC COMPUTATION HELPERS
// ─────────────────────────────────────────────────────────────────────────────

type Expr =
  | { type: 'num'; value: number }
  | { type: 'var'; name: string }
  | { type: 'add'; left: Expr; right: Expr }
  | { type: 'sub'; left: Expr; right: Expr }
  | { type: 'mul'; left: Expr; right: Expr }
  | { type: 'div'; left: Expr; right: Expr }
  | { type: 'pow'; base: Expr; exp: Expr }
  | { type: 'neg'; arg: Expr }
  | { type: 'fn'; name: string; arg: Expr }

/** Tokenizer for math expressions */
function tokenize(expr: string): string[] {
  const tokens: string[] = []
  let i = 0
  while (i < expr.length) {
    if (/\s/.test(expr[i])) { i++; continue }
    if ('+-*/^(),'.includes(expr[i])) {
      tokens.push(expr[i])
      i++
    } else if (/[0-9.]/.test(expr[i])) {
      let num = ''
      while (i < expr.length && /[0-9.eE\-+]/.test(expr[i])) {
        // handle scientific notation carefully
        if ((expr[i] === '-' || expr[i] === '+') && num.length > 0 && !/[eE]/.test(num[num.length - 1])) break
        num += expr[i]
        i++
      }
      tokens.push(num)
    } else if (/[a-zA-Z_]/.test(expr[i])) {
      let id = ''
      while (i < expr.length && /[a-zA-Z0-9_]/.test(expr[i])) {
        id += expr[i]
        i++
      }
      tokens.push(id)
    } else {
      i++
    }
  }
  return tokens
}

const KNOWN_FNS = new Set(['sin', 'cos', 'tan', 'exp', 'log', 'ln', 'sqrt', 'abs', 'asin', 'acos', 'atan', 'sinh', 'cosh', 'tanh'])

/** Recursive descent parser: expr → term ((+|-) term)* */
function parseExpr(tokens: string[], pos: { i: number }): Expr {
  let left = parseTerm(tokens, pos)
  while (pos.i < tokens.length && (tokens[pos.i] === '+' || tokens[pos.i] === '-')) {
    const op = tokens[pos.i]; pos.i++
    const right = parseTerm(tokens, pos)
    left = op === '+' ? { type: 'add', left, right } : { type: 'sub', left, right }
  }
  return left
}

/** term → unary ((*|/) unary)* */
function parseTerm(tokens: string[], pos: { i: number }): Expr {
  let left = parseUnary(tokens, pos)
  while (pos.i < tokens.length && (tokens[pos.i] === '*' || tokens[pos.i] === '/')) {
    const op = tokens[pos.i]; pos.i++
    const right = parseUnary(tokens, pos)
    left = op === '*' ? { type: 'mul', left, right } : { type: 'div', left, right }
  }
  return left
}

/** unary → (-) unary | power */
function parseUnary(tokens: string[], pos: { i: number }): Expr {
  if (pos.i < tokens.length && tokens[pos.i] === '-') {
    pos.i++
    const arg = parseUnary(tokens, pos)
    if (arg.type === 'num') return { type: 'num', value: -arg.value }
    return { type: 'neg', arg }
  }
  if (pos.i < tokens.length && tokens[pos.i] === '+') {
    pos.i++
    return parseUnary(tokens, pos)
  }
  return parsePower(tokens, pos)
}

/** power → atom (^ unary)? */
function parsePower(tokens: string[], pos: { i: number }): Expr {
  let base = parseAtom(tokens, pos)
  if (pos.i < tokens.length && tokens[pos.i] === '^') {
    pos.i++
    const exp = parseUnary(tokens, pos) // right-associative
    base = { type: 'pow', base, exp }
  }
  return base
}

/** atom → number | fn(expr) | var | (expr) */
function parseAtom(tokens: string[], pos: { i: number }): Expr {
  if (pos.i >= tokens.length) throw new Error('Unexpected end of expression')
  const tok = tokens[pos.i]
  // Number
  if (/^[0-9]/.test(tok) || (tok === '.' && pos.i + 1 < tokens.length)) {
    pos.i++
    return { type: 'num', value: parseFloat(tok) }
  }
  // Named constant
  if (tok === 'pi' || tok === 'PI') { pos.i++; return { type: 'num', value: Math.PI } }
  if (tok === 'e' && (pos.i + 1 >= tokens.length || tokens[pos.i + 1] !== '(')) {
    // Only treat 'e' as Euler's number if not followed by '(' (which would be a function)
    if (pos.i + 1 >= tokens.length || !(/[a-zA-Z]/.test(tokens[pos.i + 1]))) {
      pos.i++; return { type: 'num', value: Math.E }
    }
  }
  // Function call
  if (KNOWN_FNS.has(tok) && pos.i + 1 < tokens.length && tokens[pos.i + 1] === '(') {
    const fnName = tok === 'ln' ? 'log' : tok
    pos.i += 2 // skip name + (
    const arg = parseExpr(tokens, pos)
    if (pos.i < tokens.length && tokens[pos.i] === ')') pos.i++
    return { type: 'fn', name: fnName, arg }
  }
  // Parenthesized expression
  if (tok === '(') {
    pos.i++
    const inner = parseExpr(tokens, pos)
    if (pos.i < tokens.length && tokens[pos.i] === ')') pos.i++
    return inner
  }
  // Variable
  if (/^[a-zA-Z_]/.test(tok)) {
    pos.i++
    return { type: 'var', name: tok }
  }
  throw new Error(`Unexpected token: ${tok}`)
}

function parse(expr: string): Expr {
  const tokens = tokenize(expr)
  const pos = { i: 0 }
  const result = parseExpr(tokens, pos)
  return result
}

/** Symbolic differentiation */
function differentiate(expr: Expr, v: string): Expr {
  switch (expr.type) {
    case 'num': return { type: 'num', value: 0 }
    case 'var': return { type: 'num', value: expr.name === v ? 1 : 0 }
    case 'neg': return { type: 'neg', arg: differentiate(expr.arg, v) }
    case 'add': return { type: 'add', left: differentiate(expr.left, v), right: differentiate(expr.right, v) }
    case 'sub': return { type: 'sub', left: differentiate(expr.left, v), right: differentiate(expr.right, v) }
    case 'mul': {
      // Product rule: f'g + fg'
      const f = expr.left, g = expr.right
      const df = differentiate(f, v), dg = differentiate(g, v)
      return { type: 'add', left: { type: 'mul', left: df, right: g }, right: { type: 'mul', left: f, right: dg } }
    }
    case 'div': {
      // Quotient rule: (f'g - fg') / g^2
      const f = expr.left, g = expr.right
      const df = differentiate(f, v), dg = differentiate(g, v)
      return {
        type: 'div',
        left: { type: 'sub', left: { type: 'mul', left: df, right: g }, right: { type: 'mul', left: f, right: dg } },
        right: { type: 'pow', base: g, exp: { type: 'num', value: 2 } },
      }
    }
    case 'pow': {
      const base = expr.base, exp = expr.exp
      const baseHasVar = containsVar(base, v)
      const expHasVar = containsVar(exp, v)
      if (!baseHasVar && !expHasVar) return { type: 'num', value: 0 }
      if (!expHasVar) {
        // Power rule: n * f^(n-1) * f'
        return {
          type: 'mul', left: { type: 'mul', left: exp, right: { type: 'pow', base, exp: { type: 'sub', left: exp, right: { type: 'num', value: 1 } } } },
          right: differentiate(base, v),
        }
      }
      if (!baseHasVar) {
        // a^g(x) = a^g(x) * ln(a) * g'(x)
        return {
          type: 'mul', left: { type: 'mul', left: expr, right: { type: 'fn', name: 'log', arg: base } },
          right: differentiate(exp, v),
        }
      }
      // General case f(x)^g(x) = e^(g*ln(f)) → differentiate that
      const lnForm: Expr = { type: 'pow', base: { type: 'num', value: Math.E }, exp: { type: 'mul', left: exp, right: { type: 'fn', name: 'log', arg: base } } }
      return differentiate(lnForm, v)
    }
    case 'fn': {
      const arg = expr.arg
      const da = differentiate(arg, v)
      let inner: Expr
      switch (expr.name) {
        case 'sin': inner = { type: 'fn', name: 'cos', arg }; break
        case 'cos': inner = { type: 'neg', arg: { type: 'fn', name: 'sin', arg } }; break
        case 'tan': inner = { type: 'pow', base: { type: 'fn', name: 'cos', arg }, exp: { type: 'num', value: -2 } }; break
        case 'exp': inner = expr; break
        case 'log': inner = { type: 'div', left: { type: 'num', value: 1 }, right: arg }; break
        case 'sqrt': inner = { type: 'div', left: { type: 'num', value: 1 }, right: { type: 'mul', left: { type: 'num', value: 2 }, right: { type: 'fn', name: 'sqrt', arg } } }; break
        case 'asin': inner = { type: 'div', left: { type: 'num', value: 1 }, right: { type: 'fn', name: 'sqrt', arg: { type: 'sub', left: { type: 'num', value: 1 }, right: { type: 'pow', base: arg, exp: { type: 'num', value: 2 } } } } }; break
        case 'acos': inner = { type: 'neg', arg: { type: 'div', left: { type: 'num', value: 1 }, right: { type: 'fn', name: 'sqrt', arg: { type: 'sub', left: { type: 'num', value: 1 }, right: { type: 'pow', base: arg, exp: { type: 'num', value: 2 } } } } } }; break
        case 'atan': inner = { type: 'div', left: { type: 'num', value: 1 }, right: { type: 'add', left: { type: 'num', value: 1 }, right: { type: 'pow', base: arg, exp: { type: 'num', value: 2 } } } }; break
        case 'sinh': inner = { type: 'fn', name: 'cosh', arg }; break
        case 'cosh': inner = { type: 'fn', name: 'sinh', arg }; break
        case 'tanh': inner = { type: 'sub', left: { type: 'num', value: 1 }, right: { type: 'pow', base: { type: 'fn', name: 'tanh', arg }, exp: { type: 'num', value: 2 } } }; break
        default: throw new Error(`Cannot differentiate function: ${expr.name}`)
      }
      // Chain rule
      return { type: 'mul', left: inner, right: da }
    }
  }
}

function containsVar(expr: Expr, v: string): boolean {
  switch (expr.type) {
    case 'num': return false
    case 'var': return expr.name === v
    case 'neg': return containsVar(expr.arg, v)
    case 'fn': return containsVar(expr.arg, v)
    case 'add': case 'sub': case 'mul': case 'div':
      return containsVar(expr.left, v) || containsVar(expr.right, v)
    case 'pow': return containsVar(expr.base, v) || containsVar(expr.exp, v)
  }
}

/** Simplify an expression tree (basic algebraic rules) */
function simplify(expr: Expr): Expr {
  switch (expr.type) {
    case 'num': case 'var': return expr
    case 'neg': {
      const a = simplify(expr.arg)
      if (a.type === 'num') return { type: 'num', value: -a.value }
      if (a.type === 'neg') return a.arg
      return { type: 'neg', arg: a }
    }
    case 'add': {
      const l = simplify(expr.left), r = simplify(expr.right)
      if (l.type === 'num' && r.type === 'num') return { type: 'num', value: l.value + r.value }
      if (l.type === 'num' && l.value === 0) return r
      if (r.type === 'num' && r.value === 0) return l
      return { type: 'add', left: l, right: r }
    }
    case 'sub': {
      const l = simplify(expr.left), r = simplify(expr.right)
      if (l.type === 'num' && r.type === 'num') return { type: 'num', value: l.value - r.value }
      if (r.type === 'num' && r.value === 0) return l
      if (l.type === 'num' && l.value === 0) return { type: 'neg', arg: r }
      return { type: 'sub', left: l, right: r }
    }
    case 'mul': {
      const l = simplify(expr.left), r = simplify(expr.right)
      if (l.type === 'num' && r.type === 'num') return { type: 'num', value: l.value * r.value }
      if (l.type === 'num' && l.value === 0) return { type: 'num', value: 0 }
      if (r.type === 'num' && r.value === 0) return { type: 'num', value: 0 }
      if (l.type === 'num' && l.value === 1) return r
      if (r.type === 'num' && r.value === 1) return l
      return { type: 'mul', left: l, right: r }
    }
    case 'div': {
      const l = simplify(expr.left), r = simplify(expr.right)
      if (l.type === 'num' && r.type === 'num' && r.value !== 0) return { type: 'num', value: l.value / r.value }
      if (l.type === 'num' && l.value === 0) return { type: 'num', value: 0 }
      if (r.type === 'num' && r.value === 1) return l
      return { type: 'div', left: l, right: r }
    }
    case 'pow': {
      const b = simplify(expr.base), e = simplify(expr.exp)
      if (b.type === 'num' && e.type === 'num') return { type: 'num', value: Math.pow(b.value, e.value) }
      if (e.type === 'num' && e.value === 0) return { type: 'num', value: 1 }
      if (e.type === 'num' && e.value === 1) return b
      return { type: 'pow', base: b, exp: e }
    }
    case 'fn': {
      const a = simplify(expr.arg)
      if (a.type === 'num') {
        const fns: Record<string, (x: number) => number> = {
          sin: Math.sin, cos: Math.cos, tan: Math.tan, exp: Math.exp,
          log: Math.log, sqrt: Math.sqrt, abs: Math.abs,
          asin: Math.asin, acos: Math.acos, atan: Math.atan,
          sinh: Math.sinh, cosh: Math.cosh, tanh: Math.tanh,
        }
        if (fns[expr.name]) return { type: 'num', value: fns[expr.name](a.value) }
      }
      return { type: 'fn', name: expr.name, arg: a }
    }
  }
}

/** Apply simplification repeatedly until stable */
function deepSimplify(expr: Expr, maxIter = 20): Expr {
  let prev = exprToString(expr)
  let cur = expr
  for (let i = 0; i < maxIter; i++) {
    cur = simplify(cur)
    const s = exprToString(cur)
    if (s === prev) break
    prev = s
  }
  return cur
}

/** Convert expression tree back to string */
function exprToString(expr: Expr): string {
  switch (expr.type) {
    case 'num': return fmt(expr.value)
    case 'var': return expr.name
    case 'neg': {
      const s = exprToString(expr.arg)
      return expr.arg.type === 'add' || expr.arg.type === 'sub' ? `-(${s})` : `-${s}`
    }
    case 'add': return `${exprToString(expr.left)} + ${exprToString(expr.right)}`
    case 'sub': {
      const rs = exprToString(expr.right)
      const r = expr.right.type === 'add' || expr.right.type === 'sub' ? `(${rs})` : rs
      return `${exprToString(expr.left)} - ${r}`
    }
    case 'mul': {
      const ls = needsParensMul(expr.left) ? `(${exprToString(expr.left)})` : exprToString(expr.left)
      const rs = needsParensMul(expr.right) ? `(${exprToString(expr.right)})` : exprToString(expr.right)
      return `${ls} * ${rs}`
    }
    case 'div': {
      const ls = needsParensMul(expr.left) ? `(${exprToString(expr.left)})` : exprToString(expr.left)
      const rs = needsParensDiv(expr.right) ? `(${exprToString(expr.right)})` : exprToString(expr.right)
      return `${ls} / ${rs}`
    }
    case 'pow': {
      const bs = needsParensPow(expr.base) ? `(${exprToString(expr.base)})` : exprToString(expr.base)
      const es = needsParensPow(expr.exp) ? `(${exprToString(expr.exp)})` : exprToString(expr.exp)
      return `${bs}^${es}`
    }
    case 'fn': return `${expr.name}(${exprToString(expr.arg)})`
  }
}

function needsParensMul(e: Expr): boolean { return e.type === 'add' || e.type === 'sub' }
function needsParensDiv(e: Expr): boolean { return e.type === 'add' || e.type === 'sub' || e.type === 'mul' || e.type === 'div' }
function needsParensPow(e: Expr): boolean { return e.type === 'add' || e.type === 'sub' || e.type === 'mul' || e.type === 'div' || e.type === 'neg' }

/** Evaluate expression tree numerically with variable bindings */
function evalExpr(expr: Expr, vars: Record<string, number>): number {
  switch (expr.type) {
    case 'num': return expr.value
    case 'var': {
      if (expr.name in vars) return vars[expr.name]
      throw new Error(`Undefined variable: ${expr.name}`)
    }
    case 'neg': return -evalExpr(expr.arg, vars)
    case 'add': return evalExpr(expr.left, vars) + evalExpr(expr.right, vars)
    case 'sub': return evalExpr(expr.left, vars) - evalExpr(expr.right, vars)
    case 'mul': return evalExpr(expr.left, vars) * evalExpr(expr.right, vars)
    case 'div': return evalExpr(expr.left, vars) / evalExpr(expr.right, vars)
    case 'pow': return Math.pow(evalExpr(expr.base, vars), evalExpr(expr.exp, vars))
    case 'fn': {
      const a = evalExpr(expr.arg, vars)
      const fns: Record<string, (x: number) => number> = {
        sin: Math.sin, cos: Math.cos, tan: Math.tan, exp: Math.exp,
        log: Math.log, sqrt: Math.sqrt, abs: Math.abs,
        asin: Math.asin, acos: Math.acos, atan: Math.atan,
        sinh: Math.sinh, cosh: Math.cosh, tanh: Math.tanh,
      }
      if (fns[expr.name]) return fns[expr.name](a)
      throw new Error(`Unknown function: ${expr.name}`)
    }
  }
}

/** Taylor series expansion of f(x) around x=a, up to order n */
function taylorSeries(expr: Expr, variable: string, a: number, n: number): string {
  const terms: string[] = []
  let current = expr
  let factorial = 1
  for (let k = 0; k <= n; k++) {
    if (k > 0) factorial *= k
    const val = evalExpr(current, { [variable]: a })
    if (Math.abs(val) > 1e-14) {
      const coeff = val / factorial
      if (k === 0) {
        terms.push(fmt(coeff))
      } else {
        const xTerm = a === 0 ? (k === 1 ? variable : `${variable}^${k}`) : (k === 1 ? `(${variable} - ${fmt(a)})` : `(${variable} - ${fmt(a)})^${k}`)
        const coeffStr = Math.abs(coeff) === 1 ? (coeff < 0 ? '-' : '') : fmt(coeff) + '*'
        terms.push(`${coeffStr}${xTerm}`)
      }
    }
    current = differentiate(current, variable)
    current = deepSimplify(current)
  }
  return terms.length > 0 ? terms.join(' + ').replace(/\+ -/g, '- ') : '0'
}

// ─────────────────────────────────────────────────────────────────────────────
// §2  MATRIX HELPERS
// ─────────────────────────────────────────────────────────────────────────────

type Matrix = number[][]

function matCreate(rows: number, cols: number, fill = 0): Matrix {
  return Array.from({ length: rows }, () => Array(cols).fill(fill) as number[])
}

function matClone(m: Matrix): Matrix {
  return m.map(row => [...row])
}

function matRows(m: Matrix): number { return m.length }
function matCols(m: Matrix): number { return m[0]?.length ?? 0 }

function matTranspose(m: Matrix): Matrix {
  const [r, c] = [matRows(m), matCols(m)]
  const t = matCreate(c, r)
  for (let i = 0; i < r; i++)
    for (let j = 0; j < c; j++)
      t[j][i] = m[i][j]
  return t
}

function matMul(a: Matrix, b: Matrix): Matrix {
  const [ar, ac, bc] = [matRows(a), matCols(a), matCols(b)]
  if (ac !== matRows(b)) throw new Error(`Matrix dimension mismatch: ${ar}x${ac} * ${matRows(b)}x${bc}`)
  const result = matCreate(ar, bc)
  for (let i = 0; i < ar; i++)
    for (let j = 0; j < bc; j++)
      for (let k = 0; k < ac; k++)
        result[i][j] += a[i][k] * b[k][j]
  return result
}

function matAdd(a: Matrix, b: Matrix): Matrix {
  const [r, c] = [matRows(a), matCols(a)]
  if (r !== matRows(b) || c !== matCols(b)) throw new Error('Matrix dimension mismatch for addition')
  const result = matCreate(r, c)
  for (let i = 0; i < r; i++)
    for (let j = 0; j < c; j++)
      result[i][j] = a[i][j] + b[i][j]
  return result
}

function matSub(a: Matrix, b: Matrix): Matrix {
  const [r, c] = [matRows(a), matCols(a)]
  const result = matCreate(r, c)
  for (let i = 0; i < r; i++)
    for (let j = 0; j < c; j++)
      result[i][j] = a[i][j] - b[i][j]
  return result
}

function matScale(m: Matrix, s: number): Matrix {
  return m.map(row => row.map(v => v * s))
}

function matIdentity(n: number): Matrix {
  const m = matCreate(n, n)
  for (let i = 0; i < n; i++) m[i][i] = 1
  return m
}

/** LU decomposition with partial pivoting. Returns { L, U, P } where PA = LU */
function matLU(m: Matrix): { L: Matrix; U: Matrix; P: Matrix; pivotSign: number } {
  const n = matRows(m)
  if (n !== matCols(m)) throw new Error('LU decomposition requires a square matrix')
  const U = matClone(m)
  const L = matIdentity(n)
  const P = matIdentity(n)
  let pivotSign = 1

  for (let k = 0; k < n; k++) {
    // Partial pivoting
    let maxVal = Math.abs(U[k][k]), maxRow = k
    for (let i = k + 1; i < n; i++) {
      if (Math.abs(U[i][k]) > maxVal) {
        maxVal = Math.abs(U[i][k])
        maxRow = i
      }
    }
    if (maxRow !== k) {
      [U[k], U[maxRow]] = [U[maxRow], U[k]];
      [P[k], P[maxRow]] = [P[maxRow], P[k]]
      pivotSign *= -1
      // Swap L below diagonal
      for (let j = 0; j < k; j++) {
        [L[k][j], L[maxRow][j]] = [L[maxRow][j], L[k][j]]
      }
    }
    if (Math.abs(U[k][k]) < 1e-14) continue // singular
    for (let i = k + 1; i < n; i++) {
      const factor = U[i][k] / U[k][k]
      L[i][k] = factor
      for (let j = k; j < n; j++) {
        U[i][j] -= factor * U[k][j]
      }
    }
  }
  return { L, U, P, pivotSign }
}

/** Determinant via LU decomposition */
function matDet(m: Matrix): number {
  const n = matRows(m)
  if (n !== matCols(m)) throw new Error('Determinant requires a square matrix')
  if (n === 1) return m[0][0]
  if (n === 2) return m[0][0] * m[1][1] - m[0][1] * m[1][0]
  const { U, pivotSign } = matLU(m)
  let det = pivotSign
  for (let i = 0; i < n; i++) det *= U[i][i]
  return det
}

/** Matrix inverse via Gauss-Jordan elimination */
function matInverse(m: Matrix): Matrix {
  const n = matRows(m)
  if (n !== matCols(m)) throw new Error('Inverse requires a square matrix')
  // Augmented matrix [m | I]
  const aug: Matrix = m.map((row, i) => {
    const ext = Array(n).fill(0) as number[]
    ext[i] = 1
    return [...row, ...ext]
  })
  // Forward elimination
  for (let k = 0; k < n; k++) {
    let maxVal = Math.abs(aug[k][k]), maxRow = k
    for (let i = k + 1; i < n; i++) {
      if (Math.abs(aug[i][k]) > maxVal) { maxVal = Math.abs(aug[i][k]); maxRow = i }
    }
    if (maxVal < 1e-14) throw new Error('Matrix is singular — no inverse exists')
    if (maxRow !== k) [aug[k], aug[maxRow]] = [aug[maxRow], aug[k]]
    const pivot = aug[k][k]
    for (let j = 0; j < 2 * n; j++) aug[k][j] /= pivot
    for (let i = 0; i < n; i++) {
      if (i === k) continue
      const factor = aug[i][k]
      for (let j = 0; j < 2 * n; j++) aug[i][j] -= factor * aug[k][j]
    }
  }
  return aug.map(row => row.slice(n))
}

/** Matrix rank via row echelon form */
function matRank(m: Matrix): number {
  const r = matRows(m), c = matCols(m)
  const a = matClone(m)
  let rank = 0
  for (let col = 0; col < c && rank < r; col++) {
    let maxRow = rank, maxVal = Math.abs(a[rank][col])
    for (let i = rank + 1; i < r; i++) {
      if (Math.abs(a[i][col]) > maxVal) { maxVal = Math.abs(a[i][col]); maxRow = i }
    }
    if (maxVal < 1e-12) continue
    [a[rank], a[maxRow]] = [a[maxRow], a[rank]]
    const pivot = a[rank][col]
    for (let j = col; j < c; j++) a[rank][j] /= pivot
    for (let i = 0; i < r; i++) {
      if (i === rank) continue
      const factor = a[i][col]
      for (let j = col; j < c; j++) a[i][j] -= factor * a[rank][j]
    }
    rank++
  }
  return rank
}

/** Eigenvalues via QR iteration (for real symmetric matrices — works reasonably for general small matrices) */
function matEigenvalues(m: Matrix, maxIter = 300): number[] {
  const n = matRows(m)
  if (n !== matCols(m)) throw new Error('Eigenvalues require a square matrix')
  let A = matClone(m)
  // Shift-and-invert QR iteration
  for (let iter = 0; iter < maxIter; iter++) {
    // Wilkinson shift
    const shift = A[n - 1][n - 1]
    const shiftI = matScale(matIdentity(n), shift)
    const As = matSub(A, shiftI)
    // QR decomposition via Gram-Schmidt
    const { Q, R } = qrDecompose(As)
    A = matAdd(matMul(R, Q), shiftI)
    // Check convergence: subdiagonal elements
    let offDiag = 0
    for (let i = 1; i < n; i++) offDiag += Math.abs(A[i][i - 1])
    if (offDiag < 1e-12) break
  }
  return Array.from({ length: n }, (_, i) => A[i][i]).sort((a, b) => b - a)
}

/** QR decomposition via modified Gram-Schmidt */
function qrDecompose(m: Matrix): { Q: Matrix; R: Matrix } {
  const [rows, cols] = [matRows(m), matCols(m)]
  const Q = matCreate(rows, cols)
  const R = matCreate(cols, cols)

  // Column vectors
  const vecs: number[][] = []
  for (let j = 0; j < cols; j++) {
    vecs.push(Array.from({ length: rows }, (_, i) => m[i][j]))
  }

  const u: number[][] = []
  for (let j = 0; j < cols; j++) {
    let v = [...vecs[j]]
    for (let k = 0; k < j; k++) {
      const dot = v.reduce((s, vi, i) => s + vi * u[k][i], 0)
      R[k][j] = dot
      v = v.map((vi, i) => vi - dot * u[k][i])
    }
    const norm = Math.sqrt(v.reduce((s, vi) => s + vi * vi, 0))
    R[j][j] = norm
    if (norm < 1e-14) {
      u.push(v.map(() => 0))
    } else {
      u.push(v.map(vi => vi / norm))
    }
    for (let i = 0; i < rows; i++) Q[i][j] = u[j][i]
  }
  return { Q, R }
}

/** SVD via eigendecomposition of A^T A (compact, for small matrices) */
function matSVD(m: Matrix): { U: Matrix; S: number[]; V: Matrix } {
  const mt = matTranspose(m)
  const ata = matMul(mt, m)
  const eigenvals = matEigenvalues(ata)
  const singularValues = eigenvals.map(v => Math.sqrt(Math.max(0, v)))
  // For display purposes, return singular values sorted descending
  singularValues.sort((a, b) => b - a)
  return {
    U: matCreate(matRows(m), matRows(m)), // placeholder — full U computation is expensive
    S: singularValues,
    V: matCreate(matCols(m), matCols(m)), // placeholder
  }
}

function matToString(m: Matrix, label?: string): string {
  const lines: string[] = []
  if (label) lines.push(`**${label}:**`)
  lines.push('```')
  const widths: number[] = Array(matCols(m)).fill(0)
  const formatted = m.map(row =>
    row.map((v, j) => {
      const s = fmt(v)
      widths[j] = Math.max(widths[j], s.length)
      return s
    })
  )
  for (const row of formatted) {
    lines.push('[ ' + row.map((s, j) => s.padStart(widths[j])).join('  ') + ' ]')
  }
  lines.push('```')
  return lines.join('\n')
}

// ─────────────────────────────────────────────────────────────────────────────
// §3  NUMBER THEORY HELPERS
// ─────────────────────────────────────────────────────────────────────────────

/** Modular exponentiation: base^exp mod m (BigInt) */
function modPow(base: bigint, exp: bigint, m: bigint): bigint {
  if (m === 1n) return 0n
  let result = 1n
  base = ((base % m) + m) % m
  while (exp > 0n) {
    if (exp & 1n) result = (result * base) % m
    exp >>= 1n
    base = (base * base) % m
  }
  return result
}

/** Miller-Rabin primality test */
function millerRabin(n: bigint, k = 20): boolean {
  if (n < 2n) return false
  if (n === 2n || n === 3n) return true
  if (n % 2n === 0n) return false

  // Write n-1 as 2^r * d
  let d = n - 1n, r = 0n
  while (d % 2n === 0n) { d >>= 1n; r++ }

  // Deterministic witnesses for small values
  const witnesses: bigint[] = n < 3_215_031_751n
    ? [2n, 3n, 5n, 7n]
    : n < 3_317_044_064_679_887_385_961_981n
    ? [2n, 3n, 5n, 7n, 11n, 13n, 17n, 19n, 23n, 29n, 31n, 37n]
    : []

  const testWitnesses = witnesses.length > 0 ? witnesses : (() => {
    const ws: bigint[] = []
    for (let i = 0; i < k; i++) {
      // Random witness in [2, n-2]
      const w = BigInt(Math.floor(Math.random() * Number(n < 1000000n ? n - 4n : 999996n))) + 2n
      ws.push(w)
    }
    return ws
  })()

  outer:
  for (const a of testWitnesses) {
    if (a >= n) continue
    let x = modPow(a, d, n)
    if (x === 1n || x === n - 1n) continue
    for (let i = 0n; i < r - 1n; i++) {
      x = (x * x) % n
      if (x === n - 1n) continue outer
    }
    return false // composite
  }
  return true
}

/** Trial division up to sqrt(n) */
function trialDivision(n: bigint): bigint[] {
  if (n <= 1n) return []
  const factors: bigint[] = []
  while (n % 2n === 0n) { factors.push(2n); n /= 2n }
  let d = 3n
  while (d * d <= n) {
    while (n % d === 0n) { factors.push(d); n /= d }
    d += 2n
  }
  if (n > 1n) factors.push(n)
  return factors
}

/** Pollard's rho factorization */
function pollardRho(n: bigint): bigint {
  if (n % 2n === 0n) return 2n
  let x = BigInt(Math.floor(Math.random() * Number(n < 1000000n ? n : 1000000n))) + 2n
  let y = x
  let c = BigInt(Math.floor(Math.random() * Number(n < 1000000n ? n : 1000000n))) + 1n
  let d = 1n

  const gcd = (a: bigint, b: bigint): bigint => {
    a = a < 0n ? -a : a; b = b < 0n ? -b : b
    while (b) { [a, b] = [b, a % b] }
    return a
  }

  while (d === 1n) {
    x = (x * x + c) % n
    y = (y * y + c) % n
    y = (y * y + c) % n
    d = gcd(x > y ? x - y : y - x, n)
  }
  return d === n ? pollardRho(n) : d // retry if trivial factor
}

/** Full factorization using trial division + Pollard's rho */
function factorize(n: bigint): bigint[] {
  if (n <= 1n) return []
  if (millerRabin(n)) return [n]

  // Try trial division for small factors first
  const smallFactors: bigint[] = []
  let remaining = n
  let d = 2n
  while (d * d <= remaining && d < 100000n) {
    while (remaining % d === 0n) {
      smallFactors.push(d)
      remaining /= d
    }
    d += (d === 2n ? 1n : 2n)
  }
  if (remaining <= 1n) return smallFactors

  if (millerRabin(remaining)) return [...smallFactors, remaining]

  // Pollard's rho for larger factors
  const stack: bigint[] = [remaining]
  const factors: bigint[] = [...smallFactors]
  let attempts = 0
  while (stack.length > 0 && attempts < 100) {
    const val = stack.pop()!
    if (val <= 1n) continue
    if (millerRabin(val)) { factors.push(val); continue }
    const factor = pollardRho(val)
    stack.push(factor)
    stack.push(val / factor)
    attempts++
  }
  return factors.sort((a, b) => (a < b ? -1 : a > b ? 1 : 0))
}

function bigGcd(a: bigint, b: bigint): bigint {
  a = a < 0n ? -a : a; b = b < 0n ? -b : b
  while (b) { [a, b] = [b, a % b] }
  return a
}

function bigLcm(a: bigint, b: bigint): bigint {
  if (a === 0n || b === 0n) return 0n
  const aa = a < 0n ? -a : a
  const bb = b < 0n ? -b : b
  return (aa / bigGcd(aa, bb)) * bb
}

/** Euler's totient function */
function eulerTotient(n: bigint): bigint {
  if (n <= 0n) return 0n
  const factors = factorize(n)
  const primes = [...new Set(factors)]
  let result = n
  for (const p of primes) {
    result = result / p * (p - 1n)
  }
  return result
}

/** Chinese Remainder Theorem: solve x === r_i (mod m_i) */
function chineseRemainder(remainders: bigint[], moduli: bigint[]): { solution: bigint; modulus: bigint } {
  if (remainders.length !== moduli.length) throw new Error('Mismatched remainders and moduli')
  let M = 1n
  for (const m of moduli) M *= m

  let x = 0n
  for (let i = 0; i < moduli.length; i++) {
    const Mi = M / moduli[i]
    // Extended GCD to find Mi^(-1) mod moduli[i]
    const inv = modInverse(Mi, moduli[i])
    x = (x + remainders[i] * Mi * inv) % M
  }
  return { solution: ((x % M) + M) % M, modulus: M }
}

function modInverse(a: bigint, m: bigint): bigint {
  let [old_r, r] = [a, m]
  let [old_s, s] = [1n, 0n]
  while (r !== 0n) {
    const q = old_r / r;
    [old_r, r] = [r, old_r - q * r];
    [old_s, s] = [s, old_s - q * s]
  }
  if (old_r !== 1n) throw new Error(`No modular inverse: gcd(${a}, ${m}) = ${old_r}`)
  return ((old_s % m) + m) % m
}

// ─────────────────────────────────────────────────────────────────────────────
// §4  GRAPH THEORY HELPERS
// ─────────────────────────────────────────────────────────────────────────────

interface GraphEdge { from: string | number; to: string | number; weight?: number }
interface GraphInput { nodes: (string | number)[]; edges: GraphEdge[] }

function parseGraph(s: string): GraphInput {
  const g = safeParse<GraphInput>(s, 'graph')
  if (!g.nodes || !g.edges) throw new Error('Graph must have "nodes" and "edges" arrays')
  return g
}

function buildAdj(g: GraphInput, directed = false): Map<string, { to: string; weight: number }[]> {
  const adj = new Map<string, { to: string; weight: number }[]>()
  for (const n of g.nodes) adj.set(String(n), [])
  for (const e of g.edges) {
    const from = String(e.from), to = String(e.to), w = e.weight ?? 1
    adj.get(from)?.push({ to, weight: w })
    if (!directed) adj.get(to)?.push({ to: from, weight: w })
  }
  return adj
}

/** Dijkstra shortest path */
function dijkstra(g: GraphInput, source: string, target?: string): { dist: Map<string, number>; prev: Map<string, string | null> } {
  const adj = buildAdj(g)
  const dist = new Map<string, number>()
  const prev = new Map<string, string | null>()
  const visited = new Set<string>()

  for (const n of g.nodes) { dist.set(String(n), Infinity); prev.set(String(n), null) }
  dist.set(source, 0)

  // Simple priority queue (array-based, adequate for small graphs)
  const pq: [number, string][] = [[0, source]]

  while (pq.length > 0) {
    pq.sort((a, b) => a[0] - b[0])
    const [d, u] = pq.shift()!
    if (visited.has(u)) continue
    visited.add(u)
    if (target && u === target) break

    for (const { to: v, weight: w } of (adj.get(u) || [])) {
      const alt = d + w
      if (alt < (dist.get(v) ?? Infinity)) {
        dist.set(v, alt)
        prev.set(v, u)
        pq.push([alt, v])
      }
    }
  }
  return { dist, prev }
}

function reconstructPath(prev: Map<string, string | null>, target: string): string[] {
  const path: string[] = []
  let cur: string | null = target
  while (cur !== null) {
    path.unshift(cur)
    cur = prev.get(cur) ?? null
  }
  return path
}

/** Kruskal MST */
function kruskalMST(g: GraphInput): { edges: GraphEdge[]; totalWeight: number } {
  // Union-Find
  const parent = new Map<string, string>()
  const rank = new Map<string, number>()
  for (const n of g.nodes) { const s = String(n); parent.set(s, s); rank.set(s, 0) }
  const find = (x: string): string => {
    if (parent.get(x) !== x) parent.set(x, find(parent.get(x)!))
    return parent.get(x)!
  }
  const union = (x: string, y: string): boolean => {
    const rx = find(x), ry = find(y)
    if (rx === ry) return false
    const rankX = rank.get(rx)!, rankY = rank.get(ry)!
    if (rankX < rankY) parent.set(rx, ry)
    else if (rankX > rankY) parent.set(ry, rx)
    else { parent.set(ry, rx); rank.set(rx, rankX + 1) }
    return true
  }

  const sorted = [...g.edges].sort((a, b) => (a.weight ?? 1) - (b.weight ?? 1))
  const mstEdges: GraphEdge[] = []
  let total = 0
  for (const e of sorted) {
    if (union(String(e.from), String(e.to))) {
      mstEdges.push(e)
      total += e.weight ?? 1
    }
  }
  return { edges: mstEdges, totalWeight: total }
}

/** BFS components */
function bfsComponents(g: GraphInput): string[][] {
  const adj = buildAdj(g)
  const visited = new Set<string>()
  const components: string[][] = []
  for (const n of g.nodes) {
    const s = String(n)
    if (visited.has(s)) continue
    const comp: string[] = []
    const queue = [s]
    visited.add(s)
    while (queue.length > 0) {
      const u = queue.shift()!
      comp.push(u)
      for (const { to: v } of (adj.get(u) || [])) {
        if (!visited.has(v)) { visited.add(v); queue.push(v) }
      }
    }
    components.push(comp)
  }
  return components
}

/** Topological sort (Kahn's algorithm) */
function topologicalSort(g: GraphInput): string[] | null {
  const adj = new Map<string, string[]>()
  const inDeg = new Map<string, number>()
  for (const n of g.nodes) { const s = String(n); adj.set(s, []); inDeg.set(s, 0) }
  for (const e of g.edges) {
    adj.get(String(e.from))?.push(String(e.to))
    inDeg.set(String(e.to), (inDeg.get(String(e.to)) ?? 0) + 1)
  }
  const queue: string[] = []
  for (const [n, d] of inDeg) if (d === 0) queue.push(n)
  const order: string[] = []
  while (queue.length > 0) {
    const u = queue.shift()!
    order.push(u)
    for (const v of (adj.get(u) || [])) {
      const d = (inDeg.get(v) ?? 0) - 1
      inDeg.set(v, d)
      if (d === 0) queue.push(v)
    }
  }
  return order.length === g.nodes.length ? order : null // null = cycle
}

/** Greedy graph coloring */
function greedyColoring(g: GraphInput): Map<string, number> {
  const adj = buildAdj(g)
  const color = new Map<string, number>()
  for (const n of g.nodes) {
    const s = String(n)
    const usedColors = new Set<number>()
    for (const { to } of (adj.get(s) || [])) {
      if (color.has(to)) usedColors.add(color.get(to)!)
    }
    let c = 0
    while (usedColors.has(c)) c++
    color.set(s, c)
  }
  return color
}

/** Betweenness centrality (Brandes' algorithm) */
function betweennessCentrality(g: GraphInput): Map<string, number> {
  const adj = buildAdj(g)
  const nodes = g.nodes.map(String)
  const cb = new Map<string, number>()
  for (const n of nodes) cb.set(n, 0)

  for (const s of nodes) {
    const stack: string[] = []
    const pred = new Map<string, string[]>()
    const sigma = new Map<string, number>()
    const dist = new Map<string, number>()
    const delta = new Map<string, number>()

    for (const n of nodes) { pred.set(n, []); sigma.set(n, 0); dist.set(n, -1); delta.set(n, 0) }
    sigma.set(s, 1)
    dist.set(s, 0)
    const queue = [s]

    while (queue.length > 0) {
      const v = queue.shift()!
      stack.push(v)
      for (const { to: w } of (adj.get(v) || [])) {
        if (dist.get(w)! < 0) {
          queue.push(w)
          dist.set(w, dist.get(v)! + 1)
        }
        if (dist.get(w) === dist.get(v)! + 1) {
          sigma.set(w, sigma.get(w)! + sigma.get(v)!)
          pred.get(w)!.push(v)
        }
      }
    }

    while (stack.length > 0) {
      const w = stack.pop()!
      for (const v of pred.get(w)!) {
        delta.set(v, delta.get(v)! + (sigma.get(v)! / sigma.get(w)!) * (1 + delta.get(w)!))
      }
      if (w !== s) {
        cb.set(w, cb.get(w)! + delta.get(w)!)
      }
    }
  }

  // Normalize for undirected graph
  for (const [n, v] of cb) cb.set(n, v / 2)
  return cb
}

// ─────────────────────────────────────────────────────────────────────────────
// §5  COMBINATORICS HELPERS (BigInt)
// ─────────────────────────────────────────────────────────────────────────────

function bigFactorial(n: number): bigint {
  if (n < 0) throw new Error('Factorial undefined for negative numbers')
  let result = 1n
  for (let i = 2; i <= n; i++) result *= BigInt(i)
  return result
}

function bigPerm(n: number, k: number): bigint {
  if (k < 0 || k > n) return 0n
  let result = 1n
  for (let i = n; i > n - k; i--) result *= BigInt(i)
  return result
}

function bigComb(n: number, k: number): bigint {
  if (k < 0 || k > n) return 0n
  if (k > n - k) k = n - k
  let result = 1n
  for (let i = 0; i < k; i++) {
    result = result * BigInt(n - i) / BigInt(i + 1)
  }
  return result
}

/** Catalan number C_n = C(2n,n)/(n+1) */
function catalanNumber(n: number): bigint {
  return bigComb(2 * n, n) / BigInt(n + 1)
}

/** Stirling numbers of the second kind S(n,k) — number of partitions of n into k non-empty subsets */
function stirling2(n: number, k: number): bigint {
  if (n === 0 && k === 0) return 1n
  if (n === 0 || k === 0 || k > n) return 0n
  // Explicit formula: S(n,k) = (1/k!) * sum_{j=0}^{k} (-1)^(k-j) * C(k,j) * j^n
  let sum = 0n
  for (let j = 0; j <= k; j++) {
    const term = bigComb(k, j) * bigPowInt(BigInt(j), n)
    if ((k - j) % 2 === 0) sum += term
    else sum -= term
  }
  return sum / bigFactorial(k)
}

function bigPowInt(base: bigint, exp: number): bigint {
  let result = 1n
  let b = base
  let e = exp
  while (e > 0) {
    if (e & 1) result *= b
    b *= b
    e >>= 1
  }
  return result
}

/** Bell number B_n = sum_{k=0}^{n} S(n,k) */
function bellNumber(n: number): bigint {
  let sum = 0n
  for (let k = 0; k <= n; k++) sum += stirling2(n, k)
  return sum
}

/** Integer partition number p(n) via dynamic programming */
function partitionNumber(n: number): bigint {
  if (n < 0) return 0n
  const dp: bigint[] = Array(n + 1).fill(0n)
  dp[0] = 1n
  for (let i = 1; i <= n; i++) {
    for (let j = i; j <= n; j++) {
      dp[j] += dp[j - i]
    }
  }
  return dp[n]
}

/** Derangement number D_n = n! * sum_{k=0}^{n} (-1)^k / k! */
function derangement(n: number): bigint {
  if (n === 0) return 1n
  if (n === 1) return 0n
  // Use recurrence: D(n) = (n-1)(D(n-1) + D(n-2))
  let prev2 = 1n // D(0)
  let prev1 = 0n // D(1)
  for (let i = 2; i <= n; i++) {
    const cur = BigInt(i - 1) * (prev1 + prev2)
    prev2 = prev1
    prev1 = cur
  }
  return prev1
}

// ─────────────────────────────────────────────────────────────────────────────
// §6  DIFFERENTIAL EQUATIONS HELPERS
// ─────────────────────────────────────────────────────────────────────────────

/** Parse a math expression string and return an evaluable function of (x, y) */
function parseODEFunc(eqStr: string): (x: number, y: number) => number {
  const tree = parse(eqStr)
  return (x: number, y: number) => evalExpr(tree, { x, y, t: x })
}

/** Euler method for dy/dx = f(x, y) */
function eulerMethod(f: (x: number, y: number) => number, x0: number, y0: number, xEnd: number, h: number): { x: number[]; y: number[] } {
  const xs: number[] = [x0]
  const ys: number[] = [y0]
  let x = x0, y = y0
  const steps = Math.ceil((xEnd - x0) / h)
  for (let i = 0; i < steps; i++) {
    y = y + h * f(x, y)
    x = x + h
    xs.push(x)
    ys.push(y)
  }
  return { x: xs, y: ys }
}

/** Classical RK4 */
function rk4Method(f: (x: number, y: number) => number, x0: number, y0: number, xEnd: number, h: number): { x: number[]; y: number[] } {
  const xs: number[] = [x0]
  const ys: number[] = [y0]
  let x = x0, y = y0
  const steps = Math.ceil((xEnd - x0) / h)
  for (let i = 0; i < steps; i++) {
    const k1 = h * f(x, y)
    const k2 = h * f(x + h / 2, y + k1 / 2)
    const k3 = h * f(x + h / 2, y + k2 / 2)
    const k4 = h * f(x + h, y + k3)
    y = y + (k1 + 2 * k2 + 2 * k3 + k4) / 6
    x = x + h
    xs.push(x)
    ys.push(y)
  }
  return { x: xs, y: ys }
}

/** Adaptive RK45 (Dormand-Prince) */
function rk45Method(f: (x: number, y: number) => number, x0: number, y0: number, xEnd: number, tol = 1e-6): { x: number[]; y: number[] } {
  // Dormand-Prince coefficients
  const a2 = 1 / 5, a3 = 3 / 10, a4 = 4 / 5, a5 = 8 / 9
  const b21 = 1 / 5
  const b31 = 3 / 40, b32 = 9 / 40
  const b41 = 44 / 45, b42 = -56 / 15, b43 = 32 / 9
  const b51 = 19372 / 6561, b52 = -25360 / 2187, b53 = 64448 / 6561, b54 = -212 / 729
  const b61 = 9017 / 3168, b62 = -355 / 33, b63 = 46732 / 5247, b64 = 49 / 176, b65 = -5103 / 18656

  // 5th order weights
  const c1 = 35 / 384, c3 = 500 / 1113, c4 = 125 / 192, c5 = -2187 / 6784, c6 = 11 / 84
  // 4th order weights (for error estimate)
  const d1 = 5179 / 57600, d3 = 7571 / 16695, d4 = 393 / 640, d5 = -92097 / 339200, d6 = 187 / 2100, d7 = 1 / 40

  const xs: number[] = [x0]
  const ys: number[] = [y0]
  let x = x0, y = y0
  let h = (xEnd - x0) / 100
  const hMin = (xEnd - x0) * 1e-12
  const hMax = (xEnd - x0) / 4
  let maxSteps = 10000

  while (x < xEnd - hMin && maxSteps-- > 0) {
    if (x + h > xEnd) h = xEnd - x

    const k1 = h * f(x, y)
    const k2 = h * f(x + a2 * h, y + b21 * k1)
    const k3 = h * f(x + a3 * h, y + b31 * k1 + b32 * k2)
    const k4 = h * f(x + a4 * h, y + b41 * k1 + b42 * k2 + b43 * k3)
    const k5 = h * f(x + a5 * h, y + b51 * k1 + b52 * k2 + b53 * k3 + b54 * k4)
    const k6 = h * f(x + h, y + b61 * k1 + b62 * k2 + b63 * k3 + b64 * k4 + b65 * k5)

    // 5th order solution
    const y5 = y + c1 * k1 + c3 * k3 + c4 * k4 + c5 * k5 + c6 * k6
    // 4th order solution
    const k7 = h * f(x + h, y5)
    const y4 = y + d1 * k1 + d3 * k3 + d4 * k4 + d5 * k5 + d6 * k6 + d7 * k7

    const err = Math.abs(y5 - y4)
    if (err <= tol || h <= hMin) {
      x = x + h
      y = y5
      xs.push(x)
      ys.push(y)
    }
    // Adjust step size
    const s = err > 0 ? 0.84 * Math.pow(tol / err, 0.25) : 2
    h = Math.min(hMax, Math.max(hMin, h * Math.min(4, Math.max(0.1, s))))
  }
  return { x: xs, y: ys }
}

// ─────────────────────────────────────────────────────────────────────────────
// §7  PROBABILITY HELPERS
// ─────────────────────────────────────────────────────────────────────────────

interface DistResult { value: number; label: string }

/** Poisson PMF */
function poissonPMF(k: number, lambda: number): number {
  return Math.exp(-lambda + k * Math.log(lambda) - lgamma(k + 1))
}

/** Poisson CDF */
function poissonCDF(k: number, lambda: number): number {
  let sum = 0
  for (let i = 0; i <= Math.floor(k); i++) sum += poissonPMF(i, lambda)
  return sum
}

/** Binomial PMF */
function binomialPMF(k: number, n: number, p: number): number {
  const lnC = lgamma(n + 1) - lgamma(k + 1) - lgamma(n - k + 1)
  return Math.exp(lnC + k * Math.log(p) + (n - k) * Math.log(1 - p))
}

/** Binomial CDF */
function binomialCDF(k: number, n: number, p: number): number {
  let sum = 0
  for (let i = 0; i <= Math.floor(k); i++) sum += binomialPMF(i, n, p)
  return sum
}

/** Exponential PDF */
function exponentialPDF(x: number, lambda: number): number {
  return x < 0 ? 0 : lambda * Math.exp(-lambda * x)
}

/** Exponential CDF */
function exponentialCDF(x: number, lambda: number): number {
  return x < 0 ? 0 : 1 - Math.exp(-lambda * x)
}

/** Gamma PDF */
function gammaPDF(x: number, alpha: number, beta: number): number {
  if (x <= 0) return 0
  return Math.exp((alpha - 1) * Math.log(x) - x / beta - lgamma(alpha) - alpha * Math.log(beta))
}

/** Gamma CDF */
function gammaCDF(x: number, alpha: number, beta: number): number {
  if (x <= 0) return 0
  return gammaP(alpha, x / beta)
}

/** Chi-squared PDF = Gamma(k/2, 2) */
function chi2PDF(x: number, k: number): number { return gammaPDF(x, k / 2, 2) }
function chi2CDF(x: number, k: number): number { return gammaCDF(x, k / 2, 2) }

/** Student's t PDF */
function studentTPDF(x: number, nu: number): number {
  const coeff = gammaFn((nu + 1) / 2) / (Math.sqrt(nu * Math.PI) * gammaFn(nu / 2))
  return coeff * Math.pow(1 + x * x / nu, -(nu + 1) / 2)
}

/** Student's t CDF via incomplete beta */
function studentTCDF(x: number, nu: number): number {
  const t2 = x * x
  const ib = betaInc(nu / (nu + t2), nu / 2, 0.5)
  return x >= 0 ? 1 - 0.5 * ib : 0.5 * ib
}

/** F-distribution PDF */
function fDistPDF(x: number, d1: number, d2: number): number {
  if (x <= 0) return 0
  const num = Math.pow(d1 * x, d1) * Math.pow(d2, d2)
  const den = Math.pow(d1 * x + d2, d1 + d2)
  return Math.sqrt(num / den) / (x * betaFn(d1 / 2, d2 / 2))
}

/** F-distribution CDF via incomplete beta */
function fDistCDF(x: number, d1: number, d2: number): number {
  if (x <= 0) return 0
  return betaInc(d1 * x / (d1 * x + d2), d1 / 2, d2 / 2)
}

/** Beta distribution PDF */
function betaDistPDF(x: number, alpha: number, beta: number): number {
  if (x <= 0 || x >= 1) return 0
  return Math.pow(x, alpha - 1) * Math.pow(1 - x, beta - 1) / betaFn(alpha, beta)
}

/** Beta distribution CDF */
function betaDistCDF(x: number, alpha: number, beta: number): number {
  if (x <= 0) return 0
  if (x >= 1) return 1
  return betaInc(x, alpha, beta)
}

/** Weibull PDF */
function weibullPDF(x: number, k: number, lambda: number): number {
  if (x < 0) return 0
  return (k / lambda) * Math.pow(x / lambda, k - 1) * Math.exp(-Math.pow(x / lambda, k))
}

/** Weibull CDF */
function weibullCDF(x: number, k: number, lambda: number): number {
  if (x < 0) return 0
  return 1 - Math.exp(-Math.pow(x / lambda, k))
}

// ─────────────────────────────────────────────────────────────────────────────
// §8  FOURIER ANALYSIS HELPERS
// ─────────────────────────────────────────────────────────────────────────────

/** Complex number */
interface Complex { re: number; im: number }
function cMul(a: Complex, b: Complex): Complex {
  return { re: a.re * b.re - a.im * b.im, im: a.re * b.im + a.im * b.re }
}
function cAdd(a: Complex, b: Complex): Complex {
  return { re: a.re + b.re, im: a.im + b.im }
}
function cSub(a: Complex, b: Complex): Complex {
  return { re: a.re - b.re, im: a.im - b.im }
}
function cAbs(a: Complex): number {
  return Math.sqrt(a.re * a.re + a.im * a.im)
}

/** Radix-2 Cooley-Tukey FFT (in-place, iterative) */
function fft(data: Complex[], inverse = false): Complex[] {
  const n = data.length
  if (n === 0) return []
  // n must be power of 2
  if ((n & (n - 1)) !== 0) throw new Error('FFT requires power-of-2 length')

  // Bit-reversal permutation
  const result = [...data]
  let j = 0
  for (let i = 1; i < n; i++) {
    let bit = n >> 1
    while (j & bit) { j ^= bit; bit >>= 1 }
    j ^= bit
    if (i < j) [result[i], result[j]] = [result[j], result[i]]
  }

  // Butterfly stages
  for (let len = 2; len <= n; len *= 2) {
    const ang = (2 * Math.PI / len) * (inverse ? -1 : 1)
    const wLen: Complex = { re: Math.cos(ang), im: Math.sin(ang) }
    for (let i = 0; i < n; i += len) {
      let w: Complex = { re: 1, im: 0 }
      for (let k = 0; k < len / 2; k++) {
        const u = result[i + k]
        const v = cMul(result[i + k + len / 2], w)
        result[i + k] = cAdd(u, v)
        result[i + k + len / 2] = cSub(u, v)
        w = cMul(w, wLen)
      }
    }
  }

  if (inverse) {
    for (let i = 0; i < n; i++) {
      result[i].re /= n
      result[i].im /= n
    }
  }
  return result
}

/** Pad array to next power of 2 */
function padToPow2(data: Complex[]): Complex[] {
  let n = 1
  while (n < data.length) n *= 2
  const padded = [...data]
  while (padded.length < n) padded.push({ re: 0, im: 0 })
  return padded
}

// ─────────────────────────────────────────────────────────────────────────────
// §9  OPTIMIZATION HELPERS
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Simplex method for LP:  maximize c^T x subject to Ax <= b, x >= 0
 * Input: c (objective coefficients), A (constraint matrix), b (RHS)
 */
function simplex(c: number[], A: number[][], b: number[]): { solution: number[]; value: number; status: string } {
  const m = A.length    // number of constraints
  const n = c.length    // number of decision variables

  // Build tableau: [A | I | b] with objective row [-c | 0 | 0]
  const tableau: number[][] = []
  for (let i = 0; i < m; i++) {
    const row = [...A[i]]
    // Slack variables
    for (let j = 0; j < m; j++) row.push(i === j ? 1 : 0)
    row.push(b[i])
    tableau.push(row)
  }
  // Objective row
  const objRow = c.map(v => -v)
  for (let j = 0; j < m; j++) objRow.push(0)
  objRow.push(0)
  tableau.push(objRow)

  const totalCols = n + m + 1
  const maxIter = 1000

  for (let iter = 0; iter < maxIter; iter++) {
    // Find pivot column: most negative in objective row
    let pivotCol = -1, minVal = -1e-10
    for (let j = 0; j < totalCols - 1; j++) {
      if (tableau[m][j] < minVal) { minVal = tableau[m][j]; pivotCol = j }
    }
    if (pivotCol === -1) break // optimal

    // Find pivot row: minimum ratio test
    let pivotRow = -1, minRatio = Infinity
    for (let i = 0; i < m; i++) {
      if (tableau[i][pivotCol] > 1e-10) {
        const ratio = tableau[i][totalCols - 1] / tableau[i][pivotCol]
        if (ratio < minRatio) { minRatio = ratio; pivotRow = i }
      }
    }
    if (pivotRow === -1) return { solution: [], value: Infinity, status: 'unbounded' }

    // Pivot
    const pivot = tableau[pivotRow][pivotCol]
    for (let j = 0; j < totalCols; j++) tableau[pivotRow][j] /= pivot
    for (let i = 0; i <= m; i++) {
      if (i === pivotRow) continue
      const factor = tableau[i][pivotCol]
      for (let j = 0; j < totalCols; j++) tableau[i][j] -= factor * tableau[pivotRow][j]
    }
  }

  // Extract solution
  const solution = Array(n).fill(0)
  for (let j = 0; j < n; j++) {
    let basicRow = -1, isBasic = true
    for (let i = 0; i < m; i++) {
      if (Math.abs(tableau[i][j] - 1) < 1e-10) {
        if (basicRow !== -1) { isBasic = false; break }
        basicRow = i
      } else if (Math.abs(tableau[i][j]) > 1e-10) {
        isBasic = false; break
      }
    }
    if (isBasic && basicRow !== -1) solution[j] = tableau[basicRow][totalCols - 1]
  }
  return { solution, value: tableau[m][totalCols - 1], status: 'optimal' }
}

/** Gradient descent for f(x) where x is a vector */
function gradientDescent(
  fStr: string,
  vars: string[],
  x0: number[],
  lr: number,
  maxIter: number,
  tol: number
): { solution: number[]; value: number; iterations: number } {
  const tree = parse(fStr)
  const gradTrees = vars.map(v => deepSimplify(differentiate(tree, v)))

  let x = [...x0]
  let bestVal = Infinity
  let iters = 0

  for (let i = 0; i < maxIter; i++) {
    const bindings: Record<string, number> = {}
    vars.forEach((v, j) => { bindings[v] = x[j] })

    const val = evalExpr(tree, bindings)
    const grad = gradTrees.map(gt => evalExpr(gt, bindings))

    if (Math.abs(val - bestVal) < tol && i > 0) { iters = i; break }
    bestVal = val
    iters = i + 1

    // Update
    x = x.map((xi, j) => xi - lr * grad[j])
  }

  const finalBindings: Record<string, number> = {}
  vars.forEach((v, j) => { finalBindings[v] = x[j] })

  return { solution: x, value: evalExpr(tree, finalBindings), iterations: iters }
}

/** Newton's method for finding roots of f(x) = 0 (single variable) */
function newtonMethod(fStr: string, variable: string, x0: number, maxIter: number, tol: number): { root: number; iterations: number; converged: boolean } {
  const tree = parse(fStr)
  const dTree = deepSimplify(differentiate(tree, variable))

  let x = x0
  for (let i = 0; i < maxIter; i++) {
    const fx = evalExpr(tree, { [variable]: x })
    if (Math.abs(fx) < tol) return { root: x, iterations: i + 1, converged: true }
    const dfx = evalExpr(dTree, { [variable]: x })
    if (Math.abs(dfx) < 1e-14) return { root: x, iterations: i + 1, converged: false }
    x = x - fx / dfx
  }
  return { root: x, iterations: maxIter, converged: Math.abs(evalExpr(tree, { [variable]: x })) < tol }
}

// ─────────────────────────────────────────────────────────────────────────────
// §10  TOOL REGISTRATION
// ─────────────────────────────────────────────────────────────────────────────

export function registerLabMathTools(): void {

  // ── Tool 1: symbolic_compute ─────────────────────────────────────────────
  registerTool({
    name: 'symbolic_compute',
    description: 'Evaluate symbolic math: differentiate, integrate (basic polynomial), simplify expressions, Taylor series expansion, solve equations (Newton). Supports polynomial, trig, exp, log functions. For complex cases beyond built-in support, generates Python/SymPy code.',
    parameters: {
      expression: { type: 'string', description: 'Math expression, e.g. "x^3 + sin(x)" or "exp(x)*cos(x)"', required: true },
      operation: { type: 'string', description: 'Operation: differentiate | integrate | simplify | series | solve', required: true },
      variable: { type: 'string', description: 'Variable name (default: "x")', required: false },
      params: { type: 'string', description: 'JSON params, e.g. {"order": 5, "point": 0} for series, {"x0": 1} for solve', required: false },
    },
    tier: 'free',
    async execute(args) {
      const exprStr = String(args.expression)
      const operation = String(args.operation).toLowerCase()
      const variable = String(args.variable || 'x')
      const params = args.params ? safeParse<Record<string, unknown>>(String(args.params), 'params') : {}

      try {
        const tree = parse(exprStr)

        switch (operation) {
          case 'differentiate':
          case 'diff':
          case 'derivative': {
            const order = Number(params.order ?? 1)
            let result = tree
            for (let i = 0; i < order; i++) {
              result = differentiate(result, variable)
              result = deepSimplify(result)
            }
            const resultStr = exprToString(result)
            return [
              `## Derivative`,
              `**Expression:** \`${exprStr}\``,
              `**d${order > 1 ? `^${order}` : ''}/d${variable}${order > 1 ? `^${order}` : ''}:** \`${resultStr}\``,
              '',
              order === 1 ? `Applying standard differentiation rules (power, chain, product/quotient).` : `Applied differentiation ${order} times with simplification at each step.`,
            ].join('\n')
          }

          case 'integrate':
          case 'integral': {
            // Basic polynomial integration + known forms
            // For complex integrals, generate SymPy code
            const result = tryIntegrate(tree, variable)
            if (result) {
              const resultStr = exprToString(deepSimplify(result))
              return [
                `## Integral`,
                `**Expression:** \`${exprStr}\``,
                `**Integral w.r.t. ${variable}:** \`${resultStr} + C\``,
              ].join('\n')
            }
            // Fallback: generate SymPy code
            return [
              `## Integral (SymPy)`,
              `Built-in integration cannot handle this expression directly.`,
              `Use the following Python/SymPy code:`,
              '```python',
              `from sympy import symbols, integrate, sin, cos, tan, exp, log, sqrt`,
              `${variable} = symbols('${variable}')`,
              `expr = ${exprStr.replace(/\^/g, '**')}`,
              `result = integrate(expr, ${variable})`,
              `print(result)`,
              '```',
            ].join('\n')
          }

          case 'simplify': {
            const simplified = deepSimplify(tree)
            return [
              `## Simplification`,
              `**Input:** \`${exprStr}\``,
              `**Simplified:** \`${exprToString(simplified)}\``,
            ].join('\n')
          }

          case 'series':
          case 'taylor': {
            const order = Number(params.order ?? 5)
            const point = Number(params.point ?? 0)
            const series = taylorSeries(tree, variable, point, order)
            return [
              `## Taylor Series`,
              `**Expression:** \`${exprStr}\``,
              `**Around ${variable} = ${point}, order ${order}:**`,
              `\`${series}\``,
              `+ O(${variable}^${order + 1})`,
            ].join('\n')
          }

          case 'solve':
          case 'root': {
            const x0 = Number(params.x0 ?? 0)
            const maxIter = Number(params.max_iter ?? 100)
            const tol = Number(params.tol ?? 1e-10)
            const result = newtonMethod(exprStr, variable, x0, maxIter, tol)
            return [
              `## Root Finding (Newton's Method)`,
              `**Equation:** \`${exprStr} = 0\``,
              `**Starting point:** ${variable} = ${x0}`,
              `**Root:** ${variable} = ${fmt(result.root)}`,
              `**Converged:** ${result.converged ? 'Yes' : 'No'} (${result.iterations} iterations)`,
              result.converged ? '' : `\n*Try a different starting point (x0) for better convergence.*`,
            ].join('\n')
          }

          default:
            return `Unknown operation: "${operation}". Supported: differentiate, integrate, simplify, series, solve`
        }
      } catch (err: unknown) {
        return `**Error:** ${err instanceof Error ? err.message : String(err)}`
      }
    },
  })

  // ── Tool 2: matrix_operations ────────────────────────────────────────────
  registerTool({
    name: 'matrix_operations',
    description: 'Matrix operations: multiply, determinant, inverse, eigenvalues (QR iteration), SVD (singular values), rank, transpose, LU decomposition, add, subtract. Pure TypeScript — works for matrices up to ~50x50.',
    parameters: {
      matrix: { type: 'string', description: 'JSON 2D array, e.g. "[[1,2],[3,4]]"', required: true },
      operation: { type: 'string', description: 'Operation: multiply | determinant | inverse | eigenvalues | svd | rank | transpose | lu | add | subtract', required: true },
      matrix_b: { type: 'string', description: 'Second matrix (JSON 2D array) for multiply/add/subtract', required: false },
    },
    tier: 'free',
    async execute(args) {
      const m = safeParse<Matrix>(String(args.matrix), 'matrix')
      const op = String(args.operation).toLowerCase()

      try {
        switch (op) {
          case 'multiply':
          case 'mul': {
            if (!args.matrix_b) return '**Error:** matrix_b required for multiplication'
            const b = safeParse<Matrix>(String(args.matrix_b), 'matrix_b')
            const result = matMul(m, b)
            return `## Matrix Multiplication\n${matToString(m, 'A')} x\n${matToString(b, 'B')} =\n${matToString(result, 'A * B')}`
          }
          case 'add': {
            if (!args.matrix_b) return '**Error:** matrix_b required for addition'
            const b = safeParse<Matrix>(String(args.matrix_b), 'matrix_b')
            const result = matAdd(m, b)
            return `## Matrix Addition\n${matToString(result, 'A + B')}`
          }
          case 'subtract':
          case 'sub': {
            if (!args.matrix_b) return '**Error:** matrix_b required for subtraction'
            const b = safeParse<Matrix>(String(args.matrix_b), 'matrix_b')
            const result = matSub(m, b)
            return `## Matrix Subtraction\n${matToString(result, 'A - B')}`
          }
          case 'determinant':
          case 'det': {
            const det = matDet(m)
            return `## Determinant\n${matToString(m, 'A')}\n**det(A) = ${fmt(det)}**`
          }
          case 'inverse':
          case 'inv': {
            const inv = matInverse(m)
            return `## Matrix Inverse\n${matToString(m, 'A')}\n${matToString(inv, 'A^(-1)')}`
          }
          case 'eigenvalues':
          case 'eigen':
          case 'eig': {
            const eigs = matEigenvalues(m)
            return [
              `## Eigenvalues`,
              matToString(m, 'A'),
              `**Eigenvalues:** ${eigs.map(e => fmt(e)).join(', ')}`,
              '',
              `*Computed via QR iteration with Wilkinson shift.*`,
            ].join('\n')
          }
          case 'svd': {
            const { S } = matSVD(m)
            return [
              `## Singular Value Decomposition`,
              matToString(m, 'A'),
              `**Singular values:** ${S.map(s => fmt(s)).join(', ')}`,
              `**Rank (numeric):** ${S.filter(s => s > 1e-10).length}`,
              '',
              `*Singular values computed via eigenvalues of A^T A.*`,
            ].join('\n')
          }
          case 'rank': {
            const r = matRank(m)
            return `## Matrix Rank\n${matToString(m, 'A')}\n**rank(A) = ${r}**`
          }
          case 'transpose':
          case 'trans':
          case 't': {
            const t = matTranspose(m)
            return `## Transpose\n${matToString(m, 'A')}\n${matToString(t, 'A^T')}`
          }
          case 'lu': {
            const { L, U, P } = matLU(m)
            return [
              `## LU Decomposition (PA = LU)`,
              matToString(P, 'P (permutation)'),
              matToString(L, 'L (lower triangular)'),
              matToString(U, 'U (upper triangular)'),
            ].join('\n')
          }
          default:
            return `Unknown operation: "${op}". Supported: multiply, determinant, inverse, eigenvalues, svd, rank, transpose, lu, add, subtract`
        }
      } catch (err: unknown) {
        return `**Error:** ${err instanceof Error ? err.message : String(err)}`
      }
    },
  })

  // ── Tool 3: optimization_solve ───────────────────────────────────────────
  registerTool({
    name: 'optimization_solve',
    description: 'Optimization: Linear Programming (Simplex method), gradient descent (multi-variable), Newton\'s method (root-finding/minimization). Specify objective function, constraints, and method.',
    parameters: {
      problem_type: { type: 'string', description: 'Type: linear_programming | minimize | root_finding', required: true },
      objective: { type: 'string', description: 'Objective function or expression. For LP: comma-separated coefficients "3,5" for max 3x+5y. For minimize/root: expression like "x^2 + y^2"', required: true },
      constraints: { type: 'string', description: 'JSON array. For LP: [{"coeffs":[1,0],"rhs":4,"type":"<="},...]. For minimize: {"vars":["x","y"],"x0":[0,0],"lr":0.01,"max_iter":1000,"tol":1e-6}', required: false },
      method: { type: 'string', description: 'Method: simplex | gradient_descent | newton (default depends on problem_type)', required: false },
    },
    tier: 'free',
    async execute(args) {
      const pType = String(args.problem_type).toLowerCase().replace(/[\s_-]+/g, '_')
      const objective = String(args.objective)
      const method = String(args.method || '').toLowerCase()

      try {
        switch (pType) {
          case 'linear_programming':
          case 'lp': {
            const c = objective.split(',').map(Number)
            const constraints = args.constraints ? safeParse<{ coeffs: number[]; rhs: number; type?: string }[]>(String(args.constraints), 'constraints') : []
            const A = constraints.map(con => con.coeffs)
            const b = constraints.map(con => con.rhs)
            const result = simplex(c, A, b)

            const varNames = c.map((_, i) => `x${i + 1}`)
            const objStr = c.map((ci, i) => `${ci}${varNames[i]}`).join(' + ')

            return [
              `## Linear Programming (Simplex)`,
              `**Maximize:** ${objStr}`,
              `**Subject to:**`,
              ...constraints.map((con, i) => `- ${con.coeffs.map((ci, j) => `${ci}${varNames[j]}`).join(' + ')} ${con.type || '<='} ${con.rhs}`),
              `- All variables >= 0`,
              '',
              `**Status:** ${result.status}`,
              `**Optimal value:** ${fmt(result.value)}`,
              `**Solution:** ${result.solution.map((v, i) => `${varNames[i]} = ${fmt(v)}`).join(', ')}`,
            ].join('\n')
          }

          case 'minimize':
          case 'min': {
            const params = args.constraints ? safeParse<{ vars?: string[]; x0?: number[]; lr?: number; max_iter?: number; tol?: number }>(String(args.constraints), 'constraints') : {}
            const vars = params.vars || ['x']
            const x0 = params.x0 || vars.map(() => 0)
            const lr = params.lr ?? 0.01
            const maxIter = params.max_iter ?? 1000
            const tol = params.tol ?? 1e-8

            if (method === 'newton' && vars.length === 1) {
              // Newton's method to find minimum: solve f'(x) = 0
              const tree = parse(objective)
              const dStr = exprToString(deepSimplify(differentiate(tree, vars[0])))
              const result = newtonMethod(dStr, vars[0], x0[0], maxIter, tol)
              const minVal = evalExpr(tree, { [vars[0]]: result.root })
              return [
                `## Minimization (Newton's Method)`,
                `**Objective:** \`${objective}\``,
                `**Minimum at:** ${vars[0]} = ${fmt(result.root)}`,
                `**Minimum value:** ${fmt(minVal)}`,
                `**Converged:** ${result.converged} (${result.iterations} iterations)`,
              ].join('\n')
            }

            const result = gradientDescent(objective, vars, x0, lr, maxIter, tol)
            return [
              `## Minimization (Gradient Descent)`,
              `**Objective:** \`${objective}\``,
              `**Learning rate:** ${lr}`,
              `**Solution:** ${vars.map((v, i) => `${v} = ${fmt(result.solution[i])}`).join(', ')}`,
              `**Minimum value:** ${fmt(result.value)}`,
              `**Iterations:** ${result.iterations}`,
            ].join('\n')
          }

          case 'root_finding':
          case 'root': {
            const params = args.constraints ? safeParse<{ var?: string; x0?: number; max_iter?: number; tol?: number }>(String(args.constraints), 'constraints') : {}
            const variable = params.var || 'x'
            const x0 = params.x0 ?? 0
            const result = newtonMethod(objective, variable, x0, params.max_iter ?? 100, params.tol ?? 1e-10)
            return [
              `## Root Finding (Newton's Method)`,
              `**Equation:** \`${objective} = 0\``,
              `**Root:** ${variable} = ${fmt(result.root)}`,
              `**Converged:** ${result.converged} (${result.iterations} iterations)`,
            ].join('\n')
          }

          default:
            return `Unknown problem type: "${pType}". Supported: linear_programming, minimize, root_finding`
        }
      } catch (err: unknown) {
        return `**Error:** ${err instanceof Error ? err.message : String(err)}`
      }
    },
  })

  // ── Tool 4: number_theory ────────────────────────────────────────────────
  registerTool({
    name: 'number_theory',
    description: 'Number theory operations: primality testing (Miller-Rabin), factorization (trial division + Pollard\'s rho), GCD, LCM, modular exponentiation, Euler\'s totient, Chinese Remainder Theorem. Uses BigInt for precision.',
    parameters: {
      operation: { type: 'string', description: 'Operation: is_prime | factorize | gcd | lcm | mod_pow | totient | crt', required: true },
      numbers: { type: 'string', description: 'Comma-separated numbers or JSON. For mod_pow: "base,exp,mod". For crt: {"remainders":[2,3],"moduli":[5,7]}', required: true },
    },
    tier: 'free',
    async execute(args) {
      const op = String(args.operation).toLowerCase().replace(/[\s_-]+/g, '_')
      const numStr = String(args.numbers)

      try {
        switch (op) {
          case 'is_prime':
          case 'prime':
          case 'primality': {
            const n = BigInt(numStr.trim())
            const result = millerRabin(n)
            return [
              `## Primality Test (Miller-Rabin)`,
              `**n = ${n}**`,
              `**Result:** ${result ? 'PRIME' : 'COMPOSITE'}`,
              result ? '' : `**Factors:** ${factorize(n).join(' x ')}`,
            ].join('\n')
          }

          case 'factorize':
          case 'factor': {
            const n = BigInt(numStr.trim())
            const factors = factorize(n)
            // Group factors
            const counts = new Map<string, number>()
            for (const f of factors) {
              const k = f.toString()
              counts.set(k, (counts.get(k) ?? 0) + 1)
            }
            const factorStr = [...counts.entries()].map(([p, e]) => e > 1 ? `${p}^${e}` : p).join(' * ')
            return [
              `## Prime Factorization`,
              `**n = ${n}**`,
              `**Factors:** ${factorStr}`,
              `**Distinct primes:** ${[...counts.keys()].join(', ')}`,
              `**Number of divisors:** ${[...counts.values()].reduce((p, e) => p * (e + 1), 1)}`,
            ].join('\n')
          }

          case 'gcd': {
            const nums = numStr.split(',').map(s => BigInt(s.trim()))
            let result = nums[0]
            for (let i = 1; i < nums.length; i++) result = bigGcd(result, nums[i])
            return `## GCD\n**gcd(${nums.join(', ')}) = ${result}**`
          }

          case 'lcm': {
            const nums = numStr.split(',').map(s => BigInt(s.trim()))
            let result = nums[0]
            for (let i = 1; i < nums.length; i++) result = bigLcm(result, nums[i])
            return `## LCM\n**lcm(${nums.join(', ')}) = ${result}**`
          }

          case 'mod_pow':
          case 'modpow':
          case 'modular_exponentiation': {
            const parts = numStr.split(',').map(s => BigInt(s.trim()))
            if (parts.length < 3) return '**Error:** Need 3 values: base, exponent, modulus'
            const [base, exp, mod] = parts
            const result = modPow(base, exp, mod)
            return `## Modular Exponentiation\n**${base}^${exp} mod ${mod} = ${result}**`
          }

          case 'totient':
          case 'euler_totient':
          case 'phi': {
            const n = BigInt(numStr.trim())
            const result = eulerTotient(n)
            return [
              `## Euler's Totient`,
              `**phi(${n}) = ${result}**`,
              `*Number of integers in [1, ${n}] coprime to ${n}.*`,
            ].join('\n')
          }

          case 'crt':
          case 'chinese_remainder': {
            const data = safeParse<{ remainders: number[]; moduli: number[] }>(numStr, 'CRT input')
            const remainders = data.remainders.map(BigInt)
            const moduli = data.moduli.map(BigInt)
            const result = chineseRemainder(remainders, moduli)
            const eqs = remainders.map((r, i) => `x = ${r} (mod ${moduli[i]})`).join('\n- ')
            return [
              `## Chinese Remainder Theorem`,
              `**System:**`,
              `- ${eqs}`,
              '',
              `**Solution:** x = ${result.solution} (mod ${result.modulus})`,
            ].join('\n')
          }

          default:
            return `Unknown operation: "${op}". Supported: is_prime, factorize, gcd, lcm, mod_pow, totient, crt`
        }
      } catch (err: unknown) {
        return `**Error:** ${err instanceof Error ? err.message : String(err)}`
      }
    },
  })

  // ── Tool 5: graph_theory ─────────────────────────────────────────────────
  registerTool({
    name: 'graph_theory',
    description: 'Graph algorithms: Dijkstra shortest path, Kruskal MST, BFS/DFS connected components, betweenness centrality, greedy coloring, topological sort. Input: JSON graph {nodes, edges} where edges are {from, to, weight?}.',
    parameters: {
      graph: { type: 'string', description: 'JSON graph: {"nodes":["A","B","C"],"edges":[{"from":"A","to":"B","weight":1},...]}}', required: true },
      operation: { type: 'string', description: 'Operation: dijkstra | mst | components | centrality | coloring | topological_sort', required: true },
      params: { type: 'string', description: 'JSON params. For dijkstra: {"source":"A","target":"B"}', required: false },
    },
    tier: 'free',
    async execute(args) {
      const g = parseGraph(String(args.graph))
      const op = String(args.operation).toLowerCase().replace(/[\s_-]+/g, '_')
      const params = args.params ? safeParse<Record<string, unknown>>(String(args.params), 'params') : {}

      try {
        switch (op) {
          case 'dijkstra':
          case 'shortest_path': {
            const source = String(params.source ?? g.nodes[0])
            const target = params.target ? String(params.target) : undefined
            const { dist, prev } = dijkstra(g, source, target)

            if (target) {
              const path = reconstructPath(prev, target)
              const d = dist.get(target) ?? Infinity
              return [
                `## Shortest Path (Dijkstra)`,
                `**From:** ${source} **To:** ${target}`,
                `**Distance:** ${d === Infinity ? 'unreachable' : fmt(d)}`,
                `**Path:** ${path.join(' -> ')}`,
              ].join('\n')
            }

            const lines = [`## Shortest Paths from ${source} (Dijkstra)`, '']
            for (const [node, d] of dist) {
              const path = reconstructPath(prev, node)
              lines.push(`- **${node}:** distance = ${d === Infinity ? 'inf' : fmt(d)}${path.length > 1 ? ` (${path.join(' -> ')})` : ''}`)
            }
            return lines.join('\n')
          }

          case 'mst':
          case 'minimum_spanning_tree': {
            const { edges, totalWeight } = kruskalMST(g)
            return [
              `## Minimum Spanning Tree (Kruskal)`,
              `**Total weight:** ${fmt(totalWeight)}`,
              `**Edges:**`,
              ...edges.map(e => `- ${e.from} -- ${e.to} (weight: ${e.weight ?? 1})`),
            ].join('\n')
          }

          case 'components':
          case 'connected_components':
          case 'bfs': {
            const comps = bfsComponents(g)
            return [
              `## Connected Components (BFS)`,
              `**Number of components:** ${comps.length}`,
              ...comps.map((c, i) => `- Component ${i + 1}: {${c.join(', ')}} (size: ${c.length})`),
            ].join('\n')
          }

          case 'centrality':
          case 'betweenness':
          case 'betweenness_centrality': {
            const cb = betweennessCentrality(g)
            const sorted = [...cb.entries()].sort((a, b) => b[1] - a[1])
            return [
              `## Betweenness Centrality (Brandes)`,
              `| Node | Centrality |`,
              `|------|-----------|`,
              ...sorted.map(([n, c]) => `| ${n} | ${fmt(c, 4)} |`),
            ].join('\n')
          }

          case 'coloring':
          case 'greedy_coloring': {
            const colors = greedyColoring(g)
            const numColors = new Set(colors.values()).size
            return [
              `## Graph Coloring (Greedy)`,
              `**Chromatic number (upper bound):** ${numColors}`,
              `**Assignment:**`,
              ...[...colors.entries()].map(([n, c]) => `- ${n}: color ${c}`),
            ].join('\n')
          }

          case 'topological_sort':
          case 'topo_sort':
          case 'toposort': {
            const order = topologicalSort(g)
            if (!order) return `## Topological Sort\n**Error:** Graph contains a cycle — no topological ordering exists.`
            return [
              `## Topological Sort (Kahn's Algorithm)`,
              `**Order:** ${order.join(' -> ')}`,
            ].join('\n')
          }

          default:
            return `Unknown operation: "${op}". Supported: dijkstra, mst, components, centrality, coloring, topological_sort`
        }
      } catch (err: unknown) {
        return `**Error:** ${err instanceof Error ? err.message : String(err)}`
      }
    },
  })

  // ── Tool 6: combinatorics ────────────────────────────────────────────────
  registerTool({
    name: 'combinatorics',
    description: 'Combinatorics: permutations P(n,k), combinations C(n,k), Catalan numbers, Stirling numbers (2nd kind), Bell numbers, integer partition numbers, derangements, factorial. Uses BigInt for arbitrary precision.',
    parameters: {
      operation: { type: 'string', description: 'Operation: permutations | combinations | catalan | stirling | bell | partition | derangement | factorial', required: true },
      n: { type: 'number', description: 'Primary parameter n', required: true },
      k: { type: 'number', description: 'Secondary parameter k (for permutations, combinations, stirling)', required: false },
    },
    tier: 'free',
    async execute(args) {
      const op = String(args.operation).toLowerCase()
      const n = Number(args.n)
      const k = args.k !== undefined ? Number(args.k) : undefined

      if (!Number.isInteger(n) || n < 0) return '**Error:** n must be a non-negative integer'
      if (n > 1000) return '**Error:** n too large (max 1000 to avoid excessive computation)'

      try {
        switch (op) {
          case 'permutations':
          case 'perm':
          case 'p': {
            if (k === undefined) return '**Error:** k is required for permutations'
            const result = bigPerm(n, k)
            return `## Permutations\n**P(${n}, ${k}) = ${result}**\n\n*Number of ways to arrange ${k} items from ${n} distinct items.*`
          }

          case 'combinations':
          case 'comb':
          case 'c':
          case 'choose': {
            if (k === undefined) return '**Error:** k is required for combinations'
            const result = bigComb(n, k)
            return `## Combinations\n**C(${n}, ${k}) = ${result}**\n\n*Number of ways to choose ${k} items from ${n} distinct items (order doesn't matter).*`
          }

          case 'catalan': {
            const result = catalanNumber(n)
            return [
              `## Catalan Number`,
              `**C_${n} = ${result}**`,
              '',
              `*Counts: valid parenthesizations, binary trees with ${n + 1} leaves, monotonic lattice paths, non-crossing partitions, etc.*`,
            ].join('\n')
          }

          case 'stirling':
          case 'stirling2': {
            if (k === undefined) return '**Error:** k is required for Stirling numbers'
            const result = stirling2(n, k)
            return [
              `## Stirling Number (2nd Kind)`,
              `**S(${n}, ${k}) = ${result}**`,
              '',
              `*Number of ways to partition ${n} elements into ${k} non-empty subsets.*`,
            ].join('\n')
          }

          case 'bell': {
            const result = bellNumber(n)
            return [
              `## Bell Number`,
              `**B_${n} = ${result}**`,
              '',
              `*Total number of partitions of a set with ${n} elements.*`,
            ].join('\n')
          }

          case 'partition':
          case 'partitions': {
            const result = partitionNumber(n)
            return [
              `## Partition Number`,
              `**p(${n}) = ${result}**`,
              '',
              `*Number of ways to write ${n} as a sum of positive integers (order doesn't matter).*`,
            ].join('\n')
          }

          case 'derangement':
          case 'derangements':
          case 'subfactorial': {
            const result = derangement(n)
            return [
              `## Derangement`,
              `**D_${n} = ${result}**`,
              '',
              `*Number of permutations of ${n} elements with no fixed points.*`,
              `*Probability of a random permutation being a derangement: ~1/e = ${fmt(Number(result) / Number(bigFactorial(n)), 6)}*`,
            ].join('\n')
          }

          case 'factorial':
          case 'fact': {
            const result = bigFactorial(n)
            const str = result.toString()
            return [
              `## Factorial`,
              `**${n}! = ${str.length > 100 ? str.slice(0, 50) + '...' + str.slice(-50) : str}**`,
              str.length > 100 ? `*(${str.length} digits)*` : '',
            ].join('\n')
          }

          default:
            return `Unknown operation: "${op}". Supported: permutations, combinations, catalan, stirling, bell, partition, derangement, factorial`
        }
      } catch (err: unknown) {
        return `**Error:** ${err instanceof Error ? err.message : String(err)}`
      }
    },
  })

  // ── Tool 7: differential_eq ──────────────────────────────────────────────
  registerTool({
    name: 'differential_eq',
    description: 'Solve first-order ODEs numerically: dy/dx = f(x, y). Methods: Euler, RK4 (classical Runge-Kutta), RK45 (adaptive Dormand-Prince). Parses math expressions with x, y variables.',
    parameters: {
      equation: { type: 'string', description: 'The RHS f(x,y) of dy/dx = f(x,y), e.g. "x + y" or "-2*y + sin(x)"', required: true },
      initial_conditions: { type: 'string', description: 'JSON: {"x0": 0, "y0": 1}', required: true },
      x_end: { type: 'number', description: 'End value of x', required: true },
      method: { type: 'string', description: 'Method: euler | rk4 | rk45 (default: rk4)', required: false },
      step_size: { type: 'number', description: 'Step size h (default: 0.1, ignored for rk45 which is adaptive)', required: false },
    },
    tier: 'free',
    async execute(args) {
      const eqStr = String(args.equation)
      const ic = safeParse<{ x0: number; y0: number }>(String(args.initial_conditions), 'initial_conditions')
      const xEnd = Number(args.x_end)
      const method = String(args.method || 'rk4').toLowerCase()
      const h = Number(args.step_size || 0.1)

      try {
        const f = parseODEFunc(eqStr)
        let result: { x: number[]; y: number[] }

        switch (method) {
          case 'euler':
            result = eulerMethod(f, ic.x0, ic.y0, xEnd, h)
            break
          case 'rk4':
            result = rk4Method(f, ic.x0, ic.y0, xEnd, h)
            break
          case 'rk45':
          case 'adaptive':
          case 'dormand_prince':
            result = rk45Method(f, ic.x0, ic.y0, xEnd)
            break
          default:
            return `Unknown method: "${method}". Supported: euler, rk4, rk45`
        }

        // Show a subset of points (at most 25)
        const step = Math.max(1, Math.floor(result.x.length / 25))
        const lines = [
          `## ODE Solution`,
          `**Equation:** dy/dx = ${eqStr}`,
          `**Initial condition:** y(${ic.x0}) = ${ic.y0}`,
          `**Method:** ${method.toUpperCase()}${method !== 'rk45' ? `, h = ${h}` : ' (adaptive)'}`,
          `**Points computed:** ${result.x.length}`,
          '',
          `| x | y |`,
          `|---|---|`,
        ]
        for (let i = 0; i < result.x.length; i += step) {
          lines.push(`| ${fmt(result.x[i])} | ${fmt(result.y[i])} |`)
        }
        // Always include the last point
        if ((result.x.length - 1) % step !== 0) {
          const last = result.x.length - 1
          lines.push(`| ${fmt(result.x[last])} | ${fmt(result.y[last])} |`)
        }

        lines.push('', `**y(${fmt(xEnd)}) = ${fmt(result.y[result.y.length - 1])}**`)
        return lines.join('\n')
      } catch (err: unknown) {
        return `**Error:** ${err instanceof Error ? err.message : String(err)}`
      }
    },
  })

  // ── Tool 8: probability_calc ─────────────────────────────────────────────
  registerTool({
    name: 'probability_calc',
    description: 'Probability distributions: PDF/PMF, CDF, quantiles (inverse CDF), moments. Supports: normal, poisson, binomial, exponential, gamma, chi_squared, student_t, f, beta, weibull.',
    parameters: {
      distribution: { type: 'string', description: 'Distribution name: normal | poisson | binomial | exponential | gamma | chi_squared | student_t | f | beta | weibull', required: true },
      operation: { type: 'string', description: 'Operation: pdf | cdf | quantile | moments', required: true },
      params: { type: 'string', description: 'JSON with distribution params + query value. E.g. {"x":1.96,"mean":0,"std":1} for normal, {"k":5,"lambda":3} for poisson', required: true },
    },
    tier: 'free',
    async execute(args) {
      const dist = String(args.distribution).toLowerCase().replace(/[\s_-]+/g, '_')
      const operation = String(args.operation).toLowerCase()
      const p = safeParse<Record<string, number>>(String(args.params), 'params')

      try {
        const results: DistResult[] = []
        let distDesc = ''

        switch (dist) {
          case 'normal':
          case 'gaussian': {
            const mu = p.mean ?? p.mu ?? 0
            const sigma = p.std ?? p.sigma ?? 1
            distDesc = `Normal(mu=${mu}, sigma=${sigma})`

            if (operation === 'pdf') {
              const x = p.x ?? 0
              const z = (x - mu) / sigma
              results.push({ value: normalPDF(z) / sigma, label: `PDF(${x})` })
            } else if (operation === 'cdf') {
              const x = p.x ?? 0
              const z = (x - mu) / sigma
              results.push({ value: normalCDF(z), label: `CDF(${x})` })
              results.push({ value: 1 - normalCDF(z), label: `P(X > ${x})` })
            } else if (operation === 'quantile') {
              const prob = p.p ?? p.probability ?? 0.5
              const z = normalQuantile(prob)
              results.push({ value: mu + sigma * z, label: `Quantile(${prob})` })
            } else if (operation === 'moments') {
              results.push({ value: mu, label: 'Mean' })
              results.push({ value: sigma * sigma, label: 'Variance' })
              results.push({ value: sigma, label: 'Std Dev' })
              results.push({ value: 0, label: 'Skewness' })
              results.push({ value: 3, label: 'Kurtosis' })
            }
            break
          }

          case 'poisson': {
            const lambda = p.lambda ?? p.rate ?? 1
            distDesc = `Poisson(lambda=${lambda})`

            if (operation === 'pdf' || operation === 'pmf') {
              const k = Math.floor(p.k ?? p.x ?? 0)
              results.push({ value: poissonPMF(k, lambda), label: `P(X = ${k})` })
            } else if (operation === 'cdf') {
              const k = Math.floor(p.k ?? p.x ?? 0)
              results.push({ value: poissonCDF(k, lambda), label: `P(X <= ${k})` })
            } else if (operation === 'moments') {
              results.push({ value: lambda, label: 'Mean' })
              results.push({ value: lambda, label: 'Variance' })
              results.push({ value: 1 / Math.sqrt(lambda), label: 'Skewness' })
            }
            break
          }

          case 'binomial': {
            const n = Math.floor(p.n ?? 10)
            const prob = p.p ?? p.probability ?? 0.5
            distDesc = `Binomial(n=${n}, p=${prob})`

            if (operation === 'pdf' || operation === 'pmf') {
              const k = Math.floor(p.k ?? p.x ?? 0)
              results.push({ value: binomialPMF(k, n, prob), label: `P(X = ${k})` })
            } else if (operation === 'cdf') {
              const k = Math.floor(p.k ?? p.x ?? 0)
              results.push({ value: binomialCDF(k, n, prob), label: `P(X <= ${k})` })
            } else if (operation === 'moments') {
              results.push({ value: n * prob, label: 'Mean' })
              results.push({ value: n * prob * (1 - prob), label: 'Variance' })
              results.push({ value: (1 - 2 * prob) / Math.sqrt(n * prob * (1 - prob)), label: 'Skewness' })
            }
            break
          }

          case 'exponential': {
            const lambda = p.lambda ?? p.rate ?? 1
            distDesc = `Exponential(lambda=${lambda})`

            if (operation === 'pdf') {
              const x = p.x ?? 0
              results.push({ value: exponentialPDF(x, lambda), label: `PDF(${x})` })
            } else if (operation === 'cdf') {
              const x = p.x ?? 0
              results.push({ value: exponentialCDF(x, lambda), label: `CDF(${x})` })
            } else if (operation === 'quantile') {
              const prob = p.p ?? p.probability ?? 0.5
              results.push({ value: -Math.log(1 - prob) / lambda, label: `Quantile(${prob})` })
            } else if (operation === 'moments') {
              results.push({ value: 1 / lambda, label: 'Mean' })
              results.push({ value: 1 / (lambda * lambda), label: 'Variance' })
              results.push({ value: 2, label: 'Skewness' })
            }
            break
          }

          case 'gamma': {
            const alpha = p.alpha ?? p.shape ?? p.k ?? 1
            const beta = p.beta ?? p.scale ?? p.theta ?? 1
            distDesc = `Gamma(alpha=${alpha}, beta=${beta})`

            if (operation === 'pdf') {
              const x = p.x ?? 0
              results.push({ value: gammaPDF(x, alpha, beta), label: `PDF(${x})` })
            } else if (operation === 'cdf') {
              const x = p.x ?? 0
              results.push({ value: gammaCDF(x, alpha, beta), label: `CDF(${x})` })
            } else if (operation === 'moments') {
              results.push({ value: alpha * beta, label: 'Mean' })
              results.push({ value: alpha * beta * beta, label: 'Variance' })
              results.push({ value: 2 / Math.sqrt(alpha), label: 'Skewness' })
            }
            break
          }

          case 'chi_squared':
          case 'chi2':
          case 'chisquared': {
            const k = p.k ?? p.df ?? 1
            distDesc = `Chi-squared(k=${k})`

            if (operation === 'pdf') {
              const x = p.x ?? 0
              results.push({ value: chi2PDF(x, k), label: `PDF(${x})` })
            } else if (operation === 'cdf') {
              const x = p.x ?? 0
              results.push({ value: chi2CDF(x, k), label: `CDF(${x})` })
              results.push({ value: 1 - chi2CDF(x, k), label: `p-value (right tail)` })
            } else if (operation === 'moments') {
              results.push({ value: k, label: 'Mean' })
              results.push({ value: 2 * k, label: 'Variance' })
              results.push({ value: Math.sqrt(8 / k), label: 'Skewness' })
            }
            break
          }

          case 'student_t':
          case 't': {
            const nu = p.nu ?? p.df ?? 1
            distDesc = `Student's t(nu=${nu})`

            if (operation === 'pdf') {
              const x = p.x ?? 0
              results.push({ value: studentTPDF(x, nu), label: `PDF(${x})` })
            } else if (operation === 'cdf') {
              const x = p.x ?? 0
              results.push({ value: studentTCDF(x, nu), label: `CDF(${x})` })
              results.push({ value: 2 * (1 - studentTCDF(Math.abs(x), nu)), label: `Two-tailed p-value` })
            } else if (operation === 'moments') {
              results.push({ value: nu > 1 ? 0 : NaN, label: 'Mean' })
              results.push({ value: nu > 2 ? nu / (nu - 2) : Infinity, label: 'Variance' })
              results.push({ value: nu > 3 ? 0 : NaN, label: 'Skewness' })
            }
            break
          }

          case 'f':
          case 'f_distribution':
          case 'fisher': {
            const d1 = p.d1 ?? p.df1 ?? 1
            const d2 = p.d2 ?? p.df2 ?? 1
            distDesc = `F(d1=${d1}, d2=${d2})`

            if (operation === 'pdf') {
              const x = p.x ?? 0
              results.push({ value: fDistPDF(x, d1, d2), label: `PDF(${x})` })
            } else if (operation === 'cdf') {
              const x = p.x ?? 0
              results.push({ value: fDistCDF(x, d1, d2), label: `CDF(${x})` })
              results.push({ value: 1 - fDistCDF(x, d1, d2), label: `p-value (right tail)` })
            } else if (operation === 'moments') {
              results.push({ value: d2 > 2 ? d2 / (d2 - 2) : Infinity, label: 'Mean' })
              results.push({ value: d2 > 4 ? 2 * d2 * d2 * (d1 + d2 - 2) / (d1 * (d2 - 2) * (d2 - 2) * (d2 - 4)) : Infinity, label: 'Variance' })
            }
            break
          }

          case 'beta': {
            const alpha = p.alpha ?? p.a ?? 1
            const beta = p.beta ?? p.b ?? 1
            distDesc = `Beta(alpha=${alpha}, beta=${beta})`

            if (operation === 'pdf') {
              const x = p.x ?? 0.5
              results.push({ value: betaDistPDF(x, alpha, beta), label: `PDF(${x})` })
            } else if (operation === 'cdf') {
              const x = p.x ?? 0.5
              results.push({ value: betaDistCDF(x, alpha, beta), label: `CDF(${x})` })
            } else if (operation === 'moments') {
              const ab = alpha + beta
              results.push({ value: alpha / ab, label: 'Mean' })
              results.push({ value: alpha * beta / (ab * ab * (ab + 1)), label: 'Variance' })
              results.push({ value: 2 * (beta - alpha) * Math.sqrt(ab + 1) / ((ab + 2) * Math.sqrt(alpha * beta)), label: 'Skewness' })
            }
            break
          }

          case 'weibull': {
            const k = p.k ?? p.shape ?? 1
            const lambda = p.lambda ?? p.scale ?? 1
            distDesc = `Weibull(k=${k}, lambda=${lambda})`

            if (operation === 'pdf') {
              const x = p.x ?? 0
              results.push({ value: weibullPDF(x, k, lambda), label: `PDF(${x})` })
            } else if (operation === 'cdf') {
              const x = p.x ?? 0
              results.push({ value: weibullCDF(x, k, lambda), label: `CDF(${x})` })
            } else if (operation === 'quantile') {
              const prob = p.p ?? p.probability ?? 0.5
              results.push({ value: lambda * Math.pow(-Math.log(1 - prob), 1 / k), label: `Quantile(${prob})` })
            } else if (operation === 'moments') {
              results.push({ value: lambda * gammaFn(1 + 1 / k), label: 'Mean' })
              results.push({ value: lambda * lambda * (gammaFn(1 + 2 / k) - Math.pow(gammaFn(1 + 1 / k), 2)), label: 'Variance' })
            }
            break
          }

          default:
            return `Unknown distribution: "${dist}". Supported: normal, poisson, binomial, exponential, gamma, chi_squared, student_t, f, beta, weibull`
        }

        if (results.length === 0) return `No results computed. Check operation "${operation}" is valid for ${dist}.`

        return [
          `## ${distDesc}`,
          `**Operation:** ${operation}`,
          '',
          ...results.map(r => `- **${r.label}** = ${fmt(r.value)}`),
        ].join('\n')
      } catch (err: unknown) {
        return `**Error:** ${err instanceof Error ? err.message : String(err)}`
      }
    },
  })

  // ── Tool 9: fourier_analysis ─────────────────────────────────────────────
  registerTool({
    name: 'fourier_analysis',
    description: 'Fourier analysis: FFT (Cooley-Tukey radix-2), power spectrum, inverse FFT, frequency identification. Input data as comma-separated values, auto-pads to power of 2.',
    parameters: {
      data: { type: 'string', description: 'Comma-separated real values, e.g. "1,0,-1,0,1,0,-1,0"', required: true },
      sample_rate: { type: 'number', description: 'Sample rate in Hz (default: 1)', required: false },
      operation: { type: 'string', description: 'Operation: fft | power_spectrum | ifft | identify_frequencies', required: true },
    },
    tier: 'free',
    async execute(args) {
      const dataStr = String(args.data)
      const sampleRate = Number(args.sample_rate || 1)
      const operation = String(args.operation).toLowerCase().replace(/[\s_-]+/g, '_')

      try {
        const values = dataStr.split(',').map(s => parseFloat(s.trim()))
        if (values.some(isNaN)) return '**Error:** Data contains non-numeric values'

        let complexData: Complex[] = values.map(v => ({ re: v, im: 0 }))
        complexData = padToPow2(complexData)
        const N = complexData.length

        switch (operation) {
          case 'fft': {
            const result = fft(complexData)
            const lines = [
              `## FFT (Cooley-Tukey)`,
              `**Input length:** ${values.length} (padded to ${N})`,
              `**Sample rate:** ${sampleRate} Hz`,
              '',
              `| Bin | Frequency (Hz) | Magnitude | Phase (rad) |`,
              `|-----|---------------|-----------|-------------|`,
            ]
            const show = Math.min(N / 2, 20)
            for (let i = 0; i < show; i++) {
              const freq = i * sampleRate / N
              const mag = cAbs(result[i])
              const phase = Math.atan2(result[i].im, result[i].re)
              lines.push(`| ${i} | ${fmt(freq)} | ${fmt(mag)} | ${fmt(phase)} |`)
            }
            if (N / 2 > 20) lines.push(`*... showing first 20 of ${N / 2} frequency bins*`)
            return lines.join('\n')
          }

          case 'power_spectrum':
          case 'spectrum': {
            const result = fft(complexData)
            const lines = [
              `## Power Spectrum`,
              `**Input length:** ${values.length} (padded to ${N})`,
              `**Frequency resolution:** ${fmt(sampleRate / N)} Hz`,
              '',
              `| Frequency (Hz) | Power (dB) | Magnitude |`,
              `|---------------|-----------|-----------|`,
            ]
            const show = Math.min(N / 2, 25)
            for (let i = 0; i < show; i++) {
              const freq = i * sampleRate / N
              const mag = cAbs(result[i]) * 2 / N
              const power = mag > 0 ? 20 * Math.log10(mag) : -Infinity
              lines.push(`| ${fmt(freq)} | ${power === -Infinity ? '-inf' : fmt(power)} | ${fmt(mag)} |`)
            }
            return lines.join('\n')
          }

          case 'ifft':
          case 'inverse_fft': {
            // Parse as complex: "re1+im1j, re2+im2j, ..." or just real values
            let inputComplex: Complex[]
            if (dataStr.includes('j') || dataStr.includes('i')) {
              inputComplex = dataStr.split(',').map(s => {
                s = s.trim().replace(/i/g, 'j')
                const match = s.match(/^([+-]?[\d.]+)?([+-][\d.]+)?j?$/)
                if (!match) return { re: parseFloat(s), im: 0 }
                return { re: parseFloat(match[1] || '0'), im: parseFloat(match[2] || '0') }
              })
            } else {
              inputComplex = values.map(v => ({ re: v, im: 0 }))
            }
            inputComplex = padToPow2(inputComplex)
            const result = fft(inputComplex, true)
            const realParts = result.map(c => fmt(c.re)).slice(0, values.length)
            return [
              `## Inverse FFT`,
              `**Output:** [${realParts.join(', ')}]`,
              `*(${result.length} points, showing first ${values.length})*`,
            ].join('\n')
          }

          case 'identify_frequencies':
          case 'identify':
          case 'peaks': {
            const result = fft(complexData)
            const magnitudes: { freq: number; mag: number; bin: number }[] = []
            for (let i = 1; i < N / 2; i++) {
              const freq = i * sampleRate / N
              const mag = cAbs(result[i]) * 2 / N
              magnitudes.push({ freq, mag, bin: i })
            }
            // Sort by magnitude, take top peaks
            magnitudes.sort((a, b) => b.mag - a.mag)
            const threshold = magnitudes.length > 0 ? magnitudes[0].mag * 0.1 : 0
            const peaks = magnitudes.filter(m => m.mag > threshold).slice(0, 10)

            return [
              `## Dominant Frequencies`,
              `**Sample rate:** ${sampleRate} Hz`,
              `**Nyquist frequency:** ${sampleRate / 2} Hz`,
              '',
              `| Frequency (Hz) | Magnitude | Relative |`,
              `|---------------|-----------|----------|`,
              ...peaks.map(p => `| ${fmt(p.freq)} | ${fmt(p.mag)} | ${fmt(p.mag / peaks[0].mag * 100)}% |`),
              '',
              `*Found ${peaks.length} significant frequency component(s) above 10% of peak.*`,
            ].join('\n')
          }

          default:
            return `Unknown operation: "${operation}". Supported: fft, power_spectrum, ifft, identify_frequencies`
        }
      } catch (err: unknown) {
        return `**Error:** ${err instanceof Error ? err.message : String(err)}`
      }
    },
  })

  // ── Tool 10: oeis_lookup ─────────────────────────────────────────────────
  registerTool({
    name: 'oeis_lookup',
    description: 'Look up integer sequences in the OEIS (Online Encyclopedia of Integer Sequences). Search by sequence values or keywords.',
    parameters: {
      sequence: { type: 'string', description: 'Comma-separated integers "1,1,2,3,5,8" or keyword query "catalan numbers"', required: true },
      search_type: { type: 'string', description: 'Search type: sequence | keyword (default: auto-detect)', required: false },
    },
    tier: 'free',
    async execute(args) {
      const query = String(args.sequence).trim()
      let searchType = String(args.search_type || '').toLowerCase()

      // Auto-detect: if all comma-separated parts are numbers, treat as sequence
      if (!searchType) {
        const parts = query.split(',').map(s => s.trim())
        searchType = parts.every(p => /^-?\d+$/.test(p)) ? 'sequence' : 'keyword'
      }

      try {
        const searchQuery = searchType === 'sequence'
          ? query.split(',').map(s => s.trim()).join(',')
          : query

        const url = `https://oeis.org/search?fmt=json&q=${encodeURIComponent(searchQuery)}&start=0`

        const controller = new AbortController()
        const timeout = setTimeout(() => controller.abort(), 15000)
        const res = await fetch(url, {
          headers: { 'User-Agent': 'KBot/3.4 (Math Tools)' },
          signal: controller.signal,
        })
        clearTimeout(timeout)

        if (!res.ok) {
          return `**Error:** OEIS returned HTTP ${res.status}. The service may be temporarily unavailable.`
        }

        const data = await res.json() as { count?: number; results?: Array<{ number: number; name: string; data: string; formula?: string[]; comment?: string[]; link?: string[] }> }

        if (!data.results || data.results.length === 0) {
          return `## OEIS Lookup\n**Query:** ${query}\n**No results found.**\n\nTry a longer sequence or different keywords.`
        }

        const lines = [
          `## OEIS Lookup`,
          `**Query:** ${query} (${searchType})`,
          `**Results:** ${data.count ?? data.results.length} found`,
          '',
        ]

        for (const seq of data.results.slice(0, 5)) {
          const id = `A${String(seq.number).padStart(6, '0')}`
          const terms = seq.data?.split(',').slice(0, 15).join(', ') || ''
          lines.push(`### [${id}](https://oeis.org/${id}) — ${seq.name}`)
          lines.push(`**Terms:** ${terms}, ...`)
          if (seq.formula?.length) lines.push(`**Formula:** ${seq.formula[0]}`)
          if (seq.comment?.length) lines.push(`**Note:** ${seq.comment[0]}`)
          lines.push('')
        }

        return lines.join('\n')
      } catch (err: unknown) {
        if (err instanceof Error && err.name === 'AbortError') {
          return '**Error:** OEIS request timed out (15s). Try again or check your connection.'
        }
        return `**Error:** ${err instanceof Error ? err.message : String(err)}`
      }
    },
  })
}

// ─────────────────────────────────────────────────────────────────────────────
// INTERNAL: Basic symbolic integration for simple forms
// ─────────────────────────────────────────────────────────────────────────────

/** Attempt basic symbolic integration. Returns null if too complex. */
function tryIntegrate(expr: Expr, v: string): Expr | null {
  // Constant (wrt v)
  if (!containsVar(expr, v)) {
    return { type: 'mul', left: expr, right: { type: 'var', name: v } }
  }

  switch (expr.type) {
    case 'var': {
      // integral of x dx = x^2 / 2
      if (expr.name === v) {
        return { type: 'div', left: { type: 'pow', base: expr, exp: { type: 'num', value: 2 } }, right: { type: 'num', value: 2 } }
      }
      return null
    }

    case 'num': {
      return { type: 'mul', left: expr, right: { type: 'var', name: v } }
    }

    case 'neg': {
      const inner = tryIntegrate(expr.arg, v)
      return inner ? { type: 'neg', arg: inner } : null
    }

    case 'add': {
      const l = tryIntegrate(expr.left, v)
      const r = tryIntegrate(expr.right, v)
      return l && r ? { type: 'add', left: l, right: r } : null
    }

    case 'sub': {
      const l = tryIntegrate(expr.left, v)
      const r = tryIntegrate(expr.right, v)
      return l && r ? { type: 'sub', left: l, right: r } : null
    }

    case 'mul': {
      // c * f(x) or f(x) * c
      if (!containsVar(expr.left, v)) {
        const inner = tryIntegrate(expr.right, v)
        return inner ? { type: 'mul', left: expr.left, right: inner } : null
      }
      if (!containsVar(expr.right, v)) {
        const inner = tryIntegrate(expr.left, v)
        return inner ? { type: 'mul', left: expr.right, right: inner } : null
      }
      return null // product of two variable expressions — not handled
    }

    case 'div': {
      // f(x) / c
      if (!containsVar(expr.right, v)) {
        const inner = tryIntegrate(expr.left, v)
        return inner ? { type: 'div', left: inner, right: expr.right } : null
      }
      // 1 / x
      if (expr.left.type === 'num' && expr.left.value === 1 && expr.right.type === 'var' && expr.right.name === v) {
        return { type: 'fn', name: 'log', arg: { type: 'fn', name: 'abs', arg: { type: 'var', name: v } } }
      }
      return null
    }

    case 'pow': {
      // x^n where n is constant
      if (expr.base.type === 'var' && expr.base.name === v && !containsVar(expr.exp, v)) {
        if (expr.exp.type === 'num' && expr.exp.value === -1) {
          // integral of x^(-1) = ln|x|
          return { type: 'fn', name: 'log', arg: { type: 'fn', name: 'abs', arg: { type: 'var', name: v } } }
        }
        // integral of x^n = x^(n+1) / (n+1)
        const newExp: Expr = { type: 'add', left: expr.exp, right: { type: 'num', value: 1 } }
        return { type: 'div', left: { type: 'pow', base: expr.base, exp: newExp }, right: newExp }
      }
      // e^x
      if (expr.base.type === 'num' && Math.abs(expr.base.value - Math.E) < 1e-10 && expr.exp.type === 'var' && expr.exp.name === v) {
        return expr
      }
      // a^x = a^x / ln(a)
      if (!containsVar(expr.base, v) && expr.exp.type === 'var' && expr.exp.name === v) {
        return { type: 'div', left: expr, right: { type: 'fn', name: 'log', arg: expr.base } }
      }
      return null
    }

    case 'fn': {
      // Only if the argument is just the variable
      if (expr.arg.type !== 'var' || expr.arg.name !== v) {
        // Check for simple chain rule: f(ax+b)
        // For now, return null for complex arguments
        return null
      }
      switch (expr.name) {
        case 'sin': return { type: 'neg', arg: { type: 'fn', name: 'cos', arg: expr.arg } }
        case 'cos': return { type: 'fn', name: 'sin', arg: expr.arg }
        case 'exp': return expr
        case 'log': return { type: 'sub', left: { type: 'mul', left: { type: 'var', name: v }, right: { type: 'fn', name: 'log', arg: { type: 'var', name: v } } }, right: { type: 'var', name: v } }
        // 1/cos^2(x) dx = tan(x)
        default: return null
      }
    }
  }
}
