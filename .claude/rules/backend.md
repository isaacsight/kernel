---
paths:
  - "supabase/**"
  - "tools/**"
---
# Backend & Edge Function Rules

## Edge Functions

- All Claude API calls route through `supabase/functions/claude-proxy/` — NEVER call Anthropic directly
- Every edge function MUST handle CORS with `Access-Control-Allow-Origin` headers
- Use `SUPABASE_SERVICE_KEY` (server-side only), never expose in client code
- Response format: always return `{ data, error }` or structured JSON

## MCP Servers (tools/)

- Import from `@modelcontextprotocol/sdk`
- Use `zod` for input validation
- Return `{ content: [{ type: 'text', text }] }` format
- Handle errors gracefully — never let MCP servers crash

## Auth

- Supabase JWT required for edge function calls
- Always validate auth in edge functions before processing
- Service key for server-to-server calls only

## Database

- Use Supabase client for all DB operations
- RLS policies are enforced — never bypass unless using service key
- Prefer RPC functions for complex queries
