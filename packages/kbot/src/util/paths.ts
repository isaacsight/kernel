/**
 * Cross-platform path string helpers.
 *
 * kbot is npm-distributed and runs on Windows, macOS, and Linux. Node's own
 * `path.basename` / `path.sep` are *host-OS-aware*, not *input-aware*: on a
 * POSIX host `path.basename('C:\\a\\b')` returns the whole string because `\`
 * is a legal filename char there. That breaks two real cases:
 *   - a Windows path processed in code (separators are `\`), and
 *   - a git/URL path processed on Windows (separators stay `/`).
 *
 * These helpers are separator-agnostic — they treat both `/` and `\` as
 * separators regardless of host — so they behave identically in CI (Linux)
 * and in production on Windows.
 */

/** Separator class matching both POSIX `/` and Windows `\`. */
const SEP = /[/\\]/

/**
 * Normalize any path string to forward-slash (POSIX) separators.
 *
 * Use this on the output of `path.relative()` / `path.join()` before any code
 * that assumes `/` (string splits, display trees, glob matching). Idempotent
 * on already-POSIX paths.
 *
 * @example toPosix('src\\tools\\bash.ts') === 'src/tools/bash.ts'
 * @example toPosix('src/tools/bash.ts')   === 'src/tools/bash.ts'
 */
export function toPosix(p: string): string {
  return p.replace(/\\/g, '/')
}

/**
 * Return the final path segment (the "basename") of a path string, treating
 * both `/` and `\` as separators on every host.
 *
 * TODO(human): implement this.
 *
 * The contract the call sites and tests rely on:
 *   baseName('src/tools/bash.ts')        -> 'bash.ts'
 *   baseName('src\\tools\\bash.ts')      -> 'bash.ts'   (Windows path on any host)
 *   baseName('C:\\Users\\isaac\\kernel') -> 'kernel'
 *   baseName('bash.ts')                  -> 'bash.ts'   (no separator)
 *   baseName('')                         -> ''
 *
 * Design decisions YOU get to make (the tests below pin whichever you pick —
 * adjust the test expectations to match your choice):
 *   1. Trailing separator: should baseName('src/tools/') be 'tools' (ignore the
 *      trailing slash, like Unix `basename`) or '' (the literal last segment)?
 *   2. Root-only input: what should baseName('/') or baseName('C:\\') return?
 *   3. Empty/garbage input: returning '' is the safe default the call sites
 *      fall back from (e.g. `baseName(x) || x`).
 *
 * Keep it pure and allocation-light — it runs in hot loops (graph node
 * extraction, repo-map formatting).
 */
export function baseName(p: string): string {
  // Split on either separator, drop empty segments (collapses trailing and
  // duplicate separators, Unix `basename` style), and take the last one.
  // Empty / root-only input yields '' so callers can fall back via `|| p`.
  const segments = p.split(SEP)
  for (let i = segments.length - 1; i >= 0; i--) {
    if (segments[i]) return segments[i]
  }
  return ''
}
