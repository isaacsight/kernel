// kbot Audit Tools — Full-spectrum audit of any GitHub repository
//
// Security, code quality, documentation, dependency health — all in one report.
// Designed to be shared. Every audit links back to kbot.

import chalk from 'chalk'
import { registerTool } from './index.js'

const GITHUB_API = 'https://api.github.com'
const HEADERS = {
  'User-Agent': 'KBot/3.65 (Audit)',
  'Accept': 'application/vnd.github.v3+json',
}

async function githubFetch(path: string): Promise<any> {
  const res = await fetch(`${GITHUB_API}${path}`, { headers: HEADERS })
  if (!res.ok) throw new Error(`GitHub API ${res.status}: ${path}`)
  return res.json()
}

async function rawFetch(repo: string, path: string, branch = 'main'): Promise<string | null> {
  for (const b of [branch, 'master']) {
    try {
      const res = await fetch(
        `https://raw.githubusercontent.com/${repo}/${b}/${path}`,
        { headers: { 'User-Agent': 'KBot/3.65' } },
      )
      if (res.ok) return res.text()
    } catch { /* try next */ }
  }
  return null
}

interface AuditResult {
  repo: string
  score: number
  maxScore: number
  grade: string
  sections: AuditSection[]
  summary: string
}

interface AuditSection {
  name: string
  score: number
  maxScore: number
  findings: string[]
  status: 'pass' | 'warn' | 'fail'
}

function gradeFromPercent(pct: number): string {
  if (pct >= 90) return 'A'
  if (pct >= 80) return 'B'
  if (pct >= 70) return 'C'
  if (pct >= 60) return 'D'
  return 'F'
}

async function auditRepo(repo: string): Promise<AuditResult> {
  const sections: AuditSection[] = []

  // 1. Repository health
  const repoHealth: AuditSection = { name: 'Repository Health', score: 0, maxScore: 20, findings: [], status: 'pass' }
  try {
    const data = await githubFetch(`/repos/${repo}`)
    if (data.description) { repoHealth.score += 3; repoHealth.findings.push('Has description') }
    else repoHealth.findings.push('Missing description')
    if (data.license) { repoHealth.score += 3; repoHealth.findings.push(`License: ${data.license.spdx_id}`) }
    else { repoHealth.findings.push('No license detected'); repoHealth.status = 'warn' }
    if (data.topics?.length > 0) { repoHealth.score += 2; repoHealth.findings.push(`${data.topics.length} topics`) }
    else repoHealth.findings.push('No topics/tags')
    if (!data.archived) { repoHealth.score += 2 } else repoHealth.findings.push('Repository is archived')
    if (data.has_issues) repoHealth.score += 1
    if (data.has_wiki) repoHealth.score += 1
    // Activity: updated in last 90 days
    const lastUpdate = new Date(data.updated_at)
    const daysAgo = (Date.now() - lastUpdate.getTime()) / 86400000
    if (daysAgo < 30) { repoHealth.score += 4; repoHealth.findings.push(`Active — updated ${Math.floor(daysAgo)}d ago`) }
    else if (daysAgo < 90) { repoHealth.score += 2; repoHealth.findings.push(`Updated ${Math.floor(daysAgo)}d ago`) }
    else { repoHealth.findings.push(`Stale — last updated ${Math.floor(daysAgo)}d ago`); repoHealth.status = 'warn' }
    // Stars as social proof
    if (data.stargazers_count >= 100) { repoHealth.score += 4; repoHealth.findings.push(`${data.stargazers_count} stars`) }
    else if (data.stargazers_count >= 10) { repoHealth.score += 2; repoHealth.findings.push(`${data.stargazers_count} stars`) }
    else repoHealth.findings.push(`${data.stargazers_count} stars`)
  } catch (err) {
    repoHealth.findings.push(`Could not fetch repo: ${(err as Error).message}`)
    repoHealth.status = 'fail'
  }
  sections.push(repoHealth)

  // 2. Documentation
  const docs: AuditSection = { name: 'Documentation', score: 0, maxScore: 15, findings: [], status: 'pass' }
  const readme = await rawFetch(repo, 'README.md')
  if (readme) {
    docs.score += 3; docs.findings.push('Has README.md')
    if (readme.length > 500) { docs.score += 2; docs.findings.push(`README: ${(readme.length / 1024).toFixed(1)}KB`) }
    else docs.findings.push('README is short (< 500 chars)')
    if (/install/i.test(readme)) { docs.score += 2; docs.findings.push('Has install instructions') }
    else docs.findings.push('No install instructions found')
    if (/usage|example|getting started/i.test(readme)) { docs.score += 2; docs.findings.push('Has usage examples') }
    else docs.findings.push('No usage examples')
    if (/api|reference|docs/i.test(readme)) { docs.score += 1 }
    if (/badge|shield/i.test(readme)) { docs.score += 1; docs.findings.push('Has badges') }
  } else {
    docs.findings.push('No README.md found')
    docs.status = 'fail'
  }
  const contributing = await rawFetch(repo, 'CONTRIBUTING.md')
  if (contributing) { docs.score += 2; docs.findings.push('Has CONTRIBUTING.md') }
  const changelog = await rawFetch(repo, 'CHANGELOG.md')
  if (changelog) { docs.score += 2; docs.findings.push('Has CHANGELOG.md') }
  sections.push(docs)

  // 3. Security
  const security: AuditSection = { name: 'Security', score: 0, maxScore: 15, findings: [], status: 'pass' }
  const securityMd = await rawFetch(repo, 'SECURITY.md')
  if (securityMd) { security.score += 3; security.findings.push('Has SECURITY.md') }
  else security.findings.push('No SECURITY.md')
  const gitignore = await rawFetch(repo, '.gitignore')
  if (gitignore) {
    security.score += 2; security.findings.push('Has .gitignore')
    if (/\.env/m.test(gitignore)) { security.score += 3; security.findings.push('.env is gitignored') }
    else { security.findings.push('.env NOT in .gitignore'); security.status = 'warn' }
    if (/node_modules|__pycache__|target\//m.test(gitignore)) security.score += 1
  } else {
    security.findings.push('No .gitignore')
    security.status = 'warn'
  }
  // Check for common security files
  const codeowners = await rawFetch(repo, 'CODEOWNERS') || await rawFetch(repo, '.github/CODEOWNERS')
  if (codeowners) { security.score += 2; security.findings.push('Has CODEOWNERS') }
  // Check branch protection via API (may fail without auth)
  try {
    const branches = await githubFetch(`/repos/${repo}/branches?per_page=5`)
    const defaultBranch = branches.find((b: any) => b.name === 'main' || b.name === 'master')
    if (defaultBranch?.protected) { security.score += 4; security.findings.push('Default branch is protected') }
    else security.findings.push('Default branch is NOT protected')
  } catch { security.findings.push('Could not check branch protection') }
  sections.push(security)

  // 4. Code Quality
  const quality: AuditSection = { name: 'Code Quality', score: 0, maxScore: 20, findings: [], status: 'pass' }
  // Check for linter/formatter configs
  const eslint = await rawFetch(repo, '.eslintrc.json') || await rawFetch(repo, '.eslintrc.js') || await rawFetch(repo, 'eslint.config.js')
  if (eslint) { quality.score += 3; quality.findings.push('Has ESLint config') }
  const prettier = await rawFetch(repo, '.prettierrc') || await rawFetch(repo, '.prettierrc.json')
  if (prettier) { quality.score += 2; quality.findings.push('Has Prettier config') }
  const editorconfig = await rawFetch(repo, '.editorconfig')
  if (editorconfig) { quality.score += 1; quality.findings.push('Has .editorconfig') }
  // TypeScript
  const tsconfig = await rawFetch(repo, 'tsconfig.json')
  if (tsconfig) {
    quality.score += 3; quality.findings.push('Uses TypeScript')
    if (/"strict"\s*:\s*true/i.test(tsconfig)) { quality.score += 2; quality.findings.push('Strict mode enabled') }
  }
  // CI/CD
  const ghaWorkflow = await rawFetch(repo, '.github/workflows/ci.yml') ||
    await rawFetch(repo, '.github/workflows/ci.yaml') ||
    await rawFetch(repo, '.github/workflows/test.yml') ||
    await rawFetch(repo, '.circleci/config.yml') ||
    await rawFetch(repo, '.travis.yml')
  if (ghaWorkflow) { quality.score += 4; quality.findings.push('Has CI/CD pipeline') }
  else quality.findings.push('No CI/CD detected')
  // Tests
  const pkg = await rawFetch(repo, 'package.json')
  if (pkg) {
    try {
      const pkgData = JSON.parse(pkg)
      if (pkgData.scripts?.test && pkgData.scripts.test !== 'echo "Error: no test specified" && exit 1') {
        quality.score += 3; quality.findings.push(`Test script: ${pkgData.scripts.test.slice(0, 60)}`)
      } else {
        quality.findings.push('No test script configured')
        quality.status = 'warn'
      }
      // Check for outdated/vulnerable patterns
      const deps = { ...pkgData.dependencies, ...pkgData.devDependencies }
      const depCount = Object.keys(deps || {}).length
      quality.findings.push(`${depCount} dependencies`)
      if (depCount > 100) { quality.findings.push('High dependency count (>100) — supply chain risk'); quality.status = 'warn' }
    } catch { /* not valid JSON */ }
  }
  const pyproject = await rawFetch(repo, 'pyproject.toml')
  if (pyproject) {
    quality.score += 2; quality.findings.push('Has pyproject.toml')
    if (/\[tool\.pytest/m.test(pyproject)) { quality.score += 2; quality.findings.push('Has pytest config') }
    if (/\[tool\.(ruff|black|isort)/m.test(pyproject)) { quality.score += 1; quality.findings.push('Has Python linter config') }
  }
  const cargoToml = await rawFetch(repo, 'Cargo.toml')
  if (cargoToml) {
    quality.score += 2; quality.findings.push('Uses Rust (Cargo.toml)')
    if (/clippy/i.test(ghaWorkflow || '')) { quality.score += 2; quality.findings.push('Runs clippy in CI') }
  }
  sections.push(quality)

  // 5. Community & Governance
  const community: AuditSection = { name: 'Community', score: 0, maxScore: 15, findings: [], status: 'pass' }
  const coc = await rawFetch(repo, 'CODE_OF_CONDUCT.md')
  if (coc) { community.score += 3; community.findings.push('Has Code of Conduct') }
  if (contributing) community.score += 3
  try {
    const issues = await githubFetch(`/repos/${repo}/issues?state=open&per_page=5`)
    if (Array.isArray(issues)) {
      community.findings.push(`${issues.length}+ open issues`)
      // Check if issues have labels
      const labeled = issues.filter((i: any) => i.labels?.length > 0)
      if (labeled.length > 0) { community.score += 2; community.findings.push('Issues are labeled') }
      // Check for issue templates
      const issueTemplate = await rawFetch(repo, '.github/ISSUE_TEMPLATE/bug_report.md') ||
        await rawFetch(repo, '.github/ISSUE_TEMPLATE.md')
      if (issueTemplate) { community.score += 2; community.findings.push('Has issue templates') }
    }
  } catch { /* rate limited */ }
  const prTemplate = await rawFetch(repo, '.github/PULL_REQUEST_TEMPLATE.md')
  if (prTemplate) { community.score += 2; community.findings.push('Has PR template') }
  try {
    const contributors = await githubFetch(`/repos/${repo}/contributors?per_page=100`)
    if (Array.isArray(contributors)) {
      community.score += Math.min(3, Math.floor(contributors.length / 5))
      community.findings.push(`${contributors.length} contributors`)
    }
  } catch { /* rate limited */ }
  sections.push(community)

  // 6. DevOps & Infrastructure
  const devops: AuditSection = { name: 'DevOps', score: 0, maxScore: 15, findings: [], status: 'pass' }
  const dockerfile = await rawFetch(repo, 'Dockerfile')
  if (dockerfile) {
    devops.score += 3; devops.findings.push('Has Dockerfile')
    if (/HEALTHCHECK/i.test(dockerfile)) { devops.score += 1; devops.findings.push('Docker health check configured') }
    if (/FROM .* AS /i.test(dockerfile)) { devops.score += 1; devops.findings.push('Multi-stage Docker build') }
  }
  const compose = await rawFetch(repo, 'docker-compose.yml') || await rawFetch(repo, 'docker-compose.yaml')
  if (compose) { devops.score += 2; devops.findings.push('Has docker-compose') }
  if (ghaWorkflow) devops.score += 3
  const lockfile = await rawFetch(repo, 'package-lock.json') || await rawFetch(repo, 'yarn.lock') ||
    await rawFetch(repo, 'pnpm-lock.yaml') || await rawFetch(repo, 'Cargo.lock') ||
    await rawFetch(repo, 'poetry.lock')
  if (lockfile !== null) { devops.score += 3; devops.findings.push('Has lockfile (reproducible builds)') }
  else { devops.findings.push('No lockfile'); devops.status = 'warn' }
  const renovate = await rawFetch(repo, 'renovate.json') || await rawFetch(repo, '.github/dependabot.yml')
  if (renovate) { devops.score += 3; devops.findings.push('Has automated dependency updates') }
  sections.push(devops)

  // Calculate totals
  const totalScore = sections.reduce((sum, s) => sum + s.score, 0)
  const totalMax = sections.reduce((sum, s) => sum + s.maxScore, 0)
  const pct = Math.round((totalScore / totalMax) * 100)
  const grade = gradeFromPercent(pct)

  // Set section statuses
  for (const s of sections) {
    const sPct = s.maxScore > 0 ? (s.score / s.maxScore) * 100 : 0
    if (s.status !== 'fail') {
      s.status = sPct >= 60 ? 'pass' : 'warn'
    }
  }

  // Generate summary
  const fails = sections.filter(s => s.status === 'fail')
  const warns = sections.filter(s => s.status === 'warn')
  const summary = fails.length > 0
    ? `${fails.length} critical issue(s) found. ${warns.length} warning(s).`
    : warns.length > 0
      ? `No critical issues. ${warns.length} area(s) need improvement.`
      : 'All checks passed. Well-maintained repository.'

  return { repo, score: totalScore, maxScore: totalMax, grade, sections, summary }
}

function formatAuditReport(result: AuditResult): string {
  const statusIcon = (s: string) => s === 'pass' ? '✅' : s === 'warn' ? '⚠️' : '❌'
  const pct = Math.round((result.score / result.maxScore) * 100)

  const lines: string[] = [
    `# Audit Report: ${result.repo}`,
    '',
    `> Generated by [kbot](https://www.npmjs.com/package/@kernel.chat/kbot) — open-source AI agent`,
    '',
    `## Score: ${result.score}/${result.maxScore} (${pct}%) — Grade ${result.grade}`,
    '',
    `**${result.summary}**`,
    '',
  ]

  for (const section of result.sections) {
    const sPct = section.maxScore > 0 ? Math.round((section.score / section.maxScore) * 100) : 0
    lines.push(`### ${statusIcon(section.status)} ${section.name} — ${section.score}/${section.maxScore} (${sPct}%)`)
    for (const f of section.findings) {
      lines.push(`- ${f}`)
    }
    lines.push('')
  }

  // Badge
  const badgeColor = pct >= 80 ? 'brightgreen' : pct >= 60 ? 'yellow' : 'red'
  const badgeUrl = `https://img.shields.io/badge/kbot_audit-${result.grade}_(${pct}%25)-${badgeColor}`
  lines.push(
    '---',
    '',
    '### Add this badge to your README',
    '',
    '```markdown',
    `[![kbot audit: ${result.grade}](${badgeUrl})](https://www.npmjs.com/package/@kernel.chat/kbot)`,
    '```',
    '',
    `*Audited by [kbot](https://www.npmjs.com/package/@kernel.chat/kbot) — 35 specialist agents, 787+ tools, 20 AI providers*`,
    `*Install: \`npm install -g @kernel.chat/kbot\` | Audit any repo: \`kbot audit owner/repo\`*`,
  )

  return lines.join('\n')
}

/** Generate a compact one-line summary for social sharing */
function formatAuditSummary(result: AuditResult): string {
  const pct = Math.round((result.score / result.maxScore) * 100)
  const fails = result.sections.filter(s => s.status === 'fail').map(s => s.name)
  const warns = result.sections.filter(s => s.status === 'warn').map(s => s.name)
  let summary = `${result.repo}: Grade ${result.grade} (${pct}%)`
  if (fails.length > 0) summary += ` — Critical: ${fails.join(', ')}`
  else if (warns.length > 0) summary += ` — Needs work: ${warns.join(', ')}`
  else summary += ' — Clean bill of health'
  return summary
}

// ── Terminal-styled audit report (chalk) ──────────────────────────────────────

const VIOLET = '#A78BFA'
const GREEN = '#4ADE80'
const YELLOW = '#FBBF24'
const RED = '#F87171'
const DIM = '#6B7280'
const WHITE = '#F9FAFB'

function gradeColor(grade: string): string {
  if (grade === 'A') return GREEN
  if (grade === 'B') return GREEN
  if (grade === 'C') return YELLOW
  if (grade === 'D') return YELLOW
  return RED
}

function statusColor(status: string): string {
  if (status === 'pass') return GREEN
  if (status === 'warn') return YELLOW
  return RED
}

function scoreBar(score: number, max: number, width = 20): string {
  const pct = max > 0 ? score / max : 0
  const filled = Math.round(pct * width)
  const empty = width - filled
  const color = pct >= 0.8 ? GREEN : pct >= 0.6 ? YELLOW : RED
  return chalk.hex(color)('\u2588'.repeat(filled)) + chalk.hex(DIM)('\u2591'.repeat(empty))
}

function boxLine(content: string, width: number): string {
  // Strip ANSI for length calculation
  const stripped = content.replace(/\x1b\[[0-9;]*m/g, '')
  const pad = Math.max(0, width - stripped.length - 4)
  return chalk.hex(DIM)('\u2502') + ' ' + content + ' '.repeat(pad) + ' ' + chalk.hex(DIM)('\u2502')
}

function findingIcon(finding: string, _sectionStatus: string): string {
  // Heuristic: positive findings get check, negative get appropriate icon
  const negative = /^(no |missing |could not |stale |\.env NOT|not |high dep|default branch is NOT)/i
  const warning = /^(readme is short|updated \d+d ago)/i
  if (negative.test(finding)) return chalk.hex(RED)('\u2717')
  if (warning.test(finding)) return chalk.hex(YELLOW)('\u26A0')
  return chalk.hex(GREEN)('\u2713')
}

function formatAuditTerminal(result: AuditResult): string {
  const pct = Math.round((result.score / result.maxScore) * 100)
  const gc = gradeColor(result.grade)
  const lines: string[] = []
  const W = 60 // inner width

  // ── Header box ──
  const title = `AUDIT REPORT: ${result.repo}`
  const titlePad = Math.max(0, W - title.length - 2)
  const leftPad = Math.floor(titlePad / 2)
  const rightPad = titlePad - leftPad

  lines.push('')
  lines.push(
    chalk.hex(VIOLET)('\u256D') +
    chalk.hex(VIOLET)('\u2500'.repeat(leftPad + 1)) +
    chalk.hex(WHITE).bold(` ${title} `) +
    chalk.hex(VIOLET)('\u2500'.repeat(rightPad + 1)) +
    chalk.hex(VIOLET)('\u256E')
  )

  // Grade line inside box
  const gradeLine = `  Grade ${chalk.hex(gc).bold(result.grade)}  ${chalk.hex(DIM)('\u2502')}  ${result.score}/${result.maxScore} (${pct}%)`
  lines.push(boxLine(gradeLine, W + 4))

  // Score bar inside box
  const bar = scoreBar(result.score, result.maxScore, 30)
  const barLine = `  ${bar}  ${chalk.hex(gc).bold(`${pct}%`)}`
  lines.push(boxLine(barLine, W + 4))

  // Summary inside box
  lines.push(boxLine('', W + 4))
  lines.push(boxLine(`  ${chalk.hex(WHITE)(result.summary)}`, W + 4))

  // Close header box
  lines.push(
    chalk.hex(VIOLET)('\u2570') +
    chalk.hex(VIOLET)('\u2500'.repeat(W + 2)) +
    chalk.hex(VIOLET)('\u256F')
  )
  lines.push('')

  // ── Sections ──
  for (const section of result.sections) {
    const sPct = section.maxScore > 0 ? Math.round((section.score / section.maxScore) * 100) : 0
    const sc = statusColor(section.status)
    const statusDot = section.status === 'pass'
      ? chalk.hex(GREEN)('\u25CF')
      : section.status === 'warn'
        ? chalk.hex(YELLOW)('\u25CF')
        : chalk.hex(RED)('\u25CF')

    // Section header
    lines.push(
      `  ${statusDot} ${chalk.hex(WHITE).bold(section.name)}  ` +
      chalk.hex(DIM)('\u2500'.repeat(Math.max(1, 40 - section.name.length))) +
      `  ${scoreBar(section.score, section.maxScore, 12)} ` +
      chalk.hex(sc).bold(`${sPct}%`)
    )

    // Findings
    for (const f of section.findings) {
      const icon = findingIcon(f, section.status)
      lines.push(`    ${icon} ${chalk.hex(DIM)(f)}`)
    }
    lines.push('')
  }

  // ── Footer ──
  const sep = chalk.hex(VIOLET)('\u2500'.repeat(W + 2))
  lines.push(sep)
  lines.push('')

  // Badge markdown
  const badgeColor = pct >= 80 ? 'brightgreen' : pct >= 60 ? 'yellow' : 'red'
  const badgeUrl = `https://img.shields.io/badge/kbot_audit-${result.grade}_(${pct}%25)-${badgeColor}`
  lines.push(chalk.hex(VIOLET).bold('  Add this badge to your README:'))
  lines.push('')
  lines.push(chalk.hex(DIM)(`  [![kbot audit: ${result.grade}](${badgeUrl})](https://www.npmjs.com/package/@kernel.chat/kbot)`))
  lines.push('')

  // Install CTA
  lines.push(
    chalk.hex(DIM)('  Audited by ') +
    chalk.hex(VIOLET).bold('kbot') +
    chalk.hex(DIM)(' \u2014 35 specialist agents, 787+ tools, 20 AI providers')
  )
  lines.push(
    chalk.hex(DIM)('  Install: ') +
    chalk.hex(WHITE)('npm install -g @kernel.chat/kbot') +
    chalk.hex(DIM)('  |  Audit any repo: ') +
    chalk.hex(WHITE)('kbot audit owner/repo')
  )
  lines.push('')

  return lines.join('\n')
}

export function registerAuditTools(): void {
  registerTool({
    name: 'repo_audit',
    description: 'Run a full audit on any GitHub repository. Checks security, documentation, code quality, CI/CD, community health, and DevOps practices. Returns a scored report with grade (A-F). Use to evaluate any open-source project before using or contributing.',
    parameters: {
      repo: { type: 'string', description: 'Repository in "owner/repo" format (e.g., "facebook/react")', required: true },
    },
    tier: 'free',
    timeout: 60_000,
    async execute(args) {
      const repo = String(args.repo)
      try {
        const result = await auditRepo(repo)
        return formatAuditReport(result)
      } catch (err) {
        return `Audit failed: ${err instanceof Error ? err.message : String(err)}`
      }
    },
  })
}

// Export for CLI subcommand
export { auditRepo, formatAuditReport, formatAuditTerminal }
