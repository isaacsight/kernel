Run all 6 agents against the current changes and synthesize a unified report.

This command runs each agent sequentially so findings can inform subsequent agents.

## Execution Order

### 1. Security Agent
1. Call `agent_memory_read` for `security`
2. Run `kernel_audit`
3. Scan for hardcoded secrets in `src/` and `tools/`
4. Verify edge function auth
5. Call `agent_memory_write` for `security`

### 2. QA Agent
1. Call `agent_memory_read` for `qa`
2. Run `npx tsc --noEmit`
3. Run `npm run build`
4. Use Playwright to screenshot key screens
5. Call `agent_memory_write` for `qa`

### 3. Designer Agent
1. Call `agent_memory_read` for `designer`
2. Run `kernel_design_lint` on changed files
3. Audit typography, palette, touch targets, dark mode
4. Call `agent_memory_write` for `designer`

### 4. Performance Agent
1. Call `agent_memory_read` for `performance`
2. Measure bundle sizes from build output
3. Run `kernel_deps` and `kernel_uptime`
4. Check against budgets
5. Call `agent_memory_write` for `performance`

### 5. DevOps Agent
1. Call `agent_memory_read` for `devops`
2. Review build output and deployment readiness
3. Check infrastructure health
4. Call `agent_memory_write` for `devops`

### 6. Product Agent
1. Call `agent_memory_read` for `product`
2. Navigate live site with Playwright
3. Evaluate discoverability, clarity, value delivery
4. Score findings with ICE framework
5. Call `agent_memory_write` for `product`

## Synthesis

After all agents complete, call `team_report` to synthesize findings into a unified report with:
- **Blockers** — Must fix before shipping
- **Warnings** — Should fix soon
- **Suggestions** — Nice to have
- **Cross-cutting themes** — Patterns spanning multiple agents
- **Recommended next actions** — Prioritized list

Also update `shared-knowledge.md` with any cross-cutting insights discovered.

## Output

```
# Team Report — [date]

## Agent Results
| Agent | Status | Findings | Critical |
|-------|--------|----------|----------|

## Unified Assessment
[synthesized findings from team_report]

## Priority Actions
1. [highest priority]
2. ...
```
