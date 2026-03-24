import { test, expect } from '@playwright/test'

/** Wait for the app to finish loading (splash → landing/gate or main UI) */
async function waitForApp(page: import('@playwright/test').Page) {
  // Wait for any app state: landing page, auth gate, main chat, or loading splash
  await page.waitForSelector('.ka-landing, .ka-gate, .engine-body, .ka-loading-splash', { timeout: 15000 })
  // If loading splash is showing, wait for it to resolve
  try {
    await page.waitForSelector('.ka-landing, .ka-gate, .engine-body', { timeout: 10000 })
  } catch {
    // App may still be on splash — that's OK for some tests
  }
}

test.describe('Visual Regression — Login Gate', () => {
  // Screenshot baselines are platform-specific (font rendering differs across OSes).
  // Baselines exist only for darwin; CI runs on linux. Skip screenshot comparisons in CI
  // to avoid guaranteed mismatches. Run locally with `npx playwright test --update-snapshots`
  // to regenerate baselines when the UI changes.
  test.skip(!!process.env.CI, 'Screenshot baselines are platform-specific — skipped in CI')

  test('renders app initial state in light mode', async ({ page }) => {
    await page.goto('/')
    await waitForApp(page)
    await expect(page).toHaveScreenshot('app-initial-light.png', {
      maxDiffPixelRatio: 0.02,
    })
  })

  test('renders app initial state in dark mode', async ({ page }) => {
    await page.goto('/')
    await waitForApp(page)
    await page.evaluate(() => {
      document.documentElement.setAttribute('data-theme', 'dark')
    })
    await page.waitForTimeout(400)
    await expect(page).toHaveScreenshot('app-initial-dark.png', {
      maxDiffPixelRatio: 0.02,
    })
  })
})

test.describe('Visual Regression — Favicon & Assets', () => {
  test('favicon loads with amethyst palette', async ({ page }) => {
    const response = await page.goto('/favicon.svg')
    expect(response?.status()).toBe(200)
    const body = await response?.text()
    expect(body).toContain('#6B5B95') // Amethyst
    expect(body).toContain('#D4C5A9') // Sepia
  })

  test('logo mark loads with ink drop', async ({ page }) => {
    const response = await page.goto('/logo-mark.svg')
    expect(response?.status()).toBe(200)
    const body = await response?.text()
    expect(body).toContain('EB Garamond')
    expect(body).toContain('#6B5B95')
  })

  test('manifest has correct theme colors', async ({ page }) => {
    const response = await page.goto('/manifest.webmanifest')
    expect(response?.status()).toBe(200)
    const manifest = await response?.json()
    expect(manifest.theme_color).toBe('#1F1E1D')
    expect(manifest.background_color).toBe('#FAF9F6')
    expect(manifest.icons.length).toBeGreaterThanOrEqual(4)
  })
})

test.describe('Visual Regression — Typography', () => {
  test('uses EB Garamond for body text', async ({ page }) => {
    await page.goto('/')
    await waitForApp(page)
    const fontFamily = await page.evaluate(() => {
      const body = document.querySelector('body')
      return body ? getComputedStyle(body).fontFamily : ''
    })
    expect(fontFamily).toContain('EB Garamond')
  })
})

test.describe('Visual Regression — Color Palette', () => {
  test('background uses ivory (#FAF9F6)', async ({ page }) => {
    await page.goto('/')
    await waitForApp(page)
    const bg = await page.evaluate(() => {
      const body = document.querySelector('body')
      return body ? getComputedStyle(body).backgroundColor : ''
    })
    // rgb(250, 249, 246) = #FAF9F6
    expect(bg).toBe('rgb(250, 249, 246)')
  })

  test('dark mode uses warm brown (#1C1A18)', async ({ page }) => {
    await page.goto('/')
    await waitForApp(page)
    await page.evaluate(() => {
      document.documentElement.setAttribute('data-theme', 'dark')
    })
    await page.waitForTimeout(300)
    const bg = await page.evaluate(() => {
      const body = document.querySelector('body')
      return body ? getComputedStyle(body).backgroundColor : ''
    })
    // rgb(28, 26, 24) = #1C1A18
    expect(bg).toBe('rgb(28, 26, 24)')
  })

  test('primary color is amethyst (not old indigo)', async ({ page }) => {
    await page.goto('/')
    await waitForApp(page)
    const primary = await page.evaluate(() => {
      const root = getComputedStyle(document.documentElement)
      return root.getPropertyValue('--rubin-primary').trim()
    })
    expect(primary).toBe('#6B5B95')
  })
})

test.describe('Visual Regression — CSS Tokens', () => {
  test('spacing tokens are defined', async ({ page }) => {
    await page.goto('/')
    await waitForApp(page)
    const tokens = await page.evaluate(() => {
      const root = getComputedStyle(document.documentElement)
      return {
        spaceXs: root.getPropertyValue('--space-xs').trim(),
        spaceSm: root.getPropertyValue('--space-sm').trim(),
        spaceMd: root.getPropertyValue('--space-md').trim(),
        spaceLg: root.getPropertyValue('--space-lg').trim(),
        spaceXl: root.getPropertyValue('--space-xl').trim(),
        space2xl: root.getPropertyValue('--space-2xl').trim(),
      }
    })
    expect(tokens.spaceXs).toBe('4px')
    expect(tokens.spaceSm).toBe('8px')
    expect(tokens.spaceMd).toBe('12px')
    expect(tokens.spaceLg).toBe('16px')
    expect(tokens.spaceXl).toBe('24px')
    expect(tokens.space2xl).toBe('32px')
  })

  test('radius tokens are defined', async ({ page }) => {
    await page.goto('/')
    await waitForApp(page)
    const tokens = await page.evaluate(() => {
      const root = getComputedStyle(document.documentElement)
      return {
        radiusXs: root.getPropertyValue('--radius-xs').trim(),
        radiusSm: root.getPropertyValue('--radius-sm').trim(),
        radiusMd: root.getPropertyValue('--radius-md').trim(),
        radiusLg: root.getPropertyValue('--radius-lg').trim(),
      }
    })
    expect(tokens.radiusXs).toBe('3px')
    expect(tokens.radiusSm).toBe('6px')
    expect(tokens.radiusMd).toBe('10px')
    expect(tokens.radiusLg).toBe('20px')
  })

  test('dark mode tokens are defined when theme is dark', async ({ page }) => {
    await page.goto('/')
    await waitForApp(page)
    await page.evaluate(() => {
      document.documentElement.setAttribute('data-theme', 'dark')
    })
    await page.waitForTimeout(100)
    const tokens = await page.evaluate(() => {
      const root = getComputedStyle(document.documentElement)
      return {
        darkBg: root.getPropertyValue('--dark-bg').trim(),
        darkText: root.getPropertyValue('--dark-text').trim(),
        darkBorder: root.getPropertyValue('--dark-border').trim(),
      }
    })
    expect(tokens.darkBg).toBe('#1C1A18')
    expect(tokens.darkText).toBe('#e8e6e3')
    expect(tokens.darkBorder).toBe('#36322E')
  })
})
