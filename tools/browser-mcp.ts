#!/usr/bin/env npx tsx
// Browser MCP Server — connects to Chrome DevTools Protocol
// Requires Chrome launched with: /Applications/Google\ Chrome.app/Contents/MacOS/Google\ Chrome --remote-debugging-port=9222
// Or: open -a "Google Chrome" --args --remote-debugging-port=9222

import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js'
import puppeteer, { type Browser, type Page } from 'puppeteer-core'
import { z } from 'zod'

const CDP_URL = process.env.CDP_URL || 'http://127.0.0.1:9222'

let browser: Browser | null = null
let currentPage: Page | null = null
const consoleLogs: { level: string; text: string; timestamp: number }[] = []

async function ensureBrowser(): Promise<Browser> {
  if (browser?.connected) return browser
  browser = await puppeteer.connect({ browserURL: CDP_URL })
  return browser
}

async function getActivePage(): Promise<Page> {
  if (currentPage && !currentPage.isClosed()) return currentPage
  const b = await ensureBrowser()
  const pages = await b.pages()
  currentPage = pages[pages.length - 1] || (await b.newPage())
  // Attach console listener
  attachConsoleListener(currentPage)
  return currentPage
}

function attachConsoleListener(page: Page) {
  page.removeAllListeners('console')
  page.on('console', (msg) => {
    consoleLogs.push({
      level: msg.type(),
      text: msg.text(),
      timestamp: Date.now(),
    })
    // Keep last 500 logs
    if (consoleLogs.length > 500) consoleLogs.splice(0, consoleLogs.length - 500)
  })
  page.removeAllListeners('pageerror')
  page.on('pageerror', (err) => {
    consoleLogs.push({
      level: 'error',
      text: `[PageError] ${err.message}`,
      timestamp: Date.now(),
    })
  })
}

// ─── MCP Server ───────────────────────────────────────────

const server = new McpServer({
  name: 'browser',
  version: '1.0.0',
})

// Tool: get_console_logs
server.tool(
  'get_console_logs',
  'Get recent browser console logs (errors, warnings, info). Optionally filter by level.',
  {
    level: z.enum(['all', 'log', 'info', 'warn', 'warning', 'error', 'debug']).optional().describe('Filter by log level'),
    last: z.number().optional().describe('Number of recent logs to return (default 50)'),
    clear: z.boolean().optional().describe('Clear logs after reading'),
  },
  async ({ level = 'all', last = 50, clear = false }) => {
    await getActivePage()
    let logs = [...consoleLogs]
    if (level !== 'all') {
      logs = logs.filter((l) => l.level === level)
    }
    logs = logs.slice(-last)
    if (clear) consoleLogs.length = 0
    const text = logs.length === 0
      ? 'No console logs captured.'
      : logs.map((l) => `[${new Date(l.timestamp).toISOString().slice(11, 23)}] [${l.level.toUpperCase()}] ${l.text}`).join('\n')
    return { content: [{ type: 'text' as const, text }] }
  }
)

// Tool: execute_js
server.tool(
  'execute_js',
  'Execute JavaScript in the browser page and return the result.',
  {
    code: z.string().describe('JavaScript code to execute in the page context'),
  },
  async ({ code }) => {
    const page = await getActivePage()
    try {
      const result = await page.evaluate(code)
      const text = result === undefined ? 'undefined' : JSON.stringify(result, null, 2)
      return { content: [{ type: 'text' as const, text }] }
    } catch (err) {
      return { content: [{ type: 'text' as const, text: `Error: ${err instanceof Error ? err.message : String(err)}` }], isError: true }
    }
  }
)

// Tool: screenshot
server.tool(
  'screenshot',
  'Take a screenshot of the current browser page. Returns base64 PNG.',
  {
    fullPage: z.boolean().optional().describe('Capture full scrollable page (default false)'),
    selector: z.string().optional().describe('CSS selector to screenshot a specific element'),
  },
  async ({ fullPage = false, selector }) => {
    const page = await getActivePage()
    let buffer: Buffer
    if (selector) {
      const el = await page.$(selector)
      if (!el) return { content: [{ type: 'text' as const, text: `Element not found: ${selector}` }], isError: true }
      buffer = Buffer.from(await el.screenshot())
    } else {
      buffer = Buffer.from(await page.screenshot({ fullPage }))
    }
    return {
      content: [{
        type: 'image' as const,
        data: buffer.toString('base64'),
        mimeType: 'image/png',
      }],
    }
  }
)

// Tool: navigate
server.tool(
  'navigate',
  'Navigate the browser to a URL.',
  {
    url: z.string().describe('URL to navigate to'),
    waitFor: z.enum(['load', 'domcontentloaded', 'networkidle0', 'networkidle2']).optional().describe('Wait condition (default load)'),
  },
  async ({ url, waitFor = 'load' }) => {
    const page = await getActivePage()
    await page.goto(url, { waitUntil: waitFor })
    return { content: [{ type: 'text' as const, text: `Navigated to ${url}` }] }
  }
)

// Tool: get_page_info
server.tool(
  'get_page_info',
  'Get current page URL, title, and metadata.',
  {},
  async () => {
    const page = await getActivePage()
    const info = await page.evaluate(() => ({
      url: window.location.href,
      title: document.title,
      readyState: document.readyState,
      bodyLength: document.body?.innerHTML?.length || 0,
    }))
    return { content: [{ type: 'text' as const, text: JSON.stringify(info, null, 2) }] }
  }
)

// Tool: get_elements
server.tool(
  'get_elements',
  'Query DOM elements by CSS selector and return their text/attributes.',
  {
    selector: z.string().describe('CSS selector'),
    limit: z.number().optional().describe('Max elements to return (default 10)'),
  },
  async ({ selector, limit = 10 }) => {
    const page = await getActivePage()
    const elements = await page.evaluate(
      (sel: string, lim: number) => {
        const els = Array.from(document.querySelectorAll(sel)).slice(0, lim)
        return els.map((el) => ({
          tag: el.tagName.toLowerCase(),
          id: el.id || undefined,
          class: el.className || undefined,
          text: (el as HTMLElement).innerText?.slice(0, 200) || '',
          disabled: (el as HTMLButtonElement).disabled || undefined,
          href: (el as HTMLAnchorElement).href || undefined,
        }))
      },
      selector,
      limit
    )
    return { content: [{ type: 'text' as const, text: elements.length === 0 ? `No elements found: ${selector}` : JSON.stringify(elements, null, 2) }] }
  }
)

// Tool: click
server.tool(
  'click',
  'Click an element on the page by CSS selector.',
  {
    selector: z.string().describe('CSS selector of the element to click'),
  },
  async ({ selector }) => {
    const page = await getActivePage()
    try {
      await page.click(selector)
      return { content: [{ type: 'text' as const, text: `Clicked: ${selector}` }] }
    } catch (err) {
      return { content: [{ type: 'text' as const, text: `Click failed: ${err instanceof Error ? err.message : String(err)}` }], isError: true }
    }
  }
)

// Tool: type_text
server.tool(
  'type_text',
  'Type text into an input field.',
  {
    selector: z.string().describe('CSS selector of the input'),
    text: z.string().describe('Text to type'),
    clear: z.boolean().optional().describe('Clear the field first (default true)'),
  },
  async ({ selector, text, clear = true }) => {
    const page = await getActivePage()
    if (clear) {
      await page.click(selector, { count: 3 })
    }
    await page.type(selector, text)
    return { content: [{ type: 'text' as const, text: `Typed into ${selector}` }] }
  }
)

// Tool: list_pages
server.tool(
  'list_pages',
  'List all open browser tabs/pages.',
  {},
  async () => {
    const b = await ensureBrowser()
    const pages = await b.pages()
    const infos = await Promise.all(
      pages.map(async (p, i) => ({
        index: i,
        url: p.url(),
        title: await p.title(),
        active: p === currentPage,
      }))
    )
    return { content: [{ type: 'text' as const, text: JSON.stringify(infos, null, 2) }] }
  }
)

// Tool: switch_tab
server.tool(
  'switch_tab',
  'Switch to a different browser tab by index.',
  {
    index: z.number().describe('Tab index (from list_pages)'),
  },
  async ({ index }) => {
    const b = await ensureBrowser()
    const pages = await b.pages()
    if (index < 0 || index >= pages.length) {
      return { content: [{ type: 'text' as const, text: `Invalid tab index. ${pages.length} tabs open.` }], isError: true }
    }
    currentPage = pages[index]
    attachConsoleListener(currentPage)
    await currentPage.bringToFront()
    consoleLogs.length = 0 // Clear logs for new page
    return { content: [{ type: 'text' as const, text: `Switched to tab ${index}: ${currentPage.url()}` }] }
  }
)

// Tool: network_requests
server.tool(
  'network_requests',
  'Monitor network requests. Call once to start monitoring, again to get results.',
  {
    action: z.enum(['start', 'stop', 'get']).describe('start/stop monitoring, or get captured requests'),
    filter: z.string().optional().describe('URL pattern to filter (substring match)'),
  },
  async ({ action, filter }) => {
    const page = await getActivePage()
    const requests: { method: string; url: string; status?: number; type: string }[] = []

    if (action === 'start') {
      await page.setRequestInterception(false) // Ensure no interception
      // Use CDP session for network monitoring
      const client = await page.createCDPSession()
      await client.send('Network.enable')
      ;(page as any).__networkLogs = []
      ;(page as any).__cdpClient = client

      client.on('Network.responseReceived', (params: any) => {
        const entry = {
          method: params.response?.requestHeaders?.[':method'] || 'GET',
          url: params.response.url,
          status: params.response.status,
          type: params.type,
        }
        ;(page as any).__networkLogs.push(entry)
      })

      return { content: [{ type: 'text' as const, text: 'Network monitoring started. Use action="get" to retrieve logs.' }] }
    }

    if (action === 'stop' || action === 'get') {
      const logs = (page as any).__networkLogs || []
      let filtered = filter ? logs.filter((l: any) => l.url.includes(filter)) : logs
      filtered = filtered.slice(-100)

      if (action === 'stop') {
        const client = (page as any).__cdpClient
        if (client) {
          await client.send('Network.disable')
          client.removeAllListeners()
        }
        ;(page as any).__networkLogs = []
        ;(page as any).__cdpClient = null
      }

      return { content: [{ type: 'text' as const, text: filtered.length === 0 ? 'No network requests captured.' : JSON.stringify(filtered, null, 2) }] }
    }

    return { content: [{ type: 'text' as const, text: 'Unknown action' }], isError: true }
  }
)

// ── Global error handling ────────────────────────────────────
process.on('uncaughtException', (err) => {
  console.error('[browser] Uncaught exception:', err.message)
  process.exit(1)
})

process.on('unhandledRejection', (reason) => {
  console.error('[browser] Unhandled rejection:', reason)
  process.exit(1)
})

// Start server
const transport = new StdioServerTransport()
server.connect(transport).catch((err) => {
  console.error('[browser] Failed to connect:', err.message)
  process.exit(1)
})
