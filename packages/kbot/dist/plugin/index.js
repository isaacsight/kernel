// kbot Claude Code Plugin — Entry point
//
// Bridges kbot's full cognitive engine into Claude Code as a plugin.
// Starts the MCP server, registers tools, sets up the Channel for
// two-way communication, and exports skills that map to kbot commands.
//
// Usage:
//   As a Claude Code plugin, this module is loaded automatically when
//   the plugin manifest is registered. It can also be imported directly:
//
//     import { activate, deactivate, skills } from './plugin/index.js'
//     await activate({ cwd: process.cwd() })
import { readFileSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { startMcpServer } from '../ide/mcp-server.js';
import { initBridge, getStatus } from '../ide/bridge.js';
// ── State ───────────────────────────────────────────────────────────────────
let activated = false;
// ── Manifest ────────────────────────────────────────────────────────────────
const __dirname = dirname(fileURLToPath(import.meta.url));
/**
 * Load and return the plugin manifest.
 */
export function getManifest() {
    const manifestPath = join(__dirname, 'manifest.json');
    if (!existsSync(manifestPath)) {
        // Fallback for compiled output where manifest.json may be at a different relative path
        const altPath = join(__dirname, '..', 'plugin', 'manifest.json');
        if (existsSync(altPath)) {
            return JSON.parse(readFileSync(altPath, 'utf-8'));
        }
        throw new Error(`kbot plugin manifest not found at ${manifestPath}`);
    }
    return JSON.parse(readFileSync(manifestPath, 'utf-8'));
}
// ── Skills ──────────────────────────────────────────────────────────────────
/**
 * Skill definitions mapping Claude Code slash commands to kbot CLI commands.
 */
export const skills = [
    {
        name: 'dream',
        description: 'Run kbot dream mode — memory consolidation, meta-agent cycle, forge speculation, and self-benchmarking',
        file: 'skills/dream.md',
        command: 'kbot dream',
    },
    {
        name: 'dashboard',
        description: "Show kbot's live learning dashboard — tool usage, agent routing, growth metrics",
        file: 'skills/dashboard.md',
        command: 'kbot dashboard',
    },
    {
        name: 'pair',
        description: 'Start pair programming mode — file watcher with real-time AI suggestions and auto-fix',
        file: 'skills/pair.md',
        command: 'kbot pair',
    },
    {
        name: 'guardian',
        description: 'Run codebase guardian — detect duplicates, co-change patterns, and complexity hotspots',
        file: 'skills/guardian.md',
        command: 'kbot guardian',
    },
    {
        name: 'meta',
        description: 'Run meta-agent cycle — analyze task agent performance, propose and apply improvements',
        file: 'skills/meta.md',
        command: 'kbot meta',
    },
];
/**
 * Load the markdown content of a skill file.
 */
export function loadSkillContent(skillName) {
    const skill = skills.find(s => s.name === skillName);
    if (!skill)
        return null;
    const skillPath = join(__dirname, skill.file);
    if (existsSync(skillPath)) {
        return readFileSync(skillPath, 'utf-8');
    }
    // Fallback for compiled output
    const altPath = join(__dirname, '..', 'plugin', skill.file);
    if (existsSync(altPath)) {
        return readFileSync(altPath, 'utf-8');
    }
    return null;
}
// ── Lifecycle ───────────────────────────────────────────────────────────────
/**
 * Activate the kbot plugin.
 *
 * Initializes the IDE bridge (registers tools, gathers project context)
 * and optionally starts the MCP server for tool communication.
 */
export async function activate(context = {}) {
    if (activated) {
        return getStatus();
    }
    const bridgeConfig = {
        cwd: context.cwd,
        agent: context.agent,
        tier: context.tier,
    };
    // Initialize the bridge — registers all tools and gathers project context
    await initBridge(bridgeConfig);
    // Start MCP server unless explicitly skipped
    if (!context.skipMcp) {
        // Start in background — the MCP server runs on stdio and blocks,
        // so we only start it if this is the main plugin entry point
        startMcpServer(bridgeConfig).catch((err) => {
            const message = err instanceof Error ? err.message : String(err);
            console.error(`[kbot plugin] MCP server error: ${message}`);
        });
    }
    activated = true;
    return getStatus();
}
/**
 * Deactivate the kbot plugin. Cleans up resources.
 */
export function deactivate() {
    activated = false;
}
/**
 * Check if the plugin is currently activated.
 */
export function isActivated() {
    return activated;
}
//# sourceMappingURL=index.js.map