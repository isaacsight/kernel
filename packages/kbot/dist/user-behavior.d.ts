export interface BehaviorSnapshot {
    /** ISO timestamp */
    timestamp: string;
    /** Hour of day (0-23) */
    hour: number;
    /** Day of week (0=Sunday, 6=Saturday) */
    dayOfWeek: number;
    /** Visible app names */
    visibleApps: string[];
    /** Active (frontmost) app name */
    activeApp: string | null;
    /** Active window title */
    activeWindowTitle: string | null;
    /** Number of connected screens */
    screenCount: number;
    /** Whether Ollama daemon is running */
    ollamaRunning: boolean;
}
export interface BehaviorSummary {
    /** Number of snapshots analyzed */
    snapshotCount: number;
    /** Hours covered */
    hoursCovered: number;
    /** Apps ranked by frequency (name → count) */
    topApps: Array<{
        app: string;
        count: number;
        percent: number;
    }>;
    /** Active hours (hour → snapshot count) */
    activeHours: Record<number, number>;
    /** App combinations seen together (sorted by frequency) */
    appCombinations: Array<{
        apps: string[];
        count: number;
    }>;
    /** Average number of visible apps per snapshot */
    avgVisibleApps: number;
    /** Most common active app */
    mostActiveApp: string | null;
    /** Ollama usage rate (0-1) */
    ollamaUsageRate: number;
    /** Human-readable summary */
    text: string;
}
/**
 * Capture a behavior snapshot right now.
 * Runs osascript to detect visible apps, active window, screen count, etc.
 * Stores the snapshot to ~/.kbot/memory/behavior/ as a timestamped JSON file.
 *
 * Non-blocking-safe: catches all errors so it never crashes the caller.
 * macOS only — returns null on other platforms.
 */
export declare function captureUserBehavior(): BehaviorSnapshot | null;
/**
 * Read recent snapshots and produce a behavior summary.
 * @param hours How many hours of history to analyze (default: 24)
 */
export declare function getBehaviorSummary(hours?: number): BehaviorSummary | null;
/**
 * Get a compact text summary suitable for dream engine injection.
 * Returns null if no data available.
 */
export declare function getBehaviorForDream(hours?: number): string | null;
//# sourceMappingURL=user-behavior.d.ts.map