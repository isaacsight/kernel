import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  build: {
    outDir: 'dist',
    emptyOutDir: false,
  },
  server: {
    proxy: {
      '/ws': {
        target: 'ws://localhost:8000',
        ws: true
      },
      '/api': {
        target: 'http://localhost:8000'
      }
    }
  }
})
