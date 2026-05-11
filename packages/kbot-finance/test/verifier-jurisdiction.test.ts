import { describe, expect, it } from "vitest";
import {
  makeRts6AlgorithmDeclaredRule,
  makeModelVersionPinnedRule,
  runVerifier,
} from "../src/verifier/index.js";

describe("EU RTS 6 algorithm-declared rule", () => {
  const rule = makeRts6AlgorithmDeclaredRule();

  it("fails when no algorithm id is declared on a trade", () => {
    const r = runVerifier(
      [rule],
      { operation: "polymarket.trade", inputs: { size: 100 }, materiality: "material" },
      { session_id: "s", state: {}, jurisdiction: "EU" },
    );
    expect(r.ok).toBe(false);
    const check = r.checks[0];
    if (check && !check.result.pass) {
      expect(check.result.reason.code).toBe("RTS6_ALGO_ID_MISSING");
    }
  });

  it("fails on malformed algorithm id", () => {
    const r = runVerifier(
      [rule],
      {
        operation: "polymarket.trade",
        inputs: { rts6_algorithm_id: "!" },
        materiality: "material",
      },
      { session_id: "s", state: {}, jurisdiction: "EU" },
    );
    expect(r.ok).toBe(false);
    const check = r.checks[0];
    if (check && !check.result.pass) {
      expect(check.result.reason.code).toBe("RTS6_ALGO_ID_INVALID_SHAPE");
    }
  });

  it("passes on a valid algorithm id", () => {
    const r = runVerifier(
      [rule],
      {
        operation: "polymarket.trade",
        inputs: { rts6_algorithm_id: "ALGO-PM-2026-001" },
        materiality: "material",
      },
      { session_id: "s", state: {}, jurisdiction: "EU" },
    );
    expect(r.ok).toBe(true);
  });

  it("does not apply outside EU", () => {
    const r = runVerifier(
      [rule],
      {
        operation: "polymarket.trade",
        inputs: {},
        materiality: "material",
      },
      { session_id: "s", state: {}, jurisdiction: "US" },
    );
    expect(r.checks.length).toBe(0);
    expect(r.ok).toBe(true);
  });
});

describe("model-version-pinned rule", () => {
  const rule = makeModelVersionPinnedRule();

  it("exempts informational operations", () => {
    const r = runVerifier(
      [rule],
      {
        operation: "polymarket.get_market",
        inputs: {},
        materiality: "informational",
      },
      { session_id: "s", state: {}, jurisdiction: "US" },
    );
    expect(r.ok).toBe(true);
  });

  it("requires model_version on material operations", () => {
    const r = runVerifier(
      [rule],
      {
        operation: "polymarket.trade",
        inputs: { size: 1 },
        materiality: "material",
      },
      { session_id: "s", state: {}, jurisdiction: "US" },
    );
    expect(r.ok).toBe(false);
    const check = r.checks[0];
    if (check && !check.result.pass) {
      expect(check.result.reason.code).toBe("MODEL_VERSION_UNPINNED");
    }
  });

  it("passes when model_version is provided", () => {
    const r = runVerifier(
      [rule],
      {
        operation: "polymarket.trade",
        inputs: { size: 1, model_version: "claude-opus-4-7@2026-05-10" },
        materiality: "material",
      },
      { session_id: "s", state: {}, jurisdiction: "US" },
    );
    expect(r.ok).toBe(true);
  });
});
