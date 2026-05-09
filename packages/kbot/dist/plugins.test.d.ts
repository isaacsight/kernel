/**
 * Tests for plugin loader integrity wiring.
 *
 * Covers the four behaviour-contract branches:
 *   1. Manifest missing → no error, plugin still loads.
 *   2. Manifest present + matching hashes → loads only verified names.
 *   3. Manifest present + drift + integrity enforced → throws IntegrityError.
 *   4. Integrity disabled (KBOT_PLUGIN_INTEGRITY=off) + drift → loads anyway,
 *      yellow warning logged.
 *
 * The kbot tool registry is a module-level Map. Tests cannot clear it, so each
 * test uses a unique plugin name (random suffix) to avoid collisions with
 * other tests (and the rest of the kbot tool surface, which never registers
 * `plugin_*`).
 */
export {};
//# sourceMappingURL=plugins.test.d.ts.map