/**
 * Critic Gate — adversarial discriminator on tool outputs.
 * Generator/discriminator pattern: critic reviews each tool result before the
 * main LLM sees it. Fast path auto-accepts trivial results. Config via
 * ~/.kbot/config.json: critic_enabled (bool), critic_strictness (0..1).
 * Hard disable: env KBOT_NO_CRITIC=1.
 */
import { loadConfig } from './auth.js';
const TRUSTED_TOOLS = new Set([
    'read', 'read_file', 'kbot_read', 'kbot_read_file',
    'glob', 'kbot_glob', 'grep', 'kbot_grep', 'list_directory', 'ls',
    'git_status', 'git_log', 'git_diff', 'git_branch',
    'terminal_cwd', 'env_check', 'memory_recall', 'memory_search',
]);
const ERROR_KEYWORDS = [
    'tool error:', 'error:', 'enoent', 'permission denied', 'eacces',
    'not found', 'failed to', 'traceback', 'stack trace',
    'undefined is not', 'cannot read prop', 'refused',
];
const MAX_ARGS_CHARS = 500;
const MAX_RESULT_CHARS = 2000;
const TRIVIAL_MAX_BYTES = 10 * 1024;
function truncate(s, max) {
    if (s.length <= max)
        return s;
    return s.slice(0, max) + `\n…[truncated, original ${s.length} chars]`;
}
function toText(x) {
    if (x == null)
        return '';
    if (typeof x === 'string')
        return x;
    try {
        return JSON.stringify(x);
    }
    catch {
        return String(x);
    }
}
function hasErrorKeyword(text) {
    const lower = text.toLowerCase();
    return ERROR_KEYWORDS.some(k => lower.includes(k));
}
/** True if the result is plausibly fine without calling a critic LLM. */
function isTriviallyValid(tool, resultText) {
    if (!resultText || resultText.trim().length === 0)
        return false;
    if (resultText.length > TRIVIAL_MAX_BYTES)
        return false;
    if (hasErrorKeyword(resultText))
        return false;
    if (TRUSTED_TOOLS.has(tool))
        return true;
    return false;
}
function resolveCriticProvider(override) {
    const cfg = loadConfig();
    const provider = (override || cfg?.byok_provider || 'anthropic').toLowerCase();
    const localModel = cfg?.default_model && cfg.default_model !== 'auto' ? cfg.default_model : 'llama3.2:3b';
    if (provider === 'ollama' || provider === 'kbot-local') {
        return { provider, model: localModel, apiKey: 'local', apiUrl: 'http://localhost:11434/v1/chat/completions' };
    }
    if (provider === 'openai') {
        if (!cfg?.byok_key)
            return null;
        return { provider: 'openai', model: 'gpt-4o-mini', apiKey: cfg.byok_key, apiUrl: 'https://api.openai.com/v1/chat/completions' };
    }
    if (!cfg?.byok_key)
        return null;
    return { provider: 'anthropic', model: 'claude-haiku-4-5', apiKey: cfg.byok_key, apiUrl: 'https://api.anthropic.com/v1/messages' };
}
const CRITIC_SYSTEM = 'You are a strict senior engineer reviewing a tool output. ' +
    'Did this tool call produce a useful, correct, non-hallucinated result ' +
    'for the stated intent? Return ONLY JSON with keys: ' +
    '{"accept": bool, "reason": string, "retry_hint": string, "confidence": number between 0 and 1}. ' +
    'No prose, no code fences — JSON only.';
function buildUserPrompt(tool, args, result) {
    const argsText = truncate(toText(args), MAX_ARGS_CHARS);
    const resultText = truncate(toText(result), MAX_RESULT_CHARS);
    return `TOOL: ${tool}\n\nARGS:\n${argsText}\n\nRESULT:\n${resultText}`;
}
function parseVerdict(text) {
    if (!text)
        return null;
    // Strip fences/prose; grab first {...} object.
    const match = text.match(/\{[\s\S]*\}/);
    if (!match)
        return null;
    try {
        const raw = JSON.parse(match[0]);
        const confidence = typeof raw.confidence === 'number'
            ? Math.max(0, Math.min(1, raw.confidence))
            : 0.5;
        return {
            accept: !!raw.accept,
            reason: typeof raw.reason === 'string' ? raw.reason : undefined,
            retry_hint: typeof raw.retry_hint === 'string' ? raw.retry_hint : undefined,
            confidence,
        };
    }
    catch {
        return null;
    }
}
async function callAnthropic(p, userPrompt) {
    const res = await fetch(p.apiUrl, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'x-api-key': p.apiKey,
            'anthropic-version': '2023-06-01',
        },
        body: JSON.stringify({
            model: p.model,
            max_tokens: 256,
            system: CRITIC_SYSTEM,
            messages: [{ role: 'user', content: userPrompt }],
        }),
        signal: AbortSignal.timeout(15_000),
    });
    if (!res.ok)
        throw new Error(`critic HTTP ${res.status}`);
    const data = await res.json();
    return (data.content || []).filter(b => b.type === 'text').map(b => b.text || '').join('');
}
async function callOpenAICompat(p, userPrompt) {
    const headers = { 'Content-Type': 'application/json' };
    if (p.apiKey && p.apiKey !== 'local')
        headers['Authorization'] = `Bearer ${p.apiKey}`;
    const res = await fetch(p.apiUrl, {
        method: 'POST',
        headers,
        body: JSON.stringify({
            model: p.model,
            max_tokens: 256,
            messages: [
                { role: 'system', content: CRITIC_SYSTEM },
                { role: 'user', content: userPrompt },
            ],
        }),
        signal: AbortSignal.timeout(15_000),
    });
    if (!res.ok)
        throw new Error(`critic HTTP ${res.status}`);
    const data = await res.json();
    return data.choices?.[0]?.message?.content || '';
}
/**
 * Gate a tool result through the adversarial critic.
 * Never throws — on any failure, returns accept=true with low confidence so
 * the agent loop is never blocked by the critic itself.
 */
export async function gateToolResult(tool, args, result, opts = {}) {
    if (process.env.KBOT_NO_CRITIC === '1') {
        return { accept: true, confidence: 1, reason: 'critic disabled via env' };
    }
    const cfg = loadConfig();
    if (cfg && cfg.critic_enabled === false) {
        return { accept: true, confidence: 1, reason: 'critic disabled in config' };
    }
    const strictness = typeof opts.strictness === 'number'
        ? opts.strictness
        : (typeof cfg?.critic_strictness === 'number' ? cfg.critic_strictness : 0.5);
    const resultText = toText(result);
    // Fast path.
    if (isTriviallyValid(tool, resultText)) {
        return { accept: true, confidence: 0.9, reason: 'trivial-valid fast path' };
    }
    // If result is empty, reject without calling LLM.
    if (!resultText || resultText.trim().length === 0) {
        return {
            accept: false,
            confidence: 0.9,
            reason: 'empty tool result',
            retry_hint: 'Tool produced no output. Try different arguments or a different tool.',
        };
    }
    const userPrompt = buildUserPrompt(tool, args, resultText);
    let callLLM;
    if (opts.llmClient) {
        callLLM = opts.llmClient;
    }
    else {
        const provider = resolveCriticProvider(opts.provider);
        if (!provider) {
            // No usable provider — degrade gracefully.
            return { accept: true, confidence: 0.3, reason: 'no critic provider available' };
        }
        callLLM = provider.provider === 'anthropic'
            ? (pr) => callAnthropic(provider, pr)
            : (pr) => callOpenAICompat(provider, pr);
    }
    try {
        const text = await callLLM(userPrompt);
        const verdict = parseVerdict(text);
        if (!verdict) {
            return { accept: true, confidence: 0.3, reason: 'critic returned unparseable output' };
        }
        // Strictness gate: require verdict.confidence >= strictness when rejecting,
        // and if accepting with very low confidence and strictness is high, flip to reject.
        if (!verdict.accept && verdict.confidence < Math.max(0.1, 1 - strictness)) {
            // The critic rejected but wasn't very sure — let it pass with warning.
            return { ...verdict, accept: true, reason: `soft-accept: ${verdict.reason || 'low-confidence reject'}` };
        }
        if (verdict.accept && strictness > 0.8 && verdict.confidence < 0.3) {
            return {
                accept: false,
                confidence: verdict.confidence,
                reason: 'strict mode: accepted with very low confidence',
                retry_hint: verdict.retry_hint || 'Verify output shape and re-run with stricter arguments.',
            };
        }
        return verdict;
    }
    catch {
        // Critic call failed — never block the agent loop.
        return { accept: true, confidence: 0.2, reason: 'critic call failed' };
    }
}
//# sourceMappingURL=critic-gate.js.map