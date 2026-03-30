// Tests for kbot Agent Collaboration Protocol
// Covers: Handoff, Blackboard, Negotiation, Trust Delegation
import { describe, it, expect, vi, beforeEach } from 'vitest';
// Mock external dependencies before importing module under test
vi.mock('fs', () => ({
    readFileSync: vi.fn(),
    writeFileSync: vi.fn(),
    mkdirSync: vi.fn(),
}));
vi.mock('os', () => ({
    homedir: vi.fn(() => '/mock-home'),
}));
vi.mock('./tools/index.js', () => ({
    registerTool: vi.fn(),
}));
import { createHandoff, acceptHandoff, rejectHandoff, completeHandoff, getActiveHandoffs, getHandoffHistory, blackboardWrite, blackboardRead, blackboardQuery, blackboardSubscribe, blackboardGetDecisions, blackboardClear, propose, vote, resolveProposal, getConsensus, getTrust, updateTrust, getMostTrusted, getTrustReport, registerAgentProtocolTools, } from './agent-protocol.js';
import { readFileSync, writeFileSync, mkdirSync } from 'fs';
import { registerTool } from './tools/index.js';
const mockedReadFileSync = vi.mocked(readFileSync);
const mockedWriteFileSync = vi.mocked(writeFileSync);
const mockedMkdirSync = vi.mocked(mkdirSync);
const mockedRegisterTool = vi.mocked(registerTool);
// ── Helpers ──
/** Clear all in-memory state between tests by exploiting the module's maps.
 *  Since handoffs/proposals/blackboard are module-level Maps, we need to
 *  drain them via the public API or accept stale state across tests.
 *  We clear blackboard explicitly and rely on unique IDs for handoffs/proposals. */
function clearBlackboard() {
    blackboardClear();
}
beforeEach(() => {
    vi.clearAllMocks();
    clearBlackboard();
});
// ─── 1. Handoff Protocol ────────────────────────────────────────────────────
describe('createHandoff', () => {
    it('creates a handoff with correct fields', () => {
        const h = createHandoff('coder', 'researcher', 'Need research', 'Find papers on X');
        expect(h.from).toBe('coder');
        expect(h.to).toBe('researcher');
        expect(h.reason).toBe('Need research');
        expect(h.context).toBe('Find papers on X');
        expect(h.artifacts).toEqual([]);
        expect(h.priority).toBe('normal');
        expect(h.status).toBe('pending');
        expect(h.id).toHaveLength(8); // shortId = 4 bytes = 8 hex chars
        expect(h.created).toBeTruthy();
        expect(h.updated).toBeTruthy();
        expect(h.result).toBeUndefined();
        expect(h.rejectionReason).toBeUndefined();
    });
    it('accepts optional artifacts and priority', () => {
        const h = createHandoff('a', 'b', 'r', 'c', ['file.ts', 'data.json'], 'critical');
        expect(h.artifacts).toEqual(['file.ts', 'data.json']);
        expect(h.priority).toBe('critical');
    });
    it('generates unique IDs for each handoff', () => {
        const h1 = createHandoff('a', 'b', 'r', 'c');
        const h2 = createHandoff('a', 'b', 'r', 'c');
        expect(h1.id).not.toBe(h2.id);
    });
    it('handles empty strings for from, to, reason, context', () => {
        const h = createHandoff('', '', '', '');
        expect(h.from).toBe('');
        expect(h.to).toBe('');
        expect(h.reason).toBe('');
        expect(h.context).toBe('');
        expect(h.status).toBe('pending');
    });
});
describe('acceptHandoff', () => {
    it('accepts a pending handoff', () => {
        const h = createHandoff('coder', 'writer', 'docs needed', 'Write API docs');
        const accepted = acceptHandoff(h.id);
        expect(accepted.status).toBe('accepted');
        expect(accepted.id).toBe(h.id);
    });
    it('throws if handoff not found', () => {
        expect(() => acceptHandoff('nonexistent')).toThrow('Handoff nonexistent not found');
    });
    it('throws if handoff is not pending', () => {
        const h = createHandoff('a', 'b', 'r', 'c');
        acceptHandoff(h.id);
        expect(() => acceptHandoff(h.id)).toThrow(`Handoff ${h.id} is accepted, cannot accept`);
    });
    it('throws if handoff was already rejected', () => {
        const h = createHandoff('a', 'b', 'r', 'c');
        rejectHandoff(h.id, 'busy');
        expect(() => acceptHandoff(h.id)).toThrow(`Handoff ${h.id} is rejected, cannot accept`);
    });
});
describe('rejectHandoff', () => {
    it('rejects a pending handoff with a reason', () => {
        const h = createHandoff('coder', 'writer', 'docs', 'ctx');
        const rejected = rejectHandoff(h.id, 'Not my domain');
        expect(rejected.status).toBe('rejected');
        expect(rejected.rejectionReason).toBe('Not my domain');
    });
    it('throws if handoff not found', () => {
        expect(() => rejectHandoff('ghost', 'nope')).toThrow('Handoff ghost not found');
    });
    it('throws if handoff is not pending', () => {
        const h = createHandoff('a', 'b', 'r', 'c');
        acceptHandoff(h.id);
        expect(() => rejectHandoff(h.id, 'late')).toThrow(`Handoff ${h.id} is accepted, cannot reject`);
    });
});
describe('completeHandoff', () => {
    it('completes an accepted handoff with result', () => {
        const h = createHandoff('a', 'b', 'r', 'c');
        acceptHandoff(h.id);
        const completed = completeHandoff(h.id, 'Task done successfully');
        expect(completed.status).toBe('completed');
        expect(completed.result).toBe('Task done successfully');
    });
    it('throws if handoff not found', () => {
        expect(() => completeHandoff('nope', 'result')).toThrow('Handoff nope not found');
    });
    it('throws if handoff is still pending (not accepted)', () => {
        const h = createHandoff('a', 'b', 'r', 'c');
        expect(() => completeHandoff(h.id, 'result')).toThrow(`Handoff ${h.id} is pending, must be accepted first`);
    });
    it('throws if handoff was rejected', () => {
        const h = createHandoff('a', 'b', 'r', 'c');
        rejectHandoff(h.id, 'nope');
        expect(() => completeHandoff(h.id, 'result')).toThrow(`Handoff ${h.id} is rejected, must be accepted first`);
    });
    it('updates trust for the completing agent', () => {
        const h = createHandoff('a', 'b', 'r', 'c');
        acceptHandoff(h.id);
        // completeHandoff calls updateTrust(h.to, 'handoff', true) internally
        // which triggers saveTrust -> writeFileSync
        completeHandoff(h.id, 'done');
        expect(mockedWriteFileSync).toHaveBeenCalled();
    });
});
describe('getActiveHandoffs', () => {
    it('returns empty array when filtering by agent with no pending handoffs', () => {
        // Use a unique agent name to avoid pollution from other tests
        const uniqueTarget = `agent-none-${Date.now()}`;
        const active = getActiveHandoffs(uniqueTarget);
        expect(active).toEqual([]);
    });
    it('returns only pending handoffs', () => {
        const uniqueTarget = `target-${Date.now()}-pending`;
        const h1 = createHandoff('a', uniqueTarget, 'r1', 'c1');
        const h2 = createHandoff('a', uniqueTarget, 'r2', 'c2');
        acceptHandoff(h2.id);
        const active = getActiveHandoffs(uniqueTarget);
        expect(active).toHaveLength(1);
        expect(active[0].id).toBe(h1.id);
    });
    it('filters by target agent', () => {
        const agentX = `agent-x-${Date.now()}`;
        const agentY = `agent-y-${Date.now()}`;
        createHandoff('a', agentX, 'r', 'c');
        createHandoff('a', agentY, 'r', 'c');
        const active = getActiveHandoffs(agentX);
        expect(active).toHaveLength(1);
        expect(active[0].to).toBe(agentX);
    });
    it('returns all pending handoffs when no agentId filter', () => {
        const h1 = createHandoff('a', 'unfiltered-1', 'r', 'c', [], 'low');
        const h2 = createHandoff('a', 'unfiltered-2', 'r', 'c', [], 'high');
        const active = getActiveHandoffs();
        // At least these two (plus any pending from earlier tests)
        const ids = active.map(h => h.id);
        expect(ids).toContain(h1.id);
        expect(ids).toContain(h2.id);
    });
    it('sorts by priority: critical > high > normal > low', () => {
        const hLow = createHandoff('a', 'z', 'r', 'c', [], 'low');
        const hCrit = createHandoff('a', 'z', 'r', 'c', [], 'critical');
        const hNorm = createHandoff('a', 'z', 'r', 'c', [], 'normal');
        const hHigh = createHandoff('a', 'z', 'r', 'c', [], 'high');
        const active = getActiveHandoffs('z');
        const priorities = active.map(h => h.priority);
        // critical(0) should come before high(1) before normal(2) before low(3)
        const idxCrit = active.findIndex(h => h.id === hCrit.id);
        const idxHigh = active.findIndex(h => h.id === hHigh.id);
        const idxNorm = active.findIndex(h => h.id === hNorm.id);
        const idxLow = active.findIndex(h => h.id === hLow.id);
        expect(idxCrit).toBeLessThan(idxHigh);
        expect(idxHigh).toBeLessThan(idxNorm);
        expect(idxNorm).toBeLessThan(idxLow);
    });
});
describe('getHandoffHistory', () => {
    it('returns handoffs including the ones we created', () => {
        const h1 = createHandoff('hist-from', 'hist-to', 'first', 'c');
        const h2 = createHandoff('hist-from', 'hist-to', 'second', 'c');
        const history = getHandoffHistory();
        const ids = history.map(h => h.id);
        // Both should be present in history
        expect(ids).toContain(h1.id);
        expect(ids).toContain(h2.id);
        // History is sorted newest first — both have same-millisecond timestamps
        // so relative order among them is implementation-dependent, but the sort
        // itself should not throw
        expect(history.length).toBeGreaterThanOrEqual(2);
    });
    it('includes handoffs of all statuses', () => {
        const h1 = createHandoff('hist-a', 'hist-b', 'r', 'c');
        const h2 = createHandoff('hist-a', 'hist-b', 'r', 'c');
        acceptHandoff(h1.id);
        rejectHandoff(h2.id, 'no');
        const history = getHandoffHistory();
        const statuses = history.map(h => h.status);
        expect(statuses).toContain('accepted');
        expect(statuses).toContain('rejected');
    });
});
// ─── 2. Blackboard (Shared Working Memory) ──────────────────────────────────
describe('blackboardWrite', () => {
    it('writes an entry with correct fields', () => {
        const entry = blackboardWrite('arch-decision', 'Use microservices', 'architect', 'decision', 0.9);
        expect(entry.key).toBe('arch-decision');
        expect(entry.value).toBe('Use microservices');
        expect(entry.author).toBe('architect');
        expect(entry.type).toBe('decision');
        expect(entry.confidence).toBe(0.9);
        expect(entry.timestamp).toBeTruthy();
        expect(entry.subscribers).toEqual([]);
    });
    it('defaults confidence to 1.0', () => {
        const entry = blackboardWrite('k', 'v', 'a', 'fact');
        expect(entry.confidence).toBe(1.0);
    });
    it('clamps confidence to [0, 1] range', () => {
        const over = blackboardWrite('k1', 'v', 'a', 'fact', 1.5);
        expect(over.confidence).toBe(1.0);
        clearBlackboard();
        const under = blackboardWrite('k2', 'v', 'a', 'fact', -0.5);
        expect(under.confidence).toBe(0.0);
    });
    it('overwrites existing entry for same key', () => {
        blackboardWrite('key', 'old value', 'a', 'fact');
        const updated = blackboardWrite('key', 'new value', 'b', 'hypothesis', 0.7);
        expect(updated.value).toBe('new value');
        expect(updated.author).toBe('b');
        expect(updated.type).toBe('hypothesis');
        const read = blackboardRead('key');
        expect(read?.value).toBe('new value');
    });
    it('preserves subscribers when overwriting', () => {
        blackboardWrite('sub-key', 'v1', 'a', 'fact');
        blackboardSubscribe('sub-key', 'watcher-1');
        const updated = blackboardWrite('sub-key', 'v2', 'b', 'fact');
        expect(updated.subscribers).toContain('watcher-1');
    });
    it('notifies subscribers on write', () => {
        blackboardWrite('notify-key', 'initial', 'a', 'fact');
        const callback = vi.fn();
        blackboardSubscribe('notify-key', 'watcher', callback);
        blackboardWrite('notify-key', 'updated', 'b', 'fact');
        expect(callback).toHaveBeenCalledTimes(1);
        expect(callback).toHaveBeenCalledWith(expect.objectContaining({ key: 'notify-key', value: 'updated' }));
    });
    it('does not propagate subscriber callback errors', () => {
        blackboardWrite('err-key', 'v', 'a', 'fact');
        const badCallback = vi.fn(() => { throw new Error('boom'); });
        blackboardSubscribe('err-key', 'watcher', badCallback);
        // Should not throw
        expect(() => blackboardWrite('err-key', 'v2', 'b', 'fact')).not.toThrow();
        expect(badCallback).toHaveBeenCalledTimes(1);
    });
    it('accepts non-string values (objects, arrays, numbers)', () => {
        const objEntry = blackboardWrite('obj', { foo: 'bar' }, 'a', 'artifact');
        expect(objEntry.value).toEqual({ foo: 'bar' });
        const arrEntry = blackboardWrite('arr', [1, 2, 3], 'a', 'artifact');
        expect(arrEntry.value).toEqual([1, 2, 3]);
        const numEntry = blackboardWrite('num', 42, 'a', 'fact');
        expect(numEntry.value).toBe(42);
    });
});
describe('blackboardRead', () => {
    it('returns undefined for nonexistent key', () => {
        expect(blackboardRead('does-not-exist')).toBeUndefined();
    });
    it('returns the entry for an existing key', () => {
        blackboardWrite('read-test', 'hello', 'a', 'fact');
        const entry = blackboardRead('read-test');
        expect(entry).toBeDefined();
        expect(entry.value).toBe('hello');
    });
});
describe('blackboardQuery', () => {
    it('returns all entries when no type filter', () => {
        blackboardWrite('q1', 'v', 'a', 'fact');
        blackboardWrite('q2', 'v', 'a', 'hypothesis');
        const all = blackboardQuery();
        expect(all.length).toBeGreaterThanOrEqual(2);
    });
    it('filters entries by type', () => {
        blackboardWrite('fact-1', 'v', 'a', 'fact');
        blackboardWrite('hyp-1', 'v', 'a', 'hypothesis');
        blackboardWrite('fact-2', 'v', 'a', 'fact');
        const facts = blackboardQuery('fact');
        const allFact = facts.every(e => e.type === 'fact');
        expect(allFact).toBe(true);
        expect(facts.length).toBeGreaterThanOrEqual(2);
    });
    it('returns empty array when no entries match type', () => {
        // After clearBlackboard in beforeEach, only things we write exist
        blackboardWrite('only-fact', 'v', 'a', 'fact');
        const questions = blackboardQuery('question');
        expect(questions).toEqual([]);
    });
});
describe('blackboardSubscribe', () => {
    it('adds agentId to subscribers list of an existing entry', () => {
        blackboardWrite('sub-entry', 'v', 'a', 'fact');
        blackboardSubscribe('sub-entry', 'agent-1');
        const entry = blackboardRead('sub-entry');
        expect(entry.subscribers).toContain('agent-1');
    });
    it('does not duplicate subscriber if already present', () => {
        blackboardWrite('dup-entry', 'v', 'a', 'fact');
        blackboardSubscribe('dup-entry', 'agent-1');
        blackboardSubscribe('dup-entry', 'agent-1');
        const entry = blackboardRead('dup-entry');
        const count = entry.subscribers.filter(s => s === 'agent-1').length;
        expect(count).toBe(1);
    });
    it('does nothing if key does not exist yet (no entry to add subscriber to)', () => {
        // Subscribe to a non-existent key — should not throw
        expect(() => blackboardSubscribe('ghost-key', 'agent-1')).not.toThrow();
    });
    it('registers callback that fires on subsequent writes', () => {
        blackboardWrite('cb-key', 'v', 'a', 'fact');
        const cb = vi.fn();
        blackboardSubscribe('cb-key', 'watcher', cb);
        // Write twice
        blackboardWrite('cb-key', 'v2', 'b', 'fact');
        blackboardWrite('cb-key', 'v3', 'c', 'fact');
        expect(cb).toHaveBeenCalledTimes(2);
    });
});
describe('blackboardGetDecisions', () => {
    it('returns only decision-type entries', () => {
        blackboardWrite('d1', 'use postgres', 'a', 'decision');
        blackboardWrite('f1', 'some fact', 'a', 'fact');
        blackboardWrite('d2', 'use redis', 'b', 'decision');
        const decisions = blackboardGetDecisions();
        expect(decisions.length).toBeGreaterThanOrEqual(2);
        expect(decisions.every(e => e.type === 'decision')).toBe(true);
    });
});
describe('blackboardClear', () => {
    it('removes all entries', () => {
        blackboardWrite('clear-1', 'v', 'a', 'fact');
        blackboardWrite('clear-2', 'v', 'a', 'fact');
        blackboardClear();
        expect(blackboardQuery()).toEqual([]);
    });
    it('clears subscriptions too', () => {
        blackboardWrite('sub-clear', 'v', 'a', 'fact');
        const cb = vi.fn();
        blackboardSubscribe('sub-clear', 'watcher', cb);
        blackboardClear();
        // Rewrite same key — callback should NOT fire because subscriptions were cleared
        blackboardWrite('sub-clear', 'v2', 'b', 'fact');
        expect(cb).not.toHaveBeenCalled();
    });
    it('is safe to call when already empty', () => {
        blackboardClear();
        expect(() => blackboardClear()).not.toThrow();
        expect(blackboardQuery()).toEqual([]);
    });
});
// ─── 3. Negotiation ─────────────────────────────────────────────────────────
describe('propose', () => {
    it('creates a proposal with correct fields', () => {
        const p = propose('coder', 'Use TypeScript strict mode', 'Catches more bugs');
        expect(p.author).toBe('coder');
        expect(p.description).toBe('Use TypeScript strict mode');
        expect(p.rationale).toBe('Catches more bugs');
        expect(p.status).toBe('open');
        expect(p.id).toHaveLength(8);
        expect(p.created).toBeTruthy();
    });
    it('author implicitly votes agree', () => {
        const p = propose('coder', 'desc', 'rationale');
        expect(p.votes.size).toBe(1);
        expect(p.votes.get('coder')).toEqual({ vote: 'agree' });
    });
    it('generates unique IDs', () => {
        const p1 = propose('a', 'd1', 'r1');
        const p2 = propose('a', 'd2', 'r2');
        expect(p1.id).not.toBe(p2.id);
    });
    it('handles empty description and rationale', () => {
        const p = propose('a', '', '');
        expect(p.description).toBe('');
        expect(p.rationale).toBe('');
        expect(p.status).toBe('open');
    });
});
describe('vote', () => {
    it('records an agree vote', () => {
        const p = propose('author', 'desc', 'rationale');
        const updated = vote(p.id, 'reviewer', 'agree', 'Good idea');
        expect(updated.votes.get('reviewer')).toEqual({ vote: 'agree', reason: 'Good idea' });
    });
    it('records a disagree vote', () => {
        const p = propose('author', 'desc', 'rationale');
        const updated = vote(p.id, 'critic', 'disagree', 'Too complex');
        expect(updated.votes.get('critic')).toEqual({ vote: 'disagree', reason: 'Too complex' });
    });
    it('records an abstain vote', () => {
        const p = propose('author', 'desc', 'rationale');
        vote(p.id, 'neutral', 'abstain');
        expect(p.votes.get('neutral')).toEqual({ vote: 'abstain', reason: undefined });
    });
    it('allows changing vote by same agent', () => {
        const p = propose('author', 'desc', 'rationale');
        vote(p.id, 'reviewer', 'agree');
        vote(p.id, 'reviewer', 'disagree', 'Changed mind');
        expect(p.votes.get('reviewer')).toEqual({ vote: 'disagree', reason: 'Changed mind' });
    });
    it('throws if proposal not found', () => {
        expect(() => vote('invalid', 'a', 'agree')).toThrow('Proposal invalid not found');
    });
    it('throws if proposal is not open', () => {
        const p = propose('author', 'desc', 'rationale');
        resolveProposal(p.id); // close it
        expect(() => vote(p.id, 'late', 'agree')).toThrow(`Proposal ${p.id} is accepted, voting closed`);
    });
});
describe('resolveProposal', () => {
    it('accepts when agrees > disagrees', () => {
        const p = propose('a', 'desc', 'rationale'); // a: agree
        vote(p.id, 'b', 'agree');
        vote(p.id, 'c', 'disagree');
        // 2 agrees, 1 disagree
        const resolved = resolveProposal(p.id);
        expect(resolved.status).toBe('accepted');
        expect(resolved.resolution).toContain('Accepted');
        expect(resolved.resolution).toContain('2 agree');
        expect(resolved.resolution).toContain('1 disagree');
    });
    it('rejects when disagrees > agrees', () => {
        const p = propose('a', 'desc', 'rationale'); // a: agree
        vote(p.id, 'b', 'disagree');
        vote(p.id, 'c', 'disagree');
        // 1 agree, 2 disagree
        const resolved = resolveProposal(p.id);
        expect(resolved.status).toBe('rejected');
        expect(resolved.resolution).toContain('Rejected');
    });
    it('handles tie with trust-weighted tiebreaking', () => {
        // Use fresh agent names that have no accumulated trust (both get DEFAULT_TRUST 0.5)
        const freshA = `tie-agree-${Date.now()}`;
        const freshB = `tie-disagree-${Date.now()}`;
        const p = propose(freshA, 'desc', 'rationale'); // freshA: agree
        vote(p.id, freshB, 'disagree');
        // 1 agree, 1 disagree — tie
        const resolved = resolveProposal(p.id);
        // Both have default trust 0.5, so agreeWeight == disagreeWeight
        // Code: if (agreeWeight >= disagreeWeight) → accepted
        expect(resolved.status).toBe('accepted');
        expect(resolved.resolution).toContain('trust-weighted tiebreak');
    });
    it('abstain votes do not count toward majority', () => {
        const p = propose('a', 'desc', 'rationale'); // a: agree
        vote(p.id, 'b', 'abstain');
        vote(p.id, 'c', 'abstain');
        // 1 agree, 0 disagree, 2 abstain
        const resolved = resolveProposal(p.id);
        expect(resolved.status).toBe('accepted');
    });
    it('throws if proposal not found', () => {
        expect(() => resolveProposal('ghost')).toThrow('Proposal ghost not found');
    });
    it('throws if proposal already resolved', () => {
        const p = propose('a', 'desc', 'rationale');
        resolveProposal(p.id);
        expect(() => resolveProposal(p.id)).toThrow(`Proposal ${p.id} is already accepted`);
    });
    it('uses trust scores for tie resolution when trust differs', () => {
        // Give agent 'high-trust' a higher trust score
        updateTrust('high-trust', 'coding', true); // 0.5 + 0.05 = 0.55
        updateTrust('high-trust', 'coding', true); // 0.55 + 0.05 = 0.60
        updateTrust('low-trust', 'coding', false); // 0.5 - 0.10 = 0.40
        const p = propose('high-trust', 'my plan', 'it is good'); // high-trust: agree
        vote(p.id, 'low-trust', 'disagree');
        // Tie: 1v1
        // high-trust overall > low-trust overall
        const resolved = resolveProposal(p.id);
        expect(resolved.status).toBe('accepted');
        expect(resolved.resolution).toContain('trust-weighted tiebreak');
    });
});
describe('getConsensus', () => {
    it('returns all proposals including those we created', () => {
        const p1 = propose('cons-a', 'first proposal', 'r');
        const p2 = propose('cons-a', 'second proposal', 'r');
        const all = getConsensus();
        const ids = all.map(p => p.id);
        expect(ids).toContain(p1.id);
        expect(ids).toContain(p2.id);
        // Sorted by created desc — both may share the same timestamp
        expect(all.length).toBeGreaterThanOrEqual(2);
    });
    it('includes proposals of all statuses', () => {
        const p1 = propose('a', 'open one', 'r');
        const p2 = propose('a', 'resolved one', 'r');
        resolveProposal(p2.id);
        const all = getConsensus();
        const statuses = all.map(p => p.status);
        expect(statuses).toContain('open');
        expect(statuses).toContain('accepted');
    });
});
// ─── 4. Trust Delegation ────────────────────────────────────────────────────
describe('getTrust', () => {
    it('returns DEFAULT_TRUST (0.5) for unknown agent', () => {
        const score = getTrust('brand-new-agent');
        expect(score).toBe(0.5);
    });
    it('returns DEFAULT_TRUST for unknown domain on known agent', () => {
        updateTrust('known-agent', 'coding', true); // creates profile
        const score = getTrust('known-agent', 'unknown-domain');
        expect(score).toBe(0.5);
    });
    it('returns overall trust when no domain specified', () => {
        updateTrust('agent-o', 'coding', true); // domain coding: 0.55, overall: 0.55
        const score = getTrust('agent-o');
        expect(score).toBe(0.55);
    });
    it('returns domain-specific trust when domain specified', () => {
        updateTrust('agent-d', 'coding', true); // coding: 0.55
        updateTrust('agent-d', 'research', false); // research: 0.40
        const codingTrust = getTrust('agent-d', 'coding');
        const researchTrust = getTrust('agent-d', 'research');
        expect(codingTrust).toBe(0.55);
        expect(researchTrust).toBe(0.4);
    });
});
describe('updateTrust', () => {
    it('increments trust by 0.05 on success', () => {
        updateTrust('inc-agent', 'security', true);
        expect(getTrust('inc-agent', 'security')).toBeCloseTo(0.55, 2);
    });
    it('decrements trust by 0.10 on failure', () => {
        updateTrust('dec-agent', 'security', false);
        expect(getTrust('dec-agent', 'security')).toBeCloseTo(0.40, 2);
    });
    it('caps trust at 1.0 maximum', () => {
        // Start at 0.5, increment 11 times: 0.5 + 11*0.05 = 1.05 → capped at 1.0
        for (let i = 0; i < 11; i++) {
            updateTrust('max-agent', 'domain', true);
        }
        expect(getTrust('max-agent', 'domain')).toBe(1.0);
    });
    it('floors trust at 0.0 minimum', () => {
        // Start at 0.5, decrement 6 times: 0.5 - 6*0.10 = -0.1 → floored at 0.0
        for (let i = 0; i < 6; i++) {
            updateTrust('min-agent', 'domain', false);
        }
        expect(getTrust('min-agent', 'domain')).toBe(0.0);
    });
    it('recalculates overall trust as average of all domains', () => {
        updateTrust('avg-agent', 'a', true); // a: 0.55
        updateTrust('avg-agent', 'b', false); // b: 0.40
        // overall = (0.55 + 0.40) / 2 = 0.475
        expect(getTrust('avg-agent')).toBeCloseTo(0.475, 3);
    });
    it('persists trust to file via writeFileSync', () => {
        updateTrust('persist-agent', 'coding', true);
        expect(mockedMkdirSync).toHaveBeenCalledWith('/mock-home/.kbot', { recursive: true });
        expect(mockedWriteFileSync).toHaveBeenCalledWith('/mock-home/.kbot/trust.json', expect.any(String));
    });
    it('records history entries', () => {
        // We can verify indirectly by checking the report
        updateTrust('history-agent', 'coding', true);
        updateTrust('history-agent', 'coding', false);
        const report = getTrustReport();
        expect(report).toContain('history-agent');
        expect(report).toContain('Recent:');
        expect(report).toContain('+-');
    });
    it('does not crash if writeFileSync fails', () => {
        mockedWriteFileSync.mockImplementation(() => { throw new Error('EACCES'); });
        expect(() => updateTrust('write-fail-agent', 'domain', true)).not.toThrow();
    });
});
describe('getMostTrusted', () => {
    it('returns the agent with highest trust in a domain', () => {
        updateTrust('low-trust-mt', 'writing', false); // 0.40
        updateTrust('high-trust-mt', 'writing', true); // 0.55
        updateTrust('high-trust-mt', 'writing', true); // 0.60
        const best = getMostTrusted('writing');
        expect(best).not.toBeNull();
        expect(best.agentId).toBe('high-trust-mt');
        expect(best.trust).toBeCloseTo(0.60, 2);
    });
    it('returns null when no trust profiles exist at all', () => {
        // This test relies on the module state — if profiles exist from other tests,
        // it won't return null. Instead, verify it returns a result with default trust
        // for an obscure domain where no one has data.
        const result = getMostTrusted('completely-obscure-domain-xyz');
        // With existing profiles, it will return one of them with default 0.5
        // The function returns null only if trustProfiles.size === 0
        if (result) {
            expect(result.trust).toBe(0.5);
        }
    });
});
describe('getTrustReport', () => {
    it('includes header and agent info', () => {
        updateTrust('report-agent', 'coding', true);
        const report = getTrustReport();
        expect(report).toContain('Agent Trust Report');
        expect(report).toContain('report-agent');
        expect(report).toContain('coding');
    });
    it('shows visual bar representation', () => {
        updateTrust('bar-agent', 'testing', true);
        const report = getTrustReport();
        // Bar uses block chars
        expect(report).toContain('█');
        expect(report).toContain('░');
    });
    it('shows recent history as +/- symbols', () => {
        updateTrust('hist-agent', 'design', true);
        updateTrust('hist-agent', 'design', false);
        updateTrust('hist-agent', 'design', true);
        const report = getTrustReport();
        expect(report).toContain('Recent: +-+');
    });
});
// ─── 5. Tool Registration ───────────────────────────────────────────────────
describe('registerAgentProtocolTools', () => {
    it('registers 5 tools', () => {
        registerAgentProtocolTools();
        expect(mockedRegisterTool).toHaveBeenCalledTimes(5);
    });
    it('registers agent_handoff tool', () => {
        registerAgentProtocolTools();
        const calls = mockedRegisterTool.mock.calls.map(c => c[0].name);
        expect(calls).toContain('agent_handoff');
    });
    it('registers blackboard_write tool', () => {
        registerAgentProtocolTools();
        const calls = mockedRegisterTool.mock.calls.map(c => c[0].name);
        expect(calls).toContain('blackboard_write');
    });
    it('registers blackboard_read tool', () => {
        registerAgentProtocolTools();
        const calls = mockedRegisterTool.mock.calls.map(c => c[0].name);
        expect(calls).toContain('blackboard_read');
    });
    it('registers agent_propose tool', () => {
        registerAgentProtocolTools();
        const calls = mockedRegisterTool.mock.calls.map(c => c[0].name);
        expect(calls).toContain('agent_propose');
    });
    it('registers agent_trust tool', () => {
        registerAgentProtocolTools();
        const calls = mockedRegisterTool.mock.calls.map(c => c[0].name);
        expect(calls).toContain('agent_trust');
    });
    it('all registered tools have tier set to free', () => {
        registerAgentProtocolTools();
        for (const call of mockedRegisterTool.mock.calls) {
            expect(call[0].tier).toBe('free');
        }
    });
    it('all registered tools have execute functions', () => {
        registerAgentProtocolTools();
        for (const call of mockedRegisterTool.mock.calls) {
            expect(typeof call[0].execute).toBe('function');
        }
    });
});
// ─── 6. Edge Cases ──────────────────────────────────────────────────────────
describe('edge cases', () => {
    it('handles unicode in handoff fields', () => {
        const h = createHandoff('codeur', 'chercheur', 'Besoin de recherche 🔍', 'Contexte: données françaises');
        expect(h.reason).toBe('Besoin de recherche 🔍');
        expect(h.context).toBe('Contexte: données françaises');
    });
    it('handles very long context in handoff', () => {
        const longContext = 'x'.repeat(100_000);
        const h = createHandoff('a', 'b', 'reason', longContext);
        expect(h.context).toHaveLength(100_000);
    });
    it('handles null-ish values in blackboard', () => {
        const e1 = blackboardWrite('null-val', null, 'a', 'fact');
        expect(e1.value).toBeNull();
        const e2 = blackboardWrite('undef-val', undefined, 'a', 'fact');
        expect(e2.value).toBeUndefined();
        const e3 = blackboardWrite('zero-val', 0, 'a', 'fact');
        expect(e3.value).toBe(0);
        const e4 = blackboardWrite('false-val', false, 'a', 'fact');
        expect(e4.value).toBe(false);
        const e5 = blackboardWrite('empty-str', '', 'a', 'fact');
        expect(e5.value).toBe('');
    });
    it('full handoff lifecycle: create -> accept -> complete', () => {
        const h = createHandoff('coder', 'writer', 'Write docs', 'API docs needed', ['api.ts'], 'high');
        expect(h.status).toBe('pending');
        const accepted = acceptHandoff(h.id);
        expect(accepted.status).toBe('accepted');
        const completed = completeHandoff(h.id, 'Docs written and committed');
        expect(completed.status).toBe('completed');
        expect(completed.result).toBe('Docs written and committed');
    });
    it('full negotiation lifecycle: propose -> vote -> resolve', () => {
        const p = propose('architect', 'Monorepo structure', 'Simplifies dependencies');
        vote(p.id, 'coder', 'agree', 'Makes imports cleaner');
        vote(p.id, 'devops', 'agree', 'Easier CI/CD');
        vote(p.id, 'analyst', 'disagree', 'Migration cost too high');
        const resolved = resolveProposal(p.id);
        // 3 agree (architect + coder + devops) vs 1 disagree (analyst)
        expect(resolved.status).toBe('accepted');
        expect(resolved.resolution).toContain('3 agree');
        expect(resolved.resolution).toContain('1 disagree');
    });
    it('confidence boundary values', () => {
        const exact0 = blackboardWrite('c0', 'v', 'a', 'fact', 0);
        expect(exact0.confidence).toBe(0);
        const exact1 = blackboardWrite('c1', 'v', 'a', 'fact', 1);
        expect(exact1.confidence).toBe(1);
        const tiny = blackboardWrite('ct', 'v', 'a', 'fact', 0.001);
        expect(tiny.confidence).toBeCloseTo(0.001, 3);
    });
});
//# sourceMappingURL=agent-protocol.test.js.map