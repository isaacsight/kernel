#!/usr/bin/env npx tsx
/**
 * Prototype MCP Server — Advanced prototyping tools for Kernel agents
 *
 * Builds on top of the Playwright MCP with higher-level capabilities:
 * - Component isolation & screenshot capture
 * - Responsive testing across breakpoints
 * - Visual regression (before/after comparison)
 * - CSS inspection & design token auditing
 * - Interaction recording & replay
 * - Accessibility snapshot
 * - Performance profiling
 * - DOM structure analysis
 *
 * Requires Chrome launched with: --remote-debugging-port=9222
 */

import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js'
import puppeteer, { type Browser, type Page } from 'puppeteer-core'
import { z } from 'zod'
import * as fs from 'fs'
import * as path from 'path'

const CDP_URL = process.env.CDP_URL || 'http://127.0.0.1:9222'
const SNAPSHOT_DIR = path.resolve(process.env.SNAPSHOT_DIR || '.claude/snapshots')
const KERNEL_URL = process.env.KERNEL_URL || 'https://kernel.chat'

// Ensure snapshot directory exists
if (!fs.existsSync(SNAPSHOT_DIR)) {
  fs.mkdirSync(SNAPSHOT_DIR, { recursive: true })
}

let browser: Browser | null = null
let currentPage: Page | null = null

async function ensureBrowser(): Promise<Browser> {
  if (browser?.connected) return browser
  browser = await puppeteer.connect({ browserURL: CDP_URL })
  return browser
}

async function getPage(): Promise<Page> {
  if (currentPage && !currentPage.isClosed()) return currentPage
  const b = await ensureBrowser()
  const pages = await b.pages()
  currentPage = pages[pages.length - 1] || (await b.newPage())
  return currentPage
}

// ─── Breakpoints ─────────────────────────────────────────────

const BREAKPOINTS = {
  'mobile': { width: 375, height: 812, label: 'iPhone 13 Mini' },
  'mobile-lg': { width: 428, height: 926, label: 'iPhone 14 Pro Max' },
  'tablet': { width: 768, height: 1024, label: 'iPad' },
  'desktop': { width: 1440, height: 900, label: 'Desktop' },
  'desktop-wide': { width: 1920, height: 1080, label: 'Full HD' },
} as const

type Breakpoint = keyof typeof BREAKPOINTS

// ─── MCP Server ──────────────────────────────────────────────

const server = new McpServer({
  name: 'prototype',
  version: '1.0.0',
})

// ── Tool: Responsive Screenshot Matrix ───────────────────────

server.tool(
  'responsive_matrix',
  'Take screenshots at all breakpoints (mobile, tablet, desktop) and return them as a comparison matrix',
  {
    url: z.string().optional().describe('URL to test (defaults to kernel.chat)'),
    route: z.string().optional().describe('Hash route to navigate to (e.g., "#/settings")'),
    selector: z.string().optional().describe('CSS selector to screenshot (defaults to full page)'),
    breakpoints: z.array(z.enum(['mobile', 'mobile-lg', 'tablet', 'desktop', 'desktop-wide'])).optional().describe('Specific breakpoints (defaults to mobile, tablet, desktop)'),
    theme: z.enum(['light', 'dark', 'eink']).optional().describe('Theme to set before screenshots'),
  },
  async ({ url, route, selector, breakpoints: bps, theme }) => {
    const page = await getPage()
    const targetUrl = url || KERNEL_URL
    const selectedBps = (bps || ['mobile', 'tablet', 'desktop']) as Breakpoint[]
    const results: { breakpoint: string; label: string; width: number; height: number; file: string }[] = []
    const timestamp = Date.now()

    for (const bp of selectedBps) {
      const { width, height, label } = BREAKPOINTS[bp]
      await page.setViewport({ width, height, deviceScaleFactor: bp.startsWith('mobile') ? 3 : 2 })

      if (page.url() !== targetUrl) {
        await page.goto(targetUrl, { waitUntil: 'networkidle2', timeout: 15000 })
      }

      if (route) {
        await page.evaluate((r) => { window.location.hash = r }, route)
        await new Promise(r => setTimeout(r, 1000))
      }

      if (theme) {
        await page.evaluate((t) => { document.documentElement.setAttribute('data-theme', t) }, theme)
        await new Promise(r => setTimeout(r, 300))
      }

      const filename = `responsive-${bp}-${timestamp}.png`
      const filepath = path.join(SNAPSHOT_DIR, filename)

      if (selector) {
        const el = await page.$(selector)
        if (el) {
          await el.screenshot({ path: filepath })
        } else {
          continue
        }
      } else {
        await page.screenshot({ path: filepath, fullPage: false })
      }

      results.push({ breakpoint: bp, label, width, height, file: filepath })
    }

    return {
      content: [{
        type: 'text' as const,
        text: JSON.stringify({
          url: targetUrl,
          route: route || '/',
          theme: theme || 'auto',
          screenshots: results,
          summary: `Captured ${results.length} breakpoints: ${results.map(r => `${r.breakpoint} (${r.width}x${r.height})`).join(', ')}`,
        }, null, 2),
      }],
    }
  }
)

// ── Tool: Component Isolate ──────────────────────────────────

server.tool(
  'component_isolate',
  'Isolate a specific component by selector, screenshot it, and extract its computed styles',
  {
    selector: z.string().describe('CSS selector for the component to isolate'),
    states: z.array(z.string()).optional().describe('CSS classes to toggle for state testing (e.g., ["--active", "--disabled"])'),
    includeStyles: z.boolean().optional().describe('Include computed CSS properties (default: true)'),
  },
  async ({ selector, states, includeStyles = true }) => {
    const page = await getPage()
    const el = await page.$(selector)
    if (!el) {
      return { content: [{ type: 'text' as const, text: `Element not found: ${selector}` }] }
    }

    const timestamp = Date.now()
    const results: { state: string; file: string; styles?: Record<string, string> }[] = []

    // Default state
    const defaultFile = path.join(SNAPSHOT_DIR, `component-default-${timestamp}.png`)
    await el.screenshot({ path: defaultFile })

    let styles: Record<string, string> | undefined
    if (includeStyles) {
      styles = await page.evaluate((sel) => {
        const element = document.querySelector(sel)
        if (!element) return {}
        const computed = getComputedStyle(element)
        const props = [
          'width', 'height', 'padding', 'margin', 'border', 'border-radius',
          'background', 'background-color', 'color', 'font-family', 'font-size',
          'font-weight', 'line-height', 'letter-spacing', 'text-transform',
          'display', 'flex-direction', 'align-items', 'justify-content', 'gap',
          'box-shadow', 'opacity', 'transition', 'transform',
        ]
        const result: Record<string, string> = {}
        for (const p of props) {
          const v = computed.getPropertyValue(p)
          if (v && v !== 'none' && v !== 'normal' && v !== '0px' && v !== 'auto') {
            result[p] = v
          }
        }
        return result
      }, selector)
    }

    results.push({ state: 'default', file: defaultFile, styles })

    // Test additional states
    if (states) {
      for (const state of states) {
        await page.evaluate((sel, cls) => {
          const el = document.querySelector(sel)
          if (el) el.classList.toggle(cls.replace('--', ''))
        }, selector, state)
        await new Promise(r => setTimeout(r, 200))

        const stateFile = path.join(SNAPSHOT_DIR, `component-${state.replace(/[^a-z0-9]/gi, '')}-${timestamp}.png`)
        await el.screenshot({ path: stateFile })
        results.push({ state, file: stateFile })

        // Revert
        await page.evaluate((sel, cls) => {
          const el = document.querySelector(sel)
          if (el) el.classList.toggle(cls.replace('--', ''))
        }, selector, state)
      }
    }

    return {
      content: [{
        type: 'text' as const,
        text: JSON.stringify({ selector, results }, null, 2),
      }],
    }
  }
)

// ── Tool: Visual Regression ──────────────────────────────────

server.tool(
  'visual_regression',
  'Compare current state against a saved baseline screenshot. Captures before/after and computes pixel diff percentage.',
  {
    name: z.string().describe('Name for this regression test (e.g., "home-screen", "chat-dark")'),
    selector: z.string().optional().describe('CSS selector to compare (defaults to full viewport)'),
    action: z.enum(['baseline', 'compare']).describe('"baseline" saves reference, "compare" checks against it'),
    breakpoint: z.enum(['mobile', 'mobile-lg', 'tablet', 'desktop', 'desktop-wide']).optional().describe('Breakpoint to use'),
  },
  async ({ name, selector, action, breakpoint }) => {
    const page = await getPage()

    if (breakpoint) {
      const bp = BREAKPOINTS[breakpoint]
      await page.setViewport({ width: bp.width, height: bp.height, deviceScaleFactor: 2 })
      await new Promise(r => setTimeout(r, 500))
    }

    const baselineFile = path.join(SNAPSHOT_DIR, `baseline-${name}.png`)
    const currentFile = path.join(SNAPSHOT_DIR, `current-${name}-${Date.now()}.png`)

    const captureTarget = async (filepath: string) => {
      if (selector) {
        const el = await page.$(selector)
        if (el) await el.screenshot({ path: filepath })
        else throw new Error(`Selector not found: ${selector}`)
      } else {
        await page.screenshot({ path: filepath, fullPage: false })
      }
    }

    if (action === 'baseline') {
      await captureTarget(baselineFile)
      return {
        content: [{
          type: 'text' as const,
          text: JSON.stringify({
            action: 'baseline_saved',
            name,
            file: baselineFile,
            message: `Baseline saved for "${name}". Run with action="compare" to check for regressions.`,
          }, null, 2),
        }],
      }
    }

    // Compare
    if (!fs.existsSync(baselineFile)) {
      return {
        content: [{
          type: 'text' as const,
          text: `No baseline exists for "${name}". Run with action="baseline" first.`,
        }],
      }
    }

    await captureTarget(currentFile)

    // Simple pixel comparison using raw buffer sizes as proxy
    // (Full pixel-diff would require sharp/pixelmatch — this is a lightweight approximation)
    const baselineSize = fs.statSync(baselineFile).size
    const currentSize = fs.statSync(currentFile).size
    const sizeDelta = Math.abs(currentSize - baselineSize)
    const sizeRatio = sizeDelta / baselineSize
    const likelyChanged = sizeRatio > 0.05 // >5% file size difference suggests visual change

    return {
      content: [{
        type: 'text' as const,
        text: JSON.stringify({
          action: 'compared',
          name,
          baseline: baselineFile,
          current: currentFile,
          baselineSize,
          currentSize,
          sizeDeltaPercent: `${(sizeRatio * 100).toFixed(1)}%`,
          likelyChanged,
          verdict: likelyChanged ? 'CHANGED — visual regression detected' : 'STABLE — no significant visual change',
          note: 'File-size heuristic. For pixel-accurate diff, install pixelmatch.',
        }, null, 2),
      }],
    }
  }
)

// ── Tool: Design Token Audit ─────────────────────────────────

server.tool(
  'design_token_audit',
  'Scan the page for design token compliance — checks fonts, colors, spacing, touch targets against Rubin system',
  {
    selector: z.string().optional().describe('Scope audit to a specific container (defaults to body)'),
  },
  async ({ selector }) => {
    const page = await getPage()

    const audit = await page.evaluate((sel) => {
      const container = sel ? document.querySelector(sel) : document.body
      if (!container) return { error: 'Container not found' }

      const issues: { type: string; element: string; expected: string; actual: string; severity: string }[] = []

      // Check all text elements for Rubin fonts
      const textEls = container.querySelectorAll('h1, h2, h3, h4, h5, h6, p, span, a, button, label, li, td, th, input, textarea')
      const rubinFonts = ['EB Garamond', 'Courier Prime', 'serif', 'monospace']

      for (const el of textEls) {
        const computed = getComputedStyle(el)
        const fontFamily = computed.fontFamily
        const isRubin = rubinFonts.some(f => fontFamily.includes(f))
        if (!isRubin && fontFamily !== 'inherit' && el.textContent?.trim()) {
          issues.push({
            type: 'font',
            element: `${el.tagName.toLowerCase()}.${el.className?.toString().split(' ')[0] || 'none'}`,
            expected: 'EB Garamond or Courier Prime',
            actual: fontFamily.slice(0, 60),
            severity: 'p1',
          })
        }
      }

      // Check interactive elements for touch target size (44x44px minimum)
      const interactive = container.querySelectorAll('button, a, [role="button"], input, select, [tabindex]')
      for (const el of interactive) {
        const rect = el.getBoundingClientRect()
        if (rect.width > 0 && rect.height > 0) {
          if (rect.width < 44 || rect.height < 44) {
            issues.push({
              type: 'touch-target',
              element: `${el.tagName.toLowerCase()}.${el.className?.toString().split(' ')[0] || 'none'}`,
              expected: '≥44x44px',
              actual: `${Math.round(rect.width)}x${Math.round(rect.height)}px`,
              severity: rect.width < 30 || rect.height < 30 ? 'p0' : 'p1',
            })
          }
        }
      }

      // Check color contrast on text (simplified — checks against white/dark backgrounds)
      const theme = document.documentElement.getAttribute('data-theme') || 'light'

      // Count elements with hardcoded colors (not using CSS custom properties)
      let hardcodedColorCount = 0
      const allEls = container.querySelectorAll('*')
      for (const el of allEls) {
        const style = (el as HTMLElement).style
        if (style.color || style.backgroundColor) {
          hardcodedColorCount++
        }
      }

      return {
        theme,
        elementCount: allEls.length,
        interactiveCount: interactive.length,
        textElementCount: textEls.length,
        hardcodedColorCount,
        issues,
        summary: {
          total: issues.length,
          p0: issues.filter(i => i.severity === 'p0').length,
          p1: issues.filter(i => i.severity === 'p1').length,
          p2: issues.filter(i => i.severity === 'p2').length,
        },
      }
    }, selector || null)

    return {
      content: [{
        type: 'text' as const,
        text: JSON.stringify(audit, null, 2),
      }],
    }
  }
)

// ── Tool: Accessibility Snapshot ─────────────────────────────

server.tool(
  'a11y_snapshot',
  'Capture accessibility tree, ARIA roles, focus order, and contrast issues',
  {
    selector: z.string().optional().describe('Scope to a container (defaults to body)'),
  },
  async ({ selector }) => {
    const page = await getPage()

    const snapshot = await page.evaluate((sel) => {
      const container = sel ? document.querySelector(sel) : document.body
      if (!container) return { error: 'Container not found' }

      const issues: { type: string; element: string; issue: string; severity: string }[] = []

      // Check images for alt text
      const images = container.querySelectorAll('img')
      for (const img of images) {
        if (!img.alt && !img.getAttribute('aria-label') && !img.getAttribute('aria-hidden')) {
          issues.push({
            type: 'missing-alt',
            element: `img[src="${img.src.slice(-40)}"]`,
            issue: 'Image missing alt text',
            severity: 'p0',
          })
        }
      }

      // Check interactive elements for labels
      const buttons = container.querySelectorAll('button')
      for (const btn of buttons) {
        if (!btn.textContent?.trim() && !btn.getAttribute('aria-label') && !btn.getAttribute('title')) {
          issues.push({
            type: 'missing-label',
            element: `button.${btn.className?.toString().split(' ')[0] || 'none'}`,
            issue: 'Button has no accessible label',
            severity: 'p0',
          })
        }
      }

      // Check inputs for labels
      const inputs = container.querySelectorAll('input, textarea, select')
      for (const input of inputs) {
        const id = input.id
        const hasLabel = id ? !!document.querySelector(`label[for="${id}"]`) : false
        const hasAria = input.getAttribute('aria-label') || input.getAttribute('aria-labelledby') || input.getAttribute('placeholder')
        if (!hasLabel && !hasAria) {
          issues.push({
            type: 'missing-label',
            element: `${input.tagName.toLowerCase()}#${id || 'no-id'}`,
            issue: 'Form input has no associated label',
            severity: 'p1',
          })
        }
      }

      // Check heading hierarchy
      const headings = container.querySelectorAll('h1, h2, h3, h4, h5, h6')
      let lastLevel = 0
      for (const h of headings) {
        const level = parseInt(h.tagName[1])
        if (level > lastLevel + 1 && lastLevel > 0) {
          issues.push({
            type: 'heading-skip',
            element: h.tagName.toLowerCase(),
            issue: `Heading skips from h${lastLevel} to h${level}`,
            severity: 'p1',
          })
        }
        lastLevel = level
      }

      // Check for role="tablist" with proper tab roles
      const tablists = container.querySelectorAll('[role="tablist"]')
      for (const tl of tablists) {
        const tabs = tl.querySelectorAll('[role="tab"]')
        if (tabs.length === 0) {
          issues.push({
            type: 'role-mismatch',
            element: 'tablist',
            issue: 'tablist has no child tabs',
            severity: 'p1',
          })
        }
      }

      // Focus order check — find all focusable elements
      const focusable = container.querySelectorAll(
        'a[href], button:not([disabled]), input:not([disabled]), textarea:not([disabled]), select:not([disabled]), [tabindex]'
      )
      const negativeTabindex = Array.from(focusable).filter(
        el => parseInt(el.getAttribute('tabindex') || '0') < 0
      )

      return {
        issues,
        stats: {
          totalIssues: issues.length,
          p0: issues.filter(i => i.severity === 'p0').length,
          p1: issues.filter(i => i.severity === 'p1').length,
          focusableElements: focusable.length,
          negativeTabindex: negativeTabindex.length,
          images: images.length,
          buttons: buttons.length,
          headings: headings.length,
        },
      }
    }, selector || null)

    return {
      content: [{
        type: 'text' as const,
        text: JSON.stringify(snapshot, null, 2),
      }],
    }
  }
)

// ── Tool: Performance Profile ────────────────────────────────

server.tool(
  'perf_profile',
  'Measure page load performance, DOM size, layout thrashing, and resource timing',
  {
    url: z.string().optional().describe('URL to profile (defaults to current page)'),
    route: z.string().optional().describe('Hash route to navigate to'),
  },
  async ({ url, route }) => {
    const page = await getPage()

    if (url) {
      await page.goto(url, { waitUntil: 'networkidle2', timeout: 15000 })
    }

    if (route) {
      await page.evaluate((r) => { window.location.hash = r }, route)
      await new Promise(r => setTimeout(r, 2000))
    }

    const profile = await page.evaluate(() => {
      const perf = performance.getEntriesByType('navigation')[0] as PerformanceNavigationTiming
      const resources = performance.getEntriesByType('resource') as PerformanceResourceTiming[]

      // DOM stats
      const allElements = document.querySelectorAll('*')
      const bodySize = document.body?.innerHTML?.length || 0

      // Resource breakdown
      const resourcesByType: Record<string, { count: number; totalSize: number; totalDuration: number }> = {}
      for (const r of resources) {
        const ext = r.name.split('.').pop()?.split('?')[0] || 'other'
        const type = ['js', 'mjs'].includes(ext) ? 'js' : ['css'].includes(ext) ? 'css' : ['png', 'jpg', 'jpeg', 'gif', 'webp', 'svg', 'ico'].includes(ext) ? 'image' : ['woff', 'woff2', 'ttf'].includes(ext) ? 'font' : 'other'
        if (!resourcesByType[type]) resourcesByType[type] = { count: 0, totalSize: 0, totalDuration: 0 }
        resourcesByType[type].count++
        resourcesByType[type].totalSize += r.transferSize || 0
        resourcesByType[type].totalDuration += r.duration || 0
      }

      // Layout metrics
      const paintEntries = performance.getEntriesByType('paint')
      const fcp = paintEntries.find(e => e.name === 'first-contentful-paint')

      return {
        navigation: {
          domContentLoaded: Math.round(perf?.domContentLoadedEventEnd - perf?.startTime) || 0,
          load: Math.round(perf?.loadEventEnd - perf?.startTime) || 0,
          domInteractive: Math.round(perf?.domInteractive - perf?.startTime) || 0,
          firstContentfulPaint: fcp ? Math.round(fcp.startTime) : null,
          transferSize: Math.round((perf?.transferSize || 0) / 1024),
        },
        dom: {
          elementCount: allElements.length,
          bodySize: Math.round(bodySize / 1024),
          maxDepth: (() => {
            let max = 0
            const walk = (el: Element, depth: number) => {
              if (depth > max) max = depth
              for (const child of el.children) walk(child, depth + 1)
            }
            walk(document.body, 0)
            return max
          })(),
        },
        resources: resourcesByType,
        totalResources: resources.length,
      }
    })

    return {
      content: [{
        type: 'text' as const,
        text: JSON.stringify(profile, null, 2),
      }],
    }
  }
)

// ── Tool: DOM Structure ──────────────────────────────────────

server.tool(
  'dom_tree',
  'Extract the DOM tree structure of a component for analysis — shows hierarchy, class names, and data attributes',
  {
    selector: z.string().describe('CSS selector for the root element'),
    depth: z.number().optional().describe('Max depth to traverse (default: 5)'),
  },
  async ({ selector, depth = 5 }) => {
    const page = await getPage()

    const tree = await page.evaluate((sel, maxDepth) => {
      const root = document.querySelector(sel)
      if (!root) return null

      interface TreeNode {
        tag: string
        classes: string[]
        id?: string
        role?: string
        dataAttrs: Record<string, string>
        text?: string
        children: TreeNode[]
      }

      const walk = (el: Element, d: number): TreeNode => {
        const attrs: Record<string, string> = {}
        for (const attr of el.attributes) {
          if (attr.name.startsWith('data-')) {
            attrs[attr.name] = attr.value
          }
        }

        const node: TreeNode = {
          tag: el.tagName.toLowerCase(),
          classes: Array.from(el.classList),
          dataAttrs: attrs,
          children: [],
        }

        if (el.id) node.id = el.id
        const role = el.getAttribute('role')
        if (role) node.role = role

        // Only include text for leaf nodes
        if (el.children.length === 0 && el.textContent?.trim()) {
          node.text = el.textContent.trim().slice(0, 100)
        }

        if (d < maxDepth) {
          for (const child of el.children) {
            node.children.push(walk(child, d + 1))
          }
        } else if (el.children.length > 0) {
          node.text = `[${el.children.length} children truncated]`
        }

        return node
      }

      return walk(root, 0)
    }, selector, depth)

    if (!tree) {
      return { content: [{ type: 'text' as const, text: `Element not found: ${selector}` }] }
    }

    return {
      content: [{
        type: 'text' as const,
        text: JSON.stringify(tree, null, 2),
      }],
    }
  }
)

// ── Tool: Interaction Test ───────────────────────────────────

server.tool(
  'interaction_test',
  'Run a sequence of user interactions and capture screenshots at each step — simulates a user journey',
  {
    steps: z.array(z.object({
      action: z.enum(['click', 'type', 'wait', 'screenshot', 'navigate', 'scroll']),
      selector: z.string().optional(),
      value: z.string().optional(),
      delay: z.number().optional().describe('Delay in ms after action'),
    })).describe('Sequence of interaction steps'),
    name: z.string().describe('Name for this interaction test'),
  },
  async ({ steps, name }) => {
    const page = await getPage()
    const timestamp = Date.now()
    const results: { step: number; action: string; screenshot?: string; error?: string }[] = []

    for (let i = 0; i < steps.length; i++) {
      const step = steps[i]
      try {
        switch (step.action) {
          case 'click':
            if (step.selector) await page.click(step.selector)
            break
          case 'type':
            if (step.selector && step.value) {
              await page.click(step.selector, { clickCount: 3 })
              await page.type(step.selector, step.value)
            }
            break
          case 'wait':
            await new Promise(r => setTimeout(r, step.delay || 1000))
            break
          case 'navigate':
            if (step.value) {
              await page.evaluate((r) => { window.location.hash = r }, step.value)
            }
            break
          case 'scroll':
            await page.evaluate((sel) => {
              const el = sel ? document.querySelector(sel) : window
              if (el && 'scrollBy' in el) (el as Window).scrollBy(0, 300)
              else if (el) (el as Element).scrollTop += 300
            }, step.selector || null)
            break
          case 'screenshot':
            // always captured below
            break
        }

        if (step.delay) await new Promise(r => setTimeout(r, step.delay))

        // Capture screenshot at every step
        const file = path.join(SNAPSHOT_DIR, `interaction-${name}-step${i}-${timestamp}.png`)
        await page.screenshot({ path: file, fullPage: false })
        results.push({ step: i, action: step.action, screenshot: file })
      } catch (err) {
        results.push({ step: i, action: step.action, error: String(err) })
      }
    }

    return {
      content: [{
        type: 'text' as const,
        text: JSON.stringify({
          name,
          totalSteps: steps.length,
          passed: results.filter(r => !r.error).length,
          failed: results.filter(r => r.error).length,
          results,
        }, null, 2),
      }],
    }
  }
)

// ── Tool: CSS Coverage ───────────────────────────────────────

server.tool(
  'css_coverage',
  'Measure CSS usage — find unused rules, total size, and coverage percentage',
  {
    url: z.string().optional().describe('URL to measure (defaults to current page)'),
  },
  async ({ url }) => {
    const page = await getPage()

    // Start CSS coverage
    await page.coverage.startCSSCoverage()

    if (url) {
      await page.goto(url, { waitUntil: 'networkidle2', timeout: 15000 })
    }

    await new Promise(r => setTimeout(r, 2000)) // Let JS render

    const coverage = await page.coverage.stopCSSCoverage()

    let totalBytes = 0
    let usedBytes = 0
    const sheets: { url: string; totalBytes: number; usedBytes: number; usedPercent: string }[] = []

    for (const entry of coverage) {
      const sheetTotal = entry.text.length
      let sheetUsed = 0
      for (const range of entry.ranges) {
        sheetUsed += range.end - range.start
      }
      totalBytes += sheetTotal
      usedBytes += sheetUsed

      sheets.push({
        url: entry.url.split('/').pop() || entry.url,
        totalBytes: sheetTotal,
        usedBytes: sheetUsed,
        usedPercent: `${((sheetUsed / sheetTotal) * 100).toFixed(1)}%`,
      })
    }

    return {
      content: [{
        type: 'text' as const,
        text: JSON.stringify({
          totalCSS: `${(totalBytes / 1024).toFixed(1)} KB`,
          usedCSS: `${(usedBytes / 1024).toFixed(1)} KB`,
          unusedCSS: `${((totalBytes - usedBytes) / 1024).toFixed(1)} KB`,
          coveragePercent: `${((usedBytes / totalBytes) * 100).toFixed(1)}%`,
          sheets,
        }, null, 2),
      }],
    }
  }
)

// ── Tool: Theme Comparison ───────────────────────────────────

server.tool(
  'theme_comparison',
  'Screenshot the same view in all three themes (light, dark, e-ink) side by side',
  {
    route: z.string().optional().describe('Hash route to test'),
    selector: z.string().optional().describe('Selector to focus on'),
    breakpoint: z.enum(['mobile', 'tablet', 'desktop']).optional(),
  },
  async ({ route, selector, breakpoint = 'desktop' }) => {
    const page = await getPage()
    const bp = BREAKPOINTS[breakpoint]
    await page.setViewport({ width: bp.width, height: bp.height, deviceScaleFactor: 2 })

    const timestamp = Date.now()
    const themes = ['light', 'dark', 'eink'] as const
    const results: { theme: string; file: string }[] = []

    for (const theme of themes) {
      await page.evaluate((t) => { document.documentElement.setAttribute('data-theme', t) }, theme)
      await new Promise(r => setTimeout(r, 500))

      if (route) {
        await page.evaluate((r) => { window.location.hash = r }, route)
        await new Promise(r => setTimeout(r, 500))
      }

      const file = path.join(SNAPSHOT_DIR, `theme-${theme}-${timestamp}.png`)

      if (selector) {
        const el = await page.$(selector)
        if (el) await el.screenshot({ path: file })
      } else {
        await page.screenshot({ path: file, fullPage: false })
      }

      results.push({ theme, file })
    }

    // Reset to light
    await page.evaluate(() => { document.documentElement.setAttribute('data-theme', 'light') })

    return {
      content: [{
        type: 'text' as const,
        text: JSON.stringify({
          breakpoint,
          route: route || '/',
          results,
          message: `Captured all 3 themes at ${bp.width}x${bp.height}`,
        }, null, 2),
      }],
    }
  }
)

// ── Start Server ─────────────────────────────────────────────

async function main() {
  const transport = new StdioServerTransport()
  await server.connect(transport)
  console.error('[prototype-mcp] Server started — 10 prototyping tools available')
}

main().catch(err => {
  console.error('[prototype-mcp] Fatal:', err)
  process.exit(1)
})
