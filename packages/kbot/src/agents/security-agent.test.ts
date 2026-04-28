// kbot Security Agent tests
import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import * as fs from 'node:fs'
import * as os from 'node:os'
import * as path from 'node:path'

import { runSecurityAgent } from './security-agent.js'

function mkFixture(): string {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'kbot-secagent-'))
}

function rm(dir: string): void {
  fs.rmSync(dir, { recursive: true, force: true })
}

describe('runSecurityAgent', () => {
  let dir = ''

  beforeEach(() => { dir = mkFixture() })
  afterEach(() => { rm(dir) })

  it('returns 0 findings for an empty directory', async () => {
    const r = await runSecurityAgent({ target: dir, mode: 'scan' })
    expect(r.scanned).toBe(0)
    expect(r.findings.length).toBe(0)
    expect(r.fixesApplied).toBe(0)
    expect(r.summary).toContain('No findings')
  })

  it('flags 5 known violations in a fixture file', async () => {
    // five distinct rule hits, one per line
    const violations = [
      `const key = "sk-ABCDEFGHIJKLMNOP1234567890"`,                       // SEC-001
      `const aws = "AKIAABCDEFGHIJKLMNOP"`,                                 // SEC-002
      `const password = "hunter22hunter22"`,                                // SEC-004
      `eval("1+1")`,                                                        // SEC-007
      `const h = createHash('md5')`,                                        // SEC-015
    ].join('\n')
    fs.writeFileSync(path.join(dir, 'a.ts'), violations)

    const r = await runSecurityAgent({ target: dir, mode: 'scan' })
    expect(r.scanned).toBe(1)
    expect(r.findings.length).toBe(5)

    const ids = r.findings.map(f => f.id).sort()
    expect(ids).toEqual(['SEC-001', 'SEC-002', 'SEC-004', 'SEC-007', 'SEC-015'])

    // severity sort: criticals first
    const sevs = r.findings.map(f => f.severity)
    expect(sevs[0]).toBe('critical')
    expect(sevs.indexOf('critical')).toBeLessThan(sevs.indexOf('high'))
  })

  it('scan-and-fix replaces createHash(md5) with createHash(sha256)', async () => {
    const file = path.join(dir, 'hash.ts')
    fs.writeFileSync(file, `const h = createHash('md5')\n`)

    const r = await runSecurityAgent({ target: dir, mode: 'scan-and-fix' })
    expect(r.fixesApplied).toBe(1)
    const after = fs.readFileSync(file, 'utf8')
    expect(after).toContain(`createHash('sha256')`)
    expect(after).not.toContain(`createHash('md5')`)

    const fixedFinding = r.findings.find(f => f.id === 'SEC-015')
    expect(fixedFinding?.fixed).toBe(true)
  })

  it('report-only mode never writes to disk', async () => {
    const file = path.join(dir, 'hash.ts')
    const original = `const h = createHash('md5')\n`
    fs.writeFileSync(file, original)

    const r = await runSecurityAgent({ target: dir, mode: 'report-only' })
    expect(r.fixesApplied).toBe(0)
    expect(fs.readFileSync(file, 'utf8')).toBe(original)

    const f = r.findings.find(x => x.id === 'SEC-015')
    expect(f).toBeDefined()
    expect(f?.fixed).toBeUndefined()
  })

  it('skips node_modules / dist / .git / .next directories', async () => {
    fs.mkdirSync(path.join(dir, 'node_modules'))
    fs.mkdirSync(path.join(dir, 'dist'))
    fs.mkdirSync(path.join(dir, '.git'))
    fs.mkdirSync(path.join(dir, '.next'))
    const bad = `eval("nope")\n`
    fs.writeFileSync(path.join(dir, 'node_modules', 'a.ts'), bad)
    fs.writeFileSync(path.join(dir, 'dist', 'a.ts'), bad)
    fs.writeFileSync(path.join(dir, '.git', 'a.ts'), bad)
    fs.writeFileSync(path.join(dir, '.next', 'a.ts'), bad)
    fs.writeFileSync(path.join(dir, 'real.ts'), bad)

    const r = await runSecurityAgent({ target: dir, mode: 'scan' })
    expect(r.scanned).toBe(1)
    expect(r.findings.length).toBe(1)
    expect(r.findings[0].file.endsWith('real.ts')).toBe(true)
  })

  it('riskier patterns are not auto-fixed in scan-and-fix mode', async () => {
    const file = path.join(dir, 'risky.ts')
    const src = `const token = Math.random().toString(36)\n`
    fs.writeFileSync(file, src)

    const r = await runSecurityAgent({ target: dir, mode: 'scan-and-fix' })
    expect(fs.readFileSync(file, 'utf8')).toBe(src) // unchanged
    const f = r.findings.find(x => x.id === 'SEC-014')
    expect(f).toBeDefined()
    expect(f?.fixed).toBe(false)
  })

  it('produces a Markdown summary', async () => {
    fs.writeFileSync(path.join(dir, 'a.ts'), `eval("x")\n`)
    const r = await runSecurityAgent({ target: dir, mode: 'scan' })
    expect(r.summary.startsWith('# kbot Security Agent Report')).toBe(true)
    expect(r.summary).toContain('Files scanned')
    expect(r.summary).toContain('SEC-007')
  })
})
