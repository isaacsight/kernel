// kbot Browser Tool — Playwright-based web browsing
// Requires: npx playwright install (run once)
// Available to all users

import { registerTool } from './index.js'

// Lazy-load playwright to avoid requiring it for non-browser users
let browserInstance: any = null
let pageInstance: any = null

async function getPage(): Promise<any> {
  if (pageInstance) return pageInstance

  try {
    const { chromium } = await import('playwright' as string)
    browserInstance = await chromium.launch({ headless: true })
    const context = await browserInstance.newContext({
      viewport: { width: 1280, height: 720 },
      userAgent: 'kbot/1.0 (Kernel Terminal Agent)',
    })
    pageInstance = await context.newPage()
    return pageInstance
  } catch {
    throw new Error('Playwright not installed. Run: npx playwright install chromium')
  }
}

async function closeBrowser(): Promise<void> {
  if (browserInstance) {
    await browserInstance.close()
    browserInstance = null
    pageInstance = null
  }
}

export function registerBrowserTools(): void {
  registerTool({
    name: 'browser_navigate',
    description: 'Navigate to a URL in a headless browser. Returns the page title and text content.',
    parameters: {
      url: { type: 'string', description: 'URL to navigate to', required: true },
    },
    tier: 'free',
    async execute(args) {
      const url = String(args.url)
      const page = await getPage()
      await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 30_000 })
      const title = await page.title()
      const text = await page.innerText('body').catch(() => '')
      // Truncate to avoid massive responses
      const truncated = text.length > 5000 ? text.slice(0, 5000) + '\n...(truncated)' : text
      return `Title: ${title}\nURL: ${page.url()}\n\n${truncated}`
    },
  })

  registerTool({
    name: 'browser_snapshot',
    description: 'Get the current page\'s accessibility tree (structured text representation).',
    parameters: {},
    tier: 'free',
    async execute() {
      const page = await getPage()
      const snapshot = await page.accessibility.snapshot()
      return JSON.stringify(snapshot, null, 2)
    },
  })

  registerTool({
    name: 'browser_click',
    description: 'Click an element on the page by CSS selector.',
    parameters: {
      selector: { type: 'string', description: 'CSS selector of element to click', required: true },
    },
    tier: 'free',
    async execute(args) {
      const page = await getPage()
      await page.click(String(args.selector), { timeout: 10_000 })
      return `Clicked: ${args.selector}`
    },
  })

  registerTool({
    name: 'browser_type',
    description: 'Type text into a form field identified by CSS selector.',
    parameters: {
      selector: { type: 'string', description: 'CSS selector of input element', required: true },
      text: { type: 'string', description: 'Text to type', required: true },
    },
    tier: 'free',
    async execute(args) {
      const page = await getPage()
      await page.fill(String(args.selector), String(args.text))
      return `Typed into ${args.selector}`
    },
  })

  registerTool({
    name: 'browser_screenshot',
    description: 'Take a screenshot of the current page. Returns base64-encoded PNG.',
    parameters: {
      fullPage: { type: 'boolean', description: 'Capture full page (default: false)' },
    },
    tier: 'free',
    async execute(args) {
      const page = await getPage()
      const buffer = await page.screenshot({
        fullPage: args.fullPage === true,
        type: 'png',
      })
      return `Screenshot captured (${buffer.length} bytes, base64):\n${buffer.toString('base64').slice(0, 200)}...`
    },
  })

  registerTool({
    name: 'browser_close',
    description: 'Close the browser instance.',
    parameters: {},
    tier: 'free',
    async execute() {
      await closeBrowser()
      return 'Browser closed'
    },
  })
}
