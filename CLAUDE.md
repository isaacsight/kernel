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
   MIT.
2. **kernel.chat** — editorial magazine. Currently on
   **ISSUE 426 — THE WEATHER OVER THE QUEUE**. Sixty-seven issues
   in the catalog. POPEYE-grammar anchored, PAPERSKY + WIRED decoded
   as editorial neighbours.

**Discipline (same on both surfaces):** count what gets read; cut
what doesn't; file the audit in public; keep the manuscripts in
the drawer. The room is different, the job is the same.

## Where to look for what

| If you need… | Read |
|---|---|
| **Project shape, current state, directory map, ship flow** | [`KERNEL.md`](./KERNEL.md) |
| **Magazine publishing workflow** | [`src/content/issues/PUBLISHING.md`](src/content/issues/PUBLISHING.md) |
| **Magazine visual grammar** | [`docs/design-language.md`](docs/design-language.md) |
| **Unified creative canvas handoff and agent-control contracts** | [`docs/creative-canvas-handoff.md`](docs/creative-canvas-handoff.md) |
| **kbot v5 futures substrate** | [`packages/kbot/V5_FUTURES_PLAN.md`](packages/kbot/V5_FUTURES_PLAN.md) |
| **Why the 4.0 cut went the way it did** | [`packages/kbot/RELEASE_NOTES_4_0.md`](packages/kbot/RELEASE_NOTES_4_0.md) |
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

*Updated 2026-04-29 to point at KERNEL.md as the canonical
reference. The previous CLAUDE.md (v3.60.0-era project map,
~673 lines) is preserved in git history at any commit prior to
the supersession.*
