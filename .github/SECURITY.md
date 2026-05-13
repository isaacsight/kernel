# Security Policy

## Reporting a Vulnerability

If you discover a security vulnerability in any package in this repository
(@kernel.chat/kbot, @kernel.chat/kbot-finance, or the kernel.chat web
application), **please do not open a public issue.**

Email **isaacsight@gmail.com** with the subject line:

```
security: <package> — <one-line summary>
```

Include:

- A description of the vulnerability and the conditions required to
  reproduce it.
- The package name and version where you observed it.
- Steps to reproduce (commands, request payloads, code snippets).
- Your assessment of the impact (e.g., remote code execution, data
  disclosure, audit log tampering).
- Any proof-of-concept code or screenshots that help confirm the issue.

You can expect:

- **Acknowledgement within 48 hours.**
- **An initial triage response within 7 days** with a rough timeline.
- **A coordinated disclosure window** — typically 30-90 days depending on
  severity. We'll work with you on the timing.
- **Public credit in the release notes** of the fix (unless you prefer
  to remain anonymous).

## Scope

The following are in scope for vulnerability reports:

- **@kernel.chat/kbot** — the AI agent, its tool surface, BYOK key
  handling, MCP server adapters, computer-use approval gates.
- **@kernel.chat/kbot-finance** — content-addressed envelopes, the
  hash-chained audit log, regulatory verifier rules, the MCP server,
  engine adapters (Polymarket, EDGAR), approval token signing.
- **kernel.chat web application** — the magazine site, Supabase edge
  functions, auth flows, share modal, ChatGPT/Claude conversation
  import.

The following are out of scope:

- Third-party services we integrate with (Anthropic API, OpenAI API,
  Ollama, Polymarket Gamma API, SEC EDGAR). Report those upstream.
- Issues that require a malicious npm package installed alongside
  ours — npm-ecosystem-level threats belong to npm.
- Reports against forks or vendored copies of this code.

## Audit substrate caveat

@kernel.chat/kbot-finance ships as an Apache 2.0 reference
implementation. It has **not been formally audited for production
trading**. If you find an issue specifically in the audit-grade
primitives (hash chain integrity, envelope content-addressing,
approval token verification), please flag the severity as high — a
vulnerability in those primitives undermines the substrate's whole
premise.
