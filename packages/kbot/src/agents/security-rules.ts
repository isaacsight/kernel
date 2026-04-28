// kbot Security Agent — static rule catalog.
// Lightweight regex / string scans. No AST. Each rule returns zero or more
// hits given a single line of source text plus filename context.

export type Severity = 'critical' | 'high' | 'medium' | 'low' | 'info'

export interface RuleContext {
  file: string
  line: string
  lineNumber: number
  fullText: string
}

export interface RuleHit {
  id: string
  severity: Severity
  category: string
  description: string
  recommendation: string
  /** Auto-fix descriptor — only present when a rule supports a safe fix. */
  fix?: { find: string; replace: string; label: string }
}

export interface Rule {
  id: string
  category: string
  severity: Severity
  description: string
  recommendation: string
  appliesTo?: (file: string) => boolean
  test: (ctx: RuleContext) => RuleHit | RuleHit[] | null
}

const isJsLike = (f: string): boolean => /\.(ts|tsx|js|jsx|mjs|cjs)$/.test(f)
const isEnvLike = (f: string): boolean => /(^|\/)\.env(\..+)?$/.test(f)
const isJson = (f: string): boolean => f.endsWith('.json')

// Compact factory — most rules share the shape "regex on line -> emit hit".
function regexRule(opts: {
  id: string
  category: string
  severity: Severity
  description: string
  recommendation: string
  pattern: RegExp
  appliesTo?: (file: string) => boolean
  fix?: (line: string) => RuleHit['fix'] | undefined
}): Rule {
  return {
    id: opts.id,
    category: opts.category,
    severity: opts.severity,
    description: opts.description,
    recommendation: opts.recommendation,
    appliesTo: opts.appliesTo,
    test: (ctx) => {
      if (!opts.pattern.test(ctx.line)) return null
      return {
        id: opts.id,
        severity: opts.severity,
        category: opts.category,
        description: opts.description,
        recommendation: opts.recommendation,
        fix: opts.fix ? opts.fix(ctx.line) : undefined,
      }
    },
  }
}

export const RULES: Rule[] = [
  regexRule({
    id: 'SEC-001', category: 'secrets', severity: 'critical',
    description: 'Hardcoded API key (sk-...) detected',
    recommendation: 'Rotate the key and load from process.env instead.',
    pattern: /['"`]sk-[A-Za-z0-9_-]{16,}['"`]/,
  }),
  regexRule({
    id: 'SEC-002', category: 'secrets', severity: 'critical',
    description: 'Hardcoded AWS access key id',
    recommendation: 'Rotate via IAM and load from environment / role.',
    pattern: /AKIA[0-9A-Z]{16}/,
  }),
  regexRule({
    id: 'SEC-003', category: 'secrets', severity: 'critical',
    description: 'Embedded BEGIN PRIVATE KEY block',
    recommendation: 'Move to a secrets vault and rotate.',
    pattern: /-----BEGIN (RSA |EC |OPENSSH |DSA |)PRIVATE KEY-----/,
  }),
  regexRule({
    id: 'SEC-004', category: 'secrets', severity: 'high',
    description: 'Inline password= "..." literal',
    recommendation: 'Read from process.env or a secrets manager.',
    pattern: /(?:^|[^A-Za-z_])password\s*[:=]\s*['"][^'"\s]{4,}['"]/i,
  }),
  regexRule({
    id: 'SEC-005', category: 'secrets', severity: 'high',
    description: 'AWS secret literal',
    recommendation: 'Rotate and load from environment.',
    pattern: /AWS_SECRET[_A-Z]*\s*[:=]\s*['"][^'"\s]{8,}['"]/,
  }),
  regexRule({
    id: 'SEC-006', category: 'secrets', severity: 'critical',
    description: 'GitHub personal-access token literal',
    recommendation: 'Revoke immediately and use env var.',
    pattern: /gh[pousr]_[A-Za-z0-9]{20,}/,
  }),
  regexRule({
    id: 'SEC-007', category: 'code-injection', severity: 'high',
    description: 'eval() call',
    recommendation: 'Replace with a safe parser (JSON.parse, etc.).',
    pattern: /(?:^|[^A-Za-z_$.])eval\s*\(/,
    appliesTo: isJsLike,
  }),
  regexRule({
    id: 'SEC-008', category: 'code-injection', severity: 'high',
    description: 'new Function() constructor',
    recommendation: 'Replace with predefined functions or sandbox.',
    pattern: /new\s+Function\s*\(/,
    appliesTo: isJsLike,
  }),
  regexRule({
    id: 'SEC-009', category: 'command-injection', severity: 'high',
    description: 'exec(`... ${...}`) template literal',
    recommendation: 'Switch to execFile(cmd, [args]) — never interpolate.',
    pattern: /\bexec\s*\(\s*`[^`]*\$\{/,
    appliesTo: isJsLike,
  }),
  regexRule({
    id: 'SEC-010', category: 'sql-injection', severity: 'high',
    description: 'SQL string concatenation',
    recommendation: 'Use parameter placeholders ($1, ?) with the driver.',
    pattern: /['"`]\s*(SELECT|INSERT|UPDATE)\b[^'"`]*['"`]\s*\+/i,
    appliesTo: isJsLike,
  }),
  regexRule({
    id: 'SEC-011', category: 'xss', severity: 'high',
    description: 'Dynamic innerHTML assignment',
    recommendation: 'Use textContent or sanitise via DOMPurify.',
    pattern: /\.innerHTML\s*=\s*[^'"`;]+(?:\+|\$\{|\()/,
    appliesTo: isJsLike,
  }),
  regexRule({
    id: 'SEC-012', category: 'xss', severity: 'high',
    description: 'dangerouslySetInnerHTML bound to a variable',
    recommendation: 'Sanitise the HTML string with DOMPurify first.',
    pattern: /dangerouslySetInnerHTML\s*=\s*\{\{\s*__html\s*:\s*[A-Za-z_$][\w$.]*\s*\}\}/,
    appliesTo: isJsLike,
  }),
  regexRule({
    id: 'SEC-013', category: 'auth', severity: 'critical',
    description: 'JWT alg "none" allowed',
    recommendation: 'Pin algorithms (HS256/RS256); never accept "none".',
    pattern: /(['"]alg['"]\s*:\s*['"]none['"]|algorithms\s*:\s*\[\s*['"]none['"])/i,
    appliesTo: isJsLike,
  }),
  // SEC-014: contextual — Math.random() in crypto-adjacent code
  {
    id: 'SEC-014', category: 'crypto', severity: 'medium',
    description: 'Math.random() in crypto-adjacent code',
    recommendation: 'Replace with crypto.randomBytes(); leave a TODO marker.',
    appliesTo: isJsLike,
    test: (ctx) => {
      if (!/Math\.random\s*\(\s*\)/.test(ctx.line)) return null
      const lower = ctx.line.toLowerCase()
      if (!/(token|secret|nonce|salt|password|otp|sessionid|api_?key)/.test(lower)) return null
      return {
        id: 'SEC-014', severity: 'medium', category: 'crypto',
        description: 'Math.random() in crypto-adjacent code',
        recommendation: 'Use crypto.randomBytes() instead.',
      }
    },
  },
  // SEC-015: weak hash — supports auto-fix for md5 only
  {
    id: 'SEC-015', category: 'crypto', severity: 'high',
    description: "createHash('md5'/'sha1') is weak",
    recommendation: "Replace with createHash('sha256') or use bcrypt/argon2 for passwords.",
    appliesTo: isJsLike,
    test: (ctx) => {
      const m = /createHash\(\s*['"](md5|sha1)['"]\s*\)/.exec(ctx.line)
      if (!m) return null
      const algo = m[1]
      return {
        id: 'SEC-015', severity: 'high', category: 'crypto',
        description: `createHash('${algo}') is weak`,
        recommendation: `Replace with createHash('sha256') or bcrypt for passwords.`,
        fix: algo === 'md5'
          ? { find: `createHash('md5')`, replace: `createHash('sha256')`, label: 'md5 -> sha256' }
          : undefined,
      }
    },
  },
  // SEC-016: open CORS * with credentials — needs whole-file context
  {
    id: 'SEC-016', category: 'cors', severity: 'high',
    description: 'Wildcard CORS origin with credentials enabled',
    recommendation: 'Echo a vetted Origin header instead of *.',
    appliesTo: isJsLike,
    test: (ctx) => {
      if (!/Access-Control-Allow-Origin['"\s:,]+\*/i.test(ctx.line)) return null
      if (!/Access-Control-Allow-Credentials['"\s:,]+true/i.test(ctx.fullText)) return null
      return {
        id: 'SEC-016', severity: 'high', category: 'cors',
        description: 'Wildcard CORS origin with credentials enabled',
        recommendation: 'Echo a vetted Origin header instead of *.',
      }
    },
  },
  // SEC-017: <form method="post"> with no csrf token anywhere in the file
  {
    id: 'SEC-017', category: 'csrf', severity: 'medium',
    description: 'POST form without CSRF token',
    recommendation: 'Add a hidden CSRF token input or use SameSite=strict cookies.',
    test: (ctx) => {
      if (!/<form[^>]*method\s*=\s*["']post["']/i.test(ctx.line)) return null
      if (/csrf|_token|csrfToken/i.test(ctx.fullText)) return null
      return {
        id: 'SEC-017', severity: 'medium', category: 'csrf',
        description: 'POST form without CSRF token',
        recommendation: 'Add a hidden CSRF token input.',
      }
    },
  },
]

export const RULES_BY_ID: Record<string, Rule> = Object.fromEntries(
  RULES.map((r) => [r.id, r]),
)

export const SEVERITY_RANK: Record<Severity, number> = {
  critical: 0, high: 1, medium: 2, low: 3, info: 4,
}

export const SCANNABLE_EXT = /\.(ts|tsx|js|jsx|mjs|cjs|json)$/

export function shouldScan(file: string): boolean {
  if (isEnvLike(file)) return true
  if (SCANNABLE_EXT.test(file)) return true
  if (isJson(file)) return true
  return false
}
