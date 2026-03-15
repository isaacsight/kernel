// K:BOT Open Source Tools — Academic, Scientific & Research Open Source
//
// Tools for open-source users working in academia, science, math, and research.
// Covers: arXiv paper discovery, CITATION.cff generation, reproducibility audits,
//         research software discovery, license compatibility, dependency audits,
//         fork synchronization, and community metrics.
//
// Philosophy: Open source is the backbone of science. Every researcher deserves
//             tools that make contributing and maintaining open-source effortless.

import { registerTool } from './index.js'
import { execSync } from 'node:child_process'
import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'

const GITHUB_API = 'https://api.github.com'
const HEADERS = {
  'User-Agent': 'KBot/2.19 (OpenSource)',
  'Accept': 'application/vnd.github.v3+json',
}

async function githubFetch(path: string): Promise<any> {
  const res = await fetch(`${GITHUB_API}${path}`, { headers: HEADERS })
  if (!res.ok) throw new Error(`GitHub API ${res.status}: ${path}`)
  return res.json()
}

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

export function registerOpenSourceTools(): void {

  // ── arXiv Paper Search ──
  registerTool({
    name: 'arxiv_search',
    description: 'Search arXiv for academic papers. Returns titles, authors, abstracts, and links. Useful for finding research relevant to open-source projects, or discovering papers with code.',
    parameters: {
      query: { type: 'string', description: 'Search query (e.g., "transformer attention mechanism", "graph neural networks")', required: true },
      category: { type: 'string', description: 'arXiv category filter (e.g., "cs.AI", "cs.LG", "math.NA", "physics.comp-ph", "stat.ML")' },
      max_results: { type: 'number', description: 'Max results (default: 5, max: 20)' },
      sort_by: { type: 'string', description: 'Sort by: "relevance", "lastUpdatedDate", "submittedDate" (default: relevance)' },
    },
    tier: 'free',
    timeout: 30_000,
    async execute(args) {
      const query = String(args.query)
      const maxResults = Math.min(Number(args.max_results) || 5, 20)
      const sortBy = String(args.sort_by || 'relevance')

      let searchQuery = query
      if (args.category) searchQuery = `cat:${args.category} AND all:${query}`

      const url = `https://export.arxiv.org/api/query?search_query=${encodeURIComponent(searchQuery)}&start=0&max_results=${maxResults}&sortBy=${sortBy}&sortOrder=descending`

      try {
        const res = await fetch(url, { signal: AbortSignal.timeout(15000) })
        if (!res.ok) return `arXiv API error: ${res.status}`
        const xml = await res.text()

        // Parse Atom XML entries
        const entries = xml.split('<entry>').slice(1)
        if (entries.length === 0) return 'No papers found. Try broader search terms.'

        const results = entries.map((entry, i) => {
          const title = entry.match(/<title>([\s\S]*?)<\/title>/)?.[1]?.trim().replace(/\s+/g, ' ') || 'Untitled'
          const summary = entry.match(/<summary>([\s\S]*?)<\/summary>/)?.[1]?.trim().replace(/\s+/g, ' ') || ''
          const published = entry.match(/<published>(.*?)<\/published>/)?.[1]?.slice(0, 10) || ''
          const idMatch = entry.match(/<id>(.*?)<\/id>/)
          const arxivId = idMatch?.[1]?.split('/abs/')[1] || ''
          const arxivUrl = idMatch?.[1] || ''

          // Extract authors
          const authorMatches = [...entry.matchAll(/<author>\s*<name>(.*?)<\/name>/g)]
          const authors = authorMatches.map(m => m[1]).slice(0, 4)
          const authorStr = authors.length > 3 ? `${authors.slice(0, 3).join(', ')} et al.` : authors.join(', ')

          // Extract categories
          const catMatches = [...entry.matchAll(/category term="(.*?)"/g)]
          const cats = catMatches.map(m => m[1]).slice(0, 3).join(', ')

          const shortSummary = summary.length > 200 ? summary.slice(0, 200) + '...' : summary

          return [
            `${i + 1}. **${title}**`,
            `   Authors: ${authorStr}`,
            `   Published: ${published} | Categories: ${cats}`,
            `   ${shortSummary}`,
            `   arXiv: ${arxivUrl}`,
            `   PDF: https://arxiv.org/pdf/${arxivId}`,
          ].join('\n')
        })

        return `## arXiv Results for "${query}"\n\n` + results.join('\n\n')
      } catch (err) {
        return `arXiv search failed: ${(err as Error).message}`
      }
    },
  })

  // ── Find Research Software on GitHub ──
  registerTool({
    name: 'find_research_repos',
    description: 'Find open-source research software repositories on GitHub. Searches by topic (machine-learning, bioinformatics, computational-physics, etc.) and academic indicators like CITATION.cff files.',
    parameters: {
      topic: { type: 'string', description: 'Research topic (e.g., "machine-learning", "bioinformatics", "numerical-methods", "quantum-computing")', required: true },
      language: { type: 'string', description: 'Programming language filter (e.g., "python", "julia", "r", "fortran")' },
      sort: { type: 'string', description: 'Sort by: "stars", "updated", "forks" (default: stars)' },
      limit: { type: 'number', description: 'Max results (default: 10)' },
    },
    tier: 'free',
    timeout: 30_000,
    async execute(args) {
      const topic = String(args.topic)
      const limit = Math.min(Number(args.limit) || 10, 25)
      const sort = String(args.sort || 'stars')

      // Search with research-relevant qualifiers
      const parts = [`topic:${topic}`, 'stars:>=5']
      if (args.language) parts.push(`language:${args.language}`)

      const q = encodeURIComponent(parts.join(' '))
      try {
        const data = await githubFetch(`/search/repositories?q=${q}&sort=${sort}&order=desc&per_page=${limit}`)
        if (!data.items?.length) return 'No research repositories found. Try different topics.'

        const results = await Promise.all(data.items.map(async (r: any) => {
          const hasCitation = await rawCheck(r.full_name, 'CITATION.cff') ? ' [CITATION.cff]' : ''
          const hasPaper = r.description?.toLowerCase().includes('paper') ? ' [paper]' : ''
          const topics = (r.topics || []).slice(0, 5).join(', ')

          return [
            `**${r.full_name}**${hasCitation}${hasPaper}`,
            `  ${r.description?.slice(0, 120) || '(no description)'}`,
            `  Stars: ${r.stargazers_count} | Forks: ${r.forks_count} | Lang: ${r.language || 'n/a'}`,
            `  Topics: ${topics || 'none'}`,
            `  Updated: ${r.pushed_at?.slice(0, 10)} | License: ${r.license?.spdx_id || 'none'}`,
            `  ${r.html_url}`,
          ].join('\n')
        }))

        return `## Research Repos: ${topic}\n\n` + results.join('\n\n')
      } catch (err) {
        return `Search failed: ${(err as Error).message}`
      }
    },
  })

  // ── Generate CITATION.cff ──
  registerTool({
    name: 'generate_citation',
    description: 'Generate a CITATION.cff file for a research repository. CITATION.cff is the standard for making software citable in academic papers. Extracts metadata from package.json, pyproject.toml, or repo info.',
    parameters: {
      repo: { type: 'string', description: 'Repository in "owner/repo" format. If omitted, uses the current directory.' },
      title: { type: 'string', description: 'Software title (default: auto-detected from repo)' },
      doi: { type: 'string', description: 'DOI if published (e.g., "10.5281/zenodo.1234567")' },
      version: { type: 'string', description: 'Version (default: auto-detected)' },
    },
    tier: 'free',
    timeout: 30_000,
    async execute(args) {
      let title = args.title ? String(args.title) : ''
      let version = args.version ? String(args.version) : ''
      let description = ''
      let repoUrl = ''
      let license = ''
      const authors: Array<{ name: string; orcid?: string }> = []

      if (args.repo) {
        // Fetch from GitHub
        const repo = String(args.repo)
        try {
          const repoData = await githubFetch(`/repos/${repo}`)
          title = title || repoData.name
          description = repoData.description || ''
          repoUrl = repoData.html_url
          license = repoData.license?.spdx_id || ''

          // Get contributors as authors
          const contributors = await githubFetch(`/repos/${repo}/contributors?per_page=10`)
          for (const c of contributors.slice(0, 10)) {
            try {
              const user = await githubFetch(`/users/${c.login}`)
              if (user.name) authors.push({ name: user.name })
            } catch { /* skip */ }
          }
        } catch (err) {
          return `Could not fetch repo info: ${(err as Error).message}`
        }

        // Try to get version from package.json or pyproject.toml
        if (!version) {
          const pkg = await rawCheck(repo, 'package.json')
          if (pkg) {
            try { version = JSON.parse(pkg).version || '' } catch { /* ignore */ }
          }
          if (!version) {
            const pyproject = await rawCheck(repo, 'pyproject.toml')
            if (pyproject) {
              const match = pyproject.match(/version\s*=\s*"(.*?)"/)
              if (match) version = match[1]
            }
          }
        }
      } else {
        // Local repo
        try {
          const pkgPath = join(process.cwd(), 'package.json')
          if (existsSync(pkgPath)) {
            const pkg = JSON.parse(readFileSync(pkgPath, 'utf-8'))
            title = title || pkg.name || ''
            version = version || pkg.version || ''
            description = pkg.description || ''
            license = pkg.license || ''
            if (pkg.author) {
              const authorName = typeof pkg.author === 'string' ? pkg.author : pkg.author.name
              if (authorName) authors.push({ name: authorName })
            }
          }

          const pyprojectPath = join(process.cwd(), 'pyproject.toml')
          if (existsSync(pyprojectPath) && !title) {
            const content = readFileSync(pyprojectPath, 'utf-8')
            const nameMatch = content.match(/name\s*=\s*"(.*?)"/)
            const versionMatch = content.match(/version\s*=\s*"(.*?)"/)
            if (nameMatch) title = nameMatch[1]
            if (versionMatch && !version) version = versionMatch[1]
          }

          repoUrl = execSync('git remote get-url origin 2>/dev/null', { encoding: 'utf-8', timeout: 3000 }).trim()
        } catch { /* ignore */ }
      }

      if (!title) title = 'my-software'
      if (authors.length === 0) authors.push({ name: 'Author Name' })

      const dateReleased = new Date().toISOString().split('T')[0]

      // Build CITATION.cff
      const lines = [
        'cff-version: 1.2.0',
        `message: "If you use this software, please cite it as below."`,
        `title: "${title}"`,
        `type: software`,
      ]

      if (version) lines.push(`version: "${version}"`)
      if (args.doi) lines.push(`doi: "${args.doi}"`)
      lines.push(`date-released: "${dateReleased}"`)
      if (repoUrl) lines.push(`repository-code: "${repoUrl}"`)
      if (license) lines.push(`license: ${license}`)
      if (description) lines.push(`abstract: "${description.replace(/"/g, '\\"')}"`)

      lines.push('authors:')
      for (const author of authors) {
        const parts = author.name.split(' ')
        const family = parts.pop() || author.name
        const given = parts.join(' ') || ''
        lines.push(`  - family-names: "${family}"`)
        if (given) lines.push(`    given-names: "${given}"`)
        if (author.orcid) lines.push(`    orcid: "https://orcid.org/${author.orcid}"`)
      }

      return [
        '## Generated CITATION.cff',
        '',
        'Save this as `CITATION.cff` in your repository root:',
        '',
        '```yaml',
        lines.join('\n'),
        '```',
        '',
        'This makes your software citable via GitHub\'s "Cite this repository" button.',
        'Add a DOI via Zenodo (https://zenodo.org) for persistent citation.',
      ].join('\n')
    },
  })

  // ── Reproducibility Audit ──
  registerTool({
    name: 'audit_reproducibility',
    description: 'Audit a research repository for reproducibility best practices. Checks for: pinned dependencies, Dockerfiles, environment files, data availability, random seeds, CI, and documentation. Essential for scientific open source.',
    parameters: {
      repo: { type: 'string', description: 'Repository in "owner/repo" format. If omitted, audits the current directory.' },
    },
    tier: 'free',
    timeout: 60_000,
    async execute(args) {
      const checks: Array<{ category: string; item: string; found: boolean; note: string }> = []
      const isRemote = !!args.repo
      const repo = args.repo ? String(args.repo) : ''

      const checkFile = async (path: string): Promise<string | null> => {
        if (isRemote) return rawCheck(repo, path)
        const fullPath = join(process.cwd(), path)
        if (existsSync(fullPath)) return readFileSync(fullPath, 'utf-8')
        return null
      }

      // ── Environment & Dependencies ──
      const dockerfile = await checkFile('Dockerfile') || await checkFile('docker/Dockerfile')
      checks.push({ category: 'Environment', item: 'Dockerfile', found: !!dockerfile, note: dockerfile ? 'Containerized environment' : 'Add a Dockerfile for reproducible environments' })

      const compose = await checkFile('docker-compose.yml') || await checkFile('docker-compose.yaml')
      checks.push({ category: 'Environment', item: 'Docker Compose', found: !!compose, note: compose ? 'Multi-service setup available' : 'Consider docker-compose for complex setups' })

      const reqTxt = await checkFile('requirements.txt')
      const reqLock = await checkFile('requirements.lock') || await checkFile('poetry.lock') || await checkFile('Pipfile.lock') || await checkFile('uv.lock')
      checks.push({ category: 'Dependencies', item: 'Python lock file', found: !!reqLock, note: reqLock ? 'Pinned Python dependencies' : reqTxt ? 'requirements.txt exists but consider a lock file (poetry.lock, uv.lock)' : 'N/A (no Python detected)' })

      const pkgLock = await checkFile('package-lock.json') || await checkFile('yarn.lock') || await checkFile('pnpm-lock.yaml')
      const pkgJson = await checkFile('package.json')
      checks.push({ category: 'Dependencies', item: 'JS lock file', found: !!pkgLock, note: pkgLock ? 'Pinned JS dependencies' : pkgJson ? 'package.json exists but no lock file' : 'N/A (no JS detected)' })

      const condaEnv = await checkFile('environment.yml') || await checkFile('environment.yaml') || await checkFile('conda.yml')
      checks.push({ category: 'Environment', item: 'Conda environment', found: !!condaEnv, note: condaEnv ? 'Conda environment file found' : 'Consider environment.yml for conda users' })

      const nix = await checkFile('flake.nix') || await checkFile('shell.nix') || await checkFile('default.nix')
      checks.push({ category: 'Environment', item: 'Nix configuration', found: !!nix, note: nix ? 'Nix-based reproducible build' : 'Optional: Nix for fully reproducible builds' })

      // ── Documentation ──
      const readme = await checkFile('README.md')
      checks.push({ category: 'Documentation', item: 'README', found: !!readme, note: readme ? 'README exists' : 'MISSING: Add a README.md' })

      if (readme) {
        const hasReproSteps = /reproduc|replicate|run.*experiment|getting started/i.test(readme)
        checks.push({ category: 'Documentation', item: 'Reproduction steps', found: hasReproSteps, note: hasReproSteps ? 'Includes reproduction instructions' : 'Add step-by-step reproduction instructions' })

        const hasDataInfo = /data|dataset|download.*data|data.*avail/i.test(readme)
        checks.push({ category: 'Documentation', item: 'Data availability', found: hasDataInfo, note: hasDataInfo ? 'Data information documented' : 'Document where to get the data' })
      }

      // ── Citation & Academic ──
      const citation = await checkFile('CITATION.cff') || await checkFile('CITATION.bib') || await checkFile('CITATIONS.md')
      checks.push({ category: 'Academic', item: 'Citation file', found: !!citation, note: citation ? 'Citation information available' : 'Add CITATION.cff for academic citation (use generate_citation tool)' })

      const license = await checkFile('LICENSE') || await checkFile('LICENSE.md') || await checkFile('COPYING')
      checks.push({ category: 'Academic', item: 'License', found: !!license, note: license ? 'License file exists' : 'MISSING: Add a LICENSE (MIT, Apache-2.0, or BSD-3-Clause recommended for research)' })

      // ── Reproducibility Signals ──
      // Check for random seed setting patterns in Python files
      if (isRemote) {
        // Can't easily check code contents remotely, skip this
        checks.push({ category: 'Code Quality', item: 'Random seeds', found: false, note: 'Clone repo to check for random seed pinning' })
      } else {
        try {
          const seedGrep = execSync(
            'grep -rl "random.seed\\|np.random.seed\\|torch.manual_seed\\|tf.random.set_seed\\|set.seed\\|SEED\\s*=" --include="*.py" --include="*.R" . 2>/dev/null | head -5',
            { encoding: 'utf-8', timeout: 5000 },
          ).trim()
          checks.push({ category: 'Code Quality', item: 'Random seeds', found: !!seedGrep, note: seedGrep ? 'Random seeds found in code' : 'Consider setting random seeds for reproducible results' })
        } catch {
          checks.push({ category: 'Code Quality', item: 'Random seeds', found: false, note: 'Consider setting random seeds for reproducible results' })
        }
      }

      // Check for CI
      const ci = await checkFile('.github/workflows/ci.yml') || await checkFile('.github/workflows/test.yml') || await checkFile('.gitlab-ci.yml') || await checkFile('Makefile')
      checks.push({ category: 'CI/Automation', item: 'CI pipeline', found: !!ci, note: ci ? 'Automated testing/building' : 'Add CI to verify reproducibility automatically' })

      const makefile = await checkFile('Makefile')
      checks.push({ category: 'CI/Automation', item: 'Makefile', found: !!makefile, note: makefile ? 'Build automation via Make' : 'Consider a Makefile for common tasks (make train, make evaluate)' })

      // ── Score ──
      const total = checks.length
      const passed = checks.filter(c => c.found).length
      const pct = Math.round((passed / total) * 100)
      const grade = pct >= 90 ? 'A' : pct >= 75 ? 'B' : pct >= 60 ? 'C' : pct >= 40 ? 'D' : 'F'

      const target = isRemote ? repo : process.cwd()
      const lines = [
        `## Reproducibility Audit: ${target}`,
        `### Grade: ${grade} (${passed}/${total} checks passed — ${pct}%)`,
        '',
      ]

      const categories = [...new Set(checks.map(c => c.category))]
      for (const cat of categories) {
        lines.push(`**${cat}**`)
        for (const check of checks.filter(c => c.category === cat)) {
          const icon = check.found ? '+' : '-'
          lines.push(`  ${icon} ${check.item}: ${check.note}`)
        }
        lines.push('')
      }

      if (pct < 70) {
        lines.push('### Priority Improvements')
        const missing = checks.filter(c => !c.found && !c.note.includes('N/A') && !c.note.includes('Optional'))
        for (const m of missing.slice(0, 5)) {
          lines.push(`- ${m.item}: ${m.note}`)
        }
      }

      return lines.join('\n')
    },
  })

  // ── License Compatibility Check ──
  registerTool({
    name: 'check_license_compatibility',
    description: 'Check license compatibility between your project and its dependencies. Identifies potential license conflicts (e.g., GPL dependencies in an MIT project). Works with npm, pip, and cargo projects.',
    parameters: {
      project_license: { type: 'string', description: 'Your project\'s license (e.g., "MIT", "Apache-2.0", "GPL-3.0"). If omitted, auto-detected.' },
    },
    tier: 'free',
    timeout: 30_000,
    async execute(args) {
      let projectLicense = args.project_license ? String(args.project_license) : ''

      // Auto-detect project license
      if (!projectLicense) {
        try {
          const pkgPath = join(process.cwd(), 'package.json')
          if (existsSync(pkgPath)) {
            projectLicense = JSON.parse(readFileSync(pkgPath, 'utf-8')).license || ''
          }
        } catch { /* ignore */ }
        if (!projectLicense) {
          try {
            const pyproject = join(process.cwd(), 'pyproject.toml')
            if (existsSync(pyproject)) {
              const content = readFileSync(pyproject, 'utf-8')
              const match = content.match(/license\s*=\s*\{?\s*(?:text\s*=\s*)?"(.*?)"/i)
              if (match) projectLicense = match[1]
            }
          } catch { /* ignore */ }
        }
      }

      if (!projectLicense) return 'Could not detect project license. Provide it via the project_license parameter.'

      // License compatibility matrix (simplified)
      const permissive = ['MIT', 'ISC', 'BSD-2-Clause', 'BSD-3-Clause', 'Apache-2.0', '0BSD', 'Unlicense', 'CC0-1.0']
      const weakCopyleft = ['LGPL-2.1', 'LGPL-3.0', 'MPL-2.0', 'EPL-2.0']
      const strongCopyleft = ['GPL-2.0', 'GPL-3.0', 'AGPL-3.0']

      const isPermissive = permissive.some(l => projectLicense.toUpperCase().includes(l.toUpperCase()))
      const isWeakCopyleft = weakCopyleft.some(l => projectLicense.toUpperCase().includes(l.toUpperCase()))
      const isStrongCopyleft = strongCopyleft.some(l => projectLicense.toUpperCase().includes(l.toUpperCase()))

      // Get dependency licenses
      const deps: Array<{ name: string; license: string; concern: string }> = []

      // npm dependencies
      try {
        const output = execSync('npm ls --json --depth=0 2>/dev/null', { encoding: 'utf-8', timeout: 15000 })
        const tree = JSON.parse(output)
        for (const [name, info] of Object.entries(tree.dependencies || {})) {
          const depInfo = info as any
          const depPath = join(process.cwd(), 'node_modules', name, 'package.json')
          try {
            if (existsSync(depPath)) {
              const depPkg = JSON.parse(readFileSync(depPath, 'utf-8'))
              const depLicense = depPkg.license || 'UNKNOWN'
              let concern = ''

              if (isPermissive && strongCopyleft.some(l => depLicense.toUpperCase().includes(l.toUpperCase()))) {
                concern = 'CONFLICT: Strong copyleft dep in permissive project'
              } else if (isPermissive && weakCopyleft.some(l => depLicense.toUpperCase().includes(l.toUpperCase()))) {
                concern = 'WARNING: Weak copyleft dep — OK for linking but check distribution terms'
              } else if (depLicense === 'UNKNOWN' || depLicense === 'UNLICENSED') {
                concern = 'WARNING: Unknown license'
              }

              if (concern) deps.push({ name, license: depLicense, concern })
            }
          } catch { /* skip */ }
        }
      } catch { /* not an npm project */ }

      // pip dependencies (if requirements.txt exists)
      try {
        const reqPath = join(process.cwd(), 'requirements.txt')
        if (existsSync(reqPath)) {
          const output = execSync('pip licenses --format=json 2>/dev/null', { encoding: 'utf-8', timeout: 15000 })
          const licenses = JSON.parse(output)
          for (const dep of licenses) {
            const depLicense = dep.License || 'UNKNOWN'
            let concern = ''
            if (isPermissive && strongCopyleft.some(l => depLicense.toUpperCase().includes(l.toUpperCase()))) {
              concern = 'CONFLICT: Strong copyleft dep in permissive project'
            }
            if (concern) deps.push({ name: dep.Name, license: depLicense, concern })
          }
        }
      } catch { /* not a pip project or pip-licenses not installed */ }

      const lines = [
        `## License Compatibility Report`,
        `Project license: **${projectLicense}** (${isPermissive ? 'permissive' : isWeakCopyleft ? 'weak copyleft' : isStrongCopyleft ? 'strong copyleft' : 'other'})`,
        '',
      ]

      if (deps.length === 0) {
        lines.push('No license concerns found in direct dependencies.')
        lines.push('')
        lines.push('Note: This checks direct dependencies only. Run a full audit with dedicated license tools for transitive deps.')
      } else {
        const conflicts = deps.filter(d => d.concern.startsWith('CONFLICT'))
        const warnings = deps.filter(d => d.concern.startsWith('WARNING'))

        if (conflicts.length > 0) {
          lines.push(`### Conflicts (${conflicts.length})`)
          for (const d of conflicts) lines.push(`- **${d.name}** (${d.license}) — ${d.concern}`)
          lines.push('')
        }

        if (warnings.length > 0) {
          lines.push(`### Warnings (${warnings.length})`)
          for (const d of warnings) lines.push(`- **${d.name}** (${d.license}) — ${d.concern}`)
          lines.push('')
        }
      }

      lines.push('### License Compatibility Quick Reference')
      lines.push('- MIT/BSD/ISC/Apache-2.0: Compatible with everything (as deps)')
      lines.push('- LGPL: OK as a dependency (dynamic linking), but check if statically linked')
      lines.push('- GPL: Requires your project to also be GPL if distributed together')
      lines.push('- AGPL: Like GPL but also applies to network use (SaaS)')

      return lines.join('\n')
    },
  })

  // ── Dependency Freshness Audit ──
  registerTool({
    name: 'audit_dependencies',
    description: 'Audit project dependencies for outdated versions, known vulnerabilities, and maintenance status. Works with npm (package.json) and pip (requirements.txt) projects.',
    parameters: {
      focus: { type: 'string', description: 'Focus area: "outdated", "security", or "all" (default: all)' },
    },
    tier: 'free',
    timeout: 60_000,
    async execute(args) {
      const focus = String(args.focus || 'all')
      const lines: string[] = ['## Dependency Audit Report', '']

      // npm project
      const pkgPath = join(process.cwd(), 'package.json')
      if (existsSync(pkgPath)) {
        lines.push('### npm Dependencies')
        lines.push('')

        if (focus === 'all' || focus === 'outdated') {
          try {
            const outdated = execSync('npm outdated --json 2>/dev/null || echo "{}"', { encoding: 'utf-8', timeout: 30000 })
            const data = JSON.parse(outdated)
            const entries = Object.entries(data)
            if (entries.length > 0) {
              lines.push(`**Outdated packages (${entries.length}):**`)
              for (const [name, info] of entries.slice(0, 20)) {
                const d = info as any
                lines.push(`- ${name}: ${d.current || '?'} -> ${d.latest || '?'} (wanted: ${d.wanted || '?'})`)
              }
              if (entries.length > 20) lines.push(`  ... and ${entries.length - 20} more`)
            } else {
              lines.push('All packages are up to date.')
            }
            lines.push('')
          } catch {
            lines.push('Could not check outdated packages (run npm install first).')
            lines.push('')
          }
        }

        if (focus === 'all' || focus === 'security') {
          try {
            const audit = execSync('npm audit --json 2>/dev/null || echo "{}"', { encoding: 'utf-8', timeout: 30000 })
            const data = JSON.parse(audit)
            const vulns = data.vulnerabilities || {}
            const vulnEntries = Object.entries(vulns)
            if (vulnEntries.length > 0) {
              const severityCounts: Record<string, number> = {}
              for (const [, info] of vulnEntries) {
                const v = info as any
                severityCounts[v.severity] = (severityCounts[v.severity] || 0) + 1
              }
              lines.push(`**Security vulnerabilities (${vulnEntries.length}):**`)
              for (const [sev, count] of Object.entries(severityCounts)) {
                lines.push(`- ${sev}: ${count}`)
              }
              lines.push('')
              for (const [name, info] of vulnEntries.slice(0, 10)) {
                const v = info as any
                lines.push(`- ${name} [${v.severity}]: ${v.via?.[0]?.title || v.via?.[0] || 'unknown'}`)
              }
            } else {
              lines.push('No known vulnerabilities found.')
            }
            lines.push('')
          } catch {
            lines.push('Could not run security audit.')
            lines.push('')
          }
        }
      }

      // pip project
      const reqPath = join(process.cwd(), 'requirements.txt')
      if (existsSync(reqPath)) {
        lines.push('### pip Dependencies')
        lines.push('')

        if (focus === 'all' || focus === 'outdated') {
          try {
            const outdated = execSync('pip list --outdated --format=json 2>/dev/null || echo "[]"', { encoding: 'utf-8', timeout: 30000 })
            const data = JSON.parse(outdated)
            if (data.length > 0) {
              lines.push(`**Outdated packages (${data.length}):**`)
              for (const d of data.slice(0, 20)) {
                lines.push(`- ${d.name}: ${d.version} -> ${d.latest_version}`)
              }
            } else {
              lines.push('All packages are up to date.')
            }
            lines.push('')
          } catch {
            lines.push('Could not check outdated packages.')
            lines.push('')
          }
        }

        if (focus === 'all' || focus === 'security') {
          try {
            const audit = execSync('pip-audit --format=json 2>/dev/null || echo "[]"', { encoding: 'utf-8', timeout: 30000 })
            const data = JSON.parse(audit)
            if (data.length > 0) {
              lines.push(`**Vulnerabilities (${data.length}):**`)
              for (const v of data.slice(0, 10)) {
                lines.push(`- ${v.name} ${v.version}: ${v.id} — ${v.description?.slice(0, 80) || 'unknown'}`)
              }
            } else {
              lines.push('No known vulnerabilities.')
            }
            lines.push('')
          } catch {
            lines.push('pip-audit not installed. Install with: pip install pip-audit')
            lines.push('')
          }
        }
      }

      if (!existsSync(pkgPath) && !existsSync(reqPath)) {
        lines.push('No package.json or requirements.txt found in the current directory.')
      }

      return lines.join('\n')
    },
  })

  // ── Fork Sync ──
  registerTool({
    name: 'sync_fork',
    description: 'Synchronize a forked repository with its upstream. Fetches the latest changes from the original repo and merges or rebases your fork. Essential for keeping open-source forks up to date.',
    parameters: {
      upstream: { type: 'string', description: 'Upstream remote name (default: "upstream"). If not configured, provide "owner/repo" to set it up.' },
      branch: { type: 'string', description: 'Branch to sync (default: main or master)' },
      strategy: { type: 'string', description: '"merge" or "rebase" (default: merge)' },
    },
    tier: 'free',
    timeout: 60_000,
    async execute(args) {
      const strategy = String(args.strategy || 'merge')
      let upstream = String(args.upstream || 'upstream')

      try {
        // Check if upstream remote exists
        const remotes = execSync('git remote -v', { encoding: 'utf-8', timeout: 5000 })
        if (!remotes.includes('upstream')) {
          if (args.upstream && String(args.upstream).includes('/')) {
            // Set up upstream from owner/repo format
            execSync(`git remote add upstream "https://github.com/${args.upstream}.git"`, { encoding: 'utf-8', timeout: 5000 })
            upstream = 'upstream'
          } else {
            return [
              'No upstream remote configured.',
              '',
              'Set it up:',
              '  sync_fork upstream="owner/repo"',
              '',
              'Or manually:',
              '  git remote add upstream https://github.com/OWNER/REPO.git',
            ].join('\n')
          }
        }

        // Detect default branch
        let branch = args.branch ? String(args.branch) : ''
        if (!branch) {
          try {
            branch = execSync(`git symbolic-ref refs/remotes/${upstream}/HEAD 2>/dev/null`, { encoding: 'utf-8', timeout: 5000 })
              .trim().replace(`refs/remotes/${upstream}/`, '')
          } catch {
            // Try common branch names
            try {
              execSync(`git rev-parse --verify ${upstream}/main 2>/dev/null`, { encoding: 'utf-8', timeout: 3000 })
              branch = 'main'
            } catch {
              branch = 'master'
            }
          }
        }

        // Fetch upstream
        execSync(`git fetch ${upstream}`, { encoding: 'utf-8', timeout: 30000 })

        // Check current branch
        const currentBranch = execSync('git rev-parse --abbrev-ref HEAD', { encoding: 'utf-8', timeout: 3000 }).trim()

        if (currentBranch !== branch) {
          return [
            `Currently on branch "${currentBranch}", not "${branch}".`,
            `Switch to ${branch} first: git checkout ${branch}`,
            `Then run sync_fork again.`,
          ].join('\n')
        }

        // Sync
        if (strategy === 'rebase') {
          execSync(`git rebase ${upstream}/${branch}`, { encoding: 'utf-8', timeout: 30000 })
        } else {
          execSync(`git merge ${upstream}/${branch}`, { encoding: 'utf-8', timeout: 30000 })
        }

        const behindAhead = execSync(`git rev-list --left-right --count ${upstream}/${branch}...HEAD`, { encoding: 'utf-8', timeout: 5000 }).trim()
        const [behind, ahead] = behindAhead.split('\t').map(Number)

        return [
          `Fork synced with ${upstream}/${branch} (${strategy}).`,
          `Status: ${behind} commits behind, ${ahead} commits ahead of upstream.`,
          '',
          ahead > 0 ? 'Push your changes: git push origin ' + branch : 'Your fork is up to date.',
        ].join('\n')
      } catch (err) {
        return `Sync failed: ${(err as Error).message}\n\nIf there are merge conflicts, resolve them and commit.`
      }
    },
  })

  // ── Community Stats ──
  registerTool({
    name: 'community_stats',
    description: 'Get community health metrics for an open-source GitHub repository. Shows contributor activity, issue response times, PR merge rates, and community profile completeness.',
    parameters: {
      repo: { type: 'string', description: 'Repository in "owner/repo" format', required: true },
    },
    tier: 'free',
    timeout: 30_000,
    async execute(args) {
      const repo = String(args.repo)

      try {
        const [repoData, communityProfile, contributors] = await Promise.all([
          githubFetch(`/repos/${repo}`),
          githubFetch(`/repos/${repo}/community/profile`).catch(() => null),
          githubFetch(`/repos/${repo}/contributors?per_page=10`).catch(() => []),
        ])

        const lines = [
          `## Community Stats: ${repo}`,
          '',
          '### Repository',
          `- Stars: ${repoData.stargazers_count}`,
          `- Forks: ${repoData.forks_count}`,
          `- Watchers: ${repoData.subscribers_count}`,
          `- Open issues: ${repoData.open_issues_count}`,
          `- License: ${repoData.license?.spdx_id || 'none'}`,
          `- Created: ${repoData.created_at?.slice(0, 10)}`,
          `- Last push: ${repoData.pushed_at?.slice(0, 10)}`,
          `- Default branch: ${repoData.default_branch}`,
          '',
        ]

        // Community profile
        if (communityProfile) {
          const hp = communityProfile.health_percentage || 0
          lines.push(`### Community Profile Score: ${hp}%`)
          const files = communityProfile.files || {}
          const profileChecks = [
            { key: 'code_of_conduct', label: 'Code of Conduct' },
            { key: 'contributing', label: 'Contributing Guide' },
            { key: 'license', label: 'License' },
            { key: 'readme', label: 'README' },
            { key: 'issue_template', label: 'Issue Template' },
            { key: 'pull_request_template', label: 'PR Template' },
          ]
          for (const check of profileChecks) {
            const found = !!files[check.key]
            lines.push(`  ${found ? '+' : '-'} ${check.label}`)
          }
          lines.push('')
        }

        // Top contributors
        if (contributors.length > 0) {
          lines.push(`### Top Contributors (${contributors.length}+)`)
          for (const c of contributors.slice(0, 10)) {
            lines.push(`  ${c.login}: ${c.contributions} contributions`)
          }
          lines.push('')
        }

        // Activity indicators
        const daysSincePush = Math.floor((Date.now() - new Date(repoData.pushed_at).getTime()) / 86400000)
        const activity = daysSincePush < 7 ? 'Very Active' : daysSincePush < 30 ? 'Active' : daysSincePush < 90 ? 'Moderate' : 'Low Activity'
        lines.push(`### Activity: ${activity} (last push ${daysSincePush}d ago)`)

        if (repoData.topics?.length) {
          lines.push(`### Topics: ${repoData.topics.join(', ')}`)
        }

        return lines.join('\n')
      } catch (err) {
        return `Could not fetch community stats: ${(err as Error).message}`
      }
    },
  })

  // ── Papers With Code Search ──
  registerTool({
    name: 'find_papers_with_code',
    description: 'Search for academic papers that have associated open-source code implementations. Useful for finding reference implementations, benchmarks, and state-of-the-art models.',
    parameters: {
      query: { type: 'string', description: 'Search query (e.g., "object detection", "diffusion models", "protein folding")', required: true },
      limit: { type: 'number', description: 'Max results (default: 8)' },
    },
    tier: 'free',
    timeout: 30_000,
    async execute(args) {
      const query = String(args.query)
      const limit = Math.min(Number(args.limit) || 8, 20)

      // Search GitHub for repos that reference papers
      const q = encodeURIComponent(`${query} in:readme "arxiv" OR "paper" OR "citation" stars:>=10`)
      try {
        const data = await githubFetch(`/search/repositories?q=${q}&sort=stars&order=desc&per_page=${limit}`)
        if (!data.items?.length) return 'No repositories with papers found. Try different keywords.'

        const results = data.items.map((r: any) => {
          const topics = (r.topics || []).slice(0, 5).join(', ')
          return [
            `**${r.full_name}** (${r.stargazers_count} stars)`,
            `  ${r.description?.slice(0, 150) || '(no description)'}`,
            `  Language: ${r.language || 'n/a'} | Topics: ${topics || 'none'}`,
            `  Updated: ${r.pushed_at?.slice(0, 10)} | License: ${r.license?.spdx_id || 'none'}`,
            `  ${r.html_url}`,
          ].join('\n')
        })

        return [
          `## Research Repos with Papers: "${query}"`,
          '',
          ...results,
          '',
          'Tip: Check each repo\'s README for links to the associated paper.',
        ].join('\n')
      } catch (err) {
        return `Search failed: ${(err as Error).message}`
      }
    },
  })

  // ── Academic Project Scaffold ──
  registerTool({
    name: 'scaffold_research_repo',
    description: 'Generate a checklist and template structure for a research software repository. Includes CITATION.cff template, reproducibility checklist, README template with academic sections, and recommended CI setup.',
    parameters: {
      name: { type: 'string', description: 'Project name', required: true },
      language: { type: 'string', description: 'Primary language: "python", "r", "julia", "matlab" (default: python)' },
      type: { type: 'string', description: 'Project type: "paper", "library", "benchmark", "dataset" (default: paper)' },
    },
    tier: 'free',
    async execute(args) {
      const name = String(args.name)
      const lang = String(args.language || 'python')
      const type = String(args.type || 'paper')

      const langSpecific: Record<string, { env: string; test: string; pkg: string }> = {
        python: { env: 'requirements.txt + environment.yml', test: 'pytest', pkg: 'pyproject.toml' },
        r: { env: 'renv.lock', test: 'testthat', pkg: 'DESCRIPTION' },
        julia: { env: 'Project.toml + Manifest.toml', test: 'Test stdlib', pkg: 'Project.toml' },
        matlab: { env: 'README setup section', test: 'MATLAB unit tests', pkg: 'README' },
      }
      const ls = langSpecific[lang] || langSpecific.python

      const typeReadme: Record<string, string> = {
        paper: '## Paper\n[Title](link) — Published at [Venue] [Year]\n\n## Abstract\n...\n\n## Results\n...\n\n## Reproducing Results\n```bash\n# Step-by-step instructions\n```',
        library: '## Installation\n```bash\npip install ' + name + '\n```\n\n## Quick Start\n```python\nimport ' + name + '\n```\n\n## API Reference\n...',
        benchmark: '## Benchmarks\n| Method | Metric | Score |\n|--------|--------|-------|\n| Ours   | ...    | ...   |\n\n## Running Benchmarks\n```bash\nmake benchmark\n```',
        dataset: '## Dataset\n- **Size**: ...\n- **Format**: ...\n- **License**: ...\n\n## Download\n...\n\n## Data Description\n...',
      }

      const lines = [
        `## Research Repository Scaffold: ${name}`,
        '',
        '### Recommended Directory Structure',
        '```',
        `${name}/`,
        '├── README.md              # Project overview, reproduction steps',
        '├── LICENSE                 # Open source license (MIT/Apache-2.0)',
        '├── CITATION.cff           # Machine-readable citation',
        `├── ${ls.pkg}              # Package/project metadata`,
        `├── ${ls.env.split(' + ')[0]}       # Pinned dependencies`,
        '├── Dockerfile             # Reproducible environment',
        '├── Makefile               # Common tasks (train, evaluate, test)',
        '├── .github/',
        '│   └── workflows/',
        '│       └── ci.yml         # Automated testing',
        `├── src/                   # Source code`,
        `├── tests/                 # Tests (${ls.test})`,
        `├── experiments/           # Experiment configs & scripts`,
        `├── data/                  # Data loading (not raw data)`,
        `│   └── README.md          # Data download instructions`,
        `├── results/               # Output figures & tables`,
        `└── notebooks/             # Jupyter notebooks (optional)`,
        '```',
        '',
        '### README Template',
        `# ${name}`,
        '',
        typeReadme[type] || typeReadme.paper,
        '',
        '### Reproducibility Checklist',
        '- [ ] CITATION.cff with all authors (use `generate_citation` tool)',
        '- [ ] Pinned dependencies with exact versions',
        '- [ ] Dockerfile or environment.yml for env setup',
        '- [ ] Random seeds set and documented',
        '- [ ] Step-by-step reproduction instructions',
        '- [ ] Expected output / reference results included',
        '- [ ] CI pipeline running tests',
        '- [ ] Data download instructions (or synthetic data generator)',
        '- [ ] Hardware requirements documented',
        '- [ ] LICENSE file present',
        '',
        '### Recommended CI (GitHub Actions)',
        '```yaml',
        'name: CI',
        'on: [push, pull_request]',
        'jobs:',
        '  test:',
        '    runs-on: ubuntu-latest',
        '    steps:',
        '      - uses: actions/checkout@v4',
        lang === 'python' ? [
          '      - uses: actions/setup-python@v5',
          '        with:',
          '          python-version: "3.11"',
          '      - run: pip install -r requirements.txt',
          '      - run: pytest tests/',
        ].join('\n') : lang === 'r' ? [
          '      - uses: r-lib/actions/setup-r@v2',
          '      - run: Rscript -e "renv::restore()"',
          '      - run: Rscript -e "testthat::test_dir(\'tests\')"',
        ].join('\n') : lang === 'julia' ? [
          '      - uses: julia-actions/setup-julia@v2',
          '      - run: julia --project=. -e "using Pkg; Pkg.test()"',
        ].join('\n') : '      - run: make test',
        '```',
        '',
        'Use `audit_reproducibility` to check your progress.',
      ]

      return lines.join('\n')
    },
  })
}
