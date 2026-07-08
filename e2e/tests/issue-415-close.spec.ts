import { test, expect } from '@playwright/test'

test.describe('ISSUE 415 — close primitive', () => {
  test('reader can show more items, then stop, and gets a receipt', async ({ page }) => {
    await page.goto('/issues/415')
    await expect(page.getByRole('button', { name: 'Show me one more' })).toBeVisible()
    await expect(page.getByRole('button', { name: "I'll stop here" })).toBeVisible()

    await page.getByRole('button', { name: 'Show me one more' }).click()
    await page.getByRole('button', { name: 'Show me one more' }).click()
    // Scope to the live readout — CloseFeature also renders a `.pop-close-print-snapshot`
    // paragraph with the same "3 ITEMS" text (hidden via CSS + aria-hidden, shown only at
    // print time). getByText() matches DOM text regardless of visibility, so an unscoped
    // query matches both and trips Playwright's strict-mode ambiguity check.
    await expect(page.locator('.pop-close-readout').getByText('3 ITEMS')).toBeVisible()

    await page.getByRole('button', { name: "I'll stop here" }).click()
    await expect(page.getByText('You chose to stop here.')).toBeVisible()
    await expect(page.getByRole('button', { name: 'Show me one more' })).toHaveCount(0)
  })

  test('mobile viewport renders both controls at equal size', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 })
    await page.goto('/issues/415')
    const more = page.getByRole('button', { name: 'Show me one more' })
    const stop = page.getByRole('button', { name: "I'll stop here" })
    await expect(more).toBeVisible()
    await expect(stop).toBeVisible()
    const moreBox = await more.boundingBox()
    const stopBox = await stop.boundingBox()
    expect(moreBox?.height).toBeCloseTo(stopBox?.height ?? 0, 0)
  })

  test('zero console errors on the page', async ({ page }) => {
    const errors: string[] = []
    page.on('console', (msg) => {
      if (msg.type() === 'error') errors.push(msg.text())
    })
    await page.goto('/issues/415')
    await page.getByRole('button', { name: 'Show me one more' }).click()
    await page.getByRole('button', { name: "I'll stop here" }).click()
    expect(errors).toEqual([])
  })
})
