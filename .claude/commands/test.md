Type-check and verify the project builds cleanly.

Steps:

1. Run TypeScript type-checking: `npx tsc --noEmit`
2. Run a production build: `npm run build`
3. If both pass, the project is healthy.

There are no unit test suites. Integration tests in `tools/` require a running Supabase instance.
