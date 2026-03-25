#!/usr/bin/env npx tsx
// Memory Synthesis — what does kbot actually know?
// Usage: npx tsx tools/memory-synthesis.ts

import { readFileSync, existsSync, readdirSync, statSync } from 'fs'
import { join, basename } from 'path'
import { homedir } from 'os'

const HOME = homedir()
const PROJECT = join(import.meta.dirname, '..')
const DISCOVERY = join(PROJECT, '.kbot-discovery')
const CLAUDE_MEMORY = join(HOME, '.claude/projects/-Users-isaachernandez-blog-design/memory')

function readJson(path: string): unknown {
  try { return JSON.parse(readFileSync(path, 'utf8')) } catch { return null }
}

function readText(path: string): string {
  try { return readFileSync(path, 'utf8') } catch { return '' }
}

function dirSize(path: string): string {
  try {
    let total = 0
    for (const f of readdirSync(path, { recursive: true })) {
      const fp = join(path, f as string)
      try { total += statSync(fp).size } catch {}
    }
    return (total / 1024 / 1024).toFixed(1) + ' MB'
  } catch { return '?' }
}

// ── Identity ──
const kbotPkg = readJson(join(PROJECT, 'packages/kbot/package.json')) as { version?: string } | null
const kbotConfig = join(HOME, '.kbot')
const configExists = existsSync(join(kbotConfig, 'config.json'))

console.log('═══════════════════════════════════════════════════')
console.log(' KBOT MEMORY SYNTHESIS')
console.log('═══════════════════════════════════════════════════')
console.log()
console.log('## Identity')
console.log(`  Version:     ${kbotPkg?.version ?? 'unknown'}`)
console.log(`  Config:      ${configExists ? '~/.kbot/config.json (encrypted)' : 'NOT CONFIGURED'}`)
console.log(`  Disk usage:  ${dirSize(kbotConfig)}`)

// ── Learning Data ──
const learningDir = join(kbotConfig, 'learning')
if (existsSync(learningDir)) {
  const files = readdirSync(learningDir)
  console.log()
  console.log('## Learning Data')
  console.log(`  Files: ${files.length}`)
  for (const f of files.slice(0, 5)) {
    const data = readJson(join(learningDir, f))
    if (data && typeof data === 'object') {
      const entries = Array.isArray(data) ? data.length : Object.keys(data).length
      console.log(`  ${f}: ${entries} entries`)
    }
  }
}

// ── Daemon State ──
const state = readJson(join(DISCOVERY, 'state.json')) as {
  stats?: Record<string, number>
  knownStars?: number
  knownDownloads?: number
  hnScore?: number
  hnComments?: number
  feedback?: Array<{ outcome: string }>
  reachedMilestones?: string[]
} | null

if (state) {
  console.log()
  console.log('## Daemon State')
  console.log(`  Stars:       ${state.knownStars ?? '?'}`)
  console.log(`  Downloads:   ${state.knownDownloads ?? '?'}`)
  console.log(`  HN score:    ${state.hnScore ?? '?'} (${state.hnComments ?? 0} comments)`)
  if (state.stats) {
    console.log(`  Total runs:  ${state.stats.totalRuns ?? 0}`)
    console.log(`  Pulses:      ${state.stats.totalPulses ?? 0}`)
    console.log(`  Intel scans: ${state.stats.totalIntel ?? 0}`)
    console.log(`  Evolution:   ${state.stats.evolutionSuccesses ?? 0} success / ${state.stats.evolutionFailures ?? 0} fail`)
    console.log(`  Posts:       ${state.stats.postsAttempted ?? 0} attempted, ${state.stats.postsEngaged ?? 0} engaged, ${state.stats.postsFlagged ?? 0} flagged`)
  }
  if (state.feedback?.length) {
    const engaged = state.feedback.filter(f => f.outcome === 'engaged').length
    const ignored = state.feedback.filter(f => f.outcome === 'ignored').length
    const flagged = state.feedback.filter(f => f.outcome === 'flagged').length
    console.log(`  Feedback:    ${engaged} engaged, ${ignored} ignored, ${flagged} flagged`)
  }
  if (state.reachedMilestones?.length) {
    console.log(`  Milestones:  ${state.reachedMilestones.join(', ')}`)
  }
}

// ── Competitive Landscape ──
const outreach = readJson(join(DISCOVERY, 'outreach/latest.json')) as {
  projects?: Array<{ name: string; stars: number; description: string }>
  latestPaper?: { title: string }
} | null

if (outreach?.projects?.length) {
  console.log()
  console.log('## Competitive Landscape')
  const sorted = [...outreach.projects].sort((a, b) => b.stars - a.stars)
  for (const p of sorted) {
    const bar = p.stars > 1000 ? ' <<<' : ''
    console.log(`  ${String(p.stars).padStart(6)} ★  ${p.name}${bar}`)
    console.log(`          ${p.description.slice(0, 80)}`)
  }
  if (outreach.latestPaper) {
    console.log(`  Paper:  ${outreach.latestPaper.title}`)
  }
}

// ── Evolution History ──
const proposalsDir = join(DISCOVERY, 'evolution/proposals')
if (existsSync(proposalsDir)) {
  const proposals = readdirSync(proposalsDir).filter(f => f.endsWith('.json')).sort()
  console.log()
  console.log('## Evolution History')
  for (const f of proposals) {
    const p = readJson(join(proposalsDir, f)) as {
      cycle?: number
      improvement?: { description: string; status: string }
    } | null
    if (p) {
      const status = p.improvement?.status?.includes('APPLIED') ? 'APPLIED' : 'FAILED'
      console.log(`  Cycle ${p.cycle ?? '?'}: [${status}] ${p.improvement?.description?.slice(0, 70) ?? 'unknown'}`)
    }
  }
}

// ── Action Journal ──
const actionsDir = join(DISCOVERY, 'actions')
if (existsSync(actionsDir)) {
  const journals = readdirSync(actionsDir).filter(f => f.startsWith('journal-'))
  const posted = readJson(join(actionsDir, 'posted.json')) as Array<{
    timestamp: string; title: string; success: boolean
  }> | null

  if (posted?.length) {
    console.log()
    console.log('## Post History')
    const successes = posted.filter(p => p.success)
    const failures = posted.filter(p => !p.success)
    console.log(`  Total: ${posted.length} attempts (${successes.length} succeeded, ${failures.length} failed)`)
    for (const p of successes.slice(-5)) {
      console.log(`  ✓ ${p.timestamp.slice(0, 16)} ${p.title?.slice(0, 60) ?? 'untitled'}`)
    }
  }
}

// ── Claude Code Memory ──
if (existsSync(CLAUDE_MEMORY)) {
  const memFiles = readdirSync(CLAUDE_MEMORY).filter(f => f.endsWith('.md') && f !== 'MEMORY.md')
  if (memFiles.length) {
    console.log()
    console.log('## Claude Code Memory')
    for (const f of memFiles) {
      const content = readText(join(CLAUDE_MEMORY, f))
      const nameMatch = content.match(/name:\s*(.+)/i)
      const typeMatch = content.match(/type:\s*(.+)/i)
      const name = nameMatch?.[1]?.trim() ?? basename(f, '.md')
      const type = typeMatch?.[1]?.trim() ?? 'unknown'
      console.log(`  [${type}] ${name}`)
    }
  }
}

// ── Open Questions ──
const reviewQueue = readText(join(actionsDir, 'review-queue.md'))
const pendingCount = (reviewQueue.match(/pending_review/g) ?? []).length

console.log()
console.log('## Open Questions')
console.log(`  Review queue: ${pendingCount} drafts pending`)
console.log(`  Evolution success rate: ${state?.stats?.evolutionSuccesses ?? 0}/${(state?.stats?.evolutionSuccesses ?? 0) + (state?.stats?.evolutionFailures ?? 0)} (${state?.stats?.evolutionSuccesses === 0 ? 'never landed one' : ''})`)
if ((state?.knownStars ?? 0) < 10) console.log('  How to get from 3 → 10 stars?')
if ((state?.hnComments ?? 0) === 0) console.log('  HN post has 0 comments — is the content resonating?')

console.log()
console.log('═══════════════════════════════════════════════════')
console.log(` Synthesized at ${new Date().toISOString().slice(0, 19)}`)
console.log('═══════════════════════════════════════════════════')
