---
name: threat-model-quickdraw
description: Use when designing a new feature or reviewing an architectural change. STRIDE-lite, fits in a single sitting, produces a written artifact.
version: 1.0.0
author: kbot
license: MIT
metadata:
  kbot:
    tags: [security, threat-model, design-review, stride]
    related_skills: [local-vulnerability-hunt, dependency-audit, ship-pipeline]
---

# Threat Model Quickdraw

A real threat model takes a week and a whiteboard. A quickdraw takes thirty minutes and a markdown file. Most features deserve the latter; very few warrant the former.

## When to Use

- Before writing the first line of a new feature that touches auth, money, PII, or third-party data
- Before committing an architectural change that adds a network boundary
- During PR review when the diff crosses a trust boundary
- After a security incident, on the affected subsystem

Skip when the change is internal-only, has no user input, and touches no secrets.

## Iron Laws

```
EVERY EXTERNAL INPUT IS HOSTILE UNTIL PROVEN OTHERWISE.
EVERY TRUST BOUNDARY GETS A NAMED CHECK.
EVERY MITIGATION GETS A TEST.
```

## Four Phases

### Phase 1 — Diagram

A box-and-arrow diagram in ASCII or markdown. Five-minute exercise. Include:
- Every actor (user, admin, service, attacker)
- Every data store (database, blob, queue, cache)
- Every trust boundary as a dashed line
- Every flow as a labeled arrow

If you cannot draw it in five minutes, the feature is too big — split it.

### Phase 2 — STRIDE walk

For each component and each flow, ask the six questions in order:

| Letter | Threat | Sample question |
|---|---|---|
| **S** | Spoofing | Can someone claim to be a different actor? |
| **T** | Tampering | Can data be modified in transit or at rest? |
| **R** | Repudiation | Can an actor deny they took the action? |
| **I** | Information disclosure | Can secrets or PII leak via this path? |
| **D** | Denial of service | Can an attacker exhaust this resource cheaply? |
| **E** | Elevation of privilege | Can an actor gain rights they shouldn't have? |

For each "yes," write a one-line threat and a one-line mitigation. Park "maybe" entries in an Open Questions section.

### Phase 3 — Rank and cut

Rank threats by `(likelihood × impact)`. Address the top third now; ticket the middle third; document the bottom third as accepted risk with a name attached.

### Phase 4 — Record

Output goes to `docs/threat-models/<feature>.md` checked into the repo, plus a JSONL trail at `~/.kbot/security-audits/<session-id>/threat-model.jsonl`.

## Output Template

```markdown
# Threat Model — <feature> — <date>

## Diagram
<ascii box-and-arrow>

## Trust boundaries
1. <boundary name> — <check enforced>
2. ...

## Threats (STRIDE)
| ID | Letter | Component | Threat | Likelihood | Impact | Mitigation | Status |
|---|---|---|---|---|---|---|---|
| T-001 | S | login API | session token guessable | M | H | rotate to 256-bit random | now |
| T-002 | I | logs | PII written to stdout | H | H | redact in formatter | now |
| ... | | | | | | | |

## Accepted risks
- <risk> (rationale, owner)

## Open questions
- <question> (assigned to)
```

## Anti-Patterns

- Treating the model as one-and-done — re-walk on any architectural change
- STRIDE-checking each component in isolation while ignoring the flows between them
- Writing mitigations that cannot be tested
- Letting "we'll think about it later" be the resolution for a HIGH-impact threat

## How kbot Helps

- `kbot --plan` — read-only mode for the diagram phase
- `kbot_write` — produce the markdown artifact
- `local-vulnerability-hunt` — once the model exists, audit the implementation against it
- `ship-pipeline` — gate releases on the threat model existing
