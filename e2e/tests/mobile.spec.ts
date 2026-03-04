import { test, expect, devices } from '@playwright/test'

test.use(devices['iPhone 14'])

test('bottom tab bar renders on mobile', async ({ page }) => {
  await page.goto('/')
  await page.waitForSelector('.ka-gate, .engine-body, .landing', { timeout: 15000 })

  // On mobile viewport, bottom tab bar should be visible (when authenticated)
  if (await page.$('.engine-body')) {
    const tabBar = await page.$('.ka-bottom-tab-bar, .bottom-tab-bar')
    expect(tabBar).toBeTruthy()
  }
})
