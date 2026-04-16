// train-cycle — on-policy distillation loop (DeepSeek-R1 Distill pattern).
//
// Loop:
//   1. Sample N prompts from held-out pool (~/.kbot/teacher/prompts.jsonl)
//   2. Student (local model) generates response
//   3. Teacher (Claude) grades; if bad, teacher writes a corrected response
//   4. Pairs go back into ~/.kbot/teacher/corrections.jsonl
//   5. Optionally retrain via train-self --mode default (with corrections merged)
//
// Designed to run as a weekly cron or on-demand.

import { existsSync, readFileSync, writeFileSync, appendFileSync } from 'node:fs'
import { join } from 'node:path'
import { homedir } from 'node:os'

export interface TrainCycleOptions {
  studentModel?: string              // e.g. "kernel-coder-self:v..." (Ollama)
  teacherProvider?: 'anthropic' | 'openai'
  teacherModel?: string              // default: claude-opus-4-6
  promptsFile?: string               // default: ~/.kbot/teacher/prompts.jsonl
  corrections?: string               // default: ~/.kbot/teacher/corrections.jsonl
  samples?: number                   // default 50
  passThreshold?: number             // teacher score 0..1; below this, correct
  retrain?: boolean                  // after cycle, run train-self with corrections merged
  dryRun?: boolean
}

export interface CycleResult {
  sampled: number
  passed: number
  corrected: number
  skipped: number
  corrections_file: string
  retrain_summary?: string
}

interface PromptLine {
  prompt: string
  system?: string
  expected?: string
}

function readPrompts(file: string): PromptLine[] {
  if (!existsSync(file)) return []
  return readFileSync(file, 'utf-8')
    .split('\n')
    .filter(l => l.trim())
    .map(l => { try { return JSON.parse(l) as PromptLine } catch { return null } })
    .filter((x): x is PromptLine => x !== null && typeof x.prompt === 'string')
}

/** Auto-harvest prompts from teacher/traces.jsonl (user messages) if no explicit file. */
function harvestPrompts(limit = 200): PromptLine[] {
  const traceFile = join(homedir(), '.kbot', 'teacher', 'traces.jsonl')
  if (!existsSync(traceFile)) return []
  const lines = readFileSync(traceFile, 'utf-8').split('\n').filter(l => l.trim())
  const out: PromptLine[] = []
  for (const line of lines.slice(-limit * 2)) {
    try {
      const t = JSON.parse(line)
      const msgs = t.messages as Array<{ role: string; content: string }> | undefined
      const firstUser = msgs?.find(m => m.role === 'user')
      if (firstUser && firstUser.content.length > 20 && firstUser.content.length < 2000) {
        out.push({ prompt: firstUser.content, system: t.system })
      }
      if (out.length >= limit) break
    } catch { /* skip */ }
  }
  return out
}

async function callOllama(model: string, system: string, prompt: string): Promise<string> {
  const res = await fetch('http://localhost:11434/api/chat', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model,
      stream: false,
      messages: [
        ...(system ? [{ role: 'system', content: system }] : []),
        { role: 'user', content: prompt },
      ],
      options: { num_predict: 2048, temperature: 0.2 },
    }),
    signal: AbortSignal.timeout(300_000),
  })
  if (!res.ok) throw new Error(`Ollama HTTP ${res.status}`)
  const data = await res.json() as { message?: { content?: string } }
  return data.message?.content || ''
}

async function callAnthropicGrade(
  apiKey: string,
  teacherModel: string,
  system: string,
  prompt: string,
  studentResponse: string,
): Promise<{ score: number; correction?: string; rationale: string }> {
  const gradePrompt = `You are grading a student AI's response. Score 0.0–1.0 based on correctness, completeness, and helpfulness.

If the response scores below 0.6, provide a corrected response.

Return ONLY valid JSON in this exact shape:
{"score": <number>, "rationale": "<one sentence>", "correction": "<corrected response or empty string>"}

ORIGINAL PROMPT:
${prompt.slice(0, 4000)}

STUDENT RESPONSE:
${studentResponse.slice(0, 6000)}`

  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model: teacherModel,
      max_tokens: 4096,
      system: system || 'You are a strict code/AI grader.',
      messages: [{ role: 'user', content: gradePrompt }],
    }),
    signal: AbortSignal.timeout(120_000),
  })
  if (!res.ok) throw new Error(`Anthropic HTTP ${res.status}`)
  const data = await res.json() as { content?: Array<{ type: string; text?: string }> }
  const text = (data.content || []).filter(b => b.type === 'text').map(b => b.text).join('')
  // Extract JSON from response
  const jsonMatch = text.match(/\{[\s\S]*\}/)
  if (!jsonMatch) return { score: 0, rationale: 'no JSON in response', correction: undefined }
  try {
    const parsed = JSON.parse(jsonMatch[0]) as { score?: number; rationale?: string; correction?: string }
    return {
      score: typeof parsed.score === 'number' ? parsed.score : 0,
      rationale: parsed.rationale || '',
      correction: parsed.correction || undefined,
    }
  } catch {
    return { score: 0, rationale: 'JSON parse failed', correction: undefined }
  }
}

export async function runCycle(opts: TrainCycleOptions = {}): Promise<CycleResult> {
  const studentModel = opts.studentModel ?? 'kernel-coder:latest'
  const teacherProvider = opts.teacherProvider ?? 'anthropic'
  const teacherModel = opts.teacherModel ?? 'claude-opus-4-6'
  const promptsFile = opts.promptsFile ?? join(homedir(), '.kbot', 'teacher', 'prompts.jsonl')
  const correctionsFile = opts.corrections ?? join(homedir(), '.kbot', 'teacher', 'corrections.jsonl')
  const samples = opts.samples ?? 50
  const threshold = opts.passThreshold ?? 0.6

  let prompts = readPrompts(promptsFile)
  if (prompts.length === 0) prompts = harvestPrompts(samples * 3)
  if (prompts.length === 0) {
    return {
      sampled: 0, passed: 0, corrected: 0, skipped: 0,
      corrections_file: correctionsFile,
    }
  }

  // Shuffle + take N
  prompts = prompts.sort(() => Math.random() - 0.5).slice(0, samples)

  let passed = 0, corrected = 0, skipped = 0

  // Pull teacher API key
  let teacherKey = ''
  if (teacherProvider === 'anthropic') {
    teacherKey = process.env.ANTHROPIC_API_KEY || ''
    if (!teacherKey) {
      try {
        const cfg = JSON.parse(readFileSync(join(homedir(), '.kbot', 'config.json'), 'utf-8')) as Record<string, unknown>
        teacherKey = (cfg.anthropic_api_key as string) || (cfg.anthropicApiKey as string) || ''
      } catch { /* no config */ }
    }
    if (!teacherKey) throw new Error('No Anthropic API key for teacher. Set ANTHROPIC_API_KEY or run `kbot auth`.')
  }

  for (const p of prompts) {
    try {
      const studentResp = await callOllama(studentModel, p.system || '', p.prompt)
      if (!studentResp || studentResp.length < 20) { skipped++; continue }
      if (opts.dryRun) {
        passed++
        continue
      }
      const grade = await callAnthropicGrade(teacherKey, teacherModel, p.system || '', p.prompt, studentResp)
      if (grade.score >= threshold) {
        passed++
        // Keep good student responses as training examples too
        appendFileSync(correctionsFile, JSON.stringify({
          messages: [
            ...(p.system ? [{ role: 'system', content: p.system }] : []),
            { role: 'user', content: p.prompt },
            { role: 'assistant', content: studentResp },
          ],
          _score: grade.score,
          _source: 'student_passed',
        }) + '\n')
      } else if (grade.correction) {
        corrected++
        appendFileSync(correctionsFile, JSON.stringify({
          messages: [
            ...(p.system ? [{ role: 'system', content: p.system }] : []),
            { role: 'user', content: p.prompt },
            { role: 'assistant', content: grade.correction },
          ],
          _score: 1.0,
          _source: 'teacher_corrected',
          _student_score: grade.score,
          _rationale: grade.rationale,
        }) + '\n')
      } else {
        skipped++
      }
    } catch {
      skipped++
    }
  }

  let retrainSummary: string | undefined
  if (opts.retrain && !opts.dryRun) {
    const { trainSelf, formatTrainSelfReport } = await import('./train-self.js')
    // Merge corrections into next dataset: curator picks them up from ~/.kbot/teacher/
    const r = await trainSelf({ mode: 'default' })
    retrainSummary = formatTrainSelfReport(r)
  }

  return {
    sampled: prompts.length,
    passed,
    corrected,
    skipped,
    corrections_file: correctionsFile,
    retrain_summary: retrainSummary,
  }
}

export function formatCycleReport(r: CycleResult): string {
  const lines = [
    'train-cycle',
    '─'.repeat(40),
    `  Sampled:      ${r.sampled}`,
    `  Passed:       ${r.passed}  (student got it right)`,
    `  Corrected:    ${r.corrected}  (teacher rewrote)`,
    `  Skipped:      ${r.skipped}`,
    `  Corrections:  ${r.corrections_file}`,
  ]
  if (r.retrain_summary) {
    lines.push('', 'Retrain:', r.retrain_summary)
  }
  return lines.join('\n')
}
