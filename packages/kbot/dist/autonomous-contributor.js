// kbot Autonomous Contributor — Point at any repo, analyze, propose fixes
//
// Clones any public GitHub repo, runs bootstrap + guardian analysis,
// identifies actionable improvements, and generates a contribution report
// with proposed fixes. v1 is analysis-only — no automatic PR creation.
//
// Usage:
//   import { runAutonomousContributor, listGoodFirstIssues } from './autonomous-contributor.js'
//   const report = await runAutonomousContributor('https://github.com/owner/repo')
//   const issues = await listGoodFirstIssues('https://github.com/owner/repo')
import { existsSync, readFileSync, mkdirSync, rmSync, readdirSync, statSync, writeFileSync } from 'node:fs';
import { join, relative, extname } from 'node:path';
import { tmpdir, homedir } from 'node:os';
import { execSync } from 'node:child_process';
// ── Constants ──
const IGNORED_DIRS = new Set([
    'node_modules', '.git', 'dist', 'build', 'out', '.next', '.nuxt',
    'coverage', '.cache', '.turbo', '.parcel-cache', '__pycache__',
    'vendor', 'target', '.output', '.vercel', '.tox', '.mypy_cache',
    '.pytest_cache', 'venv', '.venv', 'env',
]);
const CODE_EXTENSIONS = new Set([
    '.ts', '.tsx', '.js', '.jsx', '.mts', '.mjs', '.py', '.rs',
    '.go', '.java', '.rb', '.php', '.swift', '.kt', '.c', '.cpp', '.h',
    '.cs', '.vue', '.svelte', '.astro',
]);
const SEVERITY_ORDER = {
    'info': 0,
    'warn': 1,
    'critical': 2,
};
const REPORT_DIR = join(homedir(), '.kbot', 'contributions');
// ── Helpers ──
function ensureDir(dir) {
    if (!existsSync(dir))
        mkdirSync(dir, { recursive: true });
}
function execQuiet(cmd, cwd, timeoutMs = 30000) {
    try {
        return execSync(cmd, {
            encoding: 'utf-8',
            timeout: timeoutMs,
            stdio: ['pipe', 'pipe', 'pipe'],
            cwd,
        }).trim();
    }
    catch {
        return null;
    }
}
/** Extract "owner/repo" from a GitHub URL or owner/repo string */
function parseRepoIdentifier(input) {
    // Full URL: https://github.com/owner/repo or git@github.com:owner/repo.git
    const httpsMatch = input.match(/github\.com\/([^/]+\/[^/.]+)/);
    if (httpsMatch)
        return httpsMatch[1].replace(/\.git$/, '');
    const sshMatch = input.match(/github\.com:([^/]+\/[^/.]+)/);
    if (sshMatch)
        return sshMatch[1].replace(/\.git$/, '');
    // Already in owner/repo format
    if (/^[^/]+\/[^/]+$/.test(input))
        return input;
    throw new Error(`Cannot parse repo identifier from: ${input}`);
}
function cloneUrl(repoId) {
    return `https://github.com/${repoId}.git`;
}
// ── File Walking ──
function walkCodeFiles(dir, maxFiles, files = []) {
    if (files.length >= maxFiles)
        return files;
    let entries;
    try {
        entries = readdirSync(dir);
    }
    catch {
        return files;
    }
    for (const entry of entries) {
        if (files.length >= maxFiles)
            break;
        const fullPath = join(dir, entry);
        let stats;
        try {
            stats = statSync(fullPath);
        }
        catch {
            continue;
        }
        if (stats.isDirectory()) {
            if (!IGNORED_DIRS.has(entry) && !entry.startsWith('.')) {
                walkCodeFiles(fullPath, maxFiles, files);
            }
        }
        else if (stats.isFile()) {
            const ext = extname(entry).toLowerCase();
            if (CODE_EXTENSIONS.has(ext) && stats.size < 500_000) {
                files.push(fullPath);
            }
        }
    }
    return files;
}
function detectProjectProfile(rootDir) {
    const profile = {
        language: 'unknown',
        framework: 'none',
        hasTests: false,
        hasCI: false,
        hasReadme: false,
        hasLicense: false,
        hasContributing: false,
        hasTypeConfig: false,
    };
    // Check for common files
    profile.hasReadme = existsSync(join(rootDir, 'README.md')) || existsSync(join(rootDir, 'readme.md'));
    profile.hasLicense = existsSync(join(rootDir, 'LICENSE')) || existsSync(join(rootDir, 'LICENSE.md'));
    profile.hasContributing = existsSync(join(rootDir, 'CONTRIBUTING.md'));
    profile.hasCI = existsSync(join(rootDir, '.github', 'workflows')) ||
        existsSync(join(rootDir, '.circleci')) ||
        existsSync(join(rootDir, '.travis.yml')) ||
        existsSync(join(rootDir, 'Jenkinsfile'));
    // Language detection
    if (existsSync(join(rootDir, 'package.json'))) {
        profile.language = 'javascript';
        // Check for TypeScript
        if (existsSync(join(rootDir, 'tsconfig.json'))) {
            profile.language = 'typescript';
            profile.hasTypeConfig = true;
        }
        // Framework detection from package.json
        try {
            const pkg = JSON.parse(readFileSync(join(rootDir, 'package.json'), 'utf-8'));
            const allDeps = { ...pkg.dependencies, ...pkg.devDependencies };
            if (allDeps['next'])
                profile.framework = 'next.js';
            else if (allDeps['nuxt'] || allDeps['nuxt3'])
                profile.framework = 'nuxt';
            else if (allDeps['@angular/core'])
                profile.framework = 'angular';
            else if (allDeps['svelte'] || allDeps['@sveltejs/kit'])
                profile.framework = 'svelte';
            else if (allDeps['vue'])
                profile.framework = 'vue';
            else if (allDeps['react'])
                profile.framework = 'react';
            else if (allDeps['express'])
                profile.framework = 'express';
            else if (allDeps['fastify'])
                profile.framework = 'fastify';
            else if (allDeps['hono'])
                profile.framework = 'hono';
            // Test detection
            if (allDeps['jest'] || allDeps['vitest'] || allDeps['mocha'] || allDeps['ava'] ||
                allDeps['@testing-library/react'] || allDeps['playwright'] || allDeps['cypress']) {
                profile.hasTests = true;
            }
        }
        catch { /* malformed package.json */ }
    }
    else if (existsSync(join(rootDir, 'Cargo.toml'))) {
        profile.language = 'rust';
        profile.hasTypeConfig = true; // Rust is always typed
        profile.hasTests = true; // Rust has built-in tests
    }
    else if (existsSync(join(rootDir, 'go.mod'))) {
        profile.language = 'go';
        profile.hasTypeConfig = true; // Go is always typed
        // Check for test files
        const goTestOutput = execQuiet('find . -name "*_test.go" -maxdepth 3 | head -1', rootDir, 5000);
        if (goTestOutput)
            profile.hasTests = true;
    }
    else if (existsSync(join(rootDir, 'pyproject.toml')) || existsSync(join(rootDir, 'setup.py'))) {
        profile.language = 'python';
        if (existsSync(join(rootDir, 'mypy.ini')) || existsSync(join(rootDir, 'pyrightconfig.json'))) {
            profile.hasTypeConfig = true;
        }
        // Check pyproject.toml for framework + test tools
        try {
            const pyproject = readFileSync(join(rootDir, 'pyproject.toml'), 'utf-8');
            if (/django/i.test(pyproject))
                profile.framework = 'django';
            else if (/flask/i.test(pyproject))
                profile.framework = 'flask';
            else if (/fastapi/i.test(pyproject))
                profile.framework = 'fastapi';
            if (/pytest|unittest|nose/i.test(pyproject))
                profile.hasTests = true;
        }
        catch { /* no pyproject */ }
    }
    else if (existsSync(join(rootDir, 'Gemfile'))) {
        profile.language = 'ruby';
        if (existsSync(join(rootDir, 'config', 'routes.rb')))
            profile.framework = 'rails';
    }
    // Fallback test detection: check for test directories
    if (!profile.hasTests) {
        const testDirs = ['test', 'tests', '__tests__', 'spec', 'specs'];
        for (const td of testDirs) {
            if (existsSync(join(rootDir, td))) {
                profile.hasTests = true;
                break;
            }
        }
    }
    return profile;
}
function scanTodos(files, rootDir) {
    const todos = [];
    const pattern = /\b(TODO|FIXME|HACK|XXX)\b[:\s]*(.*)/i;
    for (const file of files) {
        let source;
        try {
            source = readFileSync(file, 'utf-8');
        }
        catch {
            continue;
        }
        const relPath = relative(rootDir, file);
        const lines = source.split('\n');
        for (let i = 0; i < lines.length; i++) {
            const match = pattern.exec(lines[i]);
            if (match) {
                todos.push({
                    file: relPath,
                    line: i + 1,
                    text: match[2]?.trim() || match[0],
                    type: match[1].toUpperCase(),
                });
            }
        }
    }
    return todos;
}
function scanComplexity(files, rootDir) {
    const results = [];
    const funcPattern = /(?:export\s+)?(?:async\s+)?(?:function\s+(\w+)|(?:const|let|var)\s+(\w+)\s*=\s*(?:async\s+)?(?:\([^)]*\)|[a-zA-Z_]\w*)\s*=>|(\w+)\s*\([^)]*\)\s*(?::\s*\w[^{]*)?\s*\{)/;
    for (const file of files) {
        let source;
        try {
            source = readFileSync(file, 'utf-8');
        }
        catch {
            continue;
        }
        const relPath = relative(rootDir, file);
        const lines = source.split('\n');
        let i = 0;
        while (i < lines.length) {
            const match = funcPattern.exec(lines[i]);
            if (match) {
                const funcName = match[1] || match[2] || match[3] || 'anonymous';
                const startLine = i + 1;
                let braceDepth = 0;
                let funcStarted = false;
                let bodyLines = 0;
                let j = i;
                while (j < lines.length) {
                    for (const ch of lines[j]) {
                        if (ch === '{') {
                            braceDepth++;
                            if (!funcStarted)
                                funcStarted = true;
                        }
                        else if (ch === '}') {
                            braceDepth--;
                        }
                    }
                    if (funcStarted)
                        bodyLines++;
                    if (funcStarted && braceDepth === 0)
                        break;
                    j++;
                }
                if (bodyLines > 60) {
                    results.push({ file: relPath, name: funcName, lineCount: bodyLines, startLine });
                }
                i = j + 1;
            }
            else {
                i++;
            }
        }
    }
    results.sort((a, b) => b.lineCount - a.lineCount);
    return results.slice(0, 20);
}
// ── Duplicate Pattern Scanner (simplified from codebase-guardian) ──
function normalizeLine(line) {
    return line
        .replace(/\/\/.*$/, '')
        .replace(/\/\*[\s\S]*?\*\//g, '')
        .replace(/#.*$/, '')
        .replace(/\s+/g, ' ')
        .trim();
}
function scanDuplicates(files, rootDir) {
    const CHUNK_SIZE = 4;
    const chunkMap = new Map();
    const chunkOriginals = new Map();
    for (const file of files) {
        let source;
        try {
            source = readFileSync(file, 'utf-8');
        }
        catch {
            continue;
        }
        const relPath = relative(rootDir, file);
        const lines = source.split('\n').map(normalizeLine).filter(l => l.length > 10);
        for (let i = 0; i <= lines.length - CHUNK_SIZE; i++) {
            const chunk = lines.slice(i, i + CHUNK_SIZE).join('\n');
            if (chunk.length > 30) {
                if (!chunkMap.has(chunk)) {
                    chunkMap.set(chunk, new Set());
                    // Store original for reporting
                    const rawLines = source.split('\n');
                    for (let j = 0; j < rawLines.length - CHUNK_SIZE; j++) {
                        const normalized = rawLines.slice(j, j + CHUNK_SIZE)
                            .map(normalizeLine).filter(l => l.length > 10).join('\n');
                        if (normalized === chunk) {
                            chunkOriginals.set(chunk, rawLines.slice(j, j + CHUNK_SIZE).join('\n'));
                            break;
                        }
                    }
                }
                chunkMap.get(chunk).add(relPath);
            }
        }
    }
    const duplicates = [];
    for (const [chunk, fileSet] of chunkMap) {
        if (fileSet.size >= 3) {
            duplicates.push({
                pattern: (chunkOriginals.get(chunk) || chunk).slice(0, 200),
                files: Array.from(fileSet),
                occurrences: fileSet.size,
            });
        }
    }
    duplicates.sort((a, b) => b.occurrences - a.occurrences);
    return duplicates.slice(0, 10);
}
// ── Typo Scanner ──
// Common programming typos in identifiers and comments
const COMMON_TYPOS = [
    [/\brecieve\b/gi, 'receive'],
    [/\boccured\b/gi, 'occurred'],
    [/\bseperatel?y?\b/gi, 'separately'],
    [/\bdefau[lt]{2,}s?\b/gi, 'default(s)'],
    [/\baccidentaly\b/gi, 'accidentally'],
    [/\bneccessary\b/gi, 'necessary'],
    [/\boccurr?ance\b/gi, 'occurrence'],
    [/\bwidht\b/gi, 'width'],
    [/\bheigth\b/gi, 'height'],
    [/\blegnth\b/gi, 'length'],
    [/\bfunciton\b/gi, 'function'],
    [/\bretrun\b/gi, 'return'],
    [/\bparmeter\b/gi, 'parameter'],
    [/\bargumnet\b/gi, 'argument'],
    [/\benviroment\b/gi, 'environment'],
    [/\bresponc?se\b/gi, 'response'],
    [/\binitilaize\b/gi, 'initialize'],
    [/\bsucess\b/gi, 'success'],
    [/\babstarct\b/gi, 'abstract'],
    [/\boveride\b/gi, 'override'],
    [/\binterupts?\b/gi, 'interrupt(s)'],
    [/\bwether\b/gi, 'whether'],
    [/\bteh\b/gi, 'the'],
    [/\badn\b/gi, 'and'],
];
function scanTypos(files, rootDir) {
    const typos = [];
    for (const file of files) {
        let source;
        try {
            source = readFileSync(file, 'utf-8');
        }
        catch {
            continue;
        }
        const relPath = relative(rootDir, file);
        const lines = source.split('\n');
        for (let i = 0; i < lines.length; i++) {
            const line = lines[i];
            // Only check comments and string literals for typos
            const isComment = /^\s*(\/\/|#|\*|\/\*)/.test(line);
            const hasString = /['"`]/.test(line);
            if (!isComment && !hasString)
                continue;
            for (const [pattern, fix] of COMMON_TYPOS) {
                const match = pattern.exec(line);
                if (match) {
                    typos.push({
                        file: relPath,
                        line: i + 1,
                        found: match[0],
                        suggestion: fix,
                    });
                }
                // Reset regex lastIndex for global patterns
                pattern.lastIndex = 0;
            }
        }
    }
    return typos.slice(0, 30);
}
function scanMissingTypes(files, rootDir) {
    const results = [];
    // Only check .ts/.tsx files
    const tsFiles = files.filter(f => f.endsWith('.ts') || f.endsWith('.tsx'));
    for (const file of tsFiles) {
        let source;
        try {
            source = readFileSync(file, 'utf-8');
        }
        catch {
            continue;
        }
        const relPath = relative(rootDir, file);
        const lines = source.split('\n');
        for (let i = 0; i < lines.length; i++) {
            const line = lines[i];
            // Exported function without return type
            if (/^export\s+(async\s+)?function\s+\w+\s*\([^)]*\)\s*\{/.test(line) &&
                !/\)\s*:\s*\S/.test(line)) {
                results.push({ file: relPath, line: i + 1, code: line.trim().slice(0, 80) });
            }
            // Exported const arrow function without return type (only top-level)
            if (/^export\s+const\s+\w+\s*=\s*(async\s+)?\(/.test(line) &&
                !/\)\s*:\s*\S/.test(line) &&
                /=>\s*\{?\s*$/.test(line)) {
                results.push({ file: relPath, line: i + 1, code: line.trim().slice(0, 80) });
            }
            // `any` type usage
            if (/:\s*any\b/.test(line) && !/\/\/.*any/.test(line) && !/eslint-disable/.test(line)) {
                results.push({ file: relPath, line: i + 1, code: line.trim().slice(0, 80) });
            }
        }
    }
    return results.slice(0, 30);
}
// ── Build Findings ──
function buildFindings(rootDir, files, profile) {
    const findings = [];
    // TODOs
    const todos = scanTodos(files, rootDir);
    for (const todo of todos) {
        findings.push({
            category: 'todo-removal',
            severity: todo.type === 'FIXME' || todo.type === 'HACK' ? 'warn' : 'info',
            title: `${todo.type}: ${todo.text.slice(0, 60)}`,
            description: `${todo.type} comment at ${todo.file}:${todo.line} — "${todo.text}"`,
            file: todo.file,
            line: todo.line,
            original: todo.text,
            isSimpleFix: todo.type === 'TODO' && todo.text.length < 80,
        });
    }
    // Typos
    const typos = scanTypos(files, rootDir);
    for (const typo of typos) {
        findings.push({
            category: 'typo',
            severity: 'info',
            title: `Typo: "${typo.found}" should be "${typo.suggestion}"`,
            description: `Found "${typo.found}" at ${typo.file}:${typo.line}. Suggested correction: "${typo.suggestion}"`,
            file: typo.file,
            line: typo.line,
            original: typo.found,
            isSimpleFix: true,
        });
    }
    // Missing types (TypeScript only)
    if (profile.language === 'typescript') {
        const missingTypes = scanMissingTypes(files, rootDir);
        for (const mt of missingTypes) {
            const isAny = mt.code.includes(': any');
            findings.push({
                category: 'missing-type',
                severity: isAny ? 'warn' : 'info',
                title: isAny
                    ? `Explicit \`any\` type at ${mt.file}:${mt.line}`
                    : `Missing return type at ${mt.file}:${mt.line}`,
                description: isAny
                    ? `Replace explicit \`any\` with a proper type: ${mt.code}`
                    : `Exported function missing return type annotation: ${mt.code}`,
                file: mt.file,
                line: mt.line,
                original: mt.code,
                isSimpleFix: isAny,
            });
        }
    }
    // Complexity
    const complex = scanComplexity(files, rootDir);
    for (const fn of complex) {
        findings.push({
            category: 'complexity',
            severity: fn.lineCount > 100 ? 'critical' : 'warn',
            title: `Long function: ${fn.name} (${fn.lineCount} lines)`,
            description: `${fn.file}:${fn.startLine} — function \`${fn.name}\` is ${fn.lineCount} lines long. Consider breaking into smaller functions.`,
            file: fn.file,
            line: fn.startLine,
            isSimpleFix: false,
        });
    }
    // Duplicates
    const duplicates = scanDuplicates(files, rootDir);
    for (const dup of duplicates) {
        findings.push({
            category: 'duplicate-pattern',
            severity: dup.occurrences >= 5 ? 'critical' : 'warn',
            title: `Repeated code block in ${dup.occurrences} files`,
            description: `A 4-line code block appears in ${dup.occurrences} files: ${dup.files.slice(0, 3).join(', ')}${dup.files.length > 3 ? ` (+${dup.files.length - 3} more)` : ''}`,
            file: dup.files[0],
            original: dup.pattern,
            isSimpleFix: false,
        });
    }
    // Missing docs: exported functions without JSDoc
    if (profile.language === 'typescript' || profile.language === 'javascript') {
        let undocumented = 0;
        for (const file of files.slice(0, 100)) {
            let source;
            try {
                source = readFileSync(file, 'utf-8');
            }
            catch {
                continue;
            }
            const relPath = relative(rootDir, file);
            const lines = source.split('\n');
            for (let i = 0; i < lines.length; i++) {
                if (/^export\s+(async\s+)?function\s+\w+/.test(lines[i])) {
                    // Check if preceded by JSDoc
                    const prevLine = i > 0 ? lines[i - 1].trim() : '';
                    const prevPrevLine = i > 1 ? lines[i - 2].trim() : '';
                    if (!prevLine.endsWith('*/') && !prevPrevLine.endsWith('*/')) {
                        undocumented++;
                        if (undocumented <= 10) {
                            findings.push({
                                category: 'missing-docs',
                                severity: 'info',
                                title: `Exported function without JSDoc: ${relPath}:${i + 1}`,
                                description: `The exported function at ${relPath}:${i + 1} has no JSDoc comment. Adding documentation improves maintainability.`,
                                file: relPath,
                                line: i + 1,
                                original: lines[i].trim().slice(0, 80),
                                isSimpleFix: true,
                            });
                        }
                    }
                }
            }
        }
    }
    // Project-level findings
    if (!profile.hasReadme) {
        findings.push({
            category: 'missing-docs',
            severity: 'critical',
            title: 'No README.md',
            description: 'This project has no README. Every project needs a README explaining what it does and how to use it.',
            file: 'README.md',
            isSimpleFix: false,
        });
    }
    if (!profile.hasLicense) {
        findings.push({
            category: 'other',
            severity: 'warn',
            title: 'No LICENSE file',
            description: 'Without a license, others cannot legally use this code. Consider adding MIT, Apache 2.0, or another open-source license.',
            file: 'LICENSE',
            isSimpleFix: true,
        });
    }
    if (!profile.hasContributing) {
        findings.push({
            category: 'missing-docs',
            severity: 'info',
            title: 'No CONTRIBUTING.md',
            description: 'Adding a CONTRIBUTING.md helps new contributors understand how to get started.',
            file: 'CONTRIBUTING.md',
            isSimpleFix: true,
        });
    }
    if (!profile.hasCI) {
        findings.push({
            category: 'other',
            severity: 'warn',
            title: 'No CI configuration detected',
            description: 'No GitHub Actions, CircleCI, Travis, or Jenkins configuration found. CI helps catch regressions automatically.',
            file: '.github/workflows',
            isSimpleFix: false,
        });
    }
    return findings;
}
// ── Build Proposed Fixes ──
function buildProposedFixes(findings) {
    const fixes = [];
    for (const finding of findings) {
        if (!finding.isSimpleFix)
            continue;
        let changeSummary;
        let estimatedReviewMinutes;
        switch (finding.category) {
            case 'todo-removal':
                changeSummary = `Address the ${finding.original?.split(':')[0] || 'TODO'} at ${finding.file}:${finding.line ?? '?'}. Either implement the requested change or remove the stale comment.`;
                estimatedReviewMinutes = 5;
                break;
            case 'typo':
                changeSummary = `Fix typo: change "${finding.original}" to the correct spelling in ${finding.file}:${finding.line ?? '?'}.`;
                estimatedReviewMinutes = 1;
                break;
            case 'missing-type':
                changeSummary = `Add proper type annotation to replace \`any\` or add return type at ${finding.file}:${finding.line ?? '?'}.`;
                estimatedReviewMinutes = 3;
                break;
            case 'missing-docs':
                changeSummary = `Add JSDoc documentation for the exported function at ${finding.file}:${finding.line ?? '?'}.`;
                estimatedReviewMinutes = 3;
                break;
            default:
                changeSummary = `Address: ${finding.title}`;
                estimatedReviewMinutes = 5;
                break;
        }
        fixes.push({
            finding,
            description: finding.description,
            changeSummary,
            estimatedReviewMinutes,
        });
    }
    // Sort: typos first (easiest), then missing-type, then todos, then docs
    const categoryOrder = {
        'typo': 0,
        'missing-type': 1,
        'todo-removal': 2,
        'missing-docs': 3,
    };
    fixes.sort((a, b) => {
        const aOrder = categoryOrder[a.finding.category] ?? 10;
        const bOrder = categoryOrder[b.finding.category] ?? 10;
        return aOrder - bOrder;
    });
    return fixes;
}
// ── Main: Autonomous Contributor ──
/**
 * Point at any GitHub repo, clone it, analyze it, and generate a contribution
 * report with findings and proposed fixes.
 *
 * v1 is analysis-only — no automatic PR creation. The report gives you
 * everything needed to make targeted contributions.
 */
export async function runAutonomousContributor(repoUrl, options = {}) {
    const { maxFiles = 500, minSeverity = 'info', localPath, keepClone = false, } = options;
    const repoId = parseRepoIdentifier(repoUrl);
    const clonedAt = new Date().toISOString();
    // ── Clone or use local path ──
    let rootDir;
    if (localPath) {
        rootDir = localPath;
        if (!existsSync(rootDir)) {
            throw new Error(`Local path does not exist: ${rootDir}`);
        }
        console.log(`Analyzing local path: ${rootDir}`);
    }
    else {
        rootDir = join(tmpdir(), `kbot-contributor-${repoId.replace('/', '-')}-${Date.now()}`);
        console.log(`Cloning ${repoId} to ${rootDir}...`);
        const cloneResult = execQuiet(`git clone --depth 1 --single-branch ${cloneUrl(repoId)} "${rootDir}"`, tmpdir(), 60000);
        if (cloneResult === null && !existsSync(join(rootDir, '.git'))) {
            throw new Error(`Failed to clone ${repoId}. Is the repository public and accessible?`);
        }
        console.log('Clone complete.');
    }
    try {
        // ── Detect project profile ──
        console.log('Detecting project profile...');
        const profile = detectProjectProfile(rootDir);
        console.log(`  Language: ${profile.language}, Framework: ${profile.framework}`);
        // ── Walk code files ──
        console.log('Scanning files...');
        const files = walkCodeFiles(rootDir, maxFiles);
        console.log(`  ${files.length} code files found`);
        // ── Run analysis ──
        console.log('Running analysis...');
        const findings = buildFindings(rootDir, files, profile);
        // Filter by minimum severity
        const minSevOrder = SEVERITY_ORDER[minSeverity];
        const filteredFindings = findings.filter(f => SEVERITY_ORDER[f.severity] >= minSevOrder);
        // ── Build proposed fixes ──
        const proposed_fixes = buildProposedFixes(filteredFindings);
        // ── Build impact summary ──
        const categories = {};
        for (const f of filteredFindings) {
            categories[f.category] = (categories[f.category] || 0) + 1;
        }
        const analyzedAt = new Date().toISOString();
        const report = {
            repo: repoId,
            clonedAt,
            analyzedAt,
            language: profile.language,
            framework: profile.framework,
            filesScanned: files.length,
            findings: filteredFindings,
            proposed_fixes,
            estimated_impact: {
                totalFindings: filteredFindings.length,
                simpleFixes: proposed_fixes.length,
                complexFindings: filteredFindings.length - proposed_fixes.length,
                categories,
            },
            projectHealth: {
                hasReadme: profile.hasReadme,
                hasLicense: profile.hasLicense,
                hasTests: profile.hasTests,
                hasCI: profile.hasCI,
                hasContributing: profile.hasContributing,
                hasTypeConfig: profile.hasTypeConfig,
            },
        };
        // Save report
        ensureDir(REPORT_DIR);
        const reportFile = join(REPORT_DIR, `${repoId.replace('/', '-')}-${Date.now()}.json`);
        writeFileSync(reportFile, JSON.stringify(report, null, 2), 'utf-8');
        console.log(`Analysis complete: ${filteredFindings.length} findings, ` +
            `${proposed_fixes.length} proposed fixes. Report saved to ${reportFile}`);
        return report;
    }
    finally {
        // Clean up clone unless keepClone is set or using localPath
        if (!localPath && !keepClone && existsSync(rootDir)) {
            try {
                rmSync(rootDir, { recursive: true, force: true });
                console.log('Cleaned up temporary clone.');
            }
            catch {
                console.log(`Warning: could not clean up ${rootDir}`);
            }
        }
    }
}
// ── Good First Issues ──
/**
 * Fetch open issues labeled "good first issue" or "help wanted" from a GitHub repo.
 * Uses the public GitHub API (no auth required for public repos).
 */
export async function listGoodFirstIssues(repoUrl) {
    const repoId = parseRepoIdentifier(repoUrl);
    const labels = ['good first issue', 'help wanted', 'beginner-friendly', 'easy'];
    const allIssues = [];
    const seenNumbers = new Set();
    for (const label of labels) {
        const encoded = encodeURIComponent(label);
        const url = `https://api.github.com/repos/${repoId}/issues?labels=${encoded}&state=open&per_page=20&sort=created&direction=desc`;
        try {
            const res = await fetch(url, {
                headers: {
                    'User-Agent': 'kbot-contributor/1.0',
                    'Accept': 'application/vnd.github.v3+json',
                },
                signal: AbortSignal.timeout(10000),
            });
            if (!res.ok)
                continue;
            const items = await res.json();
            for (const item of items) {
                // Skip PRs (GitHub returns them in the issues endpoint)
                if (item.pull_request)
                    continue;
                if (seenNumbers.has(item.number))
                    continue;
                seenNumbers.add(item.number);
                allIssues.push({
                    number: item.number,
                    title: item.title,
                    url: item.html_url,
                    labels: item.labels.map(l => l.name),
                    created_at: item.created_at,
                    author: item.user.login,
                    comments: item.comments,
                    body_preview: (item.body || '').slice(0, 200),
                });
            }
        }
        catch {
            // API error for this label, continue with others
        }
    }
    // Sort by newest first
    allIssues.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
    return allIssues;
}
// ── Report Formatting ──
/**
 * Format a ContributionReport as a readable markdown string.
 */
export function formatContributionReport(report) {
    const lines = [
        `# Contribution Report: ${report.repo}`,
        '',
        `> Analyzed ${report.filesScanned} files | Language: ${report.language} | Framework: ${report.framework}`,
        `> ${report.analyzedAt}`,
        '',
        '## Project Health',
        '',
        `| Check | Status |`,
        `|-------|--------|`,
        `| README | ${report.projectHealth.hasReadme ? 'Yes' : 'Missing'} |`,
        `| LICENSE | ${report.projectHealth.hasLicense ? 'Yes' : 'Missing'} |`,
        `| Tests | ${report.projectHealth.hasTests ? 'Yes' : 'None detected'} |`,
        `| CI | ${report.projectHealth.hasCI ? 'Yes' : 'None detected'} |`,
        `| CONTRIBUTING | ${report.projectHealth.hasContributing ? 'Yes' : 'Missing'} |`,
        `| Type Config | ${report.projectHealth.hasTypeConfig ? 'Yes' : 'None'} |`,
        '',
        '## Impact Summary',
        '',
        `- **Total findings:** ${report.estimated_impact.totalFindings}`,
        `- **Simple fixes (PR-ready):** ${report.estimated_impact.simpleFixes}`,
        `- **Complex findings:** ${report.estimated_impact.complexFindings}`,
        '',
        '### By Category',
        '',
    ];
    for (const [cat, count] of Object.entries(report.estimated_impact.categories).sort((a, b) => b[1] - a[1])) {
        lines.push(`- ${cat}: ${count}`);
    }
    if (report.proposed_fixes.length > 0) {
        lines.push('');
        lines.push('## Proposed Fixes');
        lines.push('');
        for (const fix of report.proposed_fixes.slice(0, 20)) {
            lines.push(`### ${fix.finding.title}`);
            lines.push(`- **File:** ${fix.finding.file}${fix.finding.line ? `:${fix.finding.line}` : ''}`);
            lines.push(`- **Change:** ${fix.changeSummary}`);
            lines.push(`- **Review time:** ~${fix.estimatedReviewMinutes} min`);
            lines.push('');
        }
    }
    const criticalFindings = report.findings.filter(f => f.severity === 'critical');
    if (criticalFindings.length > 0) {
        lines.push('## Critical Findings');
        lines.push('');
        for (const f of criticalFindings) {
            lines.push(`- **${f.title}** (${f.file}) — ${f.description}`);
        }
        lines.push('');
    }
    lines.push('---');
    lines.push('*Generated by kbot Autonomous Contributor*');
    return lines.join('\n');
}
//# sourceMappingURL=autonomous-contributor.js.map