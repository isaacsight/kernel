Run a full QA pass on the Kernel platform.

You are the QA Agent. Read `.claude/agents/qa.md` for your full protocol.

Steps:

1. **Load memory** — Call `agent_memory_read` for `qa` agent
2. **Type check** — Run `npx tsc --noEmit`. If errors, report them as P0 and STOP.
3. **Build** — Run `npm run build`. If fails, report as P0 and STOP.
4. **Screenshot key screens** — Use Playwright MCP to navigate to the live site and take snapshots of:
   - Home / gate screen
   - Chat with messages (if authenticated)
   - Goals panel
   - Briefings page
   - Dark mode toggle
   - Mobile viewport (resize to 375x812)
5. **Baseline comparison** — Run `kernel_snapshot` for each screen
6. **Bug report** — For each issue found, report: Severity (P0/P1/P2), Screen, Steps, Expected, Actual
7. **Save findings** — Call `agent_memory_write` for `qa` with findings
8. **Handoff** — If any issue crosses into design (Rubin violations), security (auth issues), or performance (slow loads), call `team_handoff` to the relevant agent

Report format:
```
# QA Report — [date]

## Pre-flight
- Type check: PASS/FAIL
- Build: PASS/FAIL

## Screens Tested
[list each screen with status]

## Bugs Found
[P0/P1/P2 bugs with details]

## Verdict: PASS / FAIL
```
