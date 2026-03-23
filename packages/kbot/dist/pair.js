// kbot Pair Programming Mode — Proactive file watcher + AI copilot
//
// Watches the current directory for file changes and provides real-time
// suggestions: type errors, lint issues, missing tests, security flags,
// style warnings, and AI-powered refactoring offers.
//
// Usage:
//   kbot pair                       # Watch cwd
//   kbot pair ./src                 # Watch specific path
//   kbot pair --quiet               # Errors only
//   kbot pair --auto-fix            # Apply safe fixes automatically
//
// Config: ~/.kbot/pair.json
import { watch, readFileSync, writeFileSync, existsSync, statSync, mkdirSync } from 'node:fs';
import { join, extname, basename, dirname, resolve } from 'node:path';
import { execSync, execFileSync } from 'node:child_process';
import { homedir } from 'node:os';
import chalk from 'chalk';
import ora from 'ora';
// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------
const ACCENT = chalk.hex('#A78BFA');
const ACCENT_DIM = chalk.hex('#7C6CB0');
const GREEN = chalk.hex('#4ADE80');
const RED = chalk.hex('#F87171');
const YELLOW = chalk.hex('#FBBF24');
const CYAN = chalk.hex('#67E8F9');
const DIM = chalk.dim;
const PAIR_CONFIG_PATH = join(homedir(), '.kbot', 'pair.json');
const DEBOUNCE_MS = 500;
const IGNORED_DIRS = new Set([
    'node_modules',
    '.git',
    'dist',
    'build',
    'coverage',
    '.next',
    '.nuxt',
    '__pycache__',
    '.turbo',
    '.cache',
    '.vite',
    '.parcel-cache',
]);
const IGNORED_FILES = new Set([
    '.DS_Store',
    'Thumbs.db',
]);
const IGNORED_EXTENSIONS = new Set([
    '.lock',
    '.map',
    '.log',
    '.ico',
    '.png',
    '.jpg',
    '.jpeg',
    '.gif',
    '.svg',
    '.woff',
    '.woff2',
    '.ttf',
    '.eot',
]);
const SOURCE_EXTENSIONS = new Set([
    '.ts', '.tsx', '.js', '.jsx', '.mjs', '.cjs',
    '.py', '.rs', '.go', '.rb', '.java', '.kt',
    '.c', '.cpp', '.h', '.hpp', '.cs', '.swift',
    '.vue', '.svelte', '.astro',
]);
const TS_EXTENSIONS = new Set(['.ts', '.tsx']);
const JS_TS_EXTENSIONS = new Set(['.ts', '.tsx', '.js', '.jsx', '.mjs', '.cjs']);
const DEFAULT_CHECKS = {
    typeErrors: true,
    lint: true,
    missingTests: true,
    imports: true,
    security: true,
    style: true,
};
const DEFAULT_CONFIG = {
    checks: DEFAULT_CHECKS,
    ignorePatterns: [],
    autoFix: false,
    bell: false,
    quiet: false,
};
// ---------------------------------------------------------------------------
// Security patterns — things we always flag
// ---------------------------------------------------------------------------
const SECURITY_PATTERNS = [
    { pattern: /\beval\s*\(/, message: 'eval() usage detected — potential code injection', severity: 'error' },
    { pattern: /\bnew\s+Function\s*\(/, message: 'Function() constructor — equivalent to eval()', severity: 'error' },
    { pattern: /dangerouslySetInnerHTML/, message: 'dangerouslySetInnerHTML — XSS risk if input is unsanitized', severity: 'warning' },
    { pattern: /['"](?:sk-|AKIA|ghp_|gho_|github_pat_|xox[bps]-|Bearer\s+ey)[A-Za-z0-9_-]{10,}['"]/, message: 'Possible hardcoded secret/API key', severity: 'error' },
    { pattern: /password\s*[:=]\s*['"][^'"]{4,}['"]/, message: 'Possible hardcoded password', severity: 'error' },
    { pattern: /\bexec\s*\(\s*['"`]/, message: 'Shell exec with string literal — injection risk', severity: 'warning' },
    { pattern: /\b(SUPABASE_SERVICE_KEY|DATABASE_URL|PRIVATE_KEY)\s*[:=]\s*['"]/, message: 'Hardcoded sensitive environment variable', severity: 'error' },
];
// ---------------------------------------------------------------------------
// Module state
// ---------------------------------------------------------------------------
let activeWatcher = null;
let debounceTimer = null;
const pendingChanges = new Set();
let sessionStats = { filesAnalyzed: 0, suggestionsShown: 0, fixesApplied: 0, errorsFound: 0 };
// ---------------------------------------------------------------------------
// Config management
// ---------------------------------------------------------------------------
function loadPairConfig() {
    try {
        if (existsSync(PAIR_CONFIG_PATH)) {
            const raw = readFileSync(PAIR_CONFIG_PATH, 'utf-8');
            const parsed = JSON.parse(raw);
            return {
                checks: { ...DEFAULT_CHECKS, ...parsed.checks },
                ignorePatterns: parsed.ignorePatterns || [],
                autoFix: parsed.autoFix ?? false,
                bell: parsed.bell ?? false,
                quiet: parsed.quiet ?? false,
            };
        }
    }
    catch {
        // Corrupted config — use defaults
    }
    return { ...DEFAULT_CONFIG };
}
function savePairConfig(config) {
    try {
        const dir = dirname(PAIR_CONFIG_PATH);
        if (!existsSync(dir)) {
            mkdirSync(dir, { recursive: true });
        }
        writeFileSync(PAIR_CONFIG_PATH, JSON.stringify(config, null, 2), 'utf-8');
    }
    catch {
        // Non-critical — config save failure is okay
    }
}
// ---------------------------------------------------------------------------
// File filtering
// ---------------------------------------------------------------------------
function shouldIgnore(filePath, extraPatterns) {
    const parts = filePath.split(/[/\\]/);
    // Check ignored directories
    for (const part of parts) {
        if (IGNORED_DIRS.has(part))
            return true;
    }
    // Check ignored files
    const name = basename(filePath);
    if (IGNORED_FILES.has(name))
        return true;
    // Check ignored extensions
    const ext = extname(filePath);
    if (IGNORED_EXTENSIONS.has(ext))
        return true;
    // Check .env files
    if (name.startsWith('.env'))
        return true;
    // Check user-defined ignore patterns (simple glob matching)
    for (const pattern of extraPatterns) {
        if (matchSimpleGlob(filePath, pattern))
            return true;
    }
    return false;
}
function matchSimpleGlob(filePath, pattern) {
    // Support basic patterns: *.ext, dir/*, **/dir/*
    const escaped = pattern
        .replace(/[.+^${}()|[\]\\]/g, '\\$&')
        .replace(/\*\*/g, '__DOUBLESTAR__')
        .replace(/\*/g, '[^/]*')
        .replace(/__DOUBLESTAR__/g, '.*');
    try {
        return new RegExp(`^${escaped}$`).test(filePath);
    }
    catch {
        return false;
    }
}
function isSourceFile(filePath) {
    return SOURCE_EXTENSIONS.has(extname(filePath).toLowerCase());
}
// ---------------------------------------------------------------------------
// Change classification
// ---------------------------------------------------------------------------
function classifyChange(fullPath, relativePath) {
    let type = 'edit';
    try {
        statSync(fullPath);
        // File exists — was it newly created or edited?
        try {
            const diffOutput = execSync(`git diff --name-only --diff-filter=A HEAD -- "${relativePath}"`, { encoding: 'utf-8', timeout: 3000, stdio: ['pipe', 'pipe', 'pipe'] }).trim();
            if (diffOutput.includes(basename(relativePath))) {
                type = 'create';
            }
        }
        catch {
            // Not in git or no previous commits — treat new files as creates
            try {
                execSync(`git status --porcelain -- "${relativePath}"`, { encoding: 'utf-8', timeout: 3000, stdio: ['pipe', 'pipe', 'pipe'] }).trim().startsWith('??') && (type = 'create');
            }
            catch {
                // Not in a git repo — just call it an edit
            }
        }
    }
    catch {
        // File doesn't exist — it was deleted
        type = 'delete';
    }
    return { file: relativePath, fullPath, type };
}
function getGitDiff(relativePath) {
    try {
        // Try staged + unstaged diff
        const diff = execSync(`git diff HEAD -- "${relativePath}" 2>/dev/null || git diff -- "${relativePath}" 2>/dev/null`, { encoding: 'utf-8', timeout: 5000, shell: '/bin/sh', stdio: ['pipe', 'pipe', 'pipe'] }).trim();
        return diff;
    }
    catch {
        return '';
    }
}
// ---------------------------------------------------------------------------
// Analysis checks
// ---------------------------------------------------------------------------
function checkTypeErrors(change) {
    const ext = extname(change.file).toLowerCase();
    if (!TS_EXTENSIONS.has(ext))
        return [];
    const suggestions = [];
    try {
        // Run tsc on just this file — check for type errors
        execFileSync('npx', ['tsc', '--noEmit', '--pretty', 'false', change.fullPath], {
            encoding: 'utf-8',
            timeout: 15000,
            stdio: ['pipe', 'pipe', 'pipe'],
        });
    }
    catch (err) {
        const output = err instanceof Error && 'stderr' in err
            ? String(err.stderr)
            : err instanceof Error && 'stdout' in err
                ? String(err.stdout)
                : '';
        if (output) {
            // Parse tsc error output: file(line,col): error TS1234: message
            const errorPattern = /\((\d+),\d+\):\s*error\s+(TS\d+):\s*(.+)/g;
            let match;
            while ((match = errorPattern.exec(output)) !== null) {
                suggestions.push({
                    type: 'error',
                    category: 'type',
                    file: change.file,
                    line: parseInt(match[1], 10),
                    message: `${match[2]}: ${match[3]}`,
                });
            }
            // If no structured errors parsed but there was output, show raw
            if (suggestions.length === 0 && output.includes('error TS')) {
                const lines = output.split('\n').filter(l => l.includes('error TS')).slice(0, 5);
                for (const line of lines) {
                    suggestions.push({
                        type: 'error',
                        category: 'type',
                        file: change.file,
                        message: line.trim(),
                    });
                }
            }
        }
    }
    return suggestions;
}
function checkLint(change) {
    const ext = extname(change.file).toLowerCase();
    if (!JS_TS_EXTENSIONS.has(ext))
        return [];
    const suggestions = [];
    // Check if eslint config exists in the project
    const projectRoot = findProjectRoot(change.fullPath);
    if (!projectRoot)
        return [];
    const eslintConfigs = [
        '.eslintrc.js', '.eslintrc.cjs', '.eslintrc.json', '.eslintrc.yml', '.eslintrc.yaml',
        'eslint.config.js', 'eslint.config.mjs', 'eslint.config.cjs', 'eslint.config.ts',
    ];
    const hasEslint = eslintConfigs.some(c => existsSync(join(projectRoot, c)));
    if (!hasEslint)
        return [];
    try {
        execFileSync('npx', ['eslint', '--format', 'compact', change.fullPath], {
            encoding: 'utf-8',
            timeout: 15000,
            cwd: projectRoot,
            stdio: ['pipe', 'pipe', 'pipe'],
        });
    }
    catch (err) {
        const output = err instanceof Error && 'stdout' in err
            ? String(err.stdout)
            : '';
        if (output) {
            // Parse eslint compact format: file: line:col - message (rule)
            const errorPattern = /: line (\d+), col \d+, (\w+) - (.+)/g;
            let match;
            while ((match = errorPattern.exec(output)) !== null) {
                const severity = match[2] === 'Error' ? 'error' : 'warning';
                suggestions.push({
                    type: severity,
                    category: 'lint',
                    file: change.file,
                    line: parseInt(match[1], 10),
                    message: match[3],
                });
            }
        }
    }
    return suggestions;
}
function checkMissingTests(change) {
    const ext = extname(change.file).toLowerCase();
    if (!SOURCE_EXTENSIONS.has(ext))
        return [];
    // Skip test files themselves
    const name = basename(change.file);
    if (name.includes('.test.') || name.includes('.spec.') || name.includes('__test__'))
        return [];
    // Skip non-logic files
    if (name.startsWith('index.') || name.endsWith('.d.ts') || name.includes('.config.'))
        return [];
    const suggestions = [];
    // Check for corresponding test file
    const dir = dirname(change.fullPath);
    const nameWithoutExt = basename(change.file, ext);
    const testPatterns = [
        join(dir, `${nameWithoutExt}.test${ext}`),
        join(dir, `${nameWithoutExt}.spec${ext}`),
        join(dir, '__tests__', `${nameWithoutExt}.test${ext}`),
        join(dir, '__tests__', `${nameWithoutExt}.spec${ext}`),
        // Also check for .test.ts when the source is .ts
        join(dir, `${nameWithoutExt}.test.ts`),
        join(dir, `${nameWithoutExt}.spec.ts`),
    ];
    const hasTest = testPatterns.some(p => existsSync(p));
    if (!hasTest) {
        suggestions.push({
            type: 'info',
            category: 'test',
            file: change.file,
            message: `No test file found. Consider creating ${nameWithoutExt}.test${ext}`,
        });
    }
    return suggestions;
}
function checkImports(change) {
    const ext = extname(change.file).toLowerCase();
    if (!JS_TS_EXTENSIONS.has(ext))
        return [];
    const suggestions = [];
    let content;
    try {
        content = readFileSync(change.fullPath, 'utf-8');
    }
    catch {
        return [];
    }
    const lines = content.split('\n');
    // Check for unresolved relative imports
    const importPattern = /(?:import|from)\s+['"](\.[^'"]+)['"]/g;
    let match;
    while ((match = importPattern.exec(content)) !== null) {
        const importPath = match[1];
        const dir = dirname(change.fullPath);
        // Resolve the import — check with and without common extensions
        const resolved = resolve(dir, importPath);
        const resolveExtensions = ['.ts', '.tsx', '.js', '.jsx', '.mjs', '.cjs', '/index.ts', '/index.tsx', '/index.js', '/index.jsx', ''];
        const exists = resolveExtensions.some(ext => existsSync(resolved + ext));
        if (!exists) {
            // Find line number
            const lineIdx = lines.findIndex(l => l.includes(importPath));
            suggestions.push({
                type: 'error',
                category: 'import',
                file: change.file,
                line: lineIdx >= 0 ? lineIdx + 1 : undefined,
                message: `Unresolved import: ${importPath}`,
            });
        }
    }
    return suggestions;
}
function checkSecurity(change) {
    let content;
    try {
        content = readFileSync(change.fullPath, 'utf-8');
    }
    catch {
        return [];
    }
    const suggestions = [];
    const lines = content.split('\n');
    for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        // Skip comments
        const trimmed = line.trimStart();
        if (trimmed.startsWith('//') || trimmed.startsWith('#') || trimmed.startsWith('*'))
            continue;
        for (const { pattern, message, severity } of SECURITY_PATTERNS) {
            if (pattern.test(line)) {
                suggestions.push({
                    type: severity,
                    category: 'security',
                    file: change.file,
                    line: i + 1,
                    message,
                });
            }
        }
    }
    return suggestions;
}
function checkStyle(change) {
    let content;
    try {
        content = readFileSync(change.fullPath, 'utf-8');
    }
    catch {
        return [];
    }
    const suggestions = [];
    const lines = content.split('\n');
    const ext = extname(change.file).toLowerCase();
    // --- console.log left in (non-test files, non-debug files) ---
    if (JS_TS_EXTENSIONS.has(ext)) {
        const name = basename(change.file);
        const isDebugFile = name.includes('debug') || name.includes('logger') || name.includes('log');
        const isTestFile = name.includes('.test.') || name.includes('.spec.');
        if (!isDebugFile && !isTestFile) {
            for (let i = 0; i < lines.length; i++) {
                const trimmed = lines[i].trimStart();
                if (trimmed.startsWith('//') || trimmed.startsWith('*'))
                    continue;
                if (/\bconsole\.log\s*\(/.test(lines[i])) {
                    suggestions.push({
                        type: 'info',
                        category: 'style',
                        file: change.file,
                        line: i + 1,
                        message: 'console.log left in — remove before shipping?',
                    });
                }
            }
        }
    }
    // --- TODO/FIXME/HACK comments ---
    const todoPattern = /\b(TODO|FIXME|HACK|XXX)\b:?\s*(.+)/i;
    for (let i = 0; i < lines.length; i++) {
        const match = todoPattern.exec(lines[i]);
        if (match) {
            suggestions.push({
                type: 'info',
                category: 'style',
                file: change.file,
                line: i + 1,
                message: `${match[1].toUpperCase()}: ${match[2].trim()}`,
            });
        }
    }
    // --- Large functions (>50 lines) ---
    if (JS_TS_EXTENSIONS.has(ext)) {
        detectLargeFunctions(lines, change.file, suggestions);
    }
    return suggestions;
}
function detectLargeFunctions(lines, file, suggestions) {
    // Heuristic: find function/method declarations and track brace depth
    const funcPattern = /(?:(?:export\s+)?(?:async\s+)?function\s+(\w+)|(?:const|let|var)\s+(\w+)\s*=\s*(?:async\s+)?(?:\([^)]*\)|[^=])\s*=>|(\w+)\s*\([^)]*\)\s*(?::\s*\w+\s*)?{)/;
    let currentFunc = null;
    for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        // Check for function start
        if (!currentFunc) {
            const match = funcPattern.exec(line);
            if (match && line.includes('{')) {
                const name = match[1] || match[2] || match[3] || 'anonymous';
                currentFunc = { name, startLine: i + 1, braceDepth: 0 };
                // Count braces on this line
                for (const ch of line) {
                    if (ch === '{')
                        currentFunc.braceDepth++;
                    if (ch === '}')
                        currentFunc.braceDepth--;
                }
                continue;
            }
        }
        // Track brace depth for current function
        if (currentFunc) {
            for (const ch of line) {
                if (ch === '{')
                    currentFunc.braceDepth++;
                if (ch === '}')
                    currentFunc.braceDepth--;
            }
            if (currentFunc.braceDepth <= 0) {
                const length = i + 1 - currentFunc.startLine;
                if (length > 50) {
                    suggestions.push({
                        type: 'info',
                        category: 'style',
                        file,
                        line: currentFunc.startLine,
                        message: `Function '${currentFunc.name}' is ${length} lines — consider breaking it up`,
                    });
                }
                currentFunc = null;
            }
        }
    }
}
// ---------------------------------------------------------------------------
// Auto-fix (safe fixes only)
// ---------------------------------------------------------------------------
function tryAutoFix(change, suggestions) {
    const applied = [];
    let content;
    try {
        content = readFileSync(change.fullPath, 'utf-8');
    }
    catch {
        return applied;
    }
    let modified = content;
    let didModify = false;
    // Fix 1: Remove unused imports (only if tsc flagged them)
    const unusedImportSuggestions = suggestions.filter(s => s.category === 'type' && s.message.includes('is declared but'));
    if (unusedImportSuggestions.length > 0) {
        const lines = modified.split('\n');
        for (const suggestion of unusedImportSuggestions) {
            if (suggestion.line && suggestion.line <= lines.length) {
                const line = lines[suggestion.line - 1];
                // Only remove if it's a simple single-name import line
                if (/^\s*import\s+\w+\s+from\s+['"]/.test(line) || /^\s*import\s+type\s+\w+\s+from\s+['"]/.test(line)) {
                    lines[suggestion.line - 1] = '';
                    didModify = true;
                    applied.push({
                        type: 'fix',
                        category: 'import',
                        file: change.file,
                        line: suggestion.line,
                        message: `Removed unused import`,
                        fix: `Deleted: ${line.trim()}`,
                    });
                }
            }
        }
        if (didModify) {
            modified = lines.filter(l => l !== '' || !didModify).join('\n');
        }
    }
    // Fix 2: Remove trailing whitespace
    const trimmed = modified.replace(/[ \t]+$/gm, '');
    if (trimmed !== modified) {
        modified = trimmed;
        didModify = true;
        applied.push({
            type: 'fix',
            category: 'style',
            file: change.file,
            message: 'Removed trailing whitespace',
        });
    }
    if (didModify) {
        try {
            writeFileSync(change.fullPath, modified, 'utf-8');
        }
        catch {
            // Write failed — discard auto-fix
            return [];
        }
    }
    return applied;
}
// ---------------------------------------------------------------------------
// Utility
// ---------------------------------------------------------------------------
function findProjectRoot(filePath) {
    let dir = dirname(filePath);
    const root = resolve('/');
    while (dir !== root) {
        if (existsSync(join(dir, 'package.json')) || existsSync(join(dir, 'tsconfig.json'))) {
            return dir;
        }
        const parent = dirname(dir);
        if (parent === dir)
            break;
        dir = parent;
    }
    return null;
}
// ---------------------------------------------------------------------------
// Output formatting
// ---------------------------------------------------------------------------
const CATEGORY_LABELS = {
    type: 'TYPE',
    lint: 'LINT',
    test: 'TEST',
    import: 'IMPORT',
    security: 'SECURITY',
    style: 'STYLE',
    ai: 'AI',
};
const CATEGORY_COLORS = {
    type: RED,
    lint: YELLOW,
    test: CYAN,
    import: RED,
    security: RED,
    style: DIM,
    ai: ACCENT,
};
function formatSuggestion(s) {
    const label = CATEGORY_LABELS[s.category] || s.category.toUpperCase();
    const colorFn = CATEGORY_COLORS[s.category] || DIM;
    const icon = s.type === 'error' ? RED('!') :
        s.type === 'warning' ? YELLOW('!') :
            s.type === 'fix' ? GREEN('+') :
                DIM('-');
    const lineRef = s.line ? DIM(`:${s.line}`) : '';
    const tag = colorFn(`[${label}]`);
    return `    ${icon} ${tag} ${s.message}${lineRef}`;
}
function formatChangeHeader(change) {
    const time = new Date().toLocaleTimeString('en-US', { hour12: false });
    const typeColors = {
        create: GREEN,
        edit: ACCENT,
        delete: RED,
        rename: YELLOW,
    };
    const colorFn = typeColors[change.type] || DIM;
    return `  ${DIM(time)} ${ACCENT_DIM('pair:')} ${chalk.bold(change.file)} ${colorFn(change.type)}`;
}
function printSummaryLine(suggestions) {
    const errors = suggestions.filter(s => s.type === 'error').length;
    const warnings = suggestions.filter(s => s.type === 'warning').length;
    const infos = suggestions.filter(s => s.type === 'info').length;
    const fixes = suggestions.filter(s => s.type === 'fix').length;
    const parts = [];
    if (errors > 0)
        parts.push(RED(`${errors} error${errors > 1 ? 's' : ''}`));
    if (warnings > 0)
        parts.push(YELLOW(`${warnings} warning${warnings > 1 ? 's' : ''}`));
    if (infos > 0)
        parts.push(DIM(`${infos} suggestion${infos > 1 ? 's' : ''}`));
    if (fixes > 0)
        parts.push(GREEN(`${fixes} auto-fixed`));
    if (parts.length > 0) {
        process.stderr.write(`    ${parts.join(DIM(' | '))}\n`);
    }
}
// ---------------------------------------------------------------------------
// Analysis pipeline
// ---------------------------------------------------------------------------
async function analyzeChanges(changes, config, options) {
    const spinner = ora({
        text: DIM(`Analyzing ${changes.length} file${changes.length > 1 ? 's' : ''}...`),
        color: 'magenta',
        spinner: 'dots',
        stream: process.stderr,
    });
    spinner.start();
    let totalSuggestions = [];
    for (const change of changes) {
        // Skip deleted files — nothing to analyze
        if (change.type === 'delete') {
            spinner.stop();
            process.stderr.write(formatChangeHeader(change) + '\n');
            continue;
        }
        // Skip non-source files for most checks
        const isSource = isSourceFile(change.file);
        const suggestions = [];
        // Run enabled checks
        if (isSource && config.checks.typeErrors) {
            suggestions.push(...checkTypeErrors(change));
        }
        if (isSource && config.checks.lint) {
            suggestions.push(...checkLint(change));
        }
        if (isSource && config.checks.missingTests) {
            suggestions.push(...checkMissingTests(change));
        }
        if (isSource && config.checks.imports) {
            suggestions.push(...checkImports(change));
        }
        if (config.checks.security) {
            suggestions.push(...checkSecurity(change));
        }
        if (isSource && config.checks.style) {
            suggestions.push(...checkStyle(change));
        }
        // Apply auto-fixes if enabled
        let autoFixed = [];
        if (config.autoFix || options.autoFix) {
            autoFixed = tryAutoFix(change, suggestions);
            suggestions.push(...autoFixed);
            sessionStats.fixesApplied += autoFixed.length;
        }
        spinner.stop();
        // In quiet mode, only show errors
        const filtered = config.quiet || options.quiet
            ? suggestions.filter(s => s.type === 'error' || s.type === 'fix')
            : suggestions;
        // Display results
        if (filtered.length > 0 || !config.quiet) {
            process.stderr.write(formatChangeHeader(change) + '\n');
            if (filtered.length > 0) {
                for (const s of filtered) {
                    process.stderr.write(formatSuggestion(s) + '\n');
                }
                printSummaryLine(filtered);
                // Terminal bell on errors
                if ((config.bell || options.bell) && filtered.some(s => s.type === 'error')) {
                    process.stderr.write('\x07');
                }
            }
            else {
                process.stderr.write(`    ${GREEN('+')} ${DIM('No issues')}\n`);
            }
        }
        // Update stats
        sessionStats.filesAnalyzed++;
        sessionStats.suggestionsShown += filtered.length;
        sessionStats.errorsFound += suggestions.filter(s => s.type === 'error').length;
        totalSuggestions.push(...suggestions);
    }
    // If any suggestions need AI analysis, offer it
    const hasComplexIssues = totalSuggestions.some(s => s.category === 'style' && s.message.includes('lines') ||
        s.type === 'error' && totalSuggestions.filter(x => x.type === 'error').length > 3);
    if (hasComplexIssues && !config.quiet && !options.quiet) {
        process.stderr.write(`\n    ${ACCENT('?')} ${DIM('Complex issues detected. Type')} ${chalk.white('kbot pair --analyze')} ${DIM('to get AI suggestions.')}\n`);
    }
}
// ---------------------------------------------------------------------------
// Main entry: startPairMode
// ---------------------------------------------------------------------------
export async function startPairMode(options = {}) {
    // Stop any existing pair session
    if (activeWatcher) {
        stopPairMode();
    }
    // Load config — CLI options override config file
    const config = loadPairConfig();
    if (options.quiet !== undefined)
        config.quiet = options.quiet;
    if (options.autoFix !== undefined)
        config.autoFix = options.autoFix;
    if (options.bell !== undefined)
        config.bell = options.bell;
    if (options.checks)
        config.checks = { ...config.checks, ...options.checks };
    if (options.ignorePatterns)
        config.ignorePatterns = [...config.ignorePatterns, ...options.ignorePatterns];
    const watchPath = resolve(options.path || process.cwd());
    // Verify the path exists and is a directory
    try {
        const stat = statSync(watchPath);
        if (!stat.isDirectory()) {
            process.stderr.write(`  ${RED('!')} ${watchPath} is not a directory\n`);
            return;
        }
    }
    catch {
        process.stderr.write(`  ${RED('!')} ${watchPath} does not exist\n`);
        return;
    }
    // Reset session stats
    sessionStats = { filesAnalyzed: 0, suggestionsShown: 0, fixesApplied: 0, errorsFound: 0 };
    // Print banner
    process.stderr.write('\n');
    process.stderr.write(`  ${ACCENT('kbot')} ${chalk.bold('pair')} ${DIM('— watching for changes')}\n`);
    process.stderr.write(`  ${DIM('Path:')}      ${watchPath}\n`);
    const enabledChecks = Object.entries(config.checks)
        .filter(([, v]) => v)
        .map(([k]) => k);
    process.stderr.write(`  ${DIM('Checks:')}    ${enabledChecks.join(', ')}\n`);
    if (config.autoFix) {
        process.stderr.write(`  ${DIM('Auto-fix:')}  ${GREEN('enabled')}\n`);
    }
    if (config.quiet) {
        process.stderr.write(`  ${DIM('Mode:')}      ${YELLOW('quiet')} (errors only)\n`);
    }
    process.stderr.write(`  ${DIM('Press Ctrl+C to stop')}\n`);
    process.stderr.write('\n');
    // Start watching
    try {
        activeWatcher = watch(watchPath, { recursive: true }, (eventType, filename) => {
            if (!filename)
                return;
            const fullPath = join(watchPath, filename);
            // Ignore filtered paths
            if (shouldIgnore(filename, config.ignorePatterns))
                return;
            // Only watch source files (and JSON configs, YAML, etc.)
            const ext = extname(filename).toLowerCase();
            if (!SOURCE_EXTENSIONS.has(ext) && ext !== '.json' && ext !== '.yaml' && ext !== '.yml' && ext !== '.toml')
                return;
            // Add to pending changes
            pendingChanges.add(filename);
            // Debounce — wait for rapid saves to finish
            if (debounceTimer) {
                clearTimeout(debounceTimer);
            }
            debounceTimer = setTimeout(async () => {
                // Snapshot and clear pending changes
                const batch = [...pendingChanges];
                pendingChanges.clear();
                debounceTimer = null;
                // Classify each change
                const changes = batch.map(file => {
                    const full = join(watchPath, file);
                    return classifyChange(full, file);
                });
                // Run analysis pipeline
                await analyzeChanges(changes, config, options);
            }, DEBOUNCE_MS);
        });
        activeWatcher.on('error', (err) => {
            process.stderr.write(`  ${RED('!')} Watch error: ${err.message}\n`);
        });
        // Keep the process alive until Ctrl+C
        await new Promise((resolve) => {
            const cleanup = () => {
                stopPairMode();
                resolve();
            };
            process.on('SIGINT', cleanup);
            process.on('SIGTERM', cleanup);
        });
    }
    catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        process.stderr.write(`  ${RED('!')} Failed to start pair mode: ${message}\n`);
    }
}
export function stopPairMode() {
    if (activeWatcher) {
        activeWatcher.close();
        activeWatcher = null;
        if (debounceTimer) {
            clearTimeout(debounceTimer);
            debounceTimer = null;
        }
        pendingChanges.clear();
        // Print session summary
        process.stderr.write('\n');
        process.stderr.write(`  ${ACCENT_DIM('pair:')} ${DIM('Session ended')}\n`);
        process.stderr.write(`    ${DIM('Files analyzed:')}  ${sessionStats.filesAnalyzed}\n`);
        process.stderr.write(`    ${DIM('Suggestions:')}     ${sessionStats.suggestionsShown}\n`);
        process.stderr.write(`    ${DIM('Errors found:')}    ${sessionStats.errorsFound}\n`);
        if (sessionStats.fixesApplied > 0) {
            process.stderr.write(`    ${DIM('Auto-fixed:')}      ${GREEN(String(sessionStats.fixesApplied))}\n`);
        }
        process.stderr.write('\n');
    }
}
/**
 * Check if pair mode is currently active.
 */
export function isPairActive() {
    return activeWatcher !== null;
}
/**
 * Get current session stats.
 */
export function getPairStats() {
    return { ...sessionStats };
}
// ---------------------------------------------------------------------------
// AI-powered analysis (calls agent loop)
// ---------------------------------------------------------------------------
/**
 * Request AI analysis for a specific file. Uses the kbot agent loop to
 * provide deeper suggestions: refactoring, architecture, patterns.
 *
 * This is called when the user explicitly requests it (not on every save).
 */
export async function analyzeWithAgent(filePath, agentOptions) {
    const { runAgent } = await import('./agent.js');
    let content;
    try {
        content = readFileSync(filePath, 'utf-8');
    }
    catch {
        return 'Could not read file.';
    }
    const diff = getGitDiff(filePath);
    const ext = extname(filePath).toLowerCase();
    const prompt = [
        `You are a pair programming assistant reviewing a file change.`,
        `File: ${filePath} (${ext})`,
        diff ? `\nRecent changes (git diff):\n\`\`\`\n${diff.slice(0, 3000)}\n\`\`\`` : '',
        `\nFull file:\n\`\`\`${ext.slice(1)}\n${content.slice(0, 8000)}\n\`\`\``,
        `\nProvide concise, actionable suggestions:`,
        `1. Any bugs or logic errors in the changed code`,
        `2. Refactoring opportunities (keep it practical, not academic)`,
        `3. Missing edge cases or error handling`,
        `4. Performance concerns`,
        `\nBe direct. No fluff. If the code is fine, say so.`,
    ].join('\n');
    try {
        const response = await runAgent(prompt, {
            agent: agentOptions?.agent || 'coder',
            model: agentOptions?.model,
            tier: agentOptions?.tier,
            skipPlanner: true,
        });
        return response.content;
    }
    catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        return `AI analysis failed: ${message}`;
    }
}
// ---------------------------------------------------------------------------
// CLI registration
// ---------------------------------------------------------------------------
/**
 * Register the `kbot pair` command with the CLI program.
 *
 * Usage from cli.ts:
 *   import { registerPairCommand } from './pair.js'
 *   registerPairCommand(program)
 */
export function registerPairCommand(program) {
    program
        .command('pair [path]')
        .description('Pair programming mode — watch files and get real-time suggestions')
        .option('-q, --quiet', 'Only show errors, suppress suggestions')
        .option('--auto-fix', 'Automatically apply safe fixes (trailing whitespace, unused imports)')
        .option('--bell', 'Sound terminal bell on errors')
        .option('--no-types', 'Disable TypeScript type checking')
        .option('--no-lint', 'Disable ESLint checks')
        .option('--no-tests', 'Disable missing test detection')
        .option('--no-security', 'Disable security scanning')
        .option('--no-style', 'Disable style checks')
        .option('--ignore <patterns>', 'Additional ignore patterns (comma-separated)')
        .option('--config', 'Show current pair config')
        .option('--reset-config', 'Reset pair config to defaults')
        .action(async (pairPath, opts) => {
        // --config: show current config and exit
        if (opts?.config) {
            const config = loadPairConfig();
            process.stderr.write(`\n  ${ACCENT('kbot')} ${chalk.bold('pair')} ${DIM('config')}\n`);
            process.stderr.write(`  ${DIM('Path:')} ${PAIR_CONFIG_PATH}\n\n`);
            process.stderr.write(`  ${JSON.stringify(config, null, 2).split('\n').join('\n  ')}\n\n`);
            return;
        }
        // --reset-config: reset to defaults
        if (opts?.resetConfig) {
            savePairConfig(DEFAULT_CONFIG);
            process.stderr.write(`  ${GREEN('+')} Pair config reset to defaults\n`);
            return;
        }
        const checks = {};
        if (opts?.types === false)
            checks.typeErrors = false;
        if (opts?.lint === false)
            checks.lint = false;
        if (opts?.tests === false)
            checks.missingTests = false;
        if (opts?.security === false)
            checks.security = false;
        if (opts?.style === false)
            checks.style = false;
        const ignorePatterns = opts?.ignore
            ? opts.ignore.split(',').map(p => p.trim())
            : undefined;
        await startPairMode({
            path: pairPath || process.cwd(),
            quiet: opts?.quiet,
            autoFix: opts?.autoFix,
            bell: opts?.bell,
            checks: Object.keys(checks).length > 0 ? checks : undefined,
            ignorePatterns,
        });
    });
}
//# sourceMappingURL=pair.js.map