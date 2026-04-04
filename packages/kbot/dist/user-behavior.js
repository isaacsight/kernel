// kbot User Behavior — Passive Desktop Observation
//
// Captures what the user is doing on their machine: which apps are open,
// active window, time of day, screen count, whether Ollama is running.
// Snapshots are stored locally at ~/.kbot/memory/behavior/ as timestamped JSON.
//
// Privacy-conscious: captures app names and window titles only.
// No window contents, no screenshots, no keylogging. macOS only (osascript).
//
// Used by the dream engine (Tier 7) to consolidate workflow patterns:
//   - Most-used apps, active hours, app switching habits
//   - App combinations (e.g., "Ableton + Chrome often open together")
//   - Productivity rhythm, context-switching tendencies
import { execSync } from 'node:child_process';
import { homedir, platform } from 'node:os';
import { join } from 'node:path';
import { existsSync, mkdirSync, writeFileSync, readFileSync, readdirSync, unlinkSync, } from 'node:fs';
// ── Constants ──
const BEHAVIOR_DIR = join(homedir(), '.kbot', 'memory', 'behavior');
const MAX_SNAPSHOTS = 100;
// ── Helpers ──
function ensureDir() {
    if (!existsSync(BEHAVIOR_DIR))
        mkdirSync(BEHAVIOR_DIR, { recursive: true });
}
function exec(cmd, timeoutMs = 3000) {
    try {
        return execSync(cmd, {
            encoding: 'utf-8',
            timeout: timeoutMs,
            stdio: ['pipe', 'pipe', 'pipe'],
        }).trim();
    }
    catch {
        return '';
    }
}
/** Get list of visible app names via AppleScript (macOS only) */
function getVisibleApps() {
    if (platform() !== 'darwin')
        return [];
    const raw = exec('osascript -e \'tell application "System Events" to get name of every process whose visible is true\'', 5000);
    if (!raw)
        return [];
    // AppleScript returns comma-separated list
    return raw.split(',').map(s => s.trim()).filter(Boolean);
}
/** Get the frontmost app name */
function getActiveApp() {
    if (platform() !== 'darwin')
        return null;
    const raw = exec('osascript -e \'tell application "System Events" to get name of first process whose frontmost is true\'');
    return raw || null;
}
/** Get the active window title */
function getActiveWindowTitle() {
    if (platform() !== 'darwin')
        return null;
    const raw = exec('osascript -e \'tell application "System Events" to get title of front window of (first process whose frontmost is true)\'');
    // osascript returns empty or error if no window
    if (!raw || raw.includes('error') || raw.includes('missing value'))
        return null;
    return raw;
}
/** Get the number of connected screens */
function getScreenCount() {
    if (platform() !== 'darwin')
        return 1;
    const raw = exec('system_profiler SPDisplaysDataType 2>/dev/null', 5000);
    if (!raw)
        return 1;
    const matches = raw.match(/Resolution:/g);
    return matches ? matches.length : 1;
}
/** Check if Ollama process is running */
function isOllamaRunning() {
    const raw = exec('pgrep -x ollama 2>/dev/null || pgrep -f "ollama serve" 2>/dev/null');
    return raw.length > 0;
}
// ── Snapshot Management ──
function getSnapshotFiles() {
    ensureDir();
    return readdirSync(BEHAVIOR_DIR)
        .filter(f => f.endsWith('.json') && f.startsWith('snap_'))
        .sort();
}
/** Prune old snapshots beyond MAX_SNAPSHOTS (delete oldest) */
function pruneSnapshots() {
    const files = getSnapshotFiles();
    if (files.length <= MAX_SNAPSHOTS)
        return;
    const toDelete = files.slice(0, files.length - MAX_SNAPSHOTS);
    for (const f of toDelete) {
        try {
            unlinkSync(join(BEHAVIOR_DIR, f));
        }
        catch { /* ignore */ }
    }
}
function loadSnapshot(filename) {
    try {
        const raw = readFileSync(join(BEHAVIOR_DIR, filename), 'utf-8');
        return JSON.parse(raw);
    }
    catch {
        return null;
    }
}
// ── Public API ──
/**
 * Capture a behavior snapshot right now.
 * Runs osascript to detect visible apps, active window, screen count, etc.
 * Stores the snapshot to ~/.kbot/memory/behavior/ as a timestamped JSON file.
 *
 * Non-blocking-safe: catches all errors so it never crashes the caller.
 * macOS only — returns null on other platforms.
 */
export function captureUserBehavior() {
    if (platform() !== 'darwin')
        return null;
    try {
        const now = new Date();
        const snapshot = {
            timestamp: now.toISOString(),
            hour: now.getHours(),
            dayOfWeek: now.getDay(),
            visibleApps: getVisibleApps(),
            activeApp: getActiveApp(),
            activeWindowTitle: getActiveWindowTitle(),
            screenCount: getScreenCount(),
            ollamaRunning: isOllamaRunning(),
        };
        ensureDir();
        const filename = `snap_${now.toISOString().replace(/[:.]/g, '-')}.json`;
        writeFileSync(join(BEHAVIOR_DIR, filename), JSON.stringify(snapshot, null, 2));
        // Prune old snapshots
        pruneSnapshots();
        return snapshot;
    }
    catch {
        // Non-critical — never crash the caller
        return null;
    }
}
/**
 * Read recent snapshots and produce a behavior summary.
 * @param hours How many hours of history to analyze (default: 24)
 */
export function getBehaviorSummary(hours = 24) {
    try {
        const files = getSnapshotFiles();
        if (files.length === 0)
            return null;
        const cutoff = Date.now() - hours * 60 * 60 * 1000;
        const snapshots = [];
        // Read from newest to oldest, stop when out of range
        for (let i = files.length - 1; i >= 0; i--) {
            const snap = loadSnapshot(files[i]);
            if (!snap)
                continue;
            if (new Date(snap.timestamp).getTime() < cutoff)
                break;
            snapshots.push(snap);
        }
        if (snapshots.length === 0)
            return null;
        // ── App frequency ──
        const appCounts = new Map();
        for (const snap of snapshots) {
            for (const app of snap.visibleApps) {
                appCounts.set(app, (appCounts.get(app) || 0) + 1);
            }
        }
        const topApps = Array.from(appCounts.entries())
            .sort((a, b) => b[1] - a[1])
            .slice(0, 15)
            .map(([app, count]) => ({
            app,
            count,
            percent: Math.round((count / snapshots.length) * 100),
        }));
        // ── Active hours ──
        const activeHours = {};
        for (const snap of snapshots) {
            activeHours[snap.hour] = (activeHours[snap.hour] || 0) + 1;
        }
        // ── App combinations (pairs seen together) ──
        const pairCounts = new Map();
        for (const snap of snapshots) {
            const apps = snap.visibleApps.slice().sort();
            for (let i = 0; i < apps.length; i++) {
                for (let j = i + 1; j < apps.length; j++) {
                    const key = `${apps[i]}|${apps[j]}`;
                    pairCounts.set(key, (pairCounts.get(key) || 0) + 1);
                }
            }
        }
        const appCombinations = Array.from(pairCounts.entries())
            .filter(([, count]) => count >= 2) // Only show pairs seen 2+ times
            .sort((a, b) => b[1] - a[1])
            .slice(0, 10)
            .map(([key, count]) => ({
            apps: key.split('|'),
            count,
        }));
        // ── Average visible apps ──
        const totalVisible = snapshots.reduce((sum, s) => sum + s.visibleApps.length, 0);
        const avgVisibleApps = Math.round((totalVisible / snapshots.length) * 10) / 10;
        // ── Most common active app ──
        const activeCounts = new Map();
        for (const snap of snapshots) {
            if (snap.activeApp) {
                activeCounts.set(snap.activeApp, (activeCounts.get(snap.activeApp) || 0) + 1);
            }
        }
        const mostActiveApp = activeCounts.size > 0
            ? Array.from(activeCounts.entries()).sort((a, b) => b[1] - a[1])[0][0]
            : null;
        // ── Ollama usage ──
        const ollamaCount = snapshots.filter(s => s.ollamaRunning).length;
        const ollamaUsageRate = Math.round((ollamaCount / snapshots.length) * 100) / 100;
        // ── Human-readable text ──
        const textLines = [];
        textLines.push(`Behavior summary (${snapshots.length} snapshots over ${hours}h):`);
        if (topApps.length > 0) {
            textLines.push(`\nTop apps: ${topApps.slice(0, 8).map(a => `${a.app} (${a.percent}%)`).join(', ')}`);
        }
        if (mostActiveApp) {
            textLines.push(`Most focused app: ${mostActiveApp}`);
        }
        // Active hours summary
        const hourEntries = Object.entries(activeHours)
            .map(([h, c]) => ({ hour: parseInt(h), count: c }))
            .sort((a, b) => b.count - a.count);
        if (hourEntries.length > 0) {
            const peakHours = hourEntries.slice(0, 3).map(e => `${e.hour}:00`).join(', ');
            textLines.push(`Peak activity hours: ${peakHours}`);
        }
        if (appCombinations.length > 0) {
            textLines.push(`\nCommon app pairings:`);
            for (const combo of appCombinations.slice(0, 5)) {
                textLines.push(`  ${combo.apps.join(' + ')} (${combo.count}x)`);
            }
        }
        textLines.push(`\nAvg visible apps: ${avgVisibleApps}`);
        textLines.push(`Ollama running: ${Math.round(ollamaUsageRate * 100)}% of the time`);
        return {
            snapshotCount: snapshots.length,
            hoursCovered: hours,
            topApps,
            activeHours,
            appCombinations,
            avgVisibleApps,
            mostActiveApp,
            ollamaUsageRate,
            text: textLines.join('\n'),
        };
    }
    catch {
        return null;
    }
}
/**
 * Get a compact text summary suitable for dream engine injection.
 * Returns null if no data available.
 */
export function getBehaviorForDream(hours = 48) {
    const summary = getBehaviorSummary(hours);
    if (!summary || summary.snapshotCount < 2)
        return null;
    const lines = [];
    // Top apps
    if (summary.topApps.length > 0) {
        lines.push(`Top apps by frequency: ${summary.topApps.slice(0, 10).map(a => `${a.app} (${a.percent}%)`).join(', ')}`);
    }
    // Most focused
    if (summary.mostActiveApp) {
        lines.push(`Most focused (frontmost) app: ${summary.mostActiveApp}`);
    }
    // Active hours
    const hourEntries = Object.entries(summary.activeHours)
        .map(([h, c]) => ({ hour: parseInt(h), count: c }))
        .sort((a, b) => b.count - a.count);
    if (hourEntries.length > 0) {
        const peakHours = hourEntries.slice(0, 4).map(e => `${e.hour}:00`).join(', ');
        lines.push(`Peak activity hours: ${peakHours}`);
    }
    // App combinations
    if (summary.appCombinations.length > 0) {
        const combos = summary.appCombinations.slice(0, 5)
            .map(c => `${c.apps.join(' + ')} (${c.count}x)`)
            .join('; ');
        lines.push(`App combinations: ${combos}`);
    }
    // Context
    lines.push(`Avg visible apps: ${summary.avgVisibleApps}`);
    lines.push(`Ollama running: ${Math.round(summary.ollamaUsageRate * 100)}% of snapshots`);
    lines.push(`Based on ${summary.snapshotCount} snapshots over ${summary.hoursCovered}h`);
    return lines.join('\n');
}
//# sourceMappingURL=user-behavior.js.map