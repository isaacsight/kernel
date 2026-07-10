import { defineConfig } from 'vitest/config'
import path from 'path'

export default defineConfig({
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./src/setupTests.ts'],
    // This config serves the web app in src/, so it runs under jsdom.
    // Packages that ship their own vitest config run under environment:'node'
    // and must not be globbed here — jsdom breaks their builtin-module mocks.
    // Run those with `npm test` inside the package.
    // kbot-control-standalone uses `node --test` against dist/, not vitest.
    // kbot-ableton-extension is deliberately absent: it owns no runner, so
    // its tests only execute as part of this root suite.
    exclude: [
      'e2e/**',
      'node_modules/**',
      '**/node_modules/**',
      'legacy/**',
      'kernel-chat-site/**',
      'packages/kbot/**',
      'packages/kbot-finance/**',
      'packages/agent-os/**',
      'packages/kbot-control-standalone/**',
    ],
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
})
