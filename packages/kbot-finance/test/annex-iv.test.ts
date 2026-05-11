import { describe, expect, it, beforeEach, afterEach } from "vitest";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { AppendOnlyAuditLog } from "../src/audit-log.js";
import { exportAnnexIv } from "../src/exporters/annex-iv.js";

describe("Annex IV exporter", () => {
  let dir: string;
  let auditPath: string;

  beforeEach(async () => {
    dir = await mkdtemp(join(tmpdir(), "annex-iv-test-"));
    auditPath = join(dir, "audit.jsonl");
  });

  afterEach(async () => {
    await rm(dir, { recursive: true, force: true });
  });

  it("emits a markdown bundle with the expected section headers", async () => {
    const log = await AppendOnlyAuditLog.open(auditPath);
    await log.append({
      action: "engine_request",
      subject: "polymarket.list_markets",
      session_id: "s1",
      payload: { request_hash: "abc" },
    });
    await log.append({
      action: "engine_response",
      subject: "polymarket.list_markets",
      session_id: "s1",
      payload: { engine_version: "polymarket-adapter@0.1.0" },
    });

    const bundle = await exportAnnexIv(auditPath, {
      system_name: "Test System",
      deployer: "Test Deployer",
      jurisdiction: "EU",
    });

    expect(bundle.format).toBe("markdown");
    expect(bundle.content).toContain("Test System");
    expect(bundle.content).toContain("Test Deployer");
    expect(bundle.content).toContain("1. General description of the AI system");
    expect(bundle.content).toContain("2. Detailed description of elements");
    expect(bundle.content).toContain("3. Detailed description of monitoring");
    expect(bundle.content).toContain("4. Risk management system");
    expect(bundle.content).toContain("5. Description of any changes");
    expect(bundle.content).toContain("6. List of harmonised standards");
    expect(bundle.content).toContain("7. EU declaration of conformity");
    expect(bundle.content).toContain("8. Records of post-market monitoring");
    expect(bundle.meta.entry_count).toBe(2);
    expect(bundle.meta.audit_log_intact).toBe(true);
  });

  it("reports broken chain when the audit log is tampered", async () => {
    const log = await AppendOnlyAuditLog.open(auditPath);
    await log.append({ action: "engine_request", subject: "x", session_id: "s", payload: {} });
    // Re-write with a corrupted line.
    const { readFile, writeFile } = await import("node:fs/promises");
    const raw = await readFile(auditPath, "utf8");
    const entry = JSON.parse(raw.split("\n")[0]!);
    entry.payload = { tampered: true };
    await writeFile(auditPath, JSON.stringify(entry) + "\n", "utf8");
    const bundle = await exportAnnexIv(auditPath);
    expect(bundle.meta.audit_log_intact).toBe(false);
    expect(bundle.content).toContain("BROKEN");
  });

  it("aggregates verifier rejections by rule + reason code", async () => {
    const log = await AppendOnlyAuditLog.open(auditPath);
    await log.append({
      action: "verifier_check",
      subject: "polymarket.trade",
      session_id: "s",
      payload: {
        ok: false,
        checks: [
          { rule_id: "rule.position_limit", result: { pass: false, reason: { code: "POSITION_SIZE_EXCEEDED" } } },
          { rule_id: "rule.kelly_cap", result: { pass: false, reason: { code: "KELLY_CAP_EXCEEDED" } } },
        ],
      },
    });
    const bundle = await exportAnnexIv(auditPath);
    expect(bundle.content).toContain("rule.position_limit/POSITION_SIZE_EXCEEDED");
    expect(bundle.content).toContain("rule.kelly_cap/KELLY_CAP_EXCEEDED");
  });
});
