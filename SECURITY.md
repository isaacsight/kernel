# Security Policy

## Supported Versions

| Version | Supported |
|---------|-----------|
| 2.19.x  | Yes       |
| 2.18.x  | Yes       |
| < 2.18  | No        |

## Reporting a Vulnerability

If you discover a security vulnerability in K:BOT or the kernel.chat platform, please report it responsibly.

**Do NOT open a public GitHub issue for security vulnerabilities.**

### How to Report

1. **Email**: Send details to **security@kernel.chat**
2. **Include**:
   - Description of the vulnerability
   - Steps to reproduce
   - Potential impact
   - Suggested fix (if any)

### What to Expect

- **Acknowledgment**: Within 48 hours
- **Assessment**: Within 5 business days
- **Fix timeline**: Critical issues within 7 days, others within 30 days
- **Credit**: We credit reporters in our changelog (unless you prefer anonymity)

### Scope

The following are in scope:

- `@kernel.chat/kbot` npm package
- kernel.chat web application
- Supabase edge functions (claude-proxy, stripe-webhook, etc.)
- K:BOT MCP server
- Docker image `isaacsight/kbot`

The following are **out of scope**:

- Third-party dependencies (report to the upstream project)
- Social engineering attacks
- Denial of service attacks
- Issues in third-party AI providers (Anthropic, OpenAI, etc.)

## Security Practices

- API keys encrypted at rest (AES-256-CBC) in `~/.kbot/config.json`
- Destructive bash commands blocked by default (requires explicit confirmation)
- Tool execution timeout: 5 minutes
- No telemetry or data collection without consent
- JWT verification on all authenticated edge functions
- Row Level Security (RLS) on all database tables
- Stripe webhook signature verification

## Hall of Fame

We appreciate security researchers who help keep K:BOT safe. Contributors will be listed here.

*No reports yet — be the first!*
