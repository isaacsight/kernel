# CLAUDE.md — kernel.chat group

> **This file is a shim.** The canonical project reference is
> [`KERNEL.md`](./KERNEL.md). Read that first.
>
> CLAUDE.md exists because Claude Code auto-loads it at session
> start; the canonical reference moved to KERNEL.md on 2026-04-29
> when the project's two surfaces (kbot agent + kernel.chat
> magazine) became co-equal and the older `K:BOT-as-product +
> web-as-companion` framing stopped describing the work.

## What you need to know in 30 seconds

**Two surfaces, one publication:**
1. **kbot** — open-source terminal AI agent (`@kernel.chat/kbot`
   on npm). Currently **v4.5.0**. ~100 specialty skills curated
   from 670 in v4.0 with a public audit trail. Local-first, BYOK,
   MIT. The package sits alongside a working family —
   `kbot-finance`, `kbot-orchestrator`, `agent-os`, plus seven
   specialty packages (memory-tiers, prompt-evolver, skill-router,
   synth, tool-forge, kbot-control-standalone, vscode-kbot).
2. **kernel.chat** — editorial magazine. Currently on
   **ISSUE 390 — ON THE CONSUMER STANDARD**. Thirty-one issues
   in the catalog (360–390). POPEYE-grammar anchored, PAPERSKY +
   WIRED decoded as editorial neighbours.

**The field, named.** As of May 2026 the magazine names its beat:
**agentic engineering** is the field; **autonomy engineering** the
umbrella (ISSUE 388); three disciplines coined so far —
**provenance engineering** (381), **orchestration engineering**
(387), **agent fidelity engineering** (389). Each discipline ships
with a reference implementation in `packages/` and a `ROLE.md`
that names what the package is *for*, not just what it does. The
in-flight series — **"Agentic Substrates for the Frontier"** —
reads one adjacent branch per issue.

**Discipline (same on both surfaces):** count what gets read; cut
what doesn't; file the audit in public; keep the manuscripts in
the drawer. The room is different, the job is the same.

## Where to look for what

| If you need… | Read |
|---|---|
| **Project shape, current state, directory map, ship flow** | [`KERNEL.md`](./KERNEL.md) |
| **Magazine publishing workflow** | [`src/content/issues/PUBLISHING.md`](src/content/issues/PUBLISHING.md) |
| **Magazine visual grammar** | [`docs/design-language.md`](docs/design-language.md) |
| **kbot v5 futures substrate** | [`packages/kbot/V5_FUTURES_PLAN.md`](packages/kbot/V5_FUTURES_PLAN.md) |
| **Why the 4.0 cut went the way it did** | [`packages/kbot/RELEASE_NOTES_4_0.md`](packages/kbot/RELEASE_NOTES_4_0.md) |
| **OWASP Top 10 for Agentic Apps — self-audit** | [`docs/owasp-agentic-self-audit.md`](docs/owasp-agentic-self-audit.md) |
| **Federal procurement alignment (NIST AI RMF / EO / DoD)** | [`packages/kbot-finance/FEDERAL_ALIGNMENT.md`](packages/kbot-finance/FEDERAL_ALIGNMENT.md) |
| **Orchestration discipline — reference impl** | [`packages/kbot-orchestrator/ROLE.md`](packages/kbot-orchestrator/ROLE.md) |
| **Agent fidelity discipline — reference impl** | [`packages/kbot-orchestrator/AGENT_FIDELITY_ROLE.md`](packages/kbot-orchestrator/AGENT_FIDELITY_ROLE.md) |
| **May 2026 news cycle the recent build responded to** | [`docs/may-2026-signals.md`](docs/may-2026-signals.md) |
| **Field-level positioning (agentic engineering)** | [`docs/agentic-engineering.md`](docs/agentic-engineering.md) |
| **Per-session working memory** | [`SCRATCHPAD.md`](./SCRATCHPAD.md) |

## Five rules that always apply

1. **Magazine vocabulary in user-visible copy.** Issue / feature /
   spread / folio / monument / colophon / dateline / postmark —
   never dashboard / panel / card / widget / modal. Never name
   "POPEYE" on the site.
2. **Evidence-cited commits.** Every release commit cites numbers
   and reasoning; audit trails (CSV, JSONL, RELEASE_NOTES) ship
   alongside code changes.
3. **BYOK is the contract.** kbot never hardcodes a provider
   preference. Local-first when there's a free path
   (Ollama/LLaDA/MLX) for the task.
4. **No emojis in code or user-visible copy** unless the user
   explicitly asks (single-glyph system asterisk ★ is the
   exception, ratified in ISSUE 370).
5. **Update SCRATCHPAD.md at session end.** Future sessions
   inherit your context through it.

For everything else, see [KERNEL.md](./KERNEL.md).

---

*Updated 2026-05-26: refreshed the 30-second to reflect kbot
v4.5.0, ISSUE 390, the package family (kbot-finance,
kbot-orchestrator, agent-os, seven specialty packages), and the
field/disciplines named in the May 17–21 build sprint. The shim
still points at KERNEL.md as canonical. The previous CLAUDE.md
(v3.60.0-era project map, ~673 lines) is preserved in git
history at any commit prior to the 2026-04-29 supersession.*
