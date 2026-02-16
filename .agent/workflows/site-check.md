---
description: Verify the live Kernel site is working
---
// turbo-all

## Site Check

1. Check that the site returns HTTP 200:

```bash
curl -s -o /dev/null -w "HTTP %{http_code}\n" https://isaacsight.github.io/does-this-feel-right-/
```

1. Verify the page contains the expected title:

```bash
curl -s https://isaacsight.github.io/does-this-feel-right-/ | grep -o '<title>[^<]*</title>'
```

1. Run the full site test script (requires Node + valid env):

```bash
npx tsx tools/check-site.ts
```

> The site is deployed at `https://isaacsight.github.io/does-this-feel-right-/`. It uses a hash router, so all routes are under the same HTML file.
