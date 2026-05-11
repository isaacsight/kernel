import { describe, expect, it, beforeEach, afterEach } from "vitest";
import { mkdtemp, rm, readFile, appendFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { AppendOnlyAuditLog, GENESIS_HASH } from "../src/audit-log.js";

describe("AppendOnlyAuditLog", () => {
  let dir: string;
  let path: string;

  beforeEach(async () => {
    dir = await mkdtemp(join(tmpdir(), "audit-log-test-"));
    path = join(dir, "audit.jsonl");
  });

  afterEach(async () => {
    await rm(dir, { recursive: true, force: true });
  });

  it("links the first entry to the genesis hash", async () => {
    const log = await AppendOnlyAuditLog.open(path);
    const entry = await log.append({
      action: "engine_request",
      subject: "test.op",
      session_id: "s1",
      payload: { x: 1 },
    });
    expect(entry.seq).toBe(0);
    expect(entry.prev_hash).toBe(GENESIS_HASH);
    expect(entry.self_hash).toHaveLength(64);
  });

  it("hash-chains successive entries", async () => {
    const log = await AppendOnlyAuditLog.open(path);
    const a = await log.append({
      action: "engine_request",
      subject: "op1",
      session_id: "s1",
      payload: { i: 0 },
    });
    const b = await log.append({
      action: "engine_response",
      subject: "op1",
      session_id: "s1",
      payload: { i: 1 },
    });
    expect(b.prev_hash).toBe(a.self_hash);
    expect(b.seq).toBe(1);
  });

  it("resumes the chain across reopens", async () => {
    const log1 = await AppendOnlyAuditLog.open(path);
    const a = await log1.append({
      action: "engine_request",
      subject: "op",
      session_id: "s",
      payload: {},
    });
    const log2 = await AppendOnlyAuditLog.open(path);
    const b = await log2.append({
      action: "engine_response",
      subject: "op",
      session_id: "s",
      payload: {},
    });
    expect(b.prev_hash).toBe(a.self_hash);
    expect(b.seq).toBe(1);
  });

  it("verify() returns ok on intact log", async () => {
    const log = await AppendOnlyAuditLog.open(path);
    for (let i = 0; i < 5; i++) {
      await log.append({
        action: "verifier_check",
        subject: "op",
        session_id: "s",
        payload: { i },
      });
    }
    const result = await AppendOnlyAuditLog.verify(path);
    expect(result.ok).toBe(true);
  });

  it("verify() detects tampering of a middle entry", async () => {
    const log = await AppendOnlyAuditLog.open(path);
    for (let i = 0; i < 3; i++) {
      await log.append({
        action: "engine_request",
        subject: "op",
        session_id: "s",
        payload: { i },
      });
    }
    // Tamper: rewrite the file with a modified middle entry.
    const raw = await readFile(path, "utf8");
    const lines = raw.split("\n").filter((l) => l.length > 0);
    const middle = JSON.parse(lines[1]!);
    middle.payload = { i: 999 };
    lines[1] = JSON.stringify(middle);
    await rm(path);
    for (const line of lines) {
      await appendFile(path, line + "\n", "utf8");
    }
    const result = await AppendOnlyAuditLog.verify(path);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.broken_at_seq).toBe(1);
    }
  });

  it("serializes concurrent appends through the lock", async () => {
    const log = await AppendOnlyAuditLog.open(path);
    const writes = await Promise.all(
      Array.from({ length: 20 }, (_, i) =>
        log.append({
          action: "engine_request",
          subject: `op-${i}`,
          session_id: "s",
          payload: { i },
        }),
      ),
    );
    // Sequence numbers must be strictly monotonic and dense.
    const seqs = writes.map((w) => w.seq).sort((a, b) => a - b);
    expect(seqs).toEqual(Array.from({ length: 20 }, (_, i) => i));
    const integrity = await AppendOnlyAuditLog.verify(path);
    expect(integrity.ok).toBe(true);
  });
});
