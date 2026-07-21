import { describe, expect, it, beforeEach, afterEach } from "vitest";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { kbotFinanceTools } from "../src/kbot-tool.js";

describe("kbot-finance tool registry surface", () => {
  let dir: string;

  beforeEach(async () => {
    dir = await mkdtemp(join(tmpdir(), "kbot-tool-test-"));
    process.env["KBOT_FINANCE_AUDIT_LOG"] = join(dir, "audit.jsonl");
  });

  afterEach(async () => {
    delete process.env["KBOT_FINANCE_AUDIT_LOG"];
    await rm(dir, { recursive: true, force: true });
  });

  it("exports the v0.2 tool set", () => {
    const names = kbotFinanceTools.map((t) => t.name).sort();
    expect(names).toEqual([
      "alpaca_query",
      "annex_iv_export",
      "audit_log_verify",
      "edgar_query",
      "polymarket_query",
    ]);
  });

  it("every tool returns a string from execute (never throws)", async () => {
    for (const tool of kbotFinanceTools) {
      const r = await tool.execute({ mode: "unrecognized" });
      expect(typeof r).toBe("string");
    }
  });

  it("polymarket_query rejects invalid mode with a clear Error message", async () => {
    const tool = kbotFinanceTools.find((t) => t.name === "polymarket_query");
    expect(tool).toBeDefined();
    if (!tool) return;
    const r = await tool.execute({ mode: "nonsense" });
    expect(r.startsWith("Error:")).toBe(true);
    expect(r).toContain("mode must be");
  });

  it("polymarket_query requires market_id when mode=by_id", async () => {
    const tool = kbotFinanceTools.find((t) => t.name === "polymarket_query");
    if (!tool) return;
    const r = await tool.execute({ mode: "by_id" });
    expect(r.startsWith("Error:")).toBe(true);
    expect(r).toContain("market_id is required");
  });

  it("alpaca_query rejects invalid mode with a clear Error message", async () => {
    const tool = kbotFinanceTools.find((t) => t.name === "alpaca_query");
    expect(tool).toBeDefined();
    if (!tool) return;
    const r = await tool.execute({ mode: "nonsense" });
    expect(r.startsWith("Error:")).toBe(true);
    expect(r).toContain("mode must be");
  });

  it("alpaca_query requires symbol when mode=position_by_symbol", async () => {
    const tool = kbotFinanceTools.find((t) => t.name === "alpaca_query");
    if (!tool) return;
    const r = await tool.execute({ mode: "position_by_symbol" });
    expect(r.startsWith("Error:")).toBe(true);
    expect(r).toContain("symbol is required");
  });

  it("audit_log_verify reports ok on a fresh log path", async () => {
    const tool = kbotFinanceTools.find((t) => t.name === "audit_log_verify");
    if (!tool) return;
    const r = await tool.execute({ path: join(dir, "fresh.jsonl") });
    const parsed = JSON.parse(r);
    expect(parsed.ok).toBe(true);
  });
});
