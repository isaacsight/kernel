import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'

// https://vitejs.dev/config/
export default defineConfig({
    plugins: [react()],
    base: '/does-this-feel-right-/',
    resolve: {
        alias: {
            '@': path.resolve(__dirname, './src'),
        },
    },
    server: {
        port: 5173,
        host: true,
        allowedHosts: [
            'isaacs-macbook-pro.tailb0afb0.ts.net',
            'localhost',
            '127.0.0.1'
        ]
    }
})
