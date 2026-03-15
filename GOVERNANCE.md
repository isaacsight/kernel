# Governance

## Project Structure

K:BOT is maintained by the **kernel.chat group**, led by Isaac Hernandez ([@isaacsight](https://github.com/isaacsight)).

### Roles

| Role | Description | Current |
|------|-------------|---------|
| **Lead Maintainer** | Final say on architecture, releases, and roadmap | Isaac Hernandez |
| **Maintainer** | Merge PRs, triage issues, review contributions | *Open — apply via Discord* |
| **Contributor** | Submit PRs, report bugs, improve docs | Anyone |
| **Community Member** | Use kbot, provide feedback, help others | Everyone |

### How Decisions Are Made

1. **Day-to-day**: Lead maintainer decides
2. **Feature additions**: Open an issue or discussion first. Community feedback is welcome. Lead maintainer has final call.
3. **Breaking changes**: Require a GitHub Discussion with at least 7 days for community input
4. **Governance changes**: Require a GitHub Discussion with at least 14 days for community input

### Becoming a Maintainer

Maintainers are selected based on:
- Consistent, high-quality contributions over 3+ months
- Constructive participation in issues and discussions
- Understanding of the codebase and project goals
- Invitation from the lead maintainer

### Release Process

1. Changes merged to `main`
2. Version bump in `packages/kbot/package.json`
3. `npm publish` from `packages/kbot/`
4. Docker image built and pushed to Docker Hub
5. GitHub Release created with changelog
6. Obsidian vault synced

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md) for how to contribute code, docs, or bug reports.

## Code of Conduct

All participants must follow our [Code of Conduct](CODE_OF_CONDUCT.md).

## Contact

- **GitHub Issues**: [isaacsight/kernel/issues](https://github.com/isaacsight/kernel/issues)
- **Discord**: [Join the community](https://discord.gg/kernel-chat) *(coming soon)*
- **Email**: hello@kernel.chat
