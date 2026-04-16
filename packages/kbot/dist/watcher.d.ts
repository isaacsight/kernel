export interface WatchEvent {
    type: 'file_changed' | 'build_failed' | 'test_failed' | 'new_commit' | 'new_issue';
    timestamp: string;
    details: Record<string, unknown>;
}
type EventCallback = (event: WatchEvent) => void;
/** Start watching a project directory for file changes and new git commits. */
export declare function startWatching(projectDir: string, callback: EventCallback): void;
/** Stop all watchers and clean up. */
export declare function stopWatching(): void;
/** Check if the watcher is currently active. */
export declare function isWatching(): boolean;
/** Manually emit a build or test failure event. */
export declare function emitBuildEvent(type: 'build_failed' | 'test_failed', details: Record<string, unknown>, callback: EventCallback): void;
export {};
//# sourceMappingURL=watcher.d.ts.map