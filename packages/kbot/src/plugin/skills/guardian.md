---
name: guardian
description: Run codebase guardian — detect duplicates, co-change patterns, and complexity hotspots
---

# kbot Codebase Guardian

Run kbot's codebase guardian to analyze code quality and detect structural issues.

## Steps

1. Run the guardian on the current project: `kbot guardian` or programmatically via `runGuardian(process.cwd())`
2. The guardian scans for three categories:
   - **Duplicate patterns** — code blocks appearing 3+ times across files, suggests extraction into shared utilities
   - **Co-change patterns** — files that always change together in git history, suggests co-location or module extraction
   - **Complexity hotspots** — long functions, deep nesting, high cyclomatic complexity, suggests refactoring
3. Each finding has a severity: `info`, `warn`, or `critical`
4. For recurring patterns, the guardian can forge a custom tool to detect and fix that specific pattern in the future
5. Review the findings and apply the suggestions that make sense for the project

## Notes

- Guardian results are saved to `~/.kbot/guardian/` for tracking trends over time
- Forged tools are saved to `~/.kbot/forge/` and become available in future sessions
- The guardian is safe to run — it only reads files and git history, never modifies code
- Best used as part of dream mode or as a pre-commit check
