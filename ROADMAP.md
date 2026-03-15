# K:BOT Roadmap

> Last updated: March 15, 2026

This roadmap reflects the current direction of K:BOT. Priorities may shift based on community feedback.

## Current: v2.19.0 (March 2026)

- 39 specialist agents, 228 tools, 20 providers
- Embedded llama.cpp inference (no Ollama needed)
- `kbot audit <repo>` — full 6-category repo audit with grade A-F
- `kbot share` — share conversations as branded GitHub Gists
- `kbot contribute` — find issues and submit PRs to open source projects
- Document tools: CSV read/query/write, data transform, report/invoice generation
- VFX tools: Houdini VEX, GLSL shaders, FFmpeg, ImageMagick, Blender
- Research tools: arXiv, Semantic Scholar, HuggingFace, PyPI, CRAN, Cargo, NASA

## Next: v2.20.0 (Q2 2026)

### Community & Ecosystem
- [ ] Discord community server
- [ ] GitHub Discussions enabled
- [ ] Issue templates and PR templates
- [ ] `good-first-issue` labels on 20+ issues
- [ ] awesome-kbot community tools list

### CLI Improvements
- [ ] `kbot upgrade` — open browser to kernel.chat pricing
- [ ] `kbot billing` — show plan and usage from terminal
- [ ] `kbot bench` — run benchmarks (SWE-bench, HumanEval, polyglot)
- [ ] `kbot oss <repo>` — open source presence tracker

### Integration
- [ ] GitHub App (install-and-forget distribution)
- [ ] VS Code extension marketplace
- [ ] JetBrains plugin marketplace
- [ ] npm profile page improvements

## Future: v3.0 (2026)

### Mobile
- [ ] iOS app via Capacitor (PWA wrapper)
- [ ] Android app via Capacitor
- [ ] Biometric auth (Face ID / fingerprint)
- [ ] Deep linking (kernel.chat URLs → native app)

### Platform
- [ ] Team workspaces (shared memory, shared agents)
- [ ] Custom agent marketplace
- [ ] Plugin ecosystem with community contributions
- [ ] Webhook integrations (Slack, Discord, email)

### Intelligence
- [ ] Multi-modal reasoning (images, audio, video)
- [ ] Long-term project memory (weeks → months context)
- [ ] Cross-project learning (patterns from one repo help another)
- [ ] Autonomous background agents (monitor, alert, fix)

## How to Influence the Roadmap

1. **Vote on issues** — thumbs-up (👍) issues you care about
2. **Open a discussion** — propose features in GitHub Discussions
3. **Contribute** — PRs that align with the roadmap get priority review
4. **Join Discord** — real-time feedback and feature requests

## Principles

- **Local-first**: Everything that can run locally, does
- **Zero lock-in**: BYOK, 20 providers, export everything
- **Developer experience**: Fast, simple, no boilerplate
- **Open source**: MIT licensed, community-driven
