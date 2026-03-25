// kbot OpenClaw Connect — One-command OpenClaw Gateway setup
//
// Checks gateway availability, creates a SOUL.md agent definition,
// and verifies connectivity with a test message.
//
// Usage: kbot openclaw connect
import { join } from 'node:path';
import { mkdirSync, writeFileSync, existsSync } from 'node:fs';
import chalk from 'chalk';
import { KBOT_DIR } from './auth.js';
// ── Constants ──
const DEFAULT_GATEWAY_URL = 'http://127.0.0.1:18789';
const GATEWAY_URL = process.env.OPENCLAW_GATEWAY_URL || DEFAULT_GATEWAY_URL;
const SOUL_PATH = join(KBOT_DIR, 'openclaw-soul.md');
// ── Helpers ──
/** Check if the OpenClaw Gateway is reachable */
async function checkGateway() {
    try {
        const res = await fetch(`${GATEWAY_URL}/health`, {
            signal: AbortSignal.timeout(5000),
        });
        if (!res.ok)
            return null;
        const data = await res.json();
        return data;
    }
    catch {
        return null;
    }
}
/** Fetch full gateway status (models, platforms, etc.) */
async function fetchGatewayStatus() {
    try {
        const res = await fetch(`${GATEWAY_URL}/status`, {
            signal: AbortSignal.timeout(5000),
        });
        if (!res.ok)
            return {};
        return await res.json();
    }
    catch {
        return {};
    }
}
/** Send a test message to verify connectivity */
async function sendTestMessage() {
    try {
        const res = await fetch(`${GATEWAY_URL}/v1/chat/completions`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                model: 'auto',
                messages: [
                    { role: 'system', content: 'You are kbot, confirming OpenClaw connectivity. Respond with exactly: connected' },
                    { role: 'user', content: 'ping' },
                ],
                max_tokens: 16,
            }),
            signal: AbortSignal.timeout(10000),
        });
        return res.ok;
    }
    catch {
        return false;
    }
}
// ── SOUL.md Generation ──
const SPECIALIST_IDS = [
    'kernel', 'researcher', 'coder', 'writer', 'analyst',
    'aesthete', 'guardian', 'curator', 'strategist',
    'infrastructure', 'quant', 'investigator', 'oracle',
    'chronist', 'sage', 'communicator', 'adapter', 'immune',
];
function generateSoulMd() {
    const specialistList = SPECIALIST_IDS
        .map(id => `- **${id}** — specialist agent`)
        .join('\n');
    return `# SOUL.md — kbot OpenClaw Agent Definition

## Identity

- **Name**: kbot
- **Type**: Terminal AI agent
- **Version**: OpenClaw-connected
- **Source**: https://github.com/isaacsight/kernel
- **License**: MIT

## Purpose

kbot is an open-source terminal AI agent that connects to the OpenClaw Gateway
to access local and remote AI models. It brings ${SPECIALIST_IDS.length} specialist agents,
290+ tools, and 20 AI providers into a single CLI interface.

## Specialists

${specialistList}

## Capabilities

- Multi-provider AI (Anthropic, OpenAI, Google, + 17 more)
- 290+ built-in tools (file ops, git, GitHub, web search, browser, sandbox)
- Autonomous planning and execution
- Learning engine (patterns, solutions, user profile)
- Session persistence and memory synthesis
- MCP server/client support
- Local model support (Ollama, LM Studio, embedded llama.cpp)

## OpenClaw Integration

- **Gateway URL**: ${GATEWAY_URL}
- **Protocol**: OpenAI-compatible chat completions (v1/chat/completions)
- **Agent routing**: kbot routes to specialists based on intent classification
- **Tool execution**: Local-first, then API calls as needed
- **Memory**: Persistent across sessions at ~/.kbot/

## Interaction Style

- Act, don't advise — execute tasks directly
- Local-first — use local tools before making API calls
- Failures trigger fallbacks, not stops
- Route work to the right specialist
- Compound improvements — each session leaves things better
`;
}
// ── Main ──
export async function runOpenClawConnect() {
    const DIM = chalk.dim;
    const ACCENT = chalk.hex('#A78BFA');
    const GREEN = chalk.hex('#4ADE80');
    const RED = chalk.hex('#F87171');
    const CYAN = chalk.hex('#67E8F9');
    console.log();
    console.log(`  ${ACCENT('◉')} ${chalk.bold('kbot OpenClaw Connect')}`);
    console.log(`  ${DIM('─'.repeat(40))}`);
    console.log();
    // Step 1: Check if gateway is running
    console.log(`  ${DIM('Checking OpenClaw Gateway at')} ${CYAN(GATEWAY_URL)}${DIM('...')}`);
    const health = await checkGateway();
    if (!health) {
        console.log();
        console.log(`  ${RED('✗')} OpenClaw Gateway is not running.`);
        console.log();
        console.log(`  ${chalk.bold('To install and start OpenClaw:')}`);
        console.log();
        console.log(`  ${CYAN('1.')} Install the gateway:`);
        console.log(`     ${chalk.white('pip install openclaw')}`);
        console.log(`     ${DIM('or: brew install openclaw/tap/openclaw')}`);
        console.log();
        console.log(`  ${CYAN('2.')} Start the gateway:`);
        console.log(`     ${chalk.white('openclaw serve')}`);
        console.log(`     ${DIM('Default: http://127.0.0.1:18789')}`);
        console.log();
        console.log(`  ${CYAN('3.')} Set a custom URL (optional):`);
        console.log(`     ${chalk.white('export OPENCLAW_GATEWAY_URL=http://your-host:port')}`);
        console.log();
        console.log(`  ${DIM('Then run')} ${chalk.white('kbot openclaw connect')} ${DIM('again.')}`);
        console.log();
        return;
    }
    console.log(`  ${GREEN('✓')} Gateway is running${health.version ? ` (v${health.version})` : ''}`);
    // Step 2: Fetch full status
    const status = await fetchGatewayStatus();
    const platforms = status.platforms || ['local'];
    const models = status.models || [];
    if (models.length > 0) {
        console.log(`  ${GREEN('✓')} Models available: ${models.slice(0, 5).join(', ')}${models.length > 5 ? ` +${models.length - 5} more` : ''}`);
    }
    // Step 3: Create SOUL.md
    if (!existsSync(KBOT_DIR)) {
        mkdirSync(KBOT_DIR, { recursive: true });
    }
    const soulContent = generateSoulMd();
    writeFileSync(SOUL_PATH, soulContent, 'utf-8');
    console.log(`  ${GREEN('✓')} Agent definition saved to ${DIM(SOUL_PATH)}`);
    // Step 4: Send test message
    console.log(`  ${DIM('Sending test message...')}`);
    const testOk = await sendTestMessage();
    if (testOk) {
        console.log(`  ${GREEN('✓')} Connectivity verified`);
    }
    else {
        console.log(`  ${chalk.hex('#FBBF24')('⚠')} Test message failed — gateway is up but may not have a model loaded.`);
        console.log(`    ${DIM('Try: ollama pull llama3.1:8b')}`);
    }
    // Step 5: Print success summary
    console.log();
    console.log(`  ${GREEN('kbot is now connected to OpenClaw.')}`);
    console.log(`  ${DIM('Your agents are available on:')} ${platforms.map(p => chalk.white(p)).join(', ')}`);
    console.log();
    console.log(`  ${DIM('Usage:')}`);
    console.log(`    ${chalk.white('kbot')}                  ${DIM('— start interactive session via OpenClaw')}`);
    console.log(`    ${chalk.white('kbot --agent coder')}    ${DIM('— use a specific specialist')}`);
    console.log(`    ${chalk.white('kbot openclaw status')}  ${DIM('— check gateway status')}`);
    console.log();
}
//# sourceMappingURL=openclaw-connect.js.map