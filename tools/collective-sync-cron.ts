#!/usr/bin/env npx tsx
// Daily collective intelligence sync
// Runs: anonymize patterns → contribute → fetch → merge
// Scheduled via launchd or cron

import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'node:fs'
import { homedir } from 'node:os'
import { join } from 'node:path'
import { createHash } from 'node:crypto'

const KBOT_DIR = join(homedir(), '.kbot')
const COLLECTIVE_DIR = join(KBOT_DIR, 'collective')
const COLLECTIVE_URL = process.env.KBOT_COLLECTIVE_URL || 'https://kernel.chat/api/collective'
const LOG_PATH = join(COLLECTIVE_DIR, 'sync-log.jsonl')

function log(msg: string): void {
  const entry = JSON.stringify({ ts: new Date().toISOString(), msg }) + '\n'
  try { writeFileSync(LOG_PATH, entry, { flag: 'a' }) } catch { /* ignore */ }
  console.log(`[collective] ${msg}`)
}

function loadJson(path: string): unknown {
  try { if (existsSync(path)) return JSON.parse(readFileSync(path, 'utf-8')) } catch { /* ignore */ }
  return null
}

function deviceFingerprint(): string {
  const raw = `${homedir()}:${process.platform}:${process.arch}`
  return createHash('sha256').update(raw).digest('hex').slice(0, 16)
}

function anonymize(patterns: Array<Record<string, unknown>>): Array<Record<string, unknown>> {
  return patterns.map(p => ({
    type: p.type || 'unknown',
    language: p.language || 'unknown',
    framework: p.framework || '',
    successRate: p.successRate || p.success_rate || 0,
    toolsUsed: Array.isArray(p.toolsUsed) ? p.toolsUsed : [],
    agentUsed: p.agentUsed || p.agent || 'auto',
    // Strip all PII: no file paths, no usernames, no project names
  }))
}

async function sync(): Promise<void> {
  if (!existsSync(COLLECTIVE_DIR)) mkdirSync(COLLECTIVE_DIR, { recursive: true })

  log('Starting collective sync...')

  // Load local patterns
  const patternsPath = join(KBOT_DIR, 'memory', 'patterns.json')
  const raw = loadJson(patternsPath) as Array<Record<string, unknown>> | null
  const patterns = raw || []
  log(`Local patterns: ${patterns.length}`)

  // Anonymize
  const anonymized = anonymize(patterns)
  log(`Anonymized: ${anonymized.length} patterns`)

  // Contribute
  try {
    const res = await fetch(`${COLLECTIVE_URL}/contribute`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ device: deviceFingerprint(), patterns: anonymized }),
      signal: AbortSignal.timeout(10_000),
    })
    if (res.ok) {
      const result = await res.json() as { accepted?: number }
      log(`Contributed: ${result.accepted || anonymized.length} patterns`)
    } else {
      log(`Contribute failed: ${res.status} (endpoint may not exist yet)`)
    }
  } catch (err) {
    log(`Contribute error: ${err instanceof Error ? err.message : String(err)}`)
  }

  // Fetch collective patterns
  try {
    const res = await fetch(`${COLLECTIVE_URL}/patterns`, {
      signal: AbortSignal.timeout(10_000),
    })
    if (res.ok) {
      const collective = await res.json() as Array<Record<string, unknown>>
      const cachePath = join(COLLECTIVE_DIR, 'learned-patterns.json')
      writeFileSync(cachePath, JSON.stringify(collective, null, 2))
      log(`Fetched: ${collective.length} collective patterns`)
    } else {
      log(`Fetch failed: ${res.status} (endpoint may not exist yet)`)
    }
  } catch (err) {
    log(`Fetch error: ${err instanceof Error ? err.message : String(err)}`)
  }

  log('Collective sync complete.')
}

sync().catch(err => log(`Fatal: ${err}`))
