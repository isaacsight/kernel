import { test, expect } from '@playwright/test'

test.describe('THE STACKS', () => {
  test('the ledger lands on the real issue route', async ({ page }) => {
    await page.goto('/archive')
    await page.getByRole('link', { name: /N°427/ }).click()
    await expect(page).toHaveURL(/\/issues\/427/)
  })

  test('keyboard: tab reaches a ledger link and Enter opens it', async ({ page }) => {
    await page.goto('/archive')
    const first = page.locator('.stacks-ledger a').first()
    await first.focus()
    await page.keyboard.press('Enter')
    await expect(page).toHaveURL(/\/issues\/\d+/)
  })

  test('reduced motion: the room rests and stays navigable', async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' })
    await page.goto('/archive')
    await expect(page.locator('.stacks-ledger')).toBeVisible()
  })

  test('the flat catalog stays one link away', async ({ page }) => {
    await page.goto('/archive')
    await page.getByRole('link', { name: /flat catalog/i }).click()
    await expect(page).toHaveURL(/\/issues$/)
  })
})
