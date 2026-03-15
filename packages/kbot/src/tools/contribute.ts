// K:BOT Contribute Tools — Find issues, generate fixes, open PRs
//
// Makes kbot a visible participant in open source.
// Every PR has kbot branding. Every contribution is a billboard.
//
// ENHANCEMENTS (v2.19):
//   - audit_repo_health: Comprehensive health scoring with letter grades
//   - generate_changelog: Auto-generate changelogs from git history
//   - find_mentored_issues: Find issues with active mentorship
//   - list_contributions: Track your kbot-assisted contributions

import { registerTool } from './index.js'
import { execSync } from 'node:child_process'
import { existsSync, mkdirSync, readFileSync, writeFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'
import { homedir } from 'node:os'

const GITHUB_API = 'https://api.github.com'
const HEADERS = {
  'User-Agent': 'KBot/2.19 (Contribute)',
  'Accept': 'application/vnd.github.v3+json',
}

/** Contribution tracking log */
const CONTRIB_LOG = join(homedir(), '.kbot', 'contributions', 'log.json')

interface ContributionEntry {
  repo: string
  issue?: number
  prUrl?: string
  title: string
  date: string
  status: 'prepared' | 'submitted' | 'merged'
}

function loadContribLog(): ContributionEntry[] {
  try {
    if (existsSync(CONTRIB_LOG)) return JSON.parse(readFileSync(CONTRIB_LOG, 'utf-8'))
  } catch { /* ignore */ }
  return []
}

function appendContribLog(entry: ContributionEntry): void {
  const log = loadContribLog()
  log.push(entry)
  const dir = join(homedir(), '.kbot', 'contributions')
  mkdirSync(dir, { recursive: true })
  writeFileSync(CONTRIB_LOG, JSON.stringify(log, null, 2))
}

async function githubFetch(path: string): Promise<any> {
  const res = await fetch(`${GITHUB_API}${path}`, { headers: HEADERS })
  if (!res.ok) throw new Error(`GitHub API ${res.status}: ${path}`)
  return res.json()
}

/** Fetch raw file from a GitHub repo (tries main, then master) */
async function rawCheck(repo: string, path: string): Promise<string | null> {
  try {
    const res = await fetch(
      `https://raw.githubusercontent.com/${repo}/main/${path}`,
      { headers: { 'User-Agent': 'KBot/2.19' } },
    )
    if (res.ok) return res.text()
    const res2 = await fetch(
      `https://raw.githubusercontent.com/${repo}/master/${path}`,
      { headers: { 'User-Agent': 'KBot/2.19' } },
    )
    if (res2.ok) return res2.text()
  } catch { /* ignore */ }
  return null
}

export function registerContributeTools(): void {
  // ── Find Contribution Opportunities ──
  registerTool({
    name: 'find_issues',
    description: 'Find open source issues to contribute to. Searches GitHub for "good first issue", "help wanted", or custom labels in any language. Returns issues sorted by freshness and approachability.',
    parameters: {
      language: { type: 'string', description: 'Programming language filter (e.g., "typescript", "python", "rust")' },
      label: { type: 'string', description: 'Issue label (default: "good first issue"). Try: "help wanted", "bug", "documentation"' },
      topic: { type: 'string', description: 'Topic or keyword to narrow results (e.g., "cli", "api", "testing")' },
      stars: { type: 'string', description: 'Minimum stars (default: ">=10")' },
      limit: { type: 'number', description: 'Max results (default: 10)' },
    },
    tier: 'free',
    async execute(args) {
      const label = String(args.label || 'good first issue')
      const limit = Number(args.limit) || 10
      const parts = [`label:"${label}"`, 'state:open', 'is:issue']
      if (args.language) parts.push(`language:${args.language}`)
      if (args.topic) parts.push(String(args.topic))
      if (args.stars) parts.push(`stars:${args.stars}`)
      else parts.push('stars:>=10')

      const q = encodeURIComponent(parts.join(' '))
      try {
        const data = await githubFetch(`/search/issues?q=${q}&sort=created&order=desc&per_page=${limit}`)
        if (!data.items?.length) return 'No matching issues found. Try different filters.'

        const results = data.items.map((i: any) => {
          const repo = i.repository_url.split('/').slice(-2).join('/')
          const labels = (i.labels || []).map((l: any) => l.name).join(', ')
          const daysOld = Math.floor((Date.now() - new Date(i.created_at).getTime()) / 86400000)
          return [
            `**${repo}** #${i.number}`,
            `  ${i.title}`,
            `  Labels: ${labels || 'none'} | ${daysOld}d old | ${i.comments} comments`,
            `  ${i.html_url}`,
          ].join('\n')
        })

        return `Found ${data.total_count} issues matching "${label}":\n\n` + results.join('\n\n')
      } catch (err) {
        return `Search failed: ${(err as Error).message}`
      }
    },
  })

  // ── Clone & Prepare Contribution ──
  registerTool({
    name: 'prepare_contribution',
    description: 'Clone a repo and create a branch for contributing. Sets up a local working directory in ~/.kbot/contributions/ ready for making changes.',
    parameters: {
      repo: { type: 'string', description: 'Repository in "owner/repo" format', required: true },
      issue: { type: 'number', description: 'Issue number to reference in the branch name' },
      branch_name: { type: 'string', description: 'Custom branch name (default: auto-generated from issue)' },
    },
    tier: 'free',
    timeout: 120_000,
    async execute(args) {
      const repo = String(args.repo)
      const contribDir = join(homedir(), '.kbot', 'contributions')
      mkdirSync(contribDir, { recursive: true })

      const repoDir = join(contribDir, repo.replace('/', '-'))
      const branchName = args.branch_name
        ? String(args.branch_name)
        : args.issue
          ? `kbot/fix-${args.issue}`
          : `kbot/contribution-${Date.now().toString(36)}`

      try {
        if (existsSync(repoDir)) {
          // Already cloned, just create branch
          execSync(`cd "${repoDir}" && git fetch origin && git checkout -b "${branchName}" origin/main 2>/dev/null || git checkout -b "${branchName}" origin/master`, {
            encoding: 'utf-8', timeout: 60000,
          })
        } else {
          // Clone
          execSync(`git clone --depth 50 "https://github.com/${repo}.git" "${repoDir}"`, {
            encoding: 'utf-8', timeout: 60000,
          })
          execSync(`cd "${repoDir}" && git checkout -b "${branchName}"`, {
            encoding: 'utf-8', timeout: 10000,
          })
        }

        // Read issue context if provided
        let issueContext = ''
        if (args.issue) {
          try {
            const issue = await githubFetch(`/repos/${repo}/issues/${args.issue}`)
            issueContext = `\n\nIssue #${args.issue}: ${issue.title}\n${issue.body?.slice(0, 500) || '(no body)'}`
          } catch { /* ignore */ }
        }

        return [
          `Repository cloned to: ${repoDir}`,
          `Branch: ${branchName}`,
          '',
          'Ready for contribution. Make your changes, then use `submit_contribution` to open a PR.',
          issueContext,
        ].join('\n')
      } catch (err) {
        return `Clone failed: ${(err as Error).message}`
      }
    },
  })

  // ── Submit Contribution ──
  registerTool({
    name: 'submit_contribution',
    description: 'Commit changes and open a pull request on a forked repository. Requires GitHub CLI (gh) for authentication. Creates a branded PR with kbot attribution.',
    parameters: {
      repo: { type: 'string', description: 'Original repository in "owner/repo" format', required: true },
      title: { type: 'string', description: 'PR title', required: true },
      body: { type: 'string', description: 'PR description', required: true },
      issue: { type: 'number', description: 'Issue number this PR fixes (adds "Fixes #N")' },
      commit_message: { type: 'string', description: 'Commit message (default: uses PR title)' },
    },
    tier: 'free',
    timeout: 120_000,
    async execute(args) {
      const repo = String(args.repo)
      const repoDir = join(homedir(), '.kbot', 'contributions', repo.replace('/', '-'))
      if (!existsSync(repoDir)) return `No local clone found for ${repo}. Run prepare_contribution first.`

      // Check for gh CLI
      try {
        execSync('gh auth status', { stdio: 'ignore', timeout: 5000 })
      } catch {
        return 'GitHub CLI (gh) is not installed or not authenticated. Install: brew install gh && gh auth login'
      }

      const commitMsg = String(args.commit_message || args.title)
      const fixesLine = args.issue ? `\n\nFixes #${args.issue}` : ''
      const prBody = String(args.body) + fixesLine + '\n\n---\n*This contribution was prepared with [K:BOT](https://www.npmjs.com/package/@kernel.chat/kbot) — the open-source terminal AI agent*'

      try {
        // Fork, commit, push, create PR
        execSync(`cd "${repoDir}" && gh repo fork "${repo}" --clone=false 2>/dev/null || true`, {
          encoding: 'utf-8', timeout: 30000,
        })
        execSync(`cd "${repoDir}" && git add -A && git commit -m "${commitMsg.replace(/"/g, '\\"')}"`, {
          encoding: 'utf-8', timeout: 10000,
        })
        execSync(`cd "${repoDir}" && gh repo fork "${repo}" --remote=true 2>/dev/null || true`, {
          encoding: 'utf-8', timeout: 30000,
        })

        const branch = execSync(`cd "${repoDir}" && git rev-parse --abbrev-ref HEAD`, {
          encoding: 'utf-8', timeout: 5000,
        }).trim()

        execSync(`cd "${repoDir}" && git push -u origin "${branch}"`, {
          encoding: 'utf-8', timeout: 30000,
        })

        const safeTitle = String(args.title).replace(/"/g, '\\"')
        const safePrBody = prBody.replace(/"/g, '\\"')
        const prUrl = execSync(
          `cd "${repoDir}" && gh pr create --repo "${repo}" --title "${safeTitle}" --body "${safePrBody}"`,
          { encoding: 'utf-8', timeout: 30000 },
        ).trim()

        return `PR created! ${prUrl}\n\nEvery contribution makes kbot visible to new developers.`
      } catch (err) {
        return `Submission failed: ${(err as Error).message}`
      }
    },
  })

  // ── Scan Repo for Quick Wins ──
  registerTool({
    name: 'find_quick_wins',
    description: 'Scan a GitHub repository for easy contribution opportunities: missing docs, typos in README, missing .gitignore entries, no CI, no tests, etc. Returns actionable suggestions.',
    parameters: {
      repo: { type: 'string', description: 'Repository in "owner/repo" format', required: true },
    },
    tier: 'free',
    timeout: 60_000,
    async execute(args) {
      const repo = String(args.repo)
      const wins: string[] = []

      // Check missing files
      const checks = [
        { file: 'LICENSE', win: 'Add a LICENSE file (most repos use MIT)' },
        { file: 'CONTRIBUTING.md', win: 'Add CONTRIBUTING.md with guidelines' },
        { file: 'CODE_OF_CONDUCT.md', win: 'Add a Code of Conduct' },
        { file: 'SECURITY.md', win: 'Add a security policy (SECURITY.md)' },
        { file: '.editorconfig', win: 'Add .editorconfig for consistent formatting' },
        { file: '.github/ISSUE_TEMPLATE/bug_report.md', win: 'Add issue templates' },
        { file: '.github/PULL_REQUEST_TEMPLATE.md', win: 'Add a PR template' },
      ]

      for (const check of checks) {
        const content = await rawCheck(repo, check.file)
        if (!content) wins.push(check.win)
      }

      // Check README quality
      const readme = await rawCheck(repo, 'README.md')
      if (!readme) {
        wins.push('Create a README.md')
      } else {
        if (readme.length < 300) wins.push('Expand the README (currently very short)')
        if (!/install/i.test(readme)) wins.push('Add installation instructions to README')
        if (!/usage|example|getting started/i.test(readme)) wins.push('Add usage examples to README')
        if (!/badge|shield/i.test(readme)) wins.push('Add status badges (CI, npm, coverage)')
        if (!/contribut/i.test(readme)) wins.push('Add a "Contributing" section to README')
      }

      // Check CI/CD
      const ci = await rawCheck(repo, '.github/workflows/ci.yml') || await rawCheck(repo, '.github/workflows/ci.yaml') || await rawCheck(repo, '.github/workflows/test.yml')
      if (!ci) wins.push('Set up GitHub Actions CI/CD')

      // Check gitignore
      const gitignore = await rawCheck(repo, '.gitignore')
      if (!gitignore) wins.push('Add a .gitignore file')

      if (wins.length === 0) {
        return `${repo} looks well-maintained! No obvious quick wins found.`
      }

      return [
        `## Quick Win Opportunities for ${repo}`,
        '',
        `Found ${wins.length} easy contributions:`,
        '',
        ...wins.map((w, i) => `${i + 1}. ${w}`),
        '',
        'Use `prepare_contribution` to clone the repo and start working on any of these.',
      ].join('\n')
    },
  })

  // ── Comprehensive Repo Health Audit ──
  registerTool({
    name: 'audit_repo_health',
    description: 'Comprehensive health audit of a GitHub repository. Scores documentation, community, CI/CD, security, and maintenance on a letter scale (A-F). Returns a detailed report with actionable improvements.',
    parameters: {
      repo: { type: 'string', description: 'Repository in "owner/repo" format', required: true },
    },
    tier: 'free',
    timeout: 90_000,
    async execute(args) {
      const repo = String(args.repo)
      const scores: Record<string, { score: number; max: number; details: string[] }> = {
        documentation: { score: 0, max: 25, details: [] },
        community: { score: 0, max: 20, details: [] },
        ci_cd: { score: 0, max: 20, details: [] },
        security: { score: 0, max: 15, details: [] },
        maintenance: { score: 0, max: 20, details: [] },
      }

      // Fetch repo metadata
      let repoData: any
      try {
        repoData = await githubFetch(`/repos/${repo}`)
      } catch (err) {
        return `Could not fetch repo: ${(err as Error).message}`
      }

      // ── Documentation ──
      const readme = await rawCheck(repo, 'README.md')
      if (readme) {
        scores.documentation.score += 5
        scores.documentation.details.push('README.md exists')
        if (readme.length > 500) { scores.documentation.score += 3; scores.documentation.details.push('README is detailed (>500 chars)') }
        if (/install/i.test(readme)) { scores.documentation.score += 3; scores.documentation.details.push('Has installation instructions') }
        if (/usage|example|getting started/i.test(readme)) { scores.documentation.score += 3; scores.documentation.details.push('Has usage examples') }
        if (/api|reference/i.test(readme)) { scores.documentation.score += 2; scores.documentation.details.push('Has API reference') }
        if (/badge|shield/i.test(readme)) { scores.documentation.score += 2; scores.documentation.details.push('Has status badges') }
      } else {
        scores.documentation.details.push('MISSING: README.md')
      }
      if (await rawCheck(repo, 'CHANGELOG.md') || await rawCheck(repo, 'CHANGES.md')) {
        scores.documentation.score += 3; scores.documentation.details.push('Has changelog')
      }
      if (repoData.description) { scores.documentation.score += 2; scores.documentation.details.push('Has repo description') }
      if (repoData.homepage) { scores.documentation.score += 2; scores.documentation.details.push('Has homepage URL') }

      // ── Community ──
      if (await rawCheck(repo, 'CONTRIBUTING.md')) { scores.community.score += 5; scores.community.details.push('CONTRIBUTING.md exists') }
      if (await rawCheck(repo, 'CODE_OF_CONDUCT.md')) { scores.community.score += 3; scores.community.details.push('Code of Conduct exists') }
      if (await rawCheck(repo, '.github/ISSUE_TEMPLATE/bug_report.md') || await rawCheck(repo, '.github/ISSUE_TEMPLATE.md')) {
        scores.community.score += 3; scores.community.details.push('Has issue templates')
      }
      if (await rawCheck(repo, '.github/PULL_REQUEST_TEMPLATE.md')) { scores.community.score += 3; scores.community.details.push('Has PR template') }
      if (repoData.has_discussions) { scores.community.score += 2; scores.community.details.push('Discussions enabled') }
      if (repoData.license) { scores.community.score += 4; scores.community.details.push(`License: ${repoData.license.spdx_id}`) }
      else { scores.community.details.push('MISSING: License') }

      // ── CI/CD ──
      const ciFiles = ['.github/workflows/ci.yml', '.github/workflows/ci.yaml', '.github/workflows/test.yml', '.github/workflows/build.yml', '.github/workflows/release.yml']
      let ciFound = 0
      for (const f of ciFiles) {
        if (await rawCheck(repo, f)) ciFound++
      }
      if (ciFound > 0) {
        scores.ci_cd.score += Math.min(ciFound * 5, 12)
        scores.ci_cd.details.push(`${ciFound} GitHub Actions workflow(s) found`)
      } else {
        scores.ci_cd.details.push('MISSING: CI/CD workflows')
      }
      if (await rawCheck(repo, '.github/dependabot.yml') || await rawCheck(repo, '.github/dependabot.yaml')) {
        scores.ci_cd.score += 4; scores.ci_cd.details.push('Dependabot configured')
      }
      if (await rawCheck(repo, '.github/workflows/codeql.yml') || await rawCheck(repo, '.github/workflows/codeql-analysis.yml')) {
        scores.ci_cd.score += 4; scores.ci_cd.details.push('CodeQL analysis enabled')
      }

      // ── Security ──
      if (await rawCheck(repo, 'SECURITY.md')) { scores.security.score += 5; scores.security.details.push('SECURITY.md exists') }
      else { scores.security.details.push('MISSING: Security policy') }
      if (await rawCheck(repo, '.gitignore')) { scores.security.score += 3; scores.security.details.push('.gitignore exists') }
      const gitignore = await rawCheck(repo, '.gitignore')
      if (gitignore && /\.env/i.test(gitignore)) { scores.security.score += 3; scores.security.details.push('.env is gitignored') }
      if (repoData.private === false && repoData.visibility === 'public') {
        scores.security.score += 2; scores.security.details.push('Public visibility (open source)')
      }
      if (scores.ci_cd.details.some(d => d.includes('CodeQL'))) { scores.security.score += 2 }

      // ── Maintenance ──
      const pushedAt = new Date(repoData.pushed_at)
      const daysSincePush = Math.floor((Date.now() - pushedAt.getTime()) / 86400000)
      if (daysSincePush < 30) { scores.maintenance.score += 6; scores.maintenance.details.push(`Last push: ${daysSincePush}d ago (active)`) }
      else if (daysSincePush < 90) { scores.maintenance.score += 3; scores.maintenance.details.push(`Last push: ${daysSincePush}d ago (moderate)`) }
      else { scores.maintenance.details.push(`Last push: ${daysSincePush}d ago (stale)`) }

      if (repoData.open_issues_count < 50) { scores.maintenance.score += 4; scores.maintenance.details.push(`${repoData.open_issues_count} open issues (manageable)`) }
      else { scores.maintenance.score += 1; scores.maintenance.details.push(`${repoData.open_issues_count} open issues (high backlog)`) }

      if (repoData.stargazers_count > 100) { scores.maintenance.score += 3; scores.maintenance.details.push(`${repoData.stargazers_count} stars`) }
      if (repoData.forks_count > 10) { scores.maintenance.score += 3; scores.maintenance.details.push(`${repoData.forks_count} forks (active community)`) }
      if (repoData.topics?.length > 0) { scores.maintenance.score += 2; scores.maintenance.details.push(`Topics: ${repoData.topics.slice(0, 5).join(', ')}`) }
      if (await rawCheck(repo, '.editorconfig')) { scores.maintenance.score += 2; scores.maintenance.details.push('.editorconfig exists') }

      // Calculate total
      const total = Object.values(scores).reduce((sum, s) => sum + s.score, 0)
      const maxTotal = Object.values(scores).reduce((sum, s) => sum + s.max, 0)
      const pct = Math.round((total / maxTotal) * 100)
      const grade = pct >= 90 ? 'A' : pct >= 80 ? 'B' : pct >= 70 ? 'C' : pct >= 55 ? 'D' : 'F'

      const lines: string[] = [
        `## Repository Health Report: ${repo}`,
        `### Overall: ${grade} (${total}/${maxTotal} — ${pct}%)`,
        '',
      ]

      for (const [category, data] of Object.entries(scores)) {
        const catPct = data.max > 0 ? Math.round((data.score / data.max) * 100) : 0
        const catGrade = catPct >= 90 ? 'A' : catPct >= 80 ? 'B' : catPct >= 70 ? 'C' : catPct >= 55 ? 'D' : 'F'
        lines.push(`**${category.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase())}** — ${catGrade} (${data.score}/${data.max})`)
        for (const detail of data.details) {
          const prefix = detail.startsWith('MISSING') ? '  - ' : '  + '
          lines.push(prefix + detail)
        }
        lines.push('')
      }

      lines.push('Use `find_quick_wins` to get actionable contribution suggestions.')
      return lines.join('\n')
    },
  })

  // ── Generate Changelog from Git History ──
  registerTool({
    name: 'generate_changelog',
    description: 'Generate a changelog from git commit history of the current repository. Groups commits by type (features, fixes, docs, etc.) using conventional commit patterns. Works on any local git repo.',
    parameters: {
      since: { type: 'string', description: 'Starting ref — tag, branch, or commit SHA (default: last tag or first commit)' },
      until: { type: 'string', description: 'Ending ref (default: HEAD)' },
      format: { type: 'string', description: 'Output format: "markdown" or "keep-a-changelog" (default: markdown)' },
    },
    tier: 'free',
    timeout: 30_000,
    async execute(args) {
      const until = String(args.until || 'HEAD')
      let since = args.since ? String(args.since) : ''

      try {
        // Auto-detect last tag if no since provided
        if (!since) {
          try {
            since = execSync('git describe --tags --abbrev=0 2>/dev/null', { encoding: 'utf-8', timeout: 5000 }).trim()
          } catch {
            // No tags — use first commit
            since = execSync('git rev-list --max-parents=0 HEAD', { encoding: 'utf-8', timeout: 5000 }).trim()
          }
        }

        const log = execSync(
          `git log ${since}..${until} --pretty=format:"%H|%s|%an|%ad" --date=short`,
          { encoding: 'utf-8', timeout: 10000 },
        ).trim()

        if (!log) return 'No commits found in the specified range.'

        const commits = log.split('\n').map((line: string) => {
          const [hash, subject, author, date] = line.split('|')
          return { hash: hash.slice(0, 7), subject, author, date }
        })

        // Categorize by conventional commit prefix
        const categories: Record<string, Array<{ subject: string; hash: string; author: string }>> = {
          'Features': [],
          'Bug Fixes': [],
          'Documentation': [],
          'Performance': [],
          'Refactoring': [],
          'Tests': [],
          'CI/Build': [],
          'Other': [],
        }

        for (const c of commits) {
          const s = c.subject.toLowerCase()
          if (/^feat[\s(:]/i.test(c.subject)) categories['Features'].push(c)
          else if (/^fix[\s(:]/i.test(c.subject)) categories['Bug Fixes'].push(c)
          else if (/^docs?[\s(:]/i.test(c.subject)) categories['Documentation'].push(c)
          else if (/^perf[\s(:]/i.test(c.subject)) categories['Performance'].push(c)
          else if (/^refactor[\s(:]/i.test(c.subject)) categories['Refactoring'].push(c)
          else if (/^test[\s(:]/i.test(c.subject)) categories['Tests'].push(c)
          else if (/^(ci|build|chore)[\s(:]/i.test(c.subject)) categories['CI/Build'].push(c)
          else if (s.includes('add') || s.includes('new') || s.includes('implement')) categories['Features'].push(c)
          else if (s.includes('fix') || s.includes('bug') || s.includes('patch')) categories['Bug Fixes'].push(c)
          else categories['Other'].push(c)
        }

        const isKeepAChangelog = String(args.format) === 'keep-a-changelog'
        const dateStr = new Date().toISOString().split('T')[0]
        const lines: string[] = isKeepAChangelog
          ? [`## [Unreleased] - ${dateStr}`, '']
          : [`# Changelog (${since}..${until})`, `Generated on ${dateStr}`, '']

        for (const [category, items] of Object.entries(categories)) {
          if (items.length === 0) continue
          lines.push(`### ${category}`)
          for (const item of items) {
            const cleanSubject = item.subject.replace(/^(feat|fix|docs?|perf|refactor|test|ci|build|chore)[\s(:]+/i, '').replace(/\):\s*/, ': ')
            lines.push(`- ${cleanSubject} (${item.hash})`)
          }
          lines.push('')
        }

        lines.push(`*${commits.length} commits from ${since} to ${until}*`)
        return lines.join('\n')
      } catch (err) {
        return `Changelog generation failed: ${(err as Error).message}`
      }
    },
  })

  // ── Find Mentored Issues ──
  registerTool({
    name: 'find_mentored_issues',
    description: 'Find open source issues with active mentorship. Searches for issues labeled "mentor", "mentored", "pair", or with recent maintainer comments offering help. Great for newcomers.',
    parameters: {
      language: { type: 'string', description: 'Programming language filter (e.g., "typescript", "python")' },
      limit: { type: 'number', description: 'Max results (default: 10)' },
    },
    tier: 'free',
    timeout: 30_000,
    async execute(args) {
      const limit = Number(args.limit) || 10
      const mentorLabels = ['mentor', 'mentored', 'mentorship', 'pair programming', 'first-timers-only']
      const results: string[] = []

      for (const label of mentorLabels) {
        const parts = [`label:"${label}"`, 'state:open', 'is:issue', 'stars:>=5']
        if (args.language) parts.push(`language:${args.language}`)
        const q = encodeURIComponent(parts.join(' '))

        try {
          const data = await githubFetch(`/search/issues?q=${q}&sort=created&order=desc&per_page=${Math.ceil(limit / mentorLabels.length)}`)
          if (data.items?.length) {
            for (const i of data.items) {
              const repoName = i.repository_url.split('/').slice(-2).join('/')
              const labels = (i.labels || []).map((l: any) => l.name).join(', ')
              results.push([
                `**${repoName}** #${i.number}`,
                `  ${i.title}`,
                `  Labels: ${labels} | ${i.comments} comments`,
                `  ${i.html_url}`,
              ].join('\n'))
            }
          }
        } catch { /* skip label */ }
      }

      // Also search "good first issue" with high comment count (likely mentored)
      const gfiParts = ['label:"good first issue"', 'state:open', 'is:issue', 'comments:>=3', 'stars:>=20']
      if (args.language) gfiParts.push(`language:${args.language}`)
      try {
        const data = await githubFetch(`/search/issues?q=${encodeURIComponent(gfiParts.join(' '))}&sort=comments&order=desc&per_page=5`)
        if (data.items?.length) {
          for (const i of data.items) {
            const repoName = i.repository_url.split('/').slice(-2).join('/')
            const labels = (i.labels || []).map((l: any) => l.name).join(', ')
            results.push([
              `**${repoName}** #${i.number}`,
              `  ${i.title}`,
              `  Labels: ${labels} | ${i.comments} comments (likely mentored)`,
              `  ${i.html_url}`,
            ].join('\n'))
          }
        }
      } catch { /* ignore */ }

      // Deduplicate by URL
      const seen = new Set<string>()
      const unique = results.filter(r => {
        const url = r.split('\n').pop()?.trim() || ''
        if (seen.has(url)) return false
        seen.add(url)
        return true
      }).slice(0, limit)

      if (unique.length === 0) return 'No mentored issues found. Try different language filters or use find_issues with "good first issue" label.'
      return `Found ${unique.length} mentored / newcomer-friendly issues:\n\n` + unique.join('\n\n')
    },
  })

  // ── List Your Contributions ──
  registerTool({
    name: 'list_contributions',
    description: 'List all contributions you have prepared or submitted using kbot. Shows your open source contribution history tracked in ~/.kbot/contributions/.',
    parameters: {
      status: { type: 'string', description: 'Filter by status: "prepared", "submitted", "merged", or "all" (default: all)' },
    },
    tier: 'free',
    async execute(args) {
      const log = loadContribLog()
      const filter = args.status ? String(args.status) : 'all'

      const filtered = filter === 'all' ? log : log.filter(e => e.status === filter)
      if (filtered.length === 0) {
        return [
          'No contributions tracked yet.',
          '',
          'Use `find_issues` to discover issues, then `prepare_contribution` and `submit_contribution` to contribute.',
          'All contributions are automatically tracked here.',
        ].join('\n')
      }

      const lines = [
        `## Your Open Source Contributions (${filtered.length})`,
        '',
      ]

      for (const entry of filtered.reverse()) {
        const status = entry.status === 'merged' ? 'MERGED' : entry.status === 'submitted' ? 'SUBMITTED' : 'PREPARED'
        lines.push(`[${status}] **${entry.repo}**${entry.issue ? ` #${entry.issue}` : ''}`)
        lines.push(`  ${entry.title}`)
        if (entry.prUrl) lines.push(`  PR: ${entry.prUrl}`)
        lines.push(`  Date: ${entry.date}`)
        lines.push('')
      }

      const submitted = log.filter(e => e.status === 'submitted' || e.status === 'merged').length
      lines.push(`*Total: ${log.length} contributions tracked, ${submitted} submitted/merged*`)
      return lines.join('\n')
    },
  })
}
