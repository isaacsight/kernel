/**
 * Synthesis — fan a list of debate inputs through the runner and
 * persist the verdicts as JSONL training data for the critic.
 */
import * as fs from 'node:fs';
import * as path from 'node:path';
import * as os from 'node:os';
import { runDebate } from './runner.js';
/**
 * Default JSONL path: ~/.kbot/futures/debate/<YYYY-MM-DD>.jsonl
 */
export function defaultJsonlPath(date = new Date()) {
    const yyyy = date.getUTCFullYear();
    const mm = String(date.getUTCMonth() + 1).padStart(2, '0');
    const dd = String(date.getUTCDate()).padStart(2, '0');
    return path.join(os.homedir(), '.kbot', 'futures', 'debate', `${yyyy}-${mm}-${dd}.jsonl`);
}
/**
 * Run a debate per input and return the resulting training examples.
 * Failures are surfaced — the caller decides whether to retry or skip.
 */
export async function synthesizeTrainingData(inputs, opts) {
    const examples = [];
    for (const input of inputs) {
        const verdict = await runDebate(input, opts);
        examples.push({
            input,
            label: verdict.label,
            confidence: verdict.confidence,
            rationale: verdict.rationale,
            rounds: verdict.rounds,
        });
    }
    return examples;
}
/**
 * Atomic JSONL write. Creates parent dirs, writes to a tmp file,
 * then renames into place to avoid partial-write corruption.
 */
export function writeJsonl(examples, filePath) {
    const dir = path.dirname(filePath);
    fs.mkdirSync(dir, { recursive: true });
    const body = examples.map((ex) => JSON.stringify(ex)).join('\n') + (examples.length ? '\n' : '');
    const tmp = `${filePath}.tmp-${process.pid}-${Date.now()}`;
    fs.writeFileSync(tmp, body, 'utf8');
    fs.renameSync(tmp, filePath);
}
/**
 * Read JSONL and parse line-by-line. Malformed lines are skipped
 * (callers can audit by counting input vs output).
 */
export function loadJsonl(filePath) {
    if (!fs.existsSync(filePath))
        return [];
    const raw = fs.readFileSync(filePath, 'utf8');
    const out = [];
    for (const line of raw.split('\n')) {
        const trimmed = line.trim();
        if (!trimmed)
            continue;
        try {
            const obj = JSON.parse(trimmed);
            // minimal shape check — skip if required fields are missing
            if (obj &&
                typeof obj === 'object' &&
                obj.input &&
                typeof obj.input.candidate === 'string' &&
                Array.isArray(obj.rounds) &&
                typeof obj.label === 'string' &&
                typeof obj.confidence === 'number' &&
                typeof obj.rationale === 'string') {
                out.push(obj);
            }
        }
        catch {
            // skip malformed line
        }
    }
    return out;
}
//# sourceMappingURL=synthesis.js.map