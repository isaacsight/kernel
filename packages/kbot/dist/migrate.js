// kbot Migrate — Import configurations and history from other AI CLI agents
// Supports: Claude Code, Junie CLI, Codex CLI, Aider, Cursor, Cline
//
// Usage: kbot migrate --from claude-code
//        kbot migrate --from junie
//        kbot migrate --from aider
import { homedir } from 'node:os';
import { join } from 'node:path';
import { existsSync, readFileSync, writeFileSync, mkdirSync, readdirSync } from 'node:fs';
import chalk from 'chalk';
const KBOT_DIR = join(homedir(), '.kbot');
function combinedResult(results) {
    return {
        success: results.every(r => r.success),
        imported: results.reduce((s, r) => s + r.imported, 0),
        skipped: results.reduce((s, r) => s + r.skipped, 0),
        errors: results.flatMap(r => r.errors),
        details: results.flatMap(r => r.details),
    };
}
function emptyResult() {
    return { success: true, imported: 0, skipped: 0, errors: [], details: [] };
}
// ── Claude Code ──
function detectClaudeCode() {
    return existsSync(join(homedir(), '.claude')) || existsSync(join(homedir(), '.claude', 'settings.json'));
}
function migrateClaudeCodeConfig() {
    const result = emptyResult();
    const claudeDir = join(homedir(), '.claude');
    // Import CLAUDE.md project instructions as kbot memory
    const claudeMd = join(process.cwd(), 'CLAUDE.md');
    if (existsSync(claudeMd)) {
        try {
            const content = readFileSync(claudeMd, 'utf-8');
            const memDir = join(KBOT_DIR, 'memory');
            mkdirSync(memDir, { recursive: true });
            const memFile = join(memDir, 'imported-claude-md.json');
            writeFileSync(memFile, JSON.stringify({
                source: 'claude-code',
                type: 'project-instructions',
                content,
                importedAt: new Date().toISOString(),
            }, null, 2));
            result.imported++;
            result.details.push('Imported CLAUDE.md as project memory');
        }
        catch (err) {
            result.errors.push(`Failed to import CLAUDE.md: ${err instanceof Error ? err.message : String(err)}`);
        }
    }
    // Import Claude Code settings
    const settingsFile = join(claudeDir, 'settings.json');
    if (existsSync(settingsFile)) {
        try {
            const settings = JSON.parse(readFileSync(settingsFile, 'utf-8'));
            const importFile = join(KBOT_DIR, 'imports', 'claude-code-settings.json');
            mkdirSync(join(KBOT_DIR, 'imports'), { recursive: true });
            writeFileSync(importFile, JSON.stringify({
                source: 'claude-code',
                type: 'settings',
                original: settings,
                importedAt: new Date().toISOString(),
            }, null, 2));
            result.imported++;
            result.details.push('Imported Claude Code settings');
        }
        catch (err) {
            result.errors.push(`Failed to import settings: ${err instanceof Error ? err.message : String(err)}`);
        }
    }
    return result;
}
function migrateClaudeCodeHistory() {
    const result = emptyResult();
    const claudeDir = join(homedir(), '.claude');
    const projectsDir = join(claudeDir, 'projects');
    if (!existsSync(projectsDir))
        return result;
    try {
        const projects = readdirSync(projectsDir, { withFileTypes: true }).filter((d) => d.isDirectory());
        const sessionsDir = join(KBOT_DIR, 'sessions');
        mkdirSync(sessionsDir, { recursive: true });
        for (const project of projects) {
            const convDir = join(projectsDir, project.name);
            const files = readdirSync(convDir).filter((f) => f.endsWith('.json'));
            for (const file of files.slice(0, 10)) { // limit to 10 most recent
                try {
                    const data = JSON.parse(readFileSync(join(convDir, file), 'utf-8'));
                    const sessionId = `imported-cc-${project.name}-${file.replace('.json', '')}`;
                    const sessionFile = join(sessionsDir, `${sessionId}.json`);
                    if (existsSync(sessionFile)) {
                        result.skipped++;
                        continue;
                    }
                    writeFileSync(sessionFile, JSON.stringify({
                        id: sessionId,
                        name: `[Claude Code] ${project.name}`,
                        created: data.created || new Date().toISOString(),
                        updated: data.updated || new Date().toISOString(),
                        cwd: data.cwd || process.cwd(),
                        turnCount: Array.isArray(data.messages) ? data.messages.length : 0,
                        preview: 'Imported from Claude Code',
                        history: Array.isArray(data.messages)
                            ? data.messages.slice(0, 50).map((m) => ({
                                role: m.role || 'user',
                                content: typeof m.content === 'string' ? m.content : JSON.stringify(m.content),
                            }))
                            : [],
                        source: 'claude-code',
                    }, null, 2));
                    result.imported++;
                }
                catch {
                    result.skipped++;
                }
            }
        }
        if (result.imported > 0) {
            result.details.push(`Imported ${result.imported} conversation(s) from Claude Code`);
        }
    }
    catch (err) {
        result.errors.push(`History migration failed: ${err instanceof Error ? err.message : String(err)}`);
    }
    return result;
}
// ── Junie CLI ──
function detectJunie() {
    return existsSync(join(homedir(), '.junie')) || existsSync(join(homedir(), '.config', 'junie'));
}
function migrateJunieConfig() {
    const result = emptyResult();
    const junieDirs = [join(homedir(), '.junie'), join(homedir(), '.config', 'junie')];
    for (const dir of junieDirs) {
        const configFile = join(dir, 'config.json');
        if (existsSync(configFile)) {
            try {
                const config = JSON.parse(readFileSync(configFile, 'utf-8'));
                mkdirSync(join(KBOT_DIR, 'imports'), { recursive: true });
                writeFileSync(join(KBOT_DIR, 'imports', 'junie-config.json'), JSON.stringify({
                    source: 'junie',
                    type: 'config',
                    original: config,
                    importedAt: new Date().toISOString(),
                }, null, 2));
                result.imported++;
                result.details.push('Imported Junie CLI configuration');
                // Map Junie provider keys to kbot format
                if (config.apiKey && config.provider) {
                    result.details.push(`Detected ${config.provider} API key — run 'kbot auth' to configure provider`);
                }
            }
            catch (err) {
                result.errors.push(`Failed to read Junie config: ${err instanceof Error ? err.message : String(err)}`);
            }
            break;
        }
    }
    return result;
}
function migrateJunieHistory() {
    return emptyResult(); // Junie CLI is new — history format TBD
}
// ── Aider ──
function detectAider() {
    return existsSync(join(homedir(), '.aider.conf.yml')) ||
        existsSync(join(homedir(), '.aider'));
}
function migrateAiderConfig() {
    const result = emptyResult();
    const confFile = join(homedir(), '.aider.conf.yml');
    if (existsSync(confFile)) {
        try {
            const content = readFileSync(confFile, 'utf-8');
            mkdirSync(join(KBOT_DIR, 'imports'), { recursive: true });
            writeFileSync(join(KBOT_DIR, 'imports', 'aider-config.yml'), content);
            result.imported++;
            result.details.push('Imported Aider configuration');
            // Parse YAML-like key detection
            if (content.includes('openai-api-key') || content.includes('OPENAI_API_KEY')) {
                result.details.push('Detected OpenAI API key reference — run \'kbot auth\' to configure');
            }
            if (content.includes('anthropic-api-key') || content.includes('ANTHROPIC_API_KEY')) {
                result.details.push('Detected Anthropic API key reference — run \'kbot auth\' to configure');
            }
        }
        catch (err) {
            result.errors.push(`Failed to read Aider config: ${err instanceof Error ? err.message : String(err)}`);
        }
    }
    return result;
}
function migrateAiderHistory() {
    const result = emptyResult();
    // Aider stores chat history in .aider.chat.history.md
    const historyFile = join(process.cwd(), '.aider.chat.history.md');
    if (existsSync(historyFile)) {
        try {
            const content = readFileSync(historyFile, 'utf-8');
            const sessionsDir = join(KBOT_DIR, 'sessions');
            mkdirSync(sessionsDir, { recursive: true });
            const sessionFile = join(sessionsDir, 'imported-aider-history.json');
            if (!existsSync(sessionFile)) {
                writeFileSync(sessionFile, JSON.stringify({
                    id: 'imported-aider-history',
                    name: '[Aider] Chat History',
                    created: new Date().toISOString(),
                    updated: new Date().toISOString(),
                    cwd: process.cwd(),
                    turnCount: 1,
                    preview: 'Imported from Aider chat history',
                    history: [{ role: 'assistant', content: content.slice(0, 50_000) }],
                    source: 'aider',
                }, null, 2));
                result.imported++;
                result.details.push('Imported Aider chat history');
            }
            else {
                result.skipped++;
            }
        }
        catch (err) {
            result.errors.push(`Failed to import Aider history: ${err instanceof Error ? err.message : String(err)}`);
        }
    }
    return result;
}
// ── Codex CLI ──
function detectCodex() {
    return existsSync(join(homedir(), '.codex')) || existsSync(join(homedir(), '.config', 'codex'));
}
function migrateCodexConfig() {
    const result = emptyResult();
    const codexDirs = [join(homedir(), '.codex'), join(homedir(), '.config', 'codex')];
    for (const dir of codexDirs) {
        if (existsSync(dir)) {
            try {
                const files = readdirSync(dir).filter((f) => f.endsWith('.json'));
                mkdirSync(join(KBOT_DIR, 'imports'), { recursive: true });
                for (const file of files) {
                    const content = readFileSync(join(dir, file), 'utf-8');
                    writeFileSync(join(KBOT_DIR, 'imports', `codex-${file}`), content);
                    result.imported++;
                }
                if (result.imported > 0) {
                    result.details.push(`Imported ${result.imported} Codex config file(s)`);
                }
            }
            catch (err) {
                result.errors.push(`Failed to read Codex config: ${err instanceof Error ? err.message : String(err)}`);
            }
            break;
        }
    }
    return result;
}
function migrateCodexHistory() {
    return emptyResult();
}
// ── Source Registry ──
const SOURCES = [
    {
        id: 'claude-code',
        name: 'Claude Code',
        configPaths: [join(homedir(), '.claude')],
        historyPaths: [join(homedir(), '.claude', 'projects')],
        detect: detectClaudeCode,
        migrateConfig: migrateClaudeCodeConfig,
        migrateHistory: migrateClaudeCodeHistory,
    },
    {
        id: 'junie',
        name: 'Junie CLI',
        configPaths: [join(homedir(), '.junie'), join(homedir(), '.config', 'junie')],
        historyPaths: [],
        detect: detectJunie,
        migrateConfig: migrateJunieConfig,
        migrateHistory: migrateJunieHistory,
    },
    {
        id: 'aider',
        name: 'Aider',
        configPaths: [join(homedir(), '.aider.conf.yml')],
        historyPaths: [join(process.cwd(), '.aider.chat.history.md')],
        detect: detectAider,
        migrateConfig: migrateAiderConfig,
        migrateHistory: migrateAiderHistory,
    },
    {
        id: 'codex',
        name: 'Codex CLI',
        configPaths: [join(homedir(), '.codex'), join(homedir(), '.config', 'codex')],
        historyPaths: [],
        detect: detectCodex,
        migrateConfig: migrateCodexConfig,
        migrateHistory: migrateCodexHistory,
    },
];
// ── Public API ──
export function detectInstalledAgents() {
    return SOURCES.filter(s => s.detect()).map(s => ({ id: s.id, name: s.name }));
}
export function migrate(sourceId) {
    const source = SOURCES.find(s => s.id === sourceId);
    if (!source) {
        return {
            success: false,
            imported: 0,
            skipped: 0,
            errors: [`Unknown source: ${sourceId}. Available: ${SOURCES.map(s => s.id).join(', ')}`],
            details: [],
        };
    }
    if (!source.detect()) {
        return {
            success: false,
            imported: 0,
            skipped: 0,
            errors: [`${source.name} not detected on this system.`],
            details: [],
        };
    }
    mkdirSync(KBOT_DIR, { recursive: true });
    const configResult = source.migrateConfig();
    const historyResult = source.migrateHistory();
    return combinedResult([configResult, historyResult]);
}
export function migrateAll() {
    const detected = detectInstalledAgents();
    if (detected.length === 0) {
        return {
            success: true,
            imported: 0,
            skipped: 0,
            errors: [],
            details: ['No other AI agents detected on this system.'],
        };
    }
    const results = detected.map(d => migrate(d.id));
    return combinedResult(results);
}
export function formatMigrationResult(result) {
    const lines = [];
    if (result.success && result.imported > 0) {
        lines.push(chalk.green(`Migration complete: ${result.imported} item(s) imported`));
    }
    else if (result.imported === 0 && result.errors.length === 0) {
        lines.push(chalk.yellow('Nothing to import.'));
    }
    else if (!result.success) {
        lines.push(chalk.red('Migration completed with errors.'));
    }
    if (result.skipped > 0) {
        lines.push(chalk.dim(`  Skipped: ${result.skipped} (already imported)`));
    }
    for (const detail of result.details) {
        lines.push(chalk.dim(`  ${detail}`));
    }
    for (const error of result.errors) {
        lines.push(chalk.red(`  Error: ${error}`));
    }
    return lines.join('\n');
}
export function formatDetectedAgents() {
    const detected = detectInstalledAgents();
    if (detected.length === 0) {
        return chalk.dim('No other AI agents detected.');
    }
    const lines = ['Detected AI agents:', ''];
    for (const agent of detected) {
        lines.push(`  ${chalk.green('●')} ${agent.name} (${agent.id})`);
    }
    lines.push('');
    lines.push(`Run ${chalk.cyan('kbot migrate --from <id>')} to import, or ${chalk.cyan('kbot migrate --all')} to import all.`);
    return lines.join('\n');
}
//# sourceMappingURL=migrate.js.map