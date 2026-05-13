---
name: kbot-finance issue
about: Bug, feature request, or RFC discussion specific to @kernel.chat/kbot-finance
title: "[kbot-finance] "
labels: kbot-finance
assignees: ''
---

<!--
For security vulnerabilities, do NOT open a public issue.
Email isaacsight@gmail.com per .github/SECURITY.md.
-->

## Type

- [ ] Bug
- [ ] Feature request
- [ ] RFC / spec discussion (e.g., the content-addressed MCP envelope)
- [ ] Adapter request (new engine — pricing, brokerage, data source)
- [ ] Verifier rule request (encode a regulation)
- [ ] Documentation gap

## Component

Which part of the package?

- [ ] Content-addressed envelope (`src/envelope.ts`)
- [ ] Audit log (`src/audit-log.ts`)
- [ ] Governance / approval tokens (`src/governance.ts`)
- [ ] Regulatory verifier (`src/verifier/`)
- [ ] Polymarket adapter
- [ ] SEC EDGAR adapter
- [ ] MCP server (`src/mcp-server.ts`)
- [ ] kbot integration (`src/kbot-tool.ts`)
- [ ] Annex IV exporter (`src/exporters/annex-iv.ts`)
- [ ] Documentation / spec

## Describe the issue

<!-- For bugs: what you expected, what happened, how to reproduce.
     For features/RFCs: what you want and why.
     For adapter/rule requests: what regulation or API, why it matters. -->

## Environment

- **kbot-finance version**: (from `package.json` or `npm ls @kernel.chat/kbot-finance`)
- **Node version**: (`node --version`)
- **OS**:

## Repro

<!-- For bugs: minimal code or a failing test that demonstrates the issue. -->

```ts
// paste code here
```

## Audit-substrate impact (if applicable)

<!-- If this affects the hash chain, content-addressing, replay semantics,
     or approval token verification, mark this as HIGH SEVERITY and tag
     it in the title.

     If it could lead to a false claim of byte-identical replay,
     PRIORITIZE — that violates the honesty primitive. -->

- [ ] This issue affects the integrity of the audit log / hash chain
- [ ] This issue affects replay determinism claims
- [ ] This issue affects approval token verification
- [ ] None of the above
