import { describe, expect, it } from "vitest";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { listMarkets, gammaGet } from "../src/adapters/polymarket/index.js";
import { AppendOnlyAuditLog } from "../src/audit-log.js";
import { makePositionLimitRule } from "../src/verifier/index.js";
import { polymarketQuery } from "../src/tools/polymarket-query.js";

/**
 * LIVE SMOKE — hits the real Polymarket Gamma API.
 *
 * This is the rule from feedback_live_smoke_for_adapters.md:
 * stub-driven unit tests pass against the spec, not reality. Run the real
 * binary once before declaring an adapter done.
 *
 * Skipped when KBOT_FINANCE_OFFLINE=1 so CI without network still passes.
 */

const OFFLINE = process.env["KBOT_FINANCE_OFFLINE"] === "1";

describe.skipIf(OFFLINE)("Polymarket Gamma live smoke", () => {
  it("Gamma /markets returns a usable response", async () => {
    const r = await listMarkets({ limit: 1, active: true, closed: false });
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(Array.isArray(r.value)).toBe(true);
  }, 30_000);

  it("gammaGet handles 404 cleanly", async () => {
    const r = await gammaGet("/this-endpoint-does-not-exist", {});
    expect(r.ok).toBe(false);
    if (r.ok) return;
    // Polymarket may return 404 or 200 with an empty body or HTML for unknown
    // endpoints — both shapes are acceptable as long as we don't throw.
    expect(["not_found", "http", "parse"]).toContain(r.error.code);
  }, 30_000);

  it("end-to-end: query + verifier + audit log integrity", async () => {
    const dir = await mkdtemp(join(tmpdir(), "kbot-finance-live-"));
    const path = join(dir, "audit.jsonl");
    try {
      const auditLog = await AppendOnlyAuditLog.open(path);
      const rules = [
        makePositionLimitRule({ default_max_size: 10_000, default_max_notional: 50_000 }),
      ];
      const result = await polymarketQuery(
        {
          mode: "list_active",
          limit: 2,
          data_as_of: new Date().toISOString(),
        },
        {
          auditLog,
          rules,
          verifierContext: { session_id: "live-test", state: {}, jurisdiction: "US" },
        },
      );
      expect(result.ok).toBe(true);
      if (!result.ok) return;
      expect(result.response.request_hash).toHaveLength(64);
      expect(result.response.value.markets.length).toBeGreaterThan(0);

      const integrity = await AppendOnlyAuditLog.verify(path);
      expect(integrity.ok).toBe(true);
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  }, 30_000);
});
