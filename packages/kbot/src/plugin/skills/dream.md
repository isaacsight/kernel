---
name: dream
description: Run kbot dream mode — memory consolidation, meta-agent cycle, forge speculation, and self-benchmarking
---

# kbot Dream Mode

Run kbot's dream mode. This is what kbot does when you are not watching — it actively improves itself.

## Steps

1. Start kbot dream mode by running: `kbot dream`
2. Dream mode executes these phases in order:
   - **Memory consolidation** — promotes short-term patterns to long-term knowledge
   - **Meta-agent cycle** — analyzes recent task performance and proposes routing/prompt improvements
   - **Forge speculation** — pre-builds tools it predicts will be needed tomorrow
   - **Collective sync** — contributes learned patterns to and absorbs from the kbot community
   - **Codebase guardian sweep** — scans for complexity hotspots and repeated code
   - **Self-benchmarking** — compares current performance against yesterday's baseline
   - **Content generation** — drafts a summary of what was learned
3. Review the dream report that is saved to `~/.kbot/dreams/`
4. Report the findings: which phases ran, how many improvements were made, and any notable patterns discovered

## Notes

- Dream mode is safe to run at any time. It does not modify source code.
- Each phase has a timeout. If one phase fails, the others still run.
- Results accumulate over time. The more you dream, the smarter kbot gets.
