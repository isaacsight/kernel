// K:BOT Quality Tools — Linting, Testing, Dependency Auditing
//
// These tools fill the biggest gap vs competitors (Aider, OpenCode, Claude Code).
// All run locally, parse structured output, and return actionable results.

import { registerTool } from './index.js'
import { execSync } from 'child_process'
import { existsSync, readFileSync } from 'fs'
import { join, extname } from 'path'

// ── Helpers ──

function tryExec(cmd: string, cwd?: string, timeout = 60_000): { stdout: string; error: boolean } {
  try {
    const stdout = execSync(cmd, {
      cwd: cwd || process.cwd(),
      timeout,
      encoding: 'utf-8',
      stdio: ['pipe', 'pipe', 'pipe'],
    })
    return { stdout, error: false }
  } catch (err: unknown) {
    const e = err as { stdout?: string; stderr?: string; message?: string }
    // Many linters/test runners exit non-zero on failures — that's expected
    // But we still mark it as an error so callers know the command didn't succeed cleanly
    return { stdout: e.stdout || e.stderr || e.message || 'Command failed', error: true }
  }
}

function detectPackageManager(): 'npm' | 'pnpm' | 'yarn' | 'bun' | null {
  if (existsSync('bun.lockb') || existsSync('bun.lock')) return 'bun'
  if (existsSync('pnpm-lock.yaml')) return 'pnpm'
  if (existsSync('yarn.lock')) return 'yarn'
  if (existsSync('package-lock.json') || existsSync('package.json')) return 'npm'
  return null
}

function detectTestFramework(): { cmd: string; name: string } | null {
  try {
    const pkg = JSON.parse(readFileSync('package.json', 'utf-8'))
    const deps = { ...pkg.devDependencies, ...pkg.dependencies }

    if (deps.vitest) return { cmd: 'npx vitest run --reporter=json', name: 'vitest' }
    if (deps.jest) return { cmd: 'npx jest --json --forceExit', name: 'jest' }
    if (deps.mocha) return { cmd: 'npx mocha --reporter json', name: 'mocha' }
  } catch { /* no package.json */ }

  if (existsSync('pytest.ini') || existsSync('pyproject.toml')) {
    return { cmd: 'python -m pytest --tb=short -q', name: 'pytest' }
  }
  if (existsSync('go.mod')) {
    return { cmd: 'go test ./... -json', name: 'go test' }
  }
  if (existsSync('Cargo.toml')) {
    return { cmd: 'cargo test 2>&1', name: 'cargo test' }
  }
  return null
}

function detectLinter(): { cmd: string; name: string } | null {
  try {
    const pkg = JSON.parse(readFileSync('package.json', 'utf-8'))
    const deps = { ...pkg.devDependencies, ...pkg.dependencies }

    if (deps.eslint) return { cmd: 'npx eslint --format json', name: 'eslint' }
    if (deps.biome || deps['@biomejs/biome']) return { cmd: 'npx biome check --reporter json', name: 'biome' }
  } catch { /* no package.json */ }

  if (existsSync('.flake8') || existsSync('pyproject.toml')) {
    return { cmd: 'python -m flake8 --format json', name: 'flake8' }
  }
  if (existsSync('Cargo.toml')) {
    return { cmd: 'cargo clippy --message-format json 2>&1', name: 'clippy' }
  }
  if (existsSync('go.mod')) {
    return { cmd: 'golangci-lint run --out-format json 2>&1', name: 'golangci-lint' }
  }
  return null
}


// ── Tools ──

export function registerQualityTools(): void {

  // ── Lint Check ──

  registerTool({
    name: 'lint_check',
    description: 'Run linter on files and return violations with line numbers and fix suggestions. Auto-detects ESLint, Biome, Flake8, Clippy, golangci-lint.',
    parameters: {
      path: { type: 'string', description: 'File or directory to lint (default: current directory)' },
      fix: { type: 'boolean', description: 'Auto-fix fixable issues (default: false)' },
    },
    tier: 'free',
    timeout: 120_000,
    async execute(args) {
      const linter = detectLinter()
      if (!linter) {
        return 'No linter detected. Install one: npm i -D eslint, pip install flake8, or cargo install clippy'
      }

      const target = args.path ? ` ${String(args.path)}` : ' .'
      const fixFlag = args.fix ? ' --fix' : ''
      const cmd = `${linter.cmd}${fixFlag}${target}`

      const { stdout } = tryExec(cmd)

      // Try to parse JSON output for structured results
      try {
        const data = JSON.parse(stdout)
        if (Array.isArray(data)) {
          const issues = data.flatMap((f: Record<string, unknown>) => {
            const messages = (f.messages as Array<Record<string, unknown>>) || []
            return messages.map(m => ({
              file: f.filePath || f.file,
              line: m.line,
              col: m.column,
              severity: m.severity === 2 ? 'error' : 'warning',
              message: m.message,
              rule: m.ruleId || m.rule,
            }))
          })
          const errors = issues.filter(i => i.severity === 'error').length
          const warnings = issues.filter(i => i.severity === 'warning').length
          const summary = `${linter.name}: ${errors} errors, ${warnings} warnings`
          const details = issues.slice(0, 50).map(i =>
            `  ${i.file}:${i.line}:${i.col} ${i.severity} ${i.message} (${i.rule})`
          ).join('\n')
          return `${summary}\n${details}${issues.length > 50 ? `\n  ... and ${issues.length - 50} more` : ''}`
        }
      } catch { /* not JSON, return raw */ }

      return `${linter.name} output:\n${stdout.slice(0, 10000)}`
    },
  })

  // ── Test Runner ──

  registerTool({
    name: 'test_run',
    description: 'Run tests and return pass/fail counts, failures with stack traces, and duration. Auto-detects Vitest, Jest, Mocha, pytest, go test, cargo test.',
    parameters: {
      path: { type: 'string', description: 'Test file or pattern (default: run all tests)' },
      watch: { type: 'boolean', description: 'Watch mode (default: false)' },
    },
    tier: 'free',
    timeout: 300_000, // 5 min for large test suites
    async execute(args) {
      const framework = detectTestFramework()
      if (!framework) {
        return 'No test framework detected. Install one: npm i -D vitest, npm i -D jest, pip install pytest'
      }

      let cmd = framework.cmd
      if (args.path) cmd += ` ${String(args.path)}`

      const { stdout } = tryExec(cmd, undefined, 240_000)

      // Parse Vitest/Jest JSON output
      if (framework.name === 'vitest' || framework.name === 'jest') {
        try {
          const data = JSON.parse(stdout)
          const passed = data.numPassedTests || data.testResults?.filter((t: Record<string, unknown>) => t.status === 'passed').length || 0
          const failed = data.numFailedTests || data.testResults?.filter((t: Record<string, unknown>) => t.status === 'failed').length || 0
          const total = data.numTotalTests || (passed + failed)
          const duration = data.testResults?.[0]?.perfStats?.runtime || data.startTime ? 'see output' : 'unknown'

          let result = `${framework.name}: ${passed} passed, ${failed} failed (${total} total)`

          if (failed > 0) {
            const failures = data.testResults
              ?.filter((t: Record<string, unknown>) => t.status === 'failed')
              ?.slice(0, 10)
              ?.map((t: Record<string, unknown>) => `  FAIL ${t.name}\n    ${String(t.message || '').slice(0, 200)}`)
              ?.join('\n') || ''
            result += `\n\nFailures:\n${failures}`
          }

          return result
        } catch { /* not valid JSON, return raw */ }
      }

      // Summarize raw output
      const lines = stdout.split('\n')
      const passLine = lines.find(l => /pass|ok|success/i.test(l) && /\d/.test(l))
      const failLine = lines.find(l => /fail|error|FAIL/i.test(l) && /\d/.test(l))

      let summary = `${framework.name} results:\n`
      if (passLine) summary += `  ${passLine.trim()}\n`
      if (failLine) summary += `  ${failLine.trim()}\n`

      // Include last 50 lines for context
      const tail = lines.slice(-50).join('\n')
      return `${summary}\n${tail}`.slice(0, 10000)
    },
  })

  // ── Dependency Audit ──

  registerTool({
    name: 'deps_audit',
    description: 'Audit dependencies for known vulnerabilities. Returns CVE IDs, severity, and fix suggestions. Auto-detects npm, pip, cargo, go.',
    parameters: {
      fix: { type: 'boolean', description: 'Auto-fix vulnerabilities where possible (default: false)' },
    },
    tier: 'free',
    timeout: 120_000,
    async execute(args) {
      const pm = detectPackageManager()

      if (pm) {
        const fixFlag = args.fix ? ' fix' : ''
        const cmd = pm === 'pnpm' ? `pnpm audit${fixFlag} --json`
          : pm === 'yarn' ? `yarn audit${fixFlag} --json`
          : pm === 'bun' ? 'bun pm audit'
          : `npm audit${fixFlag} --json`

        const { stdout } = tryExec(cmd)

        try {
          const data = JSON.parse(stdout)
          const vulns = data.vulnerabilities || data.advisories || {}
          const entries = Object.values(vulns) as Array<Record<string, unknown>>

          if (entries.length === 0) return 'No vulnerabilities found.'

          const summary = entries.slice(0, 30).map((v) => {
            const severity = v.severity || 'unknown'
            const name = v.name || v.module_name || 'unknown'
            const title = v.title || v.overview || ''
            const fixAvailable = v.fixAvailable ? ' (fix available)' : ''
            const range = v.range || ''
            return `  ${String(severity).toUpperCase()} ${name}${range ? `@${range}` : ''}: ${title}${fixAvailable}`
          }).join('\n')

          const meta = data.metadata || {}
          const total = meta.vulnerabilities
            ? `${meta.vulnerabilities.critical || 0} critical, ${meta.vulnerabilities.high || 0} high, ${meta.vulnerabilities.moderate || 0} moderate, ${meta.vulnerabilities.low || 0} low`
            : `${entries.length} issues`

          return `Vulnerabilities: ${total}\n${summary}${entries.length > 30 ? `\n  ... and ${entries.length - 30} more` : ''}`
        } catch { /* not JSON */ }

        return `Audit output:\n${stdout.slice(0, 10000)}`
      }

      // Python
      if (existsSync('requirements.txt') || existsSync('pyproject.toml')) {
        const { stdout } = tryExec('pip audit --format json 2>/dev/null || pip check')
        return `Python audit:\n${stdout.slice(0, 10000)}`
      }

      // Rust
      if (existsSync('Cargo.toml')) {
        const { stdout } = tryExec('cargo audit 2>&1')
        return `Cargo audit:\n${stdout.slice(0, 10000)}`
      }

      // Go
      if (existsSync('go.mod')) {
        const { stdout } = tryExec('govulncheck ./... 2>&1')
        return `Go vulncheck:\n${stdout.slice(0, 10000)}`
      }

      return 'No package manager detected. Supported: npm, pnpm, yarn, bun, pip, cargo, go.'
    },
  })

  // ── Type Check ──

  registerTool({
    name: 'type_check',
    description: 'Run TypeScript type checker (tsc --noEmit) and return errors with file locations.',
    parameters: {
      path: { type: 'string', description: 'tsconfig.json path (default: auto-detect)' },
    },
    tier: 'free',
    timeout: 120_000,
    async execute(args) {
      const tsconfig = args.path ? ` -p ${String(args.path)}` : ''

      if (!existsSync('tsconfig.json') && !args.path) {
        return 'No tsconfig.json found in current directory.'
      }

      const { stdout } = tryExec(`npx tsc --noEmit${tsconfig}`)

      if (!stdout.trim()) return 'No type errors found.'

      const lines = stdout.split('\n')
      const errors = lines.filter(l => /error TS\d+/.test(l))

      if (errors.length === 0) return `Type check passed.\n${stdout.slice(0, 2000)}`

      return `${errors.length} type errors:\n${errors.slice(0, 50).join('\n')}${errors.length > 50 ? `\n... and ${errors.length - 50} more` : ''}`
    },
  })

  // ── Format Check ──

  registerTool({
    name: 'format_check',
    description: 'Check code formatting without modifying files. Auto-detects Prettier, Biome, Black, gofmt, rustfmt.',
    parameters: {
      path: { type: 'string', description: 'File or directory to check (default: current directory)' },
      fix: { type: 'boolean', description: 'Auto-format files (default: false — check only)' },
    },
    tier: 'free',
    timeout: 60_000,
    async execute(args) {
      const target = args.path ? ` ${String(args.path)}` : ' .'

      // Detect formatter
      let cmd: string | null = null
      let name = ''

      try {
        const pkg = JSON.parse(readFileSync('package.json', 'utf-8'))
        const deps = { ...pkg.devDependencies, ...pkg.dependencies }

        if (deps.prettier) {
          cmd = args.fix ? `npx prettier --write${target}` : `npx prettier --check${target}`
          name = 'prettier'
        } else if (deps.biome || deps['@biomejs/biome']) {
          cmd = args.fix ? `npx biome format --write${target}` : `npx biome format${target}`
          name = 'biome'
        }
      } catch { /* no package.json */ }

      if (!cmd && existsSync('pyproject.toml')) {
        cmd = args.fix ? `black${target}` : `black --check${target}`
        name = 'black'
      }
      if (!cmd && existsSync('go.mod')) {
        cmd = args.fix ? `gofmt -w${target}` : `gofmt -l${target}`
        name = 'gofmt'
      }
      if (!cmd && existsSync('Cargo.toml')) {
        cmd = args.fix ? `rustfmt${target}` : `rustfmt --check${target}`
        name = 'rustfmt'
      }

      if (!cmd) return 'No formatter detected. Install one: npm i -D prettier, pip install black'

      const { stdout } = tryExec(cmd)

      if (!stdout.trim()) return `${name}: all files formatted correctly.`
      return `${name}:\n${stdout.slice(0, 10000)}`
    },
  })
}
