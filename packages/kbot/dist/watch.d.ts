export interface WatchOptions {
    /** Directory to watch (default: cwd) */
    path?: string;
    /** File extensions to watch (default: common source extensions) */
    extensions?: string[];
    /** Whether to run analysis on changes (default: true) */
    analyze?: boolean;
    /** Callback for change events */
    onChange?: (event: WatchEvent) => void;
}
export interface WatchEvent {
    file: string;
    type: 'change' | 'rename';
    timestamp: Date;
    analysis?: FileAnalysis;
}
export interface FileAnalysis {
    todos: number;
    debugStatements: number;
    syntaxIssues: string[];
    lineCount: number;
}
export declare function startWatch(path?: string, options?: WatchOptions): Promise<void>;
export declare function stopWatch(): void;
/**
 * Get the recent change log (last 20 file changes).
 */
export declare function getChangeLog(): WatchEvent[];
/**
 * Clear the change log.
 */
export declare function clearChangeLog(): void;
/**
 * Check whether the watcher is currently active.
 */
export declare function isWatching(): boolean;
//# sourceMappingURL=watch.d.ts.map