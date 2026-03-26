/** Claude Code hook event types */
export type HookEventType = 'FileChanged' | 'TaskCompleted' | 'SessionStart' | 'SessionEnd' | 'StopFailure';
/** Data payload for each hook event */
export interface FileChangedData {
    file: string;
    changeType?: 'create' | 'edit' | 'delete' | 'rename';
    diff?: string;
}
export interface TaskCompletedData {
    task: string;
    agent: string;
    success: boolean;
    duration_ms: number;
    tokens_in?: number;
    tokens_out?: number;
    cost?: number;
    tools_used?: string[];
    error?: string;
}
export interface SessionStartData {
    cwd: string;
    agent?: string;
    resumeFrom?: string;
}
export interface SessionEndData {
    cwd: string;
    agent?: string;
    turnCount?: number;
    duration_ms?: number;
}
export interface StopFailureData {
    reason: string;
    command?: string;
    exitCode?: number;
    stderr?: string;
}
export type HookEventData = FileChangedData | TaskCompletedData | SessionStartData | SessionEndData | StopFailureData;
/** Result from handling a hook event */
export interface HookHandlerResult {
    event: HookEventType;
    handled: boolean;
    subsystem: string;
    output?: string;
    error?: string;
    duration_ms: number;
}
/** Claude Code settings.json hook configuration shape */
export interface ClaudeHookConfig {
    event: string;
    command: string;
    timeout?: number;
    matcher?: string;
}
export interface ClaudeHooksSection {
    hooks: ClaudeHookConfig[];
}
/**
 * Generate the hooks configuration JSON for Claude Code's settings.json.
 *
 * This produces the `hooks` array that should be merged into
 * `.claude/settings.json` or `~/.claude/settings.json`.
 *
 * Each hook calls `kbot hook-dispatch <event>` with context passed via
 * environment variables.
 *
 * @param options.kbotPath - Path to kbot binary (default: 'kbot')
 * @param options.timeout  - Default timeout in ms (default: 30000)
 * @returns The hooks section for settings.json
 */
export declare function generateHooksConfig(options?: {
    kbotPath?: string;
    timeout?: number;
}): ClaudeHooksSection;
/**
 * Dispatch a Claude Code hook event to the appropriate kbot subsystem.
 *
 * @param event - The hook event type
 * @param data  - Event-specific payload
 * @returns Result of handling the event
 */
export declare function handleHookEvent(event: HookEventType, data: HookEventData): Promise<HookHandlerResult>;
/**
 * Read existing Claude Code settings.json and merge kbot hooks into it.
 * Returns the merged JSON object. Does not write to disk.
 *
 * @param settingsPath - Path to settings.json (default: .claude/settings.json)
 */
export declare function mergeHooksIntoSettings(settingsPath?: string, kbotPath?: string): Record<string, unknown>;
//# sourceMappingURL=hooks-integration.d.ts.map