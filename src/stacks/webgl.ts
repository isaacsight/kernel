/* WebGL2 probe. The room's canvas layer mounts only when this is
   true; otherwise the ledger stands alone (the resting page is
   complete either way). Injectable for tests. */
export function webglAvailable(
  create: (kind: string) => unknown = (kind) =>
    document.createElement('canvas').getContext(kind),
): boolean {
  try {
    return Boolean(create('webgl2'))
  } catch {
    return false
  }
}
