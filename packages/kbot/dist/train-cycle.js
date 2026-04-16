// train-cycle — on-policy distillation loop (DeepSeek-R1 Distill pattern).
//
// Loop:
//   1. Sample N prompts from held-out pool (~/.kbot/teacher/prompts.jsonl)
//   2. Student (local model) generates response
//   3. Teacher (Claude) grades; if bad, teacher writes a corrected response
//   4. Pairs go back into ~/.kbot/teacher/corrections.jsonl
//   5. Optionally retrain via train-self --mode default (with corrections merged)
//
// Designed to run as a weekly cron or on-demand.
import { existsSync, readFileSync, appendFileSync } from 'node:fs';
import { join } from 'node:path';
import { homedir } from 'node:os';
function readPrompts(file) {
    if (!existsSync(file))
        return [];
    return readFileSync(file, 'utf-8')
        .split('\n')
        .filter(l => l.trim())
        .map(l => { try {
        return JSON.parse(l);
    }
    catch {
        return null;
    } })
        .filter((x) => x !== null && typeof x.prompt === 'string');
}
/** Auto-harvest prompts from teacher/traces.jsonl (user messages) if no explicit file. */
function harvestPrompts(limit = 200) {
    const traceFile = join(homedir(), '.kbot', 'teacher', 'traces.jsonl');
    if (!existsSync(traceFile))
        return [];
    const lines = readFileSync(traceFile, 'utf-8').split('\n').filter(l => l.trim());
    const out = [];
    for (const line of lines.slice(-limit * 2)) {
        try {
            const t = JSON.parse(line);
            const msgs = t.messages;
            const firstUser = msgs?.find(m => m.role === 'user');
            if (firstUser && firstUser.content.length > 20 && firstUser.content.length < 2000) {
                out.push({ prompt: firstUser.content, system: t.system });
            }
            if (out.length >= limit)
                break;
        }
        catch { /* skip */ }
    }
    return out;
}
async function callOllama(model, system, prompt) {
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
            options: { num_predict: 2048, temperature: 0.2 },
        }),
        signal: AbortSignal.timeout(300_000),
    });
    if (!res.ok)
        throw new Error(`Ollama HTTP ${res.status}`);
    const data = await res.json();
    return data.message?.content || '';
}
async function callAnthropicGrade(apiKey, teacherModel, system, prompt, studentResponse) {
    const gradePrompt = `You are grading a student AI's response. Score 0.0–1.0 based on correctness, completeness, and helpfulness.

If the response scores below 0.6, provide a corrected response.

Return ONLY valid JSON in this exact shape:
{"score": <number>, "rationale": "<one sentence>", "correction": "<corrected response or empty string>"}

ORIGINAL PROMPT:
${prompt.slice(0, 4000)}

STUDENT RESPONSE:
${studentResponse.slice(0, 6000)}`;
    const res = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'x-api-key': apiKey,
            'anthropic-version': '2023-06-01',
        },
        body: JSON.stringify({
            model: teacherModel,
            max_tokens: 4096,
            system: system || 'You are a strict code/AI grader.',
            messages: [{ role: 'user', content: gradePrompt }],
        }),
        signal: AbortSignal.timeout(120_000),
    });
    if (!res.ok)
        throw new Error(`Anthropic HTTP ${res.status}`);
    const data = await res.json();
    const text = (data.content || []).filter(b => b.type === 'text').map(b => b.text).join('');
    // Extract JSON from response
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (!jsonMatch)
        return { score: 0, rationale: 'no JSON in response', correction: undefined };
    try {
        const parsed = JSON.parse(jsonMatch[0]);
        return {
            score: typeof parsed.score === 'number' ? parsed.score : 0,
            rationale: parsed.rationale || '',
            correction: parsed.correction || undefined,
        };
    }
    catch {
        return { score: 0, rationale: 'JSON parse failed', correction: undefined };
    }
}
export async function runCycle(opts = {}) {
    const studentModel = opts.studentModel ?? 'kernel-coder:latest';
    const teacherProvider = opts.teacherProvider ?? 'anthropic';
    const teacherModel = opts.teacherModel ?? 'claude-opus-4-6';
    const promptsFile = opts.promptsFile ?? join(homedir(), '.kbot', 'teacher', 'prompts.jsonl');
    const correctionsFile = opts.corrections ?? join(homedir(), '.kbot', 'teacher', 'corrections.jsonl');
    const samples = opts.samples ?? 50;
    const threshold = opts.passThreshold ?? 0.6;
    let prompts = readPrompts(promptsFile);
    if (prompts.length === 0)
        prompts = harvestPrompts(samples * 3);
    if (prompts.length === 0) {
        return {
            sampled: 0, passed: 0, corrected: 0, skipped: 0,
            corrections_file: correctionsFile,
        };
    }
    // Shuffle + take N
    prompts = prompts.sort(() => Math.random() - 0.5).slice(0, samples);
    let passed = 0, corrected = 0, skipped = 0;
    // Pull teacher API key
    let teacherKey = '';
    if (teacherProvider === 'anthropic') {
        teacherKey = process.env.ANTHROPIC_API_KEY || '';
        if (!teacherKey) {
            try {
                const cfg = JSON.parse(readFileSync(join(homedir(), '.kbot', 'config.json'), 'utf-8'));
                teacherKey = cfg.anthropic_api_key || cfg.anthropicApiKey || '';
            }
            catch { /* no config */ }
        }
        if (!teacherKey)
            throw new Error('No Anthropic API key for teacher. Set ANTHROPIC_API_KEY or run `kbot auth`.');
    }
    for (const p of prompts) {
        try {
            const studentResp = await callOllama(studentModel, p.system || '', p.prompt);
            if (!studentResp || studentResp.length < 20) {
                skipped++;
                continue;
            }
            if (opts.dryRun) {
                passed++;
                continue;
            }
            const grade = await callAnthropicGrade(teacherKey, teacherModel, p.system || '', p.prompt, studentResp);
            if (grade.score >= threshold) {
                passed++;
                // Keep good student responses as training examples too
                appendFileSync(correctionsFile, JSON.stringify({
                    messages: [
                        ...(p.system ? [{ role: 'system', content: p.system }] : []),
                        { role: 'user', content: p.prompt },
                        { role: 'assistant', content: studentResp },
                    ],
                    _score: grade.score,
                    _source: 'student_passed',
                }) + '\n');
            }
            else if (grade.correction) {
                corrected++;
                appendFileSync(correctionsFile, JSON.stringify({
                    messages: [
                        ...(p.system ? [{ role: 'system', content: p.system }] : []),
                        { role: 'user', content: p.prompt },
                        { role: 'assistant', content: grade.correction },
                    ],
                    _score: 1.0,
                    _source: 'teacher_corrected',
                    _student_score: grade.score,
                    _rationale: grade.rationale,
                }) + '\n');
            }
            else {
                skipped++;
            }
        }
        catch {
            skipped++;
        }
    }
    let retrainSummary;
    if (opts.retrain && !opts.dryRun) {
        const { trainSelf, formatTrainSelfReport } = await import('./train-self.js');
        // Merge corrections into next dataset: curator picks them up from ~/.kbot/teacher/
        const r = await trainSelf({ mode: 'default' });
        retrainSummary = formatTrainSelfReport(r);
    }
    return {
        sampled: prompts.length,
        passed,
        corrected,
        skipped,
        corrections_file: correctionsFile,
        retrain_summary: retrainSummary,
    };
}
export function formatCycleReport(r) {
    const lines = [
        'train-cycle',
        '─'.repeat(40),
        `  Sampled:      ${r.sampled}`,
        `  Passed:       ${r.passed}  (student got it right)`,
        `  Corrected:    ${r.corrected}  (teacher rewrote)`,
        `  Skipped:      ${r.skipped}`,
        `  Corrections:  ${r.corrections_file}`,
    ];
    if (r.retrain_summary) {
        lines.push('', 'Retrain:', r.retrain_summary);
    }
    return lines.join('\n');
}
//# sourceMappingURL=train-cycle.js.map