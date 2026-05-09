/**
 * Tests for plugin-sdk loader integrity wiring.
 *
 * Mirrors `plugins.test.ts`'s four behaviour-contract branches against the
 * SDK loader (which handles directory-style packaged plugins, vs. the
 * drop-in `.js` files plugins.ts handles):
 *   1. Manifest missing → no error, plugin still loads.
 *   2. Manifest present + matching hashes → loads only verified names.
 *   3. Manifest present + drift + integrity enforced → throws IntegrityError.
 *   4. Integrity disabled (KBOT_PLUGIN_INTEGRITY=off) + drift → loads anyway,
 *      yellow warning logged.
 *
 * The SDK loader also reads a per-plugin enable/disable list from
 * `~/.kbot/plugins.json` (PLUGINS_CONFIG). That path collides with the
 * default integrity manifest path, so each test passes an explicit
 * `manifestPath` outside the plugins directory and accepts the SDK's
 * "default-enabled when not in disabled list" behaviour.
 *
 * The kbot tool registry is a module-level Map. Tests cannot clear it, so
 * each test uses a unique plugin name (random suffix).
 */
export {};
//# sourceMappingURL=plugin-sdk.test.d.ts.map