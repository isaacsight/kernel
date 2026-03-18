# Contributing to kbot

Thanks for your interest in contributing to kbot! Every contribution helps make terminal AI better for everyone.

## Quick Start

```bash
# 1. Fork and clone
gh repo fork isaacsight/kernel --clone
cd kernel

# 2. Install dependencies
npm install
cd packages/kbot && npm install

# 3. Build
npm run build

# 4. Run in dev mode
npm run dev

# 5. Run tests
npm run test
```

## What Can I Work On?

- **Good first issues**: Look for the [`good-first-issue`](https://github.com/isaacsight/kernel/labels/good-first-issue) label
- **Help wanted**: Check the [`help-wanted`](https://github.com/isaacsight/kernel/labels/help-wanted) label
- **Bug fixes**: Reproduce and fix any open bug
- **Documentation**: README improvements, inline docs, examples
- **New tools**: Add tools to `packages/kbot/src/tools/`
- **New specialists**: Add agent definitions
- **Tests**: Improve test coverage (vitest)

Or use kbot itself to find opportunities:

```bash
kbot contribute isaacsight/kernel  # Scan for quick wins
```

## Project Structure

```
packages/kbot/src/
├── cli.ts           # CLI entry point (commander)
├── agent.ts         # Agent loop (think → plan → execute → learn)
├── auth.ts          # API key management, provider detection
├── learning.ts      # Learning engine
├── matrix.ts        # Custom agent creation + mimic profiles
├── planner.ts       # Autonomous plan-execute mode
├── tools/           # 284 built-in tools
│   ├── files.ts     # File read/write/glob/grep
│   ├── bash.ts      # Shell execution
│   ├── git.ts       # Git operations
│   ├── audit.ts     # Repository audit tools
│   ├── documents.ts # CSV/data tools
│   ├── contribute.ts# Open source contribution
│   ├── research.ts  # arXiv, PyPI, HuggingFace, etc.
│   ├── containers.ts# Docker, Terraform, etc.
│   ├── creative.ts  # VFX, shaders, procedural
│   ├── gamedev.ts   # 16 game dev tools (8 engines)
│   ├── deploy.ts    # Vercel, Netlify, Cloudflare, Fly.io, Railway
│   ├── database.ts  # Postgres, MySQL, SQLite, Prisma
│   ├── mcp-marketplace.ts # MCP server discovery & install
│   └── ...          # Many more
└── ide/             # IDE integrations (MCP, ACP, LSP)
```

## Adding a New Tool

1. Create or edit a file in `packages/kbot/src/tools/`
2. Export a `registerXxxTools()` function that calls `registerTool()`
3. Import and call it from `packages/kbot/src/tools/index.ts`
4. Each tool needs: `name`, `description`, `parameters` (JSON Schema), `execute` function
5. Add tests

Example:

```typescript
import { registerTool } from './index.js';

export function registerMyTools() {
  registerTool({
    name: 'my_tool',
    description: 'Does something useful',
    parameters: {
      type: 'object',
      properties: {
        input: { type: 'string', description: 'The input' }
      },
      required: ['input']
    },
    execute: async (args: Record<string, unknown>) => {
      const input = String(args.input);
      return { result: `Processed: ${input}` };
    }
  });
}
```

## Adding a New Specialist

1. Add the agent definition in the agent routing system
2. Define its personality, capabilities, and tool access
3. Add routing keywords so the intent classifier can find it
4. Test with: `kbot "/agent your-specialist-name" "test prompt"`

## Code Style

- **TypeScript** — strict mode, no `any` unless truly necessary
- **ESM** — `import`/`export`, not `require`
- **Vanilla CSS** — `ka-` prefix, no Tailwind (web companion only)
- **Naming** — camelCase for functions/variables, PascalCase for types/components
- **Tests** — Vitest, colocated with source (`*.test.ts`)
- **Keep it lean** — kbot has only 8 runtime dependencies. Don't add heavy libraries.

## Commit Messages

Use conventional commits:

```
feat: add new csv export tool
fix: correct model selection for Ollama tags
docs: update README with Docker instructions
test: add tests for audit scoring
chore: bump version to 2.19.1
```

## Pull Request Guidelines

- **One concern per PR** — don't mix features with refactors
- **Describe what and why** — not just what changed, but why
- **Link issues** — use `Fixes #123` or `Closes #123`
- **Screenshots** for UI changes (web companion)
- **Test evidence** — show that your changes work
- Run `npm run build && npm run test && npx tsc --noEmit` before submitting

## Reporting Issues

Open an issue at [github.com/isaacsight/kernel/issues](https://github.com/isaacsight/kernel/issues) with:

- What you expected
- What happened
- Steps to reproduce
- Your Node.js version and OS

## License

By contributing, you agree that your contributions will be licensed under the [MIT License](LICENSE).

## Questions?

- Open a [GitHub Discussion](https://github.com/isaacsight/kernel/discussions)
- Join our [Discord](https://discord.gg/pYJn3hBqnz)
- Email: hello@kernel.chat
