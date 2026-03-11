# Terminal Coordination

> Both Claude Code sessions MUST read this file before starting work and update it before editing files.
> This prevents merge conflicts and duplicated effort.

## Protocol
1. Before working: read this file
2. Claim your task below with the files you'll touch
3. Check the other terminal's claim — if there's overlap, wait or split the work
4. When done: clear your claim and note what changed

## Terminal A (active)
- **Status**: idle
- **Working on**: —
- **Files**: —

## Terminal B (active)
- **Status**: working
- **Working on**: kbot agents command + agent picker UI + MCP wiring
- **Files**:
  - `packages/kbot/src/cli.ts` (adding agents subcommand)
  - `packages/kbot/src/matrix.ts` (agent listing helpers)
  - `src/pages/EnginePage.tsx` (agent picker UI)
  - `src/components/AgentPicker.tsx` (new — agent selector component)

## Completed
- **Terminal B**: Hacker + Operator + Dreamer agents (specialists.ts, AgentRouter.ts, EnginePage.tsx, kbot matrix.ts + cli.ts). Type-check + build clean.
