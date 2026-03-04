import { test as base, type Page } from '@playwright/test'

const FREE_EMAIL = process.env.TEST_FREE_EMAIL || 'kernel-test-bot@antigravitygroup.co'
const FREE_PASS = process.env.TEST_FREE_PASS || ''
const PRO_EMAIL = process.env.TEST_PRO_EMAIL || 'kernel-pro-test@antigravitygroup.co'
const PRO_PASS = process.env.TEST_PRO_PASS || ''

export const STORAGE_DIR = 'e2e/.auth'

/** Log in as the free test account */
export async function loginFree(page: Page) {
  await login(page, FREE_EMAIL, FREE_PASS)
}

/** Log in as the Pro test account */
export async function loginPro(page: Page) {
  await login(page, PRO_EMAIL, PRO_PASS)
}

async function login(page: Page, email: string, password: string) {
  await page.goto('/')
  // Wait for auth gate
  await page.waitForSelector('.ka-gate, .engine-body', { timeout: 15000 })

  // If already logged in, skip
  const isLoggedIn = await page.$('.engine-body')
  if (isLoggedIn) return

  // Fill login form
  await page.fill('input[type="email"]', email)
  await page.fill('input[type="password"]', password)
  await page.click('[data-testid="auth-submit"], button[type="submit"]')

  // Wait for main UI
  await page.waitForSelector('.engine-body', { timeout: 20000 })
}

/** Extend base test with authenticated pages */
export const test = base.extend<{ freePage: Page; proPage: Page }>({
  freePage: async ({ browser }, use) => {
    const ctx = await browser.newContext({
      storageState: `${STORAGE_DIR}/free.json`,
    }).catch(() => browser.newContext())
    const page = await ctx.newPage()
    await use(page)
    await ctx.close()
  },
  proPage: async ({ browser }, use) => {
    const ctx = await browser.newContext({
      storageState: `${STORAGE_DIR}/pro.json`,
    }).catch(() => browser.newContext())
    const page = await ctx.newPage()
    await use(page)
    await ctx.close()
  },
})

export { expect } from '@playwright/test'
