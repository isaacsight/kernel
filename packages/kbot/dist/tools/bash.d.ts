/**
 * Translate a simple POSIX command to its PowerShell equivalent.
 * Returns null when no faithful translation exists (the command then
 * passes through to the system shell unchanged). Exported for tests —
 * pure function, runs on every platform.
 */
export declare function translatePosixForWindows(command: string): string | null;
export declare function registerBashTools(): void;
//# sourceMappingURL=bash.d.ts.map