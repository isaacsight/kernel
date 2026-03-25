import { defineConfig } from 'vite'

export default defineConfig({
  base: './',
  build: {
    outDir: 'dist',
    sourcemap: true,
    chunkSizeWarningLimit: 1500, // Phaser is large, suppress warning
  },
})
