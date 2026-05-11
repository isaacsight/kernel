import { appendFile, readFile } from "node:fs/promises";
import { canonicalize, sha256, type JsonValue } from "./envelope.js";

/**
 * Hash-chained append-only audit log.
 *
 * Every entry includes its predecessor's hash. Tampering with any entry
 * invalidates every subsequent entry. This is the legal-defensibility
 * primitive — auditors verify the chain, not individual entries.
 *
 * Storage is JSONL for v0.1 (one entry per line). Production deployment
 * substitutes WORM-compatible storage (S3 Object Lock, immudb, Aeron log).
 * The API stays the same.
 */

export type AuditAction =
  | "engine_request"
  | "engine_response"
  | "verifier_check"
  | "approval_granted"
  | "approval_denied"
  | "incident"
  | "replay_request"
  | "replay_verified"
  | "replay_mismatch";

export interface AuditEntryInput {
  readonly action: AuditAction;
  /** Operation or rule name, e.g. "polymarket.get_market" or "rule.position_limit". */
  readonly subject: string;
  /** Session ID for grouping a single conversation/agent run. */
  readonly session_id: string;
  /** Model + prompt versions touched. Empty for non-AI actions. */
  readonly model_lineage?: ReadonlyArray<{ model: string; version: string }>;
  /** Identity of the human approver, if applicable. */
  readonly approver?: string;
  /** Free-form structured payload — must be canonicalize-able JSON. */
  readonly payload: JsonValue;
}

export interface AuditEntry extends AuditEntryInput {
  /** Sequence number within this log. Strictly monotonic. */
  readonly seq: number;
  /** ISO 8601 UTC timestamp. */
  readonly timestamp: string;
  /** Hash of the previous entry. "0".repeat(64) for the first entry. */
  readonly prev_hash: string;
  /** Hash of this entry (excluding self_hash). */
  readonly self_hash: string;
}

export const GENESIS_HASH = "0".repeat(64);

/** Compute the hash of an entry excluding self_hash. */
function entryHash(entry: Omit<AuditEntry, "self_hash">): string {
  return sha256(canonicalize(entry as unknown as JsonValue));
}

/**
 * AppendOnlyAuditLog — file-backed JSONL store with hash chain.
 *
 * Construction reads the existing tail to pick up the prev_hash and seq.
 * `append()` is serialized within a single instance; multi-process writers
 * need an external lock (out of scope for v0.1).
 */
export class AppendOnlyAuditLog {
  private last_hash: string = GENESIS_HASH;
  private next_seq: number = 0;
  private write_lock: Promise<void> = Promise.resolve();

  private constructor(private readonly path: string) {}

  static async open(path: string): Promise<AppendOnlyAuditLog> {
    const log = new AppendOnlyAuditLog(path);
    await log.resume();
    return log;
  }

  private async resume(): Promise<void> {
    try {
      const raw = await readFile(this.path, "utf8");
      const lines = raw.split("\n").filter((l) => l.length > 0);
      if (lines.length === 0) return;
      const tail = lines[lines.length - 1];
      if (tail === undefined) return;
      const parsed = JSON.parse(tail) as AuditEntry;
      this.last_hash = parsed.self_hash;
      this.next_seq = parsed.seq + 1;
    } catch (err) {
      if ((err as NodeJS.ErrnoException).code !== "ENOENT") throw err;
      // File doesn't exist yet — start fresh from genesis.
    }
  }

  async append(input: AuditEntryInput): Promise<AuditEntry> {
    // Serialize writes through a promise chain so concurrent callers see
    // a coherent hash chain.
    let release: () => void = () => {};
    const next = new Promise<void>((resolve) => {
      release = resolve;
    });
    const prev_lock = this.write_lock;
    this.write_lock = next;
    await prev_lock;

    try {
      const skeleton: Omit<AuditEntry, "self_hash"> = {
        ...input,
        seq: this.next_seq,
        timestamp: new Date().toISOString(),
        prev_hash: this.last_hash,
      };
      const self_hash = entryHash(skeleton);
      const entry: AuditEntry = { ...skeleton, self_hash };
      await appendFile(this.path, JSON.stringify(entry) + "\n", "utf8");
      this.last_hash = self_hash;
      this.next_seq += 1;
      return entry;
    } finally {
      release();
    }
  }

  /** Verify the integrity of the entire log on disk. Returns the failure index, or null if intact. */
  static async verify(path: string): Promise<{ ok: true } | { ok: false; broken_at_seq: number }> {
    const raw = await readFile(path, "utf8").catch(() => "");
    const lines = raw.split("\n").filter((l) => l.length > 0);
    let expected_prev = GENESIS_HASH;
    let expected_seq = 0;
    for (const line of lines) {
      const entry = JSON.parse(line) as AuditEntry;
      if (entry.seq !== expected_seq) return { ok: false, broken_at_seq: expected_seq };
      if (entry.prev_hash !== expected_prev) return { ok: false, broken_at_seq: entry.seq };
      const { self_hash, ...skeleton } = entry;
      if (entryHash(skeleton) !== self_hash) return { ok: false, broken_at_seq: entry.seq };
      expected_prev = self_hash;
      expected_seq += 1;
    }
    return { ok: true };
  }
}
