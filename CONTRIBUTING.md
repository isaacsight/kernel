# Contributing to K:BOT

Thanks for your interest in contributing to K:BOT. Here's how to get started.

## Setup

```bash
git clone https://github.com/isaacsight/kernel.git
cd kernel/packages/kbot
npm install
npm run dev    # Run in dev mode
```

## Development

```bash
npm run dev          # Run kbot with hot reload (tsx)
npm run build        # Compile TypeScript
npm run test         # Run tests
npm run typecheck    # Type-check only
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
├── tools/           # 60+ built-in tools
│   ├── files.ts     # File read/write/glob/grep
│   ├── bash.ts      # Shell execution
│   ├── git.ts       # Git operations
│   └── ...          # Many more
└── ide/             # IDE integrations (MCP, ACP, LSP)
```

## Adding a New Tool

1. Create or edit a file in `src/tools/`
2. Use `registerTool()` with name, description, parameters, tier, and execute function
3. Register it in `src/tools/index.ts`

Example:

```typescript
import { registerTool } from './index.js'

registerTool({
  name: 'my_tool',
  description: 'What this tool does',
  parameters: {
    input: { type: 'string', description: 'The input', required: true },
  },
  tier: 'free',
  async execute(args) {
    // Do something
    return `Result: ${args.input}`
  },
})
```

## Adding a New Specialist Agent

Edit `src/agents/specialists.ts` (for the web companion) or the agent routing in `src/matrix.ts` (for kbot CLI). Each specialist needs:

- Unique ID
- Name and description
- System prompt with DOMAINS, APPROACH, PERSONALITY, FORMAT sections
- PERSONALITY_PREAMBLE and ARTIFACT_RULES inherited

## Guidelines

- **TypeScript strict mode** — no `any` types, no `@ts-ignore`
- **Tests** — new utilities should have at least 1 test
- **No Tailwind** — web companion uses vanilla CSS with `ka-` prefix
- **Security** — never commit secrets, never use `eval()`, validate inputs
- **Keep it lean** — kbot has only 8 runtime dependencies. Don't add heavy libraries.

## Pull Requests

1. Fork the repo
2. Create a branch (`git checkout -b feat/my-feature`)
3. Make your changes
4. Run `npm run typecheck && npm run test`
5. Commit with a clear message
6. Open a PR against `main`

## Reporting Issues

Open an issue at [github.com/isaacsight/kernel/issues](https://github.com/isaacsight/kernel/issues) with:

- What you expected
- What happened
- Steps to reproduce
- Your Node.js version and OS

## License

By contributing, you agree that your contributions will be licensed under the MIT License.
