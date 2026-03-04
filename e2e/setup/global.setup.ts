import { test as setup } from '@playwright/test'
import { loginFree, loginPro, STORAGE_DIR } from '../fixtures/auth'
import fs from 'fs'

// Ensure auth directory exists
setup.beforeAll(() => {
  fs.mkdirSync(STORAGE_DIR, { recursive: true })
})

setup('authenticate free account', async ({ page }) => {
  // Skip auth setup if credentials aren't available
  if (!process.env.TEST_FREE_PASS) {
    console.log('Skipping free account auth — TEST_FREE_PASS not set')
    return
  }
  await loginFree(page)
  await page.context().storageState({ path: `${STORAGE_DIR}/free.json` })
})

setup('authenticate pro account', async ({ page }) => {
  if (!process.env.TEST_PRO_PASS) {
    console.log('Skipping pro account auth — TEST_PRO_PASS not set')
    return
  }
  await loginPro(page)
  await page.context().storageState({ path: `${STORAGE_DIR}/pro.json` })
})
