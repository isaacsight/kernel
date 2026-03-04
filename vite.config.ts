import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'
import path from 'path'

// https://vitejs.dev/config/
export default defineConfig({
    define: {
        __BUILD_TIME__: JSON.stringify(Date.now().toString(36)),
    },
    plugins: [
        react(),
        VitePWA({
            strategies: 'injectManifest',
            srcDir: 'src',
            filename: 'sw.ts',
            registerType: 'autoUpdate',
            injectManifest: {
                // Only precache the HTML shell + static assets — NOT JS/CSS chunks.
                // JS chunks have content-hashed filenames that change every build.
                globPatterns: ['**/*.{html,ico,png,svg,woff2}'],
            },
            manifest: {
                name: 'Kernel',
                short_name: 'Kernel',
                description: 'A personal AI that learns who you are and gets better with every conversation.',
                theme_color: '#1F1E1D',
                background_color: '#FAF9F6',
                display: 'standalone',
                orientation: 'portrait',
                start_url: '/',
                scope: '/',
                icons: [
                    { src: 'logo-mark-192.png', sizes: '192x192', type: 'image/png' },
                    { src: 'logo-mark-512.png', sizes: '512x512', type: 'image/png' },
                    { src: 'logo-maskable.svg', sizes: 'any', type: 'image/svg+xml', purpose: 'maskable' },
                    { src: 'favicon.svg', sizes: 'any', type: 'image/svg+xml' },
                ],
            },
        }),
    ],
    base: '/',
    resolve: {
        alias: {
            '@': path.resolve(__dirname, './src'),
        },
    },
    build: {
        rollupOptions: {
            output: {
                manualChunks: {
                    'vendor-react': ['react', 'react-dom', 'react-router-dom'],
                    'vendor-supabase': ['@supabase/supabase-js'],
                    'vendor-ui': ['motion'],
                    'vendor-analytics': ['posthog-js', '@sentry/react'],
                    'vendor-markdown': ['react-markdown'],
                },
            },
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
