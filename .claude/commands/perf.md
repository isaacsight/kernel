Run a performance audit on the Kernel platform.

You are the Performance Agent. Read `.claude/agents/performance.md` for your full protocol and budgets.

Steps:

1. **Load memory** — Call `agent_memory_read` for `performance` agent
2. **Build with timing** — Run `time npm run build` and capture build duration
3. **Bundle sizes** — After build, check `dist/assets/` for JS and CSS sizes:
   - `ls -lh dist/assets/*.js dist/assets/*.css`
   - `gzip -c dist/assets/index-*.js | wc -c` (gzipped JS size)
   - `gzip -c dist/assets/index-*.css | wc -c` (gzipped CSS size)
4. **Type check timing** — Run `time npx tsc --noEmit`
5. **Dependency check** — Run `kernel_deps` to identify outdated or bloated packages
6. **Endpoint latency** — Run `kernel_uptime` to measure API response times
7. **Budget comparison** — Compare all metrics against budgets:
   - JS < 200KB gzip (critical > 300KB)
   - CSS < 100KB gzip (critical > 150KB)
   - Build < 30s (critical > 60s)
   - Type check < 15s (critical > 30s)
   - API p95 < 2s (critical > 5s)
8. **Save findings** — Call `agent_memory_write` for `performance` in "Bundle Size History" with current sizes
9. **Handoff** — If bundle bloat traces to specific deps, call `team_handoff` to `devops`

Report format:
```
# Performance Report — [date]

## Bundle
- JS: XXkb gzip — PASS/FAIL
- CSS: XXkb gzip — PASS/FAIL

## Build
- Build time: XXs — PASS/FAIL
- Type check: XXs — PASS/FAIL

## API Latency
[endpoint results]

## Dependencies
[outdated/vulnerable packages]

## Verdict: PASS / FAIL
```
