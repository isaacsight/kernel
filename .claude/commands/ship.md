Run the gated ship pipeline. Each gate must pass before proceeding to the next.

This is the flagship deployment command. It runs 6 agents in sequence, each as a gate. Any gate failure STOPS the pipeline.

## Gate 1 — Security

Run the Security Agent protocol:
1. Call `agent_memory_read` for `security`
2. Run `kernel_audit` for vulnerability + secrets scan
3. Grep `src/` for hardcoded keys/tokens
4. Verify edge function JWT configuration
5. Call `agent_memory_write` for `security` with findings

**STOP condition**: Any P0 security finding (exposed secret, auth bypass)

## Gate 2 — QA

Run the QA Agent protocol:
1. Call `agent_memory_read` for `qa`
2. Run `npx tsc --noEmit` — must pass with zero errors
3. Run `npm run build` — must succeed
4. Call `agent_memory_write` for `qa` with results

**STOP condition**: Type errors or build failure

## Gate 3 — Design

Run the Designer Agent protocol:
1. Call `agent_memory_read` for `designer`
2. Run `kernel_design_lint` on recent changes
3. Verify Rubin compliance (typography, palette, touch targets)
4. Call `agent_memory_write` for `designer` with findings

**STOP condition**: Critical Rubin violation (wrong fonts, broken dark mode, inaccessible elements)

## Gate 4 — Performance

Run the Performance Agent protocol:
1. Call `agent_memory_read` for `performance`
2. Check `dist/assets/` bundle sizes after build (from Gate 2)
3. Run `kernel_deps` for dependency check
4. Call `agent_memory_write` for `performance` with metrics

**STOP condition**: JS bundle > 300KB gzip or CSS > 150KB gzip

## Gate 5 — DevOps (Deploy)

Run the DevOps Agent protocol:
1. Call `agent_memory_read` for `devops`
2. Run `npm run deploy`
3. Wait 30 seconds for propagation
4. Verify HTTP 200: `curl -s -o /dev/null -w "%{http_code}" https://kernel.chat`
5. Run `kernel_uptime` for full health check
6. Call `agent_memory_write` for `devops` with deploy log

**STOP condition**: Deploy failure or health check failure. If failed, rollback with `git revert HEAD --no-edit && npm run deploy`

## Gate 6 — Product (Post-Deploy Verification)

Run the Product Agent protocol:
1. Call `agent_memory_read` for `product`
2. Use Playwright to navigate the live site
3. Verify core flows work: home → chat → features
4. Check mobile viewport (375px)
5. Call `agent_memory_write` for `product` with findings

**STOP condition**: Core user flows broken on live site

## Final Report

After all gates pass, synthesize a ship report:
```
# Ship Report — [date] [commit hash]

| Gate | Agent | Status | Notes |
|------|-------|--------|-------|
| 1 | Security | PASS/FAIL | ... |
| 2 | QA | PASS/FAIL | ... |
| 3 | Design | PASS/FAIL | ... |
| 4 | Performance | PASS/FAIL | ... |
| 5 | DevOps | PASS/FAIL | ... |
| 6 | Product | PASS/FAIL | ... |

## Verdict: SHIPPED / BLOCKED at Gate X
```

Call `kernel_notify` on discord with the final verdict.
