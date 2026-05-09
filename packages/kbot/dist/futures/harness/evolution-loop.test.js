/**
 * evolution-loop.test.ts — deterministic stub tests for the inner loop.
 * No LLM calls; everything is in-memory.
 */
import { describe, it } from 'vitest';
import assert from 'node:assert/strict';
import * as os from 'node:os';
import * as path from 'node:path';
import { promises as fs } from 'node:fs';
import { runEvolutionLoop } from './evolution-loop.js';
import { NoopEvolutionAgent } from './noop-evolution.js';
import { appendTrace, readHistory, pruneOlderThan, defaultStateDir } from './persistence.js';
function mkHarness(id) {
    return {
        id,
        systemPrompt: 'be helpful',
        toolAllowlist: ['echo'],
        hooks: [],
        modelRouting: [],
        hyperparams: { maxIterations: 3 },
    };
}
function mkTask() {
    return {
        id: 'task-1',
        instructions: 'say hello',
        acceptance: ['hello world'],
    };
}
class CannedWorker {
    outputs;
    i = 0;
    constructor(outputs) {
        this.outputs = outputs;
    }
    async execute(task, harness) {
        const out = this.outputs[Math.min(this.i++, this.outputs.length - 1)];
        return {
            taskId: task.id,
            harnessId: harness.id,
            steps: [{ index: 0, phase: 'response', action: 'reply', output: out, durationMs: 5 }],
            finalState: { reply: out },
            llmTimeMs: 5,
            toolTimeMs: 0,
        };
    }
}
class RegexEvaluator {
    pattern;
    constructor(pattern) {
        this.pattern = pattern;
    }
    async evaluate(trace, task) {
        const text = trace.steps.map((s) => s.output ?? '').join('\n');
        const matched = this.pattern.test(text);
        return {
            taskId: task.id,
            harnessId: trace.harnessId,
            pass: matched,
            score: matched ? 1 : 0.25 + 0.1 * trace.steps.length,
            criteriaResults: task.acceptance.map((c) => ({ criterion: c, passed: matched })),
            failureModes: [],
        };
    }
}
describe('runEvolutionLoop', () => {
    it('runs K=3 iterations and reports history length', async () => {
        const protocol = {
            worker: new CannedWorker(['ignored', 'almost', 'hello world']),
            evaluator: new RegexEvaluator(/hello world/),
            evolution: new NoopEvolutionAgent(),
            initialHarness: mkHarness('h0'),
            hyperparams: { maxIterations: 3 },
        };
        const result = await runEvolutionLoop(protocol, mkTask());
        assert.equal(result.history.length, 3);
        assert.equal(result.taskId, 'task-1');
        // Best-score monotonicity: last must be >= first.
        const first = result.history[0].report.score;
        const last = result.history[2].report.score;
        assert.ok(last >= first, `expected ${last} >= ${first}`);
        // Best score recorded on result.
        assert.equal(result.bestScore, 1);
        // Verdict labels are populated.
        for (const r of result.history) {
            assert.ok(['improved', 'regressed', 'no-op'].includes(r.verdict));
        }
    });
    it('early-stops when earlyStopScore is reached', async () => {
        const protocol = {
            worker: new CannedWorker(['hello world', 'hello world', 'hello world']),
            evaluator: new RegexEvaluator(/hello world/),
            evolution: new NoopEvolutionAgent(),
            initialHarness: mkHarness('h0'),
            hyperparams: { maxIterations: 5, earlyStopScore: 1 },
        };
        const result = await runEvolutionLoop(protocol, mkTask());
        assert.ok(result.history.length < 5, `early stop expected, got ${result.history.length}`);
        assert.equal(result.bestScore, 1);
    });
    it('persists records via injected hook', async () => {
        const captured = [];
        const protocol = {
            worker: new CannedWorker(['x', 'hello world']),
            evaluator: new RegexEvaluator(/hello world/),
            evolution: new NoopEvolutionAgent(),
            initialHarness: mkHarness('h0'),
            hyperparams: { maxIterations: 2 },
        };
        await runEvolutionLoop(protocol, mkTask(), {
            onRecord: (r) => { captured.push(r); },
        });
        assert.equal(captured.length, 2);
        assert.equal(captured[0].iteration, 1);
    });
    it('writes JSONL when persistDir is given and reads it back', async () => {
        const dir = path.join(os.tmpdir(), `kbot-harness-test-${Date.now()}`);
        const taskId = `t-${Date.now()}`;
        const protocol = {
            worker: new CannedWorker(['hi', 'hello world']),
            evaluator: new RegexEvaluator(/hello world/),
            evolution: new NoopEvolutionAgent(),
            initialHarness: mkHarness('h0'),
            hyperparams: { maxIterations: 2 },
        };
        const task = { ...mkTask(), id: taskId };
        await runEvolutionLoop(protocol, task, { persistDir: dir });
        const history = await readHistory(taskId, dir);
        assert.equal(history.length, 2);
        assert.equal(history[1].iteration, 2);
        await fs.rm(dir, { recursive: true, force: true });
    });
    it('default state dir lives under ~/.kbot/futures/harness', () => {
        const dir = defaultStateDir();
        assert.ok(dir.endsWith(path.join('.kbot', 'futures', 'harness')));
    });
    it('pruneOlderThan removes only stale traces', async () => {
        const dir = path.join(os.tmpdir(), `kbot-harness-prune-${Date.now()}`);
        await fs.mkdir(dir, { recursive: true });
        const stale = path.join(dir, 'stale.jsonl');
        const fresh = path.join(dir, 'fresh.jsonl');
        await fs.writeFile(stale, '{}\n');
        await fs.writeFile(fresh, '{}\n');
        const old = new Date(Date.now() - 10 * 24 * 60 * 60 * 1000);
        await fs.utimes(stale, old, old);
        const removed = await pruneOlderThan(7, dir);
        assert.ok(removed.includes('stale'));
        assert.ok(!removed.includes('fresh'));
        await fs.rm(dir, { recursive: true, force: true });
    });
    it('appendTrace creates dir on demand', async () => {
        const dir = path.join(os.tmpdir(), `kbot-harness-append-${Date.now()}`, 'nested');
        const rec = {
            iteration: 1,
            harness: mkHarness('h0'),
            trace: {
                taskId: 'tx', harnessId: 'h0',
                steps: [], finalState: {}, llmTimeMs: 0, toolTimeMs: 0,
            },
            report: {
                taskId: 'tx', harnessId: 'h0', pass: true, score: 1,
                criteriaResults: [], failureModes: [],
            },
            verdict: 'improved',
        };
        await appendTrace('tx', rec, dir);
        const back = await readHistory('tx', dir);
        assert.equal(back.length, 1);
        await fs.rm(path.join(dir, '..'), { recursive: true, force: true });
    });
});
//# sourceMappingURL=evolution-loop.test.js.map