# Governance

K:BOT is an open-source project maintained by the kernel.chat group. This document describes how decisions are made and how you can participate.

## Decision-Making

### Day-to-Day

Maintainers merge PRs, triage issues, and make routine decisions. Most changes don't need formal process — if it's a clear improvement, it gets merged.

### Significant Changes

Changes that affect architecture, public API, or project direction go through an **RFC (Request for Comments)** process:

1. Open a GitHub Discussion in the "RFC" category
2. Describe the problem, proposed solution, and alternatives considered
3. Community has 7 days to comment
4. Maintainers make the final call, incorporating feedback

### What Counts as Significant

- New AI provider integrations
- Changes to the tool registration API
- New specialist agent categories
- Breaking changes to CLI commands
- New runtime dependencies
- Changes to the security model

## Roles

### Users

Everyone starts here. Use K:BOT, report bugs, request features, participate in discussions.

### Contributors

Anyone who has had a PR merged. Contributors:
- Are listed in CONTRIBUTORS.md
- Can be assigned to issues
- Have input on RFCs

### Maintainers

Core team members who merge PRs and guide the project. Maintainers:
- Review and merge pull requests
- Triage issues and set priorities
- Make final decisions on RFCs
- Manage releases and deployments
- Ensure security and code quality

**Current maintainers:**
- [@isaacsight](https://github.com/isaacsight) — Project lead

### Becoming a Maintainer

Consistent, high-quality contributions over time. There's no fixed threshold — it's based on trust, judgment, and alignment with project values. Maintainers are invited by existing maintainers.

## Priorities

K:BOT's development priorities, in order:

1. **Stability** — What exists should work reliably
2. **Open Science** — Tools for academic research, reproducibility, and scientific computing
3. **Local-First** — Everything should work offline with local models
4. **Zero Lock-In** — No vendor dependency, no forced upgrades
5. **Extensibility** — Plugins, hooks, and MCP for community innovation
6. **Performance** — Fast startup, lean dependencies, efficient token usage

## Community Spaces

- **GitHub Issues**: Bug reports and feature requests
- **GitHub Discussions**: RFCs, Q&A, and general conversation
- **Discord**: Real-time chat (link in README)
- **Email**: support@kernel.chat

## Conflict Resolution

1. Discuss in the relevant GitHub issue or Discussion
2. If unresolved, maintainers mediate
3. Project lead has final say
4. Code of Conduct applies everywhere

## License

All contributions are licensed under MIT. By contributing, you agree to this.
