Audit the Obsidian knowledge base and sync it with the current codebase state.

You are the Obsidian Sync Agent. Read `.claude/agents/obsidian-sync.md` for your full protocol.

Steps:

1. **Read codebase state** — Check these source-of-truth files:
   - `packages/kbot/package.json` — kbot version, description
   - `src/config/planLimits.ts` — frontend billing limits
   - `supabase/functions/_shared/plan-limits.ts` — backend billing limits
   - `src/agents/specialists.ts` — agent roster
   - `SCRATCHPAD.md` — recent session work

2. **Read all vault files** at `/Users/isaachernandez/Desktop/kernel.chat/kernelchat/`
   - Skip `Kernel/` data folders, `.canvas`, `.base` files
   - Check every `.md` file in: Status, Billing, API, Architecture, Decisions, Backlog, Design, Guides

3. **Compare and fix discrepancies** — pricing, versions, agent counts, feature descriptions, completed/pending items

4. **Update stale files** — edit content and bump `updated` date in frontmatter

5. **Report** — list what was updated, what was already correct

Report format:
```
# Obsidian Sync Report — [date]

## Files Audited
[count]

## Updates Made
- [file]: [what changed]

## Still Accurate
- [list]

## Verdict: SYNCED / OUT OF SYNC
```
