# RFC: Content-Addressed Request Envelope for MCP

**Status:** Draft 0.1
**Author:** kbot-finance contributors (@kernel.chat)
**Date:** 2026-05-10
**Reference implementation:** `@kernel.chat/kbot-finance` v0.2.0

## Abstract

This RFC proposes a small, optional extension to the Model Context Protocol
(MCP) that gives MCP tool calls **deterministic replay semantics**.

Every MCP request/response pair carries an opaque envelope containing a
content-addressed hash over canonicalized inputs, a pinned engine version,
and a data-as-of timestamp. Identical envelopes resolve to identical
responses, byte-for-byte, when the underlying engine is deterministic.

The envelope is **additive**: clients and servers that don't implement
the extension continue to work. Servers that opt in expose a `replay(hash)`
tool and emit envelope metadata alongside every tool result.

## Motivation

MCP is on track to be the agent-tool protocol that wins (~9,400 servers,
adopted by Anthropic, OpenAI, Microsoft, Google as of April 2026). It has
the right shape for tool-use composition across models and clients.

It lacks one primitive: **auditable, replayable tool calls**. This matters
for any deployment in a regulated industry — capital markets, healthcare,
legal, defense, drug discovery, tax. Today, an MCP client invoking a tool
gets back a result with no canonical replay key. If a regulator later asks
"what did the agent see when it made that decision," the answer is
"we have a log, sort of, but we can't deterministically reconstruct the
exact tool call." That's insufficient for SR 26-02, EU AI Act Annex IV,
MiFID II RTS 6, FINRA 2026 ROR, FCA SS1/23, and the converging US AI
oversight regime that follows the inter-agency RFI on agentic AI.

Bloomberg ASKB (Feb 2026) ships this pattern internally: agents emit BQL
code, the BQL engine produces the number, and the output is replayable
inside the Terminal. Closed, proprietary. This RFC is the open
equivalent.

## Non-goals

- Replace MCP's existing tool schema or JSON-RPC transport.
- Mandate determinism in the tool implementation. Tools may emit
  `byte_identical_replayable: false` truthfully — the envelope still
  carries the request hash for audit, just without a replay guarantee.
- Specify cryptographic algorithms beyond SHA-256. Implementations
  may upgrade to BLAKE3, SHA-3, or post-quantum hashes by emitting
  a hash-algorithm tag.

## Specification

### Envelope structure

Servers implementing the extension expose two metadata fields on every
tool response:

```jsonc
{
  // ...standard MCP CallToolResult fields...
  "_meta": {
    "kbot-finance/content-addressed": {
      "version": "0.1",
      "request_hash": "<64-hex SHA-256>",
      "engine_version": "<vendor-defined string>",
      "schema_hash": "<64-hex SHA-256 over the tool's JSON schema>",
      "data_as_of": "<ISO 8601 UTC timestamp>",
      "produced_at": "<ISO 8601 UTC timestamp>",
      "byte_identical_replayable": true | false,
      "deterministic_seed": "<optional hex string>"
    }
  }
}
```

### Canonical hashing

`request_hash` is computed as:

```
SHA-256(canonicalize({
  operation: <tool name>,
  engine_version,
  schema_hash,
  inputs: <tool args>,
  data_as_of,
  deterministic_seed?  // present iff supplied
}))
```

`canonicalize()` is RFC 8785 JSON Canonicalization Scheme (JCS), with the
additional constraint that **non-finite numbers (NaN, ±Infinity) and
`undefined` values MUST cause hashing to fail**, not be silently elided.

### `replay` tool

Servers implementing the extension SHOULD expose a tool named `replay`:

```jsonc
{
  "name": "replay",
  "description": "Re-execute a prior request by hash and return the byte-identical result, or report a mismatch.",
  "inputSchema": {
    "type": "object",
    "properties": {
      "request_hash": { "type": "string", "description": "The hash returned by a prior call." }
    },
    "required": ["request_hash"]
  }
}
```

Replay returns either:

- The original sealed envelope, byte-identical to the prior call, when the
  server's audit log retains the request and the engine is deterministic
  for that request; or
- A `replay_mismatch` error with details when the request is known but the
  current engine cannot reproduce it (e.g., the engine version was rotated,
  the data snapshot expired).

### `byte_identical_replayable: false` is normative, not a bug

A truthful `false` declaration is part of the audit story. Live HTTPS APIs
(Polymarket Gamma, SEC EDGAR's `recent` table), non-deterministic GPU
inference, and any tool whose backing engine isn't bit-stable MUST emit
`byte_identical_replayable: false`. The audit log still records the hash
and the response; replay is just not byte-guaranteed.

The "honesty primitive" is a hard rule: a server claiming `true` when it
cannot deliver byte-identical replay is non-conformant.

### Audit log compatibility

The extension does not require a particular audit log shape. The reference
implementation uses a hash-chained append-only JSONL log with the
following entry shape:

```jsonc
{
  "seq": <monotonic>,
  "timestamp": "<ISO 8601>",
  "action": "engine_request" | "engine_response" | "verifier_check" | "incident" | "replay_request" | "replay_verified" | "replay_mismatch" | "approval_granted" | "approval_denied",
  "subject": "<tool name>",
  "session_id": "<client-chosen>",
  "payload": { ... },
  "prev_hash": "<64-hex SHA-256 of the previous entry, or all-zeros for genesis>",
  "self_hash": "<64-hex SHA-256 of this entry without self_hash>"
}
```

Tampering with any entry breaks the chain at that entry and at every
subsequent entry, detectable in `O(n)` time by walking the log.

### Capability advertisement

Servers implementing the extension advertise via the standard MCP
capabilities negotiation:

```jsonc
{
  "capabilities": {
    "tools": {},
    "experimental": {
      "kbot-finance/content-addressed": { "version": "0.1" }
    }
  }
}
```

Clients that don't recognise the experimental capability ignore the
`_meta` block harmlessly.

## Reference implementation

`@kernel.chat/kbot-finance` v0.2.0 ships:

- `sealEnvelope()` — wraps an engine call, computes the hash, returns
  the envelope.
- `AppendOnlyAuditLog` — hash-chained log with `verify()` for integrity
  checks.
- `mcp-server.ts` — MCP server that exposes audit-grade tools
  (`polymarket_query`, `edgar_query`, `annex_iv_export`,
  `audit_log_verify`) using this envelope shape.

Install: `npm install @kernel.chat/kbot-finance`
Run: `npx @kernel.chat/kbot-finance mcp`

## Security considerations

- **Hash collisions.** SHA-256 collision resistance is ~2^128. Adequate
  for the audit horizon of regulated industries (10 years per EU AI Act
  Art. 19). Post-quantum upgrades should swap to SHA-3-256 or BLAKE3
  via an explicit `hash_algorithm` field.
- **Replay attacks.** The envelope is a *content identifier*, not an
  authentication token. Replay of a known hash in a different session
  is not a security issue at the envelope layer — session authentication
  remains the client's responsibility.
- **Privacy.** Canonicalized inputs may contain sensitive data. Audit
  log storage MUST respect the same access controls as the inputs
  themselves. The hash itself reveals nothing about the inputs.
- **Side-channel determinism.** Bit-identical replay across hardware
  (x86 vs ARM, AVX-512 vs not, GPU vs CPU) requires pinned-architecture
  execution or correctly-rounded math (CRlibm, sleef). Servers that
  cannot pin their execution environment MUST emit
  `byte_identical_replayable: false`.

## Backwards compatibility

The extension is purely additive. MCP clients that don't recognise the
`_meta.kbot-finance/content-addressed` block ignore it. Servers that
don't implement the extension are fully conformant MCP servers.

## Open questions

1. **Hash algorithm agility.** Should the spec require a `hash_algorithm`
   tag from day one, even if v0.1 only supports SHA-256?
2. **Replay tool naming.** Is `replay` too generic? Alternatives:
   `audit_replay`, `__replay`, `mcp.replay`.
3. **Audit log shape standardization.** Should the audit log entry
   format be in the spec, or left to implementations?
4. **Capability negotiation.** Does the `experimental.` prefix slow
   adoption, or is it the right caution for v0.1?

## Acknowledgements

- Anthropic, for MCP itself.
- Bloomberg ASKB, for shipping the pattern in closed form and proving the
  buyer demand.
- Adaptive Financial Consulting (Aeron), whose deterministic-replay
  primitives in financial messaging inspired the audit log shape.
- The FINOS AI Governance Framework v2.0 working group, whose risk
  catalog informed the audit log entry types.

## License

This RFC is published under CC BY 4.0. The reference implementation is
Apache 2.0.
