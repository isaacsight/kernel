import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync, readFileSync, readdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { buildSurfaceMap, persistSurfaceMap, renderSurfaceMap, runSecurityAuditLocal, securityAuditLocalTool, } from './security-audit-local.js';
let workDir;
let auditDir;
beforeEach(() => {
    workDir = mkdtempSync(join(tmpdir(), 'kbot-sec-'));
    auditDir = mkdtempSync(join(tmpdir(), 'kbot-sec-audits-'));
});
afterEach(() => {
    rmSync(workDir, { recursive: true, force: true });
    rmSync(auditDir, { recursive: true, force: true });
});
function write(rel, body) {
    const full = join(workDir, rel);
    const dir = full.substring(0, full.lastIndexOf('/'));
    mkdirSync(dir, { recursive: true });
    writeFileSync(full, body, 'utf8');
}
describe('buildSurfaceMap', () => {
    it('detects HIGH-severity shell-exec sinks in JS', () => {
        write('src/server.ts', `
      import { exec } from 'node:child_process'
      export function run(cmd: string) {
        exec(cmd)
      }
    `);
        const map = buildSurfaceMap({ target: workDir });
        expect(map.signals.some((s) => s.category === 'shell-exec' && s.severity === 'HIGH')).toBe(true);
    });
    it('detects eval-sink across languages', () => {
        write('src/a.js', `eval(userInput)`);
        write('src/b.py', `eval(payload)`);
        const map = buildSurfaceMap({ target: workDir });
        const evalSigs = map.signals.filter((s) => s.category === 'eval-sink');
        expect(evalSigs.length).toBeGreaterThanOrEqual(2);
    });
    it('flags rejectUnauthorized:false as HIGH', () => {
        write('src/client.ts', `const opts = { rejectUnauthorized: false }`);
        const map = buildSurfaceMap({ target: workDir });
        const f = map.signals.find((s) => s.category === 'tls-reject-unauthorized');
        expect(f).toBeDefined();
        expect(f?.severity).toBe('HIGH');
    });
    it('respects DEFAULT_EXCLUDES (node_modules)', () => {
        write('node_modules/evil/index.js', `eval(x)`);
        write('src/clean.ts', `const x = 1`);
        const map = buildSurfaceMap({ target: workDir });
        expect(map.signals.find((s) => s.file.includes('node_modules'))).toBeUndefined();
    });
    it('respects severityFloor', () => {
        write('src/x.js', `Math.random()`); // MEDIUM
        write('src/y.js', `eval(z)`); // HIGH
        const map = buildSurfaceMap({ target: workDir, severityFloor: 'HIGH' });
        expect(map.signals.every((s) => s.severity === 'HIGH' || s.severity === 'CRITICAL')).toBe(true);
        expect(map.signals.some((s) => s.category === 'eval-sink')).toBe(true);
        expect(map.signals.find((s) => s.category === 'predictable-random')).toBeUndefined();
    });
    it('honors caller-supplied extra excludes', () => {
        write('generated/foo.js', `eval(x)`);
        write('src/foo.js', `eval(x)`);
        const map = buildSurfaceMap({ target: workDir, excludes: ['generated'] });
        expect(map.signals.find((s) => s.file.startsWith('generated'))).toBeUndefined();
        expect(map.signals.find((s) => s.file.startsWith('src'))).toBeDefined();
    });
    it('throws on missing target', () => {
        expect(() => buildSurfaceMap({ target: join(workDir, 'does-not-exist') })).toThrow();
    });
    it('assigns stable session-prefixed IDs', () => {
        write('src/a.js', `eval(a); eval(b)`);
        const map = buildSurfaceMap({ target: workDir, sessionId: 'audit-test' });
        expect(map.signals[0].id).toMatch(/^audit-test#0001$/);
        expect(map.signals[1].id).toMatch(/^audit-test#0002$/);
    });
});
describe('persistSurfaceMap', () => {
    it('writes surface.jsonl + meta.json under sessionId dir', () => {
        write('src/a.js', `eval(x)`);
        const map = buildSurfaceMap({ target: workDir, sessionId: 'audit-x' });
        const dir = persistSurfaceMap(map, auditDir);
        expect(dir).toBe(join(auditDir, 'audit-x'));
        const files = readdirSync(dir);
        expect(files).toContain('surface.jsonl');
        expect(files).toContain('meta.json');
        const lines = readFileSync(join(dir, 'surface.jsonl'), 'utf8').trim().split('\n');
        expect(lines.length).toBe(map.signals.length);
        const first = JSON.parse(lines[0]);
        expect(first.category).toBe('eval-sink');
        const meta = JSON.parse(readFileSync(join(dir, 'meta.json'), 'utf8'));
        expect(meta.sessionId).toBe('audit-x');
        expect(meta.signalCount).toBe(map.signals.length);
    });
    it('handles empty signal list cleanly', () => {
        write('README.md', `not source`); // .md not in ALL set
        const map = buildSurfaceMap({ target: workDir, sessionId: 'empty' });
        expect(map.signals.length).toBe(0);
        const dir = persistSurfaceMap(map, auditDir);
        expect(readFileSync(join(dir, 'surface.jsonl'), 'utf8')).toBe('');
    });
});
describe('renderSurfaceMap', () => {
    it('produces a markdown summary with severity table', () => {
        write('src/a.ts', `eval(x)`);
        const map = buildSurfaceMap({ target: workDir });
        const dir = persistSurfaceMap(map, auditDir);
        const md = renderSurfaceMap(map, dir);
        expect(md).toContain('# security_audit_local — surface map');
        expect(md).toContain('| severity | count |');
        expect(md).toContain('eval-sink');
        expect(md).toContain(dir);
    });
});
describe('runSecurityAuditLocal', () => {
    it('runs end-to-end and returns map + persistedTo + markdown', () => {
        write('src/a.ts', `eval(x); exec(y)`);
        const result = runSecurityAuditLocal({ target: workDir, baseDir: auditDir });
        expect(result.map.signals.length).toBeGreaterThan(0);
        expect(result.persistedTo.startsWith(auditDir)).toBe(true);
        expect(result.markdown).toContain('surface map');
    });
});
describe('securityAuditLocalTool (ToolDefinition)', () => {
    it('has the expected schema', () => {
        expect(securityAuditLocalTool.name).toBe('security_audit_local');
        expect(securityAuditLocalTool.tier).toBe('free');
        expect(securityAuditLocalTool.parameters.target.required).toBe(true);
    });
    it('returns an error string when target is missing', async () => {
        const out = await securityAuditLocalTool.execute({});
        expect(out.startsWith('Error:')).toBe(true);
    });
    it('returns an error string when target does not exist', async () => {
        const out = await securityAuditLocalTool.execute({ target: '/no/such/path/at/all' });
        expect(out.startsWith('Error:')).toBe(true);
    });
    it('runs end-to-end via execute()', async () => {
        write('src/a.ts', `eval(x)`);
        process.env.KBOT_SECURITY_AUDIT_DIR = auditDir;
        try {
            const out = await securityAuditLocalTool.execute({ target: workDir, severity_floor: 'HIGH' });
            expect(out).toContain('surface map');
            expect(out).toContain('eval-sink');
        }
        finally {
            delete process.env.KBOT_SECURITY_AUDIT_DIR;
        }
    });
});
//# sourceMappingURL=security-audit-local.test.js.map