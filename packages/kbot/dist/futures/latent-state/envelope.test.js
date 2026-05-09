import { describe, expect, it } from 'vitest';
import { createEnvelope, deserialize, merge, serialize, verifyHash, withProvenance, } from './envelope.js';
describe('createEnvelope', () => {
    it('classifies text-only as kind=text', () => {
        const env = createEnvelope({ from: 'a', to: 'b', text: 'hi' });
        expect(env.kind).toBe('text');
        expect(env.structured).toBeUndefined();
    });
    it('classifies structured-only as kind=structured', () => {
        const env = createEnvelope({ from: 'a', to: 'b', structured: { x: 1 } });
        expect(env.kind).toBe('structured');
    });
    it('classifies dual payloads as kind=mixed', () => {
        const env = createEnvelope({
            from: 'a', to: 'b', text: 'hi', structured: { x: 1 },
        });
        expect(env.kind).toBe('mixed');
    });
    it('seeds provenance with one entry from the source agent', () => {
        const env = createEnvelope({ from: 'planner', to: 'worker', text: 'go' });
        expect(env.provenance).toHaveLength(1);
        expect(env.provenance[0]).toMatchObject({ step: 1, agent: 'planner' });
        expect(env.contentHash).toMatch(/^[0-9a-f]{64}$/);
        expect(verifyHash(env)).toBe(true);
    });
});
describe('serialize / deserialize', () => {
    it('round-trips a text envelope', () => {
        const original = createEnvelope({ from: 'a', to: 'b', text: 'payload' });
        expect(deserialize(serialize(original))).toEqual(original);
    });
    it('round-trips a mixed envelope with nested structured data', () => {
        const original = createEnvelope({
            from: 'a', to: 'b', text: 'note',
            structured: { plan: { steps: [1, 2, 3], owner: 'a' } },
        });
        const back = deserialize(serialize(original));
        expect(back).toEqual(original);
        expect(verifyHash(back)).toBe(true);
    });
    it('throws when text has been tampered', () => {
        const env = createEnvelope({ from: 'a', to: 'b', text: 'truth' });
        const obj = JSON.parse(serialize(env));
        obj.text = 'lies';
        expect(() => deserialize(JSON.stringify(obj))).toThrow(/contentHash mismatch/);
    });
    it('throws on unsupported version', () => {
        const env = createEnvelope({ from: 'a', to: 'b', text: 'x' });
        const obj = JSON.parse(serialize(env));
        obj.version = 999;
        expect(() => deserialize(JSON.stringify(obj))).toThrow(/unsupported version/);
    });
});
describe('verifyHash', () => {
    it('detects in-memory tampering of text or structured', () => {
        const env = createEnvelope({
            from: 'a', to: 'b', text: 'real', structured: { allow: true },
        });
        expect(verifyHash({ ...env, text: 'fake' })).toBe(false);
        expect(verifyHash({ ...env, structured: { allow: false } })).toBe(false);
    });
});
describe('withProvenance', () => {
    it('appends a step, rehashes, and does not mutate input', () => {
        const env = createEnvelope({ from: 'a', to: 'b', text: 'go' });
        const before = JSON.stringify(env);
        const next = withProvenance(env, {
            agent: 'b', ts: '2026-04-25T00:00:00.000Z', note: 'received',
        });
        expect(next.provenance).toHaveLength(2);
        expect(next.provenance[1]).toMatchObject({ step: 2, agent: 'b' });
        expect(next.contentHash).not.toBe(env.contentHash);
        expect(verifyHash(next)).toBe(true);
        expect(JSON.stringify(env)).toBe(before);
    });
});
describe('merge', () => {
    it('preserves provenance from both, renumbered', () => {
        const a = createEnvelope({ from: 'x', to: 'y', text: 'one' });
        const b = withProvenance(createEnvelope({ from: 'x', to: 'y', text: 'two' }), { agent: 'y', ts: '2026-04-25T00:00:00.000Z', note: 'ack' });
        const m = merge(a, b);
        expect(m.provenance).toHaveLength(a.provenance.length + b.provenance.length);
        expect(m.provenance.map((p) => p.step)).toEqual([1, 2, 3]);
        expect(verifyHash(m)).toBe(true);
    });
    it('concatenates text, deep-merges structured, fresh hash', () => {
        const a = createEnvelope({
            from: 'x', to: 'y', text: 'first',
            structured: { plan: { a: 1 }, keep: true },
        });
        const b = createEnvelope({
            from: 'x', to: 'y', text: 'second',
            structured: { plan: { b: 2 }, extra: 'yes' },
        });
        const m = merge(a, b);
        expect(m.text).toBe('first\nsecond');
        expect(m.structured).toEqual({
            plan: { a: 1, b: 2 }, keep: true, extra: 'yes',
        });
        expect(m.kind).toBe('mixed');
        expect(m.contentHash).not.toBe(a.contentHash);
        expect(m.contentHash).not.toBe(b.contentHash);
    });
    it('throws when from/to do not match', () => {
        const a = createEnvelope({ from: 'x', to: 'y', text: 'one' });
        const b = createEnvelope({ from: 'x', to: 'z', text: 'two' });
        expect(() => merge(a, b)).toThrow(/different from\/to/);
    });
});
//# sourceMappingURL=envelope.test.js.map