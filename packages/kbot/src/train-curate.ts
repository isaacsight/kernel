// Training data curator — reads teacher traces and ~/.kbot/observer/session.jsonl,
// scores + filters examples, emits a clean JSONL ready for fine-tuning.
//
// Scoring signals:
//   + response length is reasonable (100–8000 tokens)
//   + contained a thinking block (for reasoning distill)
//   + tool calls had no error results
//   + outcome.verified === true (if tagged)
//   − user retried or gave negative feedback
//   − response contained "I don't know" / "I can't help"
//   − near-duplicate of another example (hash-based)

import { existsSync, mkdirSync, readFileSync, writeFileSync, appendFileSync, readdirSync, statSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { homedir } from 'node:os'
import { createHash } from 'node:crypto'

export type CurateMode = 'default' | 'reasoning' | 'agent-trace' | 'code-only'

export interface CurateOptions {
  sources?: string[]                  // jsonl files; defaults to teacher + observer
  output?: string                     // output path; defaults to ~/.kbot/teacher/dataset.jsonl
  mode?: CurateMode
  maxExamples?: number                // cap; default 5000
  minScore?: number                   // 0..1; default 0.5
  minResponseLen?: number             // chars; default 80
  maxResponseLen?: number             // chars; default 32000
  dedupe?: boolean                    // default true
}

interface Example {
  messages: Array<{ role: string; content: string }>
  thinking?: string
  tool_calls?: unknown[]
  outcome?: { verified: boolean; signal?: string; score?: number }
  meta?: Record<string, unknown>
}

interface ScoredExample extends Example {
  score: number
  hash: string
  reasons: string[]
}

const NEG_PATTERNS = [
  /\bi (don'?t|do not) (know|have that|have access)\b/i,
  /\bi (can'?t|cannot) (help|assist|do)\b/i,
  /\bas an ai\b/i,
  /\bi'?m sorry,? but\b/i,
  /\bi apologi[sz]e\b/i,
]

function hashText(text: string): string {
  return createHash('sha256').update(text.slice(0, 2000).toLowerCase().replace(/\s+/g, ' ').trim()).digest('hex').slice(0, 16)
}

function scoreExample(ex: Example, mode: CurateMode): { score: number; reasons: string[] } {
  let score = 0.5
  const reasons: string[] = []

  const lastAssistant = [...ex.messages].reverse().find(m => m.role === 'assistant')?.content || ''
  const lastUser = [...ex.messages].reverse().find(m => m.role === 'user')?.content || ''
  const respLen = lastAssistant.length

  // Length signal
  if (respLen >= 200 && respLen <= 8000) { score += 0.15; reasons.push('good_length') }
  if (respLen < 80) { score -= 0.3; reasons.push('too_short') }
  if (respLen > 16000) { score -= 0.15; reasons.push('too_long') }

  // Refusal / low-effort signal
  for (const pat of NEG_PATTERNS) {
    if (pat.test(lastAssistant)) { score -= 0.25; reasons.push('refusal_like'); break }
  }

  // Mode-specific scoring
  if (mode === 'reasoning') {
    if (ex.thinking && ex.thinking.length > 100) { score += 0.25; reasons.push('has_thinking') }
    else { score -= 0.2; reasons.push('no_thinking') }
  }

  if (mode === 'agent-trace') {
    if (ex.tool_calls && (ex.tool_calls as unknown[]).length > 0) { score += 0.25; reasons.push('has_tool_calls') }
    else { score -= 0.3; reasons.push('no_tool_calls') }
  }

  if (mode === 'code-only') {
    if (/```[a-zA-Z]+/.test(lastAssistant)) { score += 0.15; reasons.push('has_code_block') }
    if (/\b(function|class|import|const|def|fn )\b/.test(lastAssistant)) { score += 0.1; reasons.push('code_keywords') }
  }

  // Outcome-tagged verified example
  if (ex.outcome?.verified) { score += 0.3; reasons.push('verified') }
  if (ex.outcome?.signal === 'user_retry') { score -= 0.4; reasons.push('user_retried') }
  if (ex.outcome?.signal === 'build_pass' || ex.outcome?.signal === 'test_pass') {
    score += 0.35; reasons.push(ex.outcome.signal)
  }

  // Interaction quality
  if (lastUser.length > 20 && lastUser.length < 4000) { score += 0.05; reasons.push('good_prompt_len') }

  return { score: Math.max(0, Math.min(1, score)), reasons }
}

/** Parse a single line from teacher/traces.jsonl into a normalized Example. */
function parseTeacherLine(line: string): Example | null {
  try {
    const t = JSON.parse(line) as Record<string, unknown>
    const messages = (t.messages as Array<{ role: string; content: string }> | undefined) || []
    const response = t.response as { content?: string; thinking?: string; tool_calls?: unknown[] } | undefined
    if (!response?.content || messages.length === 0) return null
    return {
      messages: [...messages, { role: 'assistant', content: response.content }],
      thinking: response.thinking,
      tool_calls: response.tool_calls,
      outcome: t.outcome as Example['outcome'],
      meta: { source: 'teacher', provider: t.provider, model: t.model, ts: t.ts },
    }
  } catch {
    return null
  }
}

/** Parse ~/.kbot/observer/session.jsonl. Shape varies; be permissive. */
function parseObserverLine(line: string): Example | null {
  try {
    const o = JSON.parse(line) as Record<string, unknown>
    // Expected fields: input/output or user/assistant or prompt/response
    const user = (o.input || o.user || o.prompt || o.query) as string | undefined
    const assistant = (o.output || o.assistant || o.response || o.answer) as string | undefined
    if (!user || !assistant || typeof user !== 'string' || typeof assistant !== 'string') return null
    return {
      messages: [
        { role: 'user', content: user },
        { role: 'assistant', content: assistant },
      ],
      meta: { source: 'observer', ts: o.ts },
    }
  } catch {
    return null
  }
}

// ── Claude Code session parser (seed corpus) ─────────────────────────
// ~/.claude/projects/<slug>/<uuid>.jsonl records each turn as a JSON line with
// { type: 'user' | 'assistant', message: { role, content } }.  Content is
// either a string (user) or an array of {type:'text',text} blocks (assistant).

interface ClaudeCodeTurn {
  type: string
  message?: { role?: string; content?: string | Array<{ type: string; text?: string }> }
  sessionId?: string
}

function extractContent(raw: unknown): string {
  if (typeof raw === 'string') return raw
  if (Array.isArray(raw)) {
    return raw.map(b => (b && typeof b === 'object' && 'text' in b) ? String((b as { text?: string }).text || '') : '').join('\n')
  }
  return ''
}

function parseClaudeCodeFile(filePath: string): Example[] {
  let lines: string[]
  try { lines = readFileSync(filePath, 'utf-8').split('\n').filter(l => l.trim()) }
  catch { return [] }
  const out: Example[] = []
  let pendingUser: string | null = null
  for (const line of lines) {
    let turn: ClaudeCodeTurn
    try { turn = JSON.parse(line) as ClaudeCodeTurn } catch { continue }
    if (turn.type === 'user' && turn.message) {
      const content = extractContent(turn.message.content)
      if (content.length > 10 && !content.startsWith('<tool_result')) pendingUser = content
    } else if (turn.type === 'assistant' && turn.message && pendingUser) {
      const content = extractContent(turn.message.content)
      if (content.length > 40) {
        out.push({
          messages: [
            { role: 'user', content: pendingUser },
            { role: 'assistant', content },
          ],
          meta: { source: 'claude-code', session: turn.sessionId, file: filePath },
        })
        pendingUser = null
      }
    }
  }
  return out
}

function findClaudeCodeSessions(limitFiles = 40, maxDepth = 4): string[] {
  const base = join(homedir(), '.claude', 'projects')
  if (!existsSync(base)) return []
  const files: Array<{ path: string; size: number }> = []
  function walk(dir: string, depth: number): void {
    if (depth > maxDepth) return
    let entries: string[]
    try { entries = readdirSync(dir) } catch { return }
    for (const entry of entries) {
      if (entry.startsWith('.') || entry === 'node_modules') continue
      const full = join(dir, entry)
      let st
      try { st = statSync(full) } catch { continue }
      if (st.isDirectory()) { walk(full, depth + 1); continue }
      if (entry.endsWith('.jsonl') && st.size > 2048) files.push({ path: full, size: st.size })
    }
  }
  try { walk(base, 0) } catch { return [] }
  files.sort((a, b) => b.size - a.size)
  return files.slice(0, limitFiles).map(f => f.path)
}

function defaultSources(includeClaudeCode = true): string[] {
  const home = homedir()
  const list = [
    join(home, '.kbot', 'teacher', 'traces.jsonl'),
    join(home, '.kbot', 'teacher', 'corrections.jsonl'),
    join(home, '.kbot', 'observer', 'session.jsonl'),
  ].filter(p => existsSync(p))
  if (includeClaudeCode) list.push(...findClaudeCodeSessions())
  return list
}

function readLines(file: string): string[] {
  try { return readFileSync(file, 'utf-8').split('\n').filter(l => l.trim().length > 0) }
  catch { return [] }
}

function parseSource(file: string): Example[] {
  if (file.includes('/.claude/projects/')) return parseClaudeCodeFile(file)
  const lines = readLines(file)
  if (file.includes('teacher') || file.includes('corrections')) return lines.map(parseTeacherLine).filter((x): x is Example => x !== null)
  if (file.includes('observer')) return lines.map(parseObserverLine).filter((x): x is Example => x !== null)
  const out: Example[] = []
  for (const line of lines) {
    const t = parseTeacherLine(line) || parseObserverLine(line)
    if (t) out.push(t)
  }
  return out
}

export interface CurateResult {
  output: string
  total_examined: number
  kept: number
  rejected: number
  duplicates: number
  mean_score: number
  by_source: Record<string, number>
}

/** Run the curator end-to-end. Returns a report. */
export function curate(opts: CurateOptions = {}): CurateResult {
  const mode: CurateMode = opts.mode ?? 'default'
  const sources = opts.sources ?? defaultSources()
  const output = resolve(opts.output ?? join(homedir(), '.kbot', 'teacher', `dataset-${mode}.jsonl`))
  const maxExamples = opts.maxExamples ?? 5000
  const minScore = opts.minScore ?? 0.5
  const minResp = opts.minResponseLen ?? 80
  const maxResp = opts.maxResponseLen ?? 32000
  const dedupe = opts.dedupe !== false

  const outDir = output.substring(0, output.lastIndexOf('/'))
  if (outDir && !existsSync(outDir)) mkdirSync(outDir, { recursive: true })

  const bySource: Record<string, number> = {}
  const all: ScoredExample[] = []
  const seen = new Set<string>()
  let total = 0
  let duplicates = 0

  for (const src of sources) {
    const examples = parseSource(src)
    bySource[src] = examples.length
    for (const ex of examples) {
      total++
      const lastAssistant = [...ex.messages].reverse().find(m => m.role === 'assistant')?.content || ''
      if (lastAssistant.length < minResp || lastAssistant.length > maxResp) continue
      const hash = hashText(ex.messages.map(m => m.content).join('|'))
      if (dedupe && seen.has(hash)) { duplicates++; continue }
      seen.add(hash)
      const { score, reasons } = scoreExample(ex, mode)
      if (score < minScore) continue
      all.push({ ...ex, score, hash, reasons })
    }
  }

  // Sort by score desc, cap
  all.sort((a, b) => b.score - a.score)
  const kept = all.slice(0, maxExamples)

  // Emit as JSONL with OpenAI-style {messages: [...]} format that train_prepare understands
  if (existsSync(output)) writeFileSync(output, '') // truncate
  for (const ex of kept) {
    const record: Record<string, unknown> = { messages: ex.messages }
    if (ex.thinking) record.thinking = ex.thinking
    if (ex.tool_calls) record.tool_calls = ex.tool_calls
    record._score = ex.score
    record._reasons = ex.reasons
    appendFileSync(output, JSON.stringify(record) + '\n')
  }

  const meanScore = kept.length > 0 ? kept.reduce((s, e) => s + e.score, 0) / kept.length : 0

  return {
    output,
    total_examined: total,
    kept: kept.length,
    rejected: total - kept.length - duplicates,
    duplicates,
    mean_score: Math.round(meanScore * 1000) / 1000,
    by_source: bySource,
  }
}

/** Format as a human-readable report */
export function formatCurateReport(r: CurateResult): string {
  const lines = [
    `Curate Report`,
    `${'─'.repeat(40)}`,
    `  Output:         ${r.output}`,
    `  Examined:       ${r.total_examined}`,
    `  Kept:           ${r.kept}`,
    `  Rejected:       ${r.rejected}`,
    `  Duplicates:     ${r.duplicates}`,
    `  Mean score:     ${r.mean_score.toFixed(3)}`,
    '',
    `  Sources:`,
  ]
  for (const [src, count] of Object.entries(r.by_source)) {
    lines.push(`    ${count.toString().padStart(6)}  ${src}`)
  }
  return lines.join('\n')
}
