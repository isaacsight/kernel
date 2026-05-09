import { type Persona } from './futures/persona/index.js';
export type PermissionMode = 'permissive' | 'normal' | 'strict';
/**
 * Set (or clear) the active persona by id. Pass null to disable persona checking.
 * Throws if id is not found in PERSONA_REGISTRY.
 *
 * v4.2.0 wires the futures/persona substrate into the live permissions chain.
 * When a persona is set, every checkPermission() call runs canInvoke() FIRST;
 * if the persona denies, the tool is blocked before the destructive-op prompt.
 */
export declare function setActivePersona(id: string | null): void;
/** Get the currently active persona, or null if none. */
export declare function getActivePersona(): Persona | null;
/**
 * Check the active persona (if any) against a tool invocation.
 * Returns the denial reason string if denied, or null if allowed (or no persona set).
 */
export declare function checkPersonaScope(toolName: string, args: Record<string, unknown>): string | null;
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