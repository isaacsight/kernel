import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  css: {
    postcss: './postcss.config.js',
  },
  server: {
    host: true,
    proxy: {
      '/execute': {
        target: 'http://localhost:8001',
        changeOrigin: true
      },
      '/ws': {
        target: 'http://localhost:8001',
        ws: true,
        changeOrigin: true,
        rewrite: (path) => path
      }
    }
  },
  build: {
    rollupOptions: {
      output: {
        manualChunks: {
          'vendor-3d': ['three', '@react-three/fiber', '@react-three/drei'],
          'vendor-motion': ['framer-motion'],
          'vendor-icons': ['lucide-react']
        }
      }
    },
    chunkSizeWarningLimit: 1000
  }
})
