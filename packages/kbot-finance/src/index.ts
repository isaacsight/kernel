/**
 * @kernel.chat/kbot-finance — Audit-grade AI infrastructure for capital markets.
 *
 * Three layers, one architecture:
 *
 *   1. Deterministic engine adapters — call known-good engines, never compute
 *      the number in the AI layer. Content-addressed request envelopes guarantee
 *      replay semantics.
 *
 *   2. Regulatory verifier — Norm-AI-pattern rules-as-code. Every action passes
 *      through before the engine call. Failures emit adverse-action reason codes.
 *
 *   3. Hash-chained audit log — append-only, WORM-compatible, legally defensible.
 *      Every request, verifier check, engine response, approval, and incident is
 *      recorded with a hash linking it to the previous entry.
 *
 * The AI Intelligence Layer (kbot) calls into this package. The engines (Polymarket
 * Gamma in v0.1; QuantLib, NautilusTrader, Aeron, alts-NAV in later versions) sit
 * underneath. Regulators read the audit log.
 *
 * Apache 2.0. Reference implementation; not yet certified for production trading.
 */

export * from "./envelope.js";
export * from "./audit-log.js";
export * from "./governance.js";
export * from "./verifier/index.js";
export * as polymarket from "./adapters/polymarket/index.js";
export * as edgar from "./adapters/edgar/index.js";
export * from "./tools/polymarket-query.js";
export * from "./tools/edgar-query.js";
export * from "./exporters/annex-iv.js";
