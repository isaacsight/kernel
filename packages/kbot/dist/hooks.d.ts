interface HookResult {
    ran: boolean;
    output?: string;
    blocked?: boolean;
    blockReason?: string;
}
/**
 * Run a pre-tool hook. Returns whether the tool should proceed.
 */
export declare function runPreToolHook(toolName: string, args: Record<string, unknown>, agent: string): HookResult;
/**
 * Run a post-tool hook.
 */
export declare function runPostToolHook(toolName: string, args: Record<string, unknown>, result: string, agent: string): HookResult;
/**
 * Run a lifecycle hook (session-start, session-end).
 */
export declare function runLifecycleHook(hookName: 'session-start' | 'session-end', agent: string): HookResult;
/**
 * List all installed hooks.
 */
export declare function listHooks(): Array<{
    name: string;
    path: string;
}>;
export {};
//# sourceMappingURL=hooks.d.ts.map