import { describe, expect, it } from "vitest";
import { Approver, verifyApproval } from "../src/governance.js";

describe("governance approval tokens", () => {
  const compliance = new Approver("compliance@firm", Buffer.from("compliance-secret-32-bytes-xxxxx"));
  const trust = new Map([
    ["compliance@firm", Buffer.from("compliance-secret-32-bytes-xxxxx")],
  ]);

  const request = {
    request_hash: "abc123",
    summary: "Execute 100 contracts on market XYZ",
    session_id: "s1",
    materiality: "trade.execute",
  };

  it("issues a token that verifies", () => {
    const token = compliance.approve(request);
    const r = verifyApproval(token, trust, request);
    expect(r.ok).toBe(true);
  });

  it("rejects tokens bound to a different request_hash", () => {
    const token = compliance.approve(request);
    const r = verifyApproval(token, trust, { ...request, request_hash: "def456" });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reason).toBe("request_hash_mismatch");
  });

  it("rejects tokens from unknown approvers", () => {
    const token = compliance.approve(request);
    const r = verifyApproval(token, new Map(), request);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reason).toBe("unknown_approver");
  });

  it("rejects tokens with a forged signature", () => {
    const token = { ...compliance.approve(request), signature: "0".repeat(64) };
    const r = verifyApproval(token, trust, request);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reason).toBe("bad_signature");
  });

  it("rejects tokens where the approver's secret is rotated", () => {
    const token = compliance.approve(request);
    const newTrust = new Map([
      ["compliance@firm", Buffer.from("rotated-secret-different-bytes-x")],
    ]);
    const r = verifyApproval(token, newTrust, request);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reason).toBe("bad_signature");
  });
});
