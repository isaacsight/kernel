Deploy and manage Supabase edge functions.

Common operations:

- Deploy all functions: `npx supabase functions deploy --project-ref kqsixkorzaulmeuynfkp`
- Deploy specific function: `npx supabase functions deploy <name> --project-ref kqsixkorzaulmeuynfkp`
- Check logs: `npx supabase functions logs --project-ref kqsixkorzaulmeuynfkp`
- Run migrations: `npx supabase db push --project-ref kqsixkorzaulmeuynfkp`

Available edge functions:

| Function | Purpose |
|---|---|
| claude-proxy | Proxies all Claude API calls |
| web-search | Perplexity-powered web search |
| create-checkout | Stripe checkout sessions |
| stripe-webhook | Payment processing |
| evaluate-chat | Chat quality scoring |
| extract-insights | Conversation insights |
| url-fetch | URL content extraction |
| send-inquiry-email | Inquiry emails |
| notify-webhook | Outbound webhooks |
| manage-agent | Agent lifecycle |

Project ref: kqsixkorzaulmeuynfkp (primary), eoxxpyixdieprsxlpwcs (proxy URL).
