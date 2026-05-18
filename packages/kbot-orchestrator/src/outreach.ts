// Outreach pipeline — the load-bearing loop of kbot-orchestrator v0.1.
//
// Read a briefing markdown, identify pending emailable recipients, send each
// via SMTP, log the results back into the briefing. The pipeline is the
// codified version of the "fire N emails with consistent voice" workflow
// that kernel.chat has been running by hand and that orchestration
// engineering claims as its discipline.
//
// Designed to be safe-by-default: prints a dry-run summary first; sending
// requires an explicit confirm flag. Bounces and errors are surfaced
// inline; the loop does NOT halt on individual failures because partial
// success is the realistic outcome of any real outreach batch (~10-15%
// best-guess-address bounce rate is normal).

import { readFileSync } from 'node:fs'
import { parseBriefing, pending, emailable, type Briefing, type Recipient } from './briefing.js'
import { GmailSender, type SenderConfig, type SendResult } from './send.js'
import { appendSendResults } from './log.js'

export interface OutreachRunOptions {
  briefingPath: string
  sender: SenderConfig
  /** When false (default), only report what would be sent without sending. */
  confirm?: boolean
  /** Optional filter: only send recipients whose tier label matches. */
  tier?: string
  /** Optional filter: only send recipients whose name matches (case-insensitive substring). */
  nameMatches?: string
  /** Optional limit: stop after this many sends. */
  limit?: number
  /** Per-message delay in ms (default 500ms, gentle on Gmail send limits). */
  delayMs?: number
}

export interface OutreachRunResult {
  briefing: Briefing
  considered: Recipient[]
  sent: { recipient: Recipient; result: SendResult }[]
  skipped: { recipient: Recipient; reason: string }[]
  dryRun: boolean
}

export async function runOutreach(opts: OutreachRunOptions): Promise<OutreachRunResult> {
  const text = readFileSync(opts.briefingPath, 'utf-8')
  const briefing = parseBriefing(opts.briefingPath, text)

  let pool = pending(briefing)
  pool = emailable(pool)
  if (opts.tier) {
    const t = opts.tier.toLowerCase()
    pool = pool.filter((r) => (r.tier ?? '').toLowerCase().includes(t))
  }
  if (opts.nameMatches) {
    const n = opts.nameMatches.toLowerCase()
    pool = pool.filter((r) => r.name.toLowerCase().includes(n))
  }
  if (opts.limit != null) {
    pool = pool.slice(0, opts.limit)
  }

  const skipped: { recipient: Recipient; reason: string }[] = []
  const considered = pool

  if (!opts.confirm) {
    return { briefing, considered, sent: [], skipped, dryRun: true }
  }

  const sender = new GmailSender(opts.sender)
  const sent: { recipient: Recipient; result: SendResult }[] = []
  const delay = opts.delayMs ?? 500

  for (const recipient of pool) {
    const result = await sender.sendOne(recipient.to, recipient.subject, recipient.body)
    sent.push({ recipient, result })
    if (delay > 0) await sleep(delay)
  }

  if (sent.length > 0) {
    appendSendResults(opts.briefingPath, sent)
  }

  return { briefing, considered, sent, skipped, dryRun: false }
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}
