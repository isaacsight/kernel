// kbot design — local-first alternative to Claude Design.
//
// Reads the current repo's CSS design tokens, feeds them to the aesthete
// specialist along with the user's brief, writes an HTML prototype to disk
// that applies those tokens, and optionally renders it to PDF via Playwright.
//
// No subscription. No cloud. $0 with a local model. The generated HTML lives
// on your machine, your design tokens stay local, your prototype is yours.

import { existsSync, readFileSync, writeFileSync, mkdirSync } from 'node:fs'
import { join, resolve, dirname } from 'node:path'
import { homedir } from 'node:os'

export interface DesignOptions {
  /** The design brief — what to build */
  brief: string
  /** Output file path (default: ./design-output/<slug>.html) */
  out?: string
  /** Kind of artifact: 'deck' | 'page' | 'prototype' | 'one-pager' */
  kind?: 'deck' | 'page' | 'prototype' | 'one-pager'
  /** Also render to PDF via Playwright */
  pdf?: boolean
  /** Open in browser after generation */
  open?: boolean
}

/**
 * Discover the repo's design tokens by scanning common CSS / config files.
 * Returns a deduplicated string block the agent can reference.
 */
export function extractDesignTokens(projectRoot: string): string {
  const candidates = [
    'src/index.css',
    'src/styles/tokens.css',
    'src/tokens.css',
    'app/globals.css',
    'styles/globals.css',
    'tailwind.config.ts',
    'tailwind.config.js',
    'src/theme.ts',
    'src/theme.css',
  ]

  const sections: string[] = []
  for (const rel of candidates) {
    const path = join(projectRoot, rel)
    if (!existsSync(path)) continue
    try {
      const content = readFileSync(path, 'utf-8')
      // Only grab the token-declaring sections, not full CSS
      const customProps = content.match(/--[\w-]+\s*:\s*[^;}\n]+/g) ?? []
      const colorDecls = content.match(/#[0-9a-fA-F]{3,8}\b|rgb\([^)]+\)|hsl\([^)]+\)/g) ?? []
      const fontDecls = content.match(/font-family\s*:\s*[^;}\n]+/g) ?? []
      if (customProps.length > 0 || colorDecls.length > 0 || fontDecls.length > 0) {
        const uniqueProps = [...new Set(customProps)].slice(0, 40)
        const uniqueColors = [...new Set(colorDecls)].slice(0, 15)
        const uniqueFonts = [...new Set(fontDecls)].slice(0, 5)
        sections.push(`## Tokens from ${rel}\n\n${[
          ...uniqueProps,
          ...uniqueColors.map(c => `color: ${c}`),
          ...uniqueFonts,
        ].join('\n')}`)
      }
    } catch { /* skip unreadable */ }
  }

  if (sections.length === 0) {
    return '(no design tokens found — using sensible defaults)'
  }
  return sections.join('\n\n')
}

/** Build the prompt that the aesthete specialist will receive. */
export function buildDesignPrompt(opts: DesignOptions, tokens: string): string {
  const kind = opts.kind ?? 'one-pager'
  const kindGuide: Record<string, string> = {
    'deck': 'A pitch deck — multiple slides via <section class="slide"> blocks, one idea per slide, big typography, clear hierarchy. Include title, problem, solution, market, team, ask slides as baseline.',
    'page': 'A responsive landing page — hero, feature grid, social proof, CTA. Mobile-first.',
    'prototype': 'An interactive product prototype — clickable navigation, realistic fake data, hover states, at least one interactive element (modal, form, toggle).',
    'one-pager': 'A single-scroll one-pager — hero, three value props, visual diagram, conclusion. Print-friendly.',
  }

  return `You are the aesthete specialist producing a polished HTML artifact.

## Brief
${opts.brief}

## Artifact kind: ${kind}
${kindGuide[kind]}

## Design tokens (USE THESE — respect the user's system)
${tokens}

## Requirements
1. Output a SINGLE complete HTML file with inline <style>. No external deps.
2. Use the design tokens above if provided (custom properties, colors, fonts).
3. Mobile-first responsive — test at 375px, 768px, 1440px.
4. Accessible: semantic HTML, aria-labels on interactive elements, color-contrast AA minimum.
5. No JavaScript unless absolutely required for prototype interactivity.
6. Typography system: clear scale, consistent rhythm, no orphan widows.
7. If the user has Rubin tokens (--rubin-*), EB Garamond/Courier Prime, use them. Otherwise pick a tasteful system-font stack.
8. Print to stdout ONLY the HTML, starting with <!DOCTYPE html>. No explanations, no markdown fences.`
}

/** Run the design command. Returns the output file path. */
export async function runDesign(opts: DesignOptions, projectRoot = process.cwd()): Promise<string> {
  const tokens = extractDesignTokens(projectRoot)
  const prompt = buildDesignPrompt(opts, tokens)

  // Route through the agent with the aesthete specialist.
  // skipPlanner: bypass the complexity-detector planner — design prompts are
  // long-form creative, not multi-step tasks, so plan mode returns scaffolding
  // instead of the HTML we need.
  const { runAgent } = await import('./agent.js')
  const response = await runAgent(prompt, {
    agent: 'aesthete',
    stream: false,
    plan: false,
    skipPlanner: true,
  } as any)

  // Extract the HTML — model may wrap in markdown fences despite instructions
  let html = response.content.trim()
  const fenceMatch = html.match(/```(?:html)?\s*([\s\S]*?)```/)
  if (fenceMatch) html = fenceMatch[1].trim()
  if (!html.toLowerCase().includes('<!doctype')) {
    html = `<!DOCTYPE html>\n${html}`
  }

  // Determine output path
  const slug = opts.brief
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, '')
    .trim()
    .replace(/\s+/g, '-')
    .slice(0, 50) || 'design'
  const outPath = opts.out
    ? resolve(opts.out.startsWith('~/') ? join(homedir(), opts.out.slice(2)) : opts.out)
    : resolve(projectRoot, 'design-output', `${slug}.html`)

  mkdirSync(dirname(outPath), { recursive: true })
  writeFileSync(outPath, html)

  // Optional: render to PDF via Playwright
  if (opts.pdf) {
    try {
      await renderToPdf(outPath)
    } catch (err) {
      process.stderr.write(`  (PDF render failed: ${String(err).slice(0, 80)})\n`)
    }
  }

  // Optional: open in default browser
  if (opts.open) {
    try {
      const { spawn } = await import('node:child_process')
      const opener = process.platform === 'darwin' ? 'open' : process.platform === 'win32' ? 'start' : 'xdg-open'
      spawn(opener, [outPath], { detached: true, stdio: 'ignore' }).unref()
    } catch { /* non-critical */ }
  }

  return outPath
}

/** Render HTML to PDF via Playwright if it's available. */
async function renderToPdf(htmlPath: string): Promise<string> {
  const pdfPath = htmlPath.replace(/\.html?$/i, '.pdf')
  // Dynamic import — Playwright is an optional peer dep
  const playwright = await import('playwright').catch(() => null)
  if (!playwright) {
    throw new Error('playwright not installed; run `npm i -g playwright && npx playwright install chromium`')
  }
  const browser = await playwright.chromium.launch()
  try {
    const page = await browser.newPage()
    await page.goto(`file://${htmlPath}`, { waitUntil: 'networkidle' })
    await page.pdf({ path: pdfPath, format: 'A4', printBackground: true })
    return pdfPath
  } finally {
    await browser.close()
  }
}
