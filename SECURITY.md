# Security Policy

## Reporting a Vulnerability

If you discover a security vulnerability in K:BOT or the kernel.chat platform, please report it responsibly.

**Do NOT open a public GitHub issue for security vulnerabilities.**

### How to Report

Email **kernel.chat@gmail.com** with the following:

- A description of the vulnerability
- Steps to reproduce
- Potential impact assessment
- Suggested fix (if any)

### What Counts as a Security Issue

- Remote code execution or command injection
- Authentication or authorization bypass
- Data exfiltration or unauthorized data access
- API key or credential exposure
- Privilege escalation (free tier accessing pro features without payment)
- Cross-site scripting (XSS) or injection in the web companion
- Memory integrity bypass in kbot's learning system
- Prompt injection that circumvents kbot's safety controls

### Response Timeline

| Severity | Acknowledgment | Resolution Target |
|----------|---------------|-------------------|
| Critical | 48 hours | 7 days |
| High | 48 hours | 14 days |
| Medium | 5 business days | 30 days |
| Low | 5 business days | Next release |

Reporters receive credit in the changelog unless they prefer anonymity.

## Scope

### In Scope

- **K:BOT CLI** (`@kernel.chat/kbot` npm package)
- **Web companion** (kernel.chat web application)
- **Supabase edge functions** (claude-proxy, stripe-webhook, import-conversation, etc.)
- **K:BOT MCP server** and IDE integrations
- **Docker image** (`isaacsight/kbot`)

### Out of Scope

- Third-party AI providers (Anthropic, OpenAI, Google, etc.) -- report to the upstream provider
- User-configured API keys and their associated provider accounts
- Third-party dependencies with known upstream issues -- report to the upstream project
- Social engineering attacks
- Denial of service attacks
- Issues requiring physical access to a user's machine

## Built-in Security Features

K:BOT includes several security mechanisms by design:

- **AES-256-CBC key encryption**: All API keys stored in `~/.kbot/config.json` are encrypted at rest
- **Destructive operation blocking**: Dangerous bash commands (rm -rf, git push --force, etc.) require explicit user confirmation before execution
- **HMAC memory integrity**: Learning data and persistent memory are protected against tampering via HMAC verification
- **Prompt injection detection**: Input analysis guards against prompt injection attempts that try to override agent instructions
- **Tool execution timeout**: All tool executions are capped at 5 minutes to prevent runaway processes
- **JWT verification**: All authenticated edge functions verify JWT tokens before processing requests
- **Row Level Security**: All Supabase database tables enforce RLS policies
- **Stripe webhook signature verification**: Payment webhooks are verified against Stripe's signing secret
- **No telemetry without consent**: K:BOT does not collect usage data unless the user explicitly opts in

## Supported Versions

| Version | Supported |
|---------|-----------|
| 3.x     | Yes       |
| 2.18+   | Security fixes only |
| < 2.18  | No        |

## Hall of Fame

We appreciate security researchers who help keep K:BOT safe. Contributors will be listed here.

*No reports yet -- be the first!*
