#!/usr/bin/env node
// kbot-orchestrator CLI — two pipelines.
//
// outreach : read a briefing markdown, send pending recipients via SMTP,
//            append an audit table back into the briefing.
// explore  : read a candidate registry, filter by tag + recency, assemble
//            a calibrated briefing in the format the outreach pipeline
//            consumes. The discovery loop is registry-driven; v0.3+ adds
//            real public-internet discovery (GitHub stargazers, npm
//            dependents, web research).

import { runOutreach } from './outreach.js'
import { explore, type ExploreOptions } from './explore.js'
import { parseArgs } from 'node:util'

interface OutreachArgs {
  briefing: string
  tier?: string
  name?: string
  limit?: number
  confirm: boolean
  from: string
  displayName: string
  keychain: string
  delay: number
}

interface ExploreArgs {
  corpus: string
  artifact: string
  link: string
  subject: string
  license: string
  context?: string
  output: string
  tags: string[]
  recencyDays?: number
  tier?: string
  briefingTitle?: string
}

function parseOutreachArgs(rest: string[]): OutreachArgs {
  const { values } = parseArgs({
    args: rest,
    options: {
      briefing: { type: 'string', short: 'b' },
      tier: { type: 'string', short: 't' },
      name: { type: 'string', short: 'n' },
      limit: { type: 'string', short: 'l' },
      confirm: { type: 'boolean', default: false },
      from: { type: 'string', default: 'isaacsight@gmail.com' },
      'display-name': { type: 'string', default: 'Isaac Hernandez' },
      keychain: { type: 'string', default: 'kbot-gmail-app-password' },
      delay: { type: 'string', default: '500' },
    },
    strict: false,
  })

  const args: OutreachArgs = {
    briefing: (values['briefing'] as string) ?? '',
    confirm: Boolean(values['confirm']),
    from: (values['from'] as string) ?? 'isaacsight@gmail.com',
    displayName: (values['display-name'] as string) ?? 'Isaac Hernandez',
    keychain: (values['keychain'] as string) ?? 'kbot-gmail-app-password',
    delay: Number(values['delay'] ?? '500'),
  }
  const tierVal = values['tier'] as string | undefined
  const nameVal = values['name'] as string | undefined
  const limitVal = values['limit'] as string | undefined
  if (tierVal) args.tier = tierVal
  if (nameVal) args.name = nameVal
  if (limitVal != null) args.limit = Number(limitVal)
  return args
}

function parseExploreArgs(rest: string[]): ExploreArgs {
  const { values } = parseArgs({
    args: rest,
    options: {
      corpus: { type: 'string', short: 'c' },
      artifact: { type: 'string', short: 'a' },
      link: { type: 'string' },
      subject: { type: 'string', short: 's' },
      license: { type: 'string' },
      context: { type: 'string' },
      output: { type: 'string', short: 'o' },
      tags: { type: 'string', short: 't' },
      'recency-days': { type: 'string' },
      tier: { type: 'string' },
      title: { type: 'string' },
    },
    strict: false,
  })

  const tags = ((values['tags'] as string) ?? '').split(',').map((s) => s.trim()).filter(Boolean)
  const args: ExploreArgs = {
    corpus: (values['corpus'] as string) ?? '',
    artifact: (values['artifact'] as string) ?? '',
    link: (values['link'] as string) ?? '',
    subject: (values['subject'] as string) ?? '',
    license: (values['license'] as string) ?? '',
    output: (values['output'] as string) ?? '',
    tags,
  }
  const contextVal = values['context'] as string | undefined
  const recencyVal = values['recency-days'] as string | undefined
  const tierVal = values['tier'] as string | undefined
  const titleVal = values['title'] as string | undefined
  if (contextVal) args.context = contextVal
  if (recencyVal != null) args.recencyDays = Number(recencyVal)
  if (tierVal) args.tier = tierVal
  if (titleVal) args.briefingTitle = titleVal
  return args
}

async function cmdOutreach(args: OutreachArgs): Promise<void> {
  if (!args.briefing) {
    console.error('Required: --briefing <path-to-briefing.md>')
    process.exit(1)
  }

  const opts: Parameters<typeof runOutreach>[0] = {
    briefingPath: args.briefing,
    sender: {
      email: args.from,
      name: args.displayName,
      keychainService: args.keychain,
    },
    confirm: args.confirm,
    delayMs: args.delay,
  }
  if (args.tier) opts.tier = args.tier
  if (args.name) opts.nameMatches = args.name
  if (args.limit != null) opts.limit = args.limit
  const result = await runOutreach(opts)

  if (result.dryRun) {
    console.log(`[DRY RUN] Would send ${result.considered.length} message(s) from ${args.briefing}:`)
    for (const r of result.considered) {
      const tier = r.tier ? ` [${r.tier}]` : ''
      console.log(`  → ${r.name}${tier}  ${r.to}`)
      console.log(`    "${r.subject}"`)
    }
    console.log()
    console.log('To actually send, add --confirm.')
    return
  }

  let sentCount = 0
  let failCount = 0
  for (const { recipient, result: sendResult } of result.sent) {
    if (sendResult.ok) {
      sentCount++
      const id = sendResult.messageId ? ` ${sendResult.messageId}` : ''
      console.log(`✓ ${recipient.name} <${recipient.to}>${id}`)
    } else {
      failCount++
      console.log(`✗ ${recipient.name} <${recipient.to}>: ${sendResult.error ?? 'failed'}`)
    }
  }
  console.log()
  console.log(`Sent ${sentCount}; failed ${failCount}; log appended to ${args.briefing}`)
}

function cmdExplore(args: ExploreArgs): void {
  const missing: string[] = []
  if (!args.corpus) missing.push('--corpus <path-to-corpus.json>')
  if (!args.artifact) missing.push('--artifact <path-on-disk>')
  if (!args.link) missing.push('--link <public-url-to-artifact>')
  if (!args.subject) missing.push('--subject "phrase describing artifact"')
  if (!args.license) missing.push('--license "CC BY 4.0 | MIT | ..."')
  if (!args.output) missing.push('--output <path-for-generated-briefing>')
  if (missing.length > 0) {
    console.error('Missing required flags:')
    for (const m of missing) console.error(`  ${m}`)
    process.exit(1)
  }

  const options: ExploreOptions = {
    corpusPath: args.corpus,
    artifact: {
      path: args.artifact,
      link: args.link,
      subject: args.subject,
      license: args.license,
    },
    outputPath: args.output,
    tags: args.tags,
  }
  if (args.context) options.artifact.context = args.context
  if (args.recencyDays != null) options.recencyDays = args.recencyDays
  if (args.tier) options.tier = args.tier
  if (args.briefingTitle) options.briefingTitle = args.briefingTitle

  const result = explore(options)

  console.log(`Assembled ${result.considered.length} candidate(s) into ${result.briefingPath}`)
  if (result.excludedByRecency.length > 0) {
    console.log(`Excluded ${result.excludedByRecency.length} candidate(s) by recency window (${args.recencyDays ?? 14} days):`)
    for (const c of result.excludedByRecency) {
      console.log(`  - ${c.name} (last pitched ${c.last_pitched})`)
    }
  }
  if (args.tags.length > 0) {
    const overlapCount = result.considered.length
    console.log(`Tag query: ${args.tags.join(', ')} — matched ${overlapCount} candidate(s).`)
  }
  console.log()
  console.log(`Next: review ${args.output}, edit drafts where needed, then fire via:`)
  console.log(`  kbot-orchestrator outreach --briefing ${args.output} --confirm`)
}

function cmdHelp(): void {
  console.log(`
kbot-orchestrator — reference implementation of orchestration engineering

Commands:
  outreach    Read a briefing markdown, send pending recipients via SMTP
  explore     Read a candidate registry, assemble a briefing from filtered candidates
  help        Show this help

Outreach usage:
  kbot-orchestrator outreach --briefing <path>                  # dry-run; lists pending
  kbot-orchestrator outreach --briefing <path> --confirm        # actually send all pending
  kbot-orchestrator outreach --briefing <path> --tier "Tier 1"  # filter by tier
  kbot-orchestrator outreach --briefing <path> --name "Chase"   # filter by name substring
  kbot-orchestrator outreach --briefing <path> --limit 3        # cap the batch size

Explore usage:
  kbot-orchestrator explore \\
    --corpus packages/kbot-orchestrator/data/candidates.json \\
    --artifact docs/agentic-engineering.md \\
    --link https://github.com/isaacsight/kernel/blob/main/docs/agentic-engineering.md \\
    --subject "the agentic engineering field map" \\
    --license "CC BY 4.0" \\
    --tags "discipline-naming,agentic-engineering" \\
    --output .claude/OUTREACH_$(date +%Y_%m_%d).md

Explore flags:
  --corpus, -c       Path to candidate registry JSON
  --artifact, -a     Path to artifact on disk (used in placeholders)
  --link             Public URL to the artifact (used in briefings)
  --subject, -s      Phrase describing the artifact (one short clause)
  --license          License string ("CC BY 4.0", "MIT", "Apache 2.0")
  --context          Optional free-form context for templates
  --tags, -t         Comma-separated tag query; matches any-overlap
  --recency-days     Exclude candidates pitched within N days (default 14)
  --tier             Override tier label assigned to all assembled entries
  --title            Override briefing document title
  --output, -o       Path to write the generated briefing

Sender flags for outreach (defaults shown):
  --from isaacsight@gmail.com
  --display-name "Isaac Hernandez"
  --keychain kbot-gmail-app-password
  --delay 500

Setup (one-time, macOS):
  security add-generic-password -U \\
    -a isaacsight@gmail.com \\
    -s kbot-gmail-app-password \\
    -w '<16-char-app-password>'

Briefing format:
  See ROLE.md or .claude/OUTREACH_*.md examples in the kernel.chat repo.

`.trim())
}

async function main(): Promise<void> {
  const positionals = process.argv.slice(2)
  const command = positionals[0] ?? 'help'
  const rest = positionals.slice(1)

  switch (command) {
    case 'outreach': {
      const args = parseOutreachArgs(rest)
      await cmdOutreach(args)
      break
    }
    case 'explore': {
      const args = parseExploreArgs(rest)
      cmdExplore(args)
      break
    }
    case 'help':
    case '--help':
    case '-h':
      cmdHelp()
      break
    default:
      console.error(`Unknown command: ${command}`)
      cmdHelp()
      process.exit(1)
  }
}

main().catch((err) => {
  console.error('kbot-orchestrator failed:', err instanceof Error ? err.message : err)
  process.exit(1)
})
