// kbot Watcher — Filesystem and Git Event Stream
//
// Watches for changes and emits events the coordinator can act on.
// fs.watch for file changes, periodic git log for new commits.
import { watch } from 'node:fs';
import { join } from 'node:path';
import { execSync } from 'node:child_process';
import chalk from 'chalk';
let fsWatcher = null;
let gitPollTimer = null;
let lastKnownCommit = null;
let active = false;
const fileDebounce = new Map();
const DEBOUNCE_MS = 500;
const GIT_POLL_MS = 30_000;
const IGNORE = ['node_modules', '.git', 'dist', 'build', '.next', '.cache', 'coverage'];
const TAG = chalk.hex('#6B5B95')('◆ watcher');
function now() { return new Date().toISOString(); }
function safeEmit(cb, ev) {
    try {
        cb(ev);
    }
    catch { /* callback errors must not crash the watcher */ }
}
function getLatestCommit(dir) {
    try {
        return execSync('git log -1 --format=%H', {
            cwd: dir, encoding: 'utf-8', timeout: 5000, stdio: ['pipe', 'pipe', 'pipe'],
        }).trim() || null;
    }
    catch {
        return null;
    }
}
function getCommitDetails(dir, hash) {
    try {
        const log = execSync(`git log -1 --format="%H|%an|%s" ${hash}`, {
            cwd: dir, encoding: 'utf-8', timeout: 5000, stdio: ['pipe', 'pipe', 'pipe'],
        }).trim();
        const [h, author, message] = log.split('|');
        return { hash: h, author, message };
    }
    catch {
        return { hash };
    }
}
/** Start watching a project directory for file changes and new git commits. */
export function startWatching(projectDir, callback) {
    if (active) {
        process.stderr.write(`  ${TAG} ${chalk.yellow('already active')}\n`);
        return;
    }
    active = true;
    process.stderr.write(`  ${TAG} ${chalk.dim(projectDir)}\n`);
    // File system watcher (recursive, debounced)
    try {
        fsWatcher = watch(projectDir, { recursive: true }, (_ev, filename) => {
            if (!filename || IGNORE.some(p => filename.includes(p)))
                return;
            const prev = fileDebounce.get(filename);
            if (prev)
                clearTimeout(prev);
            fileDebounce.set(filename, setTimeout(() => {
                fileDebounce.delete(filename);
                safeEmit(callback, {
                    type: 'file_changed', timestamp: now(),
                    details: { file: filename, path: join(projectDir, filename) },
                });
            }, DEBOUNCE_MS));
        });
        fsWatcher.on('error', () => { });
    }
    catch { /* fs.watch unavailable */ }
    // Git commit polling
    lastKnownCommit = getLatestCommit(projectDir);
    gitPollTimer = setInterval(() => {
        const latest = getLatestCommit(projectDir);
        if (latest && latest !== lastKnownCommit) {
            lastKnownCommit = latest;
            safeEmit(callback, { type: 'new_commit', timestamp: now(), details: getCommitDetails(projectDir, latest) });
        }
    }, GIT_POLL_MS);
    if (gitPollTimer.unref)
        gitPollTimer.unref();
}
/** Stop all watchers and clean up. */
export function stopWatching() {
    if (!active)
        return;
    if (fsWatcher) {
        fsWatcher.close();
        fsWatcher = null;
    }
    if (gitPollTimer) {
        clearInterval(gitPollTimer);
        gitPollTimer = null;
    }
    for (const t of fileDebounce.values())
        clearTimeout(t);
    fileDebounce.clear();
    lastKnownCommit = null;
    active = false;
    process.stderr.write(`  ${TAG} ${chalk.dim('stopped')}\n`);
}
/** Check if the watcher is currently active. */
export function isWatching() { return active; }
/** Manually emit a build or test failure event. */
export function emitBuildEvent(type, details, callback) {
    safeEmit(callback, { type, timestamp: now(), details });
}
//# sourceMappingURL=watcher.js.map