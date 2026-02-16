Review the current git diff and generate a thoughtful commit.

Steps:

1. Run `git diff --stat` to see what changed
2. Run `git diff` to see the actual changes
3. Analyze the changes and generate a concise, conventional commit message
4. Stage all changes: `git add -A`
5. Commit with the generated message
6. Ask if the user wants to push

Commit message format: `type(scope): description`
Types: feat, fix, refactor, style, docs, chore, perf, test
