/**
 * Legacy hash-route resolver.
 *
 * The magazine published /#/issues/421-style URLs for years (hash
 * router + GitHub Pages). After the move to real paths, this maps a
 * legacy hash onto the path it cited so old links keep landing.
 *
 * Returns the path to replaceState to, or null when no redirect
 * applies. Never touches Supabase auth hashes (#access_token=…),
 * which the OAuth interceptor consumes before this runs.
 */
export function resolveLegacyHash(loc: {
  pathname: string
  search: string
  hash: string
}): string | null {
  const { pathname, search, hash } = loc
  if (!hash.startsWith('#/')) return null
  if (hash.includes('access_token=')) return null
  // Legacy URLs always carried the route in the hash on the root
  // path. A real path with a stray #/ fragment is left alone.
  if (pathname !== '/') return null

  // '#/issues/421?x=1' → '/issues/421?x=1' (query inside the hash,
  // e.g. Stripe's '#/?checkout=complete', is preserved).
  let target = hash.slice(1)
  if (target === '/') target = ''
  // Outer query (rare: '/?a=1#/path') is kept ahead of the hash's own.
  if (search) {
    const [hashPath, hashQuery] = target.split('?')
    target = hashPath + search + (hashQuery ? '&' + hashQuery : '')
  }
  return target || '/'
}
