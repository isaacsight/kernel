// permissions.test — covers the v4.2.0 persona integration on top of the
// existing destructive-op confirmation chain. We verify:
//   1. No persona set → existing behavior preserved.
//   2. Persona allow/deny paths fire before the prompt.
//   3. CODER deny-pattern + rate-limit propagate through checkPersonaScope.
//   4. Out-of-scope tools are denied with a clear reason.
//
// The interactive confirmToolCall() path is intentionally NOT exercised here —
// it requires stdin and is covered by manual QA. We hold permission mode at
// 'permissive' so the only failure surface in checkPermission() is the
// persona scope check.
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { checkPermission, checkPersonaScope, setActivePersona, setPermissionMode, getActivePersona, } from './permissions.js';
import { _resetRateLimits } from './futures/persona/check.js';
beforeEach(() => {
    setActivePersona(null);
    setPermissionMode('permissive');
    _resetRateLimits();
});
afterEach(() => {
    setActivePersona(null);
});
describe('persona integration — defaults', () => {
    it('no persona set → checkPermission allows researcher tools regardless of caller', async () => {
        expect(getActivePersona()).toBeNull();
        expect(checkPersonaScope('write_file', { path: 'x', content: 'y' })).toBeNull();
        expect(await checkPermission('write_file', { path: 'x', content: 'y' })).toBe(true);
    });
    it('no persona set → checkPersonaScope returns null for any tool', () => {
        expect(checkPersonaScope('bash', { command: 'rm -rf /' })).toBeNull();
        expect(checkPersonaScope('mouse_click', { x: 0, y: 0 })).toBeNull();
    });
    it('unknown persona id throws on setActivePersona', () => {
        expect(() => setActivePersona('not-a-real-persona')).toThrow(/unknown persona/);
    });
});
describe('researcher persona', () => {
    beforeEach(() => setActivePersona('researcher'));
    it('allows web_search', async () => {
        expect(checkPersonaScope('web_search', { query: 'kbot' })).toBeNull();
        expect(await checkPermission('web_search', { query: 'kbot' })).toBe(true);
    });
    it('denies write_file with a clear reason', async () => {
        const reason = checkPersonaScope('write_file', { path: 'x.txt', content: 'y' });
        expect(reason).not.toBeNull();
        expect(reason).toMatch(/Persona 'researcher' denies 'write_file'/);
        expect(reason).toMatch(/no scope matched/);
        expect(await checkPermission('write_file', { path: 'x.txt', content: 'y' })).toBe(false);
    });
});
describe('coder persona', () => {
    beforeEach(() => setActivePersona('coder'));
    it('denies bash with rm -rf / via deny-pattern', async () => {
        const reason = checkPersonaScope('bash', { command: 'rm -rf /' });
        expect(reason).not.toBeNull();
        expect(reason).toMatch(/Persona 'coder' denies 'bash'/);
        expect(reason).toMatch(/deny pattern/);
        expect(await checkPermission('bash', { command: 'rm -rf /' })).toBe(false);
    });
    it('allows safe bash up to rate limit, denies the 61st call within the window', () => {
        // CODER: bash is rate-limited to 60 / 60_000 ms.
        for (let i = 0; i < 60; i++) {
            const reason = checkPersonaScope('bash', { command: `echo ${i}` });
            expect(reason).toBeNull();
        }
        const reason = checkPersonaScope('bash', { command: 'echo 60' });
        expect(reason).not.toBeNull();
        expect(reason).toMatch(/rate limit exceeded/);
    });
});
describe('computer-use persona', () => {
    beforeEach(() => setActivePersona('computer-use'));
    it('denies web_search (out of scope)', async () => {
        const reason = checkPersonaScope('web_search', { query: 'foo' });
        expect(reason).not.toBeNull();
        expect(reason).toMatch(/Persona 'computer-use' denies 'web_search'/);
        expect(reason).toMatch(/no scope matched/);
        expect(await checkPermission('web_search', { query: 'foo' })).toBe(false);
    });
    it('allows screenshot', async () => {
        expect(checkPersonaScope('screenshot', {})).toBeNull();
        expect(await checkPermission('screenshot', {})).toBe(true);
    });
});
//# sourceMappingURL=permissions.test.js.map