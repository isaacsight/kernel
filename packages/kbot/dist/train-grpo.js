// train-grpo — Group Relative Policy Optimization scaffolding.
// GRPO generates N completions per prompt, scores with a verifiable reward,
// and reinforces the best. No reward model needed — the oracle is the verifier.
//
// Suitable verifiers for kbot:
//   build-pass  — does the emitted code compile / npm run build succeed?
//   test-pass   — does `npm test` / vitest succeed on the generated change?
//   lint-pass   — eslint / tsc --noEmit
//   regex-match — output contains a required pattern
//   json-valid  — output parses as JSON and matches schema
//
// This module writes GRPO config + delegates to an external GRPO runner
// (mlx-grpo / trl-mlx / custom). Runner selection is pluggable.
import { existsSync, mkdirSync, writeFileSync, appendFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { homedir, tmpdir } from 'node:os';
import { execSync, spawnSync } from 'node:child_process';
import { randomUUID } from 'node:crypto';
function shell(cmd, cwd, timeout = 120_000) {
    try {
        const out = execSync(cmd, {
            encoding: 'utf-8',
            stdio: ['pipe', 'pipe', 'pipe'],
            maxBuffer: 20 * 1024 * 1024,
            timeout,
            cwd,
        });
        return { ok: true, output: out.toString() };
    }
    catch (err) {
        const e = err;
        return { ok: (e.status === 0), output: [e.stdout, e.stderr, e.message].filter(Boolean).join('\n') };
    }
}
async function generateRollout(model, system, prompt, temperature = 0.8) {
    const res = await fetch('http://localhost:11434/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            model,
            stream: false,
            messages: [
                ...(system ? [{ role: 'system', content: system }] : []),
                { role: 'user', content: prompt },
            ],
            options: { num_predict: 2048, temperature },
        }),
        signal: AbortSignal.timeout(180_000),
    });
    if (!res.ok)
        throw new Error(`Ollama HTTP ${res.status}`);
    const data = await res.json();
    return data.message?.content || '';
}
/** Apply a verifier to a completion. Returns { ok, reward ∈ [0,1] }. */
export async function verify(v, completion) {
    switch (v.kind) {
        case 'regex-match': {
            try {
                const re = new RegExp(v.pattern, v.flags);
                return { ok: re.test(completion), reward: re.test(completion) ? 1 : 0 };
            }
            catch {
                return { ok: false, reward: 0 };
            }
        }
        case 'json-valid': {
            // Try to extract JSON from ```json blocks or bare object
            const match = completion.match(/```json\s*([\s\S]*?)```/) || completion.match(/\{[\s\S]*\}/);
            if (!match)
                return { ok: false, reward: 0 };
            try {
                const parsed = JSON.parse(match[1] || match[0]);
                if (v.requireKeys) {
                    for (const k of v.requireKeys) {
                        if (!(k in parsed))
                            return { ok: false, reward: 0.3 };
                    }
                }
                return { ok: true, reward: 1 };
            }
            catch {
                return { ok: false, reward: 0 };
            }
        }
        case 'build-pass':
        case 'test-pass':
        case 'lint-pass': {
            // Extract code blocks from completion, write to a scratch dir, run the command
            const scratch = join(tmpdir(), `grpo-${randomUUID()}`);
            mkdirSync(scratch, { recursive: true });
            const codeMatch = completion.match(/```[a-zA-Z]*\n([\s\S]*?)```/);
            const code = codeMatch ? codeMatch[1] : completion;
            writeFileSync(join(scratch, 'out.txt'), code);
            const r = shell(v.cmd, v.cwd || scratch, 180_000);
            return { ok: r.ok, reward: r.ok ? 1 : 0 };
        }
        case 'custom': {
            const script = resolve(v.script);
            if (!existsSync(script))
                return { ok: false, reward: 0 };
            const res = spawnSync(script, [], { input: completion, encoding: 'utf-8', timeout: 60_000 });
            return { ok: res.status === 0, reward: res.status === 0 ? 1 : 0 };
        }
    }
}
/** Compute group-relative advantages: (reward - group_mean) / group_std */
function advantages(rewards) {
    if (rewards.length === 0)
        return [];
    const mean = rewards.reduce((a, b) => a + b, 0) / rewards.length;
    const variance = rewards.reduce((a, b) => a + (b - mean) ** 2, 0) / rewards.length;
    const std = Math.sqrt(variance) || 1e-6;
    return rewards.map(r => (r - mean) / std);
}
export async function runGrpoRollouts(opts) {
    const studentModel = opts.studentModel ?? 'kernel-coder:latest';
    const groupSize = opts.groupSize ?? 8;
    const outputDir = opts.outputDir ?? join(homedir(), '.kbot', 'teacher', 'grpo', `run-${Date.now()}`);
    if (!existsSync(outputDir))
        mkdirSync(outputDir, { recursive: true });
    const rollouts = [];
    let totalReward = 0;
    let totalCount = 0;
    for (const p of opts.prompts) {
        const id = p.id ?? randomUUID();
        const completions = [];
        for (let i = 0; i < groupSize; i++) {
            try {
                const text = await generateRollout(studentModel, p.system || '', p.prompt, 0.8);
                const v = await verify(p.verifier, text);
                completions.push({ text, reward: v.reward, verifier_ok: v.ok });
                totalReward += v.reward;
                totalCount++;
            }
            catch (err) {
                completions.push({ text: '', reward: 0, verifier_ok: false });
                totalCount++;
            }
        }
        const adv = advantages(completions.map(c => c.reward));
        rollouts.push({ prompt_id: id, completions, advantage: adv });
        // Persist rollout to JSONL (consumed by GRPO updater)
        appendFileSync(join(outputDir, 'rollouts.jsonl'), JSON.stringify({
            id, prompt: p.prompt, system: p.system,
            rollouts: completions.map((c, k) => ({ text: c.text, reward: c.reward, advantage: adv[k] })),
        }) + '\n');
    }
    const meanReward = totalCount > 0 ? totalReward / totalCount : 0;
    // Write GRPO config for external runner
    const grpoConfig = {
        student_model: studentModel,
        group_size: groupSize,
        iters: opts.iters ?? 100,
        learning_rate: opts.learningRate ?? 5e-6,
        kl_beta: opts.klBeta ?? 0.05,
        rollouts_path: join(outputDir, 'rollouts.jsonl'),
        output_dir: outputDir,
    };
    writeFileSync(join(outputDir, 'grpo-config.json'), JSON.stringify(grpoConfig, null, 2));
    let log = `Wrote ${rollouts.length} prompt groups × ${groupSize} rollouts to ${outputDir}`;
    if (!opts.dryRun && opts.runnerCmd) {
        const r = shell(`${opts.runnerCmd} --config ${join(outputDir, 'grpo-config.json')}`);
        log += '\n' + r.output.split('\n').slice(-10).join('\n');
    }
    else if (!opts.dryRun) {
        log += '\nNo --runner-cmd given. Rollouts collected; invoke an external GRPO runner on rollouts.jsonl.';
    }
    return {
        ok: true,
        output_dir: outputDir,
        rollouts,
        iterations_run: 0,
        mean_reward: Math.round(meanReward * 1000) / 1000,
        log,
    };
}
/** Default verifier suite for kbot: regex + JSON validity on common code gen. */
export const DEFAULT_VERIFIER_SUITE = [
    {
        prompt: 'Write a TypeScript function `fib(n: number): number` that returns the nth Fibonacci number. Return only the function, in a ```typescript code block.',
        verifier: { kind: 'regex-match', pattern: 'function fib\\s*\\(\\s*n\\s*:\\s*number', flags: 'i' },
    },
    {
        prompt: 'Return a JSON object with keys "name" (string) and "version" (string) for a hypothetical npm package called "example-tool" at version 1.0.0. Only JSON, no prose.',
        verifier: { kind: 'json-valid', requireKeys: ['name', 'version'] },
    },
    {
        prompt: 'Write a Python function `def is_prime(n: int) -> bool:` that returns True if n is prime. Return only the function in a ```python code block.',
        verifier: { kind: 'regex-match', pattern: 'def is_prime\\s*\\(', flags: 'i' },
    },
];
export function formatGrpoReport(r) {
    return [
        'train-grpo',
        '─'.repeat(40),
        `  Status:          ${r.ok ? 'OK' : 'FAIL'}`,
        `  Output dir:      ${r.output_dir}`,
        `  Prompt groups:   ${r.rollouts.length}`,
        `  Mean reward:     ${r.mean_reward.toFixed(3)}`,
        '',
        `Log:`,
        r.log,
    ].join('\n');
}
//# sourceMappingURL=train-grpo.js.map