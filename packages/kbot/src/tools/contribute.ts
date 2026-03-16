// K:BOT Contribute Tools — Find issues, generate fixes, open PRs
//
// Makes kbot a visible participant in open source.
// Every PR has kbot branding. Every contribution is a billboard.

import { registerTool } from './index.js'
import { execSync } from 'node:child_process'
import { existsSync, mkdirSync } from 'node:fs'
import { join } from 'node:path'
import { homedir } from 'node:os'

const GITHUB_API = 'https://api.github.com'
const HEADERS = {
  'User-Agent': 'KBot/2.18 (Contribute)',
  'Accept': 'application/vnd.github.v3+json',
}

async function githubFetch(path: string): Promise<any> {
  const res = await fetch(`${GITHUB_API}${path}`, { headers: HEADERS })
  if (!res.ok) throw new Error(`GitHub API ${res.status}: ${path}`)
  return res.json()
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
        // Use -- to prevent option injection, write commit msg via stdin to avoid shell injection
        execSync(`cd "${repoDir}" && git add -A`, { encoding: 'utf-8', timeout: 10000 })
        execSync(`cd "${repoDir}" && git commit --file=-`, {
          encoding: 'utf-8', timeout: 10000,
          input: commitMsg,
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

        // Use env vars to safely pass user input without shell injection
        const prUrl = execSync(
          `cd "${repoDir}" && gh pr create --repo "$KBOT_PR_REPO" --title "$KBOT_PR_TITLE" --body "$KBOT_PR_BODY"`,
          { encoding: 'utf-8', timeout: 30000, env: { ...process.env, KBOT_PR_REPO: repo, KBOT_PR_TITLE: String(args.title), KBOT_PR_BODY: prBody } },
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

      const rawCheck = async (path: string) => {
        try {
          const res = await fetch(
            `https://raw.githubusercontent.com/${repo}/main/${path}`,
            { headers: { 'User-Agent': 'KBot/2.18' } },
          )
          if (res.ok) return res.text()
          const res2 = await fetch(
            `https://raw.githubusercontent.com/${repo}/master/${path}`,
            { headers: { 'User-Agent': 'KBot/2.18' } },
          )
          if (res2.ok) return res2.text()
        } catch { /* ignore */ }
        return null
      }

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
        const content = await rawCheck(check.file)
        if (!content) wins.push(check.win)
      }

      // Check README quality
      const readme = await rawCheck('README.md')
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
      const ci = await rawCheck('.github/workflows/ci.yml') || await rawCheck('.github/workflows/ci.yaml') || await rawCheck('.github/workflows/test.yml')
      if (!ci) wins.push('Set up GitHub Actions CI/CD')

      // Check gitignore
      const gitignore = await rawCheck('.gitignore')
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
}
