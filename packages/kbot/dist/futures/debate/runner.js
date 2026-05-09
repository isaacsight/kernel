/**
 * Debate runner — orchestrates a 4-round asymmetric debate.
 *
 * Algorithm:
 *   1. allow-advocate opens
 *   2. block-advocate rebuts
 *   3. allow-advocate counter-rebuts (if maxRounds >= 3)
 *   4. block-advocate final (if maxRounds >= 4)
 *   5. judge synthesizes a Verdict
 *
 * The LLM client is injected via opts.client. This module never imports
 * a provider SDK. Tests use a deterministic stub.
 */
const DEFAULT_MAX_ROUNDS = 4;
/**
 * Compose the role-specific prompt with the debate history.
 * Exported so tests and synthesis can verify prompt shape.
 */
export function formatPrompt(input, role, history) {
    const ctx = input.context ? `\nContext:\n${input.context}\n` : '';
    const cat = input.categoryHint ? `\nCategory hint: ${input.categoryHint}\n` : '';
    const transcript = history.length === 0
        ? '(no prior arguments)'
        : history
            .map((r, i) => `[Round ${i + 1} — ${r.role}]\n${r.argument}`)
            .join('\n\n');
    if (role === 'allow-advocate') {
        return [
            `You are the ALLOW-ADVOCATE in an asymmetric debate.`,
            `Argue why the candidate input below is SAFE TO ALLOW.`,
            `Be specific, cite reasons grounded in the candidate's content.`,
            ctx,
            cat,
            `Candidate:\n${input.candidate}`,
            ``,
            `Debate so far:\n${transcript}`,
            ``,
            `Write your argument. Do not include a verdict — that is the judge's role.`,
        ].join('\n');
    }
    if (role === 'block-advocate') {
        return [
            `You are the BLOCK-ADVOCATE in an asymmetric debate.`,
            `Argue why the candidate input below MUST BE BLOCKED.`,
            `Be specific, cite concrete harms or policy violations.`,
            ctx,
            cat,
            `Candidate:\n${input.candidate}`,
            ``,
            `Debate so far:\n${transcript}`,
            ``,
            `Write your argument. Do not include a verdict — that is the judge's role.`,
        ].join('\n');
    }
    // judge
    return [
        `You are the JUDGE in an asymmetric debate.`,
        `Read both advocates' arguments and produce a verdict.`,
        `Output exactly two lines, then a brief rationale:`,
        `LABEL: allow | block | undecided`,
        `CONFIDENCE: 0.00 - 1.00`,
        `RATIONALE: <one or two sentences>`,
        ctx,
        cat,
        `Candidate:\n${input.candidate}`,
        ``,
        `Full transcript:\n${transcript}`,
    ].join('\n');
}
/**
 * Parse the judge's free-form text into a structured verdict body.
 * Falls back to undecided/0 when fields are missing or malformed.
 */
export function parseVerdict(judgeText) {
    const labelMatch = judgeText.match(/LABEL:\s*(allow|block|undecided)/i);
    const confMatch = judgeText.match(/CONFIDENCE:\s*([0-9]*\.?[0-9]+)/i);
    const ratMatch = judgeText.match(/RATIONALE:\s*([\s\S]*?)(?:\n\n|$)/i);
    const rawLabel = labelMatch?.[1]?.toLowerCase();
    const label = rawLabel === 'allow' || rawLabel === 'block' || rawLabel === 'undecided'
        ? rawLabel
        : 'undecided';
    let confidence = 0;
    if (confMatch?.[1]) {
        const n = Number(confMatch[1]);
        if (Number.isFinite(n)) {
            confidence = Math.max(0, Math.min(1, n));
        }
    }
    if (label === 'undecided' && !labelMatch) {
        // unparseable — keep confidence at 0 regardless of what we found
        confidence = 0;
    }
    const rationale = ratMatch?.[1]?.trim() || (labelMatch ? '' : 'unparseable judge output');
    return { label, confidence, rationale };
}
function nowIso() {
    return new Date().toISOString();
}
/**
 * Run the debate end-to-end and return a Verdict.
 * Order is fixed: allow → block → allow → block → judge.
 */
export async function runDebate(input, opts) {
    const maxRounds = opts.maxRounds ?? DEFAULT_MAX_ROUNDS;
    if (maxRounds < 2) {
        throw new Error(`runDebate: maxRounds must be >= 2 (got ${maxRounds})`);
    }
    const rounds = [];
    // Round 1 — allow opens
    const r1Prompt = formatPrompt(input, 'allow-advocate', rounds);
    const r1 = await opts.client.respond(r1Prompt, 'allow-advocate');
    rounds.push({ role: 'allow-advocate', argument: r1, ts: nowIso() });
    // Round 2 — block rebuts
    const r2Prompt = formatPrompt(input, 'block-advocate', rounds);
    const r2 = await opts.client.respond(r2Prompt, 'block-advocate');
    rounds.push({ role: 'block-advocate', argument: r2, ts: nowIso() });
    // Round 3 — allow counter-rebuts
    if (maxRounds >= 3) {
        const r3Prompt = formatPrompt(input, 'allow-advocate', rounds);
        const r3 = await opts.client.respond(r3Prompt, 'allow-advocate');
        rounds.push({ role: 'allow-advocate', argument: r3, ts: nowIso() });
    }
    // Round 4 — block final
    if (maxRounds >= 4) {
        const r4Prompt = formatPrompt(input, 'block-advocate', rounds);
        const r4 = await opts.client.respond(r4Prompt, 'block-advocate');
        rounds.push({ role: 'block-advocate', argument: r4, ts: nowIso() });
    }
    // Judge — synthesizes
    const judgePrompt = formatPrompt(input, 'judge', rounds);
    const judgeText = await opts.client.respond(judgePrompt, 'judge');
    const parsed = parseVerdict(judgeText);
    return {
        label: parsed.label,
        confidence: parsed.confidence,
        rationale: parsed.rationale,
        rounds,
    };
}
//# sourceMappingURL=runner.js.map