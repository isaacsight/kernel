Analyze the Kernel project architecture and provide insights.

Steps:

1. Read the project structure: `find src/ -type f -name "*.ts" -o -name "*.tsx" | head -50`
2. Check component count: `find src/components -type f | wc -l`
3. Check route structure in `src/router.tsx`
4. Analyze the agent system in `src/agents/` and `src/engine/`
5. Check Supabase edge functions: `ls supabase/functions/`
6. Review package.json for dependency health
7. Run `npx tsc --noEmit 2>&1 | tail -5` to check type health
8. Provide a high-level architecture summary with recommendations

Focus areas: bundle size, dead code, missing types, agent system health, Supabase function coverage.
