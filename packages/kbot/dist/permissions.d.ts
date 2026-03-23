export type PermissionMode = 'permissive' | 'normal' | 'strict';
/** Set the permission mode */
export declare function setPermissionMode(mode: PermissionMode): void;
/** Get the current permission mode */
export declare function getPermissionMode(): PermissionMode;
/**
 * Check if a tool call requires user confirmation.
 * Returns the reason if confirmation is needed, null otherwise.
 */
export declare function needsConfirmation(toolName: string, args: Record<string, unknown>): string | null;
/**
 * Ask the user to confirm a tool call.
 * Returns true if approved, false if denied.
 */
export declare function confirmToolCall(toolName: string, args: Record<string, unknown>, reason: string): Promise<boolean>;
/**
 * Check and confirm a tool call. Returns true to proceed, false to skip.
 * Used as middleware in the tool execution pipeline.
 */
export declare function checkPermission(toolName: string, args: Record<string, unknown>): Promise<boolean>;
//# sourceMappingURL=permissions.d.ts.map