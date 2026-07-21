import { describe, expect, it, beforeEach, afterEach } from "vitest";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { decodeNumeric, alpacaGet, type AlpacaAccount } from "../src/adapters/alpaca/index.js";
import { AppendOnlyAuditLog } from "../src/audit-log.js";
import { makePositionLimitRule } from "../src/verifier/index.js";
import { alpacaQuery } from "../src/tools/alpaca-query.js";

describe("Alpaca adapter", () => {
  it("decodes numeric string fields", () => {
    expect(decodeNumeric("1234.56")).toBe(1234.56);
    expect(decodeNumeric("0")).toBe(0);
    expect(decodeNumeric(undefined)).toBeNull();
    expect(decodeNumeric("not-a-number")).toBeNull();
  });

  it("alpacaGet returns missing_credentials when no key pair is configured", async () => {
    const savedKeyId = process.env["KBOT_FINANCE_ALPACA_KEY_ID"];
    const savedSecret = process.env["KBOT_FINANCE_ALPACA_SECRET_KEY"];
    const savedApcaKeyId = process.env["APCA_API_KEY_ID"];
    const savedApcaSecret = process.env["APCA_API_SECRET_KEY"];
    delete process.env["KBOT_FINANCE_ALPACA_KEY_ID"];
    delete process.env["KBOT_FINANCE_ALPACA_SECRET_KEY"];
    delete process.env["APCA_API_KEY_ID"];
    delete process.env["APCA_API_SECRET_KEY"];
    try {
      const r = await alpacaGet<AlpacaAccount>("/v2/account");
      expect(r.ok).toBe(false);
      if (r.ok) return;
      expect(r.error.code).toBe("missing_credentials");
    } finally {
      if (savedKeyId !== undefined) process.env["KBOT_FINANCE_ALPACA_KEY_ID"] = savedKeyId;
      if (savedSecret !== undefined) process.env["KBOT_FINANCE_ALPACA_SECRET_KEY"] = savedSecret;
      if (savedApcaKeyId !== undefined) process.env["APCA_API_KEY_ID"] = savedApcaKeyId;
      if (savedApcaSecret !== undefined) process.env["APCA_API_SECRET_KEY"] = savedApcaSecret;
    }
  });
});

describe("alpacaQuery tool wiring", () => {
  let dir: string;
  let auditLog: AppendOnlyAuditLog;
  const rules = [makePositionLimitRule({ default_max_size: 10_000, default_max_notional: 50_000 })];

  beforeEach(async () => {
    dir = await mkdtemp(join(tmpdir(), "kbot-finance-alpaca-test-"));
    auditLog = await AppendOnlyAuditLog.open(join(dir, "audit.jsonl"));
  });

  afterEach(async () => {
    await rm(dir, { recursive: true, force: true });
  });

  it("mode=account normalizes numeric fields and seals a replayable-false envelope", async () => {
    const result = await alpacaQuery(
      { mode: "account", data_as_of: new Date().toISOString() },
      {
        auditLog,
        rules,
        verifierContext: { session_id: "test", state: {}, jurisdiction: "US" },
        engine: {
          getAccount: async () => ({
            ok: true,
            value: { id: "abc123", status: "ACTIVE", currency: "USD", cash: "1000.50", equity: "2000.75" },
          }),
          listPositions: async () => ({ ok: true, value: [] }),
          getPosition: async () => ({ ok: false, error: { code: "not_found", message: "n/a" } }),
          listOrders: async () => ({ ok: true, value: [] }),
        },
      },
    );

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.response.byte_identical_replayable).toBe(false);
    expect(result.response.value.account?.cash).toBe(1000.5);
    expect(result.response.value.account?.equity).toBe(2000.75);
    expect(result.response.request_hash).toHaveLength(64);
  });

  it("mode=positions normalizes an array of positions", async () => {
    const result = await alpacaQuery(
      { mode: "positions", data_as_of: new Date().toISOString() },
      {
        auditLog,
        rules,
        verifierContext: { session_id: "test", state: {}, jurisdiction: "US" },
        engine: {
          getAccount: async () => ({ ok: false, error: { code: "not_found", message: "n/a" } }),
          listPositions: async () => ({
            ok: true,
            value: [
              {
                symbol: "AAPL",
                side: "long",
                qty: "10",
                avg_entry_price: "150.00",
                current_price: "155.00",
                market_value: "1550.00",
                cost_basis: "1500.00",
                unrealized_pl: "50.00",
                unrealized_plpc: "0.0333",
              },
            ],
          }),
          getPosition: async () => ({ ok: false, error: { code: "not_found", message: "n/a" } }),
          listOrders: async () => ({ ok: true, value: [] }),
        },
      },
    );

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.response.value.positions).toHaveLength(1);
    expect(result.response.value.positions?.[0]?.symbol).toBe("AAPL");
    expect(result.response.value.positions?.[0]?.qty).toBe(10);
  });

  it("mode=position_by_symbol requires symbol and errors clearly without it", async () => {
    const result = await alpacaQuery(
      { mode: "position_by_symbol", data_as_of: new Date().toISOString() },
      {
        auditLog,
        rules,
        verifierContext: { session_id: "test", state: {}, jurisdiction: "US" },
        engine: {
          getAccount: async () => ({ ok: false, error: { code: "not_found", message: "n/a" } }),
          listPositions: async () => ({ ok: true, value: [] }),
          getPosition: async () => ({ ok: false, error: { code: "not_found", message: "n/a" } }),
          listOrders: async () => ({ ok: true, value: [] }),
        },
      },
    );
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.stage).toBe("engine");
  });

  it("mode=orders normalizes order status", async () => {
    const result = await alpacaQuery(
      { mode: "orders", status: "all", data_as_of: new Date().toISOString() },
      {
        auditLog,
        rules,
        verifierContext: { session_id: "test", state: {}, jurisdiction: "US" },
        engine: {
          getAccount: async () => ({ ok: false, error: { code: "not_found", message: "n/a" } }),
          listPositions: async () => ({ ok: true, value: [] }),
          getPosition: async () => ({ ok: false, error: { code: "not_found", message: "n/a" } }),
          listOrders: async () => ({
            ok: true,
            value: [
              {
                id: "order-1",
                symbol: "AAPL",
                side: "buy",
                type: "market",
                qty: "5",
                filled_qty: "5",
                filled_avg_price: "155.00",
                status: "filled",
                submitted_at: "2026-01-01T00:00:00Z",
              },
            ],
          }),
        },
      },
    );
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.response.value.orders).toHaveLength(1);
    expect(result.response.value.orders?.[0]?.status).toBe("filled");
  });

  it("audit log stays hash-chain intact across a full alpacaQuery call", async () => {
    await alpacaQuery(
      { mode: "account", data_as_of: new Date().toISOString() },
      {
        auditLog,
        rules,
        verifierContext: { session_id: "test", state: {}, jurisdiction: "US" },
        engine: {
          getAccount: async () => ({ ok: true, value: { id: "abc123" } }),
          listPositions: async () => ({ ok: true, value: [] }),
          getPosition: async () => ({ ok: false, error: { code: "not_found", message: "n/a" } }),
          listOrders: async () => ({ ok: true, value: [] }),
        },
      },
    );
    const integrity = await AppendOnlyAuditLog.verify(join(dir, "audit.jsonl"));
    expect(integrity.ok).toBe(true);
  });
});
