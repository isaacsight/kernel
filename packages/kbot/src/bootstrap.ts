// kbot Bootstrap — Outer-loop optimizer for any project
//
// Most tools help you build. Bootstrap helps you be seen.
// It measures the gap between what your project IS and what the world PERCEIVES,
// then tells you exactly what to fix — highest impact first.
//
// The bootstrap pattern:
//   1. Sense  — measure surfaces (README, npm, GitHub, docs)
//   2. Score  — grade each dimension of visibility
//   3. Gap    — identify the biggest delta between capability and perception
//   4. Act    — recommend (or execute) the single highest-impact fix
//   5. Record — log the run so the next one starts from a higher floor
//
// This is not a feature tool. It's the meta-tool that makes features matter.
//
// Reference: Hernandez, I. (2026). "The Bootstrap Pattern: Outer-Loop
// Optimization for Open Source Projects." kernel.chat/bootstrap

import { existsSync, readFileSync, writeFileSync, readdirSync, statSync } from 'node:fs'
import { join, basename } from 'node:path'
import { execSync } from 'node:child_process'
import chalk from 'chalk'

// ── Types ──

export type SectionStatus = 'pass' | 'warn' | 'fail'

export interface BootstrapSection {
  name: string
  score: number
  maxScore: number
  findings: string[]
  status: SectionStatus
  /** The single highest-impact fix for this section */
  fix?: string
}

export interface BootstrapReport {
  project: string
  score: number
  maxScore: number
  grade: string
  sections: BootstrapSection[]
  topFix: string
  summary: string
  timestamp: string
}

// ── Helpers ──

function execQuiet(cmd: string, timeoutMs = 5000): string | null {
  try {
    return execSync(cmd, { encoding: 'utf-8', timeout: timeoutMs, stdio: 'pipe', cwd: process.cwd() }).trim()
  } catch {
    return null
  }
}

function fileExists(path: string): boolean {
  return existsSync(join(process.cwd(), path))
}

function readFile(path: string): string | null {
  const full = join(process.cwd(), path)
  try {
    return readFileSync(full, 'utf-8')
  } catch {
    return null
  }
}

function gradeFromPercent(pct: number): string {
  if (pct >= 90) return 'A'
  if (pct >= 80) return 'B'
  if (pct >= 70) return 'C'
  if (pct >= 60) return 'D'
  return 'F'
}

// ── GitHub API ──

async function githubRepoData(repo: string): Promise<Record<string, any> | null> {
  try {
    const res = await fetch(`https://api.github.com/repos/${repo}`, {
      headers: { 'User-Agent': 'kbot-bootstrap/1.0', Accept: 'application/vnd.github.v3+json' },
    })
    if (!res.ok) return null
    return res.json()
  } catch {
    return null
  }
}

// ── npm API ──

async function npmData(pkg: string): Promise<Record<string, any> | null> {
  try {
    const res = await fetch(`https://registry.npmjs.org/${pkg}/latest`)
    if (!res.ok) return null
    return res.json()
  } catch {
    return null
  }
}

async function npmDownloads(pkg: string): Promise<{ weekly: number; daily: number } | null> {
  try {
    const [weekRes, dayRes] = await Promise.all([
      fetch(`https://api.npmjs.org/downloads/point/last-week/${pkg}`),
      fetch(`https://api.npmjs.org/downloads/point/last-day/${pkg}`),
    ])
    if (!weekRes.ok || !dayRes.ok) return null
    const [week, day] = await Promise.all([weekRes.json(), dayRes.json()])
    return { weekly: (week as any).downloads, daily: (day as any).downloads }
  } catch {
    return null
  }
}

// ── Sections ──

async function checkFirstImpression(): Promise<BootstrapSection> {
  const section: BootstrapSection = {
    name: 'First Impression',
    score: 0,
    maxScore: 25,
    findings: [],
    status: 'pass',
  }

  // README exists and has substance
  const readme = readFile('README.md')
  if (!readme) {
    section.findings.push('No README.md')
    section.fix = 'Create a README.md — this is the first thing anyone sees'
    section.status = 'fail'
    return section
  }

  section.score += 2
  section.findings.push('README.md exists')

  // Length check
  if (readme.length > 2000) {
    section.score += 3
    section.findings.push(`README is substantial (${(readme.length / 1024).toFixed(1)}KB)`)
  } else if (readme.length > 500) {
    section.score += 1
    section.findings.push('README is short — consider expanding')
  } else {
    section.findings.push('README is too short (under 500 chars)')
    section.fix = 'Expand your README — explain what this does and why someone should care'
  }

  // Has a GIF/image/screenshot
  const hasImage = /!\[.*\]\(.*\.(gif|png|jpg|jpeg|svg|webp)/i.test(readme) ||
    /<img\s+src=/i.test(readme)
  if (hasImage) {
    section.score += 5
    section.findings.push('Has visual demo (GIF/image)')
  } else {
    section.findings.push('No visual demo — GIFs increase star conversion 5-10x')
    if (!section.fix) section.fix = 'Add a GIF or screenshot to your README — visual demos dramatically increase engagement'
  }

  // Install command
  const hasInstall = /npm (install|i)\s|pip install|cargo install|brew install|go install|curl.*install/i.test(readme)
  if (hasInstall) {
    section.score += 3
    section.findings.push('Has install command')
  } else {
    section.findings.push('No install command in README')
    if (!section.fix) section.fix = 'Add a one-line install command near the top of your README'
  }

  // Quick start / usage examples
  const hasUsage = /quick\s*start|usage|example|getting\s*started/i.test(readme)
  if (hasUsage) {
    section.score += 3
    section.findings.push('Has usage/quickstart section')
  } else {
    section.findings.push('No usage examples')
  }

  // Badges
  const badgeCount = (readme.match(/\[!\[.*\]\(.*\)\]\(.*\)/g) || []).length +
    (readme.match(/<img src="https:\/\/img\.shields\.io/g) || []).length
  if (badgeCount >= 3) {
    section.score += 3
    section.findings.push(`${badgeCount} badges`)
  } else if (badgeCount > 0) {
    section.score += 1
    section.findings.push(`Only ${badgeCount} badge(s) — consider adding version, license, downloads`)
  } else {
    section.findings.push('No badges')
  }

  // Comparison table
  const hasComparison = /\|.*\|.*\|.*\n\|.*---.*\|/m.test(readme) &&
    /compar|vs\b|alternative/i.test(readme)
  if (hasComparison) {
    section.score += 3
    section.findings.push('Has comparison table')
  }

  // Architecture/how it works
  const hasArchitecture = /architect|how it works|under the hood|design/i.test(readme)
  if (hasArchitecture) {
    section.score += 3
    section.findings.push('Has architecture/design section')
  }

  return section
}

async function checkDistribution(packageJson: Record<string, any> | null): Promise<BootstrapSection> {
  const section: BootstrapSection = {
    name: 'Distribution',
    score: 0,
    maxScore: 25,
    findings: [],
    status: 'pass',
  }

  // package.json exists
  if (!packageJson) {
    const hasPkg = fileExists('package.json') || fileExists('Cargo.toml') ||
      fileExists('pyproject.toml') || fileExists('go.mod')
    if (hasPkg) {
      section.score += 2
      section.findings.push('Has package manifest')
    } else {
      section.findings.push('No package manifest found')
      section.fix = 'Add a package manifest (package.json, Cargo.toml, etc.) to make your project installable'
      section.status = 'warn'
    }
    return section
  }

  section.score += 2
  section.findings.push('package.json exists')

  const name = packageJson.name as string | undefined

  // Published to npm
  if (name) {
    const npm = await npmData(name)
    if (npm) {
      section.score += 5
      section.findings.push(`Published on npm: ${name}`)

      // Downloads
      const dl = await npmDownloads(name)
      if (dl) {
        if (dl.weekly > 1000) {
          section.score += 5
          section.findings.push(`${dl.weekly.toLocaleString()}/week downloads`)
        } else if (dl.weekly > 100) {
          section.score += 3
          section.findings.push(`${dl.weekly.toLocaleString()}/week downloads — growing`)
        } else {
          section.score += 1
          section.findings.push(`${dl.weekly.toLocaleString()}/week downloads — low`)
          if (!section.fix) section.fix = 'Downloads are low — focus on launch posts (HN, Reddit, Twitter) to drive awareness'
        }
      }
    } else {
      section.findings.push('Not published on npm')
      if (!section.fix) section.fix = 'Publish to npm — `npm publish --access public`'
    }
  }

  // npm description
  const desc = packageJson.description as string | undefined
  if (desc && desc.length > 50) {
    section.score += 3
    section.findings.push('Has detailed npm description')
  } else if (desc) {
    section.score += 1
    section.findings.push('npm description is short — expand it for better search ranking')
  } else {
    section.findings.push('No npm description')
  }

  // Keywords
  const keywords = packageJson.keywords as string[] | undefined
  if (keywords && keywords.length >= 10) {
    section.score += 3
    section.findings.push(`${keywords.length} npm keywords`)
  } else if (keywords && keywords.length > 0) {
    section.score += 1
    section.findings.push(`Only ${keywords.length} keywords — more = better npm search ranking`)
  } else {
    section.findings.push('No npm keywords')
  }

  // Docker
  if (fileExists('Dockerfile')) {
    section.score += 3
    section.findings.push('Has Dockerfile')
  }

  // Install script
  if (fileExists('install.sh') || fileExists('install.ps1')) {
    section.score += 2
    section.findings.push('Has install script')
  }

  // Homebrew
  const readme = readFile('README.md') || ''
  if (/brew install/i.test(readme)) {
    section.score += 2
    section.findings.push('Has Homebrew formula')
  }

  return section
}

async function checkGitHubPresence(): Promise<BootstrapSection> {
  const section: BootstrapSection = {
    name: 'GitHub Presence',
    score: 0,
    maxScore: 25,
    findings: [],
    status: 'pass',
  }

  // Detect GitHub repo
  const remoteUrl = execQuiet('git remote get-url origin')
  if (!remoteUrl) {
    section.findings.push('No git remote — cannot check GitHub presence')
    section.status = 'warn'
    section.fix = 'Push your project to GitHub'
    return section
  }

  // Extract owner/repo
  const match = remoteUrl.match(/github\.com[/:]([\w.-]+)\/([\w.-]+?)(?:\.git)?$/)
  if (!match) {
    section.findings.push('Remote is not GitHub')
    section.score += 2
    return section
  }

  const repo = `${match[1]}/${match[2]}`
  section.findings.push(`GitHub: ${repo}`)

  const data = await githubRepoData(repo)
  if (!data) {
    section.findings.push('Could not fetch GitHub data (rate limited or private)')
    section.score += 2
    return section
  }

  // Stars
  const stars = data.stargazers_count || 0
  if (stars >= 100) {
    section.score += 8
    section.findings.push(`${stars} stars — strong social proof`)
  } else if (stars >= 10) {
    section.score += 4
    section.findings.push(`${stars} stars — building momentum`)
  } else {
    section.score += 1
    section.findings.push(`${stars} star(s) — the first impression isn't converting to stars`)
    if (!section.fix) section.fix = 'Stars are low — improve README visual (add GIF), then post to HN/Reddit/Twitter'
  }

  // Description
  if (data.description) {
    section.score += 3
    section.findings.push('Has GitHub description')
  } else {
    section.findings.push('No GitHub description')
    if (!section.fix) section.fix = 'Add a GitHub repo description — it appears in search results'
  }

  // Topics
  if (data.topics?.length >= 5) {
    section.score += 3
    section.findings.push(`${data.topics.length} topics`)
  } else if (data.topics?.length > 0) {
    section.score += 1
    section.findings.push(`Only ${data.topics.length} topic(s) — add more for discoverability`)
  } else {
    section.findings.push('No topics — these help people find your project')
  }

  // License
  if (data.license) {
    section.score += 2
    section.findings.push(`License: ${data.license.spdx_id}`)
  } else {
    section.findings.push('No license — many developers won\'t use unlicensed projects')
    if (!section.fix) section.fix = 'Add a LICENSE file (MIT is most common for open source)'
  }

  // Activity
  const daysAgo = (Date.now() - new Date(data.pushed_at).getTime()) / 86400000
  if (daysAgo < 7) {
    section.score += 3
    section.findings.push(`Active — last push ${Math.floor(daysAgo)}d ago`)
  } else if (daysAgo < 30) {
    section.score += 2
    section.findings.push(`Last push ${Math.floor(daysAgo)}d ago`)
  } else {
    section.findings.push(`Stale — last push ${Math.floor(daysAgo)}d ago`)
    section.status = 'warn'
  }

  // Community files
  const communityFiles = ['CONTRIBUTING.md', 'CODE_OF_CONDUCT.md', '.github/ISSUE_TEMPLATE']
  let communityCount = 0
  for (const f of communityFiles) {
    if (fileExists(f)) communityCount++
  }
  if (communityCount >= 2) {
    section.score += 3
    section.findings.push(`${communityCount}/3 community files`)
  } else if (communityCount > 0) {
    section.score += 1
    section.findings.push(`${communityCount}/3 community files — add CONTRIBUTING.md and CODE_OF_CONDUCT.md`)
  }

  // Forks and watchers
  if (data.forks_count > 0) {
    section.score += 2
    section.findings.push(`${data.forks_count} fork(s)`)
  }

  // Clone-to-star ratio
  if (stars > 0 && data.forks_count > 0) {
    const ratio = stars / (data.forks_count + stars)
    section.findings.push(`Clone-to-star ratio: ${(ratio * 100).toFixed(1)}%`)
  }

  return section
}

function checkSurfaceCoherence(packageJson: Record<string, any> | null): BootstrapSection {
  const section: BootstrapSection = {
    name: 'Surface Coherence',
    score: 0,
    maxScore: 25,
    findings: [],
    status: 'pass',
  }

  const readme = readFile('README.md') || ''
  const pkg = packageJson || {}

  // Version consistency
  const pkgVersion = pkg.version as string | undefined
  if (pkgVersion) {
    const versionInReadme = readme.includes(pkgVersion)
    if (versionInReadme) {
      section.score += 3
      section.findings.push(`README mentions current version (${pkgVersion})`)
    } else {
      section.findings.push(`README doesn't mention version ${pkgVersion}`)
    }
  }

  // Description consistency
  const pkgDesc = pkg.description as string | undefined
  if (pkgDesc && readme.length > 100) {
    // Check if key phrases from npm description appear in README
    const keyWords = pkgDesc.split(/\s+/).filter(w => w.length > 5).slice(0, 5)
    const matchCount = keyWords.filter(w => readme.toLowerCase().includes(w.toLowerCase())).length
    if (matchCount >= 3) {
      section.score += 3
      section.findings.push('npm description aligns with README')
    } else {
      section.findings.push('npm description and README tell different stories')
      if (!section.fix) section.fix = 'Align your npm description with your README — they should tell the same story'
    }
  }

  // Changelog / What's New
  const hasChangelog = fileExists('CHANGELOG.md') || /what.s new|changelog|release/i.test(readme)
  if (hasChangelog) {
    section.score += 3
    section.findings.push('Has changelog or "What\'s New" section')
  } else {
    section.findings.push('No changelog — users want to know what changed')
  }

  // ROADMAP
  if (fileExists('ROADMAP.md') || /roadmap/i.test(readme)) {
    section.score += 3
    section.findings.push('Has roadmap')
  }

  // Links consistency
  const links: string[] = []
  if (/npmjs\.com/i.test(readme)) links.push('npm')
  if (/github\.com/i.test(readme)) links.push('GitHub')
  if (/discord/i.test(readme)) links.push('Discord')
  if (/twitter\.com|x\.com/i.test(readme)) links.push('Twitter/X')
  if (links.length >= 3) {
    section.score += 3
    section.findings.push(`${links.length} links: ${links.join(', ')}`)
  } else if (links.length > 0) {
    section.score += 1
    section.findings.push(`Only ${links.length} link(s) — add npm, GitHub, Discord, Twitter`)
  } else {
    section.findings.push('No community links in README')
  }

  // SEO files
  if (fileExists('robots.txt')) { section.score += 1; section.findings.push('Has robots.txt') }
  if (fileExists('sitemap.xml')) { section.score += 1; section.findings.push('Has sitemap.xml') }

  // Count surface files that mention the project name
  const name = pkg.name as string | undefined
  if (name) {
    const surfaceFiles = ['README.md', 'CONTRIBUTING.md', 'ROADMAP.md', 'package.json']
    const existing = surfaceFiles.filter(f => fileExists(f))
    section.score += Math.min(4, existing.length)
    section.findings.push(`${existing.length}/${surfaceFiles.length} surface files present`)
  } else {
    section.score += 2
  }

  // Staleness detection
  const gitLog = execQuiet('git log -1 --format=%H -- README.md')
  const lastCommit = execQuiet('git log -1 --format=%H')
  if (gitLog && lastCommit) {
    const readmeAge = execQuiet('git log -1 --format=%cr -- README.md')
    if (readmeAge) {
      section.findings.push(`README last updated: ${readmeAge}`)
      if (/month|year/i.test(readmeAge)) {
        section.findings.push('README may be stale — review for accuracy')
        if (!section.fix) section.fix = 'Your README hasn\'t been updated recently — review it for stale numbers, versions, and feature lists'
      } else {
        section.score += 4
      }
    }
  }

  return section
}

// ── Main ──

export async function runBootstrap(): Promise<BootstrapReport> {
  const projectName = basename(process.cwd())

  // Load package.json if it exists
  let packageJson: Record<string, any> | null = null
  try {
    packageJson = JSON.parse(readFileSync(join(process.cwd(), 'package.json'), 'utf-8'))
  } catch { /* not a Node project */ }

  // Run all checks in parallel where possible
  const [firstImpression, distribution, githubPresence] = await Promise.all([
    checkFirstImpression(),
    checkDistribution(packageJson),
    checkGitHubPresence(),
  ])

  // Surface coherence is sync (reads local files only)
  const surfaceCoherence = checkSurfaceCoherence(packageJson)

  const sections = [firstImpression, distribution, githubPresence, surfaceCoherence]

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

  // Find the top fix — lowest-scoring section with a fix
  const withFixes = sections.filter(s => s.fix).sort((a, b) => {
    const aPct = a.score / a.maxScore
    const bPct = b.score / b.maxScore
    return aPct - bPct // lowest percentage first = highest impact
  })
  const topFix = withFixes[0]?.fix || 'All sections look good — focus on sharing your project'

  // Summary
  const fails = sections.filter(s => s.status === 'fail')
  const warns = sections.filter(s => s.status === 'warn')
  const summary = fails.length > 0
    ? `${fails.length} critical gap(s). Your project is invisible in ${fails.map(s => s.name.toLowerCase()).join(', ')}.`
    : warns.length > 0
      ? `${warns.length} area(s) need work. Fix the top recommendation to compound.`
      : 'Strong visibility. Focus on distribution — post, share, submit to lists.'

  return {
    project: packageJson?.name || projectName,
    score: totalScore,
    maxScore: totalMax,
    grade,
    sections,
    topFix,
    summary,
    timestamp: new Date().toISOString(),
  }
}

// ── Formatting ──

export function formatBootstrapReport(report: BootstrapReport): string {
  const statusIcon = (s: string) => s === 'pass' ? '✅' : s === 'warn' ? '⚠️' : '❌'
  const pct = Math.round((report.score / report.maxScore) * 100)

  const lines: string[] = []

  // Header
  lines.push('')
  lines.push(chalk.bold(`  kbot Bootstrap — ${report.project}`))
  lines.push(chalk.dim(`  ──────────────────────────────────────────────────`))
  lines.push('')
  lines.push(`  ${chalk.bold('Score:')} ${report.score}/${report.maxScore} (${pct}%) — Grade ${chalk.bold(report.grade)}`)
  lines.push(`  ${chalk.dim(report.summary)}`)
  lines.push('')

  // Sections
  for (const section of report.sections) {
    const sPct = section.maxScore > 0 ? Math.round((section.score / section.maxScore) * 100) : 0
    const icon = section.status === 'pass' ? chalk.green('✓') : section.status === 'warn' ? chalk.yellow('!') : chalk.red('✗')
    lines.push(`  ${icon} ${chalk.bold(section.name)}${chalk.dim(` — ${section.score}/${section.maxScore} (${sPct}%)`)}`)

    for (const f of section.findings) {
      lines.push(`    ${chalk.dim('·')} ${f}`)
    }

    if (section.fix && section.status !== 'pass') {
      lines.push(`    ${chalk.yellow('→')} ${chalk.yellow(section.fix)}`)
    }

    lines.push('')
  }

  // Top fix
  lines.push(chalk.dim(`  ──────────────────────────────────────────────────`))
  lines.push(`  ${chalk.bold('Top fix:')} ${report.topFix}`)
  lines.push('')
  lines.push(chalk.dim(`  The bootstrap pattern: close the gap between what your project IS`))
  lines.push(chalk.dim(`  and what the world PERCEIVES. Fix one thing per run. Compound.`))
  lines.push('')

  return lines.join('\n')
}

export function formatBootstrapMarkdown(report: BootstrapReport): string {
  const statusIcon = (s: string) => s === 'pass' ? '✅' : s === 'warn' ? '⚠️' : '❌'
  const pct = Math.round((report.score / report.maxScore) * 100)

  const lines: string[] = [
    `# Bootstrap Report: ${report.project}`,
    '',
    `> Generated by [kbot](https://www.npmjs.com/package/@kernel.chat/kbot) — the outer-loop optimizer`,
    '',
    `## Score: ${report.score}/${report.maxScore} (${pct}%) — Grade ${report.grade}`,
    '',
    `**${report.summary}**`,
    '',
  ]

  for (const section of report.sections) {
    const sPct = section.maxScore > 0 ? Math.round((section.score / section.maxScore) * 100) : 0
    lines.push(`### ${statusIcon(section.status)} ${section.name} — ${section.score}/${section.maxScore} (${sPct}%)`)
    for (const f of section.findings) {
      lines.push(`- ${f}`)
    }
    if (section.fix && section.status !== 'pass') {
      lines.push(`- **Fix:** ${section.fix}`)
    }
    lines.push('')
  }

  lines.push('---')
  lines.push('')
  lines.push(`**Top fix:** ${report.topFix}`)
  lines.push('')
  lines.push(`*The bootstrap pattern: close the gap between what your project IS and what the world PERCEIVES.*`)
  lines.push(`*Fix one thing per run. Compound.*`)
  lines.push('')
  lines.push(`*[kbot](https://www.npmjs.com/package/@kernel.chat/kbot) — 22 agents, 284 tools, 20 providers*`)

  return lines.join('\n')
}
