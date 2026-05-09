---
name: secrets-leak-scan
description: Use when sweeping for hardcoded secrets, accidentally-committed credentials, or .env leaks across the working tree and git history.
version: 1.0.0
author: kbot
license: MIT
metadata:
  kbot:
    tags: [security, secrets, credentials, git-history, audit]
    related_skills: [local-vulnerability-hunt, dependency-audit]
---

# Secrets Leak Scan

A leaked key in git history is a leaked key forever. This skill catches them before they ship and rotates them when they already did.

## When to Use

- Before pushing a new branch to a public remote
- After any `git rebase` that touched config files
- After a teammate says "I think I committed something I shouldn't have"
- Quarterly, against the entire history, even if no one reported anything
- Before open-sourcing a previously private repo

## Iron Laws

```
A SECRET IN HISTORY IS A SECRET LEAKED.
ROTATE FIRST, EXPLAIN SECOND.
NEVER REWRITE PUBLIC HISTORY WITHOUT TEAM CONSENT.
```

## Four Phases

### Phase 1 — Working tree

Sweep what is on disk right now. The cheapest catch.

Patterns to grep, ranked by signal:
- `AKIA[0-9A-Z]{16}` — AWS access key
- `sk-[A-Za-z0-9]{20,}` — OpenAI / Anthropic / generic
- `xox[baprs]-[A-Za-z0-9-]+` — Slack tokens
- `ghp_[A-Za-z0-9]{36}` / `github_pat_[A-Za-z0-9_]{82}` — GitHub PAT
- `-----BEGIN (RSA |OPENSSH |EC )?PRIVATE KEY-----` — any private key
- `eyJ[A-Za-z0-9_-]{20,}\.[A-Za-z0-9_-]{20,}\.[A-Za-z0-9_-]{20,}` — JWT
- `[A-Za-z0-9+/]{40,}={0,2}` — long base64 (high false-positive, last resort)

Files that warrant a manual look regardless of grep hits: `.env*`, `config/*.yml`, `*.pem`, `*.key`, `*credentials*`, `*secrets*`.

### Phase 2 — Git history

```bash
git rev-list --all | xargs -I{} git grep -E '<pattern>' {} -- '*.json' '*.yml' '*.env*' 2>/dev/null
```

For each hit:
1. Identify the commit hash and author
2. Determine the secret class (rotate-able? revoke-able?)
3. Check whether the commit was ever pushed to a remote you don't fully control

### Phase 3 — Rotate

Order of operations matters. Rotate **before** rewriting history — the old secret is already out there.

1. **Rotate the credential at the source** (cloud console, OAuth app, GitHub).
2. **Audit the credential's recent usage** — was anything done with it since the leak commit?
3. **Update the live deployment** with the new credential.
4. **Confirm the old credential no longer works.**

### Phase 4 — Scrub (only after phase 3)

If history was pushed only to a private remote you control, and the team consents:

```bash
git filter-repo --invert-paths --path <leaked-file>
git push --force-with-lease
```

Notify every collaborator to re-clone — their local history still has the secret.

If the history was ever public, **do not rely on rewriting**. Treat the secret as permanently compromised. Rotation is the only remediation.

## Output

```
# Secrets Scan — <date> — <repo>
- Working tree hits: N (file:line list)
- Git history hits: M (commit:file list)
- Rotated: [list of credentials]
- Scrubbed: [list of paths] | not attempted (history is public)

## Open items
- [ ] <credential> still appears in commit <sha> — rotation required
```

File under `~/.kbot/security-audits/<session-id>/secrets-scan.md`.

## Anti-Patterns

- Rewriting history before rotating — the secret is already public
- Assuming `.gitignore` prevents leaks (it doesn't, retroactively)
- Trusting the regex sweep alone — the high-value secrets often look like nothing
- Telling the team about the leak after rewriting their history

## How kbot Helps

- `bash` — drive `git rev-list`, `git grep`, `git filter-repo`
- `kbot_read` — confirm the hit is a real secret and not a fixture
- `kbot --no-network` — when you must scan a sensitive repo without phoning home
