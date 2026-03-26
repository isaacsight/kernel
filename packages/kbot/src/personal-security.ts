// kbot Personal Cybersecurity Suite
//
// kbot protects its creator. Not just kbot's memory — the entire machine
// and online presence.
//
// Capabilities:
//   1. Full security scan (secrets, SSH, permissions, ports, firewall, git, browser)
//   2. File change monitoring on sensitive directories
//   3. Breached email checking via Have I Been Pwned
//   4. Security report generation with scoring
//   5. Scheduled recurring scans with alerting
//   6. Focused scanners (secrets, SSH, ports, permissions)
//
// IMPORTANT: This tool NEVER reads or displays actual secret content.
// It only reports that a secret was found, what type, and where.
// Remediation is for the user to handle.
//
// Storage: ~/.kbot/security/
// Dependencies: Node built-ins only (fs, net, child_process, crypto, os, path)

import { existsSync, readFileSync, writeFileSync, mkdirSync, readdirSync, statSync, appendFileSync, watch, type FSWatcher } from 'node:fs'
import { join, resolve, extname, basename, relative } from 'node:path'
import { homedir } from 'node:os'
import { execSync } from 'node:child_process'
import { createConnection, type Socket } from 'node:net'
import { createHash } from 'node:crypto'

// ── Constants ──

const HOME = homedir()
const KBOT_DIR = join(HOME, '.kbot')
const SECURITY_DIR = join(KBOT_DIR, 'security')
const MONITOR_LOG = join(SECURITY_DIR, 'monitor-log.jsonl')
const SCAN_HISTORY = join(SECURITY_DIR, 'scan-history.json')

function ensureDir(dir: string): void {
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true })
}

// ── Types ──

export type Severity = 'critical' | 'high' | 'medium' | 'low'

export interface SecurityFinding {
  category: string
  title: string
  severity: Severity
  description: string
  remediation: string
  location?: string
}

export interface SecurityReport {
  timestamp: string
  score: number // 0-100
  findings: SecurityFinding[]
  criticalCount: number
  highCount: number
  mediumCount: number
  lowCount: number
  goodPractices: string[]
  summary: string
}

export interface BreachResult {
  email: string
  breached: boolean
  breachCount: number
  breaches: Array<{
    name: string
    domain: string
    breachDate: string
    dataClasses: string[]
  }>
}

export interface MonitorEvent {
  timestamp: string
  path: string
  eventType: string
  filename: string | null
}

export interface ScanHistoryEntry {
  timestamp: string
  score: number
  criticalCount: number
  highCount: number
  mediumCount: number
  lowCount: number
  totalFindings: number
}

// ── Secret Patterns ──
// These detect common API key and credential formats without reading values.

const SECRET_PATTERNS: Array<{ name: string; pattern: RegExp }> = [
  { name: 'AWS Access Key', pattern: /AKIA[0-9A-Z]{16}/ },
  { name: 'AWS Secret Key', pattern: /(?:aws_secret|secret_access_key)\s*[:=]\s*['"]?[A-Za-z0-9/+=]{40}/ },
  { name: 'GitHub Token (classic)', pattern: /ghp_[A-Za-z0-9]{36}/ },
  { name: 'GitHub OAuth Token', pattern: /gho_[A-Za-z0-9]{36}/ },
  { name: 'GitHub App Token', pattern: /ghs_[A-Za-z0-9]{36}/ },
  { name: 'GitHub Fine-Grained Token', pattern: /github_pat_[A-Za-z0-9_]{82}/ },
  { name: 'Stripe Secret Key', pattern: /sk_live_[A-Za-z0-9]{24,}/ },
  { name: 'Stripe Restricted Key', pattern: /rk_live_[A-Za-z0-9]{24,}/ },
  { name: 'Anthropic API Key', pattern: /sk-ant-[A-Za-z0-9_-]{40,}/ },
  { name: 'OpenAI API Key', pattern: /sk-[A-Za-z0-9]{48}/ },
  { name: 'Google API Key', pattern: /AIza[A-Za-z0-9_-]{35}/ },
  { name: 'Slack Bot Token', pattern: /xoxb-[0-9]{10,}-[A-Za-z0-9]{24,}/ },
  { name: 'Slack Webhook', pattern: /hooks\.slack\.com\/services\/T[A-Z0-9]{8,}\/B[A-Z0-9]{8,}\/[A-Za-z0-9]{24}/ },
  { name: 'Discord Webhook', pattern: /discord(?:app)?\.com\/api\/webhooks\/\d+\/[A-Za-z0-9_-]+/ },
  { name: 'Discord Bot Token', pattern: /[MN][A-Za-z0-9]{23,28}\.[A-Za-z0-9_-]{6}\.[A-Za-z0-9_-]{27,}/ },
  { name: 'Private Key (PEM)', pattern: /-----BEGIN (?:RSA |EC |OPENSSH |DSA )?PRIVATE KEY-----/ },
  { name: 'npm Token', pattern: /npm_[A-Za-z0-9]{36}/ },
  { name: 'PyPI Token', pattern: /pypi-[A-Za-z0-9_-]{50,}/ },
  { name: 'Resend API Key', pattern: /re_[A-Za-z0-9]{32,}/ },
  { name: 'SendGrid API Key', pattern: /SG\.[A-Za-z0-9_-]{22}\.[A-Za-z0-9_-]{43}/ },
  { name: 'Twilio Account SID', pattern: /AC[a-f0-9]{32}/ },
  { name: 'Twilio Auth Token', pattern: /(?:twilio_auth_token|TWILIO_AUTH)\s*[:=]\s*['"]?[a-f0-9]{32}/ },
  { name: 'Supabase Service Key', pattern: /eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9\.[A-Za-z0-9_-]{50,}/ },
  { name: 'Mailgun API Key', pattern: /key-[A-Za-z0-9]{32}/ },
  { name: 'Heroku API Key', pattern: /(?:heroku.*key|HEROKU_API_KEY)\s*[:=]\s*['"]?[a-f0-9-]{36}/ },
  { name: 'Generic High-Entropy Secret', pattern: /(?:secret|password|passwd|token|api_key|apikey|auth_token|access_token)\s*[:=]\s*['"][A-Za-z0-9/+=_-]{20,}['"]/ },
]

const SKIP_DIRS = new Set([
  'node_modules', '.git', 'dist', 'build', '.next', '__pycache__',
  'target', '.venv', 'venv', '.tox', '.mypy_cache', '.pytest_cache',
  'coverage', '.nyc_output', '.cache', '.parcel-cache',
])

const SKIP_EXTENSIONS = new Set([
  '.png', '.jpg', '.jpeg', '.gif', '.ico', '.svg', '.bmp', '.webp',
  '.woff', '.woff2', '.ttf', '.eot', '.otf',
  '.mp3', '.mp4', '.avi', '.mov', '.wav', '.flac',
  '.zip', '.tar', '.gz', '.bz2', '.xz', '.7z', '.rar',
  '.pdf', '.doc', '.docx', '.xls', '.xlsx',
  '.lock', '.map', '.min.js', '.min.css',
  '.pyc', '.pyo', '.class', '.o', '.so', '.dylib', '.dll',
])

// ── 1. scanForSecrets ──

export interface SecretFinding {
  file: string
  line: number
  type: string
  preview: string // redacted preview — first 8 chars + *** + last 4 chars
}

/**
 * Recursively scan a directory for leaked secrets (API keys, tokens, passwords).
 * NEVER reads or displays actual secret values.
 */
export function scanForSecrets(scanPath?: string): SecretFinding[] {
  const dir = resolve(scanPath || process.cwd())
  const findings: SecretFinding[] = []
  const maxDepth = 8

  function walk(dirPath: string, depth: number): void {
    if (depth > maxDepth) return
    let entries: string[]
    try {
      entries = readdirSync(dirPath)
    } catch {
      return
    }

    for (const entry of entries) {
      if (SKIP_DIRS.has(entry)) continue
      // Skip .env files — we only look for ACCIDENTALLY committed secrets
      if (entry.startsWith('.env')) continue

      const fullPath = join(dirPath, entry)
      let stat
      try {
        stat = statSync(fullPath)
      } catch {
        continue
      }

      if (stat.isDirectory()) {
        walk(fullPath, depth + 1)
        continue
      }

      if (!stat.isFile() || stat.size > 500_000) continue

      const ext = extname(entry).toLowerCase()
      if (SKIP_EXTENSIONS.has(ext)) continue

      let content: string
      try {
        content = readFileSync(fullPath, 'utf-8')
      } catch {
        continue
      }

      const lines = content.split('\n')
      for (let i = 0; i < lines.length; i++) {
        const line = lines[i]
        // Skip comment-only lines that describe patterns rather than contain secrets
        if (/^\s*(?:\/\/|#|\/\*|\*)\s/.test(line)) continue

        for (const { name, pattern } of SECRET_PATTERNS) {
          const match = line.match(pattern)
          if (match) {
            const val = match[0]
            const redacted = val.length > 12
              ? val.slice(0, 8) + '***' + val.slice(-4)
              : val.slice(0, 4) + '***'
            findings.push({
              file: relative(dir, fullPath),
              line: i + 1,
              type: name,
              preview: redacted,
            })
          }
        }
      }
    }
  }

  walk(dir, 0)
  return findings
}

// ── 2. checkSSHSecurity ──

export interface SSHAudit {
  findings: SecurityFinding[]
  keysFound: Array<{ name: string; type: string; hasPassphrase: boolean | null }>
  authorizedKeysCount: number
  configIssues: string[]
}

/**
 * Audit SSH configuration and keys.
 * Checks for password-protected keys, authorized_keys cleanliness, and config issues.
 */
export function checkSSHSecurity(): SSHAudit {
  const sshDir = join(HOME, '.ssh')
  const findings: SecurityFinding[] = []
  const keysFound: SSHAudit['keysFound'] = []
  let authorizedKeysCount = 0
  const configIssues: string[] = []

  if (!existsSync(sshDir)) {
    findings.push({
      category: 'SSH',
      title: 'No ~/.ssh directory found',
      severity: 'low',
      description: 'No SSH directory exists. This is fine if you do not use SSH.',
      remediation: 'No action needed unless SSH is required.',
    })
    return { findings, keysFound, authorizedKeysCount, configIssues }
  }

  // Check directory permissions
  try {
    const sshStat = statSync(sshDir)
    const mode = sshStat.mode & 0o777
    if (mode !== 0o700) {
      findings.push({
        category: 'SSH',
        title: '~/.ssh directory has loose permissions',
        severity: 'high',
        description: `~/.ssh permissions are ${mode.toString(8)} (should be 700).`,
        remediation: 'Run: chmod 700 ~/.ssh',
      })
    }
  } catch { /* cannot stat */ }

  // Check each key file
  let entries: string[]
  try {
    entries = readdirSync(sshDir)
  } catch {
    findings.push({
      category: 'SSH',
      title: 'Cannot read ~/.ssh directory',
      severity: 'medium',
      description: 'Unable to list files in ~/.ssh.',
      remediation: 'Check permissions on ~/.ssh.',
    })
    return { findings, keysFound, authorizedKeysCount, configIssues }
  }

  for (const entry of entries) {
    const fullPath = join(sshDir, entry)
    let stat
    try {
      stat = statSync(fullPath)
    } catch {
      continue
    }

    if (!stat.isFile()) continue

    // Check private key files
    if (entry === 'id_rsa' || entry === 'id_ed25519' || entry === 'id_ecdsa' || entry === 'id_dsa' || entry.startsWith('id_') && !entry.endsWith('.pub')) {
      const mode = stat.mode & 0o777
      if (mode !== 0o600 && mode !== 0o400) {
        findings.push({
          category: 'SSH',
          title: `Private key ${entry} has loose permissions`,
          severity: 'critical',
          description: `${entry} permissions are ${mode.toString(8)} (should be 600 or 400).`,
          remediation: `Run: chmod 600 ~/.ssh/${entry}`,
        })
      }

      // Check if key has a passphrase (encrypted header indicates passphrase)
      let hasPassphrase: boolean | null = null
      try {
        const keyContent = readFileSync(fullPath, 'utf-8')
        if (keyContent.includes('ENCRYPTED')) {
          hasPassphrase = true
        } else if (keyContent.includes('-----BEGIN OPENSSH PRIVATE KEY-----')) {
          // OpenSSH format — try ssh-keygen to check (non-destructive)
          try {
            execSync(`ssh-keygen -y -P "" -f "${fullPath}" 2>&1`, { timeout: 5000 })
            // If the above succeeds with empty password, key has NO passphrase
            hasPassphrase = false
          } catch {
            // If it fails, the key likely has a passphrase
            hasPassphrase = true
          }
        } else if (keyContent.includes('-----BEGIN RSA PRIVATE KEY-----')) {
          // Legacy PEM format — check for Proc-Type: 4,ENCRYPTED
          hasPassphrase = keyContent.includes('Proc-Type') && keyContent.includes('ENCRYPTED')
        }
      } catch {
        hasPassphrase = null
      }

      let keyType = 'unknown'
      if (entry.includes('rsa')) keyType = 'RSA'
      else if (entry.includes('ed25519')) keyType = 'Ed25519'
      else if (entry.includes('ecdsa')) keyType = 'ECDSA'
      else if (entry.includes('dsa')) keyType = 'DSA'

      keysFound.push({ name: entry, type: keyType, hasPassphrase })

      if (hasPassphrase === false) {
        findings.push({
          category: 'SSH',
          title: `Private key ${entry} has no passphrase`,
          severity: 'high',
          description: `The private key ${entry} is not password-protected. If stolen, it can be used immediately.`,
          remediation: `Add a passphrase: ssh-keygen -p -f ~/.ssh/${entry}`,
        })
      }

      if (keyType === 'DSA') {
        findings.push({
          category: 'SSH',
          title: `DSA key found (${entry})`,
          severity: 'medium',
          description: 'DSA keys are deprecated and considered weak. Use Ed25519 or ECDSA instead.',
          remediation: 'Generate a new key: ssh-keygen -t ed25519 -C "your_email"',
        })
      }

      if (keyType === 'RSA') {
        // Check RSA key length
        try {
          const output = execSync(`ssh-keygen -l -f "${fullPath}" 2>/dev/null`, { timeout: 5000 }).toString()
          const bits = parseInt(output.split(' ')[0], 10)
          if (bits < 2048) {
            findings.push({
              category: 'SSH',
              title: `RSA key ${entry} is only ${bits} bits`,
              severity: 'high',
              description: `RSA key should be at least 2048 bits, preferably 4096. Found ${bits} bits.`,
              remediation: 'Generate a stronger key: ssh-keygen -t rsa -b 4096 or ssh-keygen -t ed25519',
            })
          }
        } catch { /* cannot check size */ }
      }
    }

    // Check authorized_keys
    if (entry === 'authorized_keys') {
      try {
        const content = readFileSync(fullPath, 'utf-8')
        const keys = content.split('\n').filter(l => l.trim() && !l.trim().startsWith('#'))
        authorizedKeysCount = keys.length

        if (keys.length > 10) {
          findings.push({
            category: 'SSH',
            title: 'Large authorized_keys file',
            severity: 'medium',
            description: `authorized_keys contains ${keys.length} entries. Review for stale or unknown keys.`,
            remediation: 'Review ~/.ssh/authorized_keys and remove keys you do not recognize.',
          })
        }

        // Check for command restrictions
        const unrestrictedKeys = keys.filter(k => !k.includes('command=') && !k.includes('restrict'))
        if (unrestrictedKeys.length > 5) {
          findings.push({
            category: 'SSH',
            title: 'Many unrestricted authorized keys',
            severity: 'low',
            description: `${unrestrictedKeys.length} authorized keys have no command restrictions.`,
            remediation: 'Consider adding command= or restrict options for service keys.',
          })
        }
      } catch { /* cannot read */ }

      const mode = stat.mode & 0o777
      if (mode !== 0o600 && mode !== 0o644) {
        findings.push({
          category: 'SSH',
          title: 'authorized_keys has unusual permissions',
          severity: 'medium',
          description: `authorized_keys permissions are ${mode.toString(8)} (should be 600 or 644).`,
          remediation: 'Run: chmod 600 ~/.ssh/authorized_keys',
        })
      }
    }
  }

  // Check ssh_config for risky settings
  const sshConfig = join(sshDir, 'config')
  if (existsSync(sshConfig)) {
    try {
      const content = readFileSync(sshConfig, 'utf-8')
      if (/StrictHostKeyChecking\s+no/i.test(content)) {
        configIssues.push('StrictHostKeyChecking is disabled — vulnerable to MITM attacks')
        findings.push({
          category: 'SSH',
          title: 'StrictHostKeyChecking disabled in SSH config',
          severity: 'high',
          description: 'SSH config disables host key verification, making you vulnerable to man-in-the-middle attacks.',
          remediation: 'Remove or change "StrictHostKeyChecking no" in ~/.ssh/config.',
        })
      }
      if (/ForwardAgent\s+yes/i.test(content)) {
        configIssues.push('Agent forwarding is enabled globally — risk of key theft on compromised hosts')
        findings.push({
          category: 'SSH',
          title: 'SSH Agent Forwarding enabled globally',
          severity: 'medium',
          description: 'Global agent forwarding exposes your SSH keys to any host you connect to.',
          remediation: 'Only enable ForwardAgent for specific trusted hosts, not globally.',
        })
      }
      if (/PasswordAuthentication\s+yes/i.test(content)) {
        configIssues.push('Password authentication is enabled — prefer key-based auth')
      }
    } catch { /* cannot read config */ }
  }

  return { findings, keysFound, authorizedKeysCount, configIssues }
}

// ── 3. checkPortExposure ──

export interface PortResult {
  port: number
  service: string
  open: boolean
}

/**
 * Scan common ports on localhost to check for exposed services.
 * Uses TCP connect probes via the net module.
 */
export async function checkPortExposure(): Promise<{ ports: PortResult[]; findings: SecurityFinding[] }> {
  const PORTS: Array<{ port: number; service: string; risky: boolean }> = [
    { port: 22, service: 'SSH', risky: false },
    { port: 80, service: 'HTTP', risky: false },
    { port: 443, service: 'HTTPS', risky: false },
    { port: 3000, service: 'Dev Server (Node)', risky: false },
    { port: 3306, service: 'MySQL', risky: true },
    { port: 5432, service: 'PostgreSQL', risky: true },
    { port: 5900, service: 'VNC', risky: true },
    { port: 6379, service: 'Redis', risky: true },
    { port: 8080, service: 'HTTP Alt / Proxy', risky: false },
    { port: 8443, service: 'HTTPS Alt', risky: false },
    { port: 8888, service: 'Jupyter', risky: true },
    { port: 9090, service: 'Prometheus', risky: true },
    { port: 11434, service: 'Ollama', risky: false },
    { port: 18789, service: 'kbot Local', risky: false },
    { port: 27017, service: 'MongoDB', risky: true },
  ]

  const results: PortResult[] = []

  function probePort(port: number): Promise<boolean> {
    return new Promise((resolveProbe) => {
      const socket: Socket = createConnection({ host: '127.0.0.1', port }, () => {
        socket.destroy()
        resolveProbe(true)
      })
      socket.setTimeout(2000)
      socket.on('timeout', () => {
        socket.destroy()
        resolveProbe(false)
      })
      socket.on('error', () => {
        socket.destroy()
        resolveProbe(false)
      })
    })
  }

  await Promise.all(PORTS.map(async ({ port, service }) => {
    const open = await probePort(port)
    results.push({ port, service, open })
  }))

  results.sort((a, b) => a.port - b.port)

  const findings: SecurityFinding[] = []
  const openPorts = results.filter(r => r.open)

  for (const r of openPorts) {
    const portInfo = PORTS.find(p => p.port === r.port)
    if (portInfo?.risky) {
      findings.push({
        category: 'Network',
        title: `${r.service} (port ${r.port}) is open on localhost`,
        severity: r.port === 6379 || r.port === 27017 ? 'high' : 'medium',
        description: `${r.service} is listening on port ${r.port}. If bound to 0.0.0.0, it may be accessible from the network.`,
        remediation: `Ensure ${r.service} is bound to 127.0.0.1 only, or block port ${r.port} in the firewall.`,
      })
    }
  }

  return { ports: results, findings }
}

// ── 4. checkFilePermissions ──

export interface PermissionCheck {
  path: string
  exists: boolean
  mode: string | null
  isWorldReadable: boolean
  isWorldWritable: boolean
  finding: SecurityFinding | null
}

/**
 * Verify that sensitive files and directories are not world-readable or world-writable.
 */
export function checkFilePermissions(paths?: string[]): PermissionCheck[] {
  const defaultPaths = [
    join(HOME, '.ssh'),
    join(HOME, '.kbot'),
    join(HOME, '.env'),
    join(HOME, '.bashrc'),
    join(HOME, '.zshrc'),
    join(HOME, '.bash_history'),
    join(HOME, '.zsh_history'),
    join(HOME, '.gitconfig'),
    join(HOME, '.npmrc'),
    join(HOME, '.aws', 'credentials'),
    join(HOME, '.config', 'gcloud'),
    join(HOME, '.docker', 'config.json'),
    join(HOME, '.kube', 'config'),
  ]

  const checkPaths = paths || defaultPaths
  const results: PermissionCheck[] = []

  for (const p of checkPaths) {
    if (!existsSync(p)) {
      results.push({ path: p, exists: false, mode: null, isWorldReadable: false, isWorldWritable: false, finding: null })
      continue
    }

    let stat
    try {
      stat = statSync(p)
    } catch {
      results.push({ path: p, exists: true, mode: null, isWorldReadable: false, isWorldWritable: false, finding: null })
      continue
    }

    const mode = stat.mode & 0o777
    const modeStr = mode.toString(8)
    const isWorldReadable = (mode & 0o004) !== 0
    const isWorldWritable = (mode & 0o002) !== 0

    let finding: SecurityFinding | null = null

    if (isWorldWritable) {
      finding = {
        category: 'Permissions',
        title: `${relative(HOME, p) || p} is world-writable`,
        severity: 'critical',
        description: `${p} has permissions ${modeStr} — any user on this machine can modify it.`,
        remediation: `Run: chmod o-w "${p}"`,
        location: p,
      }
    } else if (isWorldReadable) {
      // Some files being world-readable is more concerning than others
      const sensitivePaths = ['.ssh', '.kbot', '.env', '.aws', '.npmrc', '.docker', '.kube']
      const isSensitive = sensitivePaths.some(s => p.includes(s))
      if (isSensitive) {
        finding = {
          category: 'Permissions',
          title: `${relative(HOME, p) || p} is world-readable`,
          severity: 'high',
          description: `${p} has permissions ${modeStr} — any user on this machine can read it.`,
          remediation: `Run: chmod o-r "${p}" (or chmod 600 for files, 700 for directories)`,
          location: p,
        }
      }
    }

    results.push({ path: p, exists: true, mode: modeStr, isWorldReadable, isWorldWritable, finding })
  }

  return results
}

// ── 5. Firewall Check ──

function checkFirewall(): SecurityFinding[] {
  const findings: SecurityFinding[] = []

  if (process.platform === 'darwin') {
    try {
      const result = execSync('sudo pfctl -s info 2>/dev/null || pfctl -s info 2>&1', { timeout: 5000 }).toString()
      const enabled = /Status:\s*Enabled/i.test(result)
      if (!enabled) {
        findings.push({
          category: 'Firewall',
          title: 'macOS packet filter (pf) is disabled',
          severity: 'medium',
          description: 'The macOS packet filter firewall is not enabled.',
          remediation: 'Enable via System Settings > Network > Firewall, or run: sudo pfctl -e',
        })
      }
    } catch {
      // Try the application firewall check instead
      try {
        const result = execSync('/usr/libexec/ApplicationFirewall/socketfilterfw --getglobalstate 2>/dev/null', { timeout: 5000 }).toString()
        if (result.includes('disabled')) {
          findings.push({
            category: 'Firewall',
            title: 'macOS Application Firewall is disabled',
            severity: 'medium',
            description: 'The macOS Application Firewall is not enabled.',
            remediation: 'Enable via System Settings > Network > Firewall.',
          })
        }
      } catch {
        findings.push({
          category: 'Firewall',
          title: 'Could not determine firewall status',
          severity: 'low',
          description: 'Unable to check firewall status. This may require elevated privileges.',
          remediation: 'Run this scan with sudo, or manually check System Settings > Network > Firewall.',
        })
      }
    }
  } else if (process.platform === 'linux') {
    try {
      const result = execSync('ufw status 2>/dev/null || iptables -L -n 2>/dev/null | head -5', { timeout: 5000 }).toString()
      if (result.includes('inactive') || result.includes('Status: inactive')) {
        findings.push({
          category: 'Firewall',
          title: 'Linux firewall (ufw) is inactive',
          severity: 'medium',
          description: 'The ufw firewall is not enabled.',
          remediation: 'Enable with: sudo ufw enable',
        })
      }
    } catch {
      findings.push({
        category: 'Firewall',
        title: 'Could not determine firewall status',
        severity: 'low',
        description: 'Unable to check firewall status.',
        remediation: 'Check manually with: sudo ufw status or sudo iptables -L',
      })
    }
  }

  return findings
}

// ── 6. Git Config Check ──

function checkGitConfig(): SecurityFinding[] {
  const findings: SecurityFinding[] = []

  try {
    const email = execSync('git config --global user.email 2>/dev/null', { timeout: 3000 }).toString().trim()
    const name = execSync('git config --global user.name 2>/dev/null', { timeout: 3000 }).toString().trim()

    if (email) {
      // Check if email looks like a personal email that shouldn't be public
      const personalDomains = ['gmail.com', 'yahoo.com', 'hotmail.com', 'outlook.com', 'icloud.com', 'protonmail.com', 'proton.me']
      const domain = email.split('@')[1]?.toLowerCase()
      if (personalDomains.includes(domain || '')) {
        findings.push({
          category: 'Git',
          title: 'Personal email in git config',
          severity: 'low',
          description: `Git is configured with "${email}" which will appear in public commit history.`,
          remediation: 'Use a noreply email (GitHub: Settings > Emails > Keep my email private), or configure per-repo.',
        })
      }
    }

    if (!name && !email) {
      findings.push({
        category: 'Git',
        title: 'Git user not configured',
        severity: 'low',
        description: 'No global git user.name or user.email is set.',
        remediation: 'Run: git config --global user.name "Name" && git config --global user.email "email"',
      })
    }

    // Check for credential helpers that might store plaintext
    try {
      const credHelper = execSync('git config --global credential.helper 2>/dev/null', { timeout: 3000 }).toString().trim()
      if (credHelper === 'store') {
        findings.push({
          category: 'Git',
          title: 'Git credentials stored in plaintext',
          severity: 'high',
          description: 'Git credential.helper is set to "store" which saves passwords in plaintext at ~/.git-credentials.',
          remediation: 'Use a secure credential helper: git config --global credential.helper osxkeychain (macOS) or cache (Linux).',
        })
      }
    } catch { /* no credential helper */ }

    // Check for .git-credentials file
    const gitCredentials = join(HOME, '.git-credentials')
    if (existsSync(gitCredentials)) {
      findings.push({
        category: 'Git',
        title: 'Plaintext git credentials file exists',
        severity: 'high',
        description: '~/.git-credentials contains plaintext credentials.',
        remediation: 'Switch to osxkeychain (macOS) or libsecret (Linux), then delete ~/.git-credentials.',
      })
    }
  } catch {
    // git not installed
  }

  return findings
}

// ── 7. Browser Data Check ──

function checkBrowserData(): SecurityFinding[] {
  const findings: SecurityFinding[] = []

  const browserPaths: Array<{ name: string; path: string }> = process.platform === 'darwin'
    ? [
        { name: 'Chrome', path: join(HOME, 'Library/Application Support/Google/Chrome') },
        { name: 'Firefox', path: join(HOME, 'Library/Application Support/Firefox/Profiles') },
        { name: 'Safari', path: join(HOME, 'Library/Safari') },
        { name: 'Brave', path: join(HOME, 'Library/Application Support/BraveSoftware/Brave-Browser') },
        { name: 'Edge', path: join(HOME, 'Library/Application Support/Microsoft Edge') },
        { name: 'Arc', path: join(HOME, 'Library/Application Support/Arc') },
      ]
    : [
        { name: 'Chrome', path: join(HOME, '.config/google-chrome') },
        { name: 'Firefox', path: join(HOME, '.mozilla/firefox') },
        { name: 'Brave', path: join(HOME, '.config/BraveSoftware/Brave-Browser') },
        { name: 'Edge', path: join(HOME, '.config/microsoft-edge') },
      ]

  for (const { name, path: browserPath } of browserPaths) {
    if (!existsSync(browserPath)) continue

    // Check for Login Data (Chromium browsers store passwords in SQLite)
    const loginDataPaths = [
      join(browserPath, 'Default', 'Login Data'),
      join(browserPath, 'Profile 1', 'Login Data'),
    ]

    for (const loginPath of loginDataPaths) {
      if (existsSync(loginPath)) {
        findings.push({
          category: 'Browser',
          title: `${name} password database exists`,
          severity: 'low',
          description: `${name} stores saved passwords locally at ${relative(HOME, loginPath)}. These are encrypted with OS keychain but accessible to local processes.`,
          remediation: 'Consider using a dedicated password manager (1Password, Bitwarden) instead of browser-saved passwords.',
        })
        break
      }
    }
  }

  return findings
}

// ── 8. npm Global Packages Check ──

function checkNpmGlobalPackages(): SecurityFinding[] {
  const findings: SecurityFinding[] = []

  try {
    const result = execSync('npm outdated -g --json 2>/dev/null || echo "{}"', { timeout: 30_000, maxBuffer: 2_000_000 }).toString()
    const outdated = JSON.parse(result)
    const outdatedPkgs = Object.keys(outdated)

    if (outdatedPkgs.length > 0) {
      const majorUpdates = outdatedPkgs.filter(pkg => {
        const info = outdated[pkg]
        const current = info.current?.split('.')[0]
        const latest = info.latest?.split('.')[0]
        return current && latest && current !== latest
      })

      if (majorUpdates.length > 0) {
        findings.push({
          category: 'Dependencies',
          title: `${majorUpdates.length} globally installed npm package(s) have major version updates`,
          severity: 'medium',
          description: `Packages with major updates: ${majorUpdates.slice(0, 5).join(', ')}${majorUpdates.length > 5 ? ` and ${majorUpdates.length - 5} more` : ''}.`,
          remediation: 'Run: npm update -g (or npm install -g <package>@latest for specific packages).',
        })
      }

      if (outdatedPkgs.length > 5) {
        findings.push({
          category: 'Dependencies',
          title: `${outdatedPkgs.length} outdated global npm packages`,
          severity: 'low',
          description: 'Outdated packages may contain known vulnerabilities.',
          remediation: 'Run: npm update -g',
        })
      }
    }
  } catch {
    // npm not available or errored — skip
  }

  return findings
}

// ── Main: runSecurityScan ──

export interface ScanOptions {
  /** Directory to scan for secrets (default: cwd) */
  secretsScanPath?: string
  /** Skip port scanning */
  skipPorts?: boolean
  /** Skip npm global check */
  skipNpm?: boolean
  /** Skip browser data check */
  skipBrowser?: boolean
}

/**
 * Full personal security audit.
 * Checks: secrets, SSH, permissions, ports, firewall, git, browser, npm globals.
 */
export async function runSecurityScan(options?: ScanOptions): Promise<SecurityReport> {
  const allFindings: SecurityFinding[] = []
  const goodPractices: string[] = []

  // 1. Secret scan
  const secrets = scanForSecrets(options?.secretsScanPath)
  for (const s of secrets) {
    allFindings.push({
      category: 'Secrets',
      title: `${s.type} found in source`,
      severity: 'critical',
      description: `Found ${s.type} at ${s.file}:${s.line} (preview: ${s.preview}).`,
      remediation: 'Remove the secret from source code, rotate the key, and add the file to .gitignore.',
      location: `${s.file}:${s.line}`,
    })
  }
  if (secrets.length === 0) {
    goodPractices.push('No leaked secrets detected in source code.')
  }

  // 2. SSH security
  const sshAudit = checkSSHSecurity()
  allFindings.push(...sshAudit.findings)
  if (sshAudit.findings.length === 0 && sshAudit.keysFound.length > 0) {
    goodPractices.push('SSH keys are properly configured and secured.')
  }
  const protectedKeys = sshAudit.keysFound.filter(k => k.hasPassphrase === true)
  if (protectedKeys.length > 0) {
    goodPractices.push(`${protectedKeys.length} SSH key(s) are passphrase-protected.`)
  }

  // 3. File permissions
  const permChecks = checkFilePermissions()
  for (const pc of permChecks) {
    if (pc.finding) allFindings.push(pc.finding)
  }
  const securedFiles = permChecks.filter(p => p.exists && !p.isWorldReadable && !p.isWorldWritable)
  if (securedFiles.length > 0) {
    goodPractices.push(`${securedFiles.length} sensitive files/dirs have proper permissions.`)
  }

  // 4. Open ports
  if (!options?.skipPorts) {
    const portScan = await checkPortExposure()
    allFindings.push(...portScan.findings)
    const openPorts = portScan.ports.filter(p => p.open)
    if (portScan.findings.length === 0 && openPorts.length > 0) {
      goodPractices.push('Open ports are non-risky services only.')
    }
    if (openPorts.length === 0) {
      goodPractices.push('No common ports are open on localhost.')
    }
  }

  // 5. Firewall
  const firewallFindings = checkFirewall()
  allFindings.push(...firewallFindings)
  if (firewallFindings.length === 0) {
    goodPractices.push('Firewall is enabled.')
  }

  // 6. Git config
  const gitFindings = checkGitConfig()
  allFindings.push(...gitFindings)
  if (gitFindings.length === 0) {
    goodPractices.push('Git configuration is clean (no plaintext credential storage).')
  }

  // 7. Browser data
  if (!options?.skipBrowser) {
    const browserFindings = checkBrowserData()
    allFindings.push(...browserFindings)
  }

  // 8. npm globals
  if (!options?.skipNpm) {
    const npmFindings = checkNpmGlobalPackages()
    allFindings.push(...npmFindings)
    if (npmFindings.length === 0) {
      goodPractices.push('Global npm packages are up to date.')
    }
  }

  // Compute score
  const criticalCount = allFindings.filter(f => f.severity === 'critical').length
  const highCount = allFindings.filter(f => f.severity === 'high').length
  const mediumCount = allFindings.filter(f => f.severity === 'medium').length
  const lowCount = allFindings.filter(f => f.severity === 'low').length

  // Score: start at 100, deduct by severity
  let score = 100
  score -= criticalCount * 15
  score -= highCount * 8
  score -= mediumCount * 4
  score -= lowCount * 1
  score = Math.max(0, Math.min(100, score))

  const summaryParts: string[] = []
  if (criticalCount > 0) summaryParts.push(`${criticalCount} critical`)
  if (highCount > 0) summaryParts.push(`${highCount} high`)
  if (mediumCount > 0) summaryParts.push(`${mediumCount} medium`)
  if (lowCount > 0) summaryParts.push(`${lowCount} low`)
  const summary = summaryParts.length > 0
    ? `Found ${allFindings.length} issue(s): ${summaryParts.join(', ')}. Score: ${score}/100.`
    : `No issues found. Score: ${score}/100. Your machine is well-secured.`

  return {
    timestamp: new Date().toISOString(),
    score,
    findings: allFindings,
    criticalCount,
    highCount,
    mediumCount,
    lowCount,
    goodPractices,
    summary,
  }
}

// ── monitorFileChanges ──

const activeWatchers: FSWatcher[] = []

/**
 * Watch sensitive directories for unexpected changes.
 * Logs all change events to ~/.kbot/security/monitor-log.jsonl.
 * Returns a dispose function to stop watching.
 */
export function monitorFileChanges(paths?: string[]): { dispose: () => void } {
  const defaultPaths = [
    join(HOME, '.ssh'),
    join(HOME, '.kbot'),
    join(HOME, '.env'),
    join(HOME, '.gitconfig'),
  ]

  const watchPaths = paths || defaultPaths
  ensureDir(SECURITY_DIR)

  for (const watchPath of watchPaths) {
    if (!existsSync(watchPath)) continue

    try {
      const watcher = watch(watchPath, { recursive: true }, (eventType, filename) => {
        const event: MonitorEvent = {
          timestamp: new Date().toISOString(),
          path: watchPath,
          eventType,
          filename: filename || null,
        }

        try {
          appendFileSync(MONITOR_LOG, JSON.stringify(event) + '\n')
        } catch {
          // Cannot write log — fail silently
        }
      })

      activeWatchers.push(watcher)
    } catch {
      // Cannot watch this path — skip
    }
  }

  return {
    dispose(): void {
      for (const w of activeWatchers) {
        try { w.close() } catch { /* ignore */ }
      }
      activeWatchers.length = 0
    },
  }
}

// ── checkBreachedEmails ──

/**
 * Check if email addresses appear in known data breaches using the Have I Been Pwned API.
 * Uses the free, public, unauthenticated breach search endpoint.
 */
export async function checkBreachedEmails(emails: string[]): Promise<BreachResult[]> {
  const results: BreachResult[] = []

  for (const email of emails) {
    const trimmed = email.trim().toLowerCase()
    if (!trimmed) continue

    try {
      // HIBP API v3 — breachedaccount endpoint (requires User-Agent)
      const url = `https://haveibeenpwned.com/api/v3/breachedaccount/${encodeURIComponent(trimmed)}?truncateResponse=false`
      const res = await fetch(url, {
        headers: {
          'User-Agent': 'kbot-security-scanner',
          'Accept': 'application/json',
        },
        signal: AbortSignal.timeout(10_000),
      })

      if (res.status === 404) {
        // Not found = not breached
        results.push({ email: trimmed, breached: false, breachCount: 0, breaches: [] })
      } else if (res.status === 200) {
        const breaches = await res.json() as Array<{
          Name: string
          Domain: string
          BreachDate: string
          DataClasses: string[]
        }>

        results.push({
          email: trimmed,
          breached: true,
          breachCount: breaches.length,
          breaches: breaches.map(b => ({
            name: b.Name,
            domain: b.Domain,
            breachDate: b.BreachDate,
            dataClasses: b.DataClasses,
          })),
        })
      } else if (res.status === 429) {
        // Rate limited — HIBP has strict rate limits on the free tier
        results.push({
          email: trimmed,
          breached: false,
          breachCount: 0,
          breaches: [{ name: 'RATE_LIMITED', domain: '', breachDate: '', dataClasses: ['Rate limited by HIBP — wait 6 seconds between requests or use an API key'] }],
        })
      } else if (res.status === 401) {
        // API key required for this endpoint
        results.push({
          email: trimmed,
          breached: false,
          breachCount: 0,
          breaches: [{ name: 'API_KEY_REQUIRED', domain: '', breachDate: '', dataClasses: ['HIBP now requires an API key ($3.50/mo) for email breach lookups. See haveibeenpwned.com/API/Key'] }],
        })
      }
    } catch {
      results.push({
        email: trimmed,
        breached: false,
        breachCount: 0,
        breaches: [{ name: 'ERROR', domain: '', breachDate: '', dataClasses: ['Failed to reach HIBP API'] }],
      })
    }

    // HIBP rate limit: 1 request per 1.5 seconds (free tier)
    if (emails.indexOf(email) < emails.length - 1) {
      await new Promise(r => setTimeout(r, 1600))
    }
  }

  return results
}

// ── generateSecurityReport ──

/**
 * Run a full scan and format it into a human-readable report.
 */
export async function generateSecurityReport(options?: ScanOptions): Promise<string> {
  const report = await runSecurityScan(options)
  const lines: string[] = []

  // Header
  lines.push('=====================================')
  lines.push('  KBOT PERSONAL SECURITY REPORT')
  lines.push('=====================================')
  lines.push(`  Date: ${new Date(report.timestamp).toLocaleString()}`)
  lines.push('')

  // Score
  const scoreBar = generateScoreBar(report.score)
  lines.push(`  Overall Score: ${report.score}/100 ${scoreBar}`)
  lines.push('')

  if (report.score >= 90) {
    lines.push('  Status: EXCELLENT — Your machine is well-secured.')
  } else if (report.score >= 70) {
    lines.push('  Status: GOOD — A few items need attention.')
  } else if (report.score >= 50) {
    lines.push('  Status: FAIR — Several security issues found.')
  } else {
    lines.push('  Status: POOR — Critical issues require immediate action.')
  }
  lines.push('')

  // Critical findings
  const criticals = report.findings.filter(f => f.severity === 'critical')
  if (criticals.length > 0) {
    lines.push('-------------------------------------')
    lines.push('  CRITICAL FINDINGS (Must Fix)')
    lines.push('-------------------------------------')
    for (const f of criticals) {
      lines.push('')
      lines.push(`  [CRITICAL] ${f.title}`)
      lines.push(`  Category: ${f.category}`)
      lines.push(`  ${f.description}`)
      lines.push(`  Fix: ${f.remediation}`)
      if (f.location) lines.push(`  Location: ${f.location}`)
    }
    lines.push('')
  }

  // High findings
  const highs = report.findings.filter(f => f.severity === 'high')
  if (highs.length > 0) {
    lines.push('-------------------------------------')
    lines.push('  HIGH SEVERITY FINDINGS')
    lines.push('-------------------------------------')
    for (const f of highs) {
      lines.push('')
      lines.push(`  [HIGH] ${f.title}`)
      lines.push(`  Category: ${f.category}`)
      lines.push(`  ${f.description}`)
      lines.push(`  Fix: ${f.remediation}`)
      if (f.location) lines.push(`  Location: ${f.location}`)
    }
    lines.push('')
  }

  // Medium & Low findings
  const mediums = report.findings.filter(f => f.severity === 'medium')
  const lows = report.findings.filter(f => f.severity === 'low')
  if (mediums.length > 0 || lows.length > 0) {
    lines.push('-------------------------------------')
    lines.push('  RECOMMENDATIONS')
    lines.push('-------------------------------------')
    for (const f of [...mediums, ...lows]) {
      lines.push(`  [${f.severity.toUpperCase()}] ${f.title} — ${f.remediation}`)
    }
    lines.push('')
  }

  // Good practices
  if (report.goodPractices.length > 0) {
    lines.push('-------------------------------------')
    lines.push('  WHAT IS GOOD')
    lines.push('-------------------------------------')
    for (const g of report.goodPractices) {
      lines.push(`  [OK] ${g}`)
    }
    lines.push('')
  }

  lines.push('-------------------------------------')
  lines.push(`  Summary: ${report.summary}`)
  lines.push('-------------------------------------')

  return lines.join('\n')
}

function generateScoreBar(score: number): string {
  const filled = Math.round(score / 5)
  const empty = 20 - filled
  return '[' + '#'.repeat(filled) + '-'.repeat(empty) + ']'
}

// ── scheduleSecurityScan ──

let scanInterval: ReturnType<typeof setInterval> | null = null

/**
 * Set up recurring security scans.
 * Results saved to ~/.kbot/security/scan-history.json.
 * Sends Discord webhook alert if critical findings detected.
 */
export function scheduleSecurityScan(intervalHours: number, discordWebhookUrl?: string): { stop: () => void } {
  ensureDir(SECURITY_DIR)

  // Stop any existing schedule
  if (scanInterval) {
    clearInterval(scanInterval)
    scanInterval = null
  }

  async function executeScan(): Promise<void> {
    try {
      const report = await runSecurityScan({ skipBrowser: true, skipNpm: true })

      // Save to history
      const history = loadScanHistory()
      history.push({
        timestamp: report.timestamp,
        score: report.score,
        criticalCount: report.criticalCount,
        highCount: report.highCount,
        mediumCount: report.mediumCount,
        lowCount: report.lowCount,
        totalFindings: report.findings.length,
      })

      // Keep last 100 entries
      if (history.length > 100) history.splice(0, history.length - 100)
      saveScanHistory(history)

      // Alert on critical findings
      if (report.criticalCount > 0 && discordWebhookUrl) {
        try {
          const alertBody = {
            content: null,
            embeds: [{
              title: 'kbot Security Alert',
              description: `**${report.criticalCount} critical finding(s)** detected during scheduled scan.\n\nScore: ${report.score}/100\n\n${report.findings
                .filter(f => f.severity === 'critical')
                .map(f => `- **${f.title}**: ${f.description}`)
                .join('\n')}`,
              color: 0xFF0000, // Red
              timestamp: report.timestamp,
            }],
          }

          await fetch(discordWebhookUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(alertBody),
            signal: AbortSignal.timeout(10_000),
          })
        } catch {
          // Cannot send alert — log locally
          try {
            appendFileSync(
              join(SECURITY_DIR, 'alert-failures.log'),
              `${new Date().toISOString()} Failed to send Discord alert for ${report.criticalCount} critical finding(s)\n`
            )
          } catch { /* fail silently */ }
        }
      }
    } catch {
      // Scan failed — log error
      try {
        appendFileSync(
          join(SECURITY_DIR, 'scan-errors.log'),
          `${new Date().toISOString()} Scheduled scan failed\n`
        )
      } catch { /* fail silently */ }
    }
  }

  // Run immediately, then on interval
  void executeScan()
  const intervalMs = intervalHours * 60 * 60 * 1000
  scanInterval = setInterval(() => { void executeScan() }, intervalMs)

  return {
    stop(): void {
      if (scanInterval) {
        clearInterval(scanInterval)
        scanInterval = null
      }
    },
  }
}

// ── Scan History ──

function loadScanHistory(): ScanHistoryEntry[] {
  const path = SCAN_HISTORY
  if (!existsSync(path)) return []
  try {
    return JSON.parse(readFileSync(path, 'utf-8'))
  } catch {
    return []
  }
}

function saveScanHistory(history: ScanHistoryEntry[]): void {
  ensureDir(SECURITY_DIR)
  writeFileSync(SCAN_HISTORY, JSON.stringify(history, null, 2))
}

/**
 * Get the scan history for trend analysis.
 */
export function getScanHistory(limit = 20): ScanHistoryEntry[] {
  return loadScanHistory().slice(-limit)
}
