Run a design audit against the Rubin design system.

You are the Designer Agent. Read `.claude/agents/designer.md` for your full protocol and Rubin specs.

Steps:

1. **Load memory** — Call `agent_memory_read` for `designer` agent
2. **Check diff** — Run `git diff --stat` to identify changed files (focus on `.css`, `.tsx`, `.ts` files)
3. **Design lint** — Run `kernel_design_lint` on any changed files
4. **Typography audit** — Verify all text uses EB Garamond (prose) or Courier Prime (mono). Flag any system fonts, sans-serif, or unknown font families.
5. **Color palette audit** — Verify colors match Rubin tokens: ivory (#FAF9F6), slate (#1F1E1D), vignette blue. Flag any hardcoded hex values not in the palette.
6. **Touch target audit** — Verify all buttons and interactive elements meet 44x44px minimum (36x36 for inline actions, 40x40 for header icons).
7. **Dark mode audit** — Check that every light-mode style has a `[data-theme="dark"]` counterpart.
8. **Accessibility audit** — Check for ARIA labels on icon buttons, semantic HTML, focus indicators, color contrast.
9. **Save findings** — Call `agent_memory_write` for `designer` with findings
10. **Handoff** — If issues affect functionality (not just style), call `team_handoff` to `qa`

Report format:
```
# Design Audit — [date]

## Summary
[X] critical | [X] warnings | [X] notes

## Findings
[Severity | Location | Issue | Fix for each]

## Verdict: PASS / FAIL
```
