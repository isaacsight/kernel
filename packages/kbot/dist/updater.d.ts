/**
 * Check for updates and auto-install silently.
 * Returns a status message or null.
 * - If update was installed in background since last run: "Updated to X.Y.Z"
 * - If update is installing now: null (silent)
 * - If already current: null
 */
export declare function checkForUpdate(currentVersion: string): string | null;
/** Get latest version from npm registry (blocking — used by explicit update command) */
export declare function getLatestVersion(): string | null;
/** Explicit self-update (for `kbot update` command). Blocking with status output. */
export declare function selfUpdate(currentVersion: string, onStatus: (msg: string) => void): boolean;
//# sourceMappingURL=updater.d.ts.map