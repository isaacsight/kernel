import { createHash, randomBytes } from "node:crypto";

/**
 * Content-addressed envelope for engine calls.
 *
 * The single load-bearing primitive of the audit substrate. Every engine
 * request resolves to a deterministic SHA-256 hash over canonicalized inputs;
 * identical hash → identical result, byte-for-byte. The AI layer cannot
 * produce a number — it can only request one inside an envelope, and the
 * envelope is the only thing regulators replay.
 *
 * This is the gap in current MCP. We ship it as a wrapper now and propose
 * the spec extension separately.
 */

export interface ContentAddressedRequest {
  /** Logical operation, e.g. "polymarket.get_market", "alts.nav_compute". */
  readonly operation: string;
  /** Pinned engine version, e.g. "polymarket-adapter@0.1.0". */
  readonly engine_version: string;
  /** SHA-256 of the JSON schema used to validate `inputs`. */
  readonly schema_hash: string;
  /** Operation inputs. Will be canonicalized before hashing. */
  readonly inputs: JsonValue;
  /** As-of timestamp (ISO 8601, UTC) for the market data snapshot. */
  readonly data_as_of: string;
  /** Optional deterministic seed for any Monte Carlo paths. */
  readonly deterministic_seed?: string;
}

export interface ContentAddressedResponse<T = JsonValue> {
  /** SHA-256 hash of the canonical request — the replay key. */
  readonly request_hash: string;
  /** Engine version that produced this response. Must match the request. */
  readonly engine_version: string;
  /** ISO 8601 timestamp when the engine produced this result. */
  readonly produced_at: string;
  /** Hardware-determinism honesty flag. False if running on non-deterministic GPU/etc. */
  readonly byte_identical_replayable: boolean;
  /** The actual numerical/structured payload. */
  readonly value: T;
}

export type JsonValue =
  | string
  | number
  | boolean
  | null
  | JsonValue[]
  | { readonly [key: string]: JsonValue };

/**
 * Canonical JSON serialization (RFC 8785 JCS, simplified).
 *
 * Sorts object keys lexicographically. Numbers are emitted in the shortest
 * round-trip form. Strings are JSON-escaped. This is the foundation of
 * deterministic content hashing — two callers producing the same logical
 * request must produce byte-identical canonical bytes.
 */
export function canonicalize(value: JsonValue): string {
  if (value === null) return "null";
  if (typeof value === "boolean") return value ? "true" : "false";
  if (typeof value === "number") {
    if (!Number.isFinite(value)) {
      throw new Error(`canonicalize: non-finite number is not representable: ${value}`);
    }
    return JSON.stringify(value);
  }
  if (typeof value === "string") return JSON.stringify(value);
  if (Array.isArray(value)) {
    return "[" + value.map(canonicalize).join(",") + "]";
  }
  const keys = Object.keys(value).sort();
  const parts = keys.map((k) => {
    const v = value[k];
    if (v === undefined) {
      throw new Error(`canonicalize: undefined values not permitted (key: ${k})`);
    }
    return JSON.stringify(k) + ":" + canonicalize(v);
  });
  return "{" + parts.join(",") + "}";
}

/** SHA-256 of a string, hex-encoded. */
export function sha256(input: string): string {
  return createHash("sha256").update(input, "utf8").digest("hex");
}

/** Compute the content-addressed hash of a request. */
export function requestHash(request: ContentAddressedRequest): string {
  // The hash is over the canonicalized request envelope. We exclude any
  // future fields by being explicit about what enters the hash.
  const hashable: JsonValue = {
    operation: request.operation,
    engine_version: request.engine_version,
    schema_hash: request.schema_hash,
    inputs: request.inputs,
    data_as_of: request.data_as_of,
    ...(request.deterministic_seed !== undefined
      ? { deterministic_seed: request.deterministic_seed }
      : {}),
  };
  return sha256(canonicalize(hashable));
}

/**
 * Wrap an engine call: compute the hash, invoke the engine, return the
 * envelope. The engine function must be deterministic given the same
 * canonicalized inputs — if it isn't, the replay primitive is a lie.
 */
export async function sealEnvelope<T>(
  request: ContentAddressedRequest,
  engine: (req: ContentAddressedRequest) => Promise<T>,
  options: { byte_identical_replayable: boolean } = { byte_identical_replayable: false },
): Promise<ContentAddressedResponse<T>> {
  const value = await engine(request);
  return {
    request_hash: requestHash(request),
    engine_version: request.engine_version,
    produced_at: new Date().toISOString(),
    byte_identical_replayable: options.byte_identical_replayable,
    value: value as JsonValue as T,
  };
}

/**
 * Generate a deterministic seed from a string source. Useful when the AI
 * layer needs to commit to a seed before the engine call — the seed itself
 * is content-addressed so the agent can't retroactively pick a favourable one.
 */
export function deriveSeed(source: string): string {
  return sha256(`seed:${source}`).slice(0, 32);
}

/** Generate a fresh random seed for cases where determinism is not yet required. */
export function freshSeed(): string {
  return randomBytes(16).toString("hex");
}
