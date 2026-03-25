// kbot Project Bootstrapper Tools — Analyze and bootstrap any codebase.
// Clone repos, detect frameworks, identify key files, suggest agents and tools.

import { registerTool } from './index.js'
import { execSync } from 'node:child_process'
import { readFile, readdir, stat, mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join, extname, basename } from 'node:path'

/** Framework detection signatures */
interface FrameworkSignature {
  name: string
  files: string[]
  devFiles?: string[]
  language: string
  agents: string[]
  tools: string[]
}

const FRAMEWORK_SIGNATURES: FrameworkSignature[] = [
  {
    name: 'Next.js',
    files: ['next.config.js', 'next.config.mjs', 'next.config.ts'],
    language: 'TypeScript/JavaScript',
    agents: ['coder', 'infrastructure', 'aesthete'],
    tools: ['nextjs_build', 'lighthouse_audit', 'route_analyzer'],
  },
  {
    name: 'React (Vite)',
    files: ['vite.config.ts', 'vite.config.js'],
    devFiles: ['src/App.tsx', 'src/App.jsx', 'src/main.tsx'],
    language: 'TypeScript/JavaScript',
    agents: ['coder', 'aesthete', 'guardian'],
    tools: ['vite_build', 'component_tree', 'bundle_analyzer'],
  },
  {
    name: 'Express/Node.js',
    files: ['app.js', 'server.js', 'src/server.ts', 'src/app.ts'],
    language: 'TypeScript/JavaScript',
    agents: ['coder', 'infrastructure', 'guardian'],
    tools: ['api_tester', 'route_mapper', 'load_tester'],
  },
  {
    name: 'Django',
    files: ['manage.py', 'settings.py'],
    devFiles: ['urls.py', 'wsgi.py'],
    language: 'Python',
    agents: ['coder', 'infrastructure', 'guardian'],
    tools: ['django_manage', 'migration_checker', 'model_analyzer'],
  },
  {
    name: 'Flask',
    files: ['app.py', 'wsgi.py'],
    devFiles: ['requirements.txt'],
    language: 'Python',
    agents: ['coder', 'infrastructure'],
    tools: ['flask_routes', 'api_tester'],
  },
  {
    name: 'FastAPI',
    files: ['main.py'],
    language: 'Python',
    agents: ['coder', 'infrastructure', 'guardian'],
    tools: ['openapi_validator', 'api_tester', 'async_profiler'],
  },
  {
    name: 'Rust (Cargo)',
    files: ['Cargo.toml'],
    language: 'Rust',
    agents: ['coder', 'guardian', 'analyst'],
    tools: ['cargo_build', 'clippy_lint', 'unsafe_scanner'],
  },
  {
    name: 'Go',
    files: ['go.mod'],
    language: 'Go',
    agents: ['coder', 'infrastructure', 'guardian'],
    tools: ['go_build', 'go_vet', 'goroutine_analyzer'],
  },
  {
    name: 'Ruby on Rails',
    files: ['Gemfile', 'config/routes.rb'],
    language: 'Ruby',
    agents: ['coder', 'infrastructure'],
    tools: ['rails_console', 'migration_runner', 'route_mapper'],
  },
  {
    name: 'Docker Compose',
    files: ['docker-compose.yml', 'docker-compose.yaml', 'compose.yml'],
    language: 'Multi',
    agents: ['infrastructure', 'guardian'],
    tools: ['docker_compose_up', 'container_health', 'network_mapper'],
  },
  {
    name: 'Terraform',
    files: ['main.tf', 'terraform.tf'],
    language: 'HCL',
    agents: ['infrastructure', 'guardian', 'analyst'],
    tools: ['terraform_plan', 'drift_detector', 'cost_estimator'],
  },
]

/** File extensions and what they indicate */
const EXTENSION_CATEGORIES: Record<string, string> = {
  '.ts': 'TypeScript',
  '.tsx': 'React/TypeScript',
  '.js': 'JavaScript',
  '.jsx': 'React/JavaScript',
  '.py': 'Python',
  '.rs': 'Rust',
  '.go': 'Go',
  '.rb': 'Ruby',
  '.java': 'Java',
  '.kt': 'Kotlin',
  '.swift': 'Swift',
  '.c': 'C',
  '.cpp': 'C++',
  '.h': 'C/C++ Header',
  '.cs': 'C#',
  '.php': 'PHP',
  '.vue': 'Vue.js',
  '.svelte': 'Svelte',
  '.sql': 'SQL',
  '.tf': 'Terraform',
  '.yaml': 'YAML',
  '.yml': 'YAML',
  '.toml': 'TOML',
  '.json': 'JSON',
  '.md': 'Markdown',
  '.sh': 'Shell',
  '.dockerfile': 'Docker',
}

/** Key files that are always worth noting */
const KEY_FILES = [
  'package.json',
  'tsconfig.json',
  'Cargo.toml',
  'go.mod',
  'requirements.txt',
  'pyproject.toml',
  'Gemfile',
  'Makefile',
  'Dockerfile',
  'docker-compose.yml',
  'docker-compose.yaml',
  'compose.yml',
  '.github/workflows',
  '.gitlab-ci.yml',
  'jest.config.ts',
  'jest.config.js',
  'vitest.config.ts',
  'vitest.config.js',
  '.eslintrc.json',
  '.eslintrc.js',
  'eslint.config.js',
  '.prettierrc',
  'README.md',
  'CONTRIBUTING.md',
  'LICENSE',
  '.env.example',
]

interface AnalysisResult {
  directory: string
  totalFiles: number
  totalDirs: number
  languages: Record<string, number>
  frameworks: string[]
  keyFiles: string[]
  suggestedAgents: string[]
  suggestedTools: string[]
  structure: string[]
  recommendations: string[]
}

/**
 * Recursively walk a directory, collecting file info.
 * Skips node_modules, .git, dist, build, __pycache__, .venv, target.
 */
async function walkDir(
  dir: string,
  depth: number = 0,
  maxDepth: number = 6,
): Promise<{ files: string[]; dirs: string[] }> {
  const SKIP_DIRS = new Set([
    'node_modules', '.git', 'dist', 'build', '__pycache__',
    '.venv', 'venv', 'target', '.next', '.nuxt', '.output',
    'vendor', 'coverage', '.cache', '.parcel-cache',
  ])

  const result: { files: string[]; dirs: string[] } = { files: [], dirs: [] }

  if (depth > maxDepth) return result

  let entries: string[]
  try {
    entries = await readdir(dir)
  } catch {
    return result
  }

  for (const entry of entries) {
    if (entry.startsWith('.') && depth > 0) continue
    const fullPath = join(dir, entry)

    let info
    try {
      info = await stat(fullPath)
    } catch {
      continue
    }

    if (info.isDirectory()) {
      if (SKIP_DIRS.has(entry)) continue
      result.dirs.push(fullPath)
      const sub = await walkDir(fullPath, depth + 1, maxDepth)
      result.files.push(...sub.files)
      result.dirs.push(...sub.dirs)
    } else if (info.isFile()) {
      result.files.push(fullPath)
    }
  }

  return result
}

/** Detect frameworks from files present in the directory */
function detectFrameworks(fileNames: Set<string>): FrameworkSignature[] {
  const detected: FrameworkSignature[] = []
  for (const sig of FRAMEWORK_SIGNATURES) {
    const hasMain = sig.files.some((f) => fileNames.has(f))
    if (hasMain) {
      detected.push(sig)
    }
  }
  return detected
}

/** Count files by language/extension */
function countLanguages(files: string[]): Record<string, number> {
  const counts: Record<string, number> = {}
  for (const file of files) {
    const ext = extname(file).toLowerCase()
    const lang = EXTENSION_CATEGORIES[ext]
    if (lang) {
      counts[lang] = (counts[lang] || 0) + 1
    }
  }
  return counts
}

/** Get top-level structure for display */
async function getTopLevelStructure(dir: string): Promise<string[]> {
  const structure: string[] = []
  try {
    const entries = await readdir(dir)
    for (const entry of entries.sort()) {
      if (entry.startsWith('.') && entry !== '.github') continue
      const fullPath = join(dir, entry)
      try {
        const info = await stat(fullPath)
        structure.push(info.isDirectory() ? `  ${entry}/` : `  ${entry}`)
      } catch {
        structure.push(`  ${entry}`)
      }
    }
  } catch {
    structure.push('  (could not read directory)')
  }
  return structure
}

/** Analyze a local directory */
async function analyzeDirectory(dir: string): Promise<AnalysisResult> {
  const { files, dirs } = await walkDir(dir)

  // Collect relative file names for framework detection
  const relativeNames = new Set(
    files.map((f) => f.slice(dir.length + 1)),
  )

  // Also check basenames for simpler detection
  for (const f of files) {
    relativeNames.add(basename(f))
  }

  const frameworks = detectFrameworks(relativeNames)
  const languages = countLanguages(files)
  const structure = await getTopLevelStructure(dir)

  // Find key files present
  const keyFilesFound: string[] = []
  for (const kf of KEY_FILES) {
    if (relativeNames.has(kf)) {
      keyFilesFound.push(kf)
    }
  }

  // Aggregate suggested agents and tools from detected frameworks
  const agentSet = new Set<string>()
  const toolSet = new Set<string>()
  for (const fw of frameworks) {
    for (const a of fw.agents) agentSet.add(a)
    for (const t of fw.tools) toolSet.add(t)
  }

  // Add agents based on language mix
  if (Object.keys(languages).length > 3) agentSet.add('analyst')
  if (relativeNames.has('Dockerfile') || relativeNames.has('docker-compose.yml')) {
    agentSet.add('infrastructure')
  }
  if (relativeNames.has('.github/workflows') || relativeNames.has('.gitlab-ci.yml')) {
    agentSet.add('infrastructure')
    toolSet.add('ci_monitor')
  }
  if (files.length > 500) {
    agentSet.add('curator')
    toolSet.add('codebase_navigator')
  }

  // Generate recommendations
  const recommendations: string[] = []

  if (!relativeNames.has('README.md') && !relativeNames.has('readme.md')) {
    recommendations.push('Missing README.md — consider adding project documentation')
  }
  if (!relativeNames.has('LICENSE') && !relativeNames.has('license')) {
    recommendations.push('No LICENSE file — add one if this is open source')
  }
  if (!relativeNames.has('.gitignore')) {
    recommendations.push('No .gitignore — risk of committing build artifacts or secrets')
  }

  const hasTests =
    files.some((f) => f.includes('.test.') || f.includes('.spec.') || f.includes('__tests__'))
  if (!hasTests) {
    recommendations.push('No test files detected — consider adding a test suite')
    toolSet.add('test_scaffolder')
  }

  const hasCI =
    relativeNames.has('.github/workflows') || relativeNames.has('.gitlab-ci.yml')
  if (!hasCI) {
    recommendations.push('No CI/CD configuration detected — consider adding automated pipelines')
    toolSet.add('ci_generator')
  }

  if (relativeNames.has('.env') || relativeNames.has('.env.local')) {
    recommendations.push('Found .env file — ensure it is in .gitignore and not committed')
    agentSet.add('guardian')
  }

  const sortedLanguages: Record<string, number> = {}
  const sorted = Object.entries(languages).sort((a, b) => b[1] - a[1])
  for (const [lang, count] of sorted) {
    sortedLanguages[lang] = count
  }

  return {
    directory: dir,
    totalFiles: files.length,
    totalDirs: dirs.length,
    languages: sortedLanguages,
    frameworks: frameworks.map((f) => f.name),
    keyFiles: keyFilesFound,
    suggestedAgents: Array.from(agentSet),
    suggestedTools: Array.from(toolSet),
    structure,
    recommendations,
  }
}

/** Format analysis result as a readable report */
function formatAnalysisReport(result: AnalysisResult): string {
  const parts: string[] = [
    `# Project Analysis Report`,
    `**Directory:** ${result.directory}`,
    '',
    `## Overview`,
    `- **Files:** ${result.totalFiles}`,
    `- **Directories:** ${result.totalDirs}`,
    `- **Frameworks:** ${result.frameworks.length > 0 ? result.frameworks.join(', ') : 'None detected'}`,
    '',
  ]

  // Languages
  if (Object.keys(result.languages).length > 0) {
    parts.push(`## Languages`)
    for (const [lang, count] of Object.entries(result.languages)) {
      const bar = '#'.repeat(Math.min(Math.ceil(count / 5), 30))
      parts.push(`- **${lang}**: ${count} files ${bar}`)
    }
    parts.push('')
  }

  // Structure
  if (result.structure.length > 0) {
    parts.push(`## Project Structure`)
    parts.push('```')
    parts.push(...result.structure)
    parts.push('```')
    parts.push('')
  }

  // Key files
  if (result.keyFiles.length > 0) {
    parts.push(`## Key Files Found`)
    for (const kf of result.keyFiles) {
      parts.push(`- \`${kf}\``)
    }
    parts.push('')
  }

  // Suggested agents
  if (result.suggestedAgents.length > 0) {
    parts.push(`## Suggested Agents`)
    parts.push('These kbot specialist agents are recommended for this project:')
    parts.push('')
    for (const agent of result.suggestedAgents) {
      parts.push(`- **${agent}**`)
    }
    parts.push('')
  }

  // Suggested tools
  if (result.suggestedTools.length > 0) {
    parts.push(`## Suggested Tools to Forge`)
    parts.push('Consider creating these tools with `forge_tool`:')
    parts.push('')
    for (const tool of result.suggestedTools) {
      parts.push(`- \`${tool}\``)
    }
    parts.push('')
  }

  // Recommendations
  if (result.recommendations.length > 0) {
    parts.push(`## Recommendations`)
    for (const rec of result.recommendations) {
      parts.push(`- ${rec}`)
    }
    parts.push('')
  }

  return parts.join('\n')
}

/** Extract owner/repo from a GitHub URL */
function parseGitHubUrl(url: string): { owner: string; repo: string } | null {
  // Handle: https://github.com/owner/repo, git@github.com:owner/repo.git, etc.
  const httpsMatch = url.match(/github\.com\/([^/]+)\/([^/.]+)/)
  if (httpsMatch) return { owner: httpsMatch[1], repo: httpsMatch[2] }

  const sshMatch = url.match(/github\.com:([^/]+)\/([^/.]+)/)
  if (sshMatch) return { owner: sshMatch[1], repo: sshMatch[2] }

  return null
}

export function registerBootstrapperTools(): void {
  registerTool({
    name: 'bootstrap_repo',
    description:
      'Clone a GitHub repository to a temp directory, analyze its structure, detect frameworks, ' +
      'identify key files, suggest specialist agents and tools. Returns a full project bootstrapping report.',
    parameters: {
      repo: {
        type: 'string',
        description:
          'GitHub repo URL (e.g. "https://github.com/owner/repo") or "owner/repo" shorthand',
        required: true,
      },
    },
    tier: 'free',
    timeout: 120_000, // 2 min for clone + analysis
    async execute(args) {
      const repoArg = String(args.repo)

      // Normalize to full URL
      let cloneUrl: string
      let repoSlug: string

      if (repoArg.startsWith('http') || repoArg.startsWith('git@')) {
        cloneUrl = repoArg.endsWith('.git') ? repoArg : `${repoArg}.git`
        const parsed = parseGitHubUrl(repoArg)
        repoSlug = parsed ? `${parsed.owner}/${parsed.repo}` : repoArg
      } else if (repoArg.includes('/')) {
        cloneUrl = `https://github.com/${repoArg}.git`
        repoSlug = repoArg
      } else {
        return `Invalid repo format. Use "owner/repo" or a full GitHub URL.`
      }

      // Create temp directory
      let tmpDir: string
      try {
        tmpDir = await mkdtemp(join(tmpdir(), 'kbot-bootstrap-'))
      } catch (err) {
        return `Failed to create temp directory: ${err instanceof Error ? err.message : String(err)}`
      }

      const parts: string[] = []

      // Clone the repo (shallow for speed)
      try {
        execSync(`git clone --depth 1 "${cloneUrl}" "${tmpDir}/repo"`, {
          timeout: 60_000,
          stdio: 'pipe',
        })
      } catch (err) {
        // Cleanup on failure
        try { await rm(tmpDir, { recursive: true, force: true }) } catch { /* ignore */ }
        const msg = err instanceof Error ? err.message : String(err)
        return `Failed to clone ${repoSlug}:\n${msg}\n\nCheck the URL and ensure the repo is public.`
      }

      const repoDir = join(tmpDir, 'repo')

      // Fetch repo metadata from GitHub API
      const parsed = parseGitHubUrl(cloneUrl) || { owner: repoSlug.split('/')[0], repo: repoSlug.split('/')[1] }
      try {
        const res = await fetch(`https://api.github.com/repos/${parsed.owner}/${parsed.repo}`, {
          headers: { 'User-Agent': 'KBot/3.0 (Bootstrapper)', Accept: 'application/vnd.github.v3+json' },
        })
        if (res.ok) {
          const data = await res.json() as Record<string, unknown>
          parts.push(`# Bootstrap Report: ${repoSlug}`)
          parts.push('')
          parts.push(`**Description:** ${(data.description as string) || 'No description'}`)
          parts.push(`**Stars:** ${data.stargazers_count} | **Forks:** ${data.forks_count} | **Issues:** ${data.open_issues_count}`)
          parts.push(`**Language:** ${(data.language as string) || 'Unknown'} | **License:** ${((data.license as Record<string, string>)?.spdx_id) || 'None'}`)
          parts.push('')
        }
      } catch {
        parts.push(`# Bootstrap Report: ${repoSlug}`)
        parts.push('')
      }

      // Read package.json if present for additional info
      try {
        const pkgRaw = await readFile(join(repoDir, 'package.json'), 'utf-8')
        const pkg = JSON.parse(pkgRaw) as Record<string, unknown>
        const deps = Object.keys((pkg.dependencies as Record<string, string>) || {})
        const devDeps = Object.keys((pkg.devDependencies as Record<string, string>) || {})
        parts.push(`## package.json`)
        parts.push(`- **Name:** ${(pkg.name as string) || 'unnamed'}`)
        parts.push(`- **Version:** ${(pkg.version as string) || 'unknown'}`)
        parts.push(`- **Dependencies:** ${deps.length} (${deps.slice(0, 10).join(', ')}${deps.length > 10 ? '...' : ''})`)
        parts.push(`- **Dev Dependencies:** ${devDeps.length} (${devDeps.slice(0, 10).join(', ')}${devDeps.length > 10 ? '...' : ''})`)
        parts.push('')
      } catch {
        // No package.json — not a Node project
      }

      // Full analysis
      const analysis = await analyzeDirectory(repoDir)
      // Override directory display with the repo slug
      analysis.directory = repoSlug
      parts.push(formatAnalysisReport(analysis))

      // Custom agent suggestions
      parts.push(`## Custom Agent Configuration`)
      parts.push('Recommended `.kbot/agents.json` for this project:')
      parts.push('')
      parts.push('```json')
      const agentConfig = analysis.suggestedAgents.map((a) => ({
        id: a,
        active: true,
        priority: a === 'coder' ? 'high' : 'normal',
      }))
      parts.push(JSON.stringify({ agents: agentConfig }, null, 2))
      parts.push('```')
      parts.push('')

      // Cleanup temp dir
      try {
        await rm(tmpDir, { recursive: true, force: true })
      } catch {
        parts.push(`(Note: temp dir ${tmpDir} may need manual cleanup)`)
      }

      return parts.join('\n')
    },
  })

  registerTool({
    name: 'bootstrap_analyze',
    description:
      'Analyze a local directory structure. Detects frameworks, counts files by language, ' +
      'finds key configuration files, suggests specialist agents and tools to forge. ' +
      'Returns actionable recommendations for the project.',
    parameters: {
      directory: {
        type: 'string',
        description: 'Absolute path to the local directory to analyze',
        required: true,
      },
    },
    tier: 'free',
    async execute(args) {
      const dir = String(args.directory)

      // Verify directory exists
      try {
        const info = await stat(dir)
        if (!info.isDirectory()) {
          return `"${dir}" is not a directory.`
        }
      } catch {
        return `Directory not found: ${dir}`
      }

      try {
        const analysis = await analyzeDirectory(dir)
        return formatAnalysisReport(analysis)
      } catch (err) {
        return `Analysis failed: ${err instanceof Error ? err.message : String(err)}`
      }
    },
  })
}
