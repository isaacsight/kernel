---
name: daemon-deployment
description: Use when setting up 24/7 background workers. kbot's compound improvement depends on daemons running even when nobody is looking.
version: 1.0.0
author: kbot
license: MIT
platforms: [darwin, linux]
metadata:
  kbot:
    tags: [daemon, launchd, background, 24-7, compound]
    related_skills: [autopoiesis-loop, teacher-trace-curation]
---

# Daemon Deployment

kbot's intelligence doesn't sleep. Three daemons run continuously:
- `kbot-daemon` — code quality, i18n sync, embeddings, docs gaps (every 15 min)
- `kbot-discovery-daemon` — self-advocacy, field intelligence (every 15 min → 24 hr cycles)
- `kbot-social-daemon` — autonomous posting to X/Bluesky/Mastodon/LinkedIn (daily)

Plus a weekly `train-self` that fine-tunes the local model on curated traces.

## Iron Law

```
VERIFY THE DAEMON IS ACTUALLY RUNNING AFTER INSTALL.
```

launchd plists that fail silently are the single most common cause of "kbot feels stale" — the daemon was never loaded, so no compound improvement happened.

## Install Sequence (macOS)

1. `npm run daemon` — run once manually to confirm it works at all.
2. `npm run daemon:start` — loads the launchd plist.
3. **Verify**: `launchctl list | grep kernel.kbot` — should show a running entry with PID.
4. **Confirm output**: `tail -f tools/daemon-reports/daemon.log` — should show activity within 15 min.
5. **Check state**: `npm run daemon:stats` — shows task timestamps, token usage, cost savings.

If any of steps 3–5 fail, the daemon is not actually running. Debug before moving on.

## Per-Daemon Triggers

- `com.kernel.kbot-daemon.plist` → every 15 min
- `com.kernel.kbot-discovery.plist` → every 15 min (internal sub-cycles stagger)
- `com.kernel.kbot-social.plist` → daily at 9am
- `com.kernel.kbot-train-self.plist` → Sundays 3am

## What You Gain

- Daily digest of codebase activity (without asking).
- i18n stays in sync across 24 languages automatically.
- Embedding index for semantic search rebuilds overnight.
- Social presence grows without manual posting.
- Local fine-tune stays current with your actual work.

Cost: zero. All daemon work routes through local Ollama models.

## Failure Modes

- **Mac sleep blocks launchd** — use `caffeinate` or enable "wake for network access" in Energy Saver if you need guaranteed intervals.
- **Ollama not running** — daemons depend on `localhost:11434`. Either start Ollama at login OR the daemon silently no-ops. Add Ollama to Login Items.
- **Filesystem permission errors** — daemon's user context may differ from your shell. Absolute paths in plist, check `~/.kbot/` is writable by the daemon user.

## Rollback

`npm run daemon:stop` unloads the plist. Work resumes manually. No state is lost — `tools/daemon-reports/state.json` persists until the daemon re-enables.

## What Emerges

After two weeks of active daemons, the user finds: i18n is always current, the daily digest email is actually read, social posts have engagement, the local model passes a basic task without Claude. The compound output is larger than any single feature could produce.
