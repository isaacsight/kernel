import { describe, expect, it } from "vitest";
import { canonicalize, requestHash, sealEnvelope, sha256 } from "../src/envelope.js";

describe("canonicalize", () => {
  it("sorts object keys lexicographically", () => {
    expect(canonicalize({ b: 1, a: 2 })).toBe('{"a":2,"b":1}');
  });

  it("recurses into nested structures", () => {
    expect(canonicalize({ z: { c: 1, a: 2 }, a: [3, 1, 2] })).toBe(
      '{"a":[3,1,2],"z":{"a":2,"c":1}}',
    );
  });

  it("produces identical output for logically identical inputs in different key order", () => {
    const a = canonicalize({ x: 1, y: { p: 1, q: 2 } });
    const b = canonicalize({ y: { q: 2, p: 1 }, x: 1 });
    expect(a).toBe(b);
  });

  it("refuses non-finite numbers", () => {
    expect(() => canonicalize(NaN as unknown as number)).toThrow(/non-finite/);
    expect(() => canonicalize(Infinity as unknown as number)).toThrow(/non-finite/);
  });

  it("escapes strings as JSON", () => {
    expect(canonicalize('he said "hi"')).toBe('"he said \\"hi\\""');
  });
});

describe("requestHash", () => {
  it("is deterministic for identical envelopes", () => {
    const req = {
      operation: "polymarket.get_market",
      engine_version: "polymarket-adapter@0.1.0",
      schema_hash: sha256("schema-v1"),
      inputs: { market_id: "0xabc" },
      data_as_of: "2026-05-10T00:00:00Z",
    };
    expect(requestHash(req)).toBe(requestHash(req));
  });

  it("changes if any field changes", () => {
    const base = {
      operation: "polymarket.get_market",
      engine_version: "polymarket-adapter@0.1.0",
      schema_hash: sha256("schema-v1"),
      inputs: { market_id: "0xabc" },
      data_as_of: "2026-05-10T00:00:00Z",
    };
    expect(requestHash(base)).not.toBe(requestHash({ ...base, operation: "polymarket.list_markets" }));
    expect(requestHash(base)).not.toBe(requestHash({ ...base, engine_version: "v0.2.0" }));
    expect(requestHash(base)).not.toBe(requestHash({ ...base, inputs: { market_id: "0xdef" } }));
    expect(requestHash(base)).not.toBe(requestHash({ ...base, data_as_of: "2026-05-10T00:00:01Z" }));
  });

  it("is independent of input key order at every depth", () => {
    const a = {
      operation: "x",
      engine_version: "v",
      schema_hash: "h",
      inputs: { z: 1, a: { b: 2, c: 3 } },
      data_as_of: "t",
    };
    const b = {
      operation: "x",
      engine_version: "v",
      schema_hash: "h",
      inputs: { a: { c: 3, b: 2 }, z: 1 },
      data_as_of: "t",
    };
    expect(requestHash(a)).toBe(requestHash(b));
  });
});

describe("sealEnvelope", () => {
  it("returns a response with the matching request_hash", async () => {
    const req = {
      operation: "test.op",
      engine_version: "test@0.0.1",
      schema_hash: sha256("s"),
      inputs: { n: 42 },
      data_as_of: "2026-05-10T00:00:00Z",
    };
    const resp = await sealEnvelope(req, async () => ({ price: 1.5 }));
    expect(resp.request_hash).toBe(requestHash(req));
    expect(resp.engine_version).toBe(req.engine_version);
    expect(resp.value).toEqual({ price: 1.5 });
    expect(resp.byte_identical_replayable).toBe(false);
  });

  it("respects the byte_identical_replayable flag", async () => {
    const req = {
      operation: "test.op",
      engine_version: "test@0.0.1",
      schema_hash: sha256("s"),
      inputs: {},
      data_as_of: "2026-05-10T00:00:00Z",
    };
    const resp = await sealEnvelope(req, async () => 1, { byte_identical_replayable: true });
    expect(resp.byte_identical_replayable).toBe(true);
  });
});
