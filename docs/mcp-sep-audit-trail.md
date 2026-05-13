# SEP Draft: Content-Addressed Request Envelope & Audit Trail for MCP

> **Paste-ready submission for `modelcontextprotocol/modelcontextprotocol`.**
> Open as a new issue with the title below. The MCP working group's
> 2026 roadmap (March 5, 2026 update) names **enterprise readiness —
> audit trails, SSO, gateway behavior** as a priority workstream.
> This SEP proposes the audit-trail substrate for that workstream.
>
> Reference implementation: `@kernel.chat/kbot-finance@0.2.0` (Apache 2.0).
> Full spec: `RFC-content-addressed-mcp.md` in the same package.
> Companion comparison to Claude Managed Agents' audit log:
> `packages/agent-os/COMPARISON.md`.
>
> When filed, this SEP gets a number (SEP-XXXX). Until then it's
> referenced as `sep:audit-trail`.

---

## Title (when posting)

```
SEP: Content-addressed request envelope and audit trail for MCP servers
```

## Suggested labels

`sep` · `enterprise-readiness` · `audit` · `standards-track`

## Type

Standards Track (extension)

---

## Body

### Abstract

This SEP proposes a small, optional, additive extension to MCP that
gives tool calls **content-addressed identity** and **deterministic
replay semantics** — the prerequisites for audit-grade deployments in
regulated industries.

Servers attach a content-addressed envelope to every tool response
under `_meta`. The envelope includes a SHA-256 hash over canonicalized
inputs (the replay key), a pinned engine version, a data-as-of
timestamp, and an honesty flag (`byte_identical_replayable: true |
false`). Servers may optionally expose a `replay(request_hash)` tool
that returns the byte-identical prior result.

Backwards-compatible by design: clients that don't recognize the
envelope ignore it; servers that don't implement remain fully
conformant.

### Motivation

The MCP 2026 roadmap (March 5) names "audit trails" as an
enterprise-readiness priority. Today, an MCP client invoking a tool
gets back a response with no canonical replay key. Six months later,
a regulator (or a compliance officer, or a postmortem author) asking
"what did the agent see when it made this decision?" gets a
transcript — not proof.

Compliance regimes that already require what this SEP would enable:

- EU AI Act Annex IV technical-documentation requirements
  (high-risk-system enforcement begins August 2, 2026)
- Federal Reserve SR 26-02 + OCC Bulletin 2026-13 (model risk
  management, superseded SR 11-7 in April 2026)
- ESMA Supervisory Briefing on Algorithmic Trading
  (ESMA74-1505669079-10311, February 26, 2026)
- FINRA 2026 Annual Regulatory Oversight Report (GenAI section,
  December 2025)
- FCA SS1/23 (Principles 1, 2, 3, 5)

Each of these expects an auditable, replayable lineage for AI-influenced
decisions. None of them are satisfiable by transcript alone.

The pattern is not theoretical. Bloomberg ASKB (Feb 2026 launch) ships
exactly this shape inside the Terminal: the agent emits BQL code, BQL
runs against pinned data, the output is replayable. ASKB is closed
and Terminal-only. This SEP is the open equivalent so any MCP server
can adopt it.

### Specification

#### Envelope shape

Servers implementing this SEP attach `_meta` to every tool response:

```jsonc
{
  // ...standard MCP CallToolResult fields...
  "_meta": {
    "mcp/audit-v1": {
      "request_hash": "<64-hex SHA-256>",
      "engine_version": "<vendor-defined string>",
      "schema_hash": "<64-hex SHA-256 over the tool's JSON schema>",
      "data_as_of": "<ISO 8601 UTC timestamp>",
      "produced_at": "<ISO 8601 UTC timestamp>",
      "byte_identical_replayable": true,
      "deterministic_seed": "<optional hex string>"
    }
  }
}
```

#### Canonical hashing

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

`canonicalize()` follows RFC 8785 JSON Canonicalization Scheme (JCS),
with one additional normative constraint:

> Non-finite numbers (NaN, ±Infinity) and `undefined` values MUST
> cause hashing to fail rather than be silently elided.

This constraint exists because a hash that silently swallows a NaN is
worse than no hash at all for audit purposes.

#### The honesty primitive

The hardest design decision: what to do when the engine is not
deterministic. Live HTTPS APIs (Polymarket Gamma, SEC EDGAR's `recent`
table), GPU-based LLM inference (CUDA reduction order is not specified
by IEEE 754), and any tool whose backing engine isn't bit-stable
cannot guarantee byte-identical replay.

The proposal: **make the truth machine-readable.**

Servers MUST emit `byte_identical_replayable: false` when they cannot
promise byte-identical replay, and `true` only when they can. A server
claiming `true` when it cannot deliver is **non-conformant**.

The audit log still records the hash and the response — auditors get
the chain — but the replay-byte-for-byte property is opt-in per-call
rather than a universal claim.

Practical consequence: the same MCP server can serve real-time market
data (`replayable: false`) and historical computations against pinned
snapshots (`replayable: true`) from the same surface. The client
decides which it can rely on.

#### The `replay` tool

Servers implementing this SEP SHOULD expose a tool named `replay`:

```jsonc
{
  "name": "replay",
  "description": "Re-execute a prior request by hash and return the byte-identical result, or report a mismatch.",
  "inputSchema": {
    "type": "object",
    "properties": {
      "request_hash": {
        "type": "string",
        "description": "The hash returned by a prior call."
      }
    },
    "required": ["request_hash"]
  }
}
```

Replay returns either the original sealed envelope (byte-identical
when the server's audit log retains the request and the engine is
deterministic for that request) or a `replay_mismatch` error with
diff details.

#### Capability negotiation

Servers advertise via standard MCP capability negotiation:

```jsonc
{
  "capabilities": {
    "tools": {},
    "experimental": {
      "mcp/audit-v1": { "version": "0.1" }
    }
  }
}
```

The `experimental.` prefix is the right caution for v0.1. If the SEP
ratifies, the prefix drops and the capability moves into the standard
namespace.

### Audit log shape (informational)

This SEP does not require a particular audit log shape. The reference
implementation (`@kernel.chat/kbot-finance`) uses a hash-chained
append-only JSONL log with the following entry shape:

```jsonc
{
  "seq": <monotonic>,
  "timestamp": "<ISO 8601>",
  "action": "engine_request" | "engine_response" | "verifier_check"
          | "incident" | "replay_request" | "replay_verified"
          | "replay_mismatch" | "approval_granted" | "approval_denied",
  "subject": "<tool name>",
  "session_id": "<client-chosen>",
  "payload": { ... },
  "prev_hash": "<64-hex SHA-256 of the previous entry, or all-zeros for genesis>",
  "self_hash": "<64-hex SHA-256 of this entry without self_hash>"
}
```

Tampering with any entry breaks the chain at that entry and at every
subsequent entry, detectable in O(n) time by walking the log.

Whether the SEP standardizes the entry format or leaves it to
implementations is **Open Question 3** below.

### Backwards compatibility

The extension is purely additive. MCP clients that don't recognise
the `_meta.mcp/audit-v1` block ignore it. Servers that don't
implement remain fully conformant MCP servers.

### Security considerations

- **Hash collisions.** SHA-256 collision resistance is ~2^128 — adequate
  for the audit horizon of regulated industries (10 years per EU AI
  Act Art. 19). Post-quantum migration is handled via an optional
  `hash_algorithm` tag in a future revision.
- **Replay attacks.** The envelope is a content identifier, not an
  authentication token. Session authentication remains the client's
  responsibility.
- **Privacy.** Canonicalized inputs may contain sensitive data. Audit
  log storage MUST respect the same access controls as the inputs.
  The hash itself reveals nothing about the inputs.
- **Side-channel determinism.** Bit-identical replay across hardware
  (x86 vs ARM, AVX-512 vs not, GPU vs CPU) requires pinned-architecture
  execution or correctly-rounded math (CRlibm, sleef). Servers that
  cannot pin their execution environment MUST emit
  `byte_identical_replayable: false`. Recent open-source work
  (EigenAI, Q1 2026) demonstrates bit-exact GPU inference with <2%
  overhead via batch-invariant kernels — this is becoming a practical
  primitive faster than the spec needs to wait for it.

### Reference implementation

`@kernel.chat/kbot-finance@0.2.0` on npm. Apache 2.0. Implements every
normative requirement above:

- `sealEnvelope()` — wraps an engine call, computes the hash, returns
  the envelope.
- `AppendOnlyAuditLog` — hash-chained log with `verify()` for integrity
  checks.
- `mcp-server.ts` — MCP server exposing four audit-grade tools
  (`polymarket_query`, `edgar_query`, `annex_iv_export`,
  `audit_log_verify`) using this envelope shape.

Quick install:

```bash
npm install @kernel.chat/kbot-finance
npx -y @kernel.chat/kbot-finance demo   # end-to-end against live Polymarket
npx -y @kernel.chat/kbot-finance mcp    # start the MCP server on stdio
```

GitHub: `github.com/isaacsight/kbot-finance` (mirror) /
`github.com/isaacsight/kernel/tree/main/packages/kbot-finance` (canonical).

### Alternatives considered

1. **Audit at the transport layer.** Add request/response hashing to
   the MCP JSON-RPC envelope rather than to `_meta`. Rejected because
   it requires breaking changes; the `_meta` shape preserves
   backwards compatibility.
2. **Audit as a separate tool surface (e.g., `auditing/append`).**
   Rejected because every server would need to plumb audit into every
   tool implementation. The envelope-attached approach lets each tool
   stay simple; the audit substrate sits at the framework boundary.
3. **Server-side audit only, no client visibility.** Rejected because
   regulators and clients both need access to the lineage. The
   envelope-in-`_meta` gives the client a chain it can verify
   independently.
4. **Replay tool as required, not SHOULD.** Rejected because not every
   server's engine is replay-capable (live data feeds especially).
   SHOULD preserves the option for servers to be honest about
   non-determinism.

### Open questions

The working group's read on these would sharpen v0.1:

1. **Hash-algorithm agility.** Should v0.1 mandate a `hash_algorithm`
   tag even if SHA-256 is the only currently-supported option?
   Recommendation: yes, default to `sha-256` and reserve `blake3`,
   `sha3-256`, post-quantum.
2. **Replay tool naming.** Is `replay` too generic for a global
   namespace? Alternatives: `audit_replay`, `__replay`, `mcp/replay`.
3. **Audit log shape.** Should the SEP standardize the JSONL audit
   entry format from the reference implementation, or leave the log
   shape to implementations and standardize only the envelope?
   Recommendation: standardize the envelope; leave the log shape
   informational with a recommended pattern.
4. **Approval-token integration.** The reference implementation
   includes a `governance.ts` module with HMAC-signed material-gate
   approval tokens bound to `request_hash`. Should approval-token
   shape be part of this SEP, or a separate follow-up SEP?
   Recommendation: separate SEP. This SEP focuses on the audit
   primitive; approval-gating is its own conversation.
5. **`_meta` versus a top-level field.** `_meta` is the conservative
   choice (additive, transparent to non-implementing clients). A
   top-level `envelope` field would be more discoverable but breaks
   backwards compatibility. Recommendation: keep `_meta` for v0.1;
   revisit if adoption is high enough to justify the breakage.

### Adjacency to the 2026 roadmap

This SEP fits into the **Enterprise Readiness** workstream named in
the March 5 roadmap update. It does not conflict with:

- **Transport scalability (Streamable HTTP at scale)** — the envelope
  rides in `_meta` regardless of transport.
- **Agent communication / Tasks** — the envelope applies equally to
  agent-to-agent tool calls if Tasks adopts an MCP-shaped surface.
- **Governance (Contributor Ladder SEP)** — orthogonal.

If accepted, this SEP would land alongside SEPs for SSO and gateway
behavior as the three audit-trail-shaped surfaces the enterprise
workstream needs.

### What the working group could ask of the author

In rough priority order:

1. **Reactions on the basic shape** — does the envelope-in-`_meta`
   pattern fit MCP's intended evolution?
2. **Adoption of the honesty primitive** as a normative requirement
   in any audit-related SEP — `byte_identical_replayable` matters
   in any spec touching regulated deployment.
3. **Discussion of the five open questions** above, in the issue
   thread or via individual sub-issues if any are load-bearing.
4. **An owner from the spec maintainers** who would champion this
   through to a formal SEP track if the working group is interested.

If the answer is "this should be a separate spec entirely, not an
MCP extension," the author is fine to take it elsewhere — the work
needs a home more than it needs a particular flag on a particular
protocol. But MCP is the natural place because the audit substrate is
most useful when it travels with the tool-call surface every agent
already speaks.

---

## Cover note when posting (optional)

If the maintainers want context on who's filing and why:

> Hi MCP working group — this is a Standards Track SEP draft from the
> author of @kernel.chat/kbot-finance, an audit-grade AI substrate
> for regulated industries (npm: @kernel.chat/kbot-finance, 0.2.0,
> Apache 2.0).
>
> The 2026 roadmap (March 5 update) named enterprise readiness with
> audit trails as a priority workstream. This SEP proposes the
> audit-trail substrate for that workstream, with a reference
> implementation in production. The implementation runs end-to-end
> against live Polymarket and SEC EDGAR with 33+ tests passing,
> including a hash-chain tamper-detection suite.
>
> Happy to revise based on feedback, split into smaller SEPs if the
> working group prefers a more incremental approach, or take this
> elsewhere if it doesn't fit MCP's intended evolution. The
> reference implementation is real and Apache-2.0, so any direction
> the spec takes can adopt the parts it likes.
>
> — Isaac Hernandez · kernel.chat · isaacsight@gmail.com

---

*SEP draft v0.1 · 2026-05-13 · CC BY 4.0. Update as the working
group's response shapes the spec.*
