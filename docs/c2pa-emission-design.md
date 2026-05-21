# C2PA emission for kbot artifacts — design note

*A design note for the v0.1 implementation of C2PA Content Credentials
emission on kbot-generated artifacts. C2PA went default-on in Gemini at
Google I/O 2026 (21 May); this note specifies how kbot adds the same
capability to its own artifact-generation paths.*

Dated 2026-05-21. Filed alongside [`docs/agentic-engineering.md`](./agentic-engineering.md) and [`docs/may-2026-signals.md`](./may-2026-signals.md).

Licensed CC BY 4.0.

---

## Why this exists

The Coalition for Content Provenance and Authenticity (C2PA) ships an
open cryptographic spec for attaching tamper-evident provenance manifests
to media. When Google embedded C2PA verification in Gemini default-on,
the standard transitioned from "available to opt-in publishers" to
"baseline consumer signal across the largest AI surface on the
internet."

kbot generates many kinds of artifacts: AI-produced code, prose,
images (via `generate_art`, `imagemagick`, etc.), audio (via the Ableton
integration), and video (via `ffmpeg_process`). Today none of these
emit C2PA manifests. The gap means kbot-produced artifacts are
indistinguishable, downstream, from artifacts produced by tools that
do not maintain provenance — and the more C2PA propagates as a
baseline signal, the more "no manifest" reads as suspicious by default.

The design below specifies the v0.1 implementation that closes this gap.

---

## Scope: what v0.1 does and does not do

### In scope for v0.1

1. **Attach a C2PA manifest** to every artifact kbot's image-generation
   and image-manipulation tools produce. Specifically:
   - `generate_art` (DALL-E, SDXL, Flux, etc. — whatever provider kbot
     dispatches to)
   - `imagemagick` outputs
   - `local_image_thoughtful` outputs
2. **Sign manifests with a kernel.chat-issued certificate** — kbot
   operates an embedded signing key shipped with the agent-os credential
   vault. The certificate identifies the artifact as produced by the
   kernel.chat substrate; downstream verifiers can check the chain.
3. **Record the manifest hash in the audit log** — kbot-finance's audit
   log gets a new event type `c2pa-manifest-attached` linking the artifact
   content hash, the manifest hash, and the agent identity that produced
   it.
4. **Document the manifest fields populated**, including:
   - `claim_generator`: `kernel.chat/kbot@<version>`
   - `created`: ISO timestamp at generation
   - `actions`: structured edit chain (one entry per tool invocation)
   - `ai_tool`: provider + model used
   - `prompt_hash`: SHA-256 of the prompt that produced the artifact
   - `principal_identity`: the operator's identifier (per agent-os)

### Out of scope for v0.1

1. **Audio + video** artifact emission. The C2PA spec supports both;
   the implementation surface is larger. v0.2.
2. **Text artifacts** (prose, code). C2PA's text-content support is
   less mature than its media support, and the consumer-recognition
   surface (Google's verification UX in Gemini) targets media first.
   v0.3.
3. **End-user verification UI inside kbot.** v0.1 only emits manifests;
   verifying received content is a separate ship.
4. **Third-party signing-authority integration** (camera-mfr certificate
   chains, Adobe CAI). kernel.chat-issued certificates only in v0.1;
   federation comes later.

---

## Design: where the primitive lives

### Package: new `@kernel.chat/kbot-provenance` (proposed)

A new package alongside the existing four. The reasons for a new
package rather than inline addition:

- C2PA spec implementation has its own complexity surface (manifest
  format, certificate management, key rotation). A focused package
  isolates that complexity.
- The same primitive serves kbot AND kbot-finance — both will emit
  C2PA on different artifact classes. A shared package prevents
  duplication.
- Forkers of the substrate may want C2PA emission independent of kbot
  itself (e.g., a different agent platform using only the provenance
  layer).

Provisional name: `@kernel.chat/kbot-provenance`. License: MIT (same as
kbot-orchestrator and kbot).

### Dependencies

- `c2pa-node` (the upstream Node binding to the Rust `c2pa-rs` library) —
  the reference implementation of the spec. Active development; ~3 MB
  package; well-tested.
- Optional: `@digitalbazaar/data-integrity` for additional signature
  schemes beyond the default Ed25519 in c2pa-rs.

### Public API sketch

```ts
import {
  ProvenanceSigner,
  emitManifest,
  verifyManifest,
  type Manifest,
  type Action,
} from '@kernel.chat/kbot-provenance'

// One-time setup: load the operator's signing key from agent-os vault
const signer = new ProvenanceSigner({
  vaultKey: 'kbot.provenance.signing-key',
  certificate: 'kbot.provenance.cert.pem',
})

// On every artifact emission
const manifest = await emitManifest({
  artifact: imageBytes,
  signer,
  actions: [{
    action: 'c2pa.created',
    softwareAgent: 'kbot@4.5.0',
    digitalSourceType: 'http://cv.iptc.org/newscodes/digitalsourcetype/trainedAlgorithmicMedia',
    parameters: { provider: 'flux', model: 'flux-pro-1.1', prompt_hash: '...' },
  }],
  principalIdentity: 'isaacsight@gmail.com',
})

// Returns a new artifact with C2PA manifest embedded (or a sidecar file
// where embedding isn't supported by the format).
```

### Integration with kbot

In the kbot artifact-generation tools, the emission becomes a final
step in the tool's execution. For `generate_art`:

```ts
// Before (today)
const imageBytes = await provider.generate(prompt)
return imageBytes

// After (v0.1)
const imageBytes = await provider.generate(prompt)
const manifest = await provenance.emitManifest({
  artifact: imageBytes,
  signer: kbotSigner,
  actions: [/* ... */],
  principalIdentity: agentOs.currentPrincipal(),
})
return imageBytes  // C2PA-embedded
```

### Audit log integration

Every manifest emission writes an event to the kbot-finance audit log:

```ts
auditLog.write({
  type: 'c2pa-manifest-attached',
  agent: 'kbot.generate_art',
  principal: 'isaacsight@gmail.com',
  artifactHash: sha256(imageBytes),
  manifestHash: sha256(manifest.toJson()),
  ts: new Date().toISOString(),
})
```

The audit log is content-addressed and hash-chained, so the C2PA
manifest emission becomes part of the larger provenance-engineering
audit substrate. Downstream verifiers can cross-reference the audit
log entry against the embedded manifest.

---

## Certificate strategy

The hardest design question is certificate provisioning. Options:

### A. kernel.chat-issued certificates (v0.1 default)

kernel.chat operates a signing root. Each operator gets a child
certificate scoped to their principal identity. Pro: zero setup
friction. Con: kernel.chat becomes a trust authority, which is a
substantial operational responsibility (key rotation, revocation,
infrastructure).

### B. Self-signed per-operator certificates

Each operator generates their own root + signing key locally. Pro: no
central trust authority. Con: downstream verifiers can't easily
distinguish "this signature is from a real operator named X" from "this
signature is from a self-issued claim of being X."

### C. Federated / let-operator-bring-their-own

kbot accepts a certificate provided via agent-os vault; the operator
sets up their own trust chain (e.g., from a corporate CA, or from the
Adobe Content Authenticity Initiative chain). Pro: meets enterprise/
federal requirements where they have existing PKI. Con: setup friction.

### Recommended phasing

- **v0.1:** Option A (kernel.chat-issued certs). Default for solo
  operators and small teams. Low friction.
- **v0.2:** Option C (BYOC — bring-your-own-certificate). For enterprise
  and federal deployments with existing PKI.
- **v0.3:** Option B (self-signed) for fully air-gapped scenarios.

---

## Implementation roadmap (concrete ship plan)

| Milestone | Scope | ETA |
|---|---|---|
| **v0.1.0-alpha.0** | Package created; `emitManifest` + `verifyManifest` core API working with `c2pa-node`. kernel.chat-issued cert chain operational. Integration with `generate_art` only. | 1 week |
| **v0.1.0-beta.0** | Integration with all kbot image tools (`imagemagick`, `local_image_thoughtful`). Audit-log writes wired. | 1 week |
| **v0.1.0** | Documentation, public README, npm publish. Reference verification UX written but not yet integrated into kbot itself. | 1 week |
| **v0.2** | BYOC support. Audio + video extension. | 4-6 weeks after v0.1 |
| **v0.3** | Text artifact support. Federated trust chains. | tbd |

---

## Open questions

1. **Should kbot REQUIRE C2PA or make it opt-out?** Current thinking:
   opt-in via env var (`KBOT_C2PA_ENABLED=true`) for v0.1 to avoid
   breaking existing workflows. Default-on in v0.2 once the path is
   battle-tested.

2. **How does kernel.chat key management scale?** If we issue
   per-operator certificates from a central root, we need an
   operational practice for rotation, revocation, and an HSM-backed
   root. Investigate during v0.1.

3. **Does the audit log entry suffice, or do we ALSO write to a
   separate "provenance ledger" the regulator could fetch
   independently?** Current thinking: the audit log IS the provenance
   ledger (the discipline is named provenance engineering for a
   reason). Separate ledger is over-engineering until a regulator
   asks for it.

4. **Should we anchor manifest hashes to a public timestamping
   service** (RFC 3161, OpenTimestamps) so a recipient can prove the
   manifest existed at a given moment? Worth investigating in v0.2.

---

## Why this matters strategically

This is the move that takes the substrate-engineering work kernel.chat
has been doing — provenance engineering as named in ISSUE 381 — from
engineer-only artifact to consumer-recognized glyph. Once kbot emits
C2PA manifests, anyone using kbot to produce media has the same baseline
"this is what produced this" affordance Google ships in Gemini, but
operated by the operator (BYOK-style), not by Google.

The pattern also fits the broader kernel.chat positioning: substrate
disciplines that ship as open-source reference implementations and
become part of the field's working substrate. C2PA is the spec; kbot
becomes one of the early agent platforms that implements the spec
cleanly and ships the audit-log integration as part of the package.

---

*Filed as design note, not implementation. v0.1 ships when the
implementation lands.*
