/**
 * kbot tool registry surface for kbot-finance.
 *
 * Exports kbot-shaped `ToolDefinition`s so kbot can register them alongside
 * its existing 100+ skills. Mirrors the shape kbot's own tools use
 * (peekaboo.ts, ableton.ts, etc.): name, description, typed parameters,
 * tier, and an async `execute()` that returns a string and never throws.
 *
 * To wire into kbot:
 *
 *   import { kbotFinanceTools } from '@kernel.chat/kbot-finance/kbot-tool'
 *   for (const t of kbotFinanceTools) registerTool(t)
 *
 * Or copy this file into kbot/src/tools/polymarket.ts directly if you
 * prefer not to add a workspace dependency for v0.1.
 */

import { homedir } from "node:os";
import { join } from "node:path";
import { mkdir } from "node:fs/promises";

import { AppendOnlyAuditLog } from "./audit-log.js";
import {
  makePositionLimitRule,
  makeKellyCapRule,
  makeRts6AlgorithmDeclaredRule,
  makeModelVersionPinnedRule,
} from "./verifier/index.js";
import { polymarketQuery } from "./tools/polymarket-query.js";
import { edgarQuery } from "./tools/edgar-query.js";
import { exportAnnexIv } from "./exporters/annex-iv.js";
import { writeFile } from "node:fs/promises";

// Mirror of kbot's ToolDefinition shape (kbot/src/tools/index.ts).
// Inlined here so kbot-finance doesn't take a runtime dependency on kbot.
export interface KbotToolDefinition {
  name: string;
  description: string;
  parameters: Record<
    string,
    {
      type: string;
      description: string;
      required?: boolean;
      default?: unknown;
    }
  >;
  tier: "free" | "pro" | "growth" | "enterprise";
  execute: (args: Record<string, unknown>) => Promise<string>;
}

// Default audit log location — one file per kbot install. Production
// deployments override via env: KBOT_FINANCE_AUDIT_LOG=<path>.
const DEFAULT_AUDIT_DIR = join(homedir(), ".kbot", "audit");
const DEFAULT_AUDIT_PATH =
  process.env["KBOT_FINANCE_AUDIT_LOG"] ?? join(DEFAULT_AUDIT_DIR, "polymarket.jsonl");

// Lazy audit-log singleton. The kbot CLI invokes tools as one-shot calls,
// so we cache the open log to keep the hash chain coherent across calls
// in the same process.
let auditLogPromise: Promise<AppendOnlyAuditLog> | null = null;
function getAuditLog(): Promise<AppendOnlyAuditLog> {
  if (auditLogPromise === null) {
    auditLogPromise = (async () => {
      await mkdir(DEFAULT_AUDIT_DIR, { recursive: true });
      return AppendOnlyAuditLog.open(DEFAULT_AUDIT_PATH);
    })();
  }
  return auditLogPromise;
}

// Default rules. Operators can override at deploy time via env knobs.
const POSITION_MAX_SIZE = Number(process.env["KBOT_FINANCE_MAX_SIZE"] ?? 10_000);
const POSITION_MAX_NOTIONAL = Number(process.env["KBOT_FINANCE_MAX_NOTIONAL"] ?? 50_000);
const KELLY_FRACTION = Number(process.env["KBOT_FINANCE_KELLY_FRACTION"] ?? 0.5);
const KELLY_BANKROLL = Number(process.env["KBOT_FINANCE_BANKROLL"] ?? 100_000);

function defaultRules() {
  return [
    makePositionLimitRule({
      default_max_size: POSITION_MAX_SIZE,
      default_max_notional: POSITION_MAX_NOTIONAL,
    }),
    makeKellyCapRule({ kelly_fraction: KELLY_FRACTION, bankroll: KELLY_BANKROLL }),
    makeRts6AlgorithmDeclaredRule(),
    makeModelVersionPinnedRule(),
  ];
}

function nowISO(): string {
  return new Date().toISOString();
}

function sessionId(): string {
  // kbot doesn't expose a session id at tool-call time; derive a stable
  // one from process pid + start time so all calls within one kbot run
  // share a hash-chain root in the audit log.
  return `kbot-${process.pid}-${Math.floor((process.uptime ?? (() => 0))())}`;
}

/**
 * polymarket_query — read-only access to Polymarket markets via Gamma API,
 * wrapped in the kbot-finance audit substrate.
 *
 * Every call:
 *   1. Builds a content-addressed envelope (replay key = request_hash).
 *   2. Runs the regulatory verifier (Kelly + position-limit rules).
 *   3. Logs verifier check + engine request + engine response in the
 *      hash-chained audit log at ~/.kbot/audit/polymarket.jsonl.
 *   4. Returns normalized market data — NOT a price the AI itself computed.
 *
 * The AI never produces a market price. Gamma does. Replay against an
 * indexer pinned to a block height is the v0.2 feature.
 */
const polymarketQueryTool: KbotToolDefinition = {
  name: "polymarket_query",
  description:
    "Query Polymarket prediction-market data via Gamma API, with content-addressed envelopes and a hash-chained audit log. mode=list_active for top-volume markets, mode=by_id for a specific market. AI never produces the price — Gamma does. Audit log at ~/.kbot/audit/polymarket.jsonl.",
  parameters: {
    mode: {
      type: "string",
      description: "'list_active' for top markets by 24h volume, 'by_id' for a specific market.",
      required: true,
    },
    market_id: {
      type: "string",
      description: "Market id (required when mode='by_id').",
    },
    limit: {
      type: "number",
      description: "Max markets to return when mode='list_active'. Default 5.",
      default: 5,
    },
    jurisdiction: {
      type: "string",
      description: "Verifier jurisdiction tag (US/EU/UK/SG/HK/UAE/GLOBAL). Default US.",
      default: "US",
    },
  },
  tier: "free",
  async execute(args) {
    try {
      const mode = args["mode"];
      if (mode !== "list_active" && mode !== "by_id") {
        return `Error: mode must be 'list_active' or 'by_id' (got: ${String(mode)})`;
      }
      const market_id = typeof args["market_id"] === "string" ? args["market_id"] : undefined;
      if (mode === "by_id" && !market_id) {
        return "Error: market_id is required when mode='by_id'";
      }
      const limit = typeof args["limit"] === "number" ? args["limit"] : 5;
      const jurisdiction =
        typeof args["jurisdiction"] === "string"
          ? (args["jurisdiction"] as "US" | "EU" | "UK" | "SG" | "HK" | "UAE" | "GLOBAL")
          : "US";

      const auditLog = await getAuditLog();
      const result = await polymarketQuery(
        {
          mode,
          ...(market_id ? { market_id } : {}),
          limit,
          data_as_of: nowISO(),
        },
        {
          auditLog,
          rules: defaultRules(),
          verifierContext: { session_id: sessionId(), state: {}, jurisdiction },
        },
      );

      if (!result.ok) {
        return `Error (${result.stage}): ${JSON.stringify(result.detail, null, 2)}`;
      }

      // Return a compact summary plus the request_hash so the caller can
      // request a replay later. Full markets are nested under `value`.
      const summary = {
        request_hash: result.response.request_hash,
        engine_version: result.response.engine_version,
        produced_at: result.response.produced_at,
        byte_identical_replayable: result.response.byte_identical_replayable,
        market_count: result.response.value.markets.length,
        markets: result.response.value.markets,
      };
      return JSON.stringify(summary, null, 2);
    } catch (e) {
      return `Error: ${(e as Error).message}`;
    }
  },
};

/**
 * audit_log_verify — verify the integrity of the kbot-finance audit log
 * on disk. Returns "ok" or "broken at seq=N". Useful before exporting
 * the log as regulator evidence.
 */
const auditLogVerifyTool: KbotToolDefinition = {
  name: "audit_log_verify",
  description:
    "Verify the hash-chain integrity of the kbot-finance audit log at ~/.kbot/audit/polymarket.jsonl. Returns ok or the broken sequence number.",
  parameters: {
    path: {
      type: "string",
      description: `Audit log path. Defaults to ${DEFAULT_AUDIT_PATH}.`,
    },
  },
  tier: "free",
  async execute(args) {
    try {
      const path = typeof args["path"] === "string" ? args["path"] : DEFAULT_AUDIT_PATH;
      const result = await AppendOnlyAuditLog.verify(path);
      if (result.ok) {
        return JSON.stringify({ ok: true, path }, null, 2);
      }
      return JSON.stringify({ ok: false, path, broken_at_seq: result.broken_at_seq }, null, 2);
    } catch (e) {
      return `Error: ${(e as Error).message}`;
    }
  },
};

/**
 * edgar_query — read US SEC EDGAR filings/facts with audit-grade lineage.
 * Filings are immutable by accession number; this is the cleanest
 * content-addressing story available for US public-company data.
 */
const edgarQueryTool: KbotToolDefinition = {
  name: "edgar_query",
  description:
    "Query SEC EDGAR public-company filings or XBRL company facts. mode=submissions returns recent filings (with accession numbers and direct archive URLs); mode=company_facts returns the keys of XBRL facts available for the company. AI never produces the data — SEC does. Audit log at ~/.kbot/audit/polymarket.jsonl.",
  parameters: {
    mode: {
      type: "string",
      description: "'submissions' for recent filings list, 'company_facts' for XBRL fact keys.",
      required: true,
    },
    cik: {
      type: "string",
      description: "Central Index Key — numeric, with or without leading zeros (e.g. '320193' for Apple).",
      required: true,
    },
    limit: {
      type: "number",
      description: "Max items to return. Default 25 for filings, 50 for facts.",
    },
    jurisdiction: {
      type: "string",
      description: "Verifier jurisdiction tag. Default US.",
      default: "US",
    },
  },
  tier: "free",
  async execute(args) {
    try {
      const mode = args["mode"];
      if (mode !== "submissions" && mode !== "company_facts") {
        return `Error: mode must be 'submissions' or 'company_facts' (got: ${String(mode)})`;
      }
      const cik = typeof args["cik"] === "string" ? args["cik"] : undefined;
      if (!cik) return "Error: cik is required";
      const limit = typeof args["limit"] === "number" ? args["limit"] : undefined;
      const jurisdiction =
        typeof args["jurisdiction"] === "string"
          ? (args["jurisdiction"] as "US" | "EU" | "UK" | "SG" | "HK" | "UAE" | "GLOBAL")
          : "US";

      const auditLog = await getAuditLog();
      const result = await edgarQuery(
        {
          mode,
          cik,
          ...(limit !== undefined ? { limit } : {}),
          data_as_of: nowISO(),
        },
        {
          auditLog,
          rules: defaultRules(),
          verifierContext: { session_id: sessionId(), state: {}, jurisdiction },
        },
      );
      if (!result.ok) {
        return `Error (${result.stage}): ${JSON.stringify(result.detail, null, 2)}`;
      }
      const summary = {
        request_hash: result.response.request_hash,
        engine_version: result.response.engine_version,
        produced_at: result.response.produced_at,
        byte_identical_replayable: result.response.byte_identical_replayable,
        entity_name: result.response.value.entity_name,
        result_count:
          result.response.value.filings?.length ??
          result.response.value.facts_keys?.length ??
          0,
        ...(result.response.value.filings
          ? { filings: result.response.value.filings }
          : { facts_keys: result.response.value.facts_keys }),
      };
      return JSON.stringify(summary, null, 2);
    } catch (e) {
      return `Error: ${(e as Error).message}`;
    }
  },
};

/**
 * annex_iv_export — emit an EU AI Act Annex IV technical-documentation
 * bundle from the audit log. Same artifact satisfies Fed SR 26-02
 * technical documentation. Writes the rendered markdown to disk.
 */
const annexIvExportTool: KbotToolDefinition = {
  name: "annex_iv_export",
  description:
    "Generate an EU AI Act Annex IV technical-documentation markdown bundle from the kbot-finance audit log. Same artifact satisfies Fed SR 26-02. Pass output_path to write to disk; otherwise the rendered content is returned inline.",
  parameters: {
    audit_log_path: {
      type: "string",
      description: `Audit log path. Defaults to ${DEFAULT_AUDIT_PATH}.`,
    },
    output_path: {
      type: "string",
      description: "If set, write the bundle to this path and return only the metadata.",
    },
    system_name: {
      type: "string",
      description: "System name to record in the Annex IV header.",
    },
    deployer: {
      type: "string",
      description: "Deployer / regulated entity name to record in the Annex IV header.",
    },
    jurisdiction: {
      type: "string",
      description: "Jurisdiction filed under (EU/US/UK/SG/HK/UAE/GLOBAL). Default EU.",
      default: "EU",
    },
  },
  tier: "free",
  async execute(args) {
    try {
      const audit_log_path =
        typeof args["audit_log_path"] === "string" ? args["audit_log_path"] : DEFAULT_AUDIT_PATH;
      const output_path = typeof args["output_path"] === "string" ? args["output_path"] : undefined;
      const system_name = typeof args["system_name"] === "string" ? args["system_name"] : undefined;
      const deployer = typeof args["deployer"] === "string" ? args["deployer"] : undefined;
      const jurisdiction =
        typeof args["jurisdiction"] === "string"
          ? (args["jurisdiction"] as "US" | "EU" | "UK" | "SG" | "HK" | "UAE" | "GLOBAL")
          : "EU";

      const bundle = await exportAnnexIv(audit_log_path, {
        ...(system_name ? { system_name } : {}),
        ...(deployer ? { deployer } : {}),
        jurisdiction,
      });

      if (output_path) {
        await writeFile(output_path, bundle.content, "utf8");
        return JSON.stringify(
          { ok: true, output_path, meta: bundle.meta },
          null,
          2,
        );
      }
      return bundle.content;
    } catch (e) {
      return `Error: ${(e as Error).message}`;
    }
  },
};

export const kbotFinanceTools: readonly KbotToolDefinition[] = [
  polymarketQueryTool,
  edgarQueryTool,
  annexIvExportTool,
  auditLogVerifyTool,
];

export function registerKbotFinanceTools(
  register: (t: KbotToolDefinition) => void,
): void {
  for (const t of kbotFinanceTools) register(t);
}
