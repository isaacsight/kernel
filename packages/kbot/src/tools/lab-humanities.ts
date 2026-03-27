// kbot Lab Humanities Tools — Linguistics, Philosophy, History, Digital Humanities
// Computational text analysis, formal logic, argument mapping, ethical frameworks,
// historical timelines, language typology, IPA phonetics, stylometry,
// philosophical encyclopedia, and archival search.

import { registerTool } from './index.js'

// ─── Text Helpers ───────────────────────────────────────────────────────────

/** Tokenize text into lowercase words, stripping punctuation */
function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s'-]/gu, ' ')
    .split(/\s+/)
    .filter(w => w.length > 0)
}

/** Split text into sentences (rough heuristic) */
function sentenceSplit(text: string): string[] {
  return text
    .split(/(?<=[.!?])\s+/)
    .map(s => s.trim())
    .filter(s => s.length > 0)
}

// ─── Corpus Analyze ─────────────────────────────────────────────────────────

function wordFrequency(tokens: string[], top: number): Map<string, number> {
  const freq = new Map<string, number>()
  for (const t of tokens) freq.set(t, (freq.get(t) || 0) + 1)
  const sorted = [...freq.entries()].sort((a, b) => b[1] - a[1])
  return new Map(sorted.slice(0, top))
}

function computeNgrams(tokens: string[], n: number, top: number): Map<string, number> {
  const freq = new Map<string, number>()
  for (let i = 0; i <= tokens.length - n; i++) {
    const gram = tokens.slice(i, i + n).join(' ')
    freq.set(gram, (freq.get(gram) || 0) + 1)
  }
  const sorted = [...freq.entries()].sort((a, b) => b[1] - a[1])
  return new Map(sorted.slice(0, top))
}

function hapaxLegomena(tokens: string[]): string[] {
  const freq = new Map<string, number>()
  for (const t of tokens) freq.set(t, (freq.get(t) || 0) + 1)
  return [...freq.entries()].filter(([, c]) => c === 1).map(([w]) => w)
}

function typeTokenRatio(tokens: string[]): { types: number; tokens: number; ttr: number } {
  const types = new Set(tokens).size
  return { types, tokens: tokens.length, ttr: tokens.length > 0 ? types / tokens.length : 0 }
}

function vocabularyGrowthCurve(tokens: string[]): { curve: [number, number][]; heapsK: number; heapsBeta: number } {
  const seen = new Set<string>()
  const curve: [number, number][] = []
  const step = Math.max(1, Math.floor(tokens.length / 50))
  for (let i = 0; i < tokens.length; i++) {
    seen.add(tokens[i])
    if (i % step === 0 || i === tokens.length - 1) {
      curve.push([i + 1, seen.size])
    }
  }
  // Heaps' law fit: V = K * N^beta via log-log linear regression
  const logN: number[] = []
  const logV: number[] = []
  for (const [n, v] of curve) {
    if (n > 0 && v > 0) {
      logN.push(Math.log(n))
      logV.push(Math.log(v))
    }
  }
  let beta = 0.5, K = 1
  if (logN.length >= 2) {
    const meanX = logN.reduce((a, b) => a + b, 0) / logN.length
    const meanY = logV.reduce((a, b) => a + b, 0) / logV.length
    let num = 0, den = 0
    for (let i = 0; i < logN.length; i++) {
      num += (logN[i] - meanX) * (logV[i] - meanY)
      den += (logN[i] - meanX) ** 2
    }
    beta = den !== 0 ? num / den : 0.5
    K = Math.exp(meanY - beta * meanX)
  }
  return { curve, heapsK: K, heapsBeta: beta }
}

function concordance(tokens: string[], keyword: string, windowSize = 5): string[] {
  const kw = keyword.toLowerCase()
  const results: string[] = []
  for (let i = 0; i < tokens.length; i++) {
    if (tokens[i] === kw) {
      const left = tokens.slice(Math.max(0, i - windowSize), i).join(' ')
      const right = tokens.slice(i + 1, i + 1 + windowSize).join(' ')
      results.push(`${left.padStart(40)} **${tokens[i]}** ${right}`)
    }
  }
  return results
}

// ─── Formal Logic ───────────────────────────────────────────────────────────

// Operator tokens
type LogicToken =
  | { type: 'VAR'; name: string }
  | { type: 'NOT' }
  | { type: 'AND' }
  | { type: 'OR' }
  | { type: 'IMPLIES' }
  | { type: 'IFF' }
  | { type: 'LPAREN' }
  | { type: 'RPAREN' }

function lexLogic(expr: string): LogicToken[] {
  const tokens: LogicToken[] = []
  let i = 0
  while (i < expr.length) {
    const ch = expr[i]
    if (/\s/.test(ch)) { i++; continue }
    if (ch === '(') { tokens.push({ type: 'LPAREN' }); i++; continue }
    if (ch === ')') { tokens.push({ type: 'RPAREN' }); i++; continue }
    if (ch === '¬' || ch === '!' || ch === '~') { tokens.push({ type: 'NOT' }); i++; continue }
    if (ch === '∧' || ch === '&') { tokens.push({ type: 'AND' }); i++; continue }
    if (ch === '∨' || ch === '|') { tokens.push({ type: 'OR' }); i++; continue }
    if (ch === '→' || (ch === '-' && expr[i + 1] === '>')) {
      tokens.push({ type: 'IMPLIES' })
      i += ch === '→' ? 1 : 2
      continue
    }
    if (ch === '↔' || (ch === '<' && expr[i + 1] === '-' && expr[i + 2] === '>')) {
      tokens.push({ type: 'IFF' })
      i += ch === '↔' ? 1 : 3
      continue
    }
    // Multi-char keywords
    const rest = expr.slice(i).toUpperCase()
    if (rest.startsWith('AND') && (i + 3 >= expr.length || !/[A-Z]/i.test(expr[i + 3]))) {
      tokens.push({ type: 'AND' }); i += 3; continue
    }
    if (rest.startsWith('OR') && (i + 2 >= expr.length || !/[A-Z]/i.test(expr[i + 2]))) {
      tokens.push({ type: 'OR' }); i += 2; continue
    }
    if (rest.startsWith('NOT') && (i + 3 >= expr.length || !/[A-Z]/i.test(expr[i + 3]))) {
      tokens.push({ type: 'NOT' }); i += 3; continue
    }
    if (rest.startsWith('IMPLIES') && (i + 7 >= expr.length || !/[A-Z]/i.test(expr[i + 7]))) {
      tokens.push({ type: 'IMPLIES' }); i += 7; continue
    }
    if (rest.startsWith('IFF') && (i + 3 >= expr.length || !/[A-Z]/i.test(expr[i + 3]))) {
      tokens.push({ type: 'IFF' }); i += 3; continue
    }
    // Variable (single uppercase letter)
    if (/[A-Z]/i.test(ch)) {
      let name = ''
      while (i < expr.length && /[A-Za-z0-9_]/.test(expr[i])) {
        name += expr[i]; i++
      }
      tokens.push({ type: 'VAR', name: name.toUpperCase() })
      continue
    }
    i++ // skip unknown
  }
  return tokens
}

// AST
type LogicNode =
  | { kind: 'var'; name: string }
  | { kind: 'not'; operand: LogicNode }
  | { kind: 'and'; left: LogicNode; right: LogicNode }
  | { kind: 'or'; left: LogicNode; right: LogicNode }
  | { kind: 'implies'; left: LogicNode; right: LogicNode }
  | { kind: 'iff'; left: LogicNode; right: LogicNode }

// Recursive descent parser — precedence (low to high): IFF, IMPLIES, OR, AND, NOT
class LogicParser {
  private pos = 0
  constructor(private tokens: LogicToken[]) {}

  parse(): LogicNode {
    const node = this.parseIff()
    return node
  }

  private peek(): LogicToken | undefined { return this.tokens[this.pos] }
  private advance(): LogicToken { return this.tokens[this.pos++] }

  private parseIff(): LogicNode {
    let left = this.parseImplies()
    while (this.peek()?.type === 'IFF') {
      this.advance()
      const right = this.parseImplies()
      left = { kind: 'iff', left, right }
    }
    return left
  }

  private parseImplies(): LogicNode {
    let left = this.parseOr()
    while (this.peek()?.type === 'IMPLIES') {
      this.advance()
      // Right-associative
      const right = this.parseImplies()
      left = { kind: 'implies', left, right }
    }
    return left
  }

  private parseOr(): LogicNode {
    let left = this.parseAnd()
    while (this.peek()?.type === 'OR') {
      this.advance()
      left = { kind: 'or', left, right: this.parseAnd() }
    }
    return left
  }

  private parseAnd(): LogicNode {
    let left = this.parseNot()
    while (this.peek()?.type === 'AND') {
      this.advance()
      left = { kind: 'and', left, right: this.parseNot() }
    }
    return left
  }

  private parseNot(): LogicNode {
    if (this.peek()?.type === 'NOT') {
      this.advance()
      return { kind: 'not', operand: this.parseNot() }
    }
    return this.parsePrimary()
  }

  private parsePrimary(): LogicNode {
    const tok = this.peek()
    if (tok?.type === 'LPAREN') {
      this.advance()
      const node = this.parseIff()
      if (this.peek()?.type === 'RPAREN') this.advance()
      return node
    }
    if (tok?.type === 'VAR') {
      this.advance()
      return { kind: 'var', name: (tok as { type: 'VAR'; name: string }).name }
    }
    // Fallback: treat as variable 'X'
    this.advance()
    return { kind: 'var', name: 'X' }
  }
}

function extractVars(node: LogicNode): Set<string> {
  const vars = new Set<string>()
  const walk = (n: LogicNode) => {
    if (n.kind === 'var') vars.add(n.name)
    else if (n.kind === 'not') walk(n.operand)
    else if ('left' in n && 'right' in n) { walk(n.left); walk(n.right) }
  }
  walk(node)
  return vars
}

function evalLogic(node: LogicNode, env: Map<string, boolean>): boolean {
  switch (node.kind) {
    case 'var': return env.get(node.name) ?? false
    case 'not': return !evalLogic(node.operand, env)
    case 'and': return evalLogic(node.left, env) && evalLogic(node.right, env)
    case 'or': return evalLogic(node.left, env) || evalLogic(node.right, env)
    case 'implies': return !evalLogic(node.left, env) || evalLogic(node.right, env)
    case 'iff': return evalLogic(node.left, env) === evalLogic(node.right, env)
  }
}

function formatLogicNode(node: LogicNode): string {
  switch (node.kind) {
    case 'var': return node.name
    case 'not': {
      const inner = formatLogicNode(node.operand)
      return node.operand.kind === 'var' ? `¬${inner}` : `¬(${inner})`
    }
    case 'and': return `(${formatLogicNode(node.left)} ∧ ${formatLogicNode(node.right)})`
    case 'or': return `(${formatLogicNode(node.left)} ∨ ${formatLogicNode(node.right)})`
    case 'implies': return `(${formatLogicNode(node.left)} → ${formatLogicNode(node.right)})`
    case 'iff': return `(${formatLogicNode(node.left)} ↔ ${formatLogicNode(node.right)})`
  }
}

function buildTruthTable(node: LogicNode): { vars: string[]; rows: { assignment: boolean[]; result: boolean }[] } {
  const vars = [...extractVars(node)].sort()
  if (vars.length > 6) throw new Error('Too many variables (max 6)')
  const rows: { assignment: boolean[]; result: boolean }[] = []
  const n = 1 << vars.length
  for (let i = 0; i < n; i++) {
    const env = new Map<string, boolean>()
    const assignment: boolean[] = []
    for (let j = 0; j < vars.length; j++) {
      const val = Boolean((i >> (vars.length - 1 - j)) & 1)
      env.set(vars[j], val)
      assignment.push(val)
    }
    rows.push({ assignment, result: evalLogic(node, env) })
  }
  return { vars, rows }
}

function checkInference(expression: string): string {
  // Known inference rules
  const rules = [
    {
      name: 'Modus Ponens',
      pattern: /\(?\s*(\w+)\s*(?:→|->)\s*(\w+)\s*\)?\s*(?:∧|&|,)\s*\1/i,
      explain: (m: RegExpMatchArray) => `From ${m[1]} → ${m[2]} and ${m[1]}, we conclude ${m[2]}.`,
    },
    {
      name: 'Modus Tollens',
      pattern: /\(?\s*(\w+)\s*(?:→|->)\s*(\w+)\s*\)?\s*(?:∧|&|,)\s*(?:¬|!|~)\s*\2/i,
      explain: (m: RegExpMatchArray) => `From ${m[1]} → ${m[2]} and ¬${m[2]}, we conclude ¬${m[1]}.`,
    },
    {
      name: 'Disjunctive Syllogism',
      pattern: /\(?\s*(\w+)\s*(?:∨|\|)\s*(\w+)\s*\)?\s*(?:∧|&|,)\s*(?:¬|!|~)\s*\1/i,
      explain: (m: RegExpMatchArray) => `From ${m[1]} ∨ ${m[2]} and ¬${m[1]}, we conclude ${m[2]}.`,
    },
    {
      name: 'Hypothetical Syllogism',
      pattern: /\(?\s*(\w+)\s*(?:→|->)\s*(\w+)\s*\)?\s*(?:∧|&|,)\s*\(?\s*\2\s*(?:→|->)\s*(\w+)\s*\)?/i,
      explain: (m: RegExpMatchArray) => `From ${m[1]} → ${m[2]} and ${m[2]} → ${m[3]}, we conclude ${m[1]} → ${m[3]}.`,
    },
  ]

  const parts: string[] = ['## Inference Rule Analysis\n']
  let found = false
  for (const rule of rules) {
    const m = expression.match(rule.pattern)
    if (m) {
      parts.push(`**${rule.name}** detected`)
      parts.push(rule.explain(m))
      found = true
    }
  }
  if (!found) {
    parts.push('No standard inference rule pattern detected in this expression.')
    parts.push('Supported rules: Modus Ponens, Modus Tollens, Disjunctive Syllogism, Hypothetical Syllogism.')
  }
  return parts.join('\n')
}

// ─── Argument Map ───────────────────────────────────────────────────────────

interface FallacyDef {
  name: string
  category: string
  description: string
  patterns: RegExp[]
}

const FALLACY_TAXONOMY: FallacyDef[] = [
  { name: 'Ad Hominem', category: 'Relevance', description: 'Attacking the person rather than the argument.',
    patterns: [/\b(stupid|idiot|fool|moron|incompetent|ignorant|biased)\b/i, /\b(you|they|he|she)\b.*\b(wrong because|can't be trusted|would say that)\b/i, /\battack(s|ing)?\s+(the\s+)?(person|character|motives?)\b/i] },
  { name: 'Straw Man', category: 'Relevance', description: 'Misrepresenting someone\'s argument to make it easier to attack.',
    patterns: [/\b(so (you're|you are) saying|what (you|they) really mean)\b/i, /\b(obviously|clearly) (thinks?|believes?|wants?)\b/i] },
  { name: 'False Dilemma', category: 'Presumption', description: 'Presenting only two options when more exist.',
    patterns: [/\beither\s+.+\s+or\b/i, /\b(only (two|2)|no (other|third))\s*(option|choice|alternative)/i, /\byou('re|\s+are)\s+(either|with\s+us\s+or)/i] },
  { name: 'Slippery Slope', category: 'Presumption', description: 'Claiming one event will inevitably lead to extreme consequences without justification.',
    patterns: [/\b(will (inevitably|eventually|necessarily)|next thing you know|before you know it|where will it end|lead(s)? to)\b/i, /\bif we (allow|let|permit).*then.*then\b/i] },
  { name: 'Appeal to Authority', category: 'Relevance', description: 'Using an authority figure\'s opinion as evidence, especially outside their expertise.',
    patterns: [/\b(expert(s)?|scientist(s)?|professor|doctor|study|research)\s+(says?|shows?|proves?|confirms?)\b/i, /\baccording to\b/i, /\b(famous|renowned|well-known)\s+(person|figure|expert)\b/i] },
  { name: 'Circular Reasoning', category: 'Presumption', description: 'Using the conclusion as a premise (begging the question).',
    patterns: [/\bbecause\s+.{5,40}\s+because\b/i, /\btrue because.{5,50}true\b/i, /\b(obviously|clearly|evidently)\s+true\b/i] },
  { name: 'Appeal to Emotion', category: 'Relevance', description: 'Manipulating emotions rather than using logic.',
    patterns: [/\b(think of the children|innocent|suffering|victims?|heartless|cruel|monstrous)\b/i, /\b(imagine|picture|visualize)\s+(if|how|what)\b/i] },
  { name: 'Hasty Generalization', category: 'Weak Induction', description: 'Drawing a broad conclusion from insufficient evidence.',
    patterns: [/\b(all|every|always|never|none)\b.*\b(because|since)\s+(one|a few|i|my|this one)\b/i, /\b(i know someone who|my friend|this one time)\b/i] },
  { name: 'Red Herring', category: 'Relevance', description: 'Introducing an irrelevant topic to divert attention.',
    patterns: [/\bbut what about\b/i, /\b(the real (issue|problem|question)|more importantly|let's (talk|focus) (about|on) something)\b/i] },
  { name: 'Tu Quoque', category: 'Relevance', description: 'Deflecting criticism by pointing out the critic\'s hypocrisy.',
    patterns: [/\b(you (also|too|yourself)|look who's talking|pot calling|hypocrit(e|ical))\b/i, /\bbut you\b/i] },
  { name: 'Appeal to Nature', category: 'Presumption', description: 'Arguing that what is natural is good or correct.',
    patterns: [/\b(natural|unnatural|nature intended|against nature|way nature|god intended)\b/i] },
  { name: 'Bandwagon', category: 'Relevance', description: 'Arguing something is true because many people believe it.',
    patterns: [/\b(everyone|everybody|millions|most people)\s+(knows?|believes?|thinks?|agrees?)\b/i, /\b(popular|mainstream|widely accepted)\b/i] },
  { name: 'False Cause', category: 'Weak Induction', description: 'Assuming correlation implies causation.',
    patterns: [/\b(caused by|because of|leads? to|results? in)\b/i, /\b(after|since|ever since).*\b(therefore|so|thus|hence)\b/i] },
  { name: 'Equivocation', category: 'Ambiguity', description: 'Using a word with different meanings in the same argument.',
    patterns: [/\b(in (one|another) sense|depends on what you mean|technically)\b/i] },
  { name: 'Appeal to Ignorance', category: 'Presumption', description: 'Claiming something is true because it hasn\'t been proven false (or vice versa).',
    patterns: [/\b(no (evidence|proof)|hasn't been (proven|shown|disproven)|can't (prove|disprove))\b/i, /\b(absence of evidence|prove me wrong|nobody has shown)\b/i] },
  { name: 'Composition/Division', category: 'Ambiguity', description: 'Assuming what is true of parts is true of the whole, or vice versa.',
    patterns: [/\b(each|every)\s+.+\s+(so|therefore|thus)\s+(the (whole|group|team|organization))\b/i] },
  { name: 'No True Scotsman', category: 'Presumption', description: 'Redefining criteria to exclude counterexamples.',
    patterns: [/\b(no (true|real|genuine)|a real .+ would(n't| not))\b/i] },
  { name: 'Loaded Question', category: 'Presumption', description: 'Asking a question that contains an unjustified assumption.',
    patterns: [/\b(have you stopped|when did you start|why do you always|do you still)\b/i] },
  { name: 'Genetic Fallacy', category: 'Relevance', description: 'Judging an argument based on its origin rather than its merit.',
    patterns: [/\b(of course .+ would say|coming from|consider the source|that's (just|only) because)\b/i] },
  { name: 'Middle Ground', category: 'Presumption', description: 'Assuming the truth is always between two extremes.',
    patterns: [/\b(compromise|middle ground|truth is (somewhere )?in (the )?between|both sides have a point)\b/i] },
]

function analyzeArgumentStructure(text: string): string {
  const sentences = sentenceSplit(text)
  const conclusionIndicators = /\b(therefore|thus|hence|so|consequently|it follows|in conclusion|we can conclude|this means|this shows|this proves)\b/i
  const premiseIndicators = /\b(because|since|given that|as|for|the reason is|due to|assuming|if|whereas)\b/i
  const assumptionIndicators = /\b(obviously|clearly|everyone knows|it is evident|of course|naturally|surely|undoubtedly|it goes without saying)\b/i

  const premises: string[] = []
  const conclusions: string[] = []
  const assumptions: string[] = []
  const other: string[] = []

  for (const s of sentences) {
    if (conclusionIndicators.test(s)) conclusions.push(s)
    else if (premiseIndicators.test(s)) premises.push(s)
    else if (assumptionIndicators.test(s)) assumptions.push(s)
    else other.push(s)
  }

  // If no conclusion found, treat the last sentence as likely conclusion
  if (conclusions.length === 0 && sentences.length > 0) {
    const last = other.pop() || premises.pop() || sentences[sentences.length - 1]
    conclusions.push(`[Implied] ${last}`)
  }
  // If no premises found, treat remaining as premises
  if (premises.length === 0 && other.length > 0) {
    premises.push(...other.splice(0))
  }

  const parts: string[] = ['## Argument Structure\n']
  if (premises.length > 0) {
    parts.push('### Premises')
    premises.forEach((p, i) => parts.push(`${i + 1}. ${p}`))
    parts.push('')
  }
  if (assumptions.length > 0) {
    parts.push('### Implicit Assumptions')
    assumptions.forEach((a, i) => parts.push(`${i + 1}. ${a}`))
    parts.push('')
  }
  if (conclusions.length > 0) {
    parts.push('### Conclusion(s)')
    conclusions.forEach((c, i) => parts.push(`${i + 1}. ${c}`))
    parts.push('')
  }
  if (other.length > 0) {
    parts.push('### Supporting/Context Statements')
    other.forEach((o, i) => parts.push(`${i + 1}. ${o}`))
    parts.push('')
  }

  // Determine form
  parts.push('### Logical Form')
  if (premises.length > 0 && conclusions.length > 0) {
    parts.push(`P1..P${premises.length} ${assumptions.length > 0 ? `+ A1..A${assumptions.length} (implicit) ` : ''}⊢ C${conclusions.length > 1 ? '1..C' + conclusions.length : ''}`)
  }
  parts.push(`\n**Sentence count**: ${sentences.length}`)
  parts.push(`**Premise count**: ${premises.length}`)
  parts.push(`**Conclusion count**: ${conclusions.length}`)
  parts.push(`**Assumption count**: ${assumptions.length}`)

  return parts.join('\n')
}

function checkFallacies(text: string): string {
  const detected: { fallacy: FallacyDef; match: string }[] = []
  for (const f of FALLACY_TAXONOMY) {
    for (const p of f.patterns) {
      const m = text.match(p)
      if (m) {
        detected.push({ fallacy: f, match: m[0] })
        break // One match per fallacy type is enough
      }
    }
  }

  const parts: string[] = ['## Fallacy Analysis\n']
  if (detected.length === 0) {
    parts.push('No obvious logical fallacies detected via pattern matching.')
    parts.push('\n*Note: This is heuristic pattern matching. Subtle fallacies may not be detected, and some matches may be false positives. Human judgment is essential.*')
  } else {
    parts.push(`**${detected.length} potential fallac${detected.length === 1 ? 'y' : 'ies'} detected:**\n`)
    for (const d of detected) {
      parts.push(`### ${d.fallacy.name} *(${d.fallacy.category})*`)
      parts.push(d.fallacy.description)
      parts.push(`> Matched: "${d.match}"`)
      parts.push('')
    }
    parts.push('*Note: Pattern-based detection. Review matches in context — some may be false positives.*')
  }
  return parts.join('\n')
}

function checkArgumentValidity(text: string): string {
  const structure = analyzeArgumentStructure(text)
  const fallacies = checkFallacies(text)

  const sentences = sentenceSplit(text)
  const hasConclusion = sentences.some(s => /\b(therefore|thus|hence|so|consequently|it follows|in conclusion)\b/i.test(s))
  const hasPremises = sentences.some(s => /\b(because|since|given that|as|for|the reason is)\b/i.test(s))
  const fallacyCount = (fallacies.match(/###/g) || []).length

  const parts: string[] = ['## Validity Assessment\n']
  parts.push(structure)
  parts.push('\n---\n')
  parts.push(fallacies)
  parts.push('\n---\n')
  parts.push('### Overall Assessment')

  if (!hasPremises) parts.push('- **Warning**: No explicit premise indicators found.')
  if (!hasConclusion) parts.push('- **Warning**: No explicit conclusion indicators found.')
  if (fallacyCount > 0) parts.push(`- **Warning**: ${fallacyCount} potential fallac${fallacyCount === 1 ? 'y' : 'ies'} detected.`)

  if (hasPremises && hasConclusion && fallacyCount === 0) {
    parts.push('- Argument has identifiable premises and conclusion with no detected fallacies.')
    parts.push('- **Provisional assessment**: Structurally sound (further semantic analysis recommended).')
  } else {
    parts.push('- **Provisional assessment**: Argument has structural weaknesses. See above for details.')
  }

  return parts.join('\n')
}

// ─── Ethics Framework ───────────────────────────────────────────────────────

interface EthicalAnalysis {
  framework: string
  principle: string
  analysis: string
  likelyConclusion: string
  keyQuestion: string
}

function applyUtilitarian(dilemma: string): EthicalAnalysis {
  return {
    framework: 'Utilitarianism',
    principle: 'Greatest good for the greatest number (Bentham, Mill). Maximize aggregate well-being; minimize aggregate suffering.',
    analysis: `**Utilitarian calculus applied to**: "${dilemma.slice(0, 100)}..."\n\n` +
      '1. **Identify stakeholders**: Who is affected? List all parties.\n' +
      '2. **Predict outcomes**: For each possible action, estimate positive and negative consequences.\n' +
      '3. **Quantify well-being**: Consider intensity, duration, certainty, proximity, fecundity, and purity of pleasure/pain (Bentham\'s felicific calculus).\n' +
      '4. **Aggregate**: Sum up well-being across all stakeholders for each option.\n' +
      '5. **Select**: Choose the action that produces the greatest net well-being.',
    likelyConclusion: 'The action that maximizes total well-being across all affected parties is ethically correct, even if it requires sacrifice from some individuals.',
    keyQuestion: 'Which action produces the greatest net benefit for all affected parties?',
  }
}

function applyDeontological(dilemma: string): EthicalAnalysis {
  return {
    framework: 'Deontological Ethics (Kant)',
    principle: 'Act only according to maxims you could will to be universal laws. Treat humanity never merely as means but always as ends.',
    analysis: `**Kantian analysis applied to**: "${dilemma.slice(0, 100)}..."\n\n` +
      '1. **Formulate the maxim**: What rule are you following? ("I will X in situation Y")\n' +
      '2. **Universalizability test**: Could everyone follow this maxim without contradiction?\n' +
      '3. **Humanity formula**: Does this action treat all persons as ends in themselves, not merely as means?\n' +
      '4. **Kingdom of Ends**: Would this be acceptable legislation in an ideal moral community?\n' +
      '5. **Perfect vs. imperfect duties**: Is this a duty of strict obligation or one allowing latitude?',
    likelyConclusion: 'Actions that violate the categorical imperative are wrong regardless of consequences. Duties are absolute and cannot be overridden by outcomes.',
    keyQuestion: 'Can the maxim of this action be universalized without contradiction? Does it respect the dignity of all persons?',
  }
}

function applyVirtueEthics(dilemma: string): EthicalAnalysis {
  return {
    framework: 'Virtue Ethics (Aristotle)',
    principle: 'Cultivate virtuous character traits (courage, temperance, justice, prudence). Act as a person of practical wisdom (phronesis) would act.',
    analysis: `**Virtue ethics analysis applied to**: "${dilemma.slice(0, 100)}..."\n\n` +
      '1. **Character question**: What would a person of good character do?\n' +
      '2. **Relevant virtues**: Which virtues are at stake? (justice, courage, temperance, honesty, compassion, generosity, prudence)\n' +
      '3. **The mean**: Find the golden mean between excess and deficiency for each virtue.\n' +
      '4. **Role models**: What would an exemplar of virtue do in this situation?\n' +
      '5. **Eudaimonia**: Does this action contribute to human flourishing?',
    likelyConclusion: 'The right action is what a practically wise person would do — one who has cultivated virtues through habit and reflects on the good life.',
    keyQuestion: 'What would a person of exemplary character do? Which virtues does each option express?',
  }
}

function applyCareEthics(dilemma: string): EthicalAnalysis {
  return {
    framework: 'Care Ethics (Gilligan, Noddings)',
    principle: 'Prioritize relationships and responsiveness to the needs of particular others. Morality arises from caring connections, not abstract rules.',
    analysis: `**Care ethics analysis applied to**: "${dilemma.slice(0, 100)}..."\n\n` +
      '1. **Relationships**: Who are the particular people involved? What are the care relationships?\n' +
      '2. **Needs**: What are the concrete needs of the vulnerable or dependent parties?\n' +
      '3. **Responsiveness**: How can we best respond to these needs while maintaining relationships?\n' +
      '4. **Context**: What does the particular situation demand? (Care ethics rejects one-size-fits-all rules.)\n' +
      '5. **Power dynamics**: Who holds power? Are the voices of the less powerful being heard?',
    likelyConclusion: 'The ethical response prioritizes maintaining caring relationships, attending to the concrete needs of particular others, especially the vulnerable.',
    keyQuestion: 'How can we best maintain caring relationships and attend to the needs of those who depend on us?',
  }
}

function applyRightsBased(dilemma: string): EthicalAnalysis {
  return {
    framework: 'Rights-Based Ethics (Locke, Rawls)',
    principle: 'Every person has fundamental rights (life, liberty, property, equality) that cannot be overridden by aggregate utility or state interest.',
    analysis: `**Rights-based analysis applied to**: "${dilemma.slice(0, 100)}..."\n\n` +
      '1. **Rights identification**: What rights are at stake? (life, liberty, privacy, property, equality, due process)\n' +
      '2. **Rights holders**: Whose rights are affected?\n' +
      '3. **Conflicts**: Do rights of different parties conflict? If so, which takes priority?\n' +
      '4. **Rawlsian veil**: Would rational agents behind a veil of ignorance agree to this arrangement?\n' +
      '5. **Negative vs. positive rights**: Are we talking about freedom from interference or entitlement to something?',
    likelyConclusion: 'Actions that violate fundamental rights are wrong even if they produce good outcomes. Rights serve as side constraints on permissible action.',
    keyQuestion: 'Does this action respect the fundamental rights of all parties? Would it be accepted behind a veil of ignorance?',
  }
}

function applySocialContract(dilemma: string): EthicalAnalysis {
  return {
    framework: 'Social Contract Theory (Hobbes, Rousseau, Rawls)',
    principle: 'Moral rules derive from agreements rational agents would make under fair conditions. Justice is what free people would consent to.',
    analysis: `**Social contract analysis applied to**: "${dilemma.slice(0, 100)}..."\n\n` +
      '1. **State of nature**: What would happen without any agreement or rule in this situation?\n' +
      '2. **Rational agreement**: What rule would rational, self-interested parties agree to?\n' +
      '3. **Fairness conditions**: Are all parties negotiating from equal standing? (If not, apply Rawls\' veil of ignorance.)\n' +
      '4. **Enforcement**: Can the agreement be enforced? What happens to defectors?\n' +
      '5. **Consent**: Have affected parties actually (or hypothetically) consented to this arrangement?',
    likelyConclusion: 'The morally correct action is one that rational agents would agree to under fair bargaining conditions, where no party has unfair advantage.',
    keyQuestion: 'Would rational people freely agree to this arrangement under fair conditions?',
  }
}

// ─── Historical Timeline ────────────────────────────────────────────────────

interface TimelineEvent {
  date: string
  event: string
  category?: string
  end_date?: string
}

function parseDate(s: string): Date | null {
  // Support various formats: "1776", "1776-07-04", "476 CE", "-500" (500 BCE), "March 15, 44 BCE"
  const bceMatch = s.match(/(\d+)\s*(BCE|BC)/i)
  if (bceMatch) return new Date(-parseInt(bceMatch[1], 10), 0, 1)

  const ceMatch = s.match(/(\d+)\s*(CE|AD)/i)
  if (ceMatch) return new Date(parseInt(ceMatch[1], 10), 0, 1)

  if (/^-?\d{1,4}$/.test(s.trim())) {
    const year = parseInt(s.trim(), 10)
    return new Date(year, 0, 1)
  }

  const d = new Date(s)
  return isNaN(d.getTime()) ? null : d
}

function formatYear(d: Date): string {
  const y = d.getFullYear()
  if (y < 0) return `${Math.abs(y)} BCE`
  return `${y} CE`
}

function yearsBetween(a: Date, b: Date): number {
  return Math.abs(a.getFullYear() - b.getFullYear())
}

function visualizeTimeline(events: TimelineEvent[]): string {
  const parsed = events
    .map(e => ({ ...e, parsedDate: parseDate(e.date), parsedEnd: e.end_date ? parseDate(e.end_date) : null }))
    .filter(e => e.parsedDate !== null)
    .sort((a, b) => a.parsedDate!.getTime() - b.parsedDate!.getTime())

  if (parsed.length === 0) return 'No valid dates found.'

  const lines: string[] = ['## Timeline\n', '```']
  const maxEventLen = Math.min(60, Math.max(...parsed.map(e => e.event.length)))
  let prevDate: Date | null = null

  for (const e of parsed) {
    const dateStr = e.end_date && e.parsedEnd
      ? `${formatYear(e.parsedDate!)} – ${formatYear(e.parsedEnd)}`
      : formatYear(e.parsedDate!)

    // Show gap indicator
    if (prevDate) {
      const gap = yearsBetween(prevDate, e.parsedDate!)
      if (gap > 10) {
        lines.push(`    │  ··· ${gap} years ···`)
      }
    }

    const cat = e.category ? ` [${e.category}]` : ''
    const period = e.parsedEnd ? ` (${yearsBetween(e.parsedDate!, e.parsedEnd)} years)` : ''
    lines.push(`    ├── ${dateStr.padEnd(20)} ${e.event.slice(0, 60)}${cat}${period}`)
    prevDate = e.parsedEnd || e.parsedDate!
  }
  lines.push('    │')
  lines.push('```')
  return lines.join('\n')
}

function analyzeTimeline(events: TimelineEvent[]): string {
  const parsed = events
    .map(e => ({ ...e, parsedDate: parseDate(e.date), parsedEnd: e.end_date ? parseDate(e.end_date) : null }))
    .filter(e => e.parsedDate !== null)
    .sort((a, b) => a.parsedDate!.getTime() - b.parsedDate!.getTime())

  if (parsed.length < 2) return 'Need at least 2 events for analysis.'

  const parts: string[] = ['## Timeline Analysis\n']

  // Total span
  const first = parsed[0]
  const last = parsed[parsed.length - 1]
  parts.push(`**Total span**: ${formatYear(first.parsedDate!)} to ${formatYear(last.parsedDate!)} (${yearsBetween(first.parsedDate!, last.parsedDate!)} years)\n`)

  // Event density
  const totalYears = yearsBetween(first.parsedDate!, last.parsedDate!)
  if (totalYears > 0) {
    parts.push(`**Event density**: ${(parsed.length / totalYears * 100).toFixed(2)} events per century\n`)
  }

  // Categories
  const cats = new Map<string, number>()
  for (const e of parsed) {
    const cat = e.category || 'uncategorized'
    cats.set(cat, (cats.get(cat) || 0) + 1)
  }
  if (cats.size > 1) {
    parts.push('**Categories**:')
    for (const [cat, count] of [...cats.entries()].sort((a, b) => b[1] - a[1])) {
      parts.push(`- ${cat}: ${count} events`)
    }
    parts.push('')
  }

  // Gaps between consecutive events
  const gaps: { from: string; to: string; years: number }[] = []
  for (let i = 1; i < parsed.length; i++) {
    const gap = yearsBetween(parsed[i - 1].parsedDate!, parsed[i].parsedDate!)
    gaps.push({ from: parsed[i - 1].event.slice(0, 40), to: parsed[i].event.slice(0, 40), years: gap })
  }
  gaps.sort((a, b) => b.years - a.years)

  if (gaps.length > 0) {
    parts.push('**Largest gaps**:')
    for (const g of gaps.slice(0, 3)) {
      parts.push(`- ${g.years} years between "${g.from}" and "${g.to}"`)
    }
    parts.push('')
  }

  // Overlapping periods
  const periods = parsed.filter(e => e.parsedEnd)
  if (periods.length >= 2) {
    parts.push('**Overlapping periods**:')
    for (let i = 0; i < periods.length; i++) {
      for (let j = i + 1; j < periods.length; j++) {
        const aStart = periods[i].parsedDate!.getTime()
        const aEnd = periods[i].parsedEnd!.getTime()
        const bStart = periods[j].parsedDate!.getTime()
        const bEnd = periods[j].parsedEnd!.getTime()
        if (aStart < bEnd && bStart < aEnd) {
          const overlapStart = Math.max(aStart, bStart)
          const overlapEnd = Math.min(aEnd, bEnd)
          const overlapYears = Math.round((overlapEnd - overlapStart) / (365.25 * 24 * 60 * 60 * 1000))
          parts.push(`- "${periods[i].event.slice(0, 30)}" & "${periods[j].event.slice(0, 30)}" overlap ~${overlapYears} years`)
        }
      }
    }
    parts.push('')
  }

  return parts.join('\n')
}

function detectPeriods(events: TimelineEvent[]): string {
  const parsed = events
    .map(e => ({ ...e, parsedDate: parseDate(e.date) }))
    .filter(e => e.parsedDate !== null)
    .sort((a, b) => a.parsedDate!.getTime() - b.parsedDate!.getTime())

  if (parsed.length < 3) return 'Need at least 3 events for periodization.'

  const parts: string[] = ['## Periodization\n']

  // Cluster events by temporal proximity using gap analysis
  const gaps: number[] = []
  for (let i = 1; i < parsed.length; i++) {
    gaps.push(yearsBetween(parsed[i - 1].parsedDate!, parsed[i].parsedDate!))
  }
  const avgGap = gaps.reduce((a, b) => a + b, 0) / gaps.length
  const threshold = avgGap * 1.5

  // Split into periods at large gaps
  const periods: typeof parsed[] = [[parsed[0]]]
  for (let i = 1; i < parsed.length; i++) {
    if (gaps[i - 1] > threshold) {
      periods.push([parsed[i]])
    } else {
      periods[periods.length - 1].push(parsed[i])
    }
  }

  for (let i = 0; i < periods.length; i++) {
    const p = periods[i]
    const start = formatYear(p[0].parsedDate!)
    const end = formatYear(p[p.length - 1].parsedDate!)
    const span = yearsBetween(p[0].parsedDate!, p[p.length - 1].parsedDate!)
    parts.push(`### Period ${i + 1}: ${start} – ${end} (${span} years)`)
    parts.push(`**Events**: ${p.length}`)
    for (const e of p) {
      parts.push(`- ${formatYear(e.parsedDate!)}: ${e.event}`)
    }
    parts.push('')
  }

  parts.push(`**Gap threshold**: ${Math.round(threshold)} years (1.5x average gap of ${Math.round(avgGap)} years)`)

  return parts.join('\n')
}

// ─── Language Typology ──────────────────────────────────────────────────────

interface LanguageData {
  name: string
  family: string
  subfamily?: string
  wordOrder: string
  morphologicalType: string
  writingSystem: string
  phonemeCount: number
  tonal: boolean
  caseSystem: string
  speakers: string
}

const LANGUAGES: LanguageData[] = [
  { name: 'Mandarin Chinese', family: 'Sino-Tibetan', subfamily: 'Sinitic', wordOrder: 'SVO', morphologicalType: 'isolating', writingSystem: 'logographic (Hanzi)', phonemeCount: 35, tonal: true, caseSystem: 'none', speakers: '~920M native' },
  { name: 'Spanish', family: 'Indo-European', subfamily: 'Romance', wordOrder: 'SVO', morphologicalType: 'fusional', writingSystem: 'Latin', phonemeCount: 39, tonal: false, caseSystem: 'none (pronominal)', speakers: '~475M native' },
  { name: 'English', family: 'Indo-European', subfamily: 'Germanic', wordOrder: 'SVO', morphologicalType: 'fusional (weakly)', writingSystem: 'Latin', phonemeCount: 44, tonal: false, caseSystem: 'pronominal only', speakers: '~380M native' },
  { name: 'Hindi', family: 'Indo-European', subfamily: 'Indo-Aryan', wordOrder: 'SOV', morphologicalType: 'fusional', writingSystem: 'Devanagari', phonemeCount: 52, tonal: false, caseSystem: '3 cases', speakers: '~345M native' },
  { name: 'Arabic (Standard)', family: 'Afro-Asiatic', subfamily: 'Semitic', wordOrder: 'VSO/SVO', morphologicalType: 'fusional (root-pattern)', writingSystem: 'Arabic abjad', phonemeCount: 34, tonal: false, caseSystem: '3 cases', speakers: '~310M native' },
  { name: 'Bengali', family: 'Indo-European', subfamily: 'Indo-Aryan', wordOrder: 'SOV', morphologicalType: 'fusional', writingSystem: 'Bengali script', phonemeCount: 49, tonal: false, caseSystem: '4 cases', speakers: '~230M native' },
  { name: 'Portuguese', family: 'Indo-European', subfamily: 'Romance', wordOrder: 'SVO', morphologicalType: 'fusional', writingSystem: 'Latin', phonemeCount: 37, tonal: false, caseSystem: 'none (pronominal)', speakers: '~220M native' },
  { name: 'Russian', family: 'Indo-European', subfamily: 'Slavic', wordOrder: 'SVO (flexible)', morphologicalType: 'fusional', writingSystem: 'Cyrillic', phonemeCount: 43, tonal: false, caseSystem: '6 cases', speakers: '~150M native' },
  { name: 'Japanese', family: 'Japonic', wordOrder: 'SOV', morphologicalType: 'agglutinative', writingSystem: 'Kanji + Kana (mixed)', phonemeCount: 24, tonal: false, caseSystem: 'particles (9+)', speakers: '~125M native' },
  { name: 'Punjabi', family: 'Indo-European', subfamily: 'Indo-Aryan', wordOrder: 'SOV', morphologicalType: 'fusional', writingSystem: 'Gurmukhi/Shahmukhi', phonemeCount: 48, tonal: true, caseSystem: '5 cases', speakers: '~120M native' },
  { name: 'German', family: 'Indo-European', subfamily: 'Germanic', wordOrder: 'SVO/SOV (V2)', morphologicalType: 'fusional', writingSystem: 'Latin', phonemeCount: 44, tonal: false, caseSystem: '4 cases', speakers: '~95M native' },
  { name: 'Javanese', family: 'Austronesian', subfamily: 'Malayo-Polynesian', wordOrder: 'SVO', morphologicalType: 'agglutinative', writingSystem: 'Latin/Javanese', phonemeCount: 33, tonal: false, caseSystem: 'none', speakers: '~82M native' },
  { name: 'Korean', family: 'Koreanic', wordOrder: 'SOV', morphologicalType: 'agglutinative', writingSystem: 'Hangul (featural)', phonemeCount: 40, tonal: false, caseSystem: 'particles (7+)', speakers: '~77M native' },
  { name: 'French', family: 'Indo-European', subfamily: 'Romance', wordOrder: 'SVO', morphologicalType: 'fusional', writingSystem: 'Latin', phonemeCount: 37, tonal: false, caseSystem: 'none (pronominal)', speakers: '~77M native' },
  { name: 'Turkish', family: 'Turkic', subfamily: 'Oghuz', wordOrder: 'SOV', morphologicalType: 'agglutinative', writingSystem: 'Latin', phonemeCount: 32, tonal: false, caseSystem: '6 cases', speakers: '~75M native' },
  { name: 'Vietnamese', family: 'Austroasiatic', subfamily: 'Vietic', wordOrder: 'SVO', morphologicalType: 'isolating', writingSystem: 'Latin (Quoc Ngu)', phonemeCount: 33, tonal: true, caseSystem: 'none', speakers: '~75M native' },
  { name: 'Tamil', family: 'Dravidian', subfamily: 'South Dravidian', wordOrder: 'SOV', morphologicalType: 'agglutinative', writingSystem: 'Tamil script', phonemeCount: 39, tonal: false, caseSystem: '8 cases', speakers: '~70M native' },
  { name: 'Italian', family: 'Indo-European', subfamily: 'Romance', wordOrder: 'SVO', morphologicalType: 'fusional', writingSystem: 'Latin', phonemeCount: 30, tonal: false, caseSystem: 'none (pronominal)', speakers: '~65M native' },
  { name: 'Urdu', family: 'Indo-European', subfamily: 'Indo-Aryan', wordOrder: 'SOV', morphologicalType: 'fusional', writingSystem: 'Perso-Arabic (Nastaliq)', phonemeCount: 53, tonal: false, caseSystem: '3 cases', speakers: '~65M native' },
  { name: 'Swahili', family: 'Niger-Congo', subfamily: 'Bantu', wordOrder: 'SVO', morphologicalType: 'agglutinative', writingSystem: 'Latin', phonemeCount: 33, tonal: false, caseSystem: 'none', speakers: '~16M native, ~100M L2' },
  { name: 'Thai', family: 'Kra-Dai', subfamily: 'Tai', wordOrder: 'SVO', morphologicalType: 'isolating', writingSystem: 'Thai abugida', phonemeCount: 40, tonal: true, caseSystem: 'none', speakers: '~60M native' },
  { name: 'Polish', family: 'Indo-European', subfamily: 'Slavic', wordOrder: 'SVO (flexible)', morphologicalType: 'fusional', writingSystem: 'Latin', phonemeCount: 43, tonal: false, caseSystem: '7 cases', speakers: '~40M native' },
  { name: 'Ukrainian', family: 'Indo-European', subfamily: 'Slavic', wordOrder: 'SVO (flexible)', morphologicalType: 'fusional', writingSystem: 'Cyrillic', phonemeCount: 42, tonal: false, caseSystem: '7 cases', speakers: '~35M native' },
  { name: 'Malay/Indonesian', family: 'Austronesian', subfamily: 'Malayo-Polynesian', wordOrder: 'SVO', morphologicalType: 'agglutinative', writingSystem: 'Latin', phonemeCount: 31, tonal: false, caseSystem: 'none', speakers: '~43M native, ~200M L2' },
  { name: 'Persian (Farsi)', family: 'Indo-European', subfamily: 'Iranian', wordOrder: 'SOV', morphologicalType: 'fusional', writingSystem: 'Perso-Arabic', phonemeCount: 29, tonal: false, caseSystem: 'none', speakers: '~55M native' },
  { name: 'Dutch', family: 'Indo-European', subfamily: 'Germanic', wordOrder: 'SVO/SOV (V2)', morphologicalType: 'fusional', writingSystem: 'Latin', phonemeCount: 40, tonal: false, caseSystem: 'none (archaic)', speakers: '~24M native' },
  { name: 'Greek', family: 'Indo-European', subfamily: 'Hellenic', wordOrder: 'SVO (flexible)', morphologicalType: 'fusional', writingSystem: 'Greek', phonemeCount: 24, tonal: false, caseSystem: '4 cases', speakers: '~13M native' },
  { name: 'Hungarian', family: 'Uralic', subfamily: 'Ugric', wordOrder: 'SVO (flexible)', morphologicalType: 'agglutinative', writingSystem: 'Latin', phonemeCount: 40, tonal: false, caseSystem: '18 cases', speakers: '~13M native' },
  { name: 'Finnish', family: 'Uralic', subfamily: 'Finnic', wordOrder: 'SVO', morphologicalType: 'agglutinative', writingSystem: 'Latin', phonemeCount: 28, tonal: false, caseSystem: '15 cases', speakers: '~5.4M native' },
  { name: 'Hebrew', family: 'Afro-Asiatic', subfamily: 'Semitic', wordOrder: 'SVO', morphologicalType: 'fusional (root-pattern)', writingSystem: 'Hebrew abjad', phonemeCount: 30, tonal: false, caseSystem: 'none', speakers: '~5M native, ~9M total' },
  { name: 'Georgian', family: 'Kartvelian', wordOrder: 'SOV (flexible)', morphologicalType: 'agglutinative', writingSystem: 'Georgian (Mkhedruli)', phonemeCount: 34, tonal: false, caseSystem: '7 cases', speakers: '~3.7M native' },
  { name: 'Basque', family: 'Language isolate', wordOrder: 'SOV', morphologicalType: 'agglutinative', writingSystem: 'Latin', phonemeCount: 30, tonal: false, caseSystem: '12 cases', speakers: '~750K native' },
  { name: 'Icelandic', family: 'Indo-European', subfamily: 'Germanic', wordOrder: 'SVO (V2)', morphologicalType: 'fusional', writingSystem: 'Latin', phonemeCount: 36, tonal: false, caseSystem: '4 cases', speakers: '~330K native' },
  { name: 'Navajo', family: 'Na-Dene', subfamily: 'Athabaskan', wordOrder: 'SOV', morphologicalType: 'polysynthetic', writingSystem: 'Latin', phonemeCount: 47, tonal: true, caseSystem: 'none (verb-incorporated)', speakers: '~170K native' },
  { name: 'Quechua', family: 'Quechuan', wordOrder: 'SOV', morphologicalType: 'agglutinative', writingSystem: 'Latin', phonemeCount: 31, tonal: false, caseSystem: '8+ cases', speakers: '~8M native' },
  { name: 'Yoruba', family: 'Niger-Congo', subfamily: 'Volta-Niger', wordOrder: 'SVO', morphologicalType: 'isolating', writingSystem: 'Latin', phonemeCount: 25, tonal: true, caseSystem: 'none', speakers: '~45M native' },
  { name: 'Amharic', family: 'Afro-Asiatic', subfamily: 'Semitic', wordOrder: 'SOV', morphologicalType: 'fusional (root-pattern)', writingSystem: 'Ge\'ez (abugida)', phonemeCount: 31, tonal: false, caseSystem: '2 cases', speakers: '~32M native' },
  { name: 'Zulu', family: 'Niger-Congo', subfamily: 'Bantu', wordOrder: 'SVO', morphologicalType: 'agglutinative', writingSystem: 'Latin', phonemeCount: 47, tonal: true, caseSystem: 'none', speakers: '~12M native' },
  { name: 'Tibetan', family: 'Sino-Tibetan', subfamily: 'Tibeto-Burman', wordOrder: 'SOV', morphologicalType: 'agglutinative', writingSystem: 'Tibetan abugida', phonemeCount: 37, tonal: true, caseSystem: 'particles (5+)', speakers: '~6M native' },
  { name: 'Tagalog', family: 'Austronesian', subfamily: 'Malayo-Polynesian', wordOrder: 'VSO/VOS', morphologicalType: 'agglutinative', writingSystem: 'Latin', phonemeCount: 28, tonal: false, caseSystem: '3 cases (focus)', speakers: '~28M native' },
  { name: 'Mongolian', family: 'Mongolic', wordOrder: 'SOV', morphologicalType: 'agglutinative', writingSystem: 'Cyrillic/Mongolian', phonemeCount: 35, tonal: false, caseSystem: '8 cases', speakers: '~5.2M native' },
  { name: 'Estonian', family: 'Uralic', subfamily: 'Finnic', wordOrder: 'SVO', morphologicalType: 'agglutinative', writingSystem: 'Latin', phonemeCount: 36, tonal: false, caseSystem: '14 cases', speakers: '~1.1M native' },
  { name: 'Burmese', family: 'Sino-Tibetan', subfamily: 'Tibeto-Burman', wordOrder: 'SOV', morphologicalType: 'agglutinative', writingSystem: 'Burmese script', phonemeCount: 39, tonal: true, caseSystem: 'particles', speakers: '~33M native' },
  { name: 'Hausa', family: 'Afro-Asiatic', subfamily: 'Chadic', wordOrder: 'SVO', morphologicalType: 'fusional', writingSystem: 'Latin/Ajami', phonemeCount: 42, tonal: true, caseSystem: 'none', speakers: '~45M native' },
  { name: 'Khmer', family: 'Austroasiatic', subfamily: 'Khmeric', wordOrder: 'SVO', morphologicalType: 'isolating', writingSystem: 'Khmer abugida', phonemeCount: 33, tonal: false, caseSystem: 'none', speakers: '~16M native' },
  { name: 'Romanian', family: 'Indo-European', subfamily: 'Romance', wordOrder: 'SVO', morphologicalType: 'fusional', writingSystem: 'Latin', phonemeCount: 31, tonal: false, caseSystem: '3 cases (with articles)', speakers: '~24M native' },
  { name: 'Czech', family: 'Indo-European', subfamily: 'Slavic', wordOrder: 'SVO (flexible)', morphologicalType: 'fusional', writingSystem: 'Latin', phonemeCount: 39, tonal: false, caseSystem: '7 cases', speakers: '~10.7M native' },
  { name: 'Somali', family: 'Afro-Asiatic', subfamily: 'Cushitic', wordOrder: 'SOV', morphologicalType: 'agglutinative', writingSystem: 'Latin', phonemeCount: 37, tonal: true, caseSystem: '4 cases', speakers: '~16M native' },
  { name: 'Ainu', family: 'Language isolate', wordOrder: 'SOV', morphologicalType: 'polysynthetic', writingSystem: 'Katakana/Latin', phonemeCount: 16, tonal: false, caseSystem: 'particles', speakers: '~10 native (critically endangered)' },
  { name: 'Inuktitut', family: 'Eskimo-Aleut', subfamily: 'Inuit', wordOrder: 'SOV', morphologicalType: 'polysynthetic', writingSystem: 'Canadian syllabics/Latin', phonemeCount: 18, tonal: false, caseSystem: '8 cases', speakers: '~35K native' },
]

// ─── Phonetics IPA ──────────────────────────────────────────────────────────

interface IPASymbol {
  symbol: string
  type: 'consonant' | 'vowel' | 'diacritic' | 'suprasegmental'
  description: string
  // Consonants
  place?: string
  manner?: string
  voicing?: string
  // Vowels
  height?: string
  backness?: string
  rounded?: boolean
}

const IPA_CHART: IPASymbol[] = [
  // Plosives
  { symbol: 'p', type: 'consonant', description: 'voiceless bilabial plosive', place: 'bilabial', manner: 'plosive', voicing: 'voiceless' },
  { symbol: 'b', type: 'consonant', description: 'voiced bilabial plosive', place: 'bilabial', manner: 'plosive', voicing: 'voiced' },
  { symbol: 't', type: 'consonant', description: 'voiceless alveolar plosive', place: 'alveolar', manner: 'plosive', voicing: 'voiceless' },
  { symbol: 'd', type: 'consonant', description: 'voiced alveolar plosive', place: 'alveolar', manner: 'plosive', voicing: 'voiced' },
  { symbol: 'ʈ', type: 'consonant', description: 'voiceless retroflex plosive', place: 'retroflex', manner: 'plosive', voicing: 'voiceless' },
  { symbol: 'ɖ', type: 'consonant', description: 'voiced retroflex plosive', place: 'retroflex', manner: 'plosive', voicing: 'voiced' },
  { symbol: 'c', type: 'consonant', description: 'voiceless palatal plosive', place: 'palatal', manner: 'plosive', voicing: 'voiceless' },
  { symbol: 'ɟ', type: 'consonant', description: 'voiced palatal plosive', place: 'palatal', manner: 'plosive', voicing: 'voiced' },
  { symbol: 'k', type: 'consonant', description: 'voiceless velar plosive', place: 'velar', manner: 'plosive', voicing: 'voiceless' },
  { symbol: 'ɡ', type: 'consonant', description: 'voiced velar plosive', place: 'velar', manner: 'plosive', voicing: 'voiced' },
  { symbol: 'q', type: 'consonant', description: 'voiceless uvular plosive', place: 'uvular', manner: 'plosive', voicing: 'voiceless' },
  { symbol: 'ɢ', type: 'consonant', description: 'voiced uvular plosive', place: 'uvular', manner: 'plosive', voicing: 'voiced' },
  { symbol: 'ʔ', type: 'consonant', description: 'glottal stop', place: 'glottal', manner: 'plosive', voicing: 'voiceless' },
  // Nasals
  { symbol: 'm', type: 'consonant', description: 'voiced bilabial nasal', place: 'bilabial', manner: 'nasal', voicing: 'voiced' },
  { symbol: 'ɱ', type: 'consonant', description: 'voiced labiodental nasal', place: 'labiodental', manner: 'nasal', voicing: 'voiced' },
  { symbol: 'n', type: 'consonant', description: 'voiced alveolar nasal', place: 'alveolar', manner: 'nasal', voicing: 'voiced' },
  { symbol: 'ɳ', type: 'consonant', description: 'voiced retroflex nasal', place: 'retroflex', manner: 'nasal', voicing: 'voiced' },
  { symbol: 'ɲ', type: 'consonant', description: 'voiced palatal nasal', place: 'palatal', manner: 'nasal', voicing: 'voiced' },
  { symbol: 'ŋ', type: 'consonant', description: 'voiced velar nasal', place: 'velar', manner: 'nasal', voicing: 'voiced' },
  { symbol: 'ɴ', type: 'consonant', description: 'voiced uvular nasal', place: 'uvular', manner: 'nasal', voicing: 'voiced' },
  // Trills
  { symbol: 'ʙ', type: 'consonant', description: 'voiced bilabial trill', place: 'bilabial', manner: 'trill', voicing: 'voiced' },
  { symbol: 'r', type: 'consonant', description: 'voiced alveolar trill', place: 'alveolar', manner: 'trill', voicing: 'voiced' },
  { symbol: 'ʀ', type: 'consonant', description: 'voiced uvular trill', place: 'uvular', manner: 'trill', voicing: 'voiced' },
  // Taps/Flaps
  { symbol: 'ⱱ', type: 'consonant', description: 'voiced labiodental flap', place: 'labiodental', manner: 'flap', voicing: 'voiced' },
  { symbol: 'ɾ', type: 'consonant', description: 'voiced alveolar tap', place: 'alveolar', manner: 'tap', voicing: 'voiced' },
  { symbol: 'ɽ', type: 'consonant', description: 'voiced retroflex flap', place: 'retroflex', manner: 'flap', voicing: 'voiced' },
  // Fricatives
  { symbol: 'ɸ', type: 'consonant', description: 'voiceless bilabial fricative', place: 'bilabial', manner: 'fricative', voicing: 'voiceless' },
  { symbol: 'β', type: 'consonant', description: 'voiced bilabial fricative', place: 'bilabial', manner: 'fricative', voicing: 'voiced' },
  { symbol: 'f', type: 'consonant', description: 'voiceless labiodental fricative', place: 'labiodental', manner: 'fricative', voicing: 'voiceless' },
  { symbol: 'v', type: 'consonant', description: 'voiced labiodental fricative', place: 'labiodental', manner: 'fricative', voicing: 'voiced' },
  { symbol: 'θ', type: 'consonant', description: 'voiceless dental fricative', place: 'dental', manner: 'fricative', voicing: 'voiceless' },
  { symbol: 'ð', type: 'consonant', description: 'voiced dental fricative', place: 'dental', manner: 'fricative', voicing: 'voiced' },
  { symbol: 's', type: 'consonant', description: 'voiceless alveolar fricative', place: 'alveolar', manner: 'fricative', voicing: 'voiceless' },
  { symbol: 'z', type: 'consonant', description: 'voiced alveolar fricative', place: 'alveolar', manner: 'fricative', voicing: 'voiced' },
  { symbol: 'ʃ', type: 'consonant', description: 'voiceless postalveolar fricative', place: 'postalveolar', manner: 'fricative', voicing: 'voiceless' },
  { symbol: 'ʒ', type: 'consonant', description: 'voiced postalveolar fricative', place: 'postalveolar', manner: 'fricative', voicing: 'voiced' },
  { symbol: 'ʂ', type: 'consonant', description: 'voiceless retroflex fricative', place: 'retroflex', manner: 'fricative', voicing: 'voiceless' },
  { symbol: 'ʐ', type: 'consonant', description: 'voiced retroflex fricative', place: 'retroflex', manner: 'fricative', voicing: 'voiced' },
  { symbol: 'ç', type: 'consonant', description: 'voiceless palatal fricative', place: 'palatal', manner: 'fricative', voicing: 'voiceless' },
  { symbol: 'ʝ', type: 'consonant', description: 'voiced palatal fricative', place: 'palatal', manner: 'fricative', voicing: 'voiced' },
  { symbol: 'x', type: 'consonant', description: 'voiceless velar fricative', place: 'velar', manner: 'fricative', voicing: 'voiceless' },
  { symbol: 'ɣ', type: 'consonant', description: 'voiced velar fricative', place: 'velar', manner: 'fricative', voicing: 'voiced' },
  { symbol: 'χ', type: 'consonant', description: 'voiceless uvular fricative', place: 'uvular', manner: 'fricative', voicing: 'voiceless' },
  { symbol: 'ʁ', type: 'consonant', description: 'voiced uvular fricative', place: 'uvular', manner: 'fricative', voicing: 'voiced' },
  { symbol: 'ħ', type: 'consonant', description: 'voiceless pharyngeal fricative', place: 'pharyngeal', manner: 'fricative', voicing: 'voiceless' },
  { symbol: 'ʕ', type: 'consonant', description: 'voiced pharyngeal fricative', place: 'pharyngeal', manner: 'fricative', voicing: 'voiced' },
  { symbol: 'h', type: 'consonant', description: 'voiceless glottal fricative', place: 'glottal', manner: 'fricative', voicing: 'voiceless' },
  { symbol: 'ɦ', type: 'consonant', description: 'voiced glottal fricative', place: 'glottal', manner: 'fricative', voicing: 'voiced' },
  // Lateral fricatives
  { symbol: 'ɬ', type: 'consonant', description: 'voiceless alveolar lateral fricative', place: 'alveolar', manner: 'lateral fricative', voicing: 'voiceless' },
  { symbol: 'ɮ', type: 'consonant', description: 'voiced alveolar lateral fricative', place: 'alveolar', manner: 'lateral fricative', voicing: 'voiced' },
  // Approximants
  { symbol: 'ʋ', type: 'consonant', description: 'voiced labiodental approximant', place: 'labiodental', manner: 'approximant', voicing: 'voiced' },
  { symbol: 'ɹ', type: 'consonant', description: 'voiced alveolar approximant', place: 'alveolar', manner: 'approximant', voicing: 'voiced' },
  { symbol: 'ɻ', type: 'consonant', description: 'voiced retroflex approximant', place: 'retroflex', manner: 'approximant', voicing: 'voiced' },
  { symbol: 'j', type: 'consonant', description: 'voiced palatal approximant', place: 'palatal', manner: 'approximant', voicing: 'voiced' },
  { symbol: 'ɰ', type: 'consonant', description: 'voiced velar approximant', place: 'velar', manner: 'approximant', voicing: 'voiced' },
  // Lateral approximants
  { symbol: 'l', type: 'consonant', description: 'voiced alveolar lateral approximant', place: 'alveolar', manner: 'lateral approximant', voicing: 'voiced' },
  { symbol: 'ɭ', type: 'consonant', description: 'voiced retroflex lateral approximant', place: 'retroflex', manner: 'lateral approximant', voicing: 'voiced' },
  { symbol: 'ʎ', type: 'consonant', description: 'voiced palatal lateral approximant', place: 'palatal', manner: 'lateral approximant', voicing: 'voiced' },
  { symbol: 'ʟ', type: 'consonant', description: 'voiced velar lateral approximant', place: 'velar', manner: 'lateral approximant', voicing: 'voiced' },
  // Affricates
  { symbol: 'ts', type: 'consonant', description: 'voiceless alveolar affricate', place: 'alveolar', manner: 'affricate', voicing: 'voiceless' },
  { symbol: 'dz', type: 'consonant', description: 'voiced alveolar affricate', place: 'alveolar', manner: 'affricate', voicing: 'voiced' },
  { symbol: 'tʃ', type: 'consonant', description: 'voiceless postalveolar affricate', place: 'postalveolar', manner: 'affricate', voicing: 'voiceless' },
  { symbol: 'dʒ', type: 'consonant', description: 'voiced postalveolar affricate', place: 'postalveolar', manner: 'affricate', voicing: 'voiced' },
  // Co-articulated
  { symbol: 'w', type: 'consonant', description: 'voiced labial-velar approximant', place: 'labial-velar', manner: 'approximant', voicing: 'voiced' },
  { symbol: 'ɥ', type: 'consonant', description: 'voiced labial-palatal approximant', place: 'labial-palatal', manner: 'approximant', voicing: 'voiced' },
  // Vowels — Cardinal vowels and common additions
  { symbol: 'i', type: 'vowel', description: 'close front unrounded vowel', height: 'close', backness: 'front', rounded: false },
  { symbol: 'y', type: 'vowel', description: 'close front rounded vowel', height: 'close', backness: 'front', rounded: true },
  { symbol: 'ɨ', type: 'vowel', description: 'close central unrounded vowel', height: 'close', backness: 'central', rounded: false },
  { symbol: 'ʉ', type: 'vowel', description: 'close central rounded vowel', height: 'close', backness: 'central', rounded: true },
  { symbol: 'ɯ', type: 'vowel', description: 'close back unrounded vowel', height: 'close', backness: 'back', rounded: false },
  { symbol: 'u', type: 'vowel', description: 'close back rounded vowel', height: 'close', backness: 'back', rounded: true },
  { symbol: 'ɪ', type: 'vowel', description: 'near-close near-front unrounded vowel', height: 'near-close', backness: 'near-front', rounded: false },
  { symbol: 'ʏ', type: 'vowel', description: 'near-close near-front rounded vowel', height: 'near-close', backness: 'near-front', rounded: true },
  { symbol: 'ʊ', type: 'vowel', description: 'near-close near-back rounded vowel', height: 'near-close', backness: 'near-back', rounded: true },
  { symbol: 'e', type: 'vowel', description: 'close-mid front unrounded vowel', height: 'close-mid', backness: 'front', rounded: false },
  { symbol: 'ø', type: 'vowel', description: 'close-mid front rounded vowel', height: 'close-mid', backness: 'front', rounded: true },
  { symbol: 'ɘ', type: 'vowel', description: 'close-mid central unrounded vowel', height: 'close-mid', backness: 'central', rounded: false },
  { symbol: 'ɵ', type: 'vowel', description: 'close-mid central rounded vowel', height: 'close-mid', backness: 'central', rounded: true },
  { symbol: 'ɤ', type: 'vowel', description: 'close-mid back unrounded vowel', height: 'close-mid', backness: 'back', rounded: false },
  { symbol: 'o', type: 'vowel', description: 'close-mid back rounded vowel', height: 'close-mid', backness: 'back', rounded: true },
  { symbol: 'ə', type: 'vowel', description: 'mid central vowel (schwa)', height: 'mid', backness: 'central', rounded: false },
  { symbol: 'ɛ', type: 'vowel', description: 'open-mid front unrounded vowel', height: 'open-mid', backness: 'front', rounded: false },
  { symbol: 'œ', type: 'vowel', description: 'open-mid front rounded vowel', height: 'open-mid', backness: 'front', rounded: true },
  { symbol: 'ɜ', type: 'vowel', description: 'open-mid central unrounded vowel', height: 'open-mid', backness: 'central', rounded: false },
  { symbol: 'ɞ', type: 'vowel', description: 'open-mid central rounded vowel', height: 'open-mid', backness: 'central', rounded: true },
  { symbol: 'ʌ', type: 'vowel', description: 'open-mid back unrounded vowel', height: 'open-mid', backness: 'back', rounded: false },
  { symbol: 'ɔ', type: 'vowel', description: 'open-mid back rounded vowel', height: 'open-mid', backness: 'back', rounded: true },
  { symbol: 'æ', type: 'vowel', description: 'near-open front unrounded vowel', height: 'near-open', backness: 'front', rounded: false },
  { symbol: 'ɐ', type: 'vowel', description: 'near-open central vowel', height: 'near-open', backness: 'central', rounded: false },
  { symbol: 'a', type: 'vowel', description: 'open front unrounded vowel', height: 'open', backness: 'front', rounded: false },
  { symbol: 'ɶ', type: 'vowel', description: 'open front rounded vowel', height: 'open', backness: 'front', rounded: true },
  { symbol: 'ɑ', type: 'vowel', description: 'open back unrounded vowel', height: 'open', backness: 'back', rounded: false },
  { symbol: 'ɒ', type: 'vowel', description: 'open back rounded vowel', height: 'open', backness: 'back', rounded: true },
  // Suprasegmentals
  { symbol: 'ˈ', type: 'suprasegmental', description: 'primary stress' },
  { symbol: 'ˌ', type: 'suprasegmental', description: 'secondary stress' },
  { symbol: 'ː', type: 'suprasegmental', description: 'long vowel/consonant' },
  { symbol: '˘', type: 'suprasegmental', description: 'extra-short' },
  // Diacritics
  { symbol: '̃', type: 'diacritic', description: 'nasalized' },
  { symbol: '̥', type: 'diacritic', description: 'voiceless (on normally voiced sound)' },
  { symbol: '̬', type: 'diacritic', description: 'voiced (on normally voiceless sound)' },
  { symbol: 'ʰ', type: 'diacritic', description: 'aspirated' },
  { symbol: 'ʷ', type: 'diacritic', description: 'labialized' },
  { symbol: 'ʲ', type: 'diacritic', description: 'palatalized' },
]

// Common English words with IPA transcriptions (General American)
const ENGLISH_IPA: Record<string, string> = {
  the: 'ðə', a: 'eɪ (letter) / ə (article)', is: 'ɪz', are: 'ɑːɹ', was: 'wɑːz',
  have: 'hæv', has: 'hæz', had: 'hæd', do: 'duː', does: 'dʌz',
  will: 'wɪl', would: 'wʊd', could: 'kʊd', should: 'ʃʊd',
  hello: 'hɛˈloʊ', world: 'wɜːɹld', water: 'ˈwɔːtəɹ', people: 'ˈpiːpəl',
  language: 'ˈlæŋɡwɪdʒ', phonetics: 'fəˈnɛtɪks', linguistics: 'lɪŋˈɡwɪstɪks',
  about: 'əˈbaʊt', above: 'əˈbʌv', after: 'ˈæftəɹ', again: 'əˈɡɛn',
  all: 'ɔːl', also: 'ˈɔːlsoʊ', always: 'ˈɔːlweɪz', and: 'ænd',
  because: 'bɪˈkɔːz', before: 'bɪˈfɔːɹ', between: 'bɪˈtwiːn',
  boy: 'bɔɪ', girl: 'ɡɜːɹl', man: 'mæn', woman: 'ˈwʊmən',
  child: 'tʃaɪld', children: 'ˈtʃɪldɹən', mother: 'ˈmʌðəɹ', father: 'ˈfɑːðəɹ',
  cat: 'kæt', dog: 'dɔːɡ', house: 'haʊs', book: 'bʊk',
  good: 'ɡʊd', great: 'ɡɹeɪt', beautiful: 'ˈbjuːtɪfəl',
  think: 'θɪŋk', thought: 'θɔːt', through: 'θɹuː', though: 'ðoʊ',
  enough: 'ɪˈnʌf', laugh: 'læf', cough: 'kɔːf', rough: 'ɹʌf',
  knight: 'naɪt', knife: 'naɪf', know: 'noʊ', write: 'ɹaɪt',
  psychology: 'saɪˈkɑːlədʒi', philosophy: 'fɪˈlɑːsəfi',
  university: 'ˌjuːnɪˈvɜːɹsəti', education: 'ˌɛdʒuˈkeɪʃən',
  computer: 'kəmˈpjuːtəɹ', technology: 'tɛkˈnɑːlədʒi',
  international: 'ˌɪntəɹˈnæʃənəl', communication: 'kəˌmjuːnɪˈkeɪʃən',
  information: 'ˌɪnfəɹˈmeɪʃən', government: 'ˈɡʌvəɹnmənt',
  important: 'ɪmˈpɔːɹtənt', different: 'ˈdɪfəɹənt',
  something: 'ˈsʌmθɪŋ', everything: 'ˈɛvɹiθɪŋ', nothing: 'ˈnʌθɪŋ',
  music: 'ˈmjuːzɪk', science: 'ˈsaɪəns', history: 'ˈhɪstəɹi',
  teacher: 'ˈtiːtʃəɹ', student: 'ˈstuːdənt', school: 'skuːl',
  color: 'ˈkʌləɹ', nature: 'ˈneɪtʃəɹ', picture: 'ˈpɪktʃəɹ',
  question: 'ˈkwɛstʃən', answer: 'ˈænsəɹ', example: 'ɪɡˈzæmpəl',
  family: 'ˈfæməli', friend: 'fɹɛnd', together: 'təˈɡɛðəɹ',
  country: 'ˈkʌntɹi', city: 'ˈsɪti', place: 'pleɪs',
  year: 'jɪɹ', time: 'taɪm', day: 'deɪ', night: 'naɪt',
  today: 'təˈdeɪ', tomorrow: 'təˈmɑːɹoʊ', yesterday: 'ˈjɛstəɹdeɪ',
}

// ─── Stylometry ─────────────────────────────────────────────────────────────

interface TextProfile {
  label: string
  tokenCount: number
  typeCount: number
  sentenceCount: number
  avgSentenceLength: number
  avgWordLength: number
  ttr: number
  hapaxRatio: number
  yulesK: number
  functionWordFreqs: Map<string, number>
  punctuationFreqs: Map<string, number>
  topWords: Map<string, number>
}

const FUNCTION_WORDS = new Set([
  'the', 'a', 'an', 'and', 'or', 'but', 'if', 'then', 'that', 'this',
  'is', 'was', 'are', 'were', 'be', 'been', 'being', 'have', 'has', 'had',
  'do', 'does', 'did', 'will', 'would', 'shall', 'should', 'can', 'could',
  'may', 'might', 'must', 'of', 'in', 'to', 'for', 'with', 'on', 'at',
  'from', 'by', 'as', 'into', 'through', 'during', 'before', 'after',
  'above', 'below', 'between', 'up', 'down', 'out', 'off', 'over', 'under',
  'not', 'no', 'nor', 'so', 'yet', 'both', 'either', 'neither', 'each',
  'every', 'all', 'any', 'few', 'more', 'most', 'other', 'some', 'such',
  'than', 'too', 'very', 'just', 'also', 'now', 'here', 'there', 'when',
  'where', 'why', 'how', 'what', 'which', 'who', 'whom', 'whose',
  'i', 'me', 'my', 'we', 'us', 'our', 'you', 'your', 'he', 'him', 'his',
  'she', 'her', 'it', 'its', 'they', 'them', 'their', 'about', 'while',
])

function computeYulesK(tokens: string[]): number {
  // Yule's K = 10^4 * (M2 - N) / N^2 where M2 = sum(i^2 * V_i) and V_i = number of words occurring i times
  const freq = new Map<string, number>()
  for (const t of tokens) freq.set(t, (freq.get(t) || 0) + 1)

  const spectrum = new Map<number, number>() // frequency -> how many words have that frequency
  for (const count of freq.values()) {
    spectrum.set(count, (spectrum.get(count) || 0) + 1)
  }

  const N = tokens.length
  let M2 = 0
  for (const [i, vi] of spectrum) {
    M2 += i * i * vi
  }

  if (N === 0) return 0
  return 10000 * (M2 - N) / (N * N)
}

function profileText(label: string, text: string): TextProfile {
  const tokens = tokenize(text)
  const sentences = sentenceSplit(text)
  const types = new Set(tokens)
  const hapax = hapaxLegomena(tokens)

  // Function word frequencies (normalized)
  const funcFreqs = new Map<string, number>()
  for (const fw of FUNCTION_WORDS) {
    const count = tokens.filter(t => t === fw).length
    funcFreqs.set(fw, tokens.length > 0 ? count / tokens.length : 0)
  }

  // Punctuation frequencies
  const punctFreqs = new Map<string, number>()
  const punctuation = text.match(/[.,;:!?'"()\-—–…]/g) || []
  for (const p of punctuation) {
    punctFreqs.set(p, (punctFreqs.get(p) || 0) + 1)
  }
  const totalPunct = punctuation.length || 1
  for (const [k, v] of punctFreqs) punctFreqs.set(k, v / totalPunct)

  // Top N most frequent words
  const topWords = wordFrequency(tokens, 50)

  return {
    label,
    tokenCount: tokens.length,
    typeCount: types.size,
    sentenceCount: sentences.length,
    avgSentenceLength: sentences.length > 0 ? tokens.length / sentences.length : 0,
    avgWordLength: tokens.length > 0 ? tokens.reduce((sum, t) => sum + t.length, 0) / tokens.length : 0,
    ttr: tokens.length > 0 ? types.size / tokens.length : 0,
    hapaxRatio: tokens.length > 0 ? hapax.length / tokens.length : 0,
    yulesK: computeYulesK(tokens),
    functionWordFreqs: funcFreqs,
    punctuationFreqs: punctFreqs,
    topWords,
  }
}

function formatProfile(p: TextProfile): string {
  const lines: string[] = [
    `### "${p.label}"`,
    '',
    `| Metric | Value |`,
    `|--------|-------|`,
    `| Tokens | ${p.tokenCount} |`,
    `| Types (unique words) | ${p.typeCount} |`,
    `| Sentences | ${p.sentenceCount} |`,
    `| Avg sentence length | ${p.avgSentenceLength.toFixed(1)} words |`,
    `| Avg word length | ${p.avgWordLength.toFixed(2)} chars |`,
    `| Type-token ratio | ${p.ttr.toFixed(4)} |`,
    `| Hapax ratio | ${p.hapaxRatio.toFixed(4)} |`,
    `| Yule's K | ${p.yulesK.toFixed(2)} |`,
    '',
    '**Top function words**:',
    ...[...p.functionWordFreqs.entries()]
      .filter(([, v]) => v > 0)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
      .map(([w, f]) => `- "${w}": ${(f * 100).toFixed(2)}%`),
    '',
    '**Punctuation profile**:',
    ...[...p.punctuationFreqs.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 8)
      .map(([p2, f]) => `- "${p2}": ${(f * 100).toFixed(1)}%`),
  ]
  return lines.join('\n')
}

function burrowsDelta(profiles: TextProfile[]): string {
  if (profiles.length < 2) return 'Need at least 2 texts for Burrows\' Delta comparison.'

  // Collect all word frequencies across all texts
  const allWords = new Map<string, number[]>()
  for (const p of profiles) {
    for (const [word, count] of p.topWords) {
      if (!allWords.has(word)) allWords.set(word, new Array(profiles.length).fill(0))
      const idx = profiles.indexOf(p)
      allWords.get(word)![idx] = count / p.tokenCount
    }
  }

  // Select the N most frequent words across the corpus
  const totalFreqs = [...allWords.entries()]
    .map(([word, freqs]) => ({ word, total: freqs.reduce((a, b) => a + b, 0) }))
    .sort((a, b) => b.total - a.total)
    .slice(0, 100)

  const featureWords = totalFreqs.map(f => f.word)

  // Build frequency matrix
  const matrix: number[][] = profiles.map((p, idx) =>
    featureWords.map(w => allWords.get(w)?.[idx] ?? 0)
  )

  // Compute z-scores per feature
  const means: number[] = featureWords.map((_, j) => {
    const col = matrix.map(row => row[j])
    return col.reduce((a, b) => a + b, 0) / col.length
  })
  const stds: number[] = featureWords.map((_, j) => {
    const col = matrix.map(row => row[j])
    const mean = means[j]
    const variance = col.reduce((sum, v) => sum + (v - mean) ** 2, 0) / col.length
    return Math.sqrt(variance) || 1e-10 // Avoid division by zero
  })

  const zMatrix: number[][] = matrix.map(row =>
    row.map((v, j) => (v - means[j]) / stds[j])
  )

  // Compute Manhattan distances between all pairs
  const parts: string[] = ['## Burrows\' Delta Analysis\n']
  parts.push(`**Feature words used**: ${featureWords.length}`)
  parts.push('')
  parts.push('### Distance Matrix')
  parts.push('')

  // Header
  const header = '| | ' + profiles.map(p => `"${p.label}"`.slice(0, 15)).join(' | ') + ' |'
  const separator = '|---|' + profiles.map(() => '---').join('|') + '|'
  parts.push(header)
  parts.push(separator)

  const distances: number[][] = []
  for (let i = 0; i < profiles.length; i++) {
    const row: number[] = []
    for (let j = 0; j < profiles.length; j++) {
      if (i === j) {
        row.push(0)
      } else {
        let dist = 0
        for (let k = 0; k < featureWords.length; k++) {
          dist += Math.abs(zMatrix[i][k] - zMatrix[j][k])
        }
        dist /= featureWords.length
        row.push(dist)
      }
    }
    distances.push(row)
    parts.push(`| "${profiles[i].label}".slice(0,12) | ${row.map(d => d.toFixed(3)).join(' | ')} |`)
  }

  parts.push('')
  parts.push('### Interpretation')
  parts.push('- **Delta < 1.0**: Likely same author')
  parts.push('- **Delta 1.0-1.5**: Uncertain / similar style')
  parts.push('- **Delta > 1.5**: Likely different authors')

  // Find closest pair
  let minDist = Infinity
  let minPair = [0, 1]
  for (let i = 0; i < profiles.length; i++) {
    for (let j = i + 1; j < profiles.length; j++) {
      if (distances[i][j] < minDist) {
        minDist = distances[i][j]
        minPair = [i, j]
      }
    }
  }
  parts.push(`\n**Closest pair**: "${profiles[minPair[0]].label}" & "${profiles[minPair[1]].label}" (Delta = ${minDist.toFixed(3)})`)

  return parts.join('\n')
}

// ─── Philosophical Concepts ─────────────────────────────────────────────────

interface PhilosophicalConcept {
  name: string
  branch: string
  period: string
  thinkers: string[]
  definition: string
  relatedConcepts: string[]
  argumentsFor: string[]
  argumentsAgainst: string[]
}

const PHILOSOPHICAL_CONCEPTS: PhilosophicalConcept[] = [
  // Metaphysics
  { name: 'Substance Dualism', branch: 'metaphysics', period: 'Early Modern', thinkers: ['Descartes'], definition: 'Reality consists of two fundamentally different substances: mind (res cogitans) and matter (res extensa).', relatedConcepts: ['Mind-Body Problem', 'Materialism', 'Property Dualism'], argumentsFor: ['Conceivability argument', 'Divisibility argument', 'Qualia seem non-physical'], argumentsAgainst: ['Interaction problem', 'Causal closure of physics', 'Neural correlates of consciousness'] },
  { name: 'Materialism', branch: 'metaphysics', period: 'Ancient/Modern', thinkers: ['Democritus', 'Hobbes', 'Smart', 'Armstrong'], definition: 'Everything that exists is physical matter or supervenes on physical matter. Mental states are identical to or reducible to brain states.', relatedConcepts: ['Physicalism', 'Identity Theory', 'Eliminativism'], argumentsFor: ['Causal closure of physics', 'Neuroscience progress', 'Parsimony'], argumentsAgainst: ['Hard problem of consciousness', 'Knowledge argument (Mary\'s Room)', 'Qualia'] },
  { name: 'Free Will', branch: 'metaphysics', period: 'Ancient to Present', thinkers: ['Aristotle', 'Kant', 'Hume', 'Frankfurt', 'van Inwagen'], definition: 'The capacity of agents to choose between different possible courses of action unimpeded.', relatedConcepts: ['Determinism', 'Compatibilism', 'Libertarianism (metaphysical)', 'Moral Responsibility'], argumentsFor: ['Phenomenological experience of choosing', 'Moral responsibility presupposes it', 'Quantum indeterminacy'], argumentsAgainst: ['Causal determinism', 'Neuroscience (Libet experiments)', 'If random, not truly "free"'] },
  { name: 'Determinism', branch: 'metaphysics', period: 'Ancient to Present', thinkers: ['Democritus', 'Laplace', 'Spinoza'], definition: 'Every event is necessitated by antecedent events and conditions plus the laws of nature.', relatedConcepts: ['Free Will', 'Compatibilism', 'Fatalism'], argumentsFor: ['Success of physical laws', 'Causal regularity', 'Predictability'], argumentsAgainst: ['Quantum mechanics', 'Chaos theory', 'Subjective experience of choice'] },
  { name: 'Personal Identity', branch: 'metaphysics', period: 'Early Modern', thinkers: ['Locke', 'Hume', 'Parfit', 'Nozick'], definition: 'What makes a person the same person over time? Theories include psychological continuity, bodily continuity, and narrative identity.', relatedConcepts: ['Consciousness', 'Memory', 'Ship of Theseus'], argumentsFor: ['Memory continuity (Locke)', 'Bodily continuity', 'Narrative coherence'], argumentsAgainst: ['Circularity of memory criterion', 'Fission cases (Parfit)', 'Buddhist no-self'] },
  { name: 'Universals', branch: 'metaphysics', period: 'Ancient', thinkers: ['Plato', 'Aristotle', 'Duns Scotus', 'Armstrong'], definition: 'Abstract properties or relations that can be instantiated by multiple particular things (e.g., "redness" in all red things).', relatedConcepts: ['Nominalism', 'Realism', 'Tropes', 'Forms'], argumentsFor: ['Explains predication', 'Needed for laws of nature', 'Mathematical objects'], argumentsAgainst: ['Parsimony favors nominalism', 'Third Man Argument', 'Location problem'] },
  { name: 'Possible Worlds', branch: 'metaphysics', period: 'Modern', thinkers: ['Leibniz', 'Lewis', 'Kripke', 'Plantinga'], definition: 'Complete ways reality could have been. Used to analyze necessity, possibility, and counterfactuals.', relatedConcepts: ['Modal Logic', 'Necessity', 'Contingency', 'Counterpart Theory'], argumentsFor: ['Clarifies modal reasoning', 'Explains counterfactuals', 'Systematic semantics for modal logic'], argumentsAgainst: ['Ontological extravagance (Lewis)', 'Abstracta problem', 'Irrelevance to actual world'] },
  // Epistemology
  { name: 'Empiricism', branch: 'epistemology', period: 'Early Modern', thinkers: ['Locke', 'Berkeley', 'Hume'], definition: 'All knowledge derives from sensory experience. The mind begins as a blank slate (tabula rasa).', relatedConcepts: ['Rationalism', 'Sensory Experience', 'Induction'], argumentsFor: ['Scientific method relies on observation', 'No innate ideas demonstrable', 'Developmental psychology'], argumentsAgainst: ['Mathematical knowledge seems non-empirical', 'Problem of induction (Hume)', 'Linguistic nativism (Chomsky)'] },
  { name: 'Rationalism', branch: 'epistemology', period: 'Early Modern', thinkers: ['Descartes', 'Spinoza', 'Leibniz'], definition: 'Some knowledge is innate or can be derived through reason alone, independent of sensory experience.', relatedConcepts: ['Empiricism', 'A Priori', 'Innate Ideas'], argumentsFor: ['Mathematics and logic', 'Cogito argument', 'Universal grammar'], argumentsAgainst: ['Empirical success of science', 'No clear mechanism for innate ideas', 'Cultural variation'] },
  { name: 'Skepticism', branch: 'epistemology', period: 'Ancient to Present', thinkers: ['Pyrrho', 'Sextus Empiricus', 'Descartes', 'Hume'], definition: 'The view that knowledge is impossible or that we should suspend judgment. Radical skepticism doubts even basic perceptual beliefs.', relatedConcepts: ['Foundationalism', 'Brain in a Vat', 'Cogito'], argumentsFor: ['Dream argument', 'Evil demon', 'Regress problem'], argumentsAgainst: ['Self-refuting', 'Pragmatic costs', 'Moorean shift'] },
  { name: 'Justified True Belief', branch: 'epistemology', period: 'Ancient/Modern', thinkers: ['Plato', 'Gettier'], definition: 'The traditional analysis of knowledge as belief that is both true and justified. Challenged by Gettier cases.', relatedConcepts: ['Gettier Problem', 'Reliabilism', 'Knowledge'], argumentsFor: ['Intuitive analysis', 'Captures core conditions', 'Long philosophical tradition'], argumentsAgainst: ['Gettier counterexamples', 'No agreement on justification', 'Contextual variation'] },
  { name: 'Foundationalism', branch: 'epistemology', period: 'Ancient/Modern', thinkers: ['Aristotle', 'Descartes', 'Russell'], definition: 'Knowledge has a structure: some beliefs are self-evident or basic, and all other beliefs rest on them.', relatedConcepts: ['Coherentism', 'Regress Problem', 'Basic Beliefs'], argumentsFor: ['Stops infinite regress', 'Self-evident truths exist', 'Science has axioms'], argumentsAgainst: ['Which beliefs are basic?', 'Basic beliefs may be fallible', 'Coherentist alternatives'] },
  { name: 'Pragmatism', branch: 'epistemology', period: 'Modern', thinkers: ['Peirce', 'James', 'Dewey', 'Rorty'], definition: 'The meaning and truth of ideas consist in their practical consequences and usefulness.', relatedConcepts: ['Instrumentalism', 'Verificationism', 'Truth'], argumentsFor: ['Scientific method is pragmatic', 'Avoids fruitless metaphysical debates', 'Successful prediction'], argumentsAgainst: ['Conflates truth with utility', 'False beliefs can be useful', 'Relativism concerns'] },
  // Ethics
  { name: 'Utilitarianism', branch: 'ethics', period: 'Modern', thinkers: ['Bentham', 'Mill', 'Singer', 'Sidgwick'], definition: 'The right action is the one that maximizes overall happiness or well-being for the greatest number.', relatedConcepts: ['Consequentialism', 'Hedonism', 'Felicific Calculus'], argumentsFor: ['Impartial', 'Measurable outcomes', 'Intuitive in many cases'], argumentsAgainst: ['Tyranny of the majority', 'Demandingness', 'Utility monster'] },
  { name: 'Categorical Imperative', branch: 'ethics', period: 'Modern', thinkers: ['Kant'], definition: 'Act only according to that maxim by which you can at the same time will that it should become a universal law. Treat persons always as ends, never merely as means.', relatedConcepts: ['Deontology', 'Duty', 'Universalizability'], argumentsFor: ['Respects dignity', 'Non-consequentialist', 'Clear decision procedure'], argumentsAgainst: ['Rigidity', 'Conflicting duties', 'Empty formalism objection'] },
  { name: 'Virtue Ethics', branch: 'ethics', period: 'Ancient', thinkers: ['Aristotle', 'Foot', 'MacIntyre', 'Hursthouse'], definition: 'Moral character (virtues like courage, justice, temperance, prudence) is primary. The right action is what a virtuous person would do.', relatedConcepts: ['Eudaimonia', 'Phronesis', 'Golden Mean'], argumentsFor: ['Holistic approach', 'Emphasizes character development', 'Fits moral psychology'], argumentsAgainst: ['Action guidance problem', 'Cultural relativity of virtues', 'Circularity'] },
  { name: 'Social Contract', branch: 'ethics', period: 'Early Modern/Modern', thinkers: ['Hobbes', 'Locke', 'Rousseau', 'Rawls'], definition: 'Political and moral rules are justified by the agreement rational agents would make under certain conditions.', relatedConcepts: ['State of Nature', 'Veil of Ignorance', 'Justice as Fairness'], argumentsFor: ['Grounds authority in consent', 'Explains political obligation', 'Rawlsian fairness'], argumentsAgainst: ['Historical fiction', 'Excludes non-contractors', 'Free-rider problem'] },
  { name: 'Moral Relativism', branch: 'ethics', period: 'Ancient to Present', thinkers: ['Protagoras', 'Harman', 'Wong'], definition: 'Moral truths are relative to cultures, societies, or individuals. There are no universal moral facts.', relatedConcepts: ['Cultural Relativism', 'Moral Realism', 'Subjectivism'], argumentsFor: ['Cultural diversity of morals', 'No proof of objective morals', 'Tolerance'], argumentsAgainst: ['Self-refuting', 'Can\'t criticize other cultures', 'Reformers would be wrong by definition'] },
  { name: 'Existential Ethics', branch: 'ethics', period: 'Modern', thinkers: ['Kierkegaard', 'Sartre', 'de Beauvoir', 'Camus'], definition: 'Humans create their own values through free choice. Authenticity and responsibility are central. Existence precedes essence.', relatedConcepts: ['Authenticity', 'Bad Faith', 'Absurdism'], argumentsFor: ['Radical freedom', 'Personal responsibility', 'Authentic self-creation'], argumentsAgainst: ['Anxiety-inducing', 'No external guidance', 'Ignores social context'] },
  // Logic
  { name: 'Law of Non-Contradiction', branch: 'logic', period: 'Ancient', thinkers: ['Aristotle', 'Leibniz'], definition: 'A proposition cannot be both true and false at the same time and in the same respect. ¬(P ∧ ¬P).', relatedConcepts: ['Law of Excluded Middle', 'Dialetheism', 'Classical Logic'], argumentsFor: ['Foundational for reasoning', 'Undeniable without self-contradiction', 'Required for communication'], argumentsAgainst: ['Dialetheism (Priest)', 'Quantum superposition analogy', 'Liar paradox'] },
  { name: 'Validity', branch: 'logic', period: 'Ancient to Present', thinkers: ['Aristotle', 'Frege', 'Tarski'], definition: 'An argument is valid if and only if it is impossible for the premises to all be true and the conclusion false.', relatedConcepts: ['Soundness', 'Deduction', 'Logical Consequence'], argumentsFor: ['Preserves truth', 'Formal and checkable', 'Foundation of proof'], argumentsAgainst: ['Valid arguments can have false premises', 'Relevance logic critiques', 'Explosion problem'] },
  { name: 'Induction', branch: 'logic', period: 'Modern', thinkers: ['Hume', 'Goodman', 'Popper'], definition: 'Reasoning from specific observations to general conclusions. Problem of induction: no logical guarantee that the future resembles the past.', relatedConcepts: ['Deduction', 'Abduction', 'Falsificationism'], argumentsFor: ['Basis of scientific method', 'Practically indispensable', 'Bayesian justification'], argumentsAgainst: ['Problem of induction (Hume)', 'New riddle (Goodman/grue)', 'No a priori justification'] },
  // Aesthetics
  { name: 'Aesthetic Judgment', branch: 'aesthetics', period: 'Modern', thinkers: ['Kant', 'Hume', 'Sibley'], definition: 'Judgments about beauty that claim universal agreement despite being based on subjective feeling. Kant: "purposiveness without purpose."', relatedConcepts: ['Sublime', 'Taste', 'Beauty'], argumentsFor: ['Universal structures of perception', 'Intersubjective agreement exists', 'Not mere preference'], argumentsAgainst: ['Cultural variation', 'No objective properties of beauty', 'Evolutionary explanations'] },
  { name: 'The Sublime', branch: 'aesthetics', period: 'Modern', thinkers: ['Burke', 'Kant', 'Lyotard'], definition: 'An aesthetic experience of awe, vastness, or power that overwhelms our capacity for comprehension. Contrasted with the merely beautiful.', relatedConcepts: ['Aesthetic Judgment', 'Beauty', 'Terror'], argumentsFor: ['Distinct phenomenology', 'Connects to magnitude/power', 'Art evokes it reliably'], argumentsAgainst: ['Merely psychological', 'Culturally variable', 'Vague category'] },
  { name: 'Mimesis', branch: 'aesthetics', period: 'Ancient', thinkers: ['Plato', 'Aristotle'], definition: 'Art as imitation of reality. Plato: art is a copy of a copy (twice removed from truth). Aristotle: art reveals universal truths through particular imitations.', relatedConcepts: ['Representation', 'Catharsis', 'Forms'], argumentsFor: ['Art does represent reality', 'Universal truths in particular stories', 'Catharsis theory'], argumentsAgainst: ['Non-representational art', 'Art creates, not just copies', 'Music/architecture challenge'] },
  // Political
  { name: 'Liberalism', branch: 'political', period: 'Early Modern/Modern', thinkers: ['Locke', 'Mill', 'Rawls', 'Nozick'], definition: 'Individual liberty, equal rights, consent of the governed, and limited government are foundational political values.', relatedConcepts: ['Rights', 'Democracy', 'Social Contract', 'Liberty'], argumentsFor: ['Protects individual freedom', 'Promotes tolerance', 'Economic prosperity'], argumentsAgainst: ['Atomistic individualism', 'Ignores structural inequality', 'Cultural imperialism'] },
  { name: 'Justice as Fairness', branch: 'political', period: 'Modern', thinkers: ['Rawls'], definition: 'Justice is what rational agents would agree to behind a veil of ignorance: equal basic liberties and inequalities arranged to benefit the least advantaged.', relatedConcepts: ['Veil of Ignorance', 'Difference Principle', 'Original Position'], argumentsFor: ['Impartial procedure', 'Protects disadvantaged', 'Intuitive fairness'], argumentsAgainst: ['Hypothetical consent', 'Ignores desert', 'Libertarian objections (Nozick)'] },
  { name: 'Marxism', branch: 'political', period: 'Modern', thinkers: ['Marx', 'Engels', 'Gramsci', 'Lukacs'], definition: 'History is driven by class struggle and material conditions. Capitalism alienates workers and will be superseded by communism.', relatedConcepts: ['Historical Materialism', 'Alienation', 'Class Struggle', 'Ideology'], argumentsFor: ['Explains economic inequality', 'Critique of exploitation', 'Historical analysis of power'], argumentsAgainst: ['Failed implementations', 'Deterministic', 'Ignores individual agency'] },
  // Philosophy of Mind
  { name: 'Consciousness', branch: 'metaphysics', period: 'Ancient to Present', thinkers: ['Descartes', 'Nagel', 'Chalmers', 'Dennett'], definition: 'Subjective experience — "what it is like" to be a conscious being. The "hard problem": why do physical processes give rise to experience?', relatedConcepts: ['Qualia', 'Hard Problem', 'Functionalism'], argumentsFor: ['Undeniable first-person datum', 'Explanatory gap', 'Zombie argument'], argumentsAgainst: ['Dennett: quining qualia', 'Illusionism', 'No causal role needed'] },
  { name: 'Functionalism', branch: 'metaphysics', period: 'Modern', thinkers: ['Putnam', 'Fodor', 'Block', 'Dennett'], definition: 'Mental states are defined by their functional roles — inputs, outputs, and relations to other states — not by their physical substrate.', relatedConcepts: ['Multiple Realizability', 'Turing Machine', 'Chinese Room'], argumentsFor: ['Multiple realizability', 'Explains AI possibility', 'Scientific compatibility'], argumentsAgainst: ['Chinese Room (Searle)', 'Absent qualia', 'Inverted qualia'] },
  { name: 'Intentionality', branch: 'metaphysics', period: 'Modern', thinkers: ['Brentano', 'Husserl', 'Searle', 'Dennett'], definition: 'The "aboutness" of mental states — their capacity to be directed at or represent objects and states of affairs.', relatedConcepts: ['Consciousness', 'Representation', 'Chinese Room'], argumentsFor: ['Distinguishes mental from physical', 'Explains meaning', 'Phenomenologically evident'], argumentsAgainst: ['Naturalization problem', 'Thermostats have "aboutness" too?', 'Derived vs. original'] },
  // Philosophy of Language
  { name: 'Meaning (Theory of)', branch: 'logic', period: 'Modern', thinkers: ['Frege', 'Russell', 'Wittgenstein', 'Kripke', 'Putnam'], definition: 'What determines the meaning of words and sentences? Theories include referential, use-based, possible-worlds semantics, and causal theories of reference.', relatedConcepts: ['Reference', 'Sense', 'Language Games', 'Rigid Designators'], argumentsFor: ['Compositionality', 'Truth conditions', 'Communication success'], argumentsAgainst: ['Indeterminacy of translation (Quine)', 'Context-dependence', 'Private language argument'] },
  { name: 'Phenomenology', branch: 'epistemology', period: 'Modern', thinkers: ['Husserl', 'Heidegger', 'Merleau-Ponty', 'Sartre'], definition: 'The study of structures of consciousness as experienced from the first-person perspective. "To the things themselves!"', relatedConcepts: ['Intentionality', 'Lived Experience', 'Being-in-the-World', 'Epoché'], argumentsFor: ['Rich descriptions of experience', 'Avoids reductionism', 'Foundation for human sciences'], argumentsAgainst: ['Subjectivity limits intersubjective verification', 'Obscure methodology', 'Anti-scientific tendency'] },
  { name: 'Hermeneutics', branch: 'epistemology', period: 'Modern', thinkers: ['Schleiermacher', 'Dilthey', 'Gadamer', 'Ricoeur'], definition: 'The theory and methodology of interpretation, especially of texts. Understanding always involves a "fusion of horizons" between interpreter and interpreted.', relatedConcepts: ['Phenomenology', 'Interpretation', 'Hermeneutic Circle'], argumentsFor: ['Explains interpretive process', 'Historical understanding', 'Text-reader interaction'], argumentsAgainst: ['Relativism concern', 'No single correct interpretation', 'Vagueness'] },
  { name: 'Nihilism', branch: 'metaphysics', period: 'Modern', thinkers: ['Nietzsche', 'Turgenev', 'Cioran'], definition: 'Life is without objective meaning, purpose, or intrinsic value. There are no moral truths.', relatedConcepts: ['Existentialism', 'Absurdism', 'Moral Anti-Realism'], argumentsFor: ['No evidence of cosmic purpose', 'Death of God', 'Suffering without redemption'], argumentsAgainst: ['Self-undermining', 'We do experience meaning', 'Leads to paralysis'] },
  { name: 'Absurdism', branch: 'ethics', period: 'Modern', thinkers: ['Camus', 'Kierkegaard'], definition: 'The conflict between humans\' tendency to seek meaning and the universe\'s silence. Camus: we must imagine Sisyphus happy.', relatedConcepts: ['Nihilism', 'Existentialism', 'Revolt'], argumentsFor: ['Honest about human condition', 'Motivates creative response', 'Neither denial nor despair'], argumentsAgainst: ['Arbitrary starting point', 'Why revolt rather than resignation?', 'Meaning may exist'] },
  { name: 'Epistemic Injustice', branch: 'epistemology', period: 'Contemporary', thinkers: ['Fricker', 'Medina', 'Dotson'], definition: 'Wrongful denial of someone\'s capacity as a knower. Includes testimonial injustice (credibility deficit) and hermeneutical injustice (lack of interpretive resources).', relatedConcepts: ['Social Epistemology', 'Standpoint Theory', 'Testimony'], argumentsFor: ['Explains systematic knowledge suppression', 'Real-world impact', 'Intersects with justice'], argumentsAgainst: ['Scope inflation', 'Hard to operationalize', 'Political rather than epistemic'] },
  // Philosophy of Science
  { name: 'Falsificationism', branch: 'epistemology', period: 'Modern', thinkers: ['Popper'], definition: 'Scientific theories cannot be verified but can be falsified. A theory is scientific only if it makes testable predictions that could prove it wrong.', relatedConcepts: ['Verification', 'Demarcation Problem', 'Paradigm Shift'], argumentsFor: ['Clear demarcation criterion', 'Explains theory revision', 'Promotes bold hypotheses'], argumentsAgainst: ['Duhem-Quine thesis', 'Scientists don\'t actually abandon falsified theories', 'Auxiliary hypotheses'] },
  { name: 'Paradigm Shift', branch: 'epistemology', period: 'Modern', thinkers: ['Kuhn'], definition: 'Scientific revolutions occur when an existing paradigm (framework of normal science) is replaced by a new one that is incommensurable with the old.', relatedConcepts: ['Normal Science', 'Anomaly', 'Incommensurability'], argumentsFor: ['Historical examples (Copernicus, Einstein)', 'Explains resistance to change', 'Community structure of science'], argumentsAgainst: ['Incommensurability is overstated', 'Relativism', 'Progress still happens'] },
  // Additional important concepts
  { name: 'Dialectics', branch: 'logic', period: 'Ancient/Modern', thinkers: ['Plato', 'Hegel', 'Marx'], definition: 'A method of argument through dialogue (Plato) or a theory of development through thesis-antithesis-synthesis (Hegel). For Marx, applied to material/social conditions.', relatedConcepts: ['Thesis-Antithesis-Synthesis', 'Historical Materialism', 'Socratic Method'], argumentsFor: ['Captures dynamic development', 'Useful analytical tool', 'Historical explanatory power'], argumentsAgainst: ['Vague/unfalsifiable', 'Teleological assumptions', 'Oversimplifies'] },
  { name: 'Utopia', branch: 'political', period: 'Early Modern', thinkers: ['More', 'Plato', 'Marx', 'Nozick'], definition: 'An imagined ideal society. Philosophical utopianism explores what the best possible social arrangement would look like.', relatedConcepts: ['Dystopia', 'Social Contract', 'Justice'], argumentsFor: ['Inspires reform', 'Clarifies values', 'Thought experiment for justice'], argumentsAgainst: ['Impossible to realize', 'Totalitarian risk', 'Ignores human nature'] },
  { name: 'Natural Law', branch: 'ethics', period: 'Ancient/Medieval', thinkers: ['Aquinas', 'Aristotle', 'Cicero', 'Finnis'], definition: 'There are objective moral principles discernible through reason that are grounded in human nature or divine order.', relatedConcepts: ['Divine Command Theory', 'Human Rights', 'Virtue Ethics'], argumentsFor: ['Universal basis for rights', 'Transcends positive law', 'Natural teleology'], argumentsAgainst: ['Naturalistic fallacy', 'Relies on contested teleology', 'Cultural variation'] },
  { name: 'Panpsychism', branch: 'metaphysics', period: 'Ancient to Present', thinkers: ['Spinoza', 'Leibniz', 'Whitehead', 'Chalmers', 'Goff'], definition: 'Consciousness or experience is a fundamental and ubiquitous feature of the physical world. All matter has some form of inner experience.', relatedConcepts: ['Consciousness', 'Hard Problem', 'Neutral Monism'], argumentsFor: ['Avoids emergence mystery', 'Continuity in nature', 'Addresses hard problem'], argumentsAgainst: ['Combination problem', 'Unfalsifiable', 'Counterintuitive'] },
  { name: 'Stoicism', branch: 'ethics', period: 'Ancient', thinkers: ['Zeno', 'Epictetus', 'Seneca', 'Marcus Aurelius'], definition: 'Virtue (living according to reason/nature) is the sole good. External things are "indifferent." Emotional tranquility (apatheia) through accepting what we cannot control.', relatedConcepts: ['Virtue Ethics', 'Determinism', 'Cosmopolitanism'], argumentsFor: ['Psychological resilience', 'Practical wisdom', 'Universal ethics'], argumentsAgainst: ['Emotional suppression', 'Fatalistic', 'Ignores social structures'] },
  { name: 'Epicureanism', branch: 'ethics', period: 'Ancient', thinkers: ['Epicurus', 'Lucretius'], definition: 'The highest good is pleasure (especially absence of pain — ataraxia). Seek modest pleasures, friendship, philosophical conversation. Avoid fear of death and gods.', relatedConcepts: ['Hedonism', 'Utilitarianism', 'Atomism'], argumentsFor: ['Death is nothing to us', 'Modest and achievable', 'Friendship-centered'], argumentsAgainst: ['Passive/withdrawn', 'Too focused on individual', 'Pleasure is not all good'] },
  { name: 'Social Constructionism', branch: 'epistemology', period: 'Modern/Contemporary', thinkers: ['Berger', 'Luckmann', 'Foucault', 'Butler'], definition: 'Knowledge, categories, and social realities (gender, race, institutions) are constructed through social processes rather than being natural or given.', relatedConcepts: ['Postmodernism', 'Discourse', 'Power/Knowledge'], argumentsFor: ['Explains cultural variation', 'Denaturalizes oppressive categories', 'Historical evidence of change'], argumentsAgainst: ['Self-refuting risk', 'Neglects material reality', 'Everything-is-constructed overreach'] },
  { name: 'Deconstruction', branch: 'logic', period: 'Contemporary', thinkers: ['Derrida'], definition: 'A method of reading that reveals internal contradictions and hierarchies within texts. Binary oppositions (speech/writing, nature/culture) are unstable.', relatedConcepts: ['Différance', 'Logocentrism', 'Post-structuralism'], argumentsFor: ['Reveals hidden assumptions', 'Challenges dominant narratives', 'Close reading discipline'], argumentsAgainst: ['Obscurantism', 'Nihilistic', 'Self-undermining'] },
  { name: 'Veil of Ignorance', branch: 'political', period: 'Modern', thinkers: ['Rawls'], definition: 'A thought experiment: rational agents choosing principles of justice without knowing their own social position, talents, or values. Ensures impartial principles.', relatedConcepts: ['Justice as Fairness', 'Original Position', 'Social Contract'], argumentsFor: ['Procedural fairness', 'Risk aversion leads to protecting worst-off', 'Powerful thought experiment'], argumentsAgainst: ['Removes relevant information', 'Hypothetical consent is not real', 'Assumes risk aversion'] },
  { name: 'Bioethics', branch: 'ethics', period: 'Contemporary', thinkers: ['Beauchamp', 'Childress', 'Singer', 'Kass'], definition: 'The study of ethical issues arising from advances in biology and medicine: autonomy, beneficence, non-maleficence, and justice (the four principles).', relatedConcepts: ['Medical Ethics', 'Autonomy', 'Informed Consent'], argumentsFor: ['Practical guidance', 'Four principles framework', 'Addresses real dilemmas'], argumentsAgainst: ['Principlism is too abstract', 'Cultural blind spots', 'Technology outpaces ethics'] },
  { name: 'Philosophy of Technology', branch: 'metaphysics', period: 'Contemporary', thinkers: ['Heidegger', 'Ellul', 'Feenberg', 'Ihde'], definition: 'Critical examination of technology\'s nature and impact on human existence. Heidegger: technology as "enframing" (Gestell) reduces everything to "standing reserve."', relatedConcepts: ['AI Ethics', 'Transhumanism', 'Instrumentalism'], argumentsFor: ['Technology shapes perception', 'Not value-neutral', 'Existential implications'], argumentsAgainst: ['Technophobic bias', 'Vague concepts', 'Ignores benefits'] },
  { name: 'AI Ethics', branch: 'ethics', period: 'Contemporary', thinkers: ['Bostrom', 'Russell', 'Floridi', 'Bengio'], definition: 'Ethical issues posed by artificial intelligence: alignment, bias, autonomy, accountability, consciousness, existential risk, and the moral status of AI systems.', relatedConcepts: ['Consciousness', 'Philosophy of Technology', 'Existential Risk'], argumentsFor: ['Urgent real-world implications', 'Alignment problem is genuine', 'Power concentration risk'], argumentsAgainst: ['Premature speculation', 'Anthropomorphism', 'Distracts from current harms'] },
]

// ─── Registration ───────────────────────────────────────────────────────────

export function registerLabHumanitiesTools(): void {

  // ── 1. corpus_analyze ──────────────────────────────────────────────────

  registerTool({
    name: 'corpus_analyze',
    description: 'Computational text analysis: word frequency, N-grams, hapax legomena, type-token ratio, vocabulary growth curve (Heaps\' law), and concordance (KWIC). Useful for linguistics, stylistics, and digital humanities.',
    parameters: {
      text: { type: 'string', description: 'The text to analyze', required: true },
      analysis: { type: 'string', description: 'Analysis type: frequency, ngrams, hapax, ttr, concordance, all', required: true },
      keyword: { type: 'string', description: 'Keyword for concordance (KWIC) — required if analysis is "concordance"' },
      n: { type: 'number', description: 'N-gram size (default 2)' },
      top: { type: 'number', description: 'Number of top results to return (default 20)' },
    },
    tier: 'free',
    async execute(args) {
      const text = String(args.text)
      const analysis = String(args.analysis || 'all').toLowerCase()
      const keyword = args.keyword ? String(args.keyword) : undefined
      const n = typeof args.n === 'number' ? args.n : 2
      const top = typeof args.top === 'number' ? args.top : 20

      const tokens = tokenize(text)
      if (tokens.length === 0) return 'Error: No text to analyze (empty or no words).'

      const parts: string[] = ['## Corpus Analysis\n']
      parts.push(`**Token count**: ${tokens.length} | **Type count**: ${new Set(tokens).size}\n`)

      if (analysis === 'frequency' || analysis === 'all') {
        parts.push('### Word Frequency (top ' + top + ')')
        parts.push('')
        parts.push('| Rank | Word | Count | % |')
        parts.push('|------|------|-------|---|')
        let rank = 1
        for (const [word, count] of wordFrequency(tokens, top)) {
          parts.push(`| ${rank++} | ${word} | ${count} | ${(count / tokens.length * 100).toFixed(2)}% |`)
        }
        parts.push('')
      }

      if (analysis === 'ngrams' || analysis === 'all') {
        parts.push(`### ${n}-grams (top ${top})`)
        parts.push('')
        parts.push('| Rank | N-gram | Count |')
        parts.push('|------|--------|-------|')
        let rank = 1
        for (const [gram, count] of computeNgrams(tokens, n, top)) {
          parts.push(`| ${rank++} | ${gram} | ${count} |`)
        }
        parts.push('')
      }

      if (analysis === 'hapax' || analysis === 'all') {
        const hapax = hapaxLegomena(tokens)
        parts.push(`### Hapax Legomena`)
        parts.push(`**Count**: ${hapax.length} (${(hapax.length / tokens.length * 100).toFixed(2)}% of tokens)`)
        parts.push('')
        if (hapax.length <= 30) {
          parts.push(hapax.join(', '))
        } else {
          parts.push(hapax.slice(0, 30).join(', ') + ` ... and ${hapax.length - 30} more`)
        }
        parts.push('')
      }

      if (analysis === 'ttr' || analysis === 'all') {
        const ttrResult = typeTokenRatio(tokens)
        const growth = vocabularyGrowthCurve(tokens)
        parts.push('### Type-Token Ratio & Vocabulary Growth')
        parts.push('')
        parts.push(`| Metric | Value |`)
        parts.push(`|--------|-------|`)
        parts.push(`| Types (V) | ${ttrResult.types} |`)
        parts.push(`| Tokens (N) | ${ttrResult.tokens} |`)
        parts.push(`| TTR (V/N) | ${ttrResult.ttr.toFixed(4)} |`)
        parts.push(`| Heaps\' K | ${growth.heapsK.toFixed(4)} |`)
        parts.push(`| Heaps\' β | ${growth.heapsBeta.toFixed(4)} |`)
        parts.push(`| Heaps\' law: V ≈ ${growth.heapsK.toFixed(2)} × N^${growth.heapsBeta.toFixed(3)} | |`)
        parts.push('')
        // ASCII growth curve (compact)
        if (growth.curve.length > 5) {
          parts.push('**Vocabulary growth curve** (N → V):')
          parts.push('```')
          const maxV = growth.curve[growth.curve.length - 1][1]
          const height = 10
          for (let row = height; row >= 0; row--) {
            const threshold = (row / height) * maxV
            let line = `${Math.round(threshold).toString().padStart(6)} |`
            for (const [, v] of growth.curve) {
              line += v >= threshold ? '█' : ' '
            }
            parts.push(line)
          }
          parts.push(`${''.padStart(7)}${'─'.repeat(growth.curve.length + 1)}`)
          parts.push(`${''.padStart(7)}N → ${growth.curve[growth.curve.length - 1][0]}`)
          parts.push('```')
        }
        parts.push('')
      }

      if (analysis === 'concordance' || analysis === 'all') {
        if (keyword) {
          const results = concordance(tokens, keyword)
          parts.push(`### Concordance (KWIC) for "${keyword}"`)
          parts.push(`**Occurrences**: ${results.length}`)
          parts.push('')
          parts.push('```')
          for (const line of results.slice(0, 30)) {
            parts.push(line)
          }
          if (results.length > 30) parts.push(`... and ${results.length - 30} more`)
          parts.push('```')
        } else if (analysis === 'concordance') {
          parts.push('*Concordance requires a `keyword` parameter.*')
        }
        parts.push('')
      }

      return parts.join('\n')
    },
  })

  // ── 2. formal_logic ────────────────────────────────────────────────────

  registerTool({
    name: 'formal_logic',
    description: 'Propositional logic: parse expressions, build truth tables, check validity/satisfiability/tautology, identify inference rules. Supports operators: ∧/&/AND, ∨/|/OR, ¬/!/NOT, →/->/IMPLIES, ↔/<->/IFF. Up to 6 variables.',
    parameters: {
      expression: { type: 'string', description: 'Logical expression, e.g. "(P → Q) ∧ P → Q" or "(P -> Q) & P -> Q"', required: true },
      operation: { type: 'string', description: 'Operation: truth_table, validity, satisfiability, inference', required: true },
    },
    tier: 'free',
    async execute(args) {
      const expression = String(args.expression)
      const operation = String(args.operation || 'truth_table').toLowerCase()

      if (operation === 'inference') {
        return checkInference(expression)
      }

      let ast: LogicNode
      try {
        const tokens = lexLogic(expression)
        ast = new LogicParser(tokens).parse()
      } catch (err) {
        return `Error parsing expression: ${err instanceof Error ? err.message : String(err)}`
      }

      const formatted = formatLogicNode(ast)
      const parts: string[] = [`## Formal Logic Analysis\n`, `**Parsed**: ${formatted}\n`]

      try {
        const table = buildTruthTable(ast)
        const allTrue = table.rows.every(r => r.result)
        const anyTrue = table.rows.some(r => r.result)
        const allFalse = table.rows.every(r => !r.result)

        if (operation === 'truth_table' || operation === 'validity') {
          parts.push('### Truth Table\n')
          const header = '| ' + table.vars.join(' | ') + ' | Result |'
          const sep = '|' + table.vars.map(() => '---').join('|') + '|--------|'
          parts.push(header)
          parts.push(sep)
          for (const row of table.rows) {
            const vals = row.assignment.map(v => v ? 'T' : 'F').join(' | ')
            parts.push(`| ${vals} | ${row.result ? '**T**' : 'F'} |`)
          }
          parts.push('')
        }

        if (operation === 'validity' || operation === 'truth_table') {
          parts.push('### Classification\n')
          if (allTrue) parts.push('- **Tautology** (always true) — logically valid')
          else if (allFalse) parts.push('- **Contradiction** (always false)')
          else parts.push('- **Contingent** (true in some valuations, false in others)')
          parts.push(`- True in ${table.rows.filter(r => r.result).length}/${table.rows.length} valuations`)
        }

        if (operation === 'satisfiability') {
          parts.push('### Satisfiability\n')
          if (anyTrue) {
            parts.push('**Satisfiable** — at least one valuation makes this true.\n')
            parts.push('**Satisfying assignment(s)**:')
            for (const row of table.rows.filter(r => r.result).slice(0, 5)) {
              const assignment = table.vars.map((v, i) => `${v}=${row.assignment[i] ? 'T' : 'F'}`).join(', ')
              parts.push(`- {${assignment}}`)
            }
            const satCount = table.rows.filter(r => r.result).length
            if (satCount > 5) parts.push(`  ... and ${satCount - 5} more`)
          } else {
            parts.push('**Unsatisfiable** — no valuation makes this true (contradiction).')
          }
        }

        return parts.join('\n')
      } catch (err) {
        return `Error: ${err instanceof Error ? err.message : String(err)}`
      }
    },
  })

  // ── 3. argument_map ────────────────────────────────────────────────────

  registerTool({
    name: 'argument_map',
    description: 'Analyze argument structure: identify premises, conclusions, assumptions, logical form. Detect ~20 common logical fallacies. Check deductive validity.',
    parameters: {
      argument: { type: 'string', description: 'Natural language argument text to analyze', required: true },
      operation: { type: 'string', description: 'Operation: structure, fallacy_check, validity', required: true },
    },
    tier: 'free',
    async execute(args) {
      const text = String(args.argument)
      const operation = String(args.operation || 'structure').toLowerCase()

      if (text.length < 10) return 'Error: Argument text too short for meaningful analysis.'

      switch (operation) {
        case 'structure': return analyzeArgumentStructure(text)
        case 'fallacy_check': return checkFallacies(text)
        case 'validity': return checkArgumentValidity(text)
        default: return `Unknown operation "${operation}". Use: structure, fallacy_check, validity.`
      }
    },
  })

  // ── 4. ethics_framework ────────────────────────────────────────────────

  registerTool({
    name: 'ethics_framework',
    description: 'Apply ethical frameworks to a dilemma: utilitarianism, deontological (Kantian), virtue ethics (Aristotelian), care ethics, rights-based, social contract. Generates analysis and likely conclusion for each.',
    parameters: {
      dilemma: { type: 'string', description: 'Describe the ethical situation/dilemma', required: true },
      frameworks: { type: 'string', description: 'Frameworks: all, utilitarian, deontological, virtue, care, rights, social_contract', required: true },
    },
    tier: 'free',
    async execute(args) {
      const dilemma = String(args.dilemma)
      const frameworksArg = String(args.frameworks || 'all').toLowerCase()

      if (dilemma.length < 10) return 'Error: Please provide a more detailed description of the ethical dilemma.'

      type FrameworkFn = (d: string) => EthicalAnalysis
      const fMap: Record<string, FrameworkFn> = {
        utilitarian: applyUtilitarian,
        deontological: applyDeontological,
        virtue: applyVirtueEthics,
        care: applyCareEthics,
        rights: applyRightsBased,
        social_contract: applySocialContract,
      }

      const selected = frameworksArg === 'all'
        ? Object.keys(fMap)
        : frameworksArg.split(',').map(s => s.trim()).filter(s => s in fMap)

      if (selected.length === 0) {
        return `Unknown framework(s). Available: ${Object.keys(fMap).join(', ')}, all`
      }

      const parts: string[] = [
        `## Ethical Analysis\n`,
        `**Dilemma**: ${dilemma.slice(0, 200)}${dilemma.length > 200 ? '...' : ''}\n`,
        '---\n',
      ]

      for (const key of selected) {
        const analysis = fMap[key](dilemma)
        parts.push(`### ${analysis.framework}`)
        parts.push(`**Core principle**: ${analysis.principle}\n`)
        parts.push(analysis.analysis)
        parts.push(`\n**Likely conclusion**: ${analysis.likelyConclusion}`)
        parts.push(`\n**Key question**: *${analysis.keyQuestion}*`)
        parts.push('\n---\n')
      }

      if (selected.length > 1) {
        parts.push('### Comparative Summary')
        parts.push('Different frameworks may yield different conclusions. Ethical maturity involves understanding these tensions and making reflective judgments that consider multiple perspectives.')
      }

      return parts.join('\n')
    },
  })

  // ── 5. historical_timeline ─────────────────────────────────────────────

  registerTool({
    name: 'historical_timeline',
    description: 'Build and analyze timelines: add events with dates and categories, compute duration/overlap, detect periods, generate ASCII visualization. Dates support CE/BCE/ISO formats.',
    parameters: {
      events: { type: 'string', description: 'JSON array of {date, event, category?, end_date?}', required: true },
      operation: { type: 'string', description: 'Operation: visualize, analyze, period, connections', required: true },
    },
    tier: 'free',
    async execute(args) {
      let events: TimelineEvent[]
      try {
        events = JSON.parse(String(args.events))
        if (!Array.isArray(events)) throw new Error('Must be an array')
      } catch (err) {
        return `Error parsing events JSON: ${err instanceof Error ? err.message : String(err)}\n\nExpected format: [{"date": "1776", "event": "Declaration of Independence", "category": "politics"}]`
      }

      if (events.length === 0) return 'Error: No events provided.'

      const operation = String(args.operation || 'visualize').toLowerCase()

      switch (operation) {
        case 'visualize': return visualizeTimeline(events)
        case 'analyze': return analyzeTimeline(events)
        case 'period': return detectPeriods(events)
        case 'connections': {
          const vis = visualizeTimeline(events)
          const analysis = analyzeTimeline(events)
          return `${vis}\n\n---\n\n${analysis}`
        }
        default: return `Unknown operation "${operation}". Use: visualize, analyze, period, connections.`
      }
    },
  })

  // ── 6. language_typology ───────────────────────────────────────────────

  registerTool({
    name: 'language_typology',
    description: 'Linguistic typology database: ~50 major languages with family, word order, morphological type, writing system, phoneme count, tonality, case system, speaker numbers. Search by language, family, or feature.',
    parameters: {
      query: { type: 'string', description: 'Language name, family name, or feature to search', required: true },
      search_type: { type: 'string', description: 'Search type: language, family, feature, comparison', required: true },
    },
    tier: 'free',
    async execute(args) {
      const query = String(args.query).toLowerCase()
      const searchType = String(args.search_type || 'language').toLowerCase()

      const formatLang = (lang: LanguageData): string => {
        return [
          `### ${lang.name}`,
          '',
          '| Property | Value |',
          '|----------|-------|',
          `| Family | ${lang.family}${lang.subfamily ? ' > ' + lang.subfamily : ''} |`,
          `| Word order | ${lang.wordOrder} |`,
          `| Morphological type | ${lang.morphologicalType} |`,
          `| Writing system | ${lang.writingSystem} |`,
          `| Phoneme inventory | ~${lang.phonemeCount} |`,
          `| Tonal | ${lang.tonal ? 'Yes' : 'No'} |`,
          `| Case system | ${lang.caseSystem} |`,
          `| Speakers | ${lang.speakers} |`,
        ].join('\n')
      }

      switch (searchType) {
        case 'language': {
          const matches = LANGUAGES.filter(l =>
            l.name.toLowerCase().includes(query)
          )
          if (matches.length === 0) return `No language found matching "${query}". Try: ${LANGUAGES.slice(0, 5).map(l => l.name).join(', ')}...`
          return `## Language Typology\n\n${matches.map(formatLang).join('\n\n')}`
        }

        case 'family': {
          const matches = LANGUAGES.filter(l =>
            l.family.toLowerCase().includes(query) ||
            (l.subfamily?.toLowerCase().includes(query) ?? false)
          )
          if (matches.length === 0) return `No languages found in family "${query}". Available families: ${[...new Set(LANGUAGES.map(l => l.family))].join(', ')}`
          const parts = [`## Languages in "${query}" family\n`]
          parts.push(`**Count**: ${matches.length}\n`)
          for (const m of matches) {
            parts.push(`- **${m.name}** — ${m.wordOrder}, ${m.morphologicalType}, ${m.speakers}`)
          }
          return parts.join('\n')
        }

        case 'feature': {
          const parts: string[] = [`## Feature Search: "${query}"\n`]
          // Search across all properties
          const matches = LANGUAGES.filter(l =>
            l.wordOrder.toLowerCase().includes(query) ||
            l.morphologicalType.toLowerCase().includes(query) ||
            l.writingSystem.toLowerCase().includes(query) ||
            l.caseSystem.toLowerCase().includes(query) ||
            (query === 'tonal' && l.tonal) ||
            (query === 'non-tonal' && !l.tonal) ||
            (query === 'isolating' && l.morphologicalType === 'isolating') ||
            (query === 'agglutinative' && l.morphologicalType.includes('agglutinative')) ||
            (query === 'fusional' && l.morphologicalType.includes('fusional')) ||
            (query === 'polysynthetic' && l.morphologicalType.includes('polysynthetic'))
          )
          if (matches.length === 0) return `No languages found with feature "${query}". Try: SOV, SVO, tonal, agglutinative, fusional, isolating, polysynthetic, Cyrillic, Latin...`
          parts.push(`**Matching languages**: ${matches.length}\n`)
          for (const m of matches) {
            parts.push(`- **${m.name}** (${m.family}) — ${m.wordOrder}, ${m.morphologicalType}`)
          }
          return parts.join('\n')
        }

        case 'comparison': {
          const names = query.split(/[,;&]/).map(s => s.trim().toLowerCase())
          const matches = names.map(n => LANGUAGES.find(l => l.name.toLowerCase().includes(n))).filter(Boolean) as LanguageData[]
          if (matches.length < 2) return `Need at least 2 languages for comparison. Found: ${matches.map(m => m.name).join(', ')}`

          const parts = [`## Language Comparison\n`]
          const header = '| Feature | ' + matches.map(m => m.name).join(' | ') + ' |'
          const sep = '|---------|' + matches.map(() => '---').join('|') + '|'
          parts.push(header)
          parts.push(sep)
          parts.push(`| Family | ${matches.map(m => m.family).join(' | ')} |`)
          parts.push(`| Word order | ${matches.map(m => m.wordOrder).join(' | ')} |`)
          parts.push(`| Morphology | ${matches.map(m => m.morphologicalType).join(' | ')} |`)
          parts.push(`| Writing | ${matches.map(m => m.writingSystem).join(' | ')} |`)
          parts.push(`| Phonemes | ${matches.map(m => '~' + m.phonemeCount).join(' | ')} |`)
          parts.push(`| Tonal | ${matches.map(m => m.tonal ? 'Yes' : 'No').join(' | ')} |`)
          parts.push(`| Case system | ${matches.map(m => m.caseSystem).join(' | ')} |`)
          parts.push(`| Speakers | ${matches.map(m => m.speakers).join(' | ')} |`)
          return parts.join('\n')
        }

        default:
          return `Unknown search type "${searchType}". Use: language, family, feature, comparison.`
      }
    },
  })

  // ── 7. phonetics_ipa ──────────────────────────────────────────────────

  registerTool({
    name: 'phonetics_ipa',
    description: 'IPA (International Phonetic Alphabet) tools: look up symbols by description, describe articulatory features, transcribe common English words, compare phoneme inventories. Embeds the full IPA consonant and vowel charts.',
    parameters: {
      query: { type: 'string', description: 'IPA symbol, description, English word, or language names to compare', required: true },
      operation: { type: 'string', description: 'Operation: lookup, describe, transcribe, compare', required: true },
    },
    tier: 'free',
    async execute(args) {
      const query = String(args.query).toLowerCase().trim()
      const operation = String(args.operation || 'lookup').toLowerCase()

      switch (operation) {
        case 'lookup': {
          // Search by description
          const matches = IPA_CHART.filter(s =>
            s.description.toLowerCase().includes(query) ||
            s.place?.toLowerCase().includes(query) ||
            s.manner?.toLowerCase().includes(query) ||
            s.voicing?.toLowerCase().includes(query) ||
            s.height?.toLowerCase().includes(query) ||
            s.backness?.toLowerCase().includes(query)
          )
          if (matches.length === 0) return `No IPA symbols found for "${query}". Try: bilabial, fricative, voiceless, close, front, rounded...`
          const parts = [`## IPA Lookup: "${query}"\n`]
          parts.push(`**${matches.length} symbols found:**\n`)
          for (const m of matches) {
            let detail = `- **[${m.symbol}]** — ${m.description}`
            if (m.type === 'consonant') {
              detail += ` (${m.voicing} ${m.place} ${m.manner})`
            } else if (m.type === 'vowel') {
              detail += ` (${m.height} ${m.backness}${m.rounded ? ' rounded' : ' unrounded'})`
            }
            parts.push(detail)
          }
          return parts.join('\n')
        }

        case 'describe': {
          // Look up specific symbol(s)
          const symbols = [...query]
          // Also handle multi-char symbols
          const found: IPASymbol[] = []
          let i = 0
          while (i < query.length) {
            // Try 2-char match first
            const twoChar = query.slice(i, i + 2)
            const match2 = IPA_CHART.find(s => s.symbol === twoChar)
            if (match2) { found.push(match2); i += 2; continue }
            // Single char
            const match1 = IPA_CHART.find(s => s.symbol === query[i])
            if (match1) found.push(match1)
            i++
          }
          if (found.length === 0) return `No IPA symbol recognized for "${query}". Enter an IPA symbol (e.g., ʃ, ŋ, ə, θ).`
          const parts = [`## IPA Description\n`]
          for (const s of found) {
            parts.push(`### [${s.symbol}]`)
            parts.push(`**Description**: ${s.description}`)
            parts.push(`**Type**: ${s.type}`)
            if (s.type === 'consonant') {
              parts.push(`**Place**: ${s.place}`)
              parts.push(`**Manner**: ${s.manner}`)
              parts.push(`**Voicing**: ${s.voicing}`)
            } else if (s.type === 'vowel') {
              parts.push(`**Height**: ${s.height}`)
              parts.push(`**Backness**: ${s.backness}`)
              parts.push(`**Rounded**: ${s.rounded ? 'yes' : 'no'}`)
            }
            parts.push('')
          }
          return parts.join('\n')
        }

        case 'transcribe': {
          const words = query.split(/[\s,]+/).filter(w => w.length > 0)
          const parts = [`## IPA Transcription (General American English)\n`]
          parts.push('| Word | IPA |')
          parts.push('|------|-----|')
          for (const word of words) {
            const ipa = ENGLISH_IPA[word.toLowerCase()]
            if (ipa) {
              parts.push(`| ${word} | /${ipa}/ |`)
            } else {
              parts.push(`| ${word} | *(not in dictionary — ${Object.keys(ENGLISH_IPA).length} common words available)* |`)
            }
          }
          return parts.join('\n')
        }

        case 'compare': {
          // Compare phoneme inventories of languages
          const names = query.split(/[,;&]/).map(s => s.trim().toLowerCase())
          const langs = names
            .map(n => LANGUAGES.find(l => l.name.toLowerCase().includes(n)))
            .filter(Boolean) as LanguageData[]
          if (langs.length < 2) return `Need at least 2 languages. Found: ${langs.map(l => l.name).join(', ')}. Try: "english, japanese" or "mandarin, thai, vietnamese".`
          const parts = [`## Phoneme Inventory Comparison\n`]
          parts.push('| Language | Phonemes | Tonal | Family |')
          parts.push('|----------|----------|-------|--------|')
          for (const l of langs) {
            parts.push(`| ${l.name} | ~${l.phonemeCount} | ${l.tonal ? 'Yes' : 'No'} | ${l.family} |`)
          }
          parts.push('')
          const maxPhonemes = Math.max(...langs.map(l => l.phonemeCount))
          const minPhonemes = Math.min(...langs.map(l => l.phonemeCount))
          parts.push(`**Range**: ${minPhonemes} – ${maxPhonemes} phonemes`)
          parts.push(`**Tonal languages**: ${langs.filter(l => l.tonal).map(l => l.name).join(', ') || 'none'}`)
          return parts.join('\n')
        }

        default:
          return `Unknown operation "${operation}". Use: lookup, describe, transcribe, compare.`
      }
    },
  })

  // ── 8. text_stylometry ────────────────────────────────────────────────

  registerTool({
    name: 'text_stylometry',
    description: 'Author attribution and style analysis: sentence length, vocabulary richness (Yule\'s K, hapax ratio), function word frequencies, punctuation patterns, and Burrows\' Delta for author comparison.',
    parameters: {
      texts: { type: 'string', description: 'JSON array of {label, text} objects', required: true },
      operation: { type: 'string', description: 'Operation: profile, compare, delta', required: true },
    },
    tier: 'free',
    async execute(args) {
      let texts: { label: string; text: string }[]
      try {
        texts = JSON.parse(String(args.texts))
        if (!Array.isArray(texts)) throw new Error('Must be an array')
      } catch (err) {
        return `Error parsing texts JSON: ${err instanceof Error ? err.message : String(err)}\n\nExpected format: [{"label": "Author A", "text": "..."}]`
      }

      if (texts.length === 0) return 'Error: No texts provided.'

      const operation = String(args.operation || 'profile').toLowerCase()
      const profiles = texts.map(t => profileText(t.label, t.text))

      switch (operation) {
        case 'profile': {
          const parts = ['## Stylometric Profiles\n']
          for (const p of profiles) {
            parts.push(formatProfile(p))
            parts.push('')
          }
          return parts.join('\n')
        }

        case 'compare': {
          if (profiles.length < 2) return 'Need at least 2 texts for comparison.'
          const parts = ['## Stylometric Comparison\n']

          // Comparison table
          const header = '| Metric | ' + profiles.map(p => `"${p.label}"`.slice(0, 15)).join(' | ') + ' |'
          const sep = '|--------|' + profiles.map(() => '---').join('|') + '|'
          parts.push(header)
          parts.push(sep)
          parts.push(`| Tokens | ${profiles.map(p => p.tokenCount.toString()).join(' | ')} |`)
          parts.push(`| Types | ${profiles.map(p => p.typeCount.toString()).join(' | ')} |`)
          parts.push(`| Avg sentence len | ${profiles.map(p => p.avgSentenceLength.toFixed(1)).join(' | ')} |`)
          parts.push(`| Avg word len | ${profiles.map(p => p.avgWordLength.toFixed(2)).join(' | ')} |`)
          parts.push(`| TTR | ${profiles.map(p => p.ttr.toFixed(4)).join(' | ')} |`)
          parts.push(`| Hapax ratio | ${profiles.map(p => p.hapaxRatio.toFixed(4)).join(' | ')} |`)
          parts.push(`| Yule's K | ${profiles.map(p => p.yulesK.toFixed(2)).join(' | ')} |`)
          return parts.join('\n')
        }

        case 'delta': {
          return burrowsDelta(profiles)
        }

        default:
          return `Unknown operation "${operation}". Use: profile, compare, delta.`
      }
    },
  })

  // ── 9. philosophical_concept ──────────────────────────────────────────

  registerTool({
    name: 'philosophical_concept',
    description: 'Encyclopedia of ~80 key philosophical concepts with branch, period, key thinkers, definition, related concepts, and arguments for/against. Search by concept, thinker, or branch.',
    parameters: {
      query: { type: 'string', description: 'Concept name, thinker name, or branch (metaphysics/epistemology/ethics/logic/aesthetics/political)', required: true },
      search_type: { type: 'string', description: 'Search type: concept, thinker, branch', required: true },
    },
    tier: 'free',
    async execute(args) {
      const query = String(args.query).toLowerCase()
      const searchType = String(args.search_type || 'concept').toLowerCase()

      const formatConcept = (c: PhilosophicalConcept): string => {
        return [
          `### ${c.name}`,
          `*${c.branch} — ${c.period}*\n`,
          `**Key thinkers**: ${c.thinkers.join(', ')}\n`,
          `**Definition**: ${c.definition}\n`,
          `**Related concepts**: ${c.relatedConcepts.join(', ')}\n`,
          '**Arguments for**:',
          ...c.argumentsFor.map(a => `- ${a}`),
          '',
          '**Arguments against**:',
          ...c.argumentsAgainst.map(a => `- ${a}`),
        ].join('\n')
      }

      switch (searchType) {
        case 'concept': {
          const matches = PHILOSOPHICAL_CONCEPTS.filter(c =>
            c.name.toLowerCase().includes(query) ||
            c.definition.toLowerCase().includes(query)
          )
          if (matches.length === 0) return `No concept found matching "${query}". Try: consciousness, utilitarianism, free will, empiricism, justice...`
          return `## Philosophical Concepts\n\n${matches.slice(0, 5).map(formatConcept).join('\n\n---\n\n')}`
        }

        case 'thinker': {
          const matches = PHILOSOPHICAL_CONCEPTS.filter(c =>
            c.thinkers.some(t => t.toLowerCase().includes(query))
          )
          if (matches.length === 0) return `No concepts found for thinker "${query}". Try: Kant, Aristotle, Hume, Rawls, Descartes...`
          const parts = [`## Concepts associated with "${query}"\n`]
          parts.push(`**${matches.length} concepts found:**\n`)
          for (const m of matches) {
            parts.push(`- **${m.name}** (${m.branch}) — ${m.definition.slice(0, 100)}...`)
          }
          parts.push('\n---\n')
          // Show first 3 in detail
          for (const m of matches.slice(0, 3)) {
            parts.push(formatConcept(m))
            parts.push('\n---\n')
          }
          return parts.join('\n')
        }

        case 'branch': {
          const matches = PHILOSOPHICAL_CONCEPTS.filter(c =>
            c.branch.toLowerCase().includes(query)
          )
          if (matches.length === 0) return `No concepts found in branch "${query}". Branches: metaphysics, epistemology, ethics, logic, aesthetics, political.`
          const parts = [`## ${query.charAt(0).toUpperCase() + query.slice(1)} — ${matches.length} concepts\n`]
          // Group by period
          const periods = [...new Set(matches.map(m => m.period))].sort()
          for (const period of periods) {
            const periodMatches = matches.filter(m => m.period === period)
            parts.push(`### ${period}`)
            for (const m of periodMatches) {
              parts.push(`- **${m.name}** (${m.thinkers.slice(0, 3).join(', ')}) — ${m.definition.slice(0, 80)}...`)
            }
            parts.push('')
          }
          return parts.join('\n')
        }

        default:
          return `Unknown search type "${searchType}". Use: concept, thinker, branch.`
      }
    },
  })

  // ── 10. archival_search ────────────────────────────────────────────────

  registerTool({
    name: 'archival_search',
    description: 'Search digital archives and open-access historical collections: Internet Archive, Digital Public Library of America (DPLA), Europeana. Returns titles, descriptions, dates, and links.',
    parameters: {
      query: { type: 'string', description: 'Search query for archival materials', required: true },
      source: { type: 'string', description: 'Source: all, internet_archive, dpla, europeana' },
      media_type: { type: 'string', description: 'Media type: text, image, audio, all' },
    },
    tier: 'free',
    async execute(args) {
      const query = String(args.query)
      const source = String(args.source || 'all').toLowerCase()
      const mediaType = String(args.media_type || 'all').toLowerCase()

      const parts: string[] = [`## Archival Search: "${query}"\n`]
      const errors: string[] = []

      // Internet Archive
      if (source === 'all' || source === 'internet_archive') {
        try {
          const encoded = encodeURIComponent(query)
          const mtFilter = mediaType !== 'all' ? `&fl[]=mediatype&mediatype=${encodeURIComponent(mediaType === 'text' ? 'texts' : mediaType)}` : ''
          const url = `https://archive.org/advancedsearch.php?q=${encoded}${mtFilter}&output=json&rows=5&fl[]=identifier&fl[]=title&fl[]=description&fl[]=date&fl[]=mediatype&fl[]=creator`
          const res = await fetch(url, {
            headers: { 'User-Agent': 'KBot/3.0 (Archival Search)' },
            signal: AbortSignal.timeout(10000),
          })
          if (res.ok) {
            const data = await res.json() as { response?: { docs?: Array<{ identifier?: string; title?: string; description?: string | string[]; date?: string; mediatype?: string; creator?: string }> } }
            const docs = data.response?.docs || []
            if (docs.length > 0) {
              parts.push('### Internet Archive\n')
              for (const doc of docs) {
                const title = doc.title || 'Untitled'
                const id = doc.identifier || ''
                const date = doc.date || 'n.d.'
                const creator = doc.creator || 'Unknown'
                const desc = Array.isArray(doc.description)
                  ? (doc.description[0] || '').slice(0, 150)
                  : (doc.description || '').slice(0, 150)
                const link = id ? `https://archive.org/details/${id}` : ''
                parts.push(`**${title}**`)
                parts.push(`*${creator}* — ${date} | ${doc.mediatype || 'unknown'}`)
                if (desc) parts.push(`> ${desc}${desc.length >= 150 ? '...' : ''}`)
                if (link) parts.push(`[View on Internet Archive](${link})`)
                parts.push('')
              }
            } else {
              parts.push('### Internet Archive\nNo results found.\n')
            }
          }
        } catch (err) {
          errors.push(`Internet Archive: ${err instanceof Error ? err.message : 'timeout or network error'}`)
        }
      }

      // DPLA
      if (source === 'all' || source === 'dpla') {
        try {
          const encoded = encodeURIComponent(query)
          const url = `https://api.dp.la/v2/items?q=${encoded}&page_size=5&api_key=`
          // DPLA requires an API key but has a public demo endpoint
          const res = await fetch(url, {
            headers: { 'User-Agent': 'KBot/3.0 (Archival Search)' },
            signal: AbortSignal.timeout(10000),
          })
          if (res.ok) {
            const data = await res.json() as { docs?: Array<{ sourceResource?: { title?: string | string[]; description?: string | string[]; date?: { displayDate?: string }[]; creator?: string[] }; isShownAt?: string; provider?: { name?: string } }> }
            const docs = data.docs || []
            if (docs.length > 0) {
              parts.push('### Digital Public Library of America (DPLA)\n')
              for (const doc of docs) {
                const sr = doc.sourceResource || {}
                const title = Array.isArray(sr.title) ? sr.title[0] : (sr.title || 'Untitled')
                const desc = Array.isArray(sr.description)
                  ? (sr.description[0] || '').slice(0, 150)
                  : (sr.description || '').slice(0, 150)
                const date = sr.date?.[0]?.displayDate || 'n.d.'
                const creator = sr.creator?.join(', ') || 'Unknown'
                const link = doc.isShownAt || ''
                const provider = doc.provider?.name || ''
                parts.push(`**${title}**`)
                parts.push(`*${creator}* — ${date}${provider ? ' | ' + provider : ''}`)
                if (desc) parts.push(`> ${desc}${desc.length >= 150 ? '...' : ''}`)
                if (link) parts.push(`[View source](${link})`)
                parts.push('')
              }
            } else {
              parts.push('### DPLA\nNo results found.\n')
            }
          }
        } catch (err) {
          errors.push(`DPLA: ${err instanceof Error ? err.message : 'timeout or network error'}`)
        }
      }

      // Europeana
      if (source === 'all' || source === 'europeana') {
        try {
          const encoded = encodeURIComponent(query)
          // Europeana REST API (public key available)
          const url = `https://api.europeana.eu/record/v2/search.json?query=${encoded}&rows=5&profile=standard&wskey=api2demo`
          const res = await fetch(url, {
            headers: { 'User-Agent': 'KBot/3.0 (Archival Search)' },
            signal: AbortSignal.timeout(10000),
          })
          if (res.ok) {
            const data = await res.json() as { items?: Array<{ title?: string[]; dcDescription?: string[]; year?: string[]; dcCreator?: string[]; guid?: string; dataProvider?: string[]; type?: string }> }
            const items = data.items || []
            if (items.length > 0) {
              parts.push('### Europeana\n')
              for (const item of items) {
                const title = item.title?.[0] || 'Untitled'
                const desc = (item.dcDescription?.[0] || '').slice(0, 150)
                const year = item.year?.[0] || 'n.d.'
                const creator = item.dcCreator?.[0] || 'Unknown'
                const link = item.guid || ''
                const provider = item.dataProvider?.[0] || ''
                parts.push(`**${title}**`)
                parts.push(`*${creator}* — ${year}${provider ? ' | ' + provider : ''} | ${item.type || ''}`)
                if (desc) parts.push(`> ${desc}${desc.length >= 150 ? '...' : ''}`)
                if (link) parts.push(`[View on Europeana](${link})`)
                parts.push('')
              }
            } else {
              parts.push('### Europeana\nNo results found.\n')
            }
          }
        } catch (err) {
          errors.push(`Europeana: ${err instanceof Error ? err.message : 'timeout or network error'}`)
        }
      }

      if (errors.length > 0) {
        parts.push('---\n**Errors**:')
        for (const e of errors) parts.push(`- ${e}`)
      }

      if (parts.length <= 2) {
        parts.push('No results found from any source. Try broadening your search terms.')
      }

      return parts.join('\n')
    },
  })
}
