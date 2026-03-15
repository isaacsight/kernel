# Security Policy

## Supported Versions

| Version | Supported |
|---------|-----------|
| 2.x     | Yes       |
| 1.x     | No        |

## Reporting a Vulnerability

**Do not open a public GitHub issue for security vulnerabilities.**

Instead, please report them via one of these channels:

- **Email**: security@kernel.chat
- **GitHub Security Advisory**: [Create a private advisory](https://github.com/isaacsight/kernel/security/advisories/new)

### What to include

- Description of the vulnerability
- Steps to reproduce
- Potential impact
- Suggested fix (if you have one)

### Response timeline

- **Acknowledgment**: within 48 hours
- **Initial assessment**: within 5 business days
- **Fix timeline**: depends on severity, but we target:
  - Critical: 24-48 hours
  - High: 7 days
  - Medium: 30 days
  - Low: next release

## Security Model

### K:BOT CLI

- **API keys** are encrypted at rest using AES-256-CBC (`~/.kbot/config.json`)
- **Config files** are restricted to owner-only permissions (chmod 600)
- **Destructive bash commands** are blocked by default unless `--yes` flag is used
- **Tool execution** has a 5-minute timeout to prevent runaway processes
- **Plugin system** rejects plugins from world/group-writable directories
- **Plugin files** with incorrect permissions are skipped for security
- **Hooks** run with a 10-second timeout and can block operations

### Web Companion (kernel.chat)

- **Supabase Auth** handles authentication (no custom auth)
- **Row Level Security** (RLS) enforces data isolation per user
- **Edge Functions** validate auth before processing
- **Service keys** are never exposed to client-side code
- **CSP headers** restrict script and connection origins

### What We Do NOT Store

- We never log or store your API keys on our servers
- We never send your local file contents to our servers (only to your chosen AI provider)
- Local models (Ollama, embedded) never send data anywhere
- Learning data stays on your machine unless you explicitly enable cloud sync

## Security Best Practices for Users

1. **Use environment variables** for API keys, not config files
2. **Rotate API keys** regularly
3. **Review plugins** before installing — they execute arbitrary code
4. **Use `--safe` mode** when working with sensitive repositories
5. **Keep kbot updated** — `npm update -g @kernel.chat/kbot`

## Acknowledgments

We gratefully acknowledge security researchers who help keep K:BOT safe. Responsible disclosures will be credited in release notes (with permission).
