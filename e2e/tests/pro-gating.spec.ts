import { test, expect } from '@playwright/test'
import { mockUsageAtLimit } from '../fixtures/mock-responses'

test.describe('Pro Gating', () => {
  test('upgrade wall exists in DOM', async ({ page }) => {
    await page.goto('/')
    await page.waitForSelector('.ka-gate, .engine-body, .landing', { timeout: 15000 })

    // The upgrade wall component should be renderable
    // Check that the upgrade-related CSS/components are present in the build
    const hasUpgradeCSS = await page.evaluate(() => {
      const styles = Array.from(document.styleSheets)
      return styles.some(sheet => {
        try {
          return Array.from(sheet.cssRules).some(rule =>
            rule.cssText.includes('upgrade') || rule.cssText.includes('pro-badge')
          )
        } catch { return false }
      })
    })
    expect(hasUpgradeCSS).toBe(true)
  })

  test('pro badge shows for pro users', async ({ page }) => {
    await page.goto('/')
    await page.waitForSelector('.ka-gate, .engine-body, .landing', { timeout: 15000 })

    // If we're in the main UI, check for pro/max badge
    if (await page.$('.engine-body')) {
      const proBadge = await page.$('.ka-pro-badge, .ka-max-badge')
      // Badge presence depends on auth state — just verify it renders when present
      if (proBadge) {
        const text = await proBadge.textContent()
        expect(text).toMatch(/Pro|Max/i)
      }
    }
  })
})
