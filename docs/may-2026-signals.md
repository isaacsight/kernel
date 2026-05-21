# Signals from May 2026 — what kbot needs + what the field wants

*A working note pulled from the third week of May 2026 news cycle (Google I/O, the White House AI EO, OWASP Top 10 Agentic Applications, Karpathy joining Anthropic, federal agentic-AI guidance). Calibrated to where the kernel.chat stack is and what's next.*

Dated 2026-05-21. Filed alongside [`docs/agentic-engineering.md`](./agentic-engineering.md).

---

## What kbot needs (product gaps surfaced by the week)

Five gaps the news cycle made visible, ranked by leverage.

### 1. C2PA Content Credentials emission on AI-generated outputs

**What changed:** Google embedded C2PA verification into Gemini as of 2026-05-21, rolling to Search and Chrome over coming months. C2PA is becoming default-on consumer signal for content provenance.

**Why kbot needs it:** kbot produces AI-generated artifacts (code, prose, images via generate_art, audio via Ableton integration, video via ffmpeg). Today none of these emit C2PA-compatible manifests. As C2PA becomes a consumer-recognized glyph, kbot-generated content without it will read as suspect by default.

**Concrete next step:** add a `@kernel.chat/agent-os` primitive (or a new kbot tool) that wraps any AI-generated artifact in a C2PA manifest signed with the operator's identity. The signing key fits into the existing `acap` capability-token + content-addressed-audit infrastructure naturally. Estimated scope: ~2 weeks of focused work to land v0.1.

**Anchor doc:** the C2PA spec at [c2pa.org/specifications](https://c2pa.org/specifications/). Reference implementations exist in Rust (`c2pa-rs`) and JavaScript.

### 2. OWASP Top 10 for Agentic Applications compliance

**What changed:** OWASP released the first peer-reviewed framework dedicated to autonomous AI agents (Dec 2025). The ten categories are now the de-facto security checklist the enterprise + federal AI security community evaluates agent platforms against.

**Why kbot needs it:** kbot is an agentic application. Buyers in regulated industries will start asking "are you OWASP-Agentic compliant?" by mid-2026. Today the answer is "we don't have a published audit." A self-audit + public attestation document fits naturally into the discipline-naming pattern kernel.chat has already established.

**Concrete next step:** produce `docs/owasp-agentic-self-audit.md` walking through each of the ten categories and documenting kbot's current posture. Treat it like the role definitions: CC BY 4.0, public, forkable. Estimated scope: 4-8 hours.

### 3. Gemini 3.5 Flash as a kbot BYOK provider

**What changed:** Google announced Gemini 3.5 Flash at I/O today — claims to rival frontier intelligence at Flash speeds + ~1/3 the cost of comparable frontier models. Outperforms Gemini 3.1 Pro on coding + agentic benchmarks per Google's own numbers.

**Why kbot needs it:** kbot's BYOK provider registry currently supports 20 providers. Gemini 3.5 Flash represents a meaningful cost/performance shift — users on the previous Gemini Pro will want to migrate. Lag in supporting it costs nothing per user but adds up across the base.

**Concrete next step:** add the model ID + pricing to `packages/kbot/src/auth.ts` PROVIDERS registry. Probably 15-30 minutes of work once Google publishes the public API endpoint specifics. Verify via the `gemini` provider entry path.

### 4. Anthropic post-Karpathy pre-training surface awareness

**What changed:** Andrej Karpathy joined Anthropic in May 2026, focused on pre-training research. Expect a new Claude variant or pre-training-improved family within 6-12 months.

**Why kbot needs it:** Anthropic provider in kbot needs to be ready for new model IDs as they ship. Currently kbot supports specific Claude model versions; the registry needs to gracefully handle additions. Also: the Anthropic Fellows Program (which Isaac is applying to) is now operating in an org with one more world-class researcher; the AI Safety track in particular benefits from this.

**Concrete next step:** keep the Anthropic provider entry generic enough that adding a new model ID is a one-line change. Currently it is; this is a "watch and react" item, not a build item.

### 5. Federal AI policy infrastructure as a kbot-finance pitch surface

**What changed:** White House EO expected this week pushing for government review of AI models before public release. NIST + DoD guidance reframes agentic AI safety as a compliance requirement. Multiple federal channels converging on "regulated AI needs audit-grade substrate."

**Why kbot needs it:** kbot-finance IS audit-grade substrate. The regulatory tailwind is the buying signal the package was built for. Today kbot-finance is positioned for "tier-2 banks and family offices"; the federal-channel tailwind opens "government contractors and federal AI deployers" as adjacent buyers.

**Concrete next step:** update the kbot-finance README and ROLE.md to explicitly cite the federal posture as part of the buyer landscape. Add a "Federal alignment" section that maps the audit-log primitive to NIST AI RMF + DoD AI guidance categories. ~2 hours.

---

## What AI (the field) wants from kbot and similar substrates

Demand signals visible across this week's news. These are external pulls, not internal pushes.

### A. Audit-ready substrate for agentic AI in production

**Source signal:** White House EO + NIST + DoD + OWASP + federal AI policy commentary all converging on "agentic AI must be auditable as a compliance requirement, not a research aspiration." Enterprise adopters under regulatory scrutiny need to prove what their agents did and have the proof structurally available, not after-the-fact reconstructable.

**What kbot's stack already supplies:** content-addressed envelopes, hash-chained audit log, jurisdiction-aware regulatory verifier (kbot-finance). Provenance engineering as a discipline. The fit is direct.

**The gap:** kbot's audit substrate is technically sound but not packaged for federal procurement. A "Federal posture" document, ATO-readiness checklist, FedRAMP mapping, and SOC 2-style audit trail export would meet the demand where it lives.

### B. Multi-agent orchestration with bounded delegation and human approval gates

**Source signal:** Google's "AI agents that operate 24/7 in background" announcement at I/O implies multi-agent coordination at consumer scale. Standard Chartered + Meta moves imply agent-driven labor automation at enterprise scale. Both need bounded-delegation patterns (agent A delegates to agent B with scoped authority; humans approve at material gates) — otherwise the failure modes are catastrophic.

**What kbot's stack already supplies:** `@kernel.chat/kbot-orchestrator` v0.2 ships the outreach + explore pipelines with explicit human-approval gates. Orchestration engineering as a coined discipline ([ROLE.md](../packages/kbot-orchestrator/ROLE.md)).

**The gap:** the orchestrator doesn't yet have full multi-agent delegation primitives — v0.2 is single-pipeline. The v0.3 roadmap adds multi-agent handoff with the agent-fidelity classifier inline. This is the right next ship.

### C. Content provenance on AI-generated artifacts

**Source signal:** C2PA embedded in Gemini today; TikTok and other major platforms have similar disclosure rules incoming; EU AI Act requires consumer-facing AI-content labeling. Across the field, "prove what was AI-generated" is moving from optional to mandatory.

**What kbot's stack supplies:** nothing yet — this is the #1 gap above.

**The gap:** kbot should emit C2PA manifests on every artifact it produces. The substrate primitive is mature; the work is wiring it into kbot's artifact generation paths.

### D. Operator-vs-third-party harm distinction in BYOK agent products

**Source signal:** Agent fidelity engineering (named in ISSUE 389) is downstream of a real demand: enterprise + government buyers need locally-controlled agents that surpass cloud-agent operator-policy refusals AND refuse third-party-harm actions. The OWASP framework partly codifies this; federal guidance increasingly demands it.

**What kbot's stack supplies:** the discipline is named; the substrate primitives (refusal predicates, two-kind classifier, attestation discipline) are roadmap for kbot-orchestrator v0.3.

**The gap:** the v0.3 primitives need to ship. Until they do, kbot is operating-as-Isaac but doesn't have the explicit boundary mechanism for "kbot CAN'T do this even if Isaac authorizes" (the third-party-harm refusal class). The current implicit boundary is the agent + operator both refusing manually; the v0.3 ship would encode it.

### E. Discipline-naming as a public service

**Source signal:** OWASP Top 10 for Agentic Apps is a peer-reviewed framework — exactly the kind of canonical framing the field is hungry for. Federal guidance documents are reaching for similar canonical naming. Tim O'Reilly's engagement with provenance engineering confirms the appetite at the senior thinker level.

**What kernel.chat already supplies:** four coined disciplines (provenance engineering, agent-OS, orchestration engineering, agent fidelity engineering) with ROLE.md definitions under CC BY 4.0, plus the field map at `docs/agentic-engineering.md` and a magazine arc (16 issues from 375 through 390 covering the discipline-formation period).

**The gap:** awareness. The discipline-naming work is real but reach is small. The 24+ outreach emails fired this week represent the deliberate distribution push. Whether it lands materially over the next 30 days will determine whether the discipline names enter circulation or remain a phrase one magazine used in 2026.

---

## Priorities for the next 4 weeks (recommendation)

Sequenced by leverage and dependency:

1. **Ship kbot-orchestrator v0.3** — multi-agent delegation primitives + agent fidelity classifier inline. Closes gap (B), ships discipline (D), and is the natural next package version. **2-3 weeks.**

2. **Self-audit kbot against OWASP Top 10 Agentic Applications** — publish as `docs/owasp-agentic-self-audit.md`, CC BY 4.0. Meets gap (2) above and is a fast credibility artifact. **1 weekend.**

3. **Add C2PA emission to kbot artifact paths** — v0.1 of the provenance manifest feature. Closes gap (1) and (C). **2 weeks.**

4. **Federal-alignment posture document** for kbot-finance — maps audit primitives to NIST AI RMF + DoD AI categories. Opens gap (A)'s buyer surface. **4-8 hours.**

5. **Continue the discipline-naming arc** — magazine cadence (1-2 issues per week), targeted outreach to one new discipline-namer per week, watch for replies to the existing 24+ thread. **Background, ongoing.**

---

*This document captures the May 2026 signal interpretation. It's a working note, not a roadmap commitment. Update it weekly as the field moves.*
