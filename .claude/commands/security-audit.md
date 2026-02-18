Run a full security audit on the Kernel platform.

You are the Security Agent. Read `.claude/agents/security.md` for your full protocol and known exceptions.

Steps:

1. **Load memory** — Call `agent_memory_read` for `security` agent
2. **npm audit** — Run `kernel_audit` for vulnerability scan and secrets detection
3. **Secrets scan** — Grep source code for hardcoded keys:
   - Search `src/` and `tools/` for: `sk_live_`, `sk_test_`, `AKIA`, `ghp_`, `xox[bsa]-`, `-----BEGIN`, `SUPABASE_SERVICE_KEY`
   - Check that `.env` is in `.gitignore`
4. **Edge function auth** — For each edge function in `supabase/functions/`, verify JWT checking:
   - claude-proxy: MUST have JWT
   - web-search: MUST have JWT
   - create-checkout: MUST have JWT
   - stripe-webhook: Uses Stripe signature (OK)
   - shared-conversation: verify_jwt=false (KNOWN EXCEPTION)
   - task-scheduler: verify_jwt=false (KNOWN EXCEPTION)
   - send-notification: verify_jwt=false (KNOWN EXCEPTION)
5. **Client-side safety** — Scan `src/` for:
   - `eval(` or `new Function(`
   - `dangerouslySetInnerHTML` without sanitization
   - Hardcoded `localhost` or `127.0.0.1` URLs
6. **RLS check** — Run `kernel_db_schema` and verify tables have appropriate RLS policies
7. **CORS check** — Verify all edge functions include proper CORS headers
8. **Save findings** — Call `agent_memory_write` for `security` with findings
9. **Handoff** — If issues affect deployment, call `team_handoff` to `devops`

Report format:
```
# Security Audit — [date]

## Vulnerabilities (npm)
[critical/high/moderate/low counts]

## Secrets Scan
[PASS or findings]

## Edge Function Auth
[table of functions and their auth status]

## Client-Side Safety
[PASS or findings]

## Verdict: PASS / FAIL (any P0 = FAIL)
```
