import { describe, expect, it } from "vitest";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { getAccount, getAlpacaCredentials } from "../src/adapters/alpaca/index.js";
import { AppendOnlyAuditLog } from "../src/audit-log.js";
import { makePositionLimitRule } from "../src/verifier/index.js";
import { alpacaQuery } from "../src/tools/alpaca-query.js";

/**
 * LIVE SMOKE — hits the real Alpaca paper-trading API.
 *
 * Per CONTRIBUTING.md: stub-driven unit tests pass against the spec, not
 * reality. Unlike Polymarket/EDGAR, this adapter requires a free
 * paper-trading key pair — skipped (not failed) when credentials aren't
 * configured, in addition to the KBOT_FINANCE_OFFLINE gate used by every
 * other adapter's live test.
 */

const OFFLINE = process.env["KBOT_FINANCE_OFFLINE"] === "1";
const HAS_CREDENTIALS = getAlpacaCredentials() !== null;

describe.skipIf(OFFLINE || !HAS_CREDENTIALS)("Alpaca paper-trading live smoke", () => {
  it("GET /v2/account returns a usable response", async () => {
    const r = await getAccount();
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(typeof r.value.id).toBe("string");
  }, 30_000);

  it("end-to-end: query + verifier + audit log integrity", async () => {
    const dir = await mkdtemp(join(tmpdir(), "kbot-finance-alpaca-live-"));
    const path = join(dir, "audit.jsonl");
    try {
      const auditLog = await AppendOnlyAuditLog.open(path);
      const rules = [
        makePositionLimitRule({ default_max_size: 10_000, default_max_notional: 50_000 }),
      ];
      const result = await alpacaQuery(
        { mode: "account", data_as_of: new Date().toISOString() },
        {
          auditLog,
          rules,
          verifierContext: { session_id: "live-test", state: {}, jurisdiction: "US" },
        },
      );
      expect(result.ok).toBe(true);
      if (!result.ok) return;
      expect(result.response.request_hash).toHaveLength(64);

      const integrity = await AppendOnlyAuditLog.verify(path);
      expect(integrity.ok).toBe(true);
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  }, 30_000);
});
