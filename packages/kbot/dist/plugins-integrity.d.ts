/**
 * Plugin integrity verification — fail-closed SHA-256 manifest checking.
 *
 * Ports OpenClaw's `plugins.json5` integrity-pinned plugin model. Plugins must
 * be declared in a manifest with a SHA-256 hash; the loader verifies the file
 * on disk against the manifest entry and refuses to load on drift.
 *
 * Manifest format here is plain JSON. If we add a JSON5 dep later (e.g.
 * `json5`), swap `JSON.parse` for `JSON5.parse` and accept `.json5` files.
 */
export interface ManifestEntry {
    name: string;
    version: string;
    /** Path relative to the plugins directory (e.g. ~/.kbot/plugins). */
    path: string;
    /** SHA-256 hash, base64-encoded, prefixed with "sha256-". */
    integrity: string;
}
export interface Manifest {
    schemaVersion: 1;
    plugins: ManifestEntry[];
}
export type VerifyResult = {
    ok: true;
} | {
    ok: false;
    reason: string;
    expected: string;
    actual: string;
};
export interface VerifyAllResult {
    verified: string[];
    failed: Array<{
        name: string;
        reason: string;
        expected?: string;
        actual?: string;
    }>;
}
export declare class IntegrityError extends Error {
    failed: VerifyAllResult['failed'];
    constructor(failed: VerifyAllResult['failed']);
}
/**
 * Load and validate a manifest from disk. Throws on missing file, invalid
 * JSON, or schema violation.
 */
export declare function loadManifest(path: string): Promise<Manifest>;
/**
 * Verify a single plugin file against its manifest entry.
 *
 * - Missing file → `{ ok: false, reason: "plugin file missing" }`
 * - Hash mismatch → `{ ok: false, reason: "integrity drift" }`
 * - Match → `{ ok: true }`
 */
export declare function verifyPlugin(filePath: string, manifestEntry: ManifestEntry): Promise<VerifyResult>;
/**
 * Verify every plugin in a manifest against the corresponding files under
 * `pluginsDir`. Resolves entry paths relative to `pluginsDir` unless
 * absolute.
 *
 * Always returns a result; never throws on drift. Callers should pass the
 * result to `enforce()` to fail closed.
 */
export declare function verifyAllPlugins(manifestPath: string, pluginsDir: string): Promise<VerifyAllResult>;
/**
 * Fail-closed gate. Throws `IntegrityError` if any plugin failed verification.
 * No-op when all plugins are verified. Loaders should call this unless
 * integrity checking has been explicitly disabled (e.g. dev override).
 */
export declare function enforce(result: VerifyAllResult): void;
//# sourceMappingURL=plugins-integrity.d.ts.map