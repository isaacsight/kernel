---
description: Build and deploy to GitHub Pages
---
// turbo-all

## Deploy to GitHub Pages

1. Type-check the project:

```bash
npx tsc --noEmit
```

1. Build and deploy:

```bash
npm run deploy
```

1. Verify the live site loaded (wait ~30s for GitHub Pages to update):

```bash
curl -s -o /dev/null -w "%{http_code}" https://isaacsight.github.io/does-this-feel-right-/
```

> The deploy command runs `npm run build` (tsc + vite build) then pushes `dist/` to the `gh-pages` branch via the `gh-pages` npm package.
