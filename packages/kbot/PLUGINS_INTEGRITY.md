# Plugin Integrity

K:BOT plugins are pinned by SHA-256 in a manifest and verified before load.
The loader **fails closed**: any drift, missing file, or malformed manifest
refuses to load *all* plugins for that session.

This mirrors OpenClaw's `plugins.json5` model — a small, auditable
allowlist that catches tampering, partial downloads, and stale local copies.

## Manifest schema

`packages/kbot/examples/plugins.json` shows the shape:

```json
{
  "schemaVersion": 1,
  "plugins": [
    {
      "name": "hello-world",
      "version": "0.1.0",
      "path": "hello-world/index.js",
      "integrity": "sha256-47DEQpj8HBSa+/TImW+5JCeuQeRkm5NMpJWZG3hSuFU="
    }
  ]
}
```

| Field | Required | Notes |
|---|---|---|
| `schemaVersion` | yes | Must equal `1` for now. |
| `plugins[].name` | yes | Stable identifier — used for log messages and error strings. |
| `plugins[].version` | yes | SemVer. Informational at load time; bumps should accompany hash bumps. |
| `plugins[].path` | yes | Path relative to the plugins directory (typically `~/.kbot/plugins`). Absolute paths are also accepted. |
| `plugins[].integrity` | yes | `sha256-<base64>`, exactly. Subresource-Integrity-compatible format. |

> **Why JSON, not JSON5?** OpenClaw uses JSON5 to allow comments. We're staying
> on plain JSON for now to avoid the dep. If JSON5 is added later, `loadManifest`
> swaps `JSON.parse` → `JSON5.parse` and the file extension becomes `.json5`.

## Computing a hash

```bash
# macOS / Linux
shasum -a 256 -b path/to/plugin.js | awk '{print $1}' | xxd -r -p | base64
# → prefix with "sha256-"
```

Or in Node:

```js
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
const h = createHash('sha256').update(readFileSync('path/to/plugin.js')).digest('base64');
console.log(`sha256-${h}`);
```

## API

```ts
import {
  loadManifest,
  verifyPlugin,
  verifyAllPlugins,
  enforce,
  IntegrityError,
} from '@kernel.chat/kbot/plugins-integrity';

const result = await verifyAllPlugins('~/.kbot/plugins.json', '~/.kbot/plugins');
enforce(result); // throws IntegrityError on any failure
// → safe to load result.verified
```

`enforce(result)` is a no-op when every plugin verifies. On any drift it
throws `IntegrityError` with a `.failed` array. Loaders should call
`enforce` unconditionally unless the user has explicitly opted out (e.g.
`KBOT_PLUGIN_INTEGRITY=off` for local development) — and that opt-out should
log a loud warning.

## Failure modes

| Reason | Trigger |
|---|---|
| `integrity drift` | File exists but its SHA-256 does not match the manifest. |
| `plugin file missing` | The manifest references a path that does not exist on disk. |
| `loadManifest` throws | Manifest file missing, not valid JSON, or schema-invalid. |

## Rationale

- **Supply-chain hygiene.** Plugins ship code from `~/.kbot/plugins` straight
  into kbot's tool surface. A drifted plugin can quietly add tools, exfiltrate
  data, or shadow built-ins. Pinning blocks that vector.
- **Reproducibility.** Two machines with the same manifest run byte-identical
  plugins or refuse to start.
- **Cheap to ship.** No new deps; pure Node `crypto` + `fs/promises`.

## Wiring (follow-up)

Suggested integration site: `packages/kbot/src/plugins.ts` (the existing
plugin loader). Before loading any file in `~/.kbot/plugins/`, call:

```ts
const result = await verifyAllPlugins(manifestPath, pluginsDir);
if (process.env.KBOT_PLUGIN_INTEGRITY !== 'off') enforce(result);
```

and only `import()` plugins whose names appear in `result.verified`.
