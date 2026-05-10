export interface PeekabooElement {
    /** Element handle, e.g. "elem_19", "elem_169" — integer-suffixed in 3.0.0-beta4. */
    id: string;
    role: string;
    /** Human-readable role description, e.g. "increment page button". */
    roleDescription?: string;
    label?: string;
    description?: string;
    /** AX help text, e.g. "Share the selected items". */
    help?: string;
    /** Stable AX identifier when the app sets one (e.g. "QuickActionMoreButton"). */
    identifier?: string;
    /** Window/element title; often empty for buttons. */
    title?: string;
    /** Whether the element is interactable (clickable / focusable). */
    isActionable?: boolean;
}
export interface PeekabooSeeResult {
    /** Snapshot id used by subsequent `--snapshot $id` arguments. */
    snapshot: string;
    elements: PeekabooElement[];
    /** Application name as reported by Peekaboo. */
    applicationName?: string;
    windowTitle?: string;
    elementCount?: number;
    interactableCount?: number;
    captureMode?: string;
    /** Path to the JSON UI map written by Peekaboo. */
    uiMap?: string;
    /** Optional path on disk where the screenshot was written. */
    screenshotPath?: string;
}
export interface PeekabooClickResult {
    ok: boolean;
    target?: string;
    coords?: [number, number];
}
export interface PeekabooTypeResult {
    ok: boolean;
    typed: string;
    cleared?: boolean;
}
export interface PeekabooSetValueResult {
    ok: boolean;
    target: string;
    value: string;
}
export interface PeekabooPerformActionResult {
    ok: boolean;
    target: string;
    action: string;
}
export interface PeekabooAgentResult {
    ok: boolean;
    output: string;
}
/**
 * Structured error returned by all command helpers when the binary exits
 * non-zero or emits malformed JSON. Helpers return `{ ok: false, error }`
 * rather than throw so callers can route via discriminated unions.
 */
export interface PeekabooError {
    ok: false;
    error: {
        code: 'non-zero-exit' | 'malformed-json' | 'binary-missing' | 'unknown';
        message: string;
        stderr?: string;
        stdout?: string;
        exitCode?: number;
    };
}
export type PeekabooOutcome<T> = ({
    ok: true;
} & T) | PeekabooError;
//# sourceMappingURL=types.d.ts.map