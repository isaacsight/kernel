# Testing Rules (Always Loaded)

## Framework

- Use **Vitest** for unit and integration tests
- Use **@testing-library/react** for component tests
- Test files: `*.test.ts` or `*.test.tsx` next to source files

## Commands

- `npx vitest run` — run all tests once
- `npx vitest` — watch mode
- `npx tsc --noEmit` — type-check (run before every deploy)
- `npm run build` — full type-check + Vite build

## Standards

- Every new utility function should have at least 1 test
- Mock Supabase client in tests, never call real API
- Mock Claude proxy in tests, never call real API
- Test error states, not just happy paths
