---
description: Launch the Kernel TUI monitor dashboard
---

## Kernel Monitor

1. Start the monitoring TUI:

```bash
npm run monitor
```

> This launches `tools/kernel-monitor.ts` — a blessed-contrib terminal dashboard that shows real-time Kernel metrics. It requires Supabase credentials in `.env`. Press `q` or `Ctrl+C` to exit.

1. If the monitor fails to connect, check that `.env` has valid `VITE_SUPABASE_URL` and `SUPABASE_SERVICE_KEY` values.
