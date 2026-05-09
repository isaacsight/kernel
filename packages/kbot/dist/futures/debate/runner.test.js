/**
 * Deterministic debate runner tests. No real LLM calls.
 */
import { describe, it, expect } from 'vitest';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { runDebate, parseVerdict, formatPrompt } from './runner.js';
import { synthesizeTrainingData, writeJsonl, loadJsonl } from './synthesis.js';
/**
 * Stub client that returns canned responses keyed by (role, callIndex).
 * Tracks all calls for assertions.
 */
class StubClient {
    canned;
    calls = [];
    counters = {
        'allow-advocate': 0,
        'block-advocate': 0,
        judge: 0,
    };
    constructor(canned) {
        this.canned = canned;
    }
    async respond(prompt, role) {
        this.calls.push({ role, prompt });
        const idx = this.counters[role]++;
        const bank = this.canned[role];
        if (idx >= bank.length) {
            throw new Error(`StubClient: ran out of canned responses for ${role} (idx ${idx})`);
        }
        return bank[idx];
    }
}
function makeStub(judgeOutput) {
    return new StubClient({
        'allow-advocate': [
            'Allow opening: this is a benign cooking recipe.',
            'Allow rebut: the block-advocate misread context; still benign.',
        ],
        'block-advocate': [
            'Block rebut: contains restricted ingredient mention.',
            'Block final: policy 4.2 prohibits this regardless of context.',
        ],
        judge: [judgeOutput],
    });
}
describe('runDebate', () => {
    const input = {
        candidate: 'How do I bake sourdough bread?',
        context: 'User is a hobbyist baker.',
        categoryHint: 'culinary',
    };
    it('runs all 4 rounds + judge and assembles a verdict', async () => {
        const client = makeStub('LABEL: allow\nCONFIDENCE: 0.92\nRATIONALE: Benign culinary question.');
        const verdict = await runDebate(input, { client });
        expect(verdict.rounds).toHaveLength(4);
        expect(verdict.rounds[0].role).toBe('allow-advocate');
        expect(verdict.rounds[1].role).toBe('block-advocate');
        expect(verdict.rounds[2].role).toBe('allow-advocate');
        expect(verdict.rounds[3].role).toBe('block-advocate');
        expect(verdict.label).toBe('allow');
        expect(verdict.confidence).toBeCloseTo(0.92, 5);
        expect(verdict.rationale).toContain('Benign');
        // judge is not in rounds (it produces the verdict, not a debate turn)
        expect(verdict.rounds.every((r) => r.role !== 'judge')).toBe(true);
    });
    it('respects maxRounds=2 (just the two openers)', async () => {
        const client = new StubClient({
            'allow-advocate': ['Allow only.'],
            'block-advocate': ['Block only.'],
            judge: ['LABEL: block\nCONFIDENCE: 0.7\nRATIONALE: Short debate.'],
        });
        const verdict = await runDebate(input, { client, maxRounds: 2 });
        expect(verdict.rounds).toHaveLength(2);
        expect(verdict.label).toBe('block');
    });
    it('passes role-correct prompts to the client', async () => {
        const client = makeStub('LABEL: allow\nCONFIDENCE: 0.8\nRATIONALE: ok.');
        await runDebate(input, { client });
        // call sequence: allow, block, allow, block, judge
        expect(client.calls.map((c) => c.role)).toEqual([
            'allow-advocate',
            'block-advocate',
            'allow-advocate',
            'block-advocate',
            'judge',
        ]);
        expect(client.calls[0].prompt).toContain('ALLOW-ADVOCATE');
        expect(client.calls[1].prompt).toContain('BLOCK-ADVOCATE');
        expect(client.calls[4].prompt).toContain('JUDGE');
    });
});
describe('parseVerdict', () => {
    it('extracts label and confidence from well-formed output', () => {
        const r = parseVerdict('LABEL: block\nCONFIDENCE: 0.81\nRATIONALE: harm risk.');
        expect(r.label).toBe('block');
        expect(r.confidence).toBeCloseTo(0.81, 5);
        expect(r.rationale).toBe('harm risk.');
    });
    it('clamps confidence into [0, 1]', () => {
        expect(parseVerdict('LABEL: allow\nCONFIDENCE: 1.7\nRATIONALE: x').confidence).toBe(1);
        expect(parseVerdict('LABEL: allow\nCONFIDENCE: -0.3\nRATIONALE: x').confidence).toBe(0);
    });
    it('falls back to undecided on malformed input', () => {
        const r = parseVerdict('???');
        expect(r.label).toBe('undecided');
        expect(r.confidence).toBe(0);
        expect(r.rationale).toMatch(/unparseable/i);
    });
    it('treats unknown labels as undecided', () => {
        const r = parseVerdict('LABEL: maybe\nCONFIDENCE: 0.5\nRATIONALE: idk');
        expect(r.label).toBe('undecided');
    });
});
describe('formatPrompt', () => {
    it('includes context and category hint when provided', () => {
        const p = formatPrompt({ candidate: 'X', context: 'CTX', categoryHint: 'cat' }, 'allow-advocate', []);
        expect(p).toContain('CTX');
        expect(p).toContain('cat');
        expect(p).toContain('X');
    });
    it('renders empty transcript marker when history is empty', () => {
        const p = formatPrompt({ candidate: 'X' }, 'block-advocate', []);
        expect(p).toContain('(no prior arguments)');
    });
});
describe('synthesizeTrainingData', () => {
    it('produces N examples for N inputs', async () => {
        const client = makeStub('LABEL: allow\nCONFIDENCE: 0.9\nRATIONALE: fine.');
        // makeStub canned only one judge response; build a fresh client per input
        const inputs = [
            { candidate: 'Q1' },
            { candidate: 'Q2' },
        ];
        // Wrap to refresh canned responses per call.
        let runCount = 0;
        const wrapper = {
            respond: async (prompt, role) => {
                if (role === 'judge') {
                    runCount++;
                    return `LABEL: ${runCount % 2 === 0 ? 'block' : 'allow'}\nCONFIDENCE: 0.6\nRATIONALE: r${runCount}.`;
                }
                return `${role} stub`;
            },
        };
        const examples = await synthesizeTrainingData(inputs, { client: wrapper });
        expect(examples).toHaveLength(2);
        expect(examples[0].label).toBe('allow');
        expect(examples[1].label).toBe('block');
        expect(examples[0].rounds).toHaveLength(4);
        // silence unused
        void client;
    });
});
describe('writeJsonl + loadJsonl round trip', () => {
    it('preserves examples through write/read', () => {
        const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'kbot-debate-'));
        const file = path.join(dir, 'out.jsonl');
        const examples = [
            {
                input: { candidate: 'A', context: 'c', categoryHint: 'h' },
                label: 'allow',
                confidence: 0.9,
                rationale: 'fine',
                rounds: [
                    { role: 'allow-advocate', argument: 'a', ts: '2026-04-25T00:00:00.000Z' },
                    { role: 'block-advocate', argument: 'b', ts: '2026-04-25T00:00:01.000Z' },
                ],
            },
            {
                input: { candidate: 'B' },
                label: 'block',
                confidence: 0.3,
                rationale: 'risk',
                rounds: [],
            },
        ];
        writeJsonl(examples, file);
        expect(fs.existsSync(file)).toBe(true);
        const loaded = loadJsonl(file);
        expect(loaded).toEqual(examples);
    });
    it('skips malformed lines on load', () => {
        const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'kbot-debate-'));
        const file = path.join(dir, 'out.jsonl');
        const good = {
            input: { candidate: 'A' },
            label: 'allow',
            confidence: 1,
            rationale: 'r',
            rounds: [],
        };
        const body = [JSON.stringify(good), 'not-json', '{"partial":true}', ''].join('\n');
        fs.writeFileSync(file, body, 'utf8');
        const loaded = loadJsonl(file);
        expect(loaded).toHaveLength(1);
        expect(loaded[0].input.candidate).toBe('A');
    });
    it('returns [] for missing file', () => {
        const loaded = loadJsonl('/tmp/definitely-not-a-real-path-kbot-debate-xyz.jsonl');
        expect(loaded).toEqual([]);
    });
});
//# sourceMappingURL=runner.test.js.map