// kbot init — 60-second project onboarding
//
// Scans a repo, detects stack, generates .kbot.json config,
// creates project-specific forged tools, and prints a ready message.
//
// Usage: kbot init
//
// This is the first thing a new user runs. It must be fast,
// useful, and make kbot feel like it belongs in the project.

import { existsSync, readFileSync, writeFileSync, mkdirSync, readdirSync, statSync } from 'node:fs'
import { join, basename, extname } from 'node:path'
import { execSync } from 'node:child_process'
import { homedir } from 'node:os'

// ── Types ──

export interface KbotProjectConfig {
  /** Detected project name */
  name: string
  /** Detected language */
  language: string
  /** Detected framework (if any) */
  framework?: string
  /** Package manager */
  packageManager?: string
  /** Preferred default agent */
  defaultAgent: string
  /** Key files kbot should know about */
  keyFiles: string[]
  /** Custom commands detected from package.json/Makefile/etc */
  commands: Record<string, string>
  /** Forged tools created during init */
  forgedTools: string[]
  /** File counts by extension */
  fileCounts: Record<string, number>
  /** Total file count */
  totalFiles: number
  /** README excerpt (first 500 chars) */
  readmeExcerpt?: string
  /** When this config was generated */
  createdAt: string
}

// ── Detection ──

function quickExec(cmd: string, timeoutMs = 2000): string {
  try {
    return execSync(cmd, { encoding: 'utf-8', timeout: timeoutMs, stdio: ['pipe', 'pipe', 'pipe'] }).trim()
  } catch {
    return ''
  }
}

function detectProjectName(root: string): string {
  // Try package.json first
  const pkgPath = join(root, 'package.json')
  if (existsSync(pkgPath)) {
    try {
      const pkg = JSON.parse(readFileSync(pkgPath, 'utf8'))
      if (pkg.name) return pkg.name
    } catch { /* ignore */ }
  }

  // Try Cargo.toml
  const cargoPath = join(root, 'Cargo.toml')
  if (existsSync(cargoPath)) {
    const match = readFileSync(cargoPath, 'utf8').match(/name\s*=\s*"([^"]+)"/)
    if (match) return match[1]
  }

  // Try pyproject.toml
  const pyPath = join(root, 'pyproject.toml')
  if (existsSync(pyPath)) {
    const match = readFileSync(pyPath, 'utf8').match(/name\s*=\s*"([^"]+)"/)
    if (match) return match[1]
  }

  // Fall back to directory name
  return basename(root)
}

function detectLanguage(root: string): string {
  if (existsSync(join(root, 'tsconfig.json'))) return 'TypeScript'
  if (existsSync(join(root, 'package.json'))) return 'JavaScript'
  if (existsSync(join(root, 'Cargo.toml'))) return 'Rust'
  if (existsSync(join(root, 'go.mod'))) return 'Go'
  if (existsSync(join(root, 'pyproject.toml')) || existsSync(join(root, 'setup.py'))) return 'Python'
  if (existsSync(join(root, 'build.gradle')) || existsSync(join(root, 'pom.xml'))) return 'Java'
  if (existsSync(join(root, 'Package.swift'))) return 'Swift'
  if (existsSync(join(root, 'mix.exs'))) return 'Elixir'

  // Count file extensions in top-level src/ or root
  const exts: Record<string, number> = {}
  const scanDirs = [join(root, 'src'), root]
  for (const dir of scanDirs) {
    try {
      const entries = readdirSync(dir)
      for (const name of entries) {
        const ext = name.split('.').pop() || ''
        if (ext !== name) exts[ext] = (exts[ext] || 0) + 1
      }
    } catch { /* dir doesn't exist */ }
  }

  const langMap: Record<string, string> = {
    ts: 'TypeScript', tsx: 'TypeScript', js: 'JavaScript', jsx: 'JavaScript',
    py: 'Python', rs: 'Rust', go: 'Go', java: 'Java', rb: 'Ruby',
    swift: 'Swift', kt: 'Kotlin', cs: 'C#', cpp: 'C++', c: 'C',
  }

  const sorted = Object.entries(exts)
    .filter(([ext]) => langMap[ext])
    .sort((a, b) => b[1] - a[1])

  return sorted.length > 0 ? langMap[sorted[0][0]] : 'Unknown'
}

function detectFramework(root: string): string | undefined {
  // Check Node.js frameworks via package.json
  const pkgPath = join(root, 'package.json')
  if (existsSync(pkgPath)) try {
    const pkg = JSON.parse(readFileSync(pkgPath, 'utf8'))
    const deps = { ...pkg.dependencies, ...pkg.devDependencies }

    if (deps.next) return 'Next.js'
    if (deps.nuxt) return 'Nuxt'
    if (deps['react-dom']) return 'React'
    if (deps.vue) return 'Vue'
    if (deps.svelte || deps['@sveltejs/kit']) return 'Svelte'
    if (deps.express) return 'Express'
    if (deps.fastify) return 'Fastify'
    if (deps.hono) return 'Hono'
    if (deps.remix || deps['@remix-run/react']) return 'Remix'
    if (deps.astro) return 'Astro'
    if (deps.nest || deps['@nestjs/core']) return 'NestJS'
    if (deps.angular || deps['@angular/core']) return 'Angular'
    if (deps.gatsby) return 'Gatsby'
    if (deps.electron) return 'Electron'
    if (deps.expo) return 'Expo (React Native)'
    if (deps['react-native']) return 'React Native'
    if (deps.vite) return 'Vite'
  } catch { /* ignore */ }

  // Python frameworks
  if (existsSync(join(root, 'manage.py'))) return 'Django'
  const reqPath = join(root, 'requirements.txt')
  if (existsSync(reqPath)) {
    const reqs = readFileSync(reqPath, 'utf8')
    if (/flask/i.test(reqs)) return 'Flask'
    if (/fastapi/i.test(reqs)) return 'FastAPI'
    if (/django/i.test(reqs)) return 'Django'
  }

  // Rust frameworks
  if (existsSync(join(root, 'Cargo.toml'))) {
    const cargo = readFileSync(join(root, 'Cargo.toml'), 'utf8')
    if (/actix/i.test(cargo)) return 'Actix'
    if (/axum/i.test(cargo)) return 'Axum'
    if (/rocket/i.test(cargo)) return 'Rocket'
  }

  return undefined
}

function detectPackageManager(root: string): string | undefined {
  if (existsSync(join(root, 'bun.lockb'))) return 'bun'
  if (existsSync(join(root, 'pnpm-lock.yaml'))) return 'pnpm'
  if (existsSync(join(root, 'yarn.lock'))) return 'yarn'
  if (existsSync(join(root, 'package-lock.json'))) return 'npm'
  if (existsSync(join(root, 'Cargo.lock'))) return 'cargo'
  if (existsSync(join(root, 'poetry.lock'))) return 'poetry'
  if (existsSync(join(root, 'go.sum'))) return 'go'
  if (existsSync(join(root, 'Pipfile.lock'))) return 'pipenv'
  return undefined
}

function detectKeyFiles(root: string): string[] {
  const candidates = [
    'package.json', 'tsconfig.json', 'Cargo.toml', 'go.mod', 'pyproject.toml',
    'Dockerfile', 'docker-compose.yml', 'Makefile',
    '.env.example', '.github/workflows/ci.yml',
    'src/index.ts', 'src/main.ts', 'src/app.ts', 'src/index.js', 'src/main.js',
    'src/App.tsx', 'src/App.vue', 'src/App.svelte',
    'main.go', 'src/main.rs', 'src/lib.rs',
    'app.py', 'main.py', 'manage.py',
    'README.md', 'CLAUDE.md', '.kbot.md',
  ]
  return candidates.filter(f => existsSync(join(root, f)))
}

function detectCommands(root: string): Record<string, string> {
  const commands: Record<string, string> = {}

  // From package.json scripts
  const pkgPath = join(root, 'package.json')
  if (existsSync(pkgPath)) {
    try {
      const pkg = JSON.parse(readFileSync(pkgPath, 'utf8'))
      const scripts = pkg.scripts || {}
      const useful = ['dev', 'start', 'build', 'test', 'lint', 'typecheck', 'deploy', 'format', 'check']
      for (const s of useful) {
        if (scripts[s]) {
          const pm = detectPackageManager(root) || 'npm'
          commands[s] = `${pm} run ${s}`
        }
      }
    } catch { /* ignore */ }
  }

  // From Makefile
  if (existsSync(join(root, 'Makefile'))) {
    try {
      const makefile = readFileSync(join(root, 'Makefile'), 'utf8')
      const targets = makefile.match(/^([a-zA-Z_-]+):/gm)
      if (targets) {
        for (const t of targets.slice(0, 8)) {
          const name = t.replace(':', '')
          if (!['all', 'clean', '.PHONY', 'default'].includes(name)) {
            commands[name] = `make ${name}`
          }
        }
      }
    } catch { /* ignore */ }
  }

  // Cargo commands
  if (existsSync(join(root, 'Cargo.toml'))) {
    commands.build = commands.build || 'cargo build'
    commands.test = commands.test || 'cargo test'
    commands.run = commands.run || 'cargo run'
  }

  // Go commands
  if (existsSync(join(root, 'go.mod'))) {
    commands.build = commands.build || 'go build ./...'
    commands.test = commands.test || 'go test ./...'
  }

  return commands
}

function suggestAgent(language: string, framework?: string): string {
  if (framework) {
    const webFrameworks = ['React', 'Vue', 'Svelte', 'Next.js', 'Nuxt', 'Angular', 'Remix', 'Astro', 'Gatsby']
    if (webFrameworks.includes(framework)) return 'coder'
    if (['Express', 'Fastify', 'Hono', 'NestJS'].includes(framework)) return 'coder'
    if (['Django', 'Flask', 'FastAPI'].includes(framework)) return 'coder'
  }
  return 'kernel'
}

// ── File Counting ──

function countFilesByExtension(root: string): { counts: Record<string, number>; total: number } {
  const counts: Record<string, number> = {}
  let total = 0

  const SKIP_DIRS = new Set([
    'node_modules', '.git', 'dist', 'build', '.next', '.nuxt', '__pycache__',
    '.cache', '.turbo', '.vite', 'target', 'vendor', 'coverage', '.parcel-cache',
  ])

  function walk(dir: string, depth: number): void {
    if (depth > 8) return // avoid deep recursion
    let entries: string[]
    try {
      entries = readdirSync(dir)
    } catch {
      return
    }

    for (const entry of entries) {
      if (entry.startsWith('.') && entry !== '.env.example') continue
      if (SKIP_DIRS.has(entry)) continue

      const fullPath = join(dir, entry)
      let stat
      try {
        stat = statSync(fullPath)
      } catch {
        continue
      }

      if (stat.isDirectory()) {
        walk(fullPath, depth + 1)
      } else if (stat.isFile()) {
        total++
        const ext = extname(entry).toLowerCase()
        if (ext) {
          counts[ext] = (counts[ext] || 0) + 1
        }
      }
    }
  }

  walk(root, 0)
  return { counts, total }
}

// ── README Reading ──

function readReadmeExcerpt(root: string): string | undefined {
  const candidates = ['README.md', 'readme.md', 'Readme.md', 'README.rst', 'README.txt', 'README']
  for (const name of candidates) {
    const readmePath = join(root, name)
    if (existsSync(readmePath)) {
      try {
        const content = readFileSync(readmePath, 'utf8')
        return content.slice(0, 500)
      } catch {
        return undefined
      }
    }
  }
  return undefined
}

// ── Forge Tool Generation ──

interface ForgedToolDef {
  name: string
  description: string
  code: string
}

function generateProjectTools(config: KbotProjectConfig): ForgedToolDef[] {
  const tools: ForgedToolDef[] = []

  // Test runner
  if (config.commands.test) {
    tools.push({
      name: 'run_tests',
      description: `Run ${config.name} test suite`,
      code: `const { execSync } = require('child_process'); try { return execSync('${config.commands.test}', { encoding: 'utf8', timeout: 120000, cwd: process.cwd() }).slice(-2000); } catch(e) { return 'Tests failed:\\n' + (e.stderr || e.stdout || e.message).slice(-2000); }`,
    })
  }

  // Type checker / linter
  if (config.commands.typecheck || config.commands.lint) {
    const cmd = config.commands.typecheck || config.commands.lint
    tools.push({
      name: 'check_code',
      description: `Run type-check/lint for ${config.name}`,
      code: `const { execSync } = require('child_process'); try { return execSync('${cmd}', { encoding: 'utf8', timeout: 60000, cwd: process.cwd() }).slice(-2000) || 'All checks passed.'; } catch(e) { return 'Check failed:\\n' + (e.stderr || e.stdout || e.message).slice(-2000); }`,
    })
  }

  // Build
  if (config.commands.build) {
    tools.push({
      name: 'build_project',
      description: `Build ${config.name}`,
      code: `const { execSync } = require('child_process'); try { return execSync('${config.commands.build}', { encoding: 'utf8', timeout: 120000, cwd: process.cwd() }).slice(-2000) || 'Build succeeded.'; } catch(e) { return 'Build failed:\\n' + (e.stderr || e.stdout || e.message).slice(-2000); }`,
    })
  }

  // Dev server
  if (config.commands.dev || config.commands.start) {
    const cmd = config.commands.dev || config.commands.start
    tools.push({
      name: 'start_dev',
      description: `Start ${config.name} dev server`,
      code: `const { spawn } = require('child_process'); const [bin, ...args] = '${cmd}'.split(' '); const p = spawn(bin, args, { cwd: process.cwd(), stdio: 'pipe' }); let out = ''; p.stdout?.on('data', d => out += d); p.stderr?.on('data', d => out += d); return new Promise(r => setTimeout(() => { p.kill(); r('Dev server started. Output:\\n' + out.slice(-1000)); }, 3000));`,
    })
  }

  return tools
}

// ── Main Init ──

export async function initProject(root: string): Promise<KbotProjectConfig> {
  const name = detectProjectName(root)
  const language = detectLanguage(root)
  const framework = detectFramework(root)
  const packageManager = detectPackageManager(root)
  const keyFiles = detectKeyFiles(root)
  const commands = detectCommands(root)
  const defaultAgent = suggestAgent(language, framework)
  const { counts: fileCounts, total: totalFiles } = countFilesByExtension(root)
  const readmeExcerpt = readReadmeExcerpt(root)

  const config: KbotProjectConfig = {
    name,
    language,
    framework,
    packageManager,
    defaultAgent,
    keyFiles,
    commands,
    forgedTools: [],
    fileCounts,
    totalFiles,
    readmeExcerpt,
    createdAt: new Date().toISOString(),
  }

  // Generate and save forged tools
  const tools = generateProjectTools(config)
  const forgeDir = join(homedir(), '.kbot', 'plugins', 'forged')
  if (!existsSync(forgeDir)) mkdirSync(forgeDir, { recursive: true })

  for (const tool of tools) {
    const toolPath = join(forgeDir, `${tool.name}.js`)
    const wrapper = `// Auto-generated by kbot init for ${name}
// ${tool.description}
module.exports = async function(args) {
  ${tool.code}
};
module.exports.description = ${JSON.stringify(tool.description)};
`
    writeFileSync(toolPath, wrapper)
    config.forgedTools.push(tool.name)
  }

  // Write .kbot/config.json (project-local config directory)
  const kbotDir = join(root, '.kbot')
  if (!existsSync(kbotDir)) mkdirSync(kbotDir, { recursive: true })
  const kbotConfigPath = join(kbotDir, 'config.json')
  writeFileSync(kbotConfigPath, JSON.stringify(config, null, 2))

  // Also write .kbot.json at root for backward compatibility
  const configPath = join(root, '.kbot.json')
  writeFileSync(configPath, JSON.stringify(config, null, 2))

  // Add to .gitignore if not already there
  const gitignorePath = join(root, '.gitignore')
  if (existsSync(gitignorePath)) {
    const gitignore = readFileSync(gitignorePath, 'utf8')
    let updated = gitignore
    if (!gitignore.includes('.kbot.json')) {
      updated = updated.trimEnd() + '\n.kbot.json\n'
    }
    if (!gitignore.includes('.kbot/')) {
      updated = updated.trimEnd() + '\n.kbot/\n'
    }
    if (updated !== gitignore) {
      writeFileSync(gitignorePath, updated)
    }
  }

  return config
}

export function formatInitReport(config: KbotProjectConfig): string {
  const lines: string[] = []

  lines.push(`  Project:    ${config.name}`)
  lines.push(`  Language:   ${config.language}${config.framework ? ` (${config.framework})` : ''}`)
  if (config.packageManager) lines.push(`  Package Mgr: ${config.packageManager}`)
  lines.push(`  Agent:      ${config.defaultAgent}`)
  lines.push(`  Key files:  ${config.keyFiles.length} detected`)
  lines.push(`  Total files: ${config.totalFiles}`)

  // Show top file extensions
  const topExts = Object.entries(config.fileCounts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 6)
    .map(([ext, count]) => `${ext} (${count})`)
  if (topExts.length > 0) {
    lines.push(`  File types: ${topExts.join(', ')}`)
  }

  if (Object.keys(config.commands).length > 0) {
    lines.push(`  Commands:   ${Object.keys(config.commands).join(', ')}`)
  }

  if (config.forgedTools.length > 0) {
    lines.push(`  Tools:      ${config.forgedTools.join(', ')} (auto-forged)`)
  }

  return lines.join('\n')
}

/**
 * Print the user-friendly init summary.
 * Format: "I detected a [framework] project with [N] files. I've configured [M] tools for your stack."
 */
export function formatInitSummary(config: KbotProjectConfig): string {
  const stackLabel = config.framework
    ? `${config.framework} (${config.language})`
    : config.language
  const toolCount = config.forgedTools.length + Object.keys(config.commands).length
  return `I detected a ${stackLabel} project with ${config.totalFiles} files. I've configured ${toolCount} tools for your stack.`
}

/**
 * runInit() — 60-second onboarding entry point.
 *
 * 1. Detects project type (package.json, Cargo.toml, pyproject.toml, go.mod, etc.)
 * 2. Detects framework (React, Next.js, Vue, Express, FastAPI, Django, Flask, Rails, etc.)
 * 3. Counts files by extension
 * 4. Reads README.md (first 500 chars)
 * 5. Creates .kbot/config.json with detected info
 * 6. Prints summary
 * 7. Suggests a first query
 */
export async function runInit(root?: string): Promise<KbotProjectConfig> {
  const projectRoot = root || process.cwd()
  const startTime = Date.now()

  const config = await initProject(projectRoot)

  const elapsed = ((Date.now() - startTime) / 1000).toFixed(1)

  // Print detailed report
  process.stderr.write('\n')
  process.stderr.write(formatInitReport(config) + '\n')
  process.stderr.write('\n')

  // Print user-friendly summary
  process.stderr.write(`  ${formatInitSummary(config)}\n`)
  process.stderr.write('\n')

  // Show README excerpt if available
  if (config.readmeExcerpt) {
    const excerpt = config.readmeExcerpt.split('\n').slice(0, 5).join('\n')
    process.stderr.write(`  README preview:\n`)
    for (const line of excerpt.split('\n')) {
      process.stderr.write(`    ${line}\n`)
    }
    process.stderr.write('\n')
  }

  process.stderr.write(`  Completed in ${elapsed}s\n`)
  process.stderr.write('\n')
  process.stderr.write(`  Try: kbot "explain this project in 2 sentences"\n`)
  process.stderr.write('\n')

  return config
}
