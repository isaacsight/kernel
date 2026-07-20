#!/usr/bin/env node

import fs from 'node:fs/promises'
import path from 'node:path'
import { chromium } from 'playwright'

const [url, outputArg] = process.argv.slice(2)

if (!url || !outputArg) {
  console.error('Usage: audit-page.mjs <url> <output-directory>')
  process.exit(2)
}

const outputDirectory = path.resolve(outputArg)
const viewports = [
  { name: 'desktop', width: 1440, height: 1000 },
  { name: 'mobile', width: 390, height: 844 },
]

await fs.mkdir(outputDirectory, { recursive: true })

const browser = await chromium.launch({ headless: true })
const results = []

async function inspectPage(page) {
  return page.evaluate(() => {
    const root = document.documentElement
    const body = document.body
    const visible = (element) => {
      const style = getComputedStyle(element)
      const rect = element.getBoundingClientRect()
      return style.display !== 'none' && style.visibility !== 'hidden' && rect.width > 0 && rect.height > 0
    }

    const controls = [...document.querySelectorAll('button, input, select, textarea, [role="button"], [role="tab"], [role="switch"]')]
      .filter(visible)
      .map((element) => {
        const rect = element.getBoundingClientRect()
        return {
          label: element.getAttribute('aria-label') || element.textContent?.trim().slice(0, 80) || element.tagName,
          width: Math.round(rect.width),
          height: Math.round(rect.height),
        }
      })

    return {
      title: document.title,
      language: root.lang || null,
      headings: [...document.querySelectorAll('h1, h2, h3')].slice(0, 20).map((heading) => ({
        level: heading.tagName,
        text: heading.textContent?.trim().replace(/\s+/g, ' ').slice(0, 160),
      })),
      viewportWidth: root.clientWidth,
      scrollWidth: Math.max(root.scrollWidth, body?.scrollWidth || 0),
      overflowPixels: Math.max(0, Math.max(root.scrollWidth, body?.scrollWidth || 0) - root.clientWidth),
      failedImages: [...document.images]
        .filter((image) => image.complete && image.naturalWidth === 0)
        .map((image) => image.currentSrc || image.src || image.alt || 'unidentified image'),
      imagesWithoutAlt: [...document.querySelectorAll('img:not([alt])')].map((image) => image.currentSrc || image.src),
      smallControls: controls.filter((control) => control.width < 44 || control.height < 44),
      interactiveElementCount: document.querySelectorAll('a, button, input, select, textarea, [role="button"], [role="tab"], [role="switch"]').length,
    }
  })
}

try {
  for (const viewport of viewports) {
    const page = await browser.newPage({ viewport })
    const runtimeErrors = []

    page.on('console', (message) => {
      if (message.type() === 'error') runtimeErrors.push(`console: ${message.text()}`)
    })
    page.on('pageerror', (error) => runtimeErrors.push(`page: ${error.message}`))

    const response = await page.goto(url, { waitUntil: 'networkidle', timeout: 45_000 })
    await page.screenshot({ path: path.join(outputDirectory, `${viewport.name}.png`), fullPage: true })

    results.push({
      viewport,
      status: response?.status() ?? null,
      finalUrl: page.url(),
      runtimeErrors,
      ...(await inspectPage(page)),
    })

    await page.close()
  }

  const reducedPage = await browser.newPage({
    viewport: { width: 390, height: 844 },
    reducedMotion: 'reduce',
  })
  await reducedPage.goto(url, { waitUntil: 'networkidle', timeout: 45_000 })
  await reducedPage.waitForTimeout(750)
  const reducedMotion = await reducedPage.evaluate(() => ({
    activeAnimations: document.getAnimations().filter((animation) => animation.playState === 'running' || animation.playState === 'pending').length,
  }))
  await reducedPage.close()

  const printPage = await browser.newPage({ viewport: { width: 1440, height: 1000 } })
  await printPage.emulateMedia({ media: 'print', reducedMotion: 'reduce' })
  await printPage.goto(url, { waitUntil: 'networkidle', timeout: 45_000 })
  await printPage.screenshot({ path: path.join(outputDirectory, 'print.png'), fullPage: true })
  await printPage.close()

  const report = {
    auditedAt: new Date().toISOString(),
    requestedUrl: url,
    results,
    reducedMotion,
  }
  await fs.writeFile(path.join(outputDirectory, 'audit.json'), `${JSON.stringify(report, null, 2)}\n`)

  const hardFailures = results.flatMap((result) => [
    ...(result.status && result.status >= 400 ? [`${result.viewport.name}: HTTP ${result.status}`] : []),
    ...(result.overflowPixels > 0 ? [`${result.viewport.name}: ${result.overflowPixels}px horizontal overflow`] : []),
    ...result.failedImages.map((image) => `${result.viewport.name}: failed image ${image}`),
    ...result.runtimeErrors.map((error) => `${result.viewport.name}: ${error}`),
  ])

  console.log(JSON.stringify({ outputDirectory, hardFailures, reducedMotion, results }, null, 2))
  if (hardFailures.length > 0) process.exitCode = 1
} finally {
  await browser.close()
}
