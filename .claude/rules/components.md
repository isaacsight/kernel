---
paths:
  - "src/components/**"
  - "src/pages/**"
---
# Component & Page Rules

## Typography

- ALWAYS use EB Garamond for headings and prose content
- ALWAYS use Courier Prime for monospace/code/metadata
- NEVER use system fonts or sans-serif for body text

## Styling

- Use vanilla CSS with design tokens from `src/index.css`
- NEVER use Tailwind, inline styles, or CSS-in-JS
- Reference existing CSS custom properties (e.g., `var(--color-ivory)`)
- Follow the Rubin aesthetic: dark backgrounds, warm accents, contemplative feel

## Component Standards

- All components MUST be TypeScript with explicit prop types
- Use named exports, not default exports
- Use Framer Motion for animations (already installed)
- Touch-first design — minimum tap target 44px
- Generous whitespace — let content breathe

## State

- Use Zustand stores for global state
- Prefer local state (useState) when possible
- Never store derived data in state
