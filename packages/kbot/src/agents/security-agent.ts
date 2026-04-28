// kbot Security Agent — unified app-sec scanner over guardian/hacker tools.
// Mirrors the Codex Security agent surface (March 2026). Single named entry
// point: runSecurityAgent({ target, mode }).

import * as fs from 'node:fs'
import * as path from 'node:path'
import {
  RULES, RULES_BY_ID, SEVERITY_RANK, shouldScan, type Severity,
} from './security-rules.js'

export type SecurityMode = 'scan' | 'scan-and-fix' | 'report-only'

export interface SecurityFinding {
  id: string
  severity: Severity
  category: string
  file: string
  line?: number
  description: string
  recommendation: string
  fixed?: boolean
}

export interface SecurityReport {
  scanned: number
  findings: SecurityFinding[]
  fixesApplied: number
  summary: string
}

export interface RunSecurityAgentInput {
  target: string
  mode: SecurityMode
}

const SKIP_DIRS = new Set(['node_modules', 'dist', '.git', '.next', 'build', '.turbo'])

function walk(dir: string, out: string[]): void {
  let entries: fs.Dirent[]
  try {
    entries = fs.readdirSync(dir, { withFileTypes: true })
  } catch {
    return
  }
  for (const e of entries) {
    if (e.name.startsWith('.') && !e.name.startsWith('.env')) {
      // skip hidden dirs except .env-style files
      if (e.isDirectory()) continue
    }
    const full = path.join(dir, e.name)
    if (e.isDirectory()) {
      if (SKIP_DIRS.has(e.name)) continue
      walk(full, out)
    } else if (e.isFile()) {
      if (shouldScan(e.name)) out.push(full)
    }
  }
}

function rankCompare(a: SecurityFinding, b: SecurityFinding): number {
  const r = SEVERITY_RANK[a.severity] - SEVERITY_RANK[b.severity]
  if (r !== 0) return r
  if (a.file !== b.file) return a.file < b.file ? -1 : 1
  return (a.line ?? 0) - (b.line ?? 0)
}

function scanFile(
  file: string, mode: SecurityMode,
): { findings: SecurityFinding[]; fixes: number } {
  let text: string
  try {
    text = fs.readFileSync(file, 'utf8')
  } catch {
    return { findings: [], fixes: 0 }
  }
  const lines = text.split(/\r?\n/)
  const findings: SecurityFinding[] = []
  let fixesApplied = 0
  let mutated = false
  const newLines = [...lines]

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]
    const ctx = { file, line, lineNumber: i + 1, fullText: text }
    for (const rule of RULES) {
      if (rule.appliesTo && !rule.appliesTo(file)) continue
      const result = rule.test(ctx)
      if (!result) continue
      const hits = Array.isArray(result) ? result : [result]
      for (const h of hits) {
        let fixed: boolean | undefined
        if (mode === 'scan-and-fix' && h.fix) {
          // Conservative: only apply when the find string appears verbatim.
          if (newLines[i].includes(h.fix.find)) {
            newLines[i] = newLines[i].replace(h.fix.find, h.fix.replace)
            mutated = true
            fixesApplied++
            fixed = true
          }
        } else if (mode === 'scan-and-fix' && !h.fix) {
          // Riskier patterns: log + skip with suggestion.
          fixed = false
        }
        findings.push({
          id: h.id,
          severity: h.severity,
          category: h.category,
          file,
          line: i + 1,
          description: h.description,
          recommendation: h.recommendation,
          fixed,
        })
      }
    }
  }

  if (mode === 'scan-and-fix' && mutated) {
    fs.writeFileSync(file, newLines.join('\n'))
  }
  return { findings, fixes: fixesApplied }
}

function buildSummary(report: Omit<SecurityReport, 'summary'>): string {
  const counts: Record<Severity, number> = {
    critical: 0, high: 0, medium: 0, low: 0, info: 0,
  }
  for (const f of report.findings) counts[f.severity]++

  const lines: string[] = []
  lines.push('# kbot Security Agent Report')
  lines.push('')
  lines.push(`- Files scanned: **${report.scanned}**`)
  lines.push(`- Findings: **${report.findings.length}**`)
  lines.push(`- Fixes applied: **${report.fixesApplied}**`)
  lines.push('')
  lines.push('## Severity breakdown')
  lines.push('')
  lines.push(`- critical: ${counts.critical}`)
  lines.push(`- high: ${counts.high}`)
  lines.push(`- medium: ${counts.medium}`)
  lines.push(`- low: ${counts.low}`)
  lines.push(`- info: ${counts.info}`)
  lines.push('')
  if (report.findings.length > 0) {
    lines.push('## Findings')
    lines.push('')
    for (const f of report.findings) {
      const loc = f.line ? `${f.file}:${f.line}` : f.file
      const fixedTag = f.fixed === true ? ' [FIXED]'
        : f.fixed === false ? ' [skipped]' : ''
      lines.push(`- **[${f.severity.toUpperCase()}] ${f.id}** ${f.description}${fixedTag}`)
      lines.push(`  - location: \`${loc}\``)
      lines.push(`  - recommendation: ${f.recommendation}`)
    }
  } else {
    lines.push('No findings — clean.')
  }
  return lines.join('\n')
}

/**
 * Run the kbot security agent over a directory.
 * - `scan`: read-only walk + report
 * - `scan-and-fix`: applies the safest auto-fixes (currently md5 -> sha256)
 * - `report-only`: identical to scan; never writes
 */
export async function runSecurityAgent(
  input: RunSecurityAgentInput,
): Promise<SecurityReport> {
  const { target } = input
  const mode: SecurityMode = input.mode ?? 'scan'

  const files: string[] = []
  let stat: fs.Stats
  try {
    stat = fs.statSync(target)
  } catch {
    const empty: Omit<SecurityReport, 'summary'> = {
      scanned: 0, findings: [], fixesApplied: 0,
    }
    return { ...empty, summary: buildSummary(empty) }
  }

  if (stat.isDirectory()) {
    walk(target, files)
  } else if (stat.isFile() && shouldScan(path.basename(target))) {
    files.push(target)
  }

  const allFindings: SecurityFinding[] = []
  let fixesApplied = 0
  for (const file of files) {
    const effectiveMode: SecurityMode = mode === 'report-only' ? 'scan' : mode
    const { findings, fixes } = scanFile(file, effectiveMode)
    allFindings.push(...findings)
    fixesApplied += fixes
  }

  allFindings.sort(rankCompare)

  const base: Omit<SecurityReport, 'summary'> = {
    scanned: files.length,
    findings: allFindings,
    fixesApplied,
  }
  return { ...base, summary: buildSummary(base) }
}

// Re-export the rule registry for callers that want to introspect / extend.
export { RULES, RULES_BY_ID }
