#!/usr/bin/env npx tsx
// ═══════════════════════════════════════════════════════════════════════
// K:BOT Daemon — 24/7 background intelligence using local Ollama models
// 100% free. Zero API costs. Everything runs on your machine.
//
// Tasks:
//   1. Git diff review      — every 15min (if new commits)
//   2. i18n sync            — every 6 hours (translate missing keys)
//   3. Test coverage gaps   — every 12 hours (generate test scaffolds)
//   4. Code quality scan    — every 4 hours (review changed files)
//   5. Documentation gaps   — every 12 hours (generate JSDoc)
//   6. Embedding index      — every 8 hours (semantic search index)
//   7. Daily digest         — once per day (summarize changes)
//   8. Dream consolidation  — every 2 hours (memory consolidation via dream engine)
//   9. Morning briefing     — once per day (email summary of overnight data)
//
// Runs via macOS launchd every 15 minutes. Tasks self-schedule.
// ═══════════════════════════════════════════════════════════════════════

import { readFileSync, writeFileSync, existsSync, mkdirSync, readdirSync, statSync } from 'fs'
import { join, relative, basename, extname } from 'path'
import { execSync } from 'child_process'
import { createHash } from 'crypto'

// ── Constants ─────────────────────────────────────────────────────────

const OLLAMA_URL = 'http://localhost:11434'
const PROJECT_ROOT = join(import.meta.dirname, '..')
const REPORTS_DIR = join(PROJECT_ROOT, 'tools', 'daemon-reports')
const SRC_DIR = join(PROJECT_ROOT, 'src')
const LOCALES_DIR = join(PROJECT_ROOT, 'public', 'locales')
const STATE_FILE = join(REPORTS_DIR, 'state.json')
const LOG_FILE = join(REPORTS_DIR, 'daemon.log')

// Models — best local model for each task type (all free via Ollama)
// Custom Kernel personality models (built via tools/setup-kernel-models.sh)
// Falls back to base models if custom ones aren't available
const MODELS = {
  code: 'kernel-coder:latest',
  reasoning: 'deepseek-r1:14b',
  general: 'kernel:latest',
  embeddings: 'nomic-embed-text',
} as const

// Task intervals in milliseconds
const INTERVALS = {
  gitReview: 0,                    // Every run (if new commits)
  codeQuality: 4 * 60 * 60_000,   // 4 hours
  i18nSync: 6 * 60 * 60_000,      // 6 hours
  embeddings: 8 * 60 * 60_000,    // 8 hours
  testCoverage: 12 * 60 * 60_000, // 12 hours
  documentation: 12 * 60 * 60_000,// 12 hours
  dailyDigest: 24 * 60 * 60_000,  // 24 hours
  dreamConsolidation: 2 * 60 * 60_000,  // 2 hours
  morningBriefing: 24 * 60 * 60_000,   // 24 hours
} as const

// i18n languages (from src/i18n.ts)
const LANGUAGES = ['es', 'fr', 'de', 'pt', 'it', 'nl', 'ru', 'zh', 'zh-TW', 'ja', 'ko', 'ar', 'hi', 'tr', 'pl', 'sv', 'no', 'da', 'fi', 'fa', 'he', 'ur', 'ckb']
const NAMESPACES = ['common', 'home', 'auth', 'kernel', 'onboarding', 'panels', 'settings']

// Language display names for translation prompts
const LANG_NAMES: Record<string, string> = {
  es: 'Spanish', fr: 'French', de: 'German', pt: 'Portuguese', it: 'Italian',
  nl: 'Dutch', ru: 'Russian', zh: 'Simplified Chinese', 'zh-TW': 'Traditional Chinese',
  ja: 'Japanese', ko: 'Korean', ar: 'Arabic', hi: 'Hindi', tr: 'Turkish',
  pl: 'Polish', sv: 'Swedish', no: 'Norwegian', da: 'Danish', fi: 'Finnish',
  fa: 'Persian', he: 'Hebrew', ur: 'Urdu', ckb: 'Kurdish (Sorani)',
}

// ── Types ─────────────────────────────────────────────────────────────

interface DaemonState {
  lastProcessedCommit: string
  lastRunTimestamps: Record<string, string>
  embeddingIndex: Record<string, { hash: string; updatedAt: string }>
  i18nProgress: Record<string, string[]> // namespace -> completed languages
  stats: {
    totalRuns: number
    totalTokens: number
    lastOllamaStatus: 'up' | 'down'
    errorsToday: number
    lastErrorDate: string
  }
}

// ── Logging ───────────────────────────────────────────────────────────

function log(msg: string): void {
  const timestamp = new Date().toISOString().replace('T', ' ').slice(0, 19)
  const line = `[${timestamp}] ${msg}\n`
  try {
    // Rotate if log > 5MB
    if (existsSync(LOG_FILE)) {
      const size = statSync(LOG_FILE).size
      if (size > 5 * 1024 * 1024) {
        const old = LOG_FILE + '.old'
        if (existsSync(old)) writeFileSync(old, '') // clear old backup
        const content = readFileSync(LOG_FILE, 'utf8')
        writeFileSync(old, content)
        writeFileSync(LOG_FILE, '')
      }
    }
    writeFileSync(LOG_FILE, line, { flag: 'a' })
  } catch {
    // Logging should never crash the daemon
  }
  process.stdout.write(line)
}

// ── State Management ──────────────────────────────────────────────────

function loadState(): DaemonState {
  const defaults: DaemonState = {
    lastProcessedCommit: '',
    lastRunTimestamps: {},
    embeddingIndex: {},
    i18nProgress: {},
    stats: { totalRuns: 0, totalTokens: 0, lastOllamaStatus: 'down', errorsToday: 0, lastErrorDate: '' },
  }
  try {
    if (existsSync(STATE_FILE)) {
      const raw = JSON.parse(readFileSync(STATE_FILE, 'utf8'))
      return { ...defaults, ...raw, stats: { ...defaults.stats, ...raw.stats } }
    }
  } catch { /* corrupted state — start fresh */ }
  return defaults
}

function saveState(state: DaemonState): void {
  writeFileSync(STATE_FILE, JSON.stringify(state, null, 2))
}

function isDue(state: DaemonState, task: string, intervalMs: number): boolean {
  if (intervalMs === 0) return true // always run
  const last = state.lastRunTimestamps[task]
  if (!last) return true
  return Date.now() - new Date(last).getTime() >= intervalMs
}

function markDone(state: DaemonState, task: string): void {
  state.lastRunTimestamps[task] = new Date().toISOString()
}

// ── Utilities ─────────────────────────────────────────────────────────

function git(cmd: string): string {
  try {
    return execSync(`git ${cmd}`, { cwd: PROJECT_ROOT, encoding: 'utf8', timeout: 30_000 }).trim()
  } catch {
    return ''
  }
}

function contentHash(text: string): string {
  return createHash('md5').update(text).digest('hex').slice(0, 12)
}

function ensureDirs(): void {
  const dirs = ['git-reviews', 'i18n-sync', 'test-coverage', 'code-quality', 'documentation', 'embeddings', 'daily-digest', 'morning-briefing']
  for (const d of dirs) {
    const p = join(REPORTS_DIR, d)
    if (!existsSync(p)) mkdirSync(p, { recursive: true })
  }
}

function readSafe(path: string): string {
  try { return readFileSync(path, 'utf8') } catch { return '' }
}

function today(): string {
  return new Date().toISOString().slice(0, 10)
}

function flattenKeys(obj: Record<string, unknown>, prefix = ''): Record<string, string> {
  const result: Record<string, string> = {}
  for (const [k, v] of Object.entries(obj)) {
    const key = prefix ? `${prefix}.${k}` : k
    if (typeof v === 'object' && v !== null && !Array.isArray(v)) {
      Object.assign(result, flattenKeys(v as Record<string, unknown>, key))
    } else {
      result[key] = String(v)
    }
  }
  return result
}

function unflattenKeys(flat: Record<string, string>): Record<string, unknown> {
  const result: Record<string, unknown> = {}
  for (const [key, val] of Object.entries(flat)) {
    const parts = key.split('.')
    let curr = result
    for (let i = 0; i < parts.length - 1; i++) {
      if (!(parts[i] in curr) || typeof curr[parts[i]] !== 'object') {
        curr[parts[i]] = {}
      }
      curr = curr[parts[i]] as Record<string, unknown>
    }
    curr[parts[parts.length - 1]] = val
  }
  return result
}

// ── Ollama Client ─────────────────────────────────────────────────────

function assertLocalhost(url: string): void {
  const parsed = new URL(url)
  if (parsed.hostname !== 'localhost' && parsed.hostname !== '127.0.0.1') {
    throw new Error(`Security: daemon may only connect to localhost, not ${parsed.hostname}`)
  }
}

async function isOllamaRunning(): Promise<boolean> {
  try {
    const url = `${OLLAMA_URL}/api/tags`
    assertLocalhost(url)
    const res = await fetch(url, { signal: AbortSignal.timeout(5000) })
    return res.ok
  } catch {
    return false
  }
}

async function callOllama(prompt: string, opts: {
  model: string
  system?: string
  max_tokens?: number
}): Promise<{ content: string; tokens: number }> {
  const endpoint = `${OLLAMA_URL}/api/chat`
  assertLocalhost(endpoint)
  const res = await fetch(endpoint, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: opts.model,
      messages: [
        ...(opts.system ? [{ role: 'system', content: opts.system }] : []),
        { role: 'user', content: prompt },
      ],
      stream: false,
      options: { num_predict: opts.max_tokens ?? 2048 },
    }),
    signal: AbortSignal.timeout(300_000), // 5 min timeout
  })
  if (!res.ok) {
    const err = await res.text()
    throw new Error(`Ollama ${res.status}: ${err.slice(0, 200)}`)
  }
  const data = await res.json()
  return {
    content: data.message?.content || '',
    tokens: (data.prompt_eval_count || 0) + (data.eval_count || 0),
  }
}

async function callEmbeddings(text: string): Promise<number[]> {
  const endpoint = `${OLLAMA_URL}/api/embed`
  assertLocalhost(endpoint)
  const res = await fetch(endpoint, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ model: MODELS.embeddings, input: text }),
    signal: AbortSignal.timeout(30_000),
  })
  if (!res.ok) throw new Error(`Embedding error: ${res.status}`)
  const data = await res.json()
  return data.embeddings?.[0] || []
}

// ── Task Runner Wrapper ───────────────────────────────────────────────

async function runTask(
  name: string,
  state: DaemonState,
  intervalMs: number,
  fn: () => Promise<number>, // returns token count
): Promise<void> {
  if (!isDue(state, name, intervalMs)) return
  try {
    log(`[${name}] Starting...`)
    const tokens = await fn()
    state.stats.totalTokens += tokens
    markDone(state, name)
    log(`[${name}] Done (+${tokens} tokens)`)
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    log(`[${name}] ERROR: ${msg}`)
    state.stats.errorsToday++
    // Don't markDone on error — retry next cycle
  }
}

// ═══════════════════════════════════════════════════════════════════════
// TASK 1: Git Diff Review
// Reviews every new commit for bugs, security issues, type errors
// ═══════════════════════════════════════════════════════════════════════

async function taskGitReview(state: DaemonState): Promise<number> {
  let totalTokens = 0

  // First run — just record HEAD
  if (!state.lastProcessedCommit) {
    state.lastProcessedCommit = git('rev-parse HEAD')
    log('[gitReview] First run — recorded HEAD, will review future commits')
    return 0
  }

  // Get new commits
  const commits = git(`log --format=%H --no-merges ${state.lastProcessedCommit}..HEAD`)
  if (!commits) return 0

  const shas = commits.split('\n').filter(Boolean).reverse() // oldest first
  log(`[gitReview] ${shas.length} new commit(s) to review`)

  for (const sha of shas.slice(0, 5)) { // max 5 per run
    const shortSha = sha.slice(0, 8)
    const subject = git(`log -1 --format=%s ${sha}`)
    const diff = git(`diff ${sha}~1..${sha} -- '*.ts' '*.tsx' '*.css'`)
    if (!diff || diff.length < 50) {
      state.lastProcessedCommit = sha
      continue
    }

    const truncatedDiff = diff.length > 8000 ? diff.slice(0, 8000) + '\n\n[... diff truncated]' : diff

    const result = await callOllama(
      `Review this commit for bugs, security issues, and type errors.\n\nCommit: ${subject}\n\nDiff:\n${truncatedDiff}`,
      {
        model: MODELS.code,
        system: `You are reviewing a commit to a React 19 + TypeScript + Vite project (Kernel — AI chat platform).
Check for: bugs, security issues (XSS, injection, secret exposure), type errors, missing null checks, race conditions, memory leaks.
Rate the commit: SAFE / MINOR / CRITICAL.
Be specific with file and line references. Keep it concise.`,
        max_tokens: 1500,
      }
    )
    totalTokens += result.tokens

    const reportPath = join(REPORTS_DIR, 'git-reviews', `${today()}-${shortSha}.md`)
    writeFileSync(reportPath, `# Commit Review: ${shortSha}\n\n**Subject**: ${subject}\n**Date**: ${new Date().toISOString()}\n**Model**: ${MODELS.code}\n\n---\n\n${result.content}\n`)

    state.lastProcessedCommit = sha
    log(`[gitReview] Reviewed ${shortSha}: ${subject.slice(0, 60)}`)
  }

  return totalTokens
}

// ═══════════════════════════════════════════════════════════════════════
// TASK 2: i18n Sync
// Finds missing translation keys and translates them
// ═══════════════════════════════════════════════════════════════════════

async function taskI18nSync(state: DaemonState): Promise<number> {
  let totalTokens = 0
  let totalTranslated = 0
  const report: string[] = [`# i18n Sync Report — ${today()}`, '']

  for (const ns of NAMESPACES) {
    const enPath = join(LOCALES_DIR, 'en', `${ns}.json`)
    if (!existsSync(enPath)) continue
    const enJson = JSON.parse(readSafe(enPath))
    const enKeys = flattenKeys(enJson)
    const enKeyList = Object.keys(enKeys)
    if (enKeyList.length === 0) continue

    for (const lang of LANGUAGES) {
      // Check progress — skip if already done this cycle
      const progressKey = `${ns}:${lang}`
      if (state.i18nProgress[ns]?.includes(lang)) continue

      const langDir = join(LOCALES_DIR, lang)
      if (!existsSync(langDir)) mkdirSync(langDir, { recursive: true })

      const langPath = join(langDir, `${ns}.json`)
      let langJson: Record<string, unknown> = {}
      try { langJson = JSON.parse(readSafe(langPath)) || {} } catch { /* empty */ }

      const langKeys = flattenKeys(langJson)
      const missing = enKeyList.filter(k => !(k in langKeys))
      if (missing.length === 0) continue

      // Batch missing keys (max 15 per call to stay in context)
      const batches: Record<string, string>[] = []
      for (let i = 0; i < missing.length; i += 15) {
        const batch: Record<string, string> = {}
        for (const k of missing.slice(i, i + 15)) {
          batch[k] = enKeys[k]
        }
        batches.push(batch)
      }

      const langName = LANG_NAMES[lang] || lang
      let translated: Record<string, string> = {}

      for (const batch of batches) {
        const keysJson = JSON.stringify(batch, null, 2)
        const result = await callOllama(
          `Translate these UI strings from English to ${langName}.\n\nJSON:\n${keysJson}\n\nReturn ONLY valid JSON with the same keys. Preserve {{placeholders}} exactly.`,
          {
            model: MODELS.general,
            system: `You are a professional translator for a personal AI assistant app called Kernel. Translate naturally for ${langName} speakers. Preserve all {{interpolation}} placeholders exactly as-is. Output ONLY valid JSON — no markdown, no explanation.`,
            max_tokens: 2048,
          }
        )
        totalTokens += result.tokens

        // Parse response — try to extract JSON
        let parsed: Record<string, string> = {}
        try {
          const jsonMatch = result.content.match(/\{[\s\S]*\}/)
          if (jsonMatch) parsed = JSON.parse(jsonMatch[0])
        } catch {
          log(`[i18nSync] Failed to parse ${langName} response for ${ns}`)
          continue
        }
        Object.assign(translated, parsed)
      }

      if (Object.keys(translated).length > 0) {
        // Merge translations into existing lang JSON
        const mergedFlat = { ...langKeys, ...translated }
        const mergedObj = unflattenKeys(mergedFlat)
        writeFileSync(langPath, JSON.stringify(mergedObj, null, 2) + '\n')
        totalTranslated += Object.keys(translated).length

        report.push(`- **${langName}** (${lang}/${ns}.json): +${Object.keys(translated).length} keys`)
      }

      // Track progress
      if (!state.i18nProgress[ns]) state.i18nProgress[ns] = []
      state.i18nProgress[ns].push(lang)

      // Save state after each language (resume-friendly)
      saveState(state)
    }
  }

  // Reset progress for next cycle
  state.i18nProgress = {}

  if (totalTranslated > 0) {
    report.push('', `**Total**: ${totalTranslated} keys translated`)
    const reportPath = join(REPORTS_DIR, 'i18n-sync', `${today()}.md`)
    writeFileSync(reportPath, report.join('\n') + '\n')
    log(`[i18nSync] Translated ${totalTranslated} keys`)
  } else {
    log('[i18nSync] All translations up to date')
  }

  return totalTokens
}

// ═══════════════════════════════════════════════════════════════════════
// TASK 3: Test Coverage Gaps
// Finds source files without tests and generates scaffolds
// ═══════════════════════════════════════════════════════════════════════

async function taskTestCoverage(state: DaemonState): Promise<number> {
  let totalTokens = 0

  // Find all source files
  function findTsFiles(dir: string): string[] {
    const results: string[] = []
    try {
      for (const entry of readdirSync(dir, { withFileTypes: true })) {
        const full = join(dir, entry.name)
        if (entry.isDirectory() && !entry.name.startsWith('.') && entry.name !== 'node_modules') {
          results.push(...findTsFiles(full))
        } else if (entry.isFile() && /\.(ts|tsx)$/.test(entry.name) && !/\.(test|spec|d)\.(ts|tsx)$/.test(entry.name) && entry.name !== 'vite-env.d.ts' && entry.name !== 'setupTests.ts') {
          results.push(full)
        }
      }
    } catch { /* skip inaccessible dirs */ }
    return results
  }

  const allFiles = findTsFiles(SRC_DIR)
  const untested = allFiles.filter(f => {
    const base = f.replace(/\.(ts|tsx)$/, '')
    return !existsSync(`${base}.test.ts`) && !existsSync(`${base}.test.tsx`)
  })

  // Prioritize recently changed files
  const recentlyChanged = git('log --since="7 days ago" --name-only --format="" -- src/')
    .split('\n')
    .filter(Boolean)
    .map(f => join(PROJECT_ROOT, f))

  const prioritized = untested
    .sort((a, b) => {
      const aRecent = recentlyChanged.includes(a) ? 0 : 1
      const bRecent = recentlyChanged.includes(b) ? 0 : 1
      return aRecent - bRecent
    })
    .slice(0, 3) // max 3 per run

  if (prioritized.length === 0) {
    log('[testCoverage] All files have tests')
    return 0
  }

  const report: string[] = [
    `# Test Coverage Report — ${today()}`,
    '',
    `**Total source files**: ${allFiles.length}`,
    `**Files with tests**: ${allFiles.length - untested.length}`,
    `**Files without tests**: ${untested.length}`,
    `**Coverage**: ${((1 - untested.length / allFiles.length) * 100).toFixed(1)}%`,
    '',
    '## Generated Scaffolds',
    '',
  ]

  for (const file of prioritized) {
    const rel = relative(PROJECT_ROOT, file)
    const content = readSafe(file)
    if (!content || content.length < 20) continue

    const truncated = content.length > 6000 ? content.slice(0, 6000) + '\n\n[... truncated]' : content
    const result = await callOllama(
      `Generate Vitest unit tests for this file:\n\n\`\`\`typescript\n${truncated}\n\`\`\``,
      {
        model: MODELS.code,
        system: `You are generating Vitest tests for a React 19 + TypeScript project.
Use: import { describe, it, expect, vi } from 'vitest'
For React components: import { render, screen } from '@testing-library/react'
Mock any external dependencies (Supabase, Claude API, fetch) with vi.mock().
Test: exported functions/components, edge cases, error states.
Output ONLY the test code — no explanations.`,
        max_tokens: 4096,
      }
    )
    totalTokens += result.tokens

    // Write as .scaffold (human reviews before promoting)
    const scaffoldName = basename(file).replace(/\.(ts|tsx)$/, '.test.$1.scaffold')
    const scaffoldPath = join(REPORTS_DIR, 'test-coverage', scaffoldName)
    writeFileSync(scaffoldPath, `// Scaffold for: ${rel}\n// Review and rename to .test.ts/.test.tsx to activate\n// Generated: ${new Date().toISOString()}\n// Model: ${MODELS.code}\n\n${result.content}\n`)

    report.push(`- \`${rel}\` → \`${scaffoldName}\``)
    log(`[testCoverage] Generated scaffold for ${rel}`)
  }

  report.push('', '## Untested Files (top 20)', '')
  for (const f of untested.slice(0, 20)) {
    report.push(`- \`${relative(PROJECT_ROOT, f)}\``)
  }

  writeFileSync(join(REPORTS_DIR, 'test-coverage', `${today()}-report.md`), report.join('\n') + '\n')
  return totalTokens
}

// ═══════════════════════════════════════════════════════════════════════
// TASK 4: Code Quality Scan
// Reviews recently changed files for bugs, type issues, anti-patterns
// ═══════════════════════════════════════════════════════════════════════

async function taskCodeQuality(state: DaemonState): Promise<number> {
  let totalTokens = 0

  const lastRun = state.lastRunTimestamps.codeQuality || new Date(Date.now() - 24 * 60 * 60_000).toISOString()
  const changedFiles = git(`log --since="${lastRun}" --name-only --format="" -- 'src/*.ts' 'src/*.tsx'`)
    .split('\n')
    .filter(Boolean)
    .filter((v, i, a) => a.indexOf(v) === i) // dedupe
    .slice(0, 5) // max 5 per run

  if (changedFiles.length === 0) {
    log('[codeQuality] No changed files since last scan')
    return 0
  }

  const report: string[] = [`# Code Quality Scan — ${today()}`, '']

  for (const file of changedFiles) {
    const fullPath = join(PROJECT_ROOT, file)
    if (!existsSync(fullPath)) continue
    const content = readSafe(fullPath)
    if (!content || content.length < 30) continue

    const truncated = content.length > 6000 ? content.slice(0, 6000) + '\n\n[... truncated]' : content
    const result = await callOllama(
      `Review this file for quality issues:\n\nFile: ${file}\n\n\`\`\`typescript\n${truncated}\n\`\`\``,
      {
        model: MODELS.reasoning,
        system: `You are reviewing TypeScript/React code for a production AI chat platform.
Check for:
1. Type safety (any casts, missing null checks, unsafe assertions)
2. Performance (unnecessary re-renders, missing memo, expensive computations in render)
3. Security (XSS, injection, secrets in source)
4. React anti-patterns (stale closures, missing deps, key errors)
5. Error handling gaps

Rate: CLEAN / MINOR / NEEDS_ATTENTION
Be specific. Reference line numbers. Keep it concise.`,
        max_tokens: 1500,
      }
    )
    totalTokens += result.tokens

    report.push(`## ${file}`, '', result.content, '', '---', '')
    log(`[codeQuality] Reviewed ${file}`)
  }

  writeFileSync(join(REPORTS_DIR, 'code-quality', `${today()}.md`), report.join('\n') + '\n')
  return totalTokens
}

// ═══════════════════════════════════════════════════════════════════════
// TASK 5: Documentation Gaps
// Finds exported functions/classes without JSDoc
// ═══════════════════════════════════════════════════════════════════════

async function taskDocumentation(state: DaemonState): Promise<number> {
  let totalTokens = 0

  // Focus on engine/ — the most important directory
  const engineDir = join(SRC_DIR, 'engine')
  const engineFiles: string[] = []
  try {
    for (const entry of readdirSync(engineDir, { withFileTypes: true })) {
      if (entry.isFile() && /\.ts$/.test(entry.name) && !/\.(test|spec|d)\.ts$/.test(entry.name)) {
        engineFiles.push(join(engineDir, entry.name))
      }
    }
  } catch { return 0 }

  // Find files with undocumented exports
  const undocumented: { file: string; exports: string[] }[] = []

  for (const file of engineFiles) {
    const content = readSafe(file)
    if (!content) continue

    const lines = content.split('\n')
    const missingDocs: string[] = []

    for (let i = 0; i < lines.length; i++) {
      const match = lines[i].match(/^export\s+(async\s+)?(?:function|class|const|interface|type)\s+(\w+)/)
      if (match) {
        // Check if previous line(s) have JSDoc
        const prev = i > 0 ? lines[i - 1].trim() : ''
        const prev2 = i > 1 ? lines[i - 2].trim() : ''
        if (!prev.endsWith('*/') && !prev2.endsWith('*/')) {
          missingDocs.push(match[2])
        }
      }
    }

    if (missingDocs.length > 0) {
      undocumented.push({ file, exports: missingDocs })
    }
  }

  if (undocumented.length === 0) {
    log('[documentation] All engine exports have JSDoc')
    return 0
  }

  // Process top 3 files per run
  const report: string[] = [`# Documentation Gaps — ${today()}`, '']

  for (const { file, exports } of undocumented.slice(0, 3)) {
    const rel = relative(PROJECT_ROOT, file)
    const content = readSafe(file)
    const truncated = content.length > 6000 ? content.slice(0, 6000) + '\n\n[... truncated]' : content

    const result = await callOllama(
      `Add JSDoc to all exported functions and classes in this file. These exports are missing docs: ${exports.join(', ')}\n\n\`\`\`typescript\n${truncated}\n\`\`\``,
      {
        model: MODELS.code,
        system: `You are a TypeScript documentation expert. Generate JSDoc for exported symbols.
Include @param, @returns, @throws, @example where relevant.
Output ONLY the JSDoc comment blocks with the function signatures they belong to (not the full file).
Format: /** ... */ followed by the export line.`,
        max_tokens: 4096,
      }
    )
    totalTokens += result.tokens

    const docFile = basename(file).replace('.ts', '.docs.md')
    writeFileSync(join(REPORTS_DIR, 'documentation', docFile), `# JSDoc for ${rel}\n\nUndocumented exports: ${exports.join(', ')}\n\n---\n\n${result.content}\n`)

    report.push(`- \`${rel}\`: ${exports.length} exports need JSDoc (${exports.join(', ')})`)
    log(`[documentation] Generated docs for ${rel} (${exports.length} exports)`)
  }

  report.push('', `**Total undocumented files**: ${undocumented.length}`)
  writeFileSync(join(REPORTS_DIR, 'documentation', `${today()}-report.md`), report.join('\n') + '\n')
  return totalTokens
}

// ═══════════════════════════════════════════════════════════════════════
// TASK 6: Embedding Index
// Builds semantic search embeddings for all source files
// ═══════════════════════════════════════════════════════════════════════

async function taskEmbeddings(state: DaemonState): Promise<number> {
  let totalTokens = 0
  let indexed = 0
  let skipped = 0

  function findAllTs(dir: string): string[] {
    const results: string[] = []
    try {
      for (const entry of readdirSync(dir, { withFileTypes: true })) {
        const full = join(dir, entry.name)
        if (entry.isDirectory() && !entry.name.startsWith('.') && entry.name !== 'node_modules') {
          results.push(...findAllTs(full))
        } else if (entry.isFile() && /\.(ts|tsx)$/.test(entry.name)) {
          results.push(full)
        }
      }
    } catch { /* skip */ }
    return results
  }

  const files = findAllTs(SRC_DIR)
  const embDir = join(REPORTS_DIR, 'embeddings')

  for (const file of files) {
    const rel = relative(PROJECT_ROOT, file)
    const content = readSafe(file)
    if (!content || content.length < 20) continue

    const hash = contentHash(content)
    const existing = state.embeddingIndex[rel]
    if (existing && existing.hash === hash) {
      skipped++
      continue
    }

    // Take first 2000 chars for embedding (enough for semantic meaning)
    const snippet = content.slice(0, 2000)
    try {
      const embedding = await callEmbeddings(`File: ${rel}\n\n${snippet}`)
      if (embedding.length > 0) {
        const embFile = rel.replace(/[/\\]/g, '__') + '.json'
        writeFileSync(join(embDir, embFile), JSON.stringify({ file: rel, embedding, updatedAt: new Date().toISOString() }))
        state.embeddingIndex[rel] = { hash, updatedAt: new Date().toISOString() }
        indexed++
      }
    } catch (err) {
      log(`[embeddings] Failed to embed ${rel}: ${err instanceof Error ? err.message : String(err)}`)
    }
  }

  log(`[embeddings] Indexed ${indexed} files, skipped ${skipped} unchanged`)
  return totalTokens
}

// ═══════════════════════════════════════════════════════════════════════
// TASK 7: Daily Digest
// Summarizes the last 24 hours of development
// ═══════════════════════════════════════════════════════════════════════

async function taskDailyDigest(state: DaemonState): Promise<number> {
  // Only run once per day
  const lastDigest = state.lastRunTimestamps.dailyDigest
  if (lastDigest && lastDigest.slice(0, 10) === today()) return 0

  const commits = git('log --since="24 hours ago" --format="%h %s (%an)" --no-merges')
  const stats = git('diff --stat HEAD~10..HEAD 2>/dev/null')
  const shortlog = git('shortlog --since="24 hours ago" -s --no-merges')

  if (!commits && !stats) {
    log('[dailyDigest] No activity in last 24 hours')
    return 0
  }

  // Gather daemon findings from today
  let daemonFindings = ''
  const reviewDir = join(REPORTS_DIR, 'git-reviews')
  try {
    const todayReviews = readdirSync(reviewDir).filter(f => f.startsWith(today()))
    if (todayReviews.length > 0) {
      daemonFindings += `\n\nDaemon reviewed ${todayReviews.length} commit(s) today.`
    }
  } catch { /* ok */ }

  const qualityReport = readSafe(join(REPORTS_DIR, 'code-quality', `${today()}.md`))
  if (qualityReport) {
    daemonFindings += `\n\nCode quality scan found:\n${qualityReport.slice(0, 1500)}`
  }

  const result = await callOllama(
    `Summarize the last 24 hours of development on the Kernel AI platform.\n\nCommits:\n${commits || 'None'}\n\nFile stats:\n${stats || 'None'}\n\nContributors:\n${shortlog || 'None'}${daemonFindings}`,
    {
      model: MODELS.reasoning,
      system: `You are writing a brief daily standup report for a solo developer.
Format:
## What happened
- Bullet points of key changes

## Issues found
- Any bugs, security issues, or quality concerns from reviews

## Stats
- Files changed, lines added/removed

Keep it under 300 words. Be direct and useful.`,
      max_tokens: 1000,
    }
  )

  const digestPath = join(REPORTS_DIR, 'daily-digest', `${today()}.md`)
  writeFileSync(digestPath, `# Daily Digest — ${today()}\n\n${result.content}\n\n---\n*Generated by K:BOT Daemon using ${MODELS.reasoning} (local, $0)*\n`)

  log('[dailyDigest] Digest written')
  return result.tokens
}

// ═══════════════════════════════════════════════════════════════════════
// TASK 8: Dream Consolidation
// Consolidates session memories into durable insights via the dream engine
// ═══════════════════════════════════════════════════════════════════════

async function taskDreamConsolidation(_state: DaemonState): Promise<number> {
  // Dynamic import — dream.ts lives in the kbot package
  const { dream } = await import('../packages/kbot/src/dream.js') as {
    dream: (sessionId?: string) => Promise<{
      success: boolean
      newInsights: number
      reinforced: number
      archived: number
      cycle: number
      duration: number
      error: string | null
    }>
  }

  const result = await dream()

  // Session too short or no sessions — skip gracefully
  if (!result.success && result.error) {
    log(`[dreamConsolidation] Skipped: ${result.error}`)
    return 0
  }

  log(
    `[dreamConsolidation] Cycle ${result.cycle} complete in ${result.duration}ms — ` +
    `${result.newInsights} new insights, ${result.reinforced} reinforced, ${result.archived} archived`
  )

  // Token count is 0 here — the dream engine calls Ollama directly
  // and manages its own token tracking. We return 0 to avoid double-counting.
  return 0
}

// ═══════════════════════════════════════════════════════════════════════
// TASK 9: Morning Briefing
// Gathers overnight data and emails a summary to Isaac
// ═══════════════════════════════════════════════════════════════════════

async function taskMorningBriefing(_state: DaemonState): Promise<number> {
  // Dynamic import — morning briefing is a standalone script with its own export
  const { runMorningBriefing } = await import('./kbot-morning-briefing.js') as {
    runMorningBriefing: () => Promise<number>
  }

  const tokens = await runMorningBriefing()
  log('[morningBriefing] Briefing generated and emailed')
  return tokens
}

// ═══════════════════════════════════════════════════════════════════════
// MAIN ORCHESTRATOR
// ═══════════════════════════════════════════════════════════════════════

async function main(): Promise<void> {
  ensureDirs()
  const state = loadState()
  state.stats.totalRuns++

  // Reset daily error count
  if (state.stats.lastErrorDate !== today()) {
    state.stats.errorsToday = 0
    state.stats.lastErrorDate = today()
  }

  log('═══ K:BOT Daemon run started ═══')

  // Check Ollama health
  const ollamaUp = await isOllamaRunning()
  state.stats.lastOllamaStatus = ollamaUp ? 'up' : 'down'

  if (!ollamaUp) {
    log('Ollama is not running — skipping all tasks. Will retry in 15 minutes.')
    saveState(state)
    return
  }

  log(`Ollama is up. Run #${state.stats.totalRuns} (${state.stats.totalTokens.toLocaleString()} lifetime tokens)`)

  // Run tasks sequentially (avoid overloading Ollama with parallel calls)
  await runTask('gitReview', state, INTERVALS.gitReview, () => taskGitReview(state))
  await runTask('codeQuality', state, INTERVALS.codeQuality, () => taskCodeQuality(state))
  await runTask('dailyDigest', state, INTERVALS.dailyDigest, () => taskDailyDigest(state))
  await runTask('documentation', state, INTERVALS.documentation, () => taskDocumentation(state))
  await runTask('testCoverage', state, INTERVALS.testCoverage, () => taskTestCoverage(state))
  await runTask('embeddings', state, INTERVALS.embeddings, () => taskEmbeddings(state))
  await runTask('i18nSync', state, INTERVALS.i18nSync, () => taskI18nSync(state))
  await runTask('dreamConsolidation', state, INTERVALS.dreamConsolidation, () => taskDreamConsolidation(state))
  await runTask('morningBriefing', state, INTERVALS.morningBriefing, () => taskMorningBriefing(state))

  saveState(state)
  log(`═══ Daemon run complete. Errors today: ${state.stats.errorsToday} ═══\n`)
}

// ── Entry ─────────────────────────────────────────────────────────────
main().catch(err => {
  log(`FATAL: ${err instanceof Error ? err.message : String(err)}`)
  process.exit(1)
})
