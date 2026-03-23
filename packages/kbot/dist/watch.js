import { watch, statSync, readFileSync } from 'node:fs';
import { join, extname } from 'node:path';
import chalk from 'chalk';
// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------
const DEFAULT_EXTENSIONS = [
    '.ts', '.tsx', '.js', '.jsx', '.mjs', '.cjs',
    '.py', '.rs', '.go', '.rb', '.java', '.kt',
    '.c', '.cpp', '.h', '.hpp', '.cs', '.swift',
    '.vue', '.svelte', '.astro',
];
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
]);
const IGNORED_EXTENSIONS = new Set([
    '.map',
    '.lock',
    '.log',
]);
const DEBOUNCE_MS = 500;
const MAX_CHANGE_LOG = 20;
// ---------------------------------------------------------------------------
// Module state
// ---------------------------------------------------------------------------
let activeWatcher = null;
let changeLog = [];
const debounceTimers = new Map();
// ---------------------------------------------------------------------------
// Analysis helpers
// ---------------------------------------------------------------------------
function shouldIgnore(filePath) {
    const parts = filePath.split(/[/\\]/);
    for (const part of parts) {
        if (IGNORED_DIRS.has(part))
            return true;
    }
    const ext = extname(filePath);
    if (IGNORED_EXTENSIONS.has(ext))
        return true;
    return false;
}
function isSourceFile(filePath, extensions) {
    const ext = extname(filePath).toLowerCase();
    return extensions.includes(ext);
}
/**
 * Perform lightweight static analysis on a source file.
 * This is intentionally heuristic-based — no AST parsing.
 */
function analyzeFile(filePath) {
    const analysis = {
        todos: 0,
        debugStatements: 0,
        syntaxIssues: [],
        lineCount: 0,
    };
    let content;
    try {
        content = readFileSync(filePath, 'utf-8');
    }
    catch {
        return analysis;
    }
    const lines = content.split('\n');
    analysis.lineCount = lines.length;
    // --- TODO / FIXME detection ---
    const todoPattern = /\b(TODO|FIXME|HACK|XXX|WARN)\b/i;
    for (const line of lines) {
        if (todoPattern.test(line)) {
            analysis.todos++;
        }
    }
    // --- Debug statement detection ---
    const ext = extname(filePath).toLowerCase();
    const debugPatterns = [];
    if (['.ts', '.tsx', '.js', '.jsx', '.mjs', '.cjs', '.vue', '.svelte'].includes(ext)) {
        debugPatterns.push(/\bconsole\.(log|debug|info|warn|error|trace|dir|table)\s*\(/, /\bdebugger\b/);
    }
    else if (ext === '.py') {
        debugPatterns.push(/\bprint\s*\(/, /\bbreakpoint\s*\(/, /\bpdb\.set_trace\s*\(/);
    }
    else if (ext === '.rs') {
        debugPatterns.push(/\bprintln!\s*\(/, /\bdbg!\s*\(/, /\beprintln!\s*\(/);
    }
    else if (ext === '.go') {
        debugPatterns.push(/\bfmt\.Print(ln|f)?\s*\(/, /\blog\.Print(ln|f)?\s*\(/);
    }
    else if (ext === '.rb') {
        debugPatterns.push(/\bputs\b/, /\bpp\b/, /\bbinding\.pry\b/);
    }
    for (const line of lines) {
        // Skip lines that are comments (rough heuristic)
        const trimmed = line.trimStart();
        if (trimmed.startsWith('//') || trimmed.startsWith('#') || trimmed.startsWith('*'))
            continue;
        for (const pattern of debugPatterns) {
            if (pattern.test(line)) {
                analysis.debugStatements++;
                break; // count once per line
            }
        }
    }
    // --- Syntax issue detection (basic heuristics) ---
    detectSyntaxIssues(content, lines, ext, analysis);
    return analysis;
}
function detectSyntaxIssues(content, lines, ext, analysis) {
    // Check unmatched braces/brackets/parens (for brace-based languages)
    if (['.ts', '.tsx', '.js', '.jsx', '.mjs', '.cjs', '.rs', '.go', '.java', '.c', '.cpp', '.cs', '.kt', '.swift'].includes(ext)) {
        let braces = 0;
        let brackets = 0;
        let parens = 0;
        let inString = false;
        let stringChar = '';
        let inLineComment = false;
        let inBlockComment = false;
        for (let i = 0; i < content.length; i++) {
            const ch = content[i];
            const next = content[i + 1];
            // Track comments
            if (!inString && !inBlockComment && ch === '/' && next === '/') {
                inLineComment = true;
                continue;
            }
            if (!inString && !inLineComment && ch === '/' && next === '*') {
                inBlockComment = true;
                i++;
                continue;
            }
            if (inBlockComment && ch === '*' && next === '/') {
                inBlockComment = false;
                i++;
                continue;
            }
            if (inLineComment && ch === '\n') {
                inLineComment = false;
                continue;
            }
            if (inLineComment || inBlockComment)
                continue;
            // Track strings
            if (!inString && (ch === '"' || ch === "'" || ch === '`')) {
                inString = true;
                stringChar = ch;
                continue;
            }
            if (inString && ch === stringChar && content[i - 1] !== '\\') {
                inString = false;
                continue;
            }
            if (inString)
                continue;
            // Count delimiters
            if (ch === '{')
                braces++;
            else if (ch === '}')
                braces--;
            else if (ch === '[')
                brackets++;
            else if (ch === ']')
                brackets--;
            else if (ch === '(')
                parens++;
            else if (ch === ')')
                parens--;
        }
        if (braces !== 0) {
            analysis.syntaxIssues.push(`Unmatched braces (balance: ${braces > 0 ? '+' : ''}${braces})`);
        }
        if (brackets !== 0) {
            analysis.syntaxIssues.push(`Unmatched brackets (balance: ${brackets > 0 ? '+' : ''}${brackets})`);
        }
        if (parens !== 0) {
            analysis.syntaxIssues.push(`Unmatched parentheses (balance: ${parens > 0 ? '+' : ''}${parens})`);
        }
        // Check if still inside a string at EOF
        if (inString) {
            analysis.syntaxIssues.push(`Unclosed string literal (opened with ${stringChar})`);
        }
    }
    // Check for unclosed template literals in JS/TS
    if (['.ts', '.tsx', '.js', '.jsx', '.mjs', '.cjs'].includes(ext)) {
        let backtickCount = 0;
        let inRegularString = false;
        let regularStringChar = '';
        for (let i = 0; i < content.length; i++) {
            const ch = content[i];
            if (!inRegularString && (ch === '"' || ch === "'")) {
                inRegularString = true;
                regularStringChar = ch;
                continue;
            }
            if (inRegularString && ch === regularStringChar && content[i - 1] !== '\\') {
                inRegularString = false;
                continue;
            }
            if (inRegularString)
                continue;
            if (ch === '`' && content[i - 1] !== '\\') {
                backtickCount++;
            }
        }
        if (backtickCount % 2 !== 0) {
            analysis.syntaxIssues.push('Unclosed template literal (odd number of backticks)');
        }
    }
}
// ---------------------------------------------------------------------------
// Display
// ---------------------------------------------------------------------------
function formatEvent(event) {
    const relPath = event.file;
    const time = event.timestamp.toLocaleTimeString('en-US', { hour12: false });
    const parts = [];
    if (event.analysis) {
        const a = event.analysis;
        if (a.syntaxIssues.length > 0) {
            parts.push(chalk.red(`${a.syntaxIssues.length} syntax issue${a.syntaxIssues.length > 1 ? 's' : ''}`));
        }
        if (a.todos > 0) {
            parts.push(chalk.yellow(`${a.todos} TODO${a.todos > 1 ? 's' : ''}`));
        }
        if (a.debugStatements > 0) {
            parts.push(chalk.cyan(`${a.debugStatements} debug stmt${a.debugStatements > 1 ? 's' : ''}`));
        }
    }
    const summary = parts.length > 0
        ? ` — ${parts.join(', ')}`
        : '';
    const typeLabel = event.type === 'rename'
        ? chalk.magenta('renamed')
        : chalk.blue('changed');
    return `  ${chalk.dim(time)} ${chalk.bold('watch:')} ${chalk.green(relPath)} ${typeLabel}${summary}`;
}
function printSyntaxDetails(analysis) {
    for (const issue of analysis.syntaxIssues) {
        console.log(`         ${chalk.red('!')} ${issue}`);
    }
}
// ---------------------------------------------------------------------------
// Core watcher
// ---------------------------------------------------------------------------
export async function startWatch(path, options) {
    // Stop any existing watcher
    if (activeWatcher) {
        stopWatch();
    }
    const watchPath = path ?? options?.path ?? process.cwd();
    const extensions = options?.extensions ?? DEFAULT_EXTENSIONS;
    const shouldAnalyze = options?.analyze !== false;
    // Verify the path exists and is a directory
    try {
        const stat = statSync(watchPath);
        if (!stat.isDirectory()) {
            console.log(chalk.red(`  watch: ${watchPath} is not a directory`));
            return;
        }
    }
    catch {
        console.log(chalk.red(`  watch: ${watchPath} does not exist`));
        return;
    }
    console.log(chalk.bold('\n  watch: ') + chalk.dim(`Watching ${watchPath}`));
    console.log(chalk.dim(`         Extensions: ${extensions.join(', ')}`));
    console.log(chalk.dim(`         Analysis: ${shouldAnalyze ? 'enabled' : 'disabled'}`));
    console.log(chalk.dim(`         Press Ctrl+C to stop\n`));
    changeLog = [];
    try {
        activeWatcher = watch(watchPath, { recursive: true }, (eventType, filename) => {
            if (!filename)
                return;
            const filePath = join(watchPath, filename);
            // Ignore filtered paths
            if (shouldIgnore(filename))
                return;
            // Only watch configured extensions
            if (!isSourceFile(filename, extensions))
                return;
            // Debounce: clear any pending timer for this file
            const existing = debounceTimers.get(filePath);
            if (existing) {
                clearTimeout(existing);
            }
            debounceTimers.set(filePath, setTimeout(() => {
                debounceTimers.delete(filePath);
                // Verify the file still exists (it might have been deleted)
                let fileExists = false;
                try {
                    statSync(filePath);
                    fileExists = true;
                }
                catch {
                    // File was deleted
                }
                const event = {
                    file: filename,
                    type: eventType === 'rename' ? 'rename' : 'change',
                    timestamp: new Date(),
                };
                // Run analysis if enabled and file exists
                if (shouldAnalyze && fileExists && event.type === 'change') {
                    event.analysis = analyzeFile(filePath);
                }
                // Add to change log (keep last N)
                changeLog.push(event);
                if (changeLog.length > MAX_CHANGE_LOG) {
                    changeLog.shift();
                }
                // Display
                console.log(formatEvent(event));
                if (event.analysis && event.analysis.syntaxIssues.length > 0) {
                    printSyntaxDetails(event.analysis);
                }
                // Fire callback
                if (options?.onChange) {
                    options.onChange(event);
                }
            }, DEBOUNCE_MS));
        });
        activeWatcher.on('error', (err) => {
            console.log(chalk.red(`  watch: Error — ${err.message}`));
        });
    }
    catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        console.log(chalk.red(`  watch: Failed to start — ${message}`));
    }
}
export function stopWatch() {
    if (activeWatcher) {
        activeWatcher.close();
        activeWatcher = null;
        // Clear all pending debounce timers
        for (const timer of debounceTimers.values()) {
            clearTimeout(timer);
        }
        debounceTimers.clear();
        console.log(chalk.dim('\n  watch: Stopped'));
    }
}
/**
 * Get the recent change log (last 20 file changes).
 */
export function getChangeLog() {
    return [...changeLog];
}
/**
 * Clear the change log.
 */
export function clearChangeLog() {
    changeLog = [];
}
/**
 * Check whether the watcher is currently active.
 */
export function isWatching() {
    return activeWatcher !== null;
}
//# sourceMappingURL=watch.js.map