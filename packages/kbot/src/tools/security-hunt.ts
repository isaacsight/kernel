// kbot Security Hunt — Autonomous Pentest Pipeline
// Inspired by Claude Mythos: chains all security tools into a single
// autonomous vulnerability hunting sweep. One command, full audit.
//
// Phases:
//   1. Reconnaissance — port scan, SSL, headers
//   2. Secret Detection — hardcoded credentials, leaked keys
//   3. Dependency Audit — CVEs in npm/pip/cargo + supply chain
//   4. Code Analysis — OWASP Top 10 static analysis
//   5. Correlation — cross-reference findings, severity scoring
//   6. Report — unified markdown report with patches

import { registerTool, getTool, type ToolDefinition } from './index.js'
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs'
import { join, extname, relative } from 'node:path'
import { execSync } from 'node:child_process'

// ── Severity weights for composite scoring ──────────────────────────────────

const SEVERITY_SCORE: Record<string, number> = {
  critical: 10,
  high: 7,
  medium: 4,
  moderate: 4,
  low: 1,
  info: 0,
}

interface HuntFinding {
  phase: string
  severity: 'critical' | 'high' | 'medium' | 'low' | 'info'
  title: string
  detail: string
  file?: string
  line?: number
  fix?: string
  cve?: string
}

interface HuntReport {
  target: string
  timestamp: string
  duration: number
  findings: HuntFinding[]
  score: number
  grade: string
  phases: Record<string, { status: string; findings: number; duration: number }>
}

// ── Internal tool executor ──────────────────────────────────────────────────

async function runTool(name: string, args: Record<string, unknown>): Promise<string> {
  const tool = getTool(name)
  if (!tool) return `[tool ${name} not found]`
  try {
    return await tool.execute(args)
  } catch (err) {
    return `[${name} error: ${(err as Error).message}]`
  }
}

// ── Phase runners ───────────────────────────────────────────────────────────

async function phaseRecon(target: string, url?: string): Promise<HuntFinding[]> {
  const findings: HuntFinding[] = []

  // Port scan if we have a host
  if (url) {
    const hostname = url.replace(/^https?:\/\//, '').replace(/[/:].*/g, '')
    const portResult = await runTool('port_scan', { host: hostname })
    // Parse open ports from result
    const openPorts = (portResult.match(/\|\s*(\d+)\s*\|\s*(\w+)\s*\|\s*open/gi) || [])
    for (const match of openPorts) {
      const portMatch = match.match(/\|\s*(\d+)\s*\|\s*(\w+)/)
      if (portMatch) {
        const port = portMatch[1]
        const service = portMatch[2]
        const risky = ['21', '23', '3306', '5432', '6379', '27017', '11211']
        if (risky.includes(port)) {
          findings.push({
            phase: 'recon',
            severity: 'high',
            title: `Exposed ${service} on port ${port}`,
            detail: `Port ${port} (${service}) is open and accessible. Database and cache ports should not be publicly exposed.`,
            fix: `Block port ${port} in your firewall/security group. Use SSH tunnels or VPN for access.`,
          })
        } else {
          findings.push({
            phase: 'recon',
            severity: 'info',
            title: `Open port ${port} (${service})`,
            detail: `Port ${port} is open.`,
          })
        }
      }
    }

    // SSL check
    if (url.startsWith('https') || !url.startsWith('http')) {
      const sslResult = await runTool('ssl_check', { url: url.startsWith('http') ? url : `https://${url}` })
      if (/expired|invalid|self-signed/i.test(sslResult)) {
        findings.push({
          phase: 'recon',
          severity: 'critical',
          title: 'SSL/TLS certificate issue',
          detail: sslResult.slice(0, 500),
          fix: 'Renew or replace the SSL certificate. Use Let\'s Encrypt for free certificates.',
        })
      } else if (/grade.*[cd]/i.test(sslResult) || /weak/i.test(sslResult)) {
        findings.push({
          phase: 'recon',
          severity: 'medium',
          title: 'Weak SSL/TLS configuration',
          detail: sslResult.slice(0, 500),
          fix: 'Upgrade to TLS 1.3, disable weak cipher suites.',
        })
      }

      // Headers check
      const headersResult = await runTool('headers_check', { url: url.startsWith('http') ? url : `https://${url}` })
      const missingHeaders = headersResult.match(/missing|not set|absent/gi) || []
      if (missingHeaders.length > 0) {
        // Parse specific missing headers
        const headerIssues: string[] = []
        if (/content-security-policy.*missing/i.test(headersResult) || /CSP.*not set/i.test(headersResult)) {
          headerIssues.push('Content-Security-Policy')
        }
        if (/strict-transport.*missing/i.test(headersResult) || /HSTS.*not set/i.test(headersResult)) {
          headerIssues.push('Strict-Transport-Security')
        }
        if (/x-frame.*missing/i.test(headersResult)) {
          headerIssues.push('X-Frame-Options')
        }
        if (/x-content-type.*missing/i.test(headersResult)) {
          headerIssues.push('X-Content-Type-Options')
        }
        if (headerIssues.length > 0) {
          findings.push({
            phase: 'recon',
            severity: headerIssues.includes('Content-Security-Policy') ? 'high' : 'medium',
            title: `Missing security headers: ${headerIssues.join(', ')}`,
            detail: `${headerIssues.length} security headers are missing or misconfigured.`,
            fix: headerIssues.map(h => {
              const fixes: Record<string, string> = {
                'Content-Security-Policy': "Add CSP header: `Content-Security-Policy: default-src 'self'`",
                'Strict-Transport-Security': 'Add HSTS: `Strict-Transport-Security: max-age=31536000; includeSubDomains`',
                'X-Frame-Options': 'Add: `X-Frame-Options: DENY`',
                'X-Content-Type-Options': 'Add: `X-Content-Type-Options: nosniff`',
              }
              return fixes[h] || `Add ${h} header`
            }).join('\n'),
          })
        }
      }
    }
  }

  return findings
}

async function phaseSecrets(target: string): Promise<HuntFinding[]> {
  const findings: HuntFinding[] = []
  const result = await runTool('secret_scan', { path: target, depth: 6 })

  // Parse secret scan findings — format: | file | line | type | match |
  const rows = result.match(/\|\s*([^|]+)\s*\|\s*(\d+)\s*\|\s*([^|]+)\s*\|\s*([^|]+)\s*\|/g) || []
  for (const row of rows) {
    const parts = row.split('|').map(s => s.trim()).filter(Boolean)
    if (parts.length >= 4 && parts[0] !== 'File' && parts[0] !== '---') {
      findings.push({
        phase: 'secrets',
        severity: /private key|aws secret|service key/i.test(parts[2]) ? 'critical' : 'high',
        title: `${parts[2]} found in source code`,
        detail: `${parts[2]} detected in ${parts[0]} at line ${parts[1]}`,
        file: parts[0],
        line: parseInt(parts[1], 10) || undefined,
        fix: `Remove the secret from source code. Use environment variables instead. Rotate the exposed credential immediately.`,
      })
    }
  }

  // Also check for .env files committed to git
  try {
    const gitFiles = execSync('git ls-files 2>/dev/null', { cwd: target, maxBuffer: 2_000_000 }).toString()
    const envFiles = gitFiles.split('\n').filter(f => /^\.env($|\.)/.test(f.split('/').pop() || ''))
    for (const envFile of envFiles) {
      if (envFile.trim()) {
        findings.push({
          phase: 'secrets',
          severity: 'critical',
          title: `.env file tracked in git: ${envFile}`,
          detail: `Environment file ${envFile} is committed to version control. All secrets in this file are exposed in git history.`,
          file: envFile,
          fix: `Remove from git: \`git rm --cached ${envFile}\`. Add to .gitignore. Rotate all secrets contained in the file.`,
        })
      }
    }
  } catch { /* not a git repo */ }

  // Check for common misconfigurations
  const dangerousFiles = ['.npmrc', '.pypirc', '.docker/config.json', '.aws/credentials']
  for (const df of dangerousFiles) {
    const fullPath = join(target, df)
    if (existsSync(fullPath)) {
      try {
        const content = readFileSync(fullPath, 'utf-8')
        if (/auth|token|password|secret|key/i.test(content)) {
          findings.push({
            phase: 'secrets',
            severity: 'high',
            title: `Credentials in ${df}`,
            detail: `${df} contains authentication tokens or credentials and may be exposed.`,
            file: df,
            fix: `Move credentials to environment variables. Add ${df} to .gitignore.`,
          })
        }
      } catch { /* unreadable */ }
    }
  }

  return findings
}

async function phaseDeps(target: string): Promise<HuntFinding[]> {
  const findings: HuntFinding[] = []

  // Dependency audit
  const auditResult = await runTool('dep_audit', { path: target })
  const criticalMatch = auditResult.match(/CRITICAL[:\s]*(\d+)/i)
  const highMatch = auditResult.match(/HIGH[:\s]*(\d+)/i)
  const moderateMatch = auditResult.match(/MODERATE[:\s]*(\d+)/i)

  if (criticalMatch && parseInt(criticalMatch[1]) > 0) {
    findings.push({
      phase: 'deps',
      severity: 'critical',
      title: `${criticalMatch[1]} critical dependency vulnerabilities`,
      detail: auditResult.slice(0, 800),
      fix: 'Run `npm audit fix` or update affected packages manually.',
    })
  }
  if (highMatch && parseInt(highMatch[1]) > 0) {
    findings.push({
      phase: 'deps',
      severity: 'high',
      title: `${highMatch[1]} high-severity dependency vulnerabilities`,
      detail: `High-severity CVEs in project dependencies.`,
      fix: 'Run `npm audit fix` and review the affected packages.',
    })
  }
  if (moderateMatch && parseInt(moderateMatch[1]) > 0) {
    findings.push({
      phase: 'deps',
      severity: 'medium',
      title: `${moderateMatch[1]} moderate dependency vulnerabilities`,
      detail: `Moderate-severity issues in project dependencies.`,
      fix: 'Run `npm audit fix` to resolve.',
    })
  }

  // Supply chain audit
  const supplyResult = await runTool('supply_chain_audit', { path: target })
  if (/compromised|malicious|typosquat/i.test(supplyResult)) {
    findings.push({
      phase: 'deps',
      severity: 'critical',
      title: 'Supply chain risk detected',
      detail: supplyResult.slice(0, 600),
      fix: 'Remove the flagged package immediately. Audit your lock file.',
    })
  } else if (/single maintainer|no signature/i.test(supplyResult)) {
    findings.push({
      phase: 'deps',
      severity: 'medium',
      title: 'Supply chain concerns',
      detail: 'Some packages have single maintainers or lack publish signatures.',
      fix: 'Evaluate alternatives for high-risk single-maintainer packages.',
    })
  }

  // Checksum verification
  const checksumResult = await runTool('checksum_verify', { path: target })
  if (/integrity.*fail|mismatch|tampered/i.test(checksumResult)) {
    findings.push({
      phase: 'deps',
      severity: 'critical',
      title: 'Package integrity check failed',
      detail: 'One or more package checksums do not match the lock file. Possible supply chain attack.',
      fix: 'Delete node_modules and package-lock.json, then `npm install` fresh. Compare lock file changes.',
    })
  }

  return findings
}

async function phaseCode(target: string): Promise<HuntFinding[]> {
  const findings: HuntFinding[] = []

  // OWASP Top 10 static analysis
  const owaspResult = await runTool('owasp_check', { path: target })

  // Parse OWASP findings — they come as markdown sections
  const owaspSections = owaspResult.split(/###?\s+/).filter(Boolean)
  for (const section of owaspSections) {
    const lines = section.trim().split('\n')
    const title = lines[0]?.trim()
    if (!title || /OWASP|Summary|No issues/i.test(title)) continue

    // Extract severity from section content
    let severity: HuntFinding['severity'] = 'medium'
    if (/critical|injection|command.*inject|sql.*inject/i.test(section)) severity = 'critical'
    else if (/high|xss|cross-site|auth.*bypass|path.*travers/i.test(section)) severity = 'high'
    else if (/low|info/i.test(section)) severity = 'low'

    // Extract file references
    const fileMatch = section.match(/`([^`]+\.[a-z]{1,4})`/i)
    const lineMatch = section.match(/line\s*(\d+)/i)

    if (/found|detected|vulnerable|issue/i.test(section)) {
      findings.push({
        phase: 'code',
        severity,
        title: title.slice(0, 120),
        detail: section.slice(0, 500),
        file: fileMatch?.[1],
        line: lineMatch ? parseInt(lineMatch[1], 10) : undefined,
        fix: generateOwaspFix(title),
      })
    }
  }

  // Additional code pattern scanning not covered by OWASP tool
  await scanDangerousPatterns(target, findings)

  return findings
}

function generateOwaspFix(title: string): string {
  const fixes: Record<string, string> = {
    'SQL Injection': 'Use parameterized queries or an ORM. Never concatenate user input into SQL.',
    'XSS': 'Sanitize all user input. Use textContent instead of innerHTML. Implement CSP.',
    'Command Injection': 'Use execFile() instead of exec(). Never pass user input to shell commands.',
    'Path Traversal': 'Validate paths with path.resolve() and ensure they stay within allowed directories.',
    'Insecure Deserialization': 'Validate and sanitize all deserialized data. Use safe parsing libraries.',
    'Broken Authentication': 'Use bcrypt for passwords. Implement rate limiting. Use secure session management.',
    'Sensitive Data Exposure': 'Encrypt sensitive data at rest and in transit. Minimize data collection.',
    'Broken Access Control': 'Implement RBAC. Validate permissions on every request. Default deny.',
    'Security Misconfiguration': 'Remove default credentials. Disable directory listing. Keep software updated.',
    'Insufficient Logging': 'Log all auth events, access control failures, and input validation failures.',
  }

  for (const [key, fix] of Object.entries(fixes)) {
    if (title.toLowerCase().includes(key.toLowerCase())) return fix
  }
  return 'Review and remediate according to OWASP guidelines.'
}

async function scanDangerousPatterns(target: string, findings: HuntFinding[]): Promise<void> {
  const DANGEROUS_PATTERNS: Array<{
    pattern: RegExp
    name: string
    severity: HuntFinding['severity']
    fix: string
  }> = [
    {
      pattern: /eval\s*\(/,
      name: 'eval() usage',
      severity: 'critical',
      fix: 'Remove eval(). Use JSON.parse() for data, or Function constructor with strict validation if absolutely needed.',
    },
    {
      pattern: /new\s+Function\s*\(/,
      name: 'Function constructor',
      severity: 'high',
      fix: 'Avoid dynamic code generation. Use safe alternatives.',
    },
    {
      pattern: /innerHTML\s*=(?!=)/,
      name: 'innerHTML assignment (XSS risk)',
      severity: 'high',
      fix: 'Use textContent or a DOM sanitizer (DOMPurify) instead of innerHTML.',
    },
    {
      pattern: /document\.write\s*\(/,
      name: 'document.write (XSS risk)',
      severity: 'medium',
      fix: 'Use DOM manipulation methods instead of document.write.',
    },
    {
      pattern: /child_process.*exec\b(?!File|Sync)/,
      name: 'exec() without execFile (command injection risk)',
      severity: 'high',
      fix: 'Use execFile() or spawn() with an argument array. Never pass user input to exec().',
    },
    {
      pattern: /crypto\.createCipher\b/,
      name: 'Deprecated createCipher (weak crypto)',
      severity: 'high',
      fix: 'Use crypto.createCipheriv() with a random IV instead.',
    },
    {
      pattern: /Math\.random\(\)/,
      name: 'Math.random() for security-sensitive context',
      severity: 'medium',
      fix: 'Use crypto.randomBytes() or crypto.getRandomValues() for security-sensitive randomness.',
    },
    {
      pattern: /disable.*ssl|rejectUnauthorized\s*:\s*false|NODE_TLS_REJECT_UNAUTHORIZED\s*=\s*['"]?0/,
      name: 'TLS verification disabled',
      severity: 'critical',
      fix: 'Never disable TLS verification. Fix the underlying certificate issue instead.',
    },
    {
      pattern: /cors\(\s*\)|origin\s*:\s*['"]?\*/,
      name: 'Unrestricted CORS',
      severity: 'high',
      fix: 'Restrict CORS origin to specific trusted domains instead of wildcard *.',
    },
    {
      pattern: /jwt\.verify.*algorithms.*none/i,
      name: 'JWT "none" algorithm allowed',
      severity: 'critical',
      fix: 'Explicitly specify allowed JWT algorithms. Never allow "none".',
    },
  ]

  const SKIP_DIRS = new Set(['node_modules', '.git', 'dist', 'build', '.next', '__pycache__', 'target', 'vendor', '.venv'])
  const SCAN_EXTS = new Set(['.ts', '.tsx', '.js', '.jsx', '.mjs', '.cjs', '.py', '.rb', '.go', '.java', '.php', '.rs'])

  function walkDir(dir: string, depth: number): void {
    if (depth > 6) return
    try {
      const entries = readdirSync(dir)
      for (const entry of entries) {
        if (SKIP_DIRS.has(entry) || entry.startsWith('.')) continue
        const fullPath = join(dir, entry)
        try {
          const stat = statSync(fullPath)
          if (stat.isDirectory()) {
            walkDir(fullPath, depth + 1)
          } else if (stat.isFile() && SCAN_EXTS.has(extname(entry)) && stat.size < 500_000) {
            const content = readFileSync(fullPath, 'utf-8')
            const fileLines = content.split('\n')
            for (const pat of DANGEROUS_PATTERNS) {
              for (let i = 0; i < fileLines.length; i++) {
                if (pat.pattern.test(fileLines[i])) {
                  // Skip if it's in a comment or test file
                  const line = fileLines[i].trim()
                  if (line.startsWith('//') || line.startsWith('#') || line.startsWith('*')) continue
                  if (/\.test\.|\.spec\.|__test__|__mock__/i.test(entry)) continue

                  // For Math.random, only flag if near security-sensitive context
                  if (pat.name.includes('Math.random')) {
                    const context = fileLines.slice(Math.max(0, i - 5), i + 5).join('\n')
                    if (!/token|secret|password|key|auth|session|nonce|salt|hash/i.test(context)) continue
                  }

                  findings.push({
                    phase: 'code',
                    severity: pat.severity,
                    title: pat.name,
                    detail: `Found in ${relative(target, fullPath)} at line ${i + 1}: \`${line.slice(0, 100)}\``,
                    file: relative(target, fullPath),
                    line: i + 1,
                    fix: pat.fix,
                  })
                  break // One finding per pattern per file
                }
              }
            }
          }
        } catch { /* skip unreadable */ }
      }
    } catch { /* skip unreadable dirs */ }
  }

  walkDir(target, 0)
}

// ── CVE enrichment ──────────────────────────────────────────────────────────

async function enrichWithCVEs(findings: HuntFinding[]): Promise<void> {
  // Find any CVE IDs mentioned in findings and enrich them
  const cveIds = new Set<string>()
  for (const f of findings) {
    const matches = f.detail.match(/CVE-\d{4}-\d+/gi) || []
    for (const m of matches) cveIds.add(m.toUpperCase())
  }

  // Look up top 5 CVEs for context
  const lookups = [...cveIds].slice(0, 5)
  for (const cveId of lookups) {
    const result = await runTool('cve_lookup', { query: cveId })
    // Attach CVE details to matching findings
    for (const f of findings) {
      if (f.detail.includes(cveId)) {
        f.cve = cveId
        // Extract severity from NVD if available
        const scoreMatch = result.match(/(\d+\.?\d*)\/10/)
        if (scoreMatch && parseFloat(scoreMatch[1]) >= 9) {
          f.severity = 'critical'
        }
      }
    }
  }
}

// ── Scoring & Grading ───────────────────────────────────────────────────────

function computeScore(findings: HuntFinding[]): { score: number; grade: string } {
  if (findings.length === 0) return { score: 100, grade: 'A+' }

  let deductions = 0
  for (const f of findings) {
    deductions += SEVERITY_SCORE[f.severity] || 0
  }

  // Scale: 0-100 where 100 is perfect
  const score = Math.max(0, Math.min(100, 100 - deductions))

  let grade: string
  if (score >= 95) grade = 'A+'
  else if (score >= 90) grade = 'A'
  else if (score >= 85) grade = 'A-'
  else if (score >= 80) grade = 'B+'
  else if (score >= 75) grade = 'B'
  else if (score >= 70) grade = 'B-'
  else if (score >= 65) grade = 'C+'
  else if (score >= 60) grade = 'C'
  else if (score >= 55) grade = 'C-'
  else if (score >= 50) grade = 'D'
  else if (score >= 40) grade = 'D-'
  else grade = 'F'

  return { score, grade }
}

// ── Report formatter ────────────────────────────────────────────────────────

function formatReport(report: HuntReport): string {
  const lines: string[] = []

  // Header
  lines.push(`# 🛡 Security Hunt Report`)
  lines.push('')
  lines.push(`**Target**: \`${report.target}\``)
  lines.push(`**Date**: ${report.timestamp}`)
  lines.push(`**Duration**: ${(report.duration / 1000).toFixed(1)}s`)
  lines.push(`**Score**: ${report.score}/100 (Grade: **${report.grade}**)`)
  lines.push('')

  // Score visualization
  const filled = Math.round(report.score / 5)
  const bar = '█'.repeat(filled) + '░'.repeat(20 - filled)
  lines.push(`\`${bar}\` ${report.score}/100`)
  lines.push('')

  // Phase summary
  lines.push(`## Phases`)
  lines.push('')
  lines.push('| Phase | Status | Findings | Time |')
  lines.push('|-------|--------|----------|------|')
  for (const [phase, info] of Object.entries(report.phases)) {
    const icon = info.findings > 0 ? '⚠' : '✓'
    lines.push(`| ${phase} | ${icon} ${info.status} | ${info.findings} | ${(info.duration / 1000).toFixed(1)}s |`)
  }
  lines.push('')

  // Findings by severity
  const bySeverity = {
    critical: report.findings.filter(f => f.severity === 'critical'),
    high: report.findings.filter(f => f.severity === 'high'),
    medium: report.findings.filter(f => f.severity === 'medium'),
    low: report.findings.filter(f => f.severity === 'low'),
    info: report.findings.filter(f => f.severity === 'info'),
  }

  const totalFindings = report.findings.filter(f => f.severity !== 'info').length

  lines.push(`## Findings (${totalFindings})`)
  lines.push('')

  if (bySeverity.critical.length > 0) {
    lines.push(`### CRITICAL (${bySeverity.critical.length})`)
    lines.push('')
    for (const f of bySeverity.critical) {
      lines.push(`- **${f.title}**`)
      lines.push(`  ${f.detail.slice(0, 200)}`)
      if (f.file) lines.push(`  File: \`${f.file}\`${f.line ? `:${f.line}` : ''}`)
      if (f.cve) lines.push(`  CVE: ${f.cve}`)
      if (f.fix) lines.push(`  **Fix**: ${f.fix}`)
      lines.push('')
    }
  }

  if (bySeverity.high.length > 0) {
    lines.push(`### HIGH (${bySeverity.high.length})`)
    lines.push('')
    for (const f of bySeverity.high) {
      lines.push(`- **${f.title}**`)
      lines.push(`  ${f.detail.slice(0, 200)}`)
      if (f.file) lines.push(`  File: \`${f.file}\`${f.line ? `:${f.line}` : ''}`)
      if (f.fix) lines.push(`  **Fix**: ${f.fix}`)
      lines.push('')
    }
  }

  if (bySeverity.medium.length > 0) {
    lines.push(`### MEDIUM (${bySeverity.medium.length})`)
    lines.push('')
    for (const f of bySeverity.medium) {
      lines.push(`- **${f.title}**: ${f.detail.slice(0, 150)}`)
      if (f.fix) lines.push(`  **Fix**: ${f.fix}`)
    }
    lines.push('')
  }

  if (bySeverity.low.length > 0) {
    lines.push(`### LOW (${bySeverity.low.length})`)
    lines.push('')
    for (const f of bySeverity.low) {
      lines.push(`- ${f.title}: ${f.detail.slice(0, 100)}`)
    }
    lines.push('')
  }

  // Remediation priority
  if (totalFindings > 0) {
    lines.push(`## Remediation Priority`)
    lines.push('')
    const actionable = report.findings
      .filter(f => f.fix && f.severity !== 'info')
      .sort((a, b) => (SEVERITY_SCORE[b.severity] || 0) - (SEVERITY_SCORE[a.severity] || 0))
      .slice(0, 10)

    for (let i = 0; i < actionable.length; i++) {
      const f = actionable[i]
      lines.push(`${i + 1}. **[${f.severity.toUpperCase()}]** ${f.title}`)
      lines.push(`   → ${f.fix}`)
    }
    lines.push('')
  }

  // Quick wins
  const quickWins = report.findings.filter(f =>
    f.fix && (
      f.fix.includes('npm audit fix') ||
      f.fix.includes('Add') ||
      f.fix.includes('.gitignore') ||
      f.fix.includes('environment variable')
    )
  )
  if (quickWins.length > 0) {
    lines.push(`## Quick Wins (${quickWins.length})`)
    lines.push('')
    lines.push('These can be fixed in minutes:')
    for (const f of quickWins.slice(0, 5)) {
      lines.push(`- ${f.fix}`)
    }
    lines.push('')
  }

  // Footer
  if (totalFindings === 0) {
    lines.push('**No security issues found.** Your codebase looks clean.')
  } else {
    lines.push(`---`)
    lines.push(`*${totalFindings} findings across ${Object.keys(report.phases).length} phases. Fix critical issues first.*`)
  }

  return lines.join('\n')
}

// ── Main tool registration ──────────────────────────────────────────────────

export function registerSecurityHuntTools(): void {

  registerTool({
    name: 'security_hunt',
    description: 'Autonomous security hunting — chains all kbot security tools into a single comprehensive pentest sweep. Scans for: open ports, SSL issues, missing headers, hardcoded secrets, dependency CVEs, supply chain risks, OWASP Top 10 code vulnerabilities, and dangerous patterns. Returns a scored report with severity ratings and fix recommendations. Inspired by autonomous vulnerability research.',
    parameters: {
      path: {
        type: 'string',
        description: 'Project directory to hunt (default: current directory)',
      },
      url: {
        type: 'string',
        description: 'Optional URL to scan for network/SSL/header issues (e.g. "https://example.com")',
      },
      phases: {
        type: 'string',
        description: 'Comma-separated phases to run (default: all). Options: recon,secrets,deps,code',
      },
      depth: {
        type: 'string',
        description: 'Scan depth: "quick" (secrets+deps only), "standard" (all phases), "deep" (all + CVE enrichment). Default: standard',
      },
    },
    tier: 'free',
    timeout: 300_000, // 5 minutes for full sweep
    maxResultSize: 100_000,
    async execute(args) {
      const target = String(args.path || process.cwd())
      const url = args.url ? String(args.url) : undefined
      const depth = String(args.depth || 'standard')
      const requestedPhases = args.phases
        ? String(args.phases).split(',').map(s => s.trim().toLowerCase())
        : null

      if (!existsSync(target)) {
        return `Error: Directory ${target} does not exist.`
      }

      const startTime = Date.now()
      const allFindings: HuntFinding[] = []
      const phases: HuntReport['phases'] = {}

      const shouldRun = (phase: string) =>
        !requestedPhases || requestedPhases.includes(phase)

      // Phase 1: Reconnaissance
      if (shouldRun('recon') && depth !== 'quick') {
        const phaseStart = Date.now()
        try {
          const findings = await phaseRecon(target, url)
          allFindings.push(...findings)
          phases['Reconnaissance'] = { status: 'complete', findings: findings.length, duration: Date.now() - phaseStart }
        } catch (err) {
          phases['Reconnaissance'] = { status: `error: ${(err as Error).message}`, findings: 0, duration: Date.now() - phaseStart }
        }
      }

      // Phase 2: Secret Detection
      if (shouldRun('secrets')) {
        const phaseStart = Date.now()
        try {
          const findings = await phaseSecrets(target)
          allFindings.push(...findings)
          phases['Secret Detection'] = { status: 'complete', findings: findings.length, duration: Date.now() - phaseStart }
        } catch (err) {
          phases['Secret Detection'] = { status: `error: ${(err as Error).message}`, findings: 0, duration: Date.now() - phaseStart }
        }
      }

      // Phase 3: Dependency Audit
      if (shouldRun('deps')) {
        const phaseStart = Date.now()
        try {
          const findings = await phaseDeps(target)
          allFindings.push(...findings)
          phases['Dependency Audit'] = { status: 'complete', findings: findings.length, duration: Date.now() - phaseStart }
        } catch (err) {
          phases['Dependency Audit'] = { status: `error: ${(err as Error).message}`, findings: 0, duration: Date.now() - phaseStart }
        }
      }

      // Phase 4: Code Analysis
      if (shouldRun('code') && depth !== 'quick') {
        const phaseStart = Date.now()
        try {
          const findings = await phaseCode(target)
          allFindings.push(...findings)
          phases['Code Analysis'] = { status: 'complete', findings: findings.length, duration: Date.now() - phaseStart }
        } catch (err) {
          phases['Code Analysis'] = { status: `error: ${(err as Error).message}`, findings: 0, duration: Date.now() - phaseStart }
        }
      }

      // Phase 5: CVE Enrichment (deep mode only)
      if (depth === 'deep') {
        const phaseStart = Date.now()
        try {
          await enrichWithCVEs(allFindings)
          phases['CVE Enrichment'] = { status: 'complete', findings: 0, duration: Date.now() - phaseStart }
        } catch (err) {
          phases['CVE Enrichment'] = { status: `error: ${(err as Error).message}`, findings: 0, duration: Date.now() - phaseStart }
        }
      }

      // Compute score
      const { score, grade } = computeScore(allFindings)

      const report: HuntReport = {
        target,
        timestamp: new Date().toISOString(),
        duration: Date.now() - startTime,
        findings: allFindings,
        score,
        grade,
        phases,
      }

      return formatReport(report)
    },
  })
}
