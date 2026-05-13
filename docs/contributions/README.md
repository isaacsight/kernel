# Contribute by Engineering Role

> AI engineering is the forefront of the field as of May 2026. Every
> other engineering discipline is now being asked to serve, integrate
> with, or audit AI systems. This catalog centers AI engineering and
> arranges the adjacent disciplines around it.
>
> Fifty-six concrete, finishable projects across the kernel.chat
> ecosystem — `@kernel.chat/kbot`, `@kernel.chat/kbot-finance`, and
> the `kernel.chat` editorial site. Each project has a deliverable,
> a skill list, an effort estimate, and a clear connection to the
> existing substrate.
>
> Pick a role. Read its project. Open a PR.
>
> Licensed CC BY 4.0 — forkable into any other open-source
> ecosystem's contribution catalog.

---

## How this catalog is organized

**Part I — AI Engineering (the forefront).** The disciplines at the
forefront of the field in 2026. Includes the canonical ML roles, the
new agent/context/eval roles that emerged with the agentic shift,
and the regulated-industry roles (provenance, AI compliance, AI app
sec) that the next 18 months of enforcement will define.

**Part II — Substrate Engineering (what's underneath the AI).** The
distributed systems, cryptography, hardware, database, performance,
and observability work that makes AI infrastructure trustworthy. The
substrate kbot-finance depends on; the same substrate every
serious AI-infra company depends on.

**Part III — Application Layer (where AI lands).** Frontend,
backend, mobile, audio, graphics, game, AR/VR — the surfaces users
encounter AI through.

**Part IV — Quality + Operations (keeping AI systems honest).**
SRE, DevOps, platform, network, test, accessibility, i18n,
release engineering, documentation — the discipline that makes AI
systems survive contact with reality.

**Part V — Domain-Specialized (AI for specific industries).**
Quantitative finance, regulatory, blockchain, robotics, biomedical,
embedded, firmware, compiler — the verticals where AI is being
deployed under real constraints.

**Part VI — Bridge Roles (compounding the field).** Solutions
engineers, DevRel, analytics engineers — the roles that translate
between the substrate and the people who need it.

Total: 56 engineering disciplines, each with a concrete project.

---

## What "concrete project" means

Every entry below names:

- **The role.** What this discipline does.
- **The project.** A real, finishable contribution to one of the three
  surfaces — not a hypothetical exercise.
- **Deliverables.** Specific artefacts that constitute "done."
- **Skills demonstrated.** What you'd put on a portfolio after shipping.
- **Difficulty.** Junior / Mid / Senior / Staff.
- **kbot-finance / kbot / kernel.chat connection.** Why this matters
  for the ecosystem.
- **Estimated effort.** Hours or days, assuming part-time work.

If you ship one of these, **open a PR**. If you want to claim one
before you start, **open an issue** with the project title and
"claiming" in the body — the maintainer will tag it `claimed: <handle>`
so it's not double-worked.

---

# Part I — AI Engineering (the forefront)

The fifteen roles at the forefront of the field as of May 2026.

### 1. Agent Engineer

**What they do:** Build agentic systems — tool use, planning, multi-step workflows, memory.

**The project:** Extend kbot's coordinator with a goal-decomposition planner that breaks complex user requests into ordered tool sequences, validates each step through the kbot-finance verifier before execution, and writes the plan + execution trace as content-addressed envelopes to the audit log. Replaces the current "single tool call per turn" pattern.

**Deliverables:**
- `packages/kbot/src/agent/planner.ts` with a typed plan IR and step-validation hooks
- Verifier-aware execution loop that aborts on adverse-action codes
- Eval suite covering 20 multi-step scenarios with golden plans

**Skills demonstrated:** Agentic frameworks, MCP tool schemas, planning algorithms (HTN, ReAct, Reflexion), execution-trace design, regression-eval discipline

**Difficulty:** Senior

**Connection:** The agentic shift is the defining engineering frontier of 2026; today kbot is single-step-shaped; this brings it onto the modern agent track.

**Estimated effort:** 10-14 days part-time

---

### 2. Foundation Model Engineer

**What they do:** Build, fine-tune, and ship the large models other engineers build on top of.

**The project:** Train a 7B-parameter domain model on kernel.chat's 381-issue editorial corpus + kbot-finance documentation + the provenance engineering literature (FINOS AIGF, EU AI Act, SR 26-02). Publish as `kernel-chat-provenance-7b` on Hugging Face, MIT license. Ship Ollama integration as a kbot skill so any user can run `kbot ask --model kernel-chat-provenance-7b "what does Annex IV §3 require?"` locally.

**Deliverables:**
- Training-data prep pipeline with provenance hashes per source document
- Fine-tuned model checkpoint on Hugging Face with model card, eval results, and intended-use disclosures
- Ollama Modelfile + a kbot skill at `packages/kbot/src/skills/local-provenance.ts`

**Skills demonstrated:** LoRA / QLoRA fine-tuning, distributed training, corpus curation, leakage prevention, evaluation harnesses, model cards, Hugging Face Hub workflow

**Difficulty:** Staff

**Connection:** A domain-specialist model trained on the provenance corpus makes the discipline learnable locally — the same way Stable Diffusion made image-gen democratized in 2022.

**Estimated effort:** 3-4 weeks

---

### 3. Context Engineer

**What they do:** Design how models consume context — retrieval, chunking, prompt assembly, context-budget management.

**The project:** Build a context-engineering layer for kbot that decides, per-tool-call, which memories, citations, and recent audit-log entries to surface. Tracks token budget explicitly; emits a provenance tag for every chunk included; supports content-addressed retrieval so the same context produces the same prompt across machines and across time.

**Deliverables:**
- `packages/kbot/src/context/builder.ts` with budget tracking and chunk-provenance tagging
- Retrieval-strategy pluggable interface (similarity, recency, importance-weighted)
- Eval comparing context-engineered prompts vs. naive concatenation on 50 representative kbot queries

**Skills demonstrated:** RAG architecture, embedding retrieval, context-budget management, provenance tagging, A/B evaluation, attention-cost reasoning

**Difficulty:** Senior

**Connection:** Context engineering became a named discipline in 2025-26; kbot ships sophisticated tool-use but its context-assembly layer is currently naive concatenation.

**Estimated effort:** 8-10 days part-time

---

### 4. Eval Engineer

**What they do:** Build the evaluation harnesses that catch regression and prove progress.

**The project:** Extend kbot-finance with an eval harness comparing the deterministic verifier's verdicts against an LLM-judge baseline on synthetic regulatory scenarios. The LLM-judge is treated as untrusted — its verdicts are compared against the rules-as-code ground truth, and disagreements get flagged as either (a) bugs in the rules, (b) edge cases the LLM mishandled, or (c) genuine ambiguity worth a human review.

**Deliverables:**
- `evals/regulatory-scenarios/` with ~500 synthetic cases covering EU AI Act Annex IV, SR 26-02, MiFID II RTS 6
- LLM-judge comparison harness with per-rule precision/recall + a confusion matrix between deterministic and judge verdicts
- CI gate that blocks merges when LLM-judge agreement drops below a threshold (signals rule-pack or model drift)

**Skills demonstrated:** Eval design, LLM-judge methodology, synthetic data generation, confusion-matrix analysis, regression CI, regulatory case construction

**Difficulty:** Senior

**Connection:** The verifier is kbot-finance's trust surface; without a regression harness, every model or rule update is a leap of faith.

**Estimated effort:** 8-12 days part-time

---

### 5. AI Safety / Alignment Engineer

**What they do:** Build the evals, red-teams, and refusal infrastructure that catches model failures before users do.

**The project:** Build a regression eval suite for the kbot-finance verifier covering four categories: known-refusal cases (must flag), known-approval cases (must pass), adversarial paraphrases (must reach same verdict as canonical form), and jurisdictional edge cases (must cite correct rule version). Suite runs in CI; failed eval blocks merge.

**Deliverables:**
- `evals/verifier/` with ~200 cases across the four categories, each with provenance and rationale
- CI job that runs the suite on every PR touching `verifier/` or model versions, with diff-friendly output
- Public dashboard (static HTML) showing pass rate per category over time

**Skills demonstrated:** Eval design, adversarial testing, regression infrastructure, regulatory case analysis, CI integration, drift detection

**Difficulty:** Senior

**Connection:** Pairs with the learned classifier (entry 11 below) by gating its rollout behind real numbers.

**Estimated effort:** 8-12 days part-time

---

### 6. AI Application Security Engineer

**What they do:** Harden AI systems against prompt injection, model exfiltration, adversarial inputs, audit-log poisoning.

**The project:** Build a red-team harness against kbot's tool-call surface. Automated prompt-injection attempts (via document content, tool outputs, multi-turn manipulation), sandbox-escape tests, audit-log-poisoning attempts (does an attacker who can influence prompts also influence audit entries?). Ship findings as a public security advisory in the style of OpenAI's red-team reports.

**Deliverables:**
- `packages/kbot/src/redteam/` with categorized attack patterns (LLM01-LLM10 OWASP plus custom)
- Test runner that produces a markdown advisory with verified vulnerabilities + severity per OWASP scoring
- Hardening PRs that close the verified findings

**Skills demonstrated:** AI red-teaming, prompt injection patterns (direct, indirect, multi-step), OWASP LLM Top 10, sandbox-escape analysis, responsible disclosure

**Difficulty:** Senior

**Connection:** Every AI agent shipping in 2026 needs this; the discipline barely existed in 2023. Real demand for substrate-deep security engineers.

**Estimated effort:** 10-14 days part-time

---

### 7. Machine Learning Engineer

**What they do:** Ship trained models into production with the glue, evals, and rollback paths they need.

**The project:** Train a learned classifier for adverse-action codes (ECOA Reg B Appendix C reason codes) and wire it into kbot-finance as a pre-filter that runs before the deterministic verifier. The model returns a ranked list of likely codes with calibrated confidence; the deterministic verifier still has final say, but the classifier surfaces likely refusals earlier and logs disagreement cases as training data.

**Deliverables:**
- Labeled training set (~2-5k examples) from public CFPB complaint narratives + synthetic augmentation, with provenance hashes
- Model card documenting training data, calibration plot, per-code precision/recall, known failure modes
- `verifier.preClassify()` integration with feature flag, plus a disagreement log written back to the audit chain

**Skills demonstrated:** Text classification, calibration, model cards, feature flags, eval harnesses, regulatory domain modeling

**Difficulty:** Senior

**Connection:** Gives the rules-as-code verifier a learned front end without replacing it. Exactly the "AI proposes; deterministic engine vetoes" pattern from ISSUE 381.

**Estimated effort:** 10-14 days

---

### 8. ML Research Engineer

**What they do:** Run experiments end-to-end against benchmarks to characterize what a system can and cannot do.

**The project:** Build a kbot-finance forecasting agent that runs against PolyBench and Prophet Arena, with full per-question traces stored as audit envelopes. The deliverable isn't a SOTA score; it's a reproducible harness, a written analysis of where the agent fails, and a baseline number the next contributor can beat.

**Deliverables:**
- `bench/` runner that executes PolyBench + Prophet Arena questions and writes each trace (prompt, tools called, intermediate beliefs, final probability) as an envelope
- Baseline results table + calibration plot (Brier score, log loss, reliability diagram)
- Failure-mode write-up: which question types the agent overconfidences on, where it abstains, where retrieval helped vs. hurt

**Skills demonstrated:** Benchmark harnesses, calibration metrics, agent tracing, ablation design, failure analysis, reproducibility

**Difficulty:** Senior

**Connection:** Extends the Polymarket adapter into an actual forecasting agent and produces the first public number for the kbot-finance forecasting track.

**Estimated effort:** 8-12 days

---

### 9. MLOps / ML Infrastructure Engineer

**What they do:** Build the rails models run on — lineage, registries, rollback, drift detection.

**The project:** Build a model-lineage view over the kbot-finance audit log. Every model invocation already writes an envelope; the view stitches them into per-model timelines showing input distribution, verdict distribution, drift signals, and version transitions. Ships as a CLI (`kbot-finance lineage <model-id>`) plus a static HTML report generator that runs in CI.

**Deliverables:**
- `lineage/` package that reads the audit log and emits per-model timelines
- CLI command + HTML report template (no JS framework — static, deterministic, diff-able)
- Drift detector that flags KL divergence over a sliding window between input distributions

**Skills demonstrated:** Observability design, audit-log querying, drift detection, CLI ergonomics, deterministic report generation, lineage modeling

**Difficulty:** Senior

**Connection:** Turns the existing audit log into a lineage substrate without adding a new datastore.

**Estimated effort:** 7-10 days

---

### 10. NLP Engineer

**What they do:** Build language models and pipelines tuned to a specific domain's voice and structure.

**The project:** Fine-tune a small open-weights model (Qwen 2.5 7B or Llama 3.1 8B, LoRA) on the 381 published kernel.chat issues to produce an ISSUE-scaffolding assistant. It doesn't write the issue — it suggests folio structure, monument candidates, and dateline framing in the magazine's vocabulary, given a topic seed. Runs locally via Ollama, ships as a kbot skill.

**Deliverables:**
- Training corpus prep script (issue → structured `{folio, monuments, dateline, colophon}` pairs) with leakage checks
- LoRA adapter published to Hugging Face under the kernel.chat org, MIT
- `kbot issue-scaffold` skill with eval set of 20 held-out issues and a rubric-based scoring script

**Skills demonstrated:** LoRA fine-tuning, corpus curation, evaluation rubrics, leakage prevention, local inference (Ollama/MLX), domain-voice modeling

**Difficulty:** Senior

**Connection:** Uses the magazine's accumulated editorial corpus as training data for a tool that helps draft the next issue, local-first per the BYOK contract.

**Estimated effort:** 10-15 days

---

### 11. Computer Vision Engineer

**What they do:** Build models that read structure out of pixels.

**The project:** Add a regulatory-document layout parser to kbot-finance that ingests scanned 10-Ks, adverse-action letters, and disclosure PDFs, segments them into typed regions (header, table, signature block, footnote), and emits each region as its own content-addressed envelope. Uses an existing layout model (LayoutLMv3 or Surya) rather than training from scratch; the contribution is the integration, the eval set, and the envelope schema.

**Deliverables:**
- `packages/kbot-finance/src/vision/` with the layout pipeline + envelope writer
- Annotated eval set of 50 public regulatory documents with region-level ground truth
- Precision/recall numbers per region type, plus a failure gallery of the worst 10 misparses

**Skills demonstrated:** Document layout analysis, OCR integration, annotation workflows, eval set construction, error analysis, schema design

**Difficulty:** Mid

**Connection:** Lets the verifier reason over scanned source documents, not just text — a prerequisite for the regulated-industries use case where the original artifact is a PDF.

**Estimated effort:** 8-10 days

---

### 12. Reinforcement Learning Engineer

**What they do:** Train policies that improve through interaction with a reward signal.

**The project:** Extend kbot's dream engine with a lightweight bandit that learns, per-skill, which memory-consolidation strategy (summarize, embed-and-discard, full-retain, link-to-prior) yields the highest downstream recall accuracy on the next session's queries. The bandit is contextual (features: skill id, session length, query-type distribution) and runs locally against Ollama; rewards come from held-out recall probes.

**Deliverables:**
- `dream/bandit.ts` with a contextual Thompson-sampling implementation
- Offline replay harness over recorded dream-engine sessions to validate before going live
- Ablation comparing learned policy vs. current fixed strategy on a recall benchmark

**Skills demonstrated:** Contextual bandits, offline policy evaluation, reward shaping, local-first ML, ablation design, recall benchmarking

**Difficulty:** Senior

**Connection:** The dream engine is the obvious RL surface in kbot, and consolidation strategy is the right granularity for a first learned policy.

**Estimated effort:** 12-15 days

---

### 13. Knowledge Graph / RAG Engineer

**What they do:** Model entities, relations, and provenance so downstream systems can reason over connected facts, not loose strings.

**The project:** Convert kbot's existing flat vector store into a content-addressed knowledge graph where each chunk carries a provenance hash, a typed entity set (issuer, instrument, jurisdiction, rule citation), and edges to other chunks via shared entities. Backed by SQLite + a small entity-linker; preserves the existing vector-search API so nothing downstream breaks.

**Deliverables:**
- Schema migration that adds entity tables + edge tables alongside the existing vector index
- Entity-linker pass (spaCy or GLiNER) with a 100-document eval set and linking accuracy numbers
- `kbot graph query` CLI that does hop-limited traversal ("show me all chunks citing 12 CFR 1002.9 within 2 hops of envelope X")

**Skills demonstrated:** Graph schema design, entity linking, provenance modeling, SQLite/FTS5, hybrid vector+graph retrieval, migration design

**Difficulty:** Senior

**Connection:** Turns the existing vector store into the substrate the verifier and forecasting agent both need when they have to cite which chunk, from which document, under which jurisdiction, supported a decision.

**Estimated effort:** 12-18 days

---

### 14. Multimodal Engineer

**What they do:** Build systems that process text + images + audio + video in unified pipelines.

**The project:** Extend the regulatory-document layout parser (entry 11) to handle the audio/video evidence that some regulators accept — compliance training recordings, customer-interaction transcripts, deposition video. Each modality gets its own content-addressed envelope; the envelopes link via shared entity IDs so a regulator can ask "show me the audit chain for this customer's complaint" and get text + transcript + video frames + relevant filings, all replayable.

**Deliverables:**
- `packages/kbot-finance/src/multimodal/` with audio (Whisper), video (frame-sample + OCR), and image adapters
- Cross-modal entity linker that joins evidence across modalities
- Eval set of 25 multimodal regulatory scenarios with cross-modal ground truth

**Skills demonstrated:** Multimodal models, Whisper / audio transcription, video frame sampling, cross-modal retrieval, ffmpeg, schema design

**Difficulty:** Senior

**Connection:** Multimodal is the 2026-27 frontier; this brings kbot-finance into that frontier without losing audit-grade discipline.

**Estimated effort:** 14-18 days

---

### 15. Provenance Engineer

**What they do:** Build infrastructure that makes every AI decision reconstructable bit-for-bit, indefinitely.

**The project:** Add a QuantLib pricing adapter to `packages/kbot-finance/src/adapters/` that wraps QuantLib's option-pricing routines and substitutes CRlibm for the standard libm, producing bit-deterministic Black-Scholes and binomial-tree outputs across Linux/macOS/x86/ARM. The adapter records every input, every intermediate floating-point operation's rounding mode, and a content-addressed hash of the QuantLib commit + CRlibm version into the existing provenance ledger.

**Deliverables:**
- `src/adapters/quantlib/` with deterministic option-pricing wrapper and CRlibm linkage
- Cross-platform reproducibility test suite proving identical 64-bit outputs on three architectures
- ADR documenting why CRlibm was chosen over MPFR/libmcr and the rounding-mode policy

**Skills demonstrated:** IEEE 754 floating-point semantics, C++/Node FFI, QuantLib internals, reproducible builds, deterministic numerics, content-addressed storage

**Difficulty:** Senior

**Connection:** Delivers the QuantLib milestone named in HIRING.md's 90-day plan and gives the verifier its first non-trivial pricing surface.

**Estimated effort:** 12-15 days

---

# Part II — Substrate Engineering (what's underneath the AI)

The ten roles that build the infrastructure AI systems actually run on.

### 16. Distributed Systems Engineer

**What they do:** Make multiple machines agree on what happened and in what order.

**The project:** Add a multi-writer mode to the kbot-finance audit log using a single-leader replication protocol with leases. Writers acquire a lease from a coordinator (Postgres advisory lock or etcd), append to their local chain segment, and a stitcher process merges segments into the canonical chain on lease expiry. Includes a deterministic merge algorithm, a Jepsen-style test harness that injects network partitions, and a written analysis of which CAP corner the system sits in.

**Deliverables:**
- `src/replication/` module with leader election, segment append, and stitcher
- Test harness at `tests/replication/partition-suite.ts` using `toxiproxy` for fault injection
- `docs/replication-model.md` documenting linearizability guarantees and known edge cases

**Skills demonstrated:** Leader election, lease-based concurrency, fault injection testing, consistency model reasoning, conflict resolution

**Difficulty:** Staff

**Connection:** Today's audit log is single-writer; this is the prerequisite to running kbot-finance behind a load balancer with more than one MCP server replica.

**Estimated effort:** 8-10 days

---

### 17. Cryptography Engineer

**What they do:** Design and implement cryptographic protocols with provable properties.

**The project:** Upgrade kbot-finance's HMAC-signed approval tokens to Ed25519 per the v0.2 spec roadmap, with key rotation, deterministic nonces, and a backwards-compatible verifier. Optional stretch: prototype a Groth16 zk-SNARK circuit that proves "this decision was produced by Rule v_n applied to inputs whose hash is H" without revealing the inputs — regulators verify compliance without seeing client PII.

**Deliverables:**
- `packages/kbot-finance/src/crypto/ed25519.ts` with key-rotation primitives and test vectors against RFC 8032
- Migration PR with dual-verify mode and deprecation calendar
- Optional: `circuits/decision-attestation.circom` + snarkjs verifier with worked regulator-side example

**Skills demonstrated:** Ed25519, key management, RFC implementation, zero-knowledge circuits, Circom, backwards-compatible protocol migration

**Difficulty:** Staff (with SNARK); Senior without

**Connection:** Executes the v0.2 spec roadmap; the SNARK piece unlocks regulated-industry adoption.

**Estimated effort:** 5 days for Ed25519; +2 weeks for SNARK prototype

---

### 18. Database Engineer

**What they do:** Design schemas and access patterns that hold up under audit and load.

**The project:** Migrate the kbot-finance audit log's chain-head storage from a flat JSON file to Postgres with a schema that enforces append-only semantics at the database level. Use a `BEFORE UPDATE/DELETE` trigger that raises `unconditional_violation`, a generated column for the predecessor hash, and a `pg_cron` job that runs a chain-integrity check every 15 minutes.

**Deliverables:**
- Migration files using `node-pg-migrate` or Supabase-compatible SQL
- `chain_integrity_check()` function with EXPLAIN ANALYZE documented in the migration comment
- Postgres adapter at `src/storage/postgres.ts` with conformance tests against the existing `AuditStorage` interface

**Skills demonstrated:** Postgres triggers, generated columns, pg_cron, append-only schema design, migration authoring, EXPLAIN analysis

**Difficulty:** Mid

**Connection:** Supabase is already in the kernel.chat stack; this lets kbot-finance reuse the operator's existing Postgres skills.

**Estimated effort:** 3 days

---

### 19. Cloud / Infrastructure Engineer

**What they do:** Own the substrate everything else sits on.

**The project:** Introduce an `infra/` directory in kbot-finance with Pulumi (TypeScript) stacks that provision the full audit-log substrate: S3 bucket, a DynamoDB table for chain-head pointers with conditional-write locking, a KMS key with a key policy that denies `kms:ScheduleKeyDeletion`, and a least-privilege IAM role the MCP server assumes via OIDC from GitHub Actions.

**Deliverables:**
- `infra/pulumi/audit-substrate/` stack with dev/staging/prod stack files
- IAM role with OIDC trust policy and documented permission boundary
- Drift-detection workflow that runs `pulumi preview` nightly and posts diffs to a `#infra-drift` Discord webhook

**Skills demonstrated:** Pulumi, AWS KMS key policies, DynamoDB conditional writes, OIDC federation, least-privilege IAM, drift detection

**Difficulty:** Senior

**Connection:** Pairs with the DevOps S3 Object Lock work; together they make the audit log's persistence story defensible to a regulator.

**Estimated effort:** 5-6 days

---

### 20. Performance Engineer

**What they do:** Measure where time goes and reclaim it where the budget says.

**The project:** Bring the kernel.chat magazine bundle back under its stated budgets (300KB JS gzip, 150KB CSS gzip) by adding a CI check that fails the build on budget regression and lands a route-level code-split for `EnginePage.tsx`. Includes regression report tooling at `scripts/perf/bundle-report.ts` that posts a sized diff as a PR comment.

**Deliverables:**
- `scripts/perf/check-bundle-budgets.ts` invoked from `.github/workflows/deploy-magazine.yml`
- Route-level dynamic import for `EnginePage` and sibling heavy routes, with measured before/after numbers
- PR-comment bot that posts gzipped-size diffs per chunk

**Skills demonstrated:** Vite bundle analysis, code splitting, CI gate authoring, gzip/brotli size accounting, regression budgeting

**Difficulty:** Mid

**Connection:** Budgets are written in MEMORY.md but nothing enforces them.

**Estimated effort:** 2 days

---

### 21. Hardware Engineer

**What they do:** Spec, design, and validate physical computing systems.

**The project:** Spec a deterministic-inference appliance for kbot-finance: a pinned-architecture box (specific CPU stepping, ECC RAM, CRlibm-built libm, integer-only quantized inference path) where the same prompt and same weights produce bit-identical outputs across machines and across years.

**Deliverables:**
- Hardware spec document in `packages/kbot-finance/docs/deterministic-appliance.md`
- Reproducibility test harness that runs the same prompt 10,000× and asserts bit-identical outputs
- BOM with two price points (workstation and 1U rack) and thermal/acoustic envelope

**Skills demonstrated:** CPU microarchitecture, ECC and memory ordering, correctly-rounded math libraries, integer quantization, reproducibility methodology

**Difficulty:** Staff

**Connection:** kbot-finance's value proposition is audit-grade determinism; today that's software-enforced; regulators asking "could this same decision be re-derived in five years" need the hardware story.

**Estimated effort:** 3-4 weeks for spec + harness

---

### 22. Streaming / Real-time Engineer

**What they do:** Move audit events from agent to ledger with bounded latency and zero loss.

**The project:** Replace the current synchronous audit-write path with a NATS JetStream (or Redpanda) pipeline, providing at-least-once delivery, per-stream retention policies aligned to regulatory holds (7y / 11y), and a back-pressure-aware client that degrades to local WAL on broker outage. Ships a chaos-test harness that kills the broker mid-write and proves no event is lost.

**Deliverables:**
- Transport module with JetStream producer/consumer and local WAL fallback
- Retention-policy config keyed to regulatory hold classes
- Chaos-test suite (toxiproxy) with documented failure modes and recovery times

**Skills demonstrated:** JetStream semantics, exactly-once vs at-least-once tradeoffs, WAL design, chaos testing, regulatory-retention mapping, observability

**Difficulty:** Senior

**Connection:** Hardens the write path everything else in kbot-finance depends on; precondition for multi-tenant deployments.

**Estimated effort:** 12-15 days

---

### 23. Search Engineer

**What they do:** Make a large, append-only corpus answer questions in sub-second time without compromising provenance.

**The project:** Add a Tantivy-backed (or SQLite FTS5 + bm25s) search layer over the kbot-finance audit log, with a query API that returns results plus a verifiable extraction proof (offset, source block hash, and Merkle path to the anchored root). Includes a CLI `kbot-finance grep --since <ts> --rule <id>` with structured output.

**Deliverables:**
- Indexer daemon with incremental ingestion and crash-safe checkpoints
- Query API returning hits + extraction-proof envelopes
- Benchmark report on a 100M-event synthetic corpus

**Skills demonstrated:** Inverted indices, FTS5 or Tantivy internals, BM25 tuning, incremental indexing, proof-carrying query results, latency benchmarking

**Difficulty:** Senior

**Connection:** The audit log is currently grep-grade; this makes the verifier usable on multi-year archives.

**Estimated effort:** 10-14 days

---

### 24. Observability Engineer

**What they do:** Make a running system legible without reading the source.

**The project:** Instrument the kbot-finance MCP server with OpenTelemetry traces, structured logs, and a Prometheus metrics endpoint. Each MCP tool invocation produces a span with the envelope hash as an attribute; each audit-log append emits a counter; failed regulatory-verifier checks emit a structured log event with the failing rule ID. Includes a Grafana dashboard JSON and a `docker-compose.observability.yml` for local development.

**Deliverables:**
- OTel SDK wiring at `src/observability/` with span/metric/log helpers used by the MCP handlers
- `docker-compose.observability.yml` and a `make observe` target
- `dashboards/kbot-finance-mcp.json` Grafana dashboard with panels for tool latency, audit append rate, and verifier failures

**Skills demonstrated:** OpenTelemetry SDK, Prometheus exposition format, Grafana dashboarding, structured logging, MCP protocol internals

**Difficulty:** Mid

**Connection:** The MCP server is the production surface area of kbot-finance; today it's a black box once it leaves stdio.

**Estimated effort:** 3 days

---

### 25. Edge / CDN Engineer

**What they do:** Move bytes closer to users and keep the cache honest.

**The project:** Replace the bare GitHub Pages serving of kernel.chat with a Cloudflare Worker fronting the same origin, adding per-issue cache rules keyed on the issue folio, a stale-while-revalidate policy for the issue index, and a signed-URL primitive for the colophon downloads. The Worker emits Server-Timing headers so the performance work above can measure edge vs origin latency separately.

**Deliverables:**
- `infra/cloudflare-worker/` source with route patterns, cache rules, and SWR logic
- `wrangler.toml` and a deploy job in `.github/workflows/deploy-edge.yml`
- `docs/edge-cache-contract.md` documenting what's cached, for how long, and how to invalidate per issue

**Skills demonstrated:** Cloudflare Workers, HTTP cache semantics, stale-while-revalidate, signed URLs, Server-Timing, Wrangler tooling

**Difficulty:** Mid

**Connection:** The magazine is a static site that publishes new issues on a cadence; per-issue cache invalidation is the missing primitive.

**Estimated effort:** 2-3 days

---

# Part III — Application Layer (where AI lands)

The nine roles that build the surfaces users encounter AI through.

### 26. Backend Engineer

**What they do:** Build the server-side primitives that move data between regulated systems without losing the audit trail.

**The project:** Ship the `audit-log-replay` service in kbot-finance — a read-only HTTP endpoint that accepts a hash-chain head and streams the prior N envelopes back in canonical order, verifying each link as it goes. Unblocks the regulatory verifier from needing local access to the full chain.

**Deliverables:**
- `packages/kbot-finance/src/services/replay.ts` with chain-walking and link verification
- `GET /audit/replay?from=<hash>&limit=<n>` route registered in the existing MCP server
- Vitest suite covering tampered-link detection, missing-envelope failure modes, and pagination

**Skills demonstrated:** Content-addressed storage, hash-chain verification, Node streams, HTTP API design, error taxonomy, integration testing

**Difficulty:** Mid

**Connection:** The regulatory verifier RFC names "replay" as a missing surface.

**Estimated effort:** 5-7 days

---

### 27. Frontend Engineer

**What they do:** Turn editorial intent into pages a reader can navigate.

**The project:** Ship the `/pricing` page on kernel.chat that surfaces the four-tier kbot-finance pricing model, wrapped in `MagazineFrame`, set in EB Garamond / Courier Prime, styled with the Ink Cabinet accent system. Targets the persona in `docs/persona.md` (Mira Tanaka-Ortiz, 29, Bed-Stuy) — copy answers her three questions before she has to ask them.

**Deliverables:**
- `src/pages/PricingPage.tsx` route added to `src/router.tsx`
- Tier comparison table reusing existing folio + dateline tokens (no new CSS variables)
- Vitest snapshot + a11y check via `@testing-library/react`

**Skills demonstrated:** React 19, design-token discipline, type-driven props, semantic HTML tables, persona-led copywriting

**Difficulty:** Mid

**Connection:** The kbot-finance sales doc already specifies tier names; this is the public reading surface.

**Estimated effort:** 3-4 days

---

### 28. Full-Stack Engineer

**What they do:** Carry a single feature from database row to rendered pixel.

**The project:** Build the "subscribe to an issue" flow on kernel.chat: a Supabase `issue_subscriptions` table, an edge function that records intent and dedupes, a `<SubscribeColophon />` component dropped into the back-cover spec of each issue, and a confirmation email in the existing e-ink template.

**Deliverables:**
- Supabase migration + RLS policy for `issue_subscriptions`
- `supabase/functions/subscribe-issue/index.ts` with input validation and rate limiting
- `<SubscribeColophon />` component wired into the issue back-cover layout

**Skills demonstrated:** Postgres schema design, RLS, edge functions, React forms, transactional email, end-to-end ownership

**Difficulty:** Mid

**Connection:** Fills the gap the back-cover spec leaves open.

**Estimated effort:** 4-5 days

---

### 29. Mobile Engineer (iOS)

**What they do:** Make the agent reachable from the device people carry.

**The project:** Ship a minimal SwiftUI client for kbot that talks to a local `kbot serve` instance over the existing MCP-over-HTTP transport, supports BYOK key entry in Keychain, and renders streamed responses. Read-only for v1 — no tool execution from the phone, by design.

**Deliverables:**
- `clients/ios/` directory with an Xcode project
- Keychain-backed key storage with a single settings screen
- TestFlight build instructions in the client README

**Skills demonstrated:** SwiftUI, URLSession streaming, Keychain Services, BYOK UX, MCP transport

**Difficulty:** Senior

**Connection:** kbot v5 futures plan names mobile as a deferred surface.

**Estimated effort:** 8-10 days

---

### 30. Mobile Engineer (Android)

**What they do:** Same job, different runtime.

**The project:** Ship the Android peer in Kotlin + Jetpack Compose, with EncryptedSharedPreferences for the BYOK key and Ktor for streaming HTTP. Feature-matched to the iOS v1.

**Deliverables:**
- `clients/android/` directory with a Gradle project
- Compose UI mirroring the iOS settings + chat screens
- Instrumented test covering key persistence across process death

**Skills demonstrated:** Kotlin, Jetpack Compose, Ktor streaming, EncryptedSharedPreferences, Android lifecycle, parity engineering

**Difficulty:** Senior

**Connection:** Sibling to iOS so the kbot agent has a real second device-class surface.

**Estimated effort:** 8-10 days

---

### 31. API / Developer Experience Engineer

**What they do:** Make the difference between "there is an API" and "the API is usable."

**The project:** Author the `@kernel.chat/kbot-finance-sdk` TypeScript package — a thin, fully typed client over the MCP server's HTTP surface, with discriminated-union response types, a `verifyChain()` helper, and a one-page quickstart.

**Deliverables:**
- `packages/kbot-finance-sdk/` with `package.json`, `tsconfig.json`, generated `.d.ts`
- Quickstart in the SDK README that runs end-to-end against `kbot-finance serve`
- Replacement of the README's curl examples with SDK examples

**Skills demonstrated:** TypeScript library design, discriminated unions, semver discipline, npm publishing, DX writing, schema-first APIs

**Difficulty:** Mid

**Connection:** The MCP RFC names the wire format; this is the first-party client the RFC implies.

**Estimated effort:** 4-6 days

---

### 32. Audio / DSP Engineer

**What they do:** Design and implement real-time signal-processing algorithms.

**The project:** Replace kbot's current spectral analysis in `audio_analysis` (FFT-based, naive windowing) with a constant-Q transform pipeline tuned for musical content, and add a real-time onset/transient detector that feeds the 2027 agentic synthesizer's modulation matrix.

**Deliverables:**
- `packages/kbot/src/audio/cqt.ts` with a sliding CQT and unit tests against reference MATLAB outputs
- Onset detector (spectral flux + adaptive threshold) wired into `packages/2027/` as a modulation source
- Reproducible benchmark file showing latency and CPU on a baseline machine

**Skills demonstrated:** FFT / CQT, real-time DSP, onset detection, fixed-block-size audio scheduling, VST/AU integration, performance tuning

**Difficulty:** Senior

**Connection:** kbot's Ableton OSC bridge and the 2027 synth are wired; this closes the loop so the agent can react to what it's hearing.

**Estimated effort:** 2 weeks

---

### 33. Graphics / Rendering Engineer

**What they do:** Write rendering pipelines — rasterization, shaders, GPU resource management.

**The project:** Replace the kbot streaming system's CPU-rendered pixel-art character compositor with a WebGPU pipeline that does the sprite atlas, hue-shift palette cycling, dithered backgrounds, and outline pass on the GPU at 60fps.

**Deliverables:**
- `packages/kbot/overlay/render/webgpu/` pipeline with WGSL shaders for palette LUT, ordered-dither, and 1-px outline
- Frame-time profiler harness and a before/after capture
- Fallback WebGL2 path for browsers without WebGPU

**Skills demonstrated:** WebGPU, WGSL, sprite batching, palette-based rendering, dithering algorithms, frame-budget profiling, graceful degradation

**Difficulty:** Senior

**Connection:** The streaming system ships pixel art; this is the rendering substrate it should be on.

**Estimated effort:** 10-14 days

---

### 34. Game Engineer

**What they do:** Build interactive simulations — game loops, AI, state synchronization, input handling.

**The project:** Extend kbot's streaming game engine with a turn-based "audit run" mode where stream viewers issue commands that get routed through a sandboxed kbot-finance instance — every viewer action becomes a Rule-checked decision, and the audit log is the game state.

**Deliverables:**
- Game-mode module with deterministic state machine
- Viewer-command parser with rate limiting and a sandboxed Rule evaluator
- Replay system that reconstructs a session from its audit log alone

**Skills demonstrated:** Game loop architecture, deterministic simulation, sandboxing untrusted input, replay/determinism, ECS or similar state model

**Difficulty:** Mid-Senior

**Connection:** Joins the streaming game engine and kbot-finance into a demo that explains the audit chain better than a README can.

**Estimated effort:** 2-3 weeks

---

# Part IV — Quality + Operations (keeping AI systems honest)

The nine roles that make AI systems survive contact with reality.

### 35. DevOps Engineer

**What they do:** Own the build, release, and deploy pipelines so shipping is a non-event.

**The project:** Wire kbot-finance's hash-chained audit log to an S3 Object Lock backend with a 10-year compliance-mode retention policy, and add a verifiable replay primitive that rehydrates the chain from object storage and checks every link.

**Deliverables:**
- S3 Object Lock adapter implementing the `AuditStorage` interface with PUT-once semantics
- Terraform module that provisions the bucket with compliance-mode retention, KMS encryption, and a deny-delete bucket policy
- `verify --from-s3` CLI that streams objects in chain order, recomputes hashes, exits non-zero on any break

**Skills demonstrated:** AWS IAM, S3 Object Lock semantics, Terraform, TypeScript, content-addressed storage, supply-chain audit thinking

**Difficulty:** Senior

**Connection:** Closes the WORM-storage gap called out in the kbot-finance README.

**Estimated effort:** 4-5 days

---

### 36. Site Reliability Engineer (SRE)

**What they do:** Define what "working" means in numbers and make the system match those numbers.

**The project:** Add canary deployment and automated rollback to the magazine-deploy workflow. Canary publishes to `canary.kernel.chat` via a separate Pages branch, runs a Playwright smoke pack against six critical paths, and only promotes to apex on green. A failed canary opens a GitHub issue with the failing trace attached.

**Deliverables:**
- New `deploy-magazine-canary.yml` workflow with promote/rollback jobs gated on smoke results
- Playwright smoke pack at `tests/smoke/magazine-critical-paths.spec.ts` with explicit SLOs
- Runbook at `docs/runbooks/magazine-rollback.md`

**Skills demonstrated:** GitHub Actions, Playwright, SLO definition, blue/green deploy patterns, incident runbook authoring

**Difficulty:** Mid

**Connection:** The magazine currently deploys straight to apex on every push; an issue going dark mid-publication is the failure mode this prevents.

**Estimated effort:** 2-3 days

---

### 37. Platform Engineer

**What they do:** Build the paved road other engineers use without thinking about it.

**The project:** Harden the GitHub Actions pipeline that mirrors `packages/kbot-finance` to the standalone repo. Replace the current sync with a reproducible mirror that preserves commit SHAs where possible, runs a license-header check, verifies the `Apache-2.0` SPDX identifier, and signs the resulting commits with a deploy key. Add a dry-run mode that surfaces drift in a PR comment before any push.

**Deliverables:**
- Updated `.github/workflows/mirror-kbot-finance.yml` with signing, SPDX verification, dry-run path
- `scripts/mirror/verify-drift.ts` that diffs the source subtree against mirrored tip
- `MIRROR.md` in standalone repo documenting the one-way contract

**Skills demonstrated:** GitHub Actions, git plumbing (subtree, signed commits), SPDX/license compliance, developer experience, supply chain

**Difficulty:** Mid

**Connection:** The mirror is the seam where the open-source distribution lives.

**Estimated effort:** 2 days

---

### 38. Network Engineer

**What they do:** Make packets arrive where they're supposed to, securely and on time.

**The project:** Put the kbot-finance MCP server behind an authenticated reverse proxy with mTLS between client and proxy, and add a connection-level audit trail that records the client certificate fingerprint into each envelope's metadata. Includes Caddy config, an `mcp-proxy/` Go service, and a certificate rotation helper.

**Deliverables:**
- `mcp-proxy/` Go service with mTLS termination, fingerprint extraction, structured request logging
- Caddyfile and `docker-compose.mtls.yml` for local development
- Certificate rotation runbook + `make rotate-certs` target

**Skills demonstrated:** mTLS, X.509 certificate handling, Caddy/reverse proxy config, Go, Unix domain sockets, certificate lifecycle

**Difficulty:** Senior

**Connection:** The MCP server today binds on stdio or unauthenticated HTTP; regulated deployments need a network-layer identity story.

**Estimated effort:** 4 days

---

### 39. Test / SDET Engineer

**What they do:** Build the safety net the release pipeline depends on.

**The project:** Stand up a Playwright E2E suite for kernel.chat that covers the three flows currently only tested by hand: ChatGPT share-link import (the fragile path called out in MEMORY.md), the new `/pricing` route, and issue subscription confirmation.

**Deliverables:**
- `tests/e2e/` directory with three spec files
- `playwright.config.ts` with Free and Pro test-account fixtures
- `.github/workflows/e2e.yml` that uploads traces on failure

**Skills demonstrated:** Playwright, test data design, flake reduction, CI orchestration, fixture isolation, regression boundary definition

**Difficulty:** Mid

**Connection:** MEMORY.md explicitly flags ChatGPT import as fragile.

**Estimated effort:** 4-5 days

---

### 40. Build / Release Engineer

**What they do:** Turn a green main branch into something a user can install.

**The project:** Wire a reproducible release pipeline for `@kernel.chat/kbot` that publishes from GitHub Actions with provenance (SLSA level 2), generates a CHANGELOG entry from conventional commits, and posts release notes to the kernel Discord via the existing `kernel_notify` webhook.

**Deliverables:**
- `.github/workflows/release-kbot.yml` with `npm publish --provenance`
- `scripts/changelog-from-commits.mjs` driven by conventional-commits parsing
- `RELEASE_PLAYBOOK.md`

**Skills demonstrated:** GitHub Actions, SLSA provenance, npm OIDC, release engineering, shell scripting, incident-driven process design

**Difficulty:** Mid

**Connection:** Closes a known operational hole — the v3.59.0 npm re-auth incident.

**Estimated effort:** 3-4 days

---

### 41. Documentation Engineer / Tech Writer

**What they do:** Make the substrate legible without diluting it.

**The project:** Write `packages/kbot-finance/docs/AUDIT_MODEL.md` — a single-page explainer of the envelope format, the hash chain, the verifier's failure modes, and the threat model it does and does not cover. Pitched at a compliance reader (Mira from the persona doc), not an ML reader.

**Deliverables:**
- `packages/kbot-finance/docs/AUDIT_MODEL.md` (~1500 words, diagrams allowed)
- Inline links from kbot-finance README and the MCP RFC
- One-paragraph entry in kernel.chat ISSUE 381 introducing the doc

**Skills demonstrated:** Technical writing for non-engineers, threat-model articulation, diagramming, cross-referencing, persona-anchored copy

**Difficulty:** Mid

**Connection:** The audit-grade promise is currently undocumented at the level a buyer would need.

**Estimated effort:** 3 days

---

### 42. Accessibility Engineer

**What they do:** Make the publication readable by people the design system was not drafted around.

**The project:** Run a WCAG 2.2 AA audit of kernel.chat's issue-reading surface, fix the contrast violations in the Ink Cabinet accent system without changing the visual identity, and add a `prefers-reduced-motion` path through the Motion-driven page transitions.

**Deliverables:**
- `docs/a11y-audit-2026-05.md` with violations, severities, and remediation
- Token-level CSS changes in `src/index.css` preserving the Rubin palette intent
- `useReducedMotion` integration across the four highest-traffic route transitions

**Skills demonstrated:** WCAG 2.2, color-contrast math, Motion (framer-motion) APIs, reduced-motion patterns, audit reporting, design-system stewardship

**Difficulty:** Senior

**Connection:** Extends the audit-trail discipline that kbot-finance lives by into the magazine surface.

**Estimated effort:** 5-6 days

---

### 43. Internationalization / Localization Engineer

**What they do:** Make sure the magazine reads in more than one language without losing typographic intent.

**The project:** Ship the Japanese (`ja`) translation for the `/pricing` page and back-cover colophon, with correct font-fallback for Japanese in the EB Garamond / Noto Serif JP stack. The POPEYE editorial neighbour is Japanese; the publication has been monolingual long enough.

**Deliverables:**
- `public/locales/ja/pricing.json` and `colophon.json`
- Font-stack update in `src/index.css` for CJK fallback that preserves the magazine grammar
- Translation-key audit log in `docs/i18n-coverage.md`

**Skills demonstrated:** i18next, CJK typography, font-fallback stacks, translation memory hygiene, glyph-coverage analysis, build-time cache invalidation

**Difficulty:** Mid

**Connection:** Honors the POPEYE lineage with a real Japanese surface rather than just citing it.

**Estimated effort:** 4-5 days

---

# Part V — Domain-Specialized (AI for specific industries)

The eight roles that bring AI into specific verticals under real constraints.

### 44. Quantitative Engineer

**What they do:** Build pricing and valuation cores the audit substrate wraps.

**The project:** Implement the v0.2 alts-NAV deterministic engine adapter — a Net Asset Value calculator for private-credit and PE fund-of-one structures that takes a portfolio snapshot, applies waterfall logic and tier-specific discount curves, and emits a NAV with a fully reconstructable derivation tree.

**Deliverables:**
- `src/engines/alts-nav/` with waterfall, discount-curve, and fee-accrual modules
- Property-based test suite (fast-check) for waterfall monotonicity and fee-cap invariants
- Reference fixture replicating a published BDC NAV to within 1bp

**Skills demonstrated:** Private-credit waterfalls, NAV mechanics, property-based testing, deterministic numerics, fixed-income discounting, fund-accounting literacy

**Difficulty:** Staff

**Connection:** The v0.2 wedge — the first vertical where kbot-finance does work a generic LLM agent cannot.

**Estimated effort:** 18-22 days

---

### 45. Compliance / Regulatory Engineer

**What they do:** Translate written regulation into executable rules.

**The project:** Add an EU AI Act Annex IV rule pack to `packages/kbot-finance/src/verifier/rules/eu-ai-act/`, encoding the technical documentation requirements (system description, risk management, data governance, accuracy/robustness logs, human oversight evidence) as TypeScript predicates over the existing audit-log schema. Each rule cites the Annex IV paragraph it implements.

**Deliverables:**
- ~30 rule modules covering Annex IV §1–§9 with paragraph-level citations
- Rule-pack manifest with version pinning against the OJEU-published Act text
- Golden-trace fixtures showing a passing run and twelve representative failure modes

**Skills demonstrated:** Statutory reading, rules-as-code, TypeScript type narrowing, schema design, regulatory-citation hygiene, conformance testing

**Difficulty:** Mid

**Connection:** Extends the verifier in the Norm AI / Hadrius idiom.

**Estimated effort:** 10-14 days

---

### 46. Blockchain / Smart Contract Engineer

**What they do:** Anchor off-chain audit artefacts to chains so timestamps and integrity are independently verifiable.

**The project:** Port the existing append-only audit log to a Merkle-anchored on-chain scheme: build a Polygon (or Base) anchoring service that batches each block's Merkle root into a minimal Solidity contract every N minutes, and add a `kbot-finance verify --on-chain <txhash>` command.

**Deliverables:**
- Solidity contract (anchor-only) plus deployment script and verified Polygonscan listing
- Anchoring daemon under `packages/kbot-finance/src/anchoring/` with backoff, gas-price ceiling, graceful chain-outage handling
- CLI verification flow with worked example in the README

**Skills demonstrated:** Solidity, Merkle trees, gas optimisation, EVM RPC reliability, deterministic serialisation, threat modelling of chain re-orgs

**Difficulty:** Senior

**Connection:** Reuses the Polymarket adapter pattern; gives the audit log a public, third-party-witnessable timestamp.

**Estimated effort:** 14-18 days

---

### 47. Robotics Engineer

**What they do:** Make a physical system answerable to the same audit substrate as a software agent.

**The project:** Add a ROS 2 bridge to kbot that subscribes to a configurable set of topics (planner outputs, actuator commands, safety stops) and emits each event into the kbot audit log with the same provenance envelope as a tool call. Ship a worked example with a TurtleBot3 in Gazebo demonstrating an audited pick-and-place.

**Deliverables:**
- `rclnodejs`-based bridge with topic/QoS allowlist and back-pressure handling
- Gazebo + TurtleBot3 example with recorded audit trace and replay script
- Threat-model note covering what the bridge does *not* claim (real-time safety, hard determinism)

**Skills demonstrated:** ROS 2 internals, DDS QoS, sim-to-record pipelines, Node–C++ interop, scoped claim-writing, telemetry plumbing

**Difficulty:** Senior

**Connection:** First non-financial regulated domain; medical robotics and defence inherit it.

**Estimated effort:** 12-16 days

---

### 48. Biomedical / Bioinformatics Engineer

**What they do:** Encode parts of FDA / IMDRF guidance that survive translation into testable rules.

**The project:** Add an FDA SaMD rule pack (`packages/kbot-finance/src/verifier/rules/fda-samd/`) covering the IMDRF risk categorisation (I–IV), the Predetermined Change Control Plan requirements, and 21 CFR Part 11 audit-trail clauses relevant to algorithmic decisions.

**Deliverables:**
- Rule modules with citations to FDA guidance document numbers and CFR paragraphs
- IMDRF risk-class classifier that reads a system manifest and outputs the applicable rule subset
- Synthetic SaMD trace (no PHI) demonstrating a Class II passing audit

**Skills demonstrated:** FDA guidance reading, IMDRF framework, 21 CFR Part 11, PCCP semantics, synthetic-data design, healthcare-claim discipline

**Difficulty:** Senior

**Connection:** Second jurisdiction-specific rule pack; establishes the pattern for sector packs beyond finance.

**Estimated effort:** 12-15 days

---

### 49. Embedded Systems Engineer

**What they do:** Build software for constrained devices where memory, power, and physical I/O matter.

**The project:** Port the kbot-finance audit-log writer to ESP32 and Raspberry Pi Zero 2 W for edge-device regulatory logging — field deployments where decisions happen offline and sync later. Includes a LoRa-backed forwarder for low-bandwidth regulated environments.

**Deliverables:**
- `packages/kbot-finance-edge/` Rust no_std crate with hash-chain writer, fitting in <128KB flash
- ESP-IDF reference build with a LoRa transport adapter (SX1276)
- Reconciliation tool that ingests a LoRa-uploaded log and merges it into the canonical chain

**Skills demonstrated:** Embedded Rust, no_std, ESP-IDF, LoRa physical layer, flash-aware storage, offline-first sync protocols

**Difficulty:** Senior

**Connection:** Extends the audit-log substrate from server-side to field deployment.

**Estimated effort:** 3 weeks

---

### 50. Firmware Engineer

**What they do:** Write the code between silicon and the operating system; bring up boards.

**The project:** Build a USB HID hardware approval token for kbot-finance — a small device (RP2040 or nRF52) that holds the Ed25519 signing key in secure flash and physically requires a button press to sign an approval. The kbot-finance CLI talks to it over WebUSB / CCID; the device never exposes the key.

**Deliverables:**
- RP2040 firmware in `firmware/kbot-finance-token/` with CMSIS-DAP debugging notes
- Host-side driver in `packages/kbot-finance/src/devices/hid-token.ts`
- Hardware bring-up doc (BOM, schematic link, flashing instructions, attack-surface notes)

**Skills demonstrated:** RP2040 / nRF52 firmware, USB HID protocol, secure flash partitioning, host-device protocol design, hardware bring-up

**Difficulty:** Senior

**Connection:** The Ed25519 migration creates the surface; this is the physical artifact that makes approval non-repudiable.

**Estimated effort:** 3-4 weeks

---

### 51. Compiler / Language Engineer

**What they do:** Design small languages, write parsers and type checkers.

**The project:** Design RuleScript — a tiny declarative DSL for compiling regulations into kbot-finance Rules. Write the lexer, parser, type checker, and a lowering pass that emits the existing `Rule` TypeScript AST that the verifier consumes.

**Deliverables:**
- Grammar (EBNF) + parser in `packages/kbot-finance/rulescript/`
- Type checker with helpful diagnostics (span-based, Rust-style)
- Three worked example rule files (SOX 302, KYC threshold check, GDPR data-minimization)

**Skills demonstrated:** Grammar design, parser combinators or hand-written recursive descent, type systems, AST lowering, diagnostic UX, CLI ergonomics

**Difficulty:** Senior

**Connection:** Today Rules are TypeScript objects; compliance officers can't read those. RuleScript is the human-author surface.

**Estimated effort:** 8-12 days

---

### 52. AR/VR Engineer

**What they do:** Build spatial interfaces.

**The project:** Build a WebXR audit-trail visualizer for kbot-finance: the hash-chain rendered as a spatial DAG you can walk through, with each node showing the Rule that fired, inputs (hashed), and decision. Designed for compliance review sessions where two regulators and an engineer inspect a chain together in a shared Quest 3 / Vision Pro session.

**Deliverables:**
- WebXR app in `packages/kbot-finance-xr/` with hand-tracked node selection
- Shared-session sync over WebRTC with the audit log as source of truth
- Performance budget doc showing chain sizes that hold 90fps on Quest 3

**Skills demonstrated:** WebXR, three.js / Babylon, hand tracking, spatial UI, WebRTC sync, graph layout in 3D, perf budgeting on standalone HMDs

**Difficulty:** Senior

**Connection:** The audit chain is a DAG; making it spatial is a real review affordance.

**Estimated effort:** 3-4 weeks

---

# Part VI — Bridge Roles (compounding the field)

The four roles that translate between substrate and the people who need it.

### 53. Application Security Engineer

**What they do:** Audit code for vulnerabilities, threat-model untrusted inputs.

**The project:** Run a real audit of kbot-finance's content-addressing primitives — the SHA-256 hashing path that produces audit-log fingerprints — and the HMAC approval-token verifier. Land a PR that fixes any length-extension, timing, or canonicalization issues found, and adds a property-based test suite that fuzzes the hash boundary.

**Deliverables:**
- Threat model document in `packages/kbot-finance/docs/threat-model.md`
- PR with hardened canonicalization + constant-time comparisons + a `fast-check` property suite
- Public audit report in the style of the v4.0 cut audit trail

**Skills demonstrated:** Threat modeling, cryptographic primitive review, property-based testing, timing-attack analysis, secure-by-default API design

**Difficulty:** Senior

**Connection:** Load-bearing piece before regulators trust the chain.

**Estimated effort:** 4-6 days

---

### 54. Analytics Engineer

**What they do:** Turn raw event data into modeled tables and metrics other engineers trust.

**The project:** Build a dbt-style modeled layer over the kbot-finance audit log (DuckDB-backed) that exposes `fct_verifier_runs`, `fct_envelope_emissions`, and `dim_rule_versions`. Models live in-repo, run on CI against a sample log, and publish a static metrics catalog.

**Deliverables:**
- `analytics/models/` directory with SQL models + tests
- `make analytics` target that materializes models against a fixture audit log
- Static `METRICS.md` generated from model docs

**Skills demonstrated:** Dimensional modeling, dbt or SQLMesh, DuckDB, data testing, metrics documentation, CI integration

**Difficulty:** Mid

**Connection:** The hash-chained audit log is append-only event data; without a modeled layer, every consumer rewrites joins.

**Estimated effort:** 5-7 days

---

### 55. Solutions / Forward-Deployed Engineer

**What they do:** Compress the gap between "open-source package exists" and "a real firm is running it in production."

**The project:** Build a turnkey "kbot-finance for a tier-2 RIA" deployment template at `templates/tier2-ria/`: a Replit-runnable scaffold that provisions a Supabase project (audit log + RLS policies), wires an S3 Object Lock bucket in compliance mode, configures the verifier with the SEC Marketing Rule + Reg BI rule packs, and ships a one-page operator runbook.

**Deliverables:**
- Replit template + `npx create-kbot-finance-ria` initialiser
- Terraform/IaC module for the S3 Object Lock + Supabase pieces
- Operator runbook covering install, daily verify, incident response, teardown

**Skills demonstrated:** S3 Object Lock semantics, Supabase RLS, Terraform, runbook writing, RIA operational reality, sober scope-bounding

**Difficulty:** Mid

**Connection:** Turns the package into something a compliance officer at a $500M-AUM shop can adopt without an engineering team.

**Estimated effort:** 8-10 days

---

### 56. Developer Relations / DevRel Engineer

**What they do:** Write the documents that let other engineers reach the same conclusions the maintainers already reached.

**The project:** Produce a four-part "How to build X with kbot-finance" tutorial series published as features on kernel.chat (one issue per tutorial) and contribute an MCP audit-extension RFC to the `modelcontextprotocol/spec` repository.

**Deliverables:**
- Four tutorial spreads under `src/content/issues/` with working code and a published companion repo per tutorial
- MCP RFC PR against `modelcontextprotocol/spec` with reference implementation
- Conference-talk-length writeup of the RFC for one external venue

**Skills demonstrated:** Technical writing, MCP spec literacy, RFC drafting, editorial register, working-example discipline, community PR etiquette

**Difficulty:** Mid

**Connection:** Threads all three surfaces — tutorials are kernel.chat features, code lands in kbot-finance, RFC pushes MCP ecosystem toward auditability.

**Estimated effort:** 14-18 days

---

# How to claim and ship a project

1. **Pick a role** from the catalog above.
2. **Open an issue** on `isaacsight/kernel` titled `[claiming] <project title>` — the maintainer will tag it so it's not double-worked.
3. **Read** the existing `CONTRIBUTING.md` at `packages/kbot-finance/CONTRIBUTING.md` for the contribution ladder + PR checklist.
4. **Open a PR** with the deliverables listed in the entry. Tests required for code; for documentation projects, the deliverable itself is the artefact.
5. **Get reviewed.** Maintainer response within 7 days, usually 2. Substantive changes may need 1-2 review rounds.
6. **Merged.** Your contribution lands in the public substrate; you're credited in `CONTRIBUTORS.md` and in the release notes if it ships in a version.

If you ship five PRs over six months, you're a Reviewer (per the ladder
in `CONTRIBUTING.md`). After six months as a Reviewer, you can become
a Committer in your subsystem.

---

## Why this catalog exists

Open-source projects often welcome contributors in the abstract but
fail to surface specific, finishable work. This catalog converts
"contributions welcome!" into 56 named projects, each with the same
template, so a senior engineer can scan, find their discipline, and
start work in the next 90 minutes.

The catalog also signals — by what's in it — what the project takes
seriously. AI engineering is the forefront. Substrate engineering is
the layer that makes the forefront trustworthy. The application
layer, the operations layer, the domain specializations, and the
bridge roles arrange around the same throughline: building AI
systems that can be audited.

If your discipline isn't here, open an issue suggesting an entry.
The list grows when the substrate does.

---

*Catalog v0.1 · May 2026 · CC BY 4.0 · 56 projects across 56 roles
across three repos. Forkable into any other open-source ecosystem's
contribution layer.*
