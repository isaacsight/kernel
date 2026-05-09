/**
 * Latent-state envelope — runtime helpers.
 * Pure functions over `LatentEnvelope`. Node `crypto` (sha256) for hashing.
 */
import { createHash } from 'node:crypto';
/** JSON.stringify with deterministic key order (Object.keys().sort()). */
export function stableStringify(value) {
    return JSON.stringify(canonicalize(value));
}
function canonicalize(value) {
    if (value === null || typeof value !== 'object')
        return value;
    if (Array.isArray(value))
        return value.map(canonicalize);
    const obj = value;
    const out = {};
    for (const key of Object.keys(obj).sort())
        out[key] = canonicalize(obj[key]);
    return out;
}
function hashableBody(env) {
    return {
        version: env.version, from: env.from, to: env.to, kind: env.kind,
        text: env.text, structured: env.structured,
        provenance: env.provenance, createdAt: env.createdAt,
    };
}
function computeHash(env) {
    return createHash('sha256').update(stableStringify(hashableBody(env))).digest('hex');
}
function classify(text, structured) {
    if (text !== undefined && structured !== undefined)
        return 'mixed';
    if (structured !== undefined)
        return 'structured';
    return 'text';
}
/**
 * Build a fresh envelope. Auto-derives `kind`, stamps `createdAt`, seeds
 * provenance with a single step from `opts.from`, and computes `contentHash`.
 */
export function createEnvelope(opts) {
    const kind = classify(opts.text, opts.structured);
    const createdAt = opts.createdAt ?? new Date().toISOString();
    const provenance = [
        {
            step: 1,
            agent: opts.from,
            ts: createdAt,
            ...(opts.note !== undefined ? { note: opts.note } : {}),
        },
    ];
    const body = {
        version: 1,
        from: opts.from,
        to: opts.to,
        kind,
        ...(opts.text !== undefined ? { text: opts.text } : {}),
        ...(opts.structured !== undefined ? { structured: opts.structured } : {}),
        provenance,
        createdAt,
    };
    return { ...body, contentHash: computeHash(body) };
}
/** JSON-serialize an envelope with stable key order. */
export function serialize(env) {
    return stableStringify(env);
}
/** Parse, validate shape, recompute hash, throw if mismatch. */
export function deserialize(s) {
    let raw;
    try {
        raw = JSON.parse(s);
    }
    catch (err) {
        throw new Error(`latent-state: invalid JSON: ${err.message}`);
    }
    const env = assertShape(raw);
    if (!verifyHash(env)) {
        throw new Error('latent-state: contentHash mismatch — envelope tampered');
    }
    return env;
}
function assertShape(raw) {
    if (!raw || typeof raw !== 'object')
        throw new Error('latent-state: envelope must be an object');
    const o = raw;
    if (o.version !== 1)
        throw new Error(`latent-state: unsupported version ${String(o.version)}`);
    if (typeof o.from !== 'string' || typeof o.to !== 'string')
        throw new Error('latent-state: from/to must be strings');
    if (o.kind !== 'text' && o.kind !== 'structured' && o.kind !== 'mixed')
        throw new Error(`latent-state: invalid kind ${String(o.kind)}`);
    if (typeof o.createdAt !== 'string' || typeof o.contentHash !== 'string')
        throw new Error('latent-state: createdAt/contentHash must be strings');
    if (!Array.isArray(o.provenance) || o.provenance.length === 0)
        throw new Error('latent-state: provenance must be a non-empty array');
    return o;
}
/** True iff stored `contentHash` matches a fresh hash of the body. */
export function verifyHash(env) {
    const { contentHash, ...body } = env;
    return computeHash(body) === contentHash;
}
/** Append a provenance step and rehash. Returns a new envelope. */
export function withProvenance(env, entry) {
    const nextStep = entry.step ?? Math.max(0, ...env.provenance.map((p) => p.step)) + 1;
    const provenance = [
        ...env.provenance,
        {
            step: nextStep,
            agent: entry.agent,
            ts: entry.ts,
            ...(entry.note !== undefined ? { note: entry.note } : {}),
        },
    ];
    const { contentHash: _drop, ...rest } = { ...env, provenance };
    void _drop;
    return { ...rest, contentHash: computeHash(rest) };
}
/**
 * Combine two envelopes from the same from/to pair.
 * - text: a + '\n' + b
 * - structured: shallow merge with one-level deep-merge for plain objects
 * - provenance: a then b, renumbered sequentially
 * - createdAt: fresh ISO timestamp; contentHash: recomputed
 */
export function merge(a, b) {
    if (a.from !== b.from || a.to !== b.to) {
        throw new Error('latent-state: cannot merge envelopes with different from/to');
    }
    const text = mergeText(a.text, b.text);
    const structured = mergeStructured(a.structured, b.structured);
    const kind = classify(text, structured);
    const provenance = [...a.provenance, ...b.provenance].map((p, i) => ({ ...p, step: i + 1 }));
    const body = {
        version: 1,
        from: a.from,
        to: a.to,
        kind,
        ...(text !== undefined ? { text } : {}),
        ...(structured !== undefined ? { structured } : {}),
        provenance,
        createdAt: new Date().toISOString(),
    };
    return { ...body, contentHash: computeHash(body) };
}
function mergeText(a, b) {
    if (a === undefined && b === undefined)
        return undefined;
    if (a === undefined)
        return b;
    if (b === undefined)
        return a;
    return `${a}\n${b}`;
}
function mergeStructured(a, b) {
    if (!a && !b)
        return undefined;
    if (!a)
        return { ...b };
    if (!b)
        return { ...a };
    const out = { ...a };
    for (const k of Object.keys(b)) {
        const av = a[k], bv = b[k];
        if (av && bv &&
            typeof av === 'object' && typeof bv === 'object' &&
            !Array.isArray(av) && !Array.isArray(bv)) {
            out[k] = { ...av, ...bv };
        }
        else {
            out[k] = bv;
        }
    }
    return out;
}
//# sourceMappingURL=envelope.js.map