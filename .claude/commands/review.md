Review the current codebase changes for quality and correctness.

Steps:

1. Run `git diff --stat` to see what files changed
2. For each changed file, review the diff
3. Check for:
   - Type safety issues
   - Missing error handling
   - Broken imports or circular dependencies
   - Design system violations (should use EB Garamond, ivory palette, Rubin aesthetic)
   - Security issues (exposed keys, unsanitized input)
   - Performance concerns (unnecessary re-renders, missing memoization)
4. Provide a summary with specific line references
5. Rate overall quality: 🟢 Ship it / 🟡 Minor fixes / 🔴 Needs rework
