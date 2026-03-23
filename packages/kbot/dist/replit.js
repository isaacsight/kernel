// kbot Replit Integration
//
// Detects Replit environment and adapts kbot for cloud IDE constraints:
// - Persistent storage path detection
// - Lightweight mode (skip heavy tools)
// - Replit Secrets → API key auto-detection
// - Resource-aware defaults
import { join } from 'node:path';
import { homedir } from 'node:os';
/** Detect if running inside Replit and gather environment info */
export function detectReplit() {
    const replId = process.env.REPL_ID;
    const slug = process.env.REPL_SLUG;
    const owner = process.env.REPL_OWNER;
    if (!replId) {
        return {
            detected: false,
            homePath: join(homedir(), '.kbot'),
            hasSecrets: false,
        };
    }
    // Replit persistent storage is under /home/runner
    // Free tier: ephemeral, but /home/runner persists within a session
    // Paid tier: /home/runner persists across restarts
    const homePath = join('/home/runner', '.kbot');
    // Check if any API keys are available via Replit Secrets (env vars)
    const hasSecrets = !!(process.env.ANTHROPIC_API_KEY ||
        process.env.OPENAI_API_KEY ||
        process.env.GOOGLE_API_KEY ||
        process.env.MISTRAL_API_KEY ||
        process.env.XAI_API_KEY ||
        process.env.DEEPSEEK_API_KEY ||
        process.env.GROQ_API_KEY ||
        process.env.OPENROUTER_API_KEY);
    // Build the public URL for serve mode
    const publicUrl = slug && owner
        ? `https://${slug}.${owner}.repl.co`
        : undefined;
    return {
        detected: true,
        replId,
        slug,
        owner,
        dbUrl: process.env.REPLIT_DB_URL,
        publicUrl,
        homePath,
        hasSecrets,
    };
}
/** Check if running inside Replit */
export function isReplit() {
    return !!process.env.REPL_ID;
}
/**
 * Modules to SKIP in lite mode (Replit or --lite flag).
 * These require Docker, native binaries, display servers, or excessive disk/RAM.
 */
export const LITE_SKIP_MODULES = new Set([
    './sandbox.js', // Docker sandbox
    './e2b-sandbox.js', // E2B cloud sandbox
    './browser.js', // Puppeteer/Playwright (heavy binary)
    './browser-agent.js', // Browser automation agent
    './containers.js', // Docker container management
    './computer.js', // Computer use (needs display server)
    './comfyui-plugin.js', // ComfyUI (GPU + large models)
    './magenta-plugin.js', // Magenta (GPU + audio models)
    './vfx.js', // VFX tools (GPU-dependent)
    './gamedev.js', // Game dev tools (heavy assets)
    './kbot-local.js', // Local model gateway (downloads 4GB+ models)
    './training.js', // Fine-tuning (GPU + disk intensive)
]);
/** Get the kbot home directory, respecting Replit environment */
export function getKbotHome() {
    if (isReplit()) {
        return join('/home/runner', '.kbot');
    }
    return join(homedir(), '.kbot');
}
/** Print Replit-specific onboarding message */
export function printReplitWelcome() {
    return [
        '  Running on Replit — lite mode active',
        '  Heavy tools (Docker, browser, local models) are disabled.',
        '  All cloud AI providers work normally.',
        '',
        '  Quick setup:',
        '    1. Add your API key to Replit Secrets (e.g. ANTHROPIC_API_KEY)',
        '    2. Run: kbot auth',
        '    3. Start chatting: kbot "hello"',
        '',
        '  Serve mode: kbot serve --port 3000',
        '    Exposes all tools as a REST API on your Repl\'s public URL.',
    ].join('\n');
}
//# sourceMappingURL=replit.js.map