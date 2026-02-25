---
description: Common Supabase operations (deploy functions, check status, migrations)
---

## Supabase Operations

### Deploy all edge functions

// turbo

```bash
npx supabase functions deploy --project-ref kqsixkorzaulmeuynfkp
```

### Deploy a specific edge function

Replace `<function-name>` with the function directory name (e.g., `claude-proxy`, `web-search`):

```bash
npx supabase functions deploy <function-name> --project-ref kqsixkorzaulmeuynfkp
```

### Check function logs

```bash
npx supabase functions logs --project-ref kqsixkorzaulmeuynfkp
```

### Run database migrations

```bash
npx supabase db push --project-ref kqsixkorzaulmeuynfkp
```

### Available Edge Functions

| Function | Purpose |
|---|---|
| `claude-proxy` | Proxies all Claude API calls (auth + rate limiting) |
| `web-search` | Perplexity-powered web search |
| `create-checkout` | Stripe checkout sessions |
| `stripe-webhook` | Payment event processing |
| `evaluate-chat` | Chat quality scoring |
| `extract-insights` | Conversation insight extraction |
| `url-fetch` | Fetch URL content for analysis |
| `send-inquiry-email` | Project inquiry emails |
| `notify-webhook` | Outbound webhook notifications |
| `manage-agent` | Agent lifecycle management |

> The Supabase project ref is `kqsixkorzaulmeuynfkp`. The second project (eoxxpyixdieprsxlpwcs) is used by the ClaudeClient for the proxy URL.
