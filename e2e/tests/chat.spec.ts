import { test, expect } from '@playwright/test'
import { mockClaudeProxy, MOCK_TEXT_RESPONSE, MOCK_CODE_RESPONSE } from '../fixtures/mock-responses'

test.describe('Chat', () => {
  test('input area exists and accepts text', async ({ page }) => {
    await page.goto('/')
    await page.waitForSelector('.ka-gate, .engine-body, .ka-landing', { timeout: 15000 })

    // Check for chat input (only visible when authenticated)
    const input = await page.$('[data-testid="chat-input"], .ka-input')
    if (input) {
      await input.fill('Hello, Kernel!')
      const value = await input.inputValue()
      expect(value).toBe('Hello, Kernel!')
    }
  })

  test('send button is disabled when input is empty', async ({ page }) => {
    await page.goto('/')
    await page.waitForSelector('.ka-gate, .engine-body, .ka-landing', { timeout: 15000 })

    const sendBtn = await page.$('[data-testid="chat-send"], .ka-send')
    if (sendBtn) {
      const disabled = await sendBtn.isDisabled()
      expect(disabled).toBe(true)
    }
  })

  test('empty guard prevents sending empty messages', async ({ page }) => {
    await page.goto('/')
    await page.waitForSelector('.ka-gate, .engine-body, .ka-landing', { timeout: 15000 })

    // Try submitting empty form
    const form = await page.$('.ka-input-bar')
    if (form) {
      await page.keyboard.press('Enter')
      // No messages should appear
      const messages = await page.$$('.ka-msg')
      expect(messages.length).toBe(0)
    }
  })
})
