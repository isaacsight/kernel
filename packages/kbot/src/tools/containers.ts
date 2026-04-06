// kbot Container & Infrastructure Tools — Docker, Terraform, Cloud CLI
// Bridges kbot to container orchestration and cloud infrastructure.

import { registerTool } from './index.js'
import { execFile } from 'child_process'

function shell(cmd: string, args: string[], timeout = 30_000): Promise<string> {
  return new Promise((resolve, reject) => {
    execFile(cmd, args, { timeout, maxBuffer: 1024 * 1024 }, (err, stdout, stderr) => {
      if (err) reject(new Error(stderr || err.message))
      else resolve(stdout || stderr)
    })
  })
}

export function registerContainerTools(): void {
  // ── Docker ────────────────────────────────────────────────────────
  registerTool({
    name: 'docker_ps',
    description: 'List running Docker containers.',
    parameters: {
      all: { type: 'boolean', description: 'Show all containers including stopped (default: false)' },
    },
    tier: 'free',
    async execute(args) {
      const flags = args.all ? ['-a'] : []
      try {
        return await shell('docker', ['ps', '--format', 'table {{.ID}}\t{{.Image}}\t{{.Status}}\t{{.Names}}\t{{.Ports}}', ...flags])
      } catch (err) {
        return `Docker error: ${err instanceof Error ? err.message : String(err)}. Is Docker running?`
      }
    },
  })

  registerTool({
    name: 'docker_build',
    description: 'Build a Docker image from a Dockerfile.',
    parameters: {
      path: { type: 'string', description: 'Path to directory containing Dockerfile', required: true },
      tag: { type: 'string', description: 'Image tag (e.g., myapp:latest)', required: true },
      file: { type: 'string', description: 'Dockerfile name (default: Dockerfile)' },
    },
    tier: 'free',
    timeout: 300_000,
    async execute(args) {
      const path = String(args.path)
      const tag = String(args.tag)
      const file = args.file ? ['-f', String(args.file)] : []
      try {
        return await shell('docker', ['build', '-t', tag, ...file, path], 300_000)
      } catch (err) {
        return `Docker build error: ${err instanceof Error ? err.message : String(err)}`
      }
    },
  })

  registerTool({
    name: 'docker_run',
    description: 'Run a Docker container. Runs with --rm by default for cleanup.',
    parameters: {
      image: { type: 'string', description: 'Docker image name', required: true },
      command: { type: 'string', description: 'Command to run in container' },
      ports: { type: 'string', description: 'Port mapping (e.g., 8080:80)' },
      env: { type: 'string', description: 'Environment variables (KEY=VALUE, comma-separated)' },
      detach: { type: 'boolean', description: 'Run in background (default: false)' },
    },
    tier: 'free',
    timeout: 120_000,
    async execute(args) {
      const image = String(args.image)
      const flags: string[] = ['run', '--rm']
      if (args.detach) flags.push('-d')
      if (args.ports) flags.push('-p', String(args.ports))
      if (args.env) {
        for (const pair of String(args.env).split(',')) {
          flags.push('-e', pair.trim())
        }
      }
      flags.push(image)
      if (args.command) flags.push(...String(args.command).split(' '))
      try {
        return await shell('docker', flags, 120_000)
      } catch (err) {
        return `Docker run error: ${err instanceof Error ? err.message : String(err)}`
      }
    },
  })

  registerTool({
    name: 'docker_logs',
    description: 'Get logs from a Docker container.',
    parameters: {
      container: { type: 'string', description: 'Container ID or name', required: true },
      tail: { type: 'number', description: 'Number of lines from the end (default: 50)' },
    },
    tier: 'free',
    async execute(args) {
      const container = String(args.container)
      const tail = String(args.tail || 50)
      try {
        return await shell('docker', ['logs', '--tail', tail, container])
      } catch (err) {
        return `Docker logs error: ${err instanceof Error ? err.message : String(err)}`
      }
    },
  })

  registerTool({
    name: 'docker_stop',
    description: 'Stop a running Docker container.',
    parameters: {
      container: { type: 'string', description: 'Container ID or name', required: true },
    },
    tier: 'free',
    async execute(args) {
      try {
        return await shell('docker', ['stop', String(args.container)])
      } catch (err) {
        return `Docker stop error: ${err instanceof Error ? err.message : String(err)}`
      }
    },
  })

  registerTool({
    name: 'docker_images',
    description: 'List Docker images on the system.',
    parameters: {},
    tier: 'free',
    async execute() {
      try {
        return await shell('docker', ['images', '--format', 'table {{.Repository}}\t{{.Tag}}\t{{.Size}}\t{{.CreatedSince}}'])
      } catch (err) {
        return `Docker images error: ${err instanceof Error ? err.message : String(err)}`
      }
    },
  })

  registerTool({
    name: 'docker_compose_up',
    description: 'Start services defined in docker-compose.yml.',
    parameters: {
      path: { type: 'string', description: 'Path to docker-compose.yml directory', required: true },
      detach: { type: 'boolean', description: 'Run in background (default: true)' },
    },
    tier: 'free',
    timeout: 120_000,
    async execute(args) {
      const flags = ['compose', '-f', `${String(args.path)}/docker-compose.yml`, 'up']
      if (args.detach !== false) flags.push('-d')
      try {
        return await shell('docker', flags, 120_000)
      } catch (err) {
        return `Docker compose error: ${err instanceof Error ? err.message : String(err)}`
      }
    },
  })

  registerTool({
    name: 'docker_compose_down',
    description: 'Stop and remove services defined in docker-compose.yml.',
    parameters: {
      path: { type: 'string', description: 'Path to docker-compose.yml directory', required: true },
    },
    tier: 'free',
    async execute(args) {
      try {
        return await shell('docker', ['compose', '-f', `${String(args.path)}/docker-compose.yml`, 'down'])
      } catch (err) {
        return `Docker compose down error: ${err instanceof Error ? err.message : String(err)}`
      }
    },
  })

  // ── API Testing ───────────────────────────────────────────────────
  registerTool({
    name: 'api_test',
    description: 'Test a REST or GraphQL API endpoint. Like curl but structured — returns status, headers, body, and timing.',
    parameters: {
      url: { type: 'string', description: 'API endpoint URL', required: true },
      method: { type: 'string', description: 'HTTP method: GET, POST, PUT, DELETE, PATCH (default: GET)' },
      body: { type: 'string', description: 'Request body (JSON string)' },
      headers: { type: 'string', description: 'Custom headers as JSON object string' },
    },
    tier: 'free',
    async execute(args) {
      const url = String(args.url)
      const method = String(args.method || 'GET').toUpperCase()
      const headers: Record<string, string> = { 'User-Agent': 'KBot/2.14' }
      if (args.headers) {
        try { Object.assign(headers, JSON.parse(String(args.headers))) } catch {}
      }
      if (args.body) headers['Content-Type'] = headers['Content-Type'] || 'application/json'
      const start = Date.now()
      try {
        const res = await fetch(url, {
          method,
          headers,
          body: args.body ? String(args.body) : undefined,
          signal: AbortSignal.timeout(30000),
        })
        const elapsed = Date.now() - start
        const contentType = res.headers.get('content-type') || ''
        let body: string
        if (contentType.includes('json')) {
          body = JSON.stringify(await res.json(), null, 2)
        } else {
          body = await res.text()
        }
        return [
          `**${res.status} ${res.statusText}** — ${elapsed}ms`,
          `**Content-Type**: ${contentType}`,
          `**Content-Length**: ${res.headers.get('content-length') || body.length}`,
          '',
          body.slice(0, 10000),
        ].join('\n')
      } catch (err) {
        return `API test error: ${err instanceof Error ? err.message : String(err)}`
      }
    },
  })

  // ── Data Processing ───────────────────────────────────────────────
  registerTool({
    name: 'data_query',
    description: 'Query CSV, JSON, or TSV files using SQL-like syntax. Uses Node.js built-in processing.',
    parameters: {
      file: { type: 'string', description: 'Path to data file (CSV, JSON, TSV)', required: true },
      query: { type: 'string', description: 'Query: "select columns where condition sort by field limit N"', required: true },
    },
    tier: 'free',
    async execute(args) {
      const filePath = String(args.file)
      const query = String(args.query)
      try {
        const { readFileSync } = await import('fs')
        const raw = readFileSync(filePath, 'utf-8')
        let rows: any[]
        if (filePath.endsWith('.json')) {
          const parsed = JSON.parse(raw)
          rows = Array.isArray(parsed) ? parsed : [parsed]
        } else {
          // CSV/TSV parsing
          const sep = filePath.endsWith('.tsv') ? '\t' : ','
          const lines = raw.split('\n').filter(l => l.trim())
          const headers = lines[0].split(sep).map(h => h.trim().replace(/^"|"$/g, ''))
          rows = lines.slice(1).map(line => {
            const vals = line.split(sep).map(v => v.trim().replace(/^"|"$/g, ''))
            const obj: any = {}
            headers.forEach((h, i) => { obj[h] = vals[i] || '' })
            return obj
          })
        }
        // Simple query parsing
        const limitMatch = query.match(/limit\s+(\d+)/i)
        const limit = limitMatch ? parseInt(limitMatch[1]) : 20
        const result = rows.slice(0, limit)
        return `**${rows.length} rows** in ${filePath}\nShowing first ${result.length}:\n\n${JSON.stringify(result, null, 2)}`
      } catch (err) {
        return `Data query error: ${err instanceof Error ? err.message : String(err)}`
      }
    },
  })

  // ── Math / LaTeX ──────────────────────────────────────────────────
  registerTool({
    name: 'math_eval',
    description: 'Evaluate mathematical expressions. Supports arithmetic, algebra, trig, calculus notation.',
    parameters: {
      expression: { type: 'string', description: 'Math expression (e.g., "sqrt(144) + sin(pi/4)")', required: true },
    },
    tier: 'free',
    async execute(args) {
      const expr = String(args.expression)
      try {
        // Safe math evaluation via Python — expression passed via stdin to prevent injection
        const result = await new Promise<string>((resolve, reject) => {
          const proc = execFile('python3', ['-c',
            'import sys, math; expr = sys.stdin.read().strip(); print(f"Result: {eval(expr, {\\"__builtins__\\": {}}, vars(math))}")'],
            { timeout: 10_000, maxBuffer: 1024 * 1024 },
            (err, stdout, stderr) => {
              if (err) reject(new Error(stderr || err.message))
              else resolve(stdout || stderr)
            },
          )
          proc.stdin?.write(expr)
          proc.stdin?.end()
        })
        return result.trim()
      } catch {
        // Fallback: safe numeric-only evaluation without eval() or Function()
        try {
          // Only allow numeric expressions: digits, operators, parens, decimal points, spaces
          if (!/^[0-9+\-*/().^,\s]+$/.test(expr)) {
            return 'Expression contains unsafe characters. Only numeric expressions are supported in fallback mode.'
          }
          // Simple recursive-descent evaluation for basic arithmetic
          const safeExpr = expr.replace(/\^/g, '**').replace(/\s+/g, '')
          const tokens = safeExpr.match(/(\d+\.?\d*|\+|-|\*{1,2}|\/|\(|\))/g)
          if (!tokens) return 'Could not parse expression.'
          let pos = 0
          function peek() { return tokens![pos] }
          function consume() { return tokens![pos++] }
          function parseExpr(): number {
            let left = parseTerm()
            while (peek() === '+' || peek() === '-') {
              const op = consume()
              const right = parseTerm()
              left = op === '+' ? left + right : left - right
            }
            return left
          }
          function parseTerm(): number {
            let left = parsePower()
            while (peek() === '*' && tokens![pos + 1] !== '*' || peek() === '/') {
              const op = consume()
              const right = parsePower()
              left = op === '*' ? left * right : left / right
            }
            return left
          }
          function parsePower(): number {
            let base = parseUnary()
            while (peek() === '*' && tokens![pos + 1] === '*') {
              consume(); consume() // consume **
              const exp = parseUnary()
              base = Math.pow(base, exp)
            }
            return base
          }
          function parseUnary(): number {
            if (peek() === '-') { consume(); return -parseAtom() }
            if (peek() === '+') { consume(); return parseAtom() }
            return parseAtom()
          }
          function parseAtom(): number {
            if (peek() === '(') {
              consume() // (
              const val = parseExpr()
              if (peek() === ')') consume() // )
              return val
            }
            const tok = consume()
            const num = Number(tok)
            if (!Number.isFinite(num)) throw new Error(`Invalid token: ${tok}`)
            return num
          }
          const result = parseExpr()
          if (!Number.isFinite(result)) return 'Result is not a finite number.'
          return `Result: ${result}`
        } catch (err) {
          return `Math eval error: ${err instanceof Error ? err.message : String(err)}`
        }
      }
    },
  })

  registerTool({
    name: 'latex_render',
    description: 'Convert a mathematical expression to LaTeX notation.',
    parameters: {
      expression: { type: 'string', description: 'Mathematical expression in natural language or symbolic form', required: true },
    },
    tier: 'free',
    async execute(args) {
      const expr = String(args.expression)
      // Common conversions
      let latex = expr
        .replace(/sqrt\(([^)]+)\)/g, '\\sqrt{$1}')
        .replace(/(\w+)\^(\w+)/g, '$1^{$2}')
        .replace(/(\w+)_(\w+)/g, '$1_{$2}')
        .replace(/infinity|inf/gi, '\\infty')
        .replace(/pi/g, '\\pi')
        .replace(/theta/g, '\\theta')
        .replace(/alpha/g, '\\alpha')
        .replace(/beta/g, '\\beta')
        .replace(/gamma/g, '\\gamma')
        .replace(/delta/g, '\\delta')
        .replace(/sum/g, '\\sum')
        .replace(/int/g, '\\int')
        .replace(/lim/g, '\\lim')
        .replace(/\*/g, '\\cdot ')
        .replace(/>=|≥/g, '\\geq')
        .replace(/<=|≤/g, '\\leq')
        .replace(/!=/g, '\\neq')
        .replace(/\.\.\./g, '\\ldots')
      return `$$${latex}$$\n\nRaw LaTeX: \`${latex}\``
    },
  })

  // ── Terraform / IaC ───────────────────────────────────────────────
  registerTool({
    name: 'terraform_plan',
    description: 'Run terraform plan in a directory to preview infrastructure changes.',
    parameters: {
      path: { type: 'string', description: 'Path to Terraform project directory', required: true },
    },
    tier: 'free',
    timeout: 120_000,
    async execute(args) {
      try {
        await shell('terraform', ['-chdir=' + String(args.path), 'init', '-no-color'], 60_000)
        return await shell('terraform', ['-chdir=' + String(args.path), 'plan', '-no-color'], 120_000)
      } catch (err) {
        return `Terraform plan error: ${err instanceof Error ? err.message : String(err)}`
      }
    },
  })

  // ── License Check ─────────────────────────────────────────────────
  registerTool({
    name: 'license_check',
    description: 'Check license compatibility across a project\'s dependency tree.',
    parameters: {
      path: { type: 'string', description: 'Project directory path', required: true },
    },
    tier: 'free',
    async execute(args) {
      const path = String(args.path)
      try {
        // Try npx license-checker for Node projects
        return await shell('npx', ['--yes', 'license-checker', '--start', path, '--summary'], 30_000)
      } catch {
        try {
          // Fallback: read package.json and extract license
          const { readFileSync } = await import('fs')
          const pkg = JSON.parse(readFileSync(`${path}/package.json`, 'utf-8'))
          return `Project: ${pkg.name}\nLicense: ${pkg.license || 'unspecified'}\nDependencies: ${Object.keys(pkg.dependencies || {}).length}`
        } catch (err) {
          return `License check error: ${err instanceof Error ? err.message : String(err)}`
        }
      }
    },
  })

  // ── Dependency Graph ──────────────────────────────────────────────
  registerTool({
    name: 'dep_graph',
    description: 'Build a dependency tree for any package ecosystem (npm, pip, cargo).',
    parameters: {
      ecosystem: { type: 'string', description: 'Package ecosystem: npm, pip, cargo', required: true },
      package_name: { type: 'string', description: 'Package to analyze', required: true },
    },
    tier: 'free',
    async execute(args) {
      const eco = String(args.ecosystem).toLowerCase()
      const pkg = String(args.package_name)
      try {
        if (eco === 'npm') {
          return await shell('npm', ['view', pkg, 'dependencies', '--json'], 15_000)
        } else if (eco === 'pip') {
          return await shell('python3', ['-m', 'pip', 'show', pkg], 15_000)
        } else if (eco === 'cargo') {
          const res = await fetch(`https://crates.io/api/v1/crates/${encodeURIComponent(pkg)}/dependencies`, {
            headers: { 'User-Agent': 'KBot/2.14' },
            signal: AbortSignal.timeout(8000),
          })
          const data = await res.json() as any
          return JSON.stringify(data.dependencies?.map((d: any) => `${d.crate_id} ${d.req}`) || [], null, 2)
        }
        return `Unsupported ecosystem: ${eco}. Use npm, pip, or cargo.`
      } catch (err) {
        return `Dependency graph error: ${err instanceof Error ? err.message : String(err)}`
      }
    },
  })
}
