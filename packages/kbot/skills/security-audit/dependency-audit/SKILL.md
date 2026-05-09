---
name: dependency-audit
description: Use when reviewing third-party dependencies for known CVEs, suspicious transitive packages, lockfile drift, or license risk. Pairs with local-vulnerability-hunt for full coverage.
version: 1.0.0
author: kbot
license: MIT
metadata:
  kbot:
    tags: [security, dependencies, supply-chain, npm, audit]
    related_skills: [local-vulnerability-hunt, secrets-leak-scan, ship-pipeline]
---

# Dependency Audit

Most exploits in 2026 do not come from your code. They come from a package six links deep that someone trusted on a Tuesday.

## When to Use

- Any time you add or upgrade a dependency
- Before tagging a release
- After a CVE drops in the ecosystem you ship in
- When a lockfile changes in a PR you didn't write
- When `node_modules` is bigger than the rest of the repo

## Iron Laws

```
LOCKFILE IS THE TRUTH. PACKAGE.JSON IS THE WISH.
TRANSITIVE COUNTS. DEEP COUNTS DOUBLE.
```

## Four Phases

### Phase 1 — Inventory

```bash
npm ls --all --json > /tmp/deps.json
```

Then count:
- Total packages (direct + transitive)
- Distinct authors
- Distinct registries (anything other than registry.npmjs.org is worth a second look)
- Packages updated in the last 30 days (fresh = potentially compromised)

### Phase 2 — Known CVEs

```bash
npm audit --json > /tmp/audit.json
```

Triage by severity. Critical and high get fixed this PR; medium gets a ticket; low gets a note. Read every advisory body — `npm audit` lies about exploitability often enough to matter.

### Phase 3 — Provenance

For each package above the trust line (default: anything in `dependencies`, not `devDependencies`):
- Author has a real GitHub presence?
- Repository link resolves to the package source?
- `provenance` field present in the npm metadata?
- Maintainer changed in the last 90 days?

A rotated maintainer + a fresh release is the classic supply-chain shape. Treat it as suspicious until proven otherwise.

### Phase 4 — Lockfile diff

When reviewing a PR:

```bash
git diff main -- package-lock.json | grep -E '^\+.*"version"' | head -50
```

Any new package, any version bump in a security-relevant package (auth, crypto, http, vm, fs), and any registry change deserves a manual look.

## Output

```
# Dependency Audit — <date>
- Direct: N | Transitive: M
- CVEs: critical=X, high=Y, medium=Z, low=W
- Suspicious provenance: [list of packages]
- Lockfile diff: [N packages changed]

## Action items
- [ ] Upgrade <pkg> from <a> to <b> (CVE-XXXX-YYYY)
- [ ] Replace <pkg> with <alt> (unmaintained)
- [ ] Pin <pkg> at <version> (recent maintainer change)
```

File under `~/.kbot/security-audits/<session-id>/dependency-audit.md`.

## Anti-Patterns

- Running `npm audit fix` on autopilot — it can pull breaking majors
- Ignoring transitive vulnerabilities because "they're not in our package.json"
- Trusting the GitHub stars count as a proxy for safety
- Letting Dependabot PRs merge without a human look

## How kbot Helps

- `bash` — drive `npm ls`, `npm audit`, `git diff`
- `kbot_read` — open the package's `index.js` to see what it actually does
- `local-vulnerability-hunt` — once a package is confirmed in scope, audit how *you* use it
