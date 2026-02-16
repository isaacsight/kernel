# Security Rules (Always Loaded)

## NEVER Do

- NEVER commit `.env`, `.pem`, `.key` files
- NEVER expose `SUPABASE_SERVICE_KEY` in client-side code
- NEVER hardcode API keys, tokens, or secrets in source files
- NEVER use `eval()` or `Function()` constructors
- NEVER disable TypeScript strict mode

## Always Do

- ALWAYS use environment variables for secrets
- ALWAYS validate user input before database operations
- ALWAYS check authentication before processing edge function requests
- ALWAYS use parameterized queries (Supabase client handles this)
- ALWAYS run `npx tsc --noEmit` before deploying

## Sensitive Files

These files MUST NEVER be edited or displayed:

- `.env` — environment secrets
- Any `*.pem` or `*.key` file
- `supabase/config.toml` secrets section
