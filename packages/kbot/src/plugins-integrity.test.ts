/**
 * Tests for plugin integrity verification.
 *
 * Uses Vitest. Mirrors the OpenClaw fail-closed semantics: drift, missing
 * files, and malformed manifests all surface as failures the loader can act
 * on.
 */

import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { createHash } from 'node:crypto';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import {
  IntegrityError,
  enforce,
  loadManifest,
  verifyAllPlugins,
  verifyPlugin,
} from './plugins-integrity.js';

function sha256Base64(s: string): string {
  return `sha256-${createHash('sha256').update(s).digest('base64')}`;
}

describe('plugins-integrity', () => {
  let tmp: string;

  beforeEach(async () => {
    tmp = await mkdtemp(join(tmpdir(), 'kbot-integrity-'));
  });

  afterEach(async () => {
    await rm(tmp, { recursive: true, force: true });
  });

  describe('verifyPlugin', () => {
    it('returns ok for matching hash', async () => {
      const file = join(tmp, 'good.js');
      const body = 'export default function noop() {}';
      await writeFile(file, body, 'utf8');

      const result = await verifyPlugin(file, {
        name: 'good',
        version: '1.0.0',
        path: 'good.js',
        integrity: sha256Base64(body),
      });

      expect(result.ok).toBe(true);
    });

    it('returns drift for mismatched hash', async () => {
      const file = join(tmp, 'tampered.js');
      await writeFile(file, 'console.log("evil")', 'utf8');

      const result = await verifyPlugin(file, {
        name: 'tampered',
        version: '1.0.0',
        path: 'tampered.js',
        integrity: sha256Base64('console.log("original")'),
      });

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.reason).toBe('integrity drift');
        expect(result.actual).not.toEqual(result.expected);
        expect(result.actual.startsWith('sha256-')).toBe(true);
      }
    });

    it('returns missing for absent file', async () => {
      const result = await verifyPlugin(join(tmp, 'nope.js'), {
        name: 'nope',
        version: '1.0.0',
        path: 'nope.js',
        integrity: sha256Base64('whatever'),
      });

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.reason).toBe('plugin file missing');
      }
    });
  });

  describe('loadManifest', () => {
    it('throws on missing file', async () => {
      await expect(loadManifest(join(tmp, 'nope.json'))).rejects.toThrow(
        /Failed to read manifest/,
      );
    });

    it('throws on invalid JSON', async () => {
      const path = join(tmp, 'bad.json');
      await writeFile(path, '{ not json', 'utf8');
      await expect(loadManifest(path)).rejects.toThrow(/not valid JSON/);
    });

    it('throws on malformed schema (wrong schemaVersion)', async () => {
      const path = join(tmp, 'bad-schema.json');
      await writeFile(path, JSON.stringify({ schemaVersion: 2, plugins: [] }), 'utf8');
      await expect(loadManifest(path)).rejects.toThrow(/malformed/);
    });

    it('throws on malformed schema (missing integrity prefix)', async () => {
      const path = join(tmp, 'bad-entry.json');
      await writeFile(
        path,
        JSON.stringify({
          schemaVersion: 1,
          plugins: [{ name: 'x', version: '1.0.0', path: 'x.js', integrity: 'deadbeef' }],
        }),
        'utf8',
      );
      await expect(loadManifest(path)).rejects.toThrow(/malformed/);
    });

    it('loads a valid manifest', async () => {
      const path = join(tmp, 'ok.json');
      const m = {
        schemaVersion: 1,
        plugins: [
          { name: 'a', version: '1.0.0', path: 'a.js', integrity: sha256Base64('a') },
        ],
      };
      await writeFile(path, JSON.stringify(m), 'utf8');
      const loaded = await loadManifest(path);
      expect(loaded.plugins).toHaveLength(1);
      expect(loaded.plugins[0].name).toBe('a');
    });
  });

  describe('verifyAllPlugins + enforce', () => {
    it('verifies all matching plugins and enforce() is a no-op', async () => {
      const aBody = 'plugin a';
      const bBody = 'plugin b';
      await writeFile(join(tmp, 'a.js'), aBody, 'utf8');
      await writeFile(join(tmp, 'b.js'), bBody, 'utf8');

      const manifestPath = join(tmp, 'plugins.json');
      await writeFile(
        manifestPath,
        JSON.stringify({
          schemaVersion: 1,
          plugins: [
            { name: 'a', version: '1.0.0', path: 'a.js', integrity: sha256Base64(aBody) },
            { name: 'b', version: '2.0.0', path: 'b.js', integrity: sha256Base64(bBody) },
          ],
        }),
        'utf8',
      );

      const result = await verifyAllPlugins(manifestPath, tmp);
      expect(result.verified).toEqual(['a', 'b']);
      expect(result.failed).toEqual([]);
      expect(() => enforce(result)).not.toThrow();
    });

    it('flags drift and missing entries; enforce() throws IntegrityError', async () => {
      const goodBody = 'good';
      await writeFile(join(tmp, 'good.js'), goodBody, 'utf8');
      await writeFile(join(tmp, 'tampered.js'), 'tampered content', 'utf8');
      // 'missing.js' intentionally not written

      const manifestPath = join(tmp, 'plugins.json');
      await writeFile(
        manifestPath,
        JSON.stringify({
          schemaVersion: 1,
          plugins: [
            {
              name: 'good',
              version: '1.0.0',
              path: 'good.js',
              integrity: sha256Base64(goodBody),
            },
            {
              name: 'tampered',
              version: '1.0.0',
              path: 'tampered.js',
              integrity: sha256Base64('original'),
            },
            {
              name: 'missing',
              version: '1.0.0',
              path: 'missing.js',
              integrity: sha256Base64('x'),
            },
          ],
        }),
        'utf8',
      );

      const result = await verifyAllPlugins(manifestPath, tmp);
      expect(result.verified).toEqual(['good']);
      expect(result.failed).toHaveLength(2);
      const reasons = Object.fromEntries(result.failed.map((f) => [f.name, f.reason]));
      expect(reasons.tampered).toBe('integrity drift');
      expect(reasons.missing).toBe('plugin file missing');

      let caught: unknown;
      try {
        enforce(result);
      } catch (e) {
        caught = e;
      }
      expect(caught).toBeInstanceOf(IntegrityError);
      expect((caught as IntegrityError).failed).toHaveLength(2);
      expect((caught as IntegrityError).message).toMatch(/tampered/);
      expect((caught as IntegrityError).message).toMatch(/missing/);
    });
  });
});
