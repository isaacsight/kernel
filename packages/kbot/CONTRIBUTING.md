# Contributing to K:BOT

Thanks for your interest in contributing to K:BOT.

## Quick Start

```bash
git clone https://github.com/isaacsight/kernel.git
cd kernel/packages/kbot
npm install
npm run dev  # runs kbot in dev mode with tsx
```

## Development

```bash
npm run build      # compile TypeScript
npm run test       # run tests
npm run typecheck  # type-check without emitting
npm run dev        # run in dev mode (tsx)
```

## Project Structure

- `src/cli.ts` — CLI entry point (Commander.js)
- `src/agent.ts` — Agent loop (think → plan → execute → learn)
- `src/tools/` — 214 built-in tools
- `src/ide/` — MCP + ACP servers for IDE integration
- `src/agents/` — Specialist agent definitions

## Adding a Tool

1. Create your tool in `src/tools/your-tool.ts`
2. Export a tools array following the `ToolDefinition` type
3. Register in `src/tools/index.ts`
4. Add a test in `src/tools/your-tool.test.ts`

## Adding a Specialist Agent

1. Add agent definition in `src/agents/`
2. Include: ID, name, description, system prompt, keyword map
3. Register in the agent router

## Guidelines

- TypeScript strict mode
- ESM modules (`import`/`export`, not `require`)
- No Tailwind, no React — this is a CLI tool
- Keep tools flat (no nested parameter schemas)
- Tests with vitest
- Run `npm run typecheck` before submitting PRs

## License

MIT — your contributions will be under the same license.
