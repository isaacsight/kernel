---
name: pair
description: Start pair programming mode — file watcher with real-time AI suggestions and auto-fix
---

# kbot Pair Programming

Start kbot's pair programming mode. Watches the current directory for file changes and provides real-time AI-powered suggestions.

## Steps

1. Start pair mode: `kbot pair` (watches cwd) or `kbot pair ./src` (watches specific path)
2. Available flags:
   - `--quiet` — errors only, suppress suggestions
   - `--auto-fix` — apply safe fixes automatically (unused imports, formatting)
   - `--bell` — terminal bell on errors
3. kbot watches for file saves and provides:
   - **Type errors** — catches TypeScript issues in real time
   - **Lint issues** — style and quality warnings
   - **Missing tests** — flags new functions without test coverage
   - **Security flags** — detects potential vulnerabilities
   - **Refactoring offers** — suggests extractions and simplifications
4. Review suggestions as they appear. Accept or dismiss each one.
5. Press `Ctrl+C` to stop pair mode.

## Notes

- Pair mode uses only local analysis by default (no API calls for basic checks)
- AI-powered suggestions (refactoring, test generation) use the configured provider
- Config file: `~/.kbot/pair.json` for customizing checks and ignore patterns
