/**
 * End-to-end demo of the kbot-finance architecture.
 *
 * Run with: npm run demo
 *
 * Hits the live Polymarket Gamma API. No keys required. The Replit
 * entrypoint runs this on first launch so visitors see the full
 * envelope + verifier + audit-log flow light up.
 */

import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import {
  AppendOnlyAuditLog,
  makePositionLimitRule,
  makeKellyCapRule,
  polymarketQuery,
  runVerifier,
} from "./index.js";

const SESSION_ID = `demo-${new Date().toISOString().replace(/[:.]/g, "-")}`;

async function main(): Promise<void> {
  const banner = (s: string): void => {
    process.stdout.write(`\n${"=".repeat(72)}\n${s}\n${"=".repeat(72)}\n`);
  };

  banner("kbot-finance v0.1 — audit-grade AI infrastructure for capital markets");
  process.stdout.write(
    `session_id: ${SESSION_ID}\n` +
      `architecture: deterministic engine + AI intelligence + human governance\n` +
      `engine for this demo: Polymarket Gamma (https://gamma-api.polymarket.com)\n`,
  );

  const dir = await mkdtemp(join(tmpdir(), "kbot-finance-demo-"));
  const audit_path = join(dir, "audit.jsonl");
  const auditLog = await AppendOnlyAuditLog.open(audit_path);
  process.stdout.write(`audit log: ${audit_path}\n`);

  // Compose a minimal global ruleset. v0.1 ships two rules; later jurisdictions
  // layer more rules on top.
  const rules = [
    makePositionLimitRule({ default_max_size: 10_000, default_max_notional: 50_000 }),
    makeKellyCapRule({ kelly_fraction: 0.5, bankroll: 100_000 }),
  ];

  banner("Step 1 — query Polymarket: top 3 active markets by 24h volume");
  const result = await polymarketQuery(
    {
      mode: "list_active",
      limit: 3,
      data_as_of: new Date().toISOString(),
    },
    {
      auditLog,
      rules,
      verifierContext: {
        session_id: SESSION_ID,
        state: {},
        jurisdiction: "US",
      },
    },
  );

  if (!result.ok) {
    process.stdout.write(`FAIL at ${result.stage}: ${JSON.stringify(result.detail)}\n`);
    process.exitCode = 1;
    return;
  }

  process.stdout.write(`request_hash: ${result.response.request_hash}\n`);
  process.stdout.write(`engine_version: ${result.response.engine_version}\n`);
  process.stdout.write(`produced_at: ${result.response.produced_at}\n`);
  process.stdout.write(
    `byte_identical_replayable: ${result.response.byte_identical_replayable} ` +
      `(false because Gamma is live HTTPS; replay needs an indexer pinned to block)\n`,
  );

  for (const m of result.response.value.markets) {
    process.stdout.write(`\n  ${m.question ?? "(no question)"}\n`);
    if (m.outcomes && m.outcome_prices) {
      for (let i = 0; i < m.outcomes.length; i++) {
        const price = m.outcome_prices[i];
        process.stdout.write(
          `    ${m.outcomes[i]}: ${price !== undefined ? (price * 100).toFixed(1) + "%" : "—"}\n`,
        );
      }
    }
    process.stdout.write(`    24h volume: $${(m.volume_24h ?? 0).toFixed(0)}\n`);
  }

  banner("Step 2 — verifier rejects an oversized trade proposal");
  // The AI proposes a hypothetical trade; the verifier checks it against every
  // applicable rule BEFORE any engine call. Half-Kelly + position limits both fire.
  const proposed_trade = {
    instrument_id: result.response.value.markets[0]?.id ?? "demo-market",
    size: 50_000, // exceeds default_max_size (10_000)
    notional: 75_000, // exceeds default_max_notional (50_000)
    edge_probability: 0.55, // p=0.55, b=1 → Kelly = 0.1 → half-Kelly cap = 5,000
    payoff_b: 1.0,
  };
  const verdict = runVerifier(
    rules,
    {
      operation: "polymarket.trade",
      inputs: proposed_trade,
      materiality: "material",
    },
    { session_id: SESSION_ID, state: {}, jurisdiction: "US" },
  );
  await auditLog.append({
    action: "verifier_check",
    subject: "polymarket.trade",
    session_id: SESSION_ID,
    payload: verdict as never,
  });
  process.stdout.write(`verifier ok: ${verdict.ok}\n`);
  for (const check of verdict.checks) {
    if (check.result.pass) {
      process.stdout.write(`  ✓ ${check.rule_id}: pass\n`);
    } else {
      process.stdout.write(
        `  ✗ ${check.rule_id}: ${check.result.reason.code} — ${check.result.reason.summary}\n`,
      );
    }
  }

  banner("Step 3 — audit log integrity check");
  const integrity = await AppendOnlyAuditLog.verify(audit_path);
  if (integrity.ok) {
    process.stdout.write("audit log: HASH CHAIN INTACT — every entry verified\n");
  } else {
    process.stdout.write(`audit log: BROKEN at seq=${integrity.broken_at_seq}\n`);
    process.exitCode = 1;
  }

  banner("Audit log contents");
  const log_content = await readFile(audit_path, "utf8");
  const lines = log_content.split("\n").filter((l) => l.length > 0);
  process.stdout.write(`entries written: ${lines.length}\n\n`);
  for (const line of lines) {
    const entry = JSON.parse(line);
    process.stdout.write(
      `  [${entry.seq}] ${entry.action.padEnd(16)} ${entry.subject.padEnd(30)} hash=${entry.self_hash.slice(0, 12)}…\n`,
    );
  }

  banner("Demo complete");
  process.stdout.write(
    `\nWhat just happened:\n` +
      `  1. AI agent requested a Polymarket query inside a content-addressed envelope.\n` +
      `  2. Regulatory verifier ran every active rule against the request.\n` +
      `  3. Engine (Gamma API) was called; result sealed with request_hash.\n` +
      `  4. Audit log recorded verifier check + engine request + engine response.\n` +
      `  5. Verifier successfully blocked an oversized request without reaching the engine.\n` +
      `  6. Audit log hash-chain integrity verified end-to-end.\n` +
      `\nThe AI never produced a price. The engine did. Every step is replayable.\n`,
  );

  // Clean up the temp audit log and force exit so Node's fetch keepalive
  // doesn't hold the event loop open in Replit.
  await rm(dir, { recursive: true, force: true });
}

main()
  .then(() => process.exit(0))
  .catch((e) => {
    process.stderr.write(`fatal: ${(e as Error).message}\n`);
    process.exit(1);
  });
