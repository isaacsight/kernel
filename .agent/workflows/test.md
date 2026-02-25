---
description: Type-check and verify the project builds
---
// turbo-all

## Test / Verify Build

1. Run TypeScript type-checking:

```bash
npx tsc --noEmit
```

1. Run a production build to catch runtime issues:

```bash
npm run build
```

1. If both pass, the project is healthy. If there are errors, fix them before deploying.

> There are no unit test suites configured. The test scripts in `tools/` (e.g., `test-site.ts`, `test-conversation.ts`) are integration tests that require a running Supabase instance and valid API keys.
