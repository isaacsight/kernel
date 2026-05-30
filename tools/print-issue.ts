/**
 * print-issue.ts — render one issue to a press-ready PDF.
 *
 * Loads the issue's print route (#/issues/<n>/print) in headless
 * Chromium and emits an A5 PDF with backgrounds + the tomato spot color
 * preserved. This is step V.1 of docs/print-edition.md: the one thing
 * that turns an issue's .ts source into a file a printer can accept.
 *
 * Usage:
 *   npm run build            # the preview server serves dist/
 *   npm run print 375        # -> print/375.pdf
 *
 * Reusable for every issue. The PDF still needs a pre-flight pass
 * (font embedding, spot-color separation, bleed) before press — see
 * docs/print-edition.md section V.2 — but this produces the master.
 */
import { chromium } from '@playwright/test'
import { spawn, type ChildProcess } from 'node:child_process'
import { mkdir } from 'node:fs/promises'
import { existsSync } from 'node:fs'
import { resolve } from 'node:path'

const PORT = 4173
const BASE = `http://localhost:${PORT}`
const DIST = resolve(process.cwd(), 'dist')
const OUT_DIR = resolve(process.cwd(), 'print')

async function waitForServer(url: string, timeoutMs = 30_000): Promise<void> {
  const start = Date.now()
  while (Date.now() - start < timeoutMs) {
    try {
      const res = await fetch(url)
      if (res.ok) return
    } catch {
      // server not up yet
    }
    await new Promise((r) => setTimeout(r, 400))
  }
  throw new Error(`Preview server did not start within ${timeoutMs}ms`)
}

async function main(): Promise<void> {
  const number = process.argv[2] ?? '375'

  if (!existsSync(DIST)) {
    console.error('No dist/ found. Run `npm run build` first.')
    process.exit(1)
  }

  await mkdir(OUT_DIR, { recursive: true })

  console.log(`Starting preview server on :${PORT} ...`)
  const server: ChildProcess = spawn(
    'npx',
    ['vite', 'preview', '--port', String(PORT), '--strictPort'],
    { stdio: 'ignore' },
  )

  try {
    await waitForServer(BASE)

    const browser = await chromium.launch()
    const page = await browser.newPage()

    const target = `${BASE}/#/issues/${number}/print`
    console.log(`Rendering ${target} ...`)
    await page.goto(target, { waitUntil: 'networkidle' })
    await page.emulateMedia({ media: 'print' })
    // Let webfonts (EB Garamond / Courier Prime / Noto Serif JP) settle.
    await page.evaluate(() => document.fonts.ready)
    await page.waitForTimeout(500)

    const out = resolve(OUT_DIR, `${number}.pdf`)
    await page.pdf({
      path: out,
      width: '148mm',
      height: '210mm',
      printBackground: true,
      margin: { top: '0', right: '0', bottom: '0', left: '0' },
    })

    await browser.close()
    console.log(`Wrote ${out}`)
  } finally {
    server.kill()
  }
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
