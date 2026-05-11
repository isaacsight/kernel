import { describe, expect, it } from "vitest";
import {
  makePositionLimitRule,
  makeKellyCapRule,
  runVerifier,
} from "../src/verifier/index.js";

const baseContext = {
  session_id: "s1",
  state: {},
  jurisdiction: "US" as const,
};

describe("position-limit rule", () => {
  const rule = makePositionLimitRule({ default_max_size: 100, default_max_notional: 1000 });

  it("passes when within limits", () => {
    const r = runVerifier(
      [rule],
      {
        operation: "polymarket.trade",
        inputs: { size: 50, notional: 500 },
        materiality: "material",
      },
      baseContext,
    );
    expect(r.ok).toBe(true);
  });

  it("fails on size overflow with adverse-action code", () => {
    const r = runVerifier(
      [rule],
      {
        operation: "polymarket.trade",
        inputs: { size: 999, notional: 500 },
        materiality: "material",
      },
      baseContext,
    );
    expect(r.ok).toBe(false);
    const check = r.checks[0];
    expect(check).toBeDefined();
    if (!check) return;
    expect(check.result.pass).toBe(false);
    if (!check.result.pass) {
      expect(check.result.reason.code).toBe("POSITION_SIZE_EXCEEDED");
    }
  });

  it("does not apply to non-matching operations", () => {
    const r = runVerifier(
      [rule],
      {
        operation: "polymarket.get_market",
        inputs: { size: 999_999 },
        materiality: "informational",
      },
      baseContext,
    );
    expect(r.ok).toBe(true);
    expect(r.checks.length).toBe(0);
  });
});

describe("kelly-cap rule", () => {
  const rule = makeKellyCapRule({ kelly_fraction: 0.5, bankroll: 10_000 });

  it("requires edge_probability and payoff_b for trade-shaped operations", () => {
    const r = runVerifier(
      [rule],
      {
        operation: "polymarket.trade",
        inputs: { notional: 100 },
        materiality: "material",
      },
      baseContext,
    );
    expect(r.ok).toBe(false);
    const check = r.checks[0];
    if (check && !check.result.pass) {
      expect(check.result.reason.code).toBe("KELLY_INPUTS_MISSING");
    }
  });

  it("rejects negative-edge bets", () => {
    const r = runVerifier(
      [rule],
      {
        operation: "polymarket.trade",
        inputs: { edge_probability: 0.3, payoff_b: 1, notional: 100 },
        materiality: "material",
      },
      baseContext,
    );
    expect(r.ok).toBe(false);
    const check = r.checks[0];
    if (check && !check.result.pass) {
      expect(check.result.reason.code).toBe("KELLY_NEGATIVE_EDGE");
    }
  });

  it("passes when notional is within half-Kelly of edge", () => {
    // p=0.6, b=1 -> Kelly = 0.2; half-Kelly = 0.1; bankroll 10_000 -> 1000 cap.
    const r = runVerifier(
      [rule],
      {
        operation: "polymarket.trade",
        inputs: { edge_probability: 0.6, payoff_b: 1, notional: 500 },
        materiality: "material",
      },
      baseContext,
    );
    expect(r.ok).toBe(true);
  });

  it("rejects above-Kelly notional", () => {
    const r = runVerifier(
      [rule],
      {
        operation: "polymarket.trade",
        inputs: { edge_probability: 0.6, payoff_b: 1, notional: 5000 },
        materiality: "material",
      },
      baseContext,
    );
    expect(r.ok).toBe(false);
    const check = r.checks[0];
    if (check && !check.result.pass) {
      expect(check.result.reason.code).toBe("KELLY_CAP_EXCEEDED");
    }
  });
});

describe("jurisdiction filtering", () => {
  const rule = makePositionLimitRule({ default_max_size: 1, default_max_notional: 1 });
  const us_only = { ...rule, jurisdictions: ["US"] as const };

  it("does not apply rule outside its jurisdiction", () => {
    const r = runVerifier(
      [us_only],
      { operation: "polymarket.trade", inputs: { size: 9999 }, materiality: "material" },
      { ...baseContext, jurisdiction: "EU" },
    );
    expect(r.checks.length).toBe(0);
    expect(r.ok).toBe(true);
  });

  it("applies GLOBAL rules in every jurisdiction", () => {
    const r = runVerifier(
      [rule],
      { operation: "polymarket.trade", inputs: { size: 9999 }, materiality: "material" },
      { ...baseContext, jurisdiction: "SG" },
    );
    expect(r.ok).toBe(false);
  });
});
