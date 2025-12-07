
# Research-Grade AI Tooling Suite

This monorepo contains a set of high-performance tools for AI research, built with Next.js App Router, Tailwind CSS, and TypeScript.

## Apps

| App | Path | Port | Description |
|-----|------|------|-------------|
| **Model Debugger** | `apps/debugger` | 3000 | Side-by-side LLM visualization, streaming token diffs, and latency metrics. |
| **Context Viewer** | `apps/context-viewer` | 3001 | Education tool visualizing sliding context windows and attention mechanisms. |

## Packages

| Package | Path | Description |
|---------|------|-------------|
| **UI Library** | `packages/ui` | Shared component primitives (TokenStreamViewer, MetricsCard). |
| **Adapters** | `packages/adapters` | Model interfaces and Mock implementations. |
| **Utils** | `packages/utils` | Shared tokenization and diffing logic. |

## Getting Started

### Prerequisites
- Node.js >= 18
- pnpm (recommended)

### Installation
```bash
pnpm install
```

### Development
Start all apps in parallel:
```bash
pnpm dev
# or using Turbo
npx turbo run dev
```

### Build
```bash
npx turbo run build
```

## Features

- **Real-time Streaming**: Simulated WebSocket streaming in Debugger.
- **Token Diffing**: Visual highlighting of added/removed tokens.
- **Context Animation**: Sliding window visualization in Context Viewer.
- **Modular Architecture**: Shared UI and logic across apps.

## Integration
The tools are linked from the main blog's "Projects" page (`docs/projects.html`), which assumes the apps are running on their default ports (3000, 3001) for local demos.
