import { registerTool } from './index.js'
import { execSync } from 'node:child_process'
import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface TestResult {
  framework: string
  total: number
  passed: number
  failed: number
  skipped: number
  failures: FailureDetail[]
  raw?: string
}

interface FailureDetail {
  name: string
  message: string
}

// ---------------------------------------------------------------------------
// Framework detection
// ---------------------------------------------------------------------------

type Framework = 'vitest' | 'jest' | 'pytest' | 'cargo' | 'go' | 'npm'

function detectFramework(projectPath: string): Framework | null {
  // 1. Vitest — explicit config or vite config with test section
  const vitestConfigs = [
    'vitest.config.ts',
    'vitest.config.js',
    'vitest.config.mts',
    'vitest.config.mjs',
  ]
  for (const cfg of vitestConfigs) {
    if (existsSync(join(projectPath, cfg))) return 'vitest'
  }
  // Check vite.config.* for a `test` key (lightweight heuristic)
  const viteConfigs = [
    'vite.config.ts',
    'vite.config.js',
    'vite.config.mts',
    'vite.config.mjs',
  ]
  for (const cfg of viteConfigs) {
    const p = join(projectPath, cfg)
    if (existsSync(p)) {
      try {
        const content = readFileSync(p, 'utf-8')
        if (/\btest\s*[:{]/.test(content)) return 'vitest'
      } catch {
        // ignore read errors
      }
    }
  }

  // 2. Jest — explicit config or "jest" key in package.json
  const jestConfigs = [
    'jest.config.ts',
    'jest.config.js',
    'jest.config.mjs',
    'jest.config.cjs',
    'jest.config.json',
  ]
  for (const cfg of jestConfigs) {
    if (existsSync(join(projectPath, cfg))) return 'jest'
  }
  const pkgPath = join(projectPath, 'package.json')
  if (existsSync(pkgPath)) {
    try {
      const pkg = JSON.parse(readFileSync(pkgPath, 'utf-8'))
      if (pkg.jest) return 'jest'
    } catch {
      // ignore parse errors
    }
  }

  // 3. Pytest
  if (existsSync(join(projectPath, 'pytest.ini'))) return 'pytest'
  if (existsSync(join(projectPath, 'setup.cfg'))) {
    try {
      const content = readFileSync(join(projectPath, 'setup.cfg'), 'utf-8')
      if (/\[tool:pytest\]/.test(content)) return 'pytest'
    } catch {
      // ignore
    }
  }
  if (existsSync(join(projectPath, 'pyproject.toml'))) {
    try {
      const content = readFileSync(join(projectPath, 'pyproject.toml'), 'utf-8')
      if (/\[tool\.pytest/.test(content)) return 'pytest'
    } catch {
      // ignore
    }
  }

  // 4. Cargo (Rust)
  if (existsSync(join(projectPath, 'Cargo.toml'))) return 'cargo'

  // 5. Go
  if (existsSync(join(projectPath, 'go.mod'))) return 'go'

  // 6. Fallback — npm test script
  if (existsSync(pkgPath)) {
    try {
      const pkg = JSON.parse(readFileSync(pkgPath, 'utf-8'))
      if (pkg.scripts?.test && pkg.scripts.test !== 'echo "Error: no test specified" && exit 1') {
        return 'npm'
      }
    } catch {
      // ignore
    }
  }

  return null
}

// ---------------------------------------------------------------------------
// Command builders
// ---------------------------------------------------------------------------

function buildCommand(
  framework: Framework,
  opts: { pattern?: string; file?: string; verbose?: boolean },
): string {
  switch (framework) {
    case 'vitest': {
      let cmd = 'npx vitest run --reporter=json'
      if (opts.file) cmd += ` ${opts.file}`
      else if (opts.pattern) cmd += ` --testPathPattern="${opts.pattern}"`
      return cmd
    }
    case 'jest': {
      let cmd = 'npx jest --json'
      if (opts.file) cmd += ` ${opts.file}`
      else if (opts.pattern) cmd += ` --testPathPattern="${opts.pattern}"`
      return cmd
    }
    case 'pytest': {
      let cmd = 'python -m pytest --tb=short -q'
      if (opts.file) cmd += ` ${opts.file}`
      else if (opts.pattern) cmd += ` -k "${opts.pattern}"`
      if (opts.verbose) cmd += ' -v'
      return cmd
    }
    case 'cargo': {
      let cmd = 'cargo test'
      if (opts.file) cmd += ` --test ${opts.file}`
      else if (opts.pattern) cmd += ` ${opts.pattern}`
      cmd += ' 2>&1'
      return cmd
    }
    case 'go': {
      let cmd = 'go test'
      if (opts.file) cmd += ` ${opts.file}`
      else cmd += ' ./...'
      if (opts.verbose) cmd += ' -v'
      cmd += ' 2>&1'
      return cmd
    }
    case 'npm': {
      return 'npm test 2>&1'
    }
  }
}

// ---------------------------------------------------------------------------
// Output parsers
// ---------------------------------------------------------------------------

function parseVitestJson(raw: string): TestResult {
  const result: TestResult = {
    framework: 'vitest',
    total: 0,
    passed: 0,
    failed: 0,
    skipped: 0,
    failures: [],
  }

  try {
    // vitest --reporter=json may prefix non-JSON output; find the JSON object
    const jsonStart = raw.indexOf('{')
    const jsonEnd = raw.lastIndexOf('}')
    if (jsonStart === -1 || jsonEnd === -1) return { ...result, raw }

    const data = JSON.parse(raw.substring(jsonStart, jsonEnd + 1))
    result.total = data.numTotalTests ?? 0
    result.passed = data.numPassedTests ?? 0
    result.failed = data.numFailedTests ?? 0
    result.skipped = (data.numPendingTests ?? 0) + (data.numTodoTests ?? 0)

    if (Array.isArray(data.testResults)) {
      for (const suite of data.testResults) {
        if (suite.status === 'failed' && Array.isArray(suite.assertionResults)) {
          for (const assertion of suite.assertionResults) {
            if (assertion.status === 'failed') {
              result.failures.push({
                name: assertion.ancestorTitles
                  ? [...assertion.ancestorTitles, assertion.title].join(' > ')
                  : assertion.fullName ?? assertion.title ?? 'unknown',
                message: Array.isArray(assertion.failureMessages)
                  ? assertion.failureMessages.join('\n').slice(0, 500)
                  : String(assertion.failureMessages ?? '').slice(0, 500),
              })
            }
          }
        }
      }
    }
  } catch {
    result.raw = raw
  }

  return result
}

function parseJestJson(raw: string): TestResult {
  const result: TestResult = {
    framework: 'jest',
    total: 0,
    passed: 0,
    failed: 0,
    skipped: 0,
    failures: [],
  }

  try {
    const jsonStart = raw.indexOf('{')
    const jsonEnd = raw.lastIndexOf('}')
    if (jsonStart === -1 || jsonEnd === -1) return { ...result, raw }

    const data = JSON.parse(raw.substring(jsonStart, jsonEnd + 1))
    result.total = data.numTotalTests ?? 0
    result.passed = data.numPassedTests ?? 0
    result.failed = data.numFailedTests ?? 0
    result.skipped = data.numPendingTests ?? 0

    if (Array.isArray(data.testResults)) {
      for (const suite of data.testResults) {
        if (Array.isArray(suite.assertionResults)) {
          for (const assertion of suite.assertionResults) {
            if (assertion.status === 'failed') {
              result.failures.push({
                name: assertion.ancestorTitles
                  ? [...assertion.ancestorTitles, assertion.title].join(' > ')
                  : assertion.fullName ?? assertion.title ?? 'unknown',
                message: Array.isArray(assertion.failureMessages)
                  ? assertion.failureMessages.join('\n').slice(0, 500)
                  : String(assertion.failureMessages ?? '').slice(0, 500),
              })
            }
          }
        }
      }
    }
  } catch {
    result.raw = raw
  }

  return result
}

function parsePytestOutput(raw: string): TestResult {
  const result: TestResult = {
    framework: 'pytest',
    total: 0,
    passed: 0,
    failed: 0,
    skipped: 0,
    failures: [],
  }

  // Match summary line: "X passed, Y failed, Z skipped" etc.
  const summaryMatch = raw.match(
    /(\d+)\s+passed|(\d+)\s+failed|(\d+)\s+error|(\d+)\s+skipped|(\d+)\s+warning/g,
  )
  if (summaryMatch) {
    for (const part of summaryMatch) {
      const numMatch = part.match(/(\d+)\s+(\w+)/)
      if (!numMatch) continue
      const count = parseInt(numMatch[1], 10)
      const label = numMatch[2]
      if (label === 'passed') result.passed = count
      else if (label === 'failed' || label === 'error') result.failed += count
      else if (label === 'skipped') result.skipped = count
    }
    result.total = result.passed + result.failed + result.skipped
  }

  // Extract FAILED lines
  const failedLines = raw.match(/FAILED\s+(.+?)(?:\s+-\s+(.+))?$/gm)
  if (failedLines) {
    for (const line of failedLines) {
      const m = line.match(/FAILED\s+(.+?)(?:\s+-\s+(.+))?$/)
      if (m) {
        result.failures.push({
          name: m[1].trim(),
          message: m[2]?.trim() ?? '',
        })
      }
    }
  }

  if (result.total === 0) result.raw = raw

  return result
}

function parseCargoOutput(raw: string): TestResult {
  const result: TestResult = {
    framework: 'cargo',
    total: 0,
    passed: 0,
    failed: 0,
    skipped: 0,
    failures: [],
  }

  // Match "test result: ok/FAILED. X passed; Y failed; Z ignored"
  const summaryMatch = raw.match(
    /test result:\s*\w+\.\s*(\d+)\s+passed;\s*(\d+)\s+failed;\s*(\d+)\s+ignored/,
  )
  if (summaryMatch) {
    result.passed = parseInt(summaryMatch[1], 10)
    result.failed = parseInt(summaryMatch[2], 10)
    result.skipped = parseInt(summaryMatch[3], 10)
    result.total = result.passed + result.failed + result.skipped
  }

  // Extract failures: lines matching "---- <test_name> stdout ----" followed by failure text
  const failureBlocks = raw.split(/----\s+(.+?)\s+stdout\s+----/)
  for (let i = 1; i < failureBlocks.length; i += 2) {
    const testName = failureBlocks[i]
    const body = failureBlocks[i + 1] ?? ''
    // Only include if there's an assertion failure
    if (body.includes("thread '") && body.includes('panicked at')) {
      const msgMatch = body.match(/panicked at\s+'([^']+)'/)
      result.failures.push({
        name: testName,
        message: msgMatch ? msgMatch[1].slice(0, 500) : body.slice(0, 500),
      })
    }
  }

  if (result.total === 0) result.raw = raw

  return result
}

function parseGoOutput(raw: string): TestResult {
  const result: TestResult = {
    framework: 'go',
    total: 0,
    passed: 0,
    failed: 0,
    skipped: 0,
    failures: [],
  }

  // Count pass/fail from "--- PASS:" and "--- FAIL:" lines
  const passMatches = raw.match(/---\s+PASS:/g)
  const failMatches = raw.match(/---\s+FAIL:/g)
  const skipMatches = raw.match(/---\s+SKIP:/g)

  result.passed = passMatches?.length ?? 0
  result.failed = failMatches?.length ?? 0
  result.skipped = skipMatches?.length ?? 0
  result.total = result.passed + result.failed + result.skipped

  // Extract failure details
  const failLines = raw.match(/---\s+FAIL:\s+(\S+)\s+\([\d.]+s\)/g)
  if (failLines) {
    for (const line of failLines) {
      const m = line.match(/---\s+FAIL:\s+(\S+)/)
      if (m) {
        // Try to find the error message above this FAIL line
        const idx = raw.indexOf(line)
        const preceding = raw.substring(Math.max(0, idx - 500), idx)
        const errLines = preceding
          .split('\n')
          .filter((l) => l.includes('Error') || l.includes('expected') || l.includes('got'))
          .slice(-3)
        result.failures.push({
          name: m[1],
          message: errLines.join('\n').slice(0, 500) || 'Test failed',
        })
      }
    }
  }

  // Fallback: check for "FAIL" at package level if no individual tests found
  if (result.total === 0) {
    const pkgFail = raw.match(/^FAIL\s+\S+/gm)
    const pkgOk = raw.match(/^ok\s+\S+/gm)
    if (pkgFail || pkgOk) {
      result.failed = pkgFail?.length ?? 0
      result.passed = pkgOk?.length ?? 0
      result.total = result.passed + result.failed
    }
  }

  if (result.total === 0) result.raw = raw

  return result
}

function parseGenericOutput(raw: string): TestResult {
  const result: TestResult = {
    framework: 'npm',
    total: 0,
    passed: 0,
    failed: 0,
    skipped: 0,
    failures: [],
    raw,
  }

  // Try common patterns
  // "X passing", "Y failing", "Z pending"
  const passingMatch = raw.match(/(\d+)\s+passing/i)
  const failingMatch = raw.match(/(\d+)\s+failing/i)
  const pendingMatch = raw.match(/(\d+)\s+pending/i)

  if (passingMatch) result.passed = parseInt(passingMatch[1], 10)
  if (failingMatch) result.failed = parseInt(failingMatch[1], 10)
  if (pendingMatch) result.skipped = parseInt(pendingMatch[1], 10)

  // "Tests: X passed, Y failed, Z total"
  const testsLine = raw.match(/Tests:\s*(\d+)\s+passed.*?(\d+)\s+failed.*?(\d+)\s+total/i)
  if (testsLine) {
    result.passed = parseInt(testsLine[1], 10)
    result.failed = parseInt(testsLine[2], 10)
    result.total = parseInt(testsLine[3], 10)
  }

  if (result.total === 0) {
    result.total = result.passed + result.failed + result.skipped
  }

  return result
}

function parseOutput(framework: Framework, raw: string): TestResult {
  switch (framework) {
    case 'vitest':
      return parseVitestJson(raw)
    case 'jest':
      return parseJestJson(raw)
    case 'pytest':
      return parsePytestOutput(raw)
    case 'cargo':
      return parseCargoOutput(raw)
    case 'go':
      return parseGoOutput(raw)
    case 'npm':
      return parseGenericOutput(raw)
  }
}

// ---------------------------------------------------------------------------
// Format result for agent consumption
// ---------------------------------------------------------------------------

function formatResult(result: TestResult): string {
  const lines: string[] = []

  lines.push(`Framework: ${result.framework}`)
  lines.push(
    `Total: ${result.total} | Passed: ${result.passed} | Failed: ${result.failed}${result.skipped ? ` | Skipped: ${result.skipped}` : ''}`,
  )

  if (result.failures.length > 0) {
    lines.push('')
    lines.push('Failures:')
    for (let i = 0; i < result.failures.length; i++) {
      const f = result.failures[i]
      lines.push(`  ${i + 1}. ${f.name}`)
      if (f.message) {
        const msgLines = f.message.split('\n').filter(Boolean)
        for (const ml of msgLines) {
          lines.push(`     ${ml.trim()}`)
        }
      }
    }
  }

  if (result.failed === 0 && result.total > 0) {
    lines.push('')
    lines.push('All tests passed.')
  }

  if (result.raw && result.total === 0) {
    lines.push('')
    lines.push('Could not parse test output. Raw output:')
    lines.push(result.raw.slice(0, 2000))
  }

  return lines.join('\n')
}

// ---------------------------------------------------------------------------
// Run tests
// ---------------------------------------------------------------------------

function runTests(
  projectPath: string,
  opts: { pattern?: string; file?: string; verbose?: boolean } = {},
): string {
  const resolvedPath = projectPath || process.cwd()

  if (!existsSync(resolvedPath)) {
    return `Error: path does not exist: ${resolvedPath}`
  }

  const framework = detectFramework(resolvedPath)
  if (!framework) {
    return (
      'No test framework detected. Looked for:\n' +
      '  - vitest.config.* or vite.config.* with test section\n' +
      '  - jest.config.* or "jest" in package.json\n' +
      '  - pytest.ini, pyproject.toml with [tool.pytest]\n' +
      '  - Cargo.toml\n' +
      '  - go.mod\n' +
      '  - package.json with "test" script'
    )
  }

  const cmd = buildCommand(framework, opts)

  let stdout: string
  try {
    stdout = execSync(cmd, {
      cwd: resolvedPath,
      timeout: 120_000,
      maxBuffer: 10 * 1024 * 1024, // 10 MB
      encoding: 'utf-8',
      stdio: ['pipe', 'pipe', 'pipe'],
      env: { ...process.env, FORCE_COLOR: '0', CI: 'true' },
    })
  } catch (err: unknown) {
    // Test failures cause non-zero exit codes — capture stdout anyway
    const execErr = err as { stdout?: string; stderr?: string; message?: string }
    stdout = execErr.stdout ?? execErr.stderr ?? execErr.message ?? 'Unknown error'
  }

  const result = parseOutput(framework, stdout)
  return formatResult(result)
}

// ---------------------------------------------------------------------------
// Registration
// ---------------------------------------------------------------------------

export function registerTestRunnerTools(): void {
  registerTool({
    name: 'run_tests',
    deprecated: true,
    description:
      'Run project tests. Auto-detects the test framework (vitest, jest, pytest, cargo, go, npm) by checking config files, runs tests, and returns structured pass/fail results with failure details the agent can use to auto-fix issues.',
    parameters: {
      path: { type: 'string', description: 'Project root path. Defaults to current working directory.' },
      pattern: { type: 'string', description: 'Test file pattern or filter to narrow which tests to run.' },
      verbose: { type: 'boolean', description: 'Enable verbose output from the test runner.' },
    },
    tier: 'free',
    async execute(args) {
      return runTests(String(args.path || process.cwd()), {
        pattern: args.pattern ? String(args.pattern) : undefined,
        verbose: args.verbose === true,
      })
    },
  })

  registerTool({
    name: 'test_file',
    description:
      'Run tests for a specific file. Auto-detects the test framework and runs only the specified test file, returning structured results with failure details.',
    parameters: {
      path: { type: 'string', description: 'Absolute or relative path to the test file to run.', required: true },
    },
    tier: 'free',
    async execute(args) {
      const args_path = String(args.path || '')
      if (!args_path) {
        return 'Error: path is required. Provide the path to the test file.'
      }

      // Derive project root by walking up from the test file to find a config
      const { dirname } = await import('node:path')
      let dir = dirname(args_path.startsWith('/') ? args_path : join(process.cwd(), args_path))
      let projectRoot = process.cwd()

      // Walk up to find project root (look for package.json, Cargo.toml, go.mod, etc.)
      const rootMarkers = ['package.json', 'Cargo.toml', 'go.mod', 'pyproject.toml', 'pytest.ini']
      for (let i = 0; i < 10; i++) {
        if (rootMarkers.some((marker) => existsSync(join(dir, marker)))) {
          projectRoot = dir
          break
        }
        const parent = dirname(dir)
        if (parent === dir) break
        dir = parent
      }

      return runTests(projectRoot, { file: args_path })
    },
  })
}
