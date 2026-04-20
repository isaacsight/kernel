#!/usr/bin/env tsx
/**
 * kbot reality-probe harness.
 *
 * Runs a fixed probe set against the installed `kbot` CLI and checks the
 * output against a declarative assertion. Reports pass/fail per category.
 *
 * Usage:
 *   npm run eval                     # run all probes
 *   npm run eval -- --category math  # one category
 *   npm run eval -- --probe math-01-big-mul  # one probe
 *
 * Exit code is 0 iff every probe passes. CI can wire this into the
 * release pipeline once a green baseline exists.
 */

import { execFileSync, spawnSync } from 'node:child_process'
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

type AssertionType = 'contains' | 'not_contains' | 'regex' | 'equals'

interface Assertion {
  type: AssertionType
  value: string
}

interface Probe {
  id: string
  category: string
  prompt: string
  assertion: Assertion
  note?: string
}

interface ProbeSet {
  version: number
  description: string
  probes: Probe[]
}

interface Result {
  probe: Probe
  output: string
  passed: boolean
  failureReason?: string
  durationMs: number
}

const COLOR = process.stdout.isTTY
const red = (s: string) => COLOR ? `\x1b[31m${s}\x1b[0m` : s
const green = (s: string) => COLOR ? `\x1b[32m${s}\x1b[0m` : s
const yellow = (s: string) => COLOR ? `\x1b[33m${s}\x1b[0m` : s
const dim = (s: string) => COLOR ? `\x1b[2m${s}\x1b[0m` : s

function resolveKbotVersion(): string {
  const here = dirname(fileURLToPath(import.meta.url))
  const pkg = JSON.parse(readFileSync(join(here, '..', 'package.json'), 'utf-8'))
  return pkg.version as string
}

function loadProbes(version: string): Probe[] {
  const here = dirname(fileURLToPath(import.meta.url))
  const raw = readFileSync(join(here, 'probes.json'), 'utf-8')
  const set = JSON.parse(raw) as ProbeSet
  return set.probes.map(p => ({
    ...p,
    prompt: p.prompt.replaceAll('__KBOT_VERSION__', version),
    assertion: {
      ...p.assertion,
      value: p.assertion.value.replaceAll('__KBOT_VERSION__', version),
    },
  }))
}

/**
 * Resolve an absolute `kbot` path, skipping any local `node_modules/.bin`
 * shim npm may have prepended. Without this, `npm run eval` from the repo
 * picks up a stale kbot installed in a parent `node_modules` tree, so
 * every probe runs against the wrong binary.
 *
 * Strategy: use `npm root -g` to locate the globally installed
 * `@kernel.chat/kbot` and build the binary path from there. Fall back to
 * a fresh-shell `command -v` lookup, then finally bare `kbot`.
 */
function resolveKbotPath(): string {
  try {
    const globalRoot = execFileSync('npm', ['root', '-g'], {
      encoding: 'utf-8',
      env: { ...process.env, PATH: process.env.PATH ?? '' },
    }).trim()
    if (globalRoot) {
      const candidate = join(globalRoot, '@kernel.chat', 'kbot', 'dist', 'cli.js')
      // dist/cli.js is the shebang'd entry; node will resolve the #! line.
      return candidate
    }
  } catch { /* fall through */ }
  try {
    const out = execFileSync('/bin/sh', ['-lc', 'command -v kbot'], {
      encoding: 'utf-8',
    }).trim()
    if (out && !out.includes('/node_modules/.bin/')) return out
  } catch { /* fall through */ }
  return 'kbot'
}

const KBOT_BIN = resolveKbotPath()

function runKbot(prompt: string): { output: string; ms: number } {
  const start = Date.now()
  const proc = spawnSync(KBOT_BIN, ['--quiet', prompt], {
    encoding: 'utf-8',
    timeout: 60_000,
    maxBuffer: 1024 * 1024,
  })
  const ms = Date.now() - start
  const stdout = proc.stdout ?? ''
  const stderr = proc.stderr ?? ''
  // kbot writes a token footer after the answer — strip it so assertions
  // don't false-positive on "tokens · free" noise.
  const cleaned = (stdout + '\n' + stderr)
    .split('\n')
    .filter(line => !/tokens\s*[·\.·]\s*(free|\$)/.test(line))
    .join('\n')
    .trim()
  return { output: cleaned, ms }
}

function checkAssertion(output: string, a: Assertion): { passed: boolean; reason?: string } {
  const lc = output.toLowerCase()
  const vlc = a.value.toLowerCase()
  switch (a.type) {
    case 'contains':
      return lc.includes(vlc)
        ? { passed: true }
        : { passed: false, reason: `expected substring "${a.value}" not found` }
    case 'not_contains':
      return !lc.includes(vlc)
        ? { passed: true }
        : { passed: false, reason: `forbidden substring "${a.value}" was present` }
    case 'regex': {
      const re = new RegExp(a.value, 'i')
      return re.test(output)
        ? { passed: true }
        : { passed: false, reason: `regex /${a.value}/i did not match` }
    }
    case 'equals':
      return output.trim() === a.value
        ? { passed: true }
        : { passed: false, reason: `expected exactly "${a.value}"` }
  }
}

interface Args {
  category?: string
  probe?: string
  repeat: number
  baseline?: string
  /** When true, do not write snapshots — for ad-hoc runs. */
  noSnapshot: boolean
}

function parseArgs(argv: string[]): Args {
  const out: Args = { repeat: 1, noSnapshot: false }
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === '--category') out.category = argv[i + 1]
    if (argv[i] === '--probe') out.probe = argv[i + 1]
    if (argv[i] === '--repeat') out.repeat = Math.max(1, Number.parseInt(argv[i + 1] ?? '1', 10))
    if (argv[i] === '--baseline') out.baseline = argv[i + 1]
    if (argv[i] === '--no-snapshot') out.noSnapshot = true
  }
  return out
}

interface Snapshot {
  timestamp: string
  packageVersion: string
  installedVersion: string
  totals: { pass: number; fail: number; total: number }
  byCategory: Record<string, { pass: number; fail: number }>
  probes: Array<{
    id: string
    category: string
    passed: boolean
    passCount?: number
    repeatCount?: number
    output: string
    failureReason?: string
    durationMs: number
  }>
}

function writeSnapshot(
  evalDir: string,
  snapshot: Snapshot,
): { latestPath: string; historyPath: string } {
  const resultsDir = join(evalDir, 'results')
  mkdirSync(resultsDir, { recursive: true })
  const latestPath = join(resultsDir, 'latest.json')
  const safeTs = snapshot.timestamp.replace(/[:]/g, '-')
  const historyPath = join(resultsDir, `v${snapshot.packageVersion}-${safeTs}.json`)
  const body = JSON.stringify(snapshot, null, 2)
  writeFileSync(latestPath, body)
  writeFileSync(historyPath, body)
  return { latestPath, historyPath }
}

function loadSnapshot(path: string): Snapshot | null {
  try {
    return JSON.parse(readFileSync(path, 'utf-8')) as Snapshot
  } catch {
    return null
  }
}

function diffSnapshots(baseline: Snapshot, current: Snapshot): {
  regressions: string[]
  fixes: string[]
} {
  const base = new Map(baseline.probes.map(p => [p.id, p.passed] as const))
  const cur = new Map(current.probes.map(p => [p.id, p.passed] as const))
  const regressions: string[] = []
  const fixes: string[] = []
  for (const [id, passedCur] of cur) {
    const passedBase = base.get(id)
    if (passedBase === true && passedCur === false) regressions.push(id)
    if (passedBase === false && passedCur === true) fixes.push(id)
  }
  return { regressions, fixes }
}

function checkKbotInstalled(): boolean {
  try {
    execFileSync(KBOT_BIN, ['--version'], { stdio: 'pipe' })
    return true
  } catch {
    return false
  }
}

async function main() {
  if (!checkKbotInstalled()) {
    console.error(red('kbot not found on PATH. Install with: npm i -g @kernel.chat/kbot'))
    process.exit(2)
  }

  const version = resolveKbotVersion()
  const installed = execFileSync(KBOT_BIN, ['--version'], { encoding: 'utf-8' }).trim()
  console.log(dim(`kbot binary: ${KBOT_BIN}`))
  const argv = parseArgs(process.argv.slice(2))

  let probes = loadProbes(version)
  if (argv.category) probes = probes.filter(p => p.category === argv.category)
  if (argv.probe) probes = probes.filter(p => p.id === argv.probe)

  console.log(dim(`kbot eval — package v${version}, installed kbot v${installed}`))
  if (argv.repeat > 1) console.log(dim(`repeat: ${argv.repeat}x (majority-vote for pass; any fail marks a probe flaky)`))
  console.log(dim(`running ${probes.length} probe(s)\n`))

  interface ProbeRun extends Result {
    passCount: number
    repeatCount: number
    /** True when some runs passed and others failed across repeats. */
    flaky: boolean
  }
  const results: ProbeRun[] = []
  const flakeIds = new Set<string>()

  for (const probe of probes) {
    process.stdout.write(`${dim(probe.category + '/')}${probe.id} `)
    let lastOutput = ''
    let lastReason: string | undefined
    let totalMs = 0
    let passCount = 0
    for (let i = 0; i < argv.repeat; i++) {
      const { output, ms } = runKbot(probe.prompt)
      totalMs += ms
      const check = checkAssertion(output, probe.assertion)
      if (check.passed) passCount++
      // Always remember the last run's details; for failures we want a
      // concrete example to print.
      lastOutput = output
      lastReason = check.reason
    }
    const majorityPassed = passCount * 2 > argv.repeat
    const flaky = argv.repeat > 1 && passCount > 0 && passCount < argv.repeat
    const r: ProbeRun = {
      probe,
      output: lastOutput,
      passed: majorityPassed,
      failureReason: lastReason,
      durationMs: totalMs,
      passCount,
      repeatCount: argv.repeat,
      flaky,
    }
    results.push(r)
    if (flaky) flakeIds.add(probe.id)

    const badge = r.passed ? green('PASS') : red('FAIL')
    const flakeTag = flaky ? yellow(' FLAKY') : ''
    const repeatInfo = argv.repeat > 1 ? dim(` [${passCount}/${argv.repeat}]`) : ''
    console.log(`${badge}${flakeTag}${repeatInfo}${dim(` (${totalMs}ms)`)}`)
    if (!r.passed) {
      console.log(dim('  prompt: ') + probe.prompt)
      console.log(dim('  output: ') + (lastOutput || '(empty)').slice(0, 200))
      console.log(dim('  reason: ') + (lastReason || ''))
    }
  }

  const byCategory = new Map<string, { pass: number; fail: number }>()
  for (const r of results) {
    const key = r.probe.category
    const c = byCategory.get(key) ?? { pass: 0, fail: 0 }
    if (r.passed) c.pass++
    else c.fail++
    byCategory.set(key, c)
  }

  console.log()
  console.log(dim('── Summary ──'))
  for (const [cat, counts] of byCategory) {
    const total = counts.pass + counts.fail
    const label = counts.fail === 0 ? green : counts.pass === 0 ? red : yellow
    console.log(`  ${label(cat.padEnd(22))} ${counts.pass}/${total}`)
  }
  const totalPass = results.filter(r => r.passed).length
  const totalFail = results.length - totalPass
  console.log()
  console.log(
    (totalFail === 0 ? green : red)(`${totalPass}/${results.length} passed`)
      + (flakeIds.size > 0 ? yellow(`  (${flakeIds.size} flaky)`) : ''),
  )

  const snapshot: Snapshot = {
    timestamp: new Date().toISOString(),
    packageVersion: version,
    installedVersion: installed,
    totals: { pass: totalPass, fail: totalFail, total: results.length },
    byCategory: Object.fromEntries(byCategory),
    probes: results.map(r => ({
      id: r.probe.id,
      category: r.probe.category,
      passed: r.passed,
      passCount: r.passCount,
      repeatCount: r.repeatCount,
      output: r.output.slice(0, 500),
      failureReason: r.failureReason,
      durationMs: r.durationMs,
    })),
  }

  const evalDir = dirname(fileURLToPath(import.meta.url))
  if (!argv.noSnapshot) {
    const { latestPath, historyPath } = writeSnapshot(evalDir, snapshot)
    console.log(dim(`snapshot: ${latestPath}`))
    console.log(dim(`history:  ${historyPath}`))
  }

  let regressionCount = 0
  if (argv.baseline) {
    const baseline = loadSnapshot(argv.baseline)
    if (!baseline) {
      console.error(red(`baseline not found: ${argv.baseline}`))
    } else {
      const diff = diffSnapshots(baseline, snapshot)
      console.log()
      console.log(dim('── vs baseline ──'))
      console.log(dim(`  baseline: v${baseline.packageVersion} (${baseline.timestamp})`))
      for (const id of diff.fixes) console.log(green(`  fixed:      ${id}`))
      for (const id of diff.regressions) console.log(red(`  regressed:  ${id}`))
      if (diff.fixes.length === 0 && diff.regressions.length === 0) {
        console.log(dim('  no deltas'))
      }
      regressionCount = diff.regressions.length
    }
  }

  process.exit(totalFail === 0 && regressionCount === 0 ? 0 : 1)
}

main().catch(err => {
  console.error(red('eval harness error:'), err)
  process.exit(2)
})
