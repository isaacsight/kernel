import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'
import path from 'path'

// https://vitejs.dev/config/
export default defineConfig({
    plugins: [
        react(),
        VitePWA({
            registerType: 'autoUpdate',
            workbox: {
                // Only precache the HTML shell + static assets — NOT JS/CSS chunks.
                // JS chunks have content-hashed filenames that change every build.
                // Precaching them causes 404s when the old SW serves stale HTML
                // that references chunk hashes from a previous deployment.
                globPatterns: ['**/*.{html,ico,png,svg,woff2}'],
                skipWaiting: true,
                clientsClaim: true,
                cleanupOutdatedCaches: true,
                // Navigation requests always serve the cached HTML shell
                navigateFallback: '/index.html',
                navigateFallbackDenylist: [/^\/api/],
                runtimeCaching: [
                    {
                        // NEVER cache or interfere with Supabase edge function calls.
                        // iOS Safari can fail with "Load failed" if the SW touches these.
                        urlPattern: /^https:\/\/.*\.supabase\.co\/functions\/.*/i,
                        handler: 'NetworkOnly',
                    },
                    {
                        // JS and CSS — always try network first so stale chunks are never served
                        urlPattern: /\.(?:js|css)$/i,
                        handler: 'NetworkFirst',
                        options: {
                            cacheName: 'app-code',
                            expiration: { maxEntries: 100, maxAgeSeconds: 60 * 60 * 24 * 7 },
                            networkTimeoutSeconds: 5,
                        },
                    },
                    {
                        urlPattern: /^https:\/\/fonts\.googleapis\.com\/.*/i,
                        handler: 'CacheFirst',
                        options: { cacheName: 'google-fonts-css', expiration: { maxEntries: 10, maxAgeSeconds: 60 * 60 * 24 * 365 } },
                    },
                    {
                        urlPattern: /^https:\/\/fonts\.gstatic\.com\/.*/i,
                        handler: 'CacheFirst',
                        options: { cacheName: 'google-fonts-woff2', expiration: { maxEntries: 30, maxAgeSeconds: 60 * 60 * 24 * 365 } },
                    },
                    {
                        urlPattern: /^https:\/\/.*\.supabase\.co\/rest\/v1\/.*/i,
                        handler: 'StaleWhileRevalidate',
                        options: { cacheName: 'supabase-api', expiration: { maxEntries: 50, maxAgeSeconds: 300 } },
                    },
                ],
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
                    'vendor-ui': ['framer-motion', 'lucide-react'],
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
