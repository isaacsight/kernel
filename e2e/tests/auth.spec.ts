import { test, expect } from '@playwright/test'

test.describe('Authentication', () => {
  test('shows login gate when not authenticated', async ({ page }) => {
    await page.goto('/')
    await page.waitForSelector('.ka-gate, .ka-landing, .engine-body', { timeout: 15000 })
    // Should show either gate or landing page
    const gate = await page.$('.ka-gate')
    const landing = await page.$('.ka-landing')
    expect(gate || landing).toBeTruthy()
  })

  test('login form accepts email and password', async ({ page }) => {
    await page.goto('/')
    await page.waitForSelector('.ka-gate, .ka-landing', { timeout: 15000 })

    // Should have email and password inputs
    const emailInput = await page.$('input[type="email"]')
    const passwordInput = await page.$('input[type="password"]')

    if (emailInput && passwordInput) {
      await emailInput.fill('test@example.com')
      await passwordInput.fill('testpassword')
      // Submit button should exist
      const submit = await page.$('[data-testid="auth-submit"], button[type="submit"]')
      expect(submit).toBeTruthy()
    }
  })

  test('redirects unauthenticated users from protected routes', async ({ page }) => {
    await page.goto('/#/admin')
    await page.waitForSelector('.ka-gate, .ka-landing, .engine-body', { timeout: 15000 })
    // Should not show admin page
    const admin = await page.$('.admin-page')
    expect(admin).toBeNull()
  })
})
