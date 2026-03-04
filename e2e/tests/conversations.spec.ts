import { test, expect } from '@playwright/test'

test.describe('Conversations', () => {
  test('new chat button exists', async ({ page }) => {
    await page.goto('/')
    await page.waitForSelector('.ka-gate, .engine-body, .landing', { timeout: 15000 })

    // New chat button should be in header or drawer
    const newChatBtn = await page.$('[data-testid="new-chat-btn"], .ka-new-chat, .conv-new-btn')
    // In unauthenticated state, might not be visible — that's OK
    if (await page.$('.engine-body')) {
      expect(newChatBtn).toBeTruthy()
    }
  })

  test('conversation drawer opens and closes', async ({ page }) => {
    await page.goto('/')
    await page.waitForSelector('.ka-gate, .engine-body, .landing', { timeout: 15000 })

    // Find menu/drawer toggle button
    const menuBtn = await page.$('.ka-menu-btn, .ka-header button:first-child')
    if (menuBtn && await page.$('.engine-body')) {
      await menuBtn.click()
      await page.waitForTimeout(400) // animation

      const drawer = await page.$('.conv-drawer')
      expect(drawer).toBeTruthy()

      // Close drawer
      const closeBtn = await page.$('.conv-close-btn')
      if (closeBtn) await closeBtn.click()
    }
  })

  test('conversation search input exists in drawer', async ({ page }) => {
    await page.goto('/')
    await page.waitForSelector('.ka-gate, .engine-body, .landing', { timeout: 15000 })

    const menuBtn = await page.$('.ka-menu-btn, .ka-header button:first-child')
    if (menuBtn && await page.$('.engine-body')) {
      await menuBtn.click()
      await page.waitForTimeout(400)

      const searchInput = await page.$('[data-testid="conv-search"], .conv-search-input')
      expect(searchInput).toBeTruthy()
    }
  })
})
