Deploy the Kernel project to GitHub Pages.

Steps:

1. Type-check: `npx tsc --noEmit`
2. Build and deploy: `npm run deploy`
3. Wait ~30s, then verify: `curl -s -o /dev/null -w "%{http_code}" https://kernel.chat`

The deploy command runs `tsc && vite build` then pushes `dist/` to the `gh-pages` branch via the `gh-pages` npm package.
