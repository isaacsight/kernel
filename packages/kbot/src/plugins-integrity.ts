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

import { createHash } from 'node:crypto';
import { readFile, stat } from 'node:fs/promises';
import { resolve, isAbsolute } from 'node:path';

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

export type VerifyResult =
  | { ok: true }
  | { ok: false; reason: string; expected: string; actual: string };

export interface VerifyAllResult {
  verified: string[];
  failed: Array<{ name: string; reason: string; expected?: string; actual?: string }>;
}

export class IntegrityError extends Error {
  failed: VerifyAllResult['failed'];
  constructor(failed: VerifyAllResult['failed']) {
    const names = failed.map((f) => `${f.name} (${f.reason})`).join(', ');
    super(`Plugin integrity check failed: ${names}`);
    this.name = 'IntegrityError';
    this.failed = failed;
  }
}

const INTEGRITY_PREFIX = 'sha256-';

function isManifestEntry(v: unknown): v is ManifestEntry {
  if (!v || typeof v !== 'object') return false;
  const e = v as Record<string, unknown>;
  return (
    typeof e.name === 'string' &&
    typeof e.version === 'string' &&
    typeof e.path === 'string' &&
    typeof e.integrity === 'string' &&
    e.integrity.startsWith(INTEGRITY_PREFIX)
  );
}

function isManifest(v: unknown): v is Manifest {
  if (!v || typeof v !== 'object') return false;
  const m = v as Record<string, unknown>;
  if (m.schemaVersion !== 1) return false;
  if (!Array.isArray(m.plugins)) return false;
  return m.plugins.every(isManifestEntry);
}

/**
 * Load and validate a manifest from disk. Throws on missing file, invalid
 * JSON, or schema violation.
 */
export async function loadManifest(path: string): Promise<Manifest> {
  let raw: string;
  try {
    raw = await readFile(path, 'utf8');
  } catch (err) {
    throw new Error(`Failed to read manifest at ${path}: ${(err as Error).message}`);
  }
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch (err) {
    throw new Error(`Manifest is not valid JSON: ${(err as Error).message}`);
  }
  if (!isManifest(parsed)) {
    throw new Error(
      `Manifest at ${path} is malformed: expected { schemaVersion: 1, plugins: [{name, version, path, integrity: "sha256-..."}] }`,
    );
  }
  return parsed;
}

/**
 * Compute SHA-256 of a file and return it formatted as `sha256-<base64>`.
 */
async function computeIntegrity(filePath: string): Promise<string> {
  const buf = await readFile(filePath);
  const digest = createHash('sha256').update(buf).digest('base64');
  return `${INTEGRITY_PREFIX}${digest}`;
}

/**
 * Verify a single plugin file against its manifest entry.
 *
 * - Missing file → `{ ok: false, reason: "plugin file missing" }`
 * - Hash mismatch → `{ ok: false, reason: "integrity drift" }`
 * - Match → `{ ok: true }`
 */
export async function verifyPlugin(
  filePath: string,
  manifestEntry: ManifestEntry,
): Promise<VerifyResult> {
  try {
    const s = await stat(filePath);
    if (!s.isFile()) {
      return {
        ok: false,
        reason: 'plugin file missing',
        expected: manifestEntry.integrity,
        actual: '',
      };
    }
  } catch {
    return {
      ok: false,
      reason: 'plugin file missing',
      expected: manifestEntry.integrity,
      actual: '',
    };
  }

  const actual = await computeIntegrity(filePath);
  if (actual !== manifestEntry.integrity) {
    return {
      ok: false,
      reason: 'integrity drift',
      expected: manifestEntry.integrity,
      actual,
    };
  }
  return { ok: true };
}

/**
 * Verify every plugin in a manifest against the corresponding files under
 * `pluginsDir`. Resolves entry paths relative to `pluginsDir` unless
 * absolute.
 *
 * Always returns a result; never throws on drift. Callers should pass the
 * result to `enforce()` to fail closed.
 */
export async function verifyAllPlugins(
  manifestPath: string,
  pluginsDir: string,
): Promise<VerifyAllResult> {
  const manifest = await loadManifest(manifestPath);
  const verified: string[] = [];
  const failed: VerifyAllResult['failed'] = [];

  for (const entry of manifest.plugins) {
    const filePath = isAbsolute(entry.path) ? entry.path : resolve(pluginsDir, entry.path);
    const result = await verifyPlugin(filePath, entry);
    if (result.ok) {
      verified.push(entry.name);
    } else {
      failed.push({
        name: entry.name,
        reason: result.reason,
        expected: result.expected,
        actual: result.actual,
      });
    }
  }

  return { verified, failed };
}

/**
 * Fail-closed gate. Throws `IntegrityError` if any plugin failed verification.
 * No-op when all plugins are verified. Loaders should call this unless
 * integrity checking has been explicitly disabled (e.g. dev override).
 */
export function enforce(result: VerifyAllResult): void {
  if (result.failed.length > 0) {
    throw new IntegrityError(result.failed);
  }
}
