import chalk from 'chalk';
/** Known rate limits per provider (requests per minute) */
const PROVIDER_LIMITS = {
    anthropic: { rpm: 50, tpm: 100_000 },
    openai: { rpm: 60, tpm: 150_000 },
    google: { rpm: 60, tpm: 120_000 },
    groq: { rpm: 30, tpm: 30_000 },
    xai: { rpm: 60, tpm: 100_000 },
    deepseek: { rpm: 60, tpm: 100_000 },
    mistral: { rpm: 30, tpm: 60_000 },
    perplexity: { rpm: 20, tpm: 30_000 },
    together: { rpm: 60, tpm: 100_000 },
    fireworks: { rpm: 60, tpm: 100_000 },
    cohere: { rpm: 40, tpm: 60_000 },
    openrouter: { rpm: 60, tpm: 150_000 },
    ollama: { rpm: 999, tpm: 999_999 }, // local, no real limit
    lmstudio: { rpm: 999, tpm: 999_999 },
    jan: { rpm: 999, tpm: 999_999 },
    'kbot-local': { rpm: 999, tpm: 999_999 },
};
const WINDOW_MS = 60_000; // 1 minute sliding window
const MAX_BACKOFF_MS = 60_000;
const DEBUG = process.env.KBOT_DEBUG === '1' || process.env.KBOT_DEBUG === 'true';
/** In-memory rate limit state per provider */
const state = new Map();
function getProviderLimits(provider) {
    return PROVIDER_LIMITS[provider.toLowerCase()] ?? { rpm: 60, tpm: 100_000 };
}
function getOrCreateState(provider) {
    const key = provider.toLowerCase();
    let s = state.get(key);
    if (!s) {
        const limits = getProviderLimits(key);
        s = {
            bucket: {
                tokens: limits.tpm,
                lastRefill: Date.now(),
                maxTokens: limits.tpm,
                refillRate: limits.tpm / 60, // tokens per second
            },
            requestCount: 0,
            windowStart: Date.now(),
            consecutiveErrors: 0,
        };
        state.set(key, s);
    }
    return s;
}
/** Refill the token bucket based on elapsed time */
function refillBucket(bucket) {
    const now = Date.now();
    const elapsed = (now - bucket.lastRefill) / 1000; // seconds
    const refill = Math.floor(elapsed * bucket.refillRate);
    if (refill > 0) {
        bucket.tokens = Math.min(bucket.maxTokens, bucket.tokens + refill);
        bucket.lastRefill = now;
    }
}
/** Slide the RPM window forward, resetting count if window expired */
function slideWindow(s) {
    const now = Date.now();
    if (now - s.windowStart >= WINDOW_MS) {
        s.requestCount = 0;
        s.windowStart = now;
    }
}
function debugLog(msg) {
    if (DEBUG) {
        process.stderr.write(chalk.dim(`[rate-limiter] ${msg}\n`));
    }
}
/**
 * Check if a request is allowed for the given provider.
 * Returns whether the request can proceed, how long to wait if not, and an optional reason.
 */
export function checkRateLimit(provider) {
    const s = getOrCreateState(provider);
    const limits = getProviderLimits(provider);
    const now = Date.now();
    // Check retry-after from a previous 429
    if (s.retryAfter && now < s.retryAfter) {
        const waitMs = s.retryAfter - now;
        debugLog(`${provider}: blocked by retryAfter, wait ${waitMs}ms`);
        return { allowed: false, waitMs, reason: `Rate limited by ${provider}, retry in ${Math.ceil(waitMs / 1000)}s` };
    }
    // Slide the RPM window
    slideWindow(s);
    // Check RPM
    if (s.requestCount >= limits.rpm) {
        const waitMs = WINDOW_MS - (now - s.windowStart);
        debugLog(`${provider}: RPM limit reached (${s.requestCount}/${limits.rpm}), wait ${waitMs}ms`);
        return { allowed: false, waitMs, reason: `RPM limit reached for ${provider} (${limits.rpm}/min)` };
    }
    // Check TPM (token bucket)
    refillBucket(s.bucket);
    if (s.bucket.tokens <= 0) {
        // Estimate time until we have at least 1 token
        const waitMs = Math.ceil(1000 / s.bucket.refillRate);
        debugLog(`${provider}: TPM bucket empty, wait ${waitMs}ms`);
        return { allowed: false, waitMs, reason: `Token limit reached for ${provider}` };
    }
    return { allowed: true, waitMs: 0 };
}
/**
 * Record a completed request, consuming tokens from the bucket and incrementing RPM count.
 */
export function recordRequest(provider, tokens) {
    const s = getOrCreateState(provider);
    // Slide the window and increment RPM
    slideWindow(s);
    s.requestCount++;
    // Consume tokens from bucket
    refillBucket(s.bucket);
    s.bucket.tokens = Math.max(0, s.bucket.tokens - tokens);
    // Successful request resets consecutive error count
    s.consecutiveErrors = 0;
    s.retryAfter = undefined;
    debugLog(`${provider}: recorded request (${tokens} tokens, ${s.requestCount} RPM, ${Math.floor(s.bucket.tokens)} bucket remaining)`);
}
/**
 * Record a 429 rate limit response. Sets retry-after with exponential backoff.
 */
export function recordRateLimit(provider, retryAfterMs) {
    const s = getOrCreateState(provider);
    s.consecutiveErrors++;
    if (retryAfterMs && retryAfterMs > 0) {
        // Use the server-provided retry-after
        s.retryAfter = Date.now() + retryAfterMs;
        debugLog(`${provider}: 429 received, server retry-after ${retryAfterMs}ms`);
    }
    else {
        // Exponential backoff: 1s, 2s, 4s, 8s, ..., max 60s
        const backoffMs = Math.min(MAX_BACKOFF_MS, 1000 * Math.pow(2, s.consecutiveErrors - 1));
        s.retryAfter = Date.now() + backoffMs;
        debugLog(`${provider}: 429 received, backoff ${backoffMs}ms (attempt ${s.consecutiveErrors})`);
    }
}
/**
 * Wait until the rate limit clears for the given provider.
 * Prints a progress message to stderr while waiting.
 */
export async function waitForRateLimit(provider) {
    let check = checkRateLimit(provider);
    while (!check.allowed) {
        const waitSec = Math.ceil(check.waitMs / 1000);
        process.stderr.write(chalk.yellow(`⏳ Rate limited by ${provider}. Waiting ${waitSec}s...\r`));
        await new Promise(resolve => setTimeout(resolve, check.waitMs));
        // Clear the progress line
        process.stderr.write('\r' + ' '.repeat(80) + '\r');
        check = checkRateLimit(provider);
    }
}
/**
 * Get the current rate limit status for a provider.
 */
export function getRateLimitStatus(provider) {
    const s = getOrCreateState(provider);
    const limits = getProviderLimits(provider);
    const now = Date.now();
    slideWindow(s);
    refillBucket(s.bucket);
    const blocked = (s.retryAfter !== undefined && now < s.retryAfter)
        || s.requestCount >= limits.rpm
        || s.bucket.tokens <= 0;
    return {
        rpm: { used: s.requestCount, limit: limits.rpm },
        tpm: { used: limits.tpm - Math.floor(s.bucket.tokens), limit: limits.tpm },
        blocked,
    };
}
/**
 * Format all active providers' rate limit status for display.
 */
export function formatRateLimitStatus() {
    if (state.size === 0) {
        return chalk.dim('No rate limit data yet.');
    }
    const lines = [chalk.bold('Rate Limit Status:')];
    for (const [provider] of state) {
        const status = getRateLimitStatus(provider);
        const rpmPct = Math.round((status.rpm.used / status.rpm.limit) * 100);
        const tpmPct = Math.round((status.tpm.used / status.tpm.limit) * 100);
        const rpmColor = rpmPct >= 90 ? chalk.red : rpmPct >= 70 ? chalk.yellow : chalk.green;
        const tpmColor = tpmPct >= 90 ? chalk.red : tpmPct >= 70 ? chalk.yellow : chalk.green;
        const statusIcon = status.blocked ? chalk.red('BLOCKED') : chalk.green('OK');
        lines.push(`  ${chalk.cyan(provider.padEnd(12))} ` +
            `RPM: ${rpmColor(`${status.rpm.used}/${status.rpm.limit}`)}  ` +
            `TPM: ${tpmColor(`${status.tpm.used.toLocaleString()}/${status.tpm.limit.toLocaleString()}`)}  ` +
            `[${statusIcon}]`);
    }
    return lines.join('\n');
}
/**
 * Reset all rate limit state. Useful for testing or manual recovery.
 */
export function resetRateLimits() {
    state.clear();
    debugLog('All rate limit state reset');
}
//# sourceMappingURL=rate-limiter.js.map