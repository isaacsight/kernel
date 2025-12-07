/** @type {import('tailwindcss').Config} */
module.exports = {
    content: ["./src/**/*.{ts,tsx}"],
    theme: {
        extend: {
            colors: {
                research: {
                    bg: 'var(--research-bg)',
                    card: 'var(--research-card-bg)',
                    border: 'var(--research-border)',
                    accent: 'var(--research-accent)',
                    text: 'var(--research-text)',
                    muted: 'var(--research-text-muted)',
                }
            },
            fontFamily: {
                mono: ['var(--mono-font)', 'monospace'],
            }
        },
    },
    plugins: [],
}
