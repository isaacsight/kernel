#!/usr/bin/env npx tsx
// ─────────────────────────────────────────────────────────────
//  Browser Interaction Video Recorder — kernel.chat
//  Run: npx tsx tools/record-interactions.ts [options]
// ─────────────────────────────────────────────────────────────

import { chromium } from 'playwright'
import * as fs from 'fs'
import * as path from 'path'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const REPO_ROOT = path.resolve(__dirname, '..')
const OUTPUT_DIR = path.join(REPO_ROOT, 'videos')

// Ensure videos directory exists
if (!fs.existsSync(OUTPUT_DIR)) {
  fs.mkdirSync(OUTPUT_DIR, { recursive: true })
}

// ─────────────────────────────────────────────────────────────
//  CLI Arguments & Options Parsing
// ─────────────────────────────────────────────────────────────

const args = process.argv.slice(2)
let baseUrl = 'https://kernel.chat'
let viewportSelect: 'desktop' | 'mobile' | 'both' = 'both'
let onlyFeature: string | null = null
let slowMo = 1000 // default 1 second

for (let i = 0; i < args.length; i++) {
  if (args[i] === '--url' && args[i + 1]) {
    baseUrl = args[i + 1]
    i++
  } else if (args[i] === '--viewport' && args[i + 1]) {
    const vp = args[i + 1].toLowerCase()
    if (vp === 'desktop' || vp === 'mobile' || vp === 'both') {
      viewportSelect = vp as any
    }
    i++
  } else if (args[i] === '--only' && args[i + 1]) {
    onlyFeature = args[i + 1].toLowerCase()
    i++
  } else if (args[i] === '--slowmo' && args[i + 1]) {
    slowMo = parseInt(args[i + 1], 10)
    i++
  } else if (args[i] === '--help' || args[i] === '-h') {
    console.log(`
kernel.chat Browser Interaction Recorder

Options:
  --url <url>         Base URL of the site to record (default: https://kernel.chat)
  --viewport <vp>     Viewport mode: 'desktop', 'mobile', or 'both' (default: both)
  --only <feature>    Only record a specific feature: 'dial', 'compare', 'sequence', 'galley', 'margin', 'press', 'tutor'
  --slowmo <ms>       Extra delay in milliseconds between interactions (default: 1000)
  -h, --help          Show this help message

Examples:
  npx tsx tools/record-interactions.ts --only dial --viewport desktop
  npx tsx tools/record-interactions.ts --url http://localhost:5173 --slowmo 1500
`)
    process.exit(0)
  }
}

// Viewports configuration
const VIEWPORTS = {
  desktop: { width: 1280, height: 720 },
  mobile: { width: 393, height: 850 }
}

const activeViewports = viewportSelect === 'both' 
  ? ['desktop', 'mobile'] as const
  : [viewportSelect] as const

// ─────────────────────────────────────────────────────────────
//  Smooth Cursor & Action Helpers
// ─────────────────────────────────────────────────────────────

async function moveCursor(page: any, locator: any) {
  const box = await locator.first().boundingBox()
  if (box) {
    const x = box.x + box.width / 2
    const y = box.y + box.height / 2
    
    // Update HTML cursor location
    await page.evaluate((pos) => {
      const cursor = document.getElementById('virtual-cursor');
      if (cursor) {
        cursor.style.left = pos.x + 'px';
        cursor.style.top = pos.y + 'px';
      }
    }, { x, y })
    
    // Move Playwright mouse with smooth steps
    await page.mouse.move(x, y, { steps: 8 })
  }
}

async function visualClick(page: any, locator: any) {
  await moveCursor(page, locator)
  await page.waitForTimeout(100)
  
  // Trigger click ring animation
  await page.evaluate(() => {
    const cursor = document.getElementById('virtual-cursor');
    if (cursor) {
      cursor.classList.remove('click-pulse');
      void cursor.offsetWidth; // trigger reflow
      cursor.classList.add('click-pulse');
    }
  })
  
  await locator.first().click()
}

async function visualFill(page: any, locator: any, text: string) {
  await visualClick(page, locator)
  await page.waitForTimeout(150)
  await locator.first().fill(text)
}

// ─────────────────────────────────────────────────────────────
//  Dynamic Editorial Overlays Setup
// ─────────────────────────────────────────────────────────────

async function initVisualOverlays(page: any, featureName: string, vpName: string) {
  const isDesktop = vpName === 'desktop';
  
  const params = {
    issue: '414',
    kicker: featureName.toUpperCase(),
    agent: featureName === 'press' ? 'Curator' : 'Investigator',
    model: 'Sonnet 3.5',
    verify: 'Passed (29/29)',
    tally: 'Session State Only',
    isDesktop
  }
  
  await page.evaluate((p) => {
    // Inject Custom Stylesheets for video wrapping
    const style = document.createElement('style');
    style.innerHTML = `
      /* Hide native cursor & scrollbars */
      ::-webkit-scrollbar {
        display: none !important;
      }
      * {
        scrollbar-width: none !important;
        cursor: none !important;
      }

      ${p.isDesktop ? `
        /* Desktop Layout: 2-column grid editorial frame */
        body {
          display: grid !important;
          grid-template-columns: 1fr 260px !important;
          grid-template-rows: 60px 1fr !important;
          width: 100vw !important;
          height: 100vh !important;
          margin: 0 !important;
          padding: 0 !important;
          overflow: hidden !important;
          background: #FAF9F6 !important;
        }
        #root {
          grid-column: 1 !important;
          grid-row: 2 !important;
          overflow: auto !important;
          border-right: 1.5px solid rgba(226, 78, 27, 0.16) !important;
          background: inherit !important;
        }
        .video-header {
          grid-column: 1 / span 2;
          grid-row: 1;
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: 0 30px;
          border-bottom: 1.5px solid #E24E1B;
          color: #E24E1B;
          background: #FAF9F6;
          font-family: 'Courier Prime', monospace;
          z-index: 99999;
        }
        .video-masthead {
          font-family: 'EB Garamond', serif;
          font-weight: bold;
          font-size: 24px;
          letter-spacing: -0.5px;
        }
        .video-kicker {
          font-size: 14px;
          letter-spacing: 1px;
        }
        .video-sidebar {
          grid-column: 2;
          grid-row: 2;
          padding: 30px 20px;
          background: rgba(226, 78, 27, 0.02);
          display: flex;
          flex-direction: column;
          gap: 20px;
          color: #1F1E1D;
          font-family: 'Courier Prime', monospace;
          border-left: 0.5px solid rgba(226, 78, 27, 0.16);
          z-index: 99999;
        }
        .video-sidebar-title {
          font-weight: bold;
          font-size: 13px;
          color: #E24E1B;
          border-bottom: 1.5px solid #E24E1B;
          padding-bottom: 6px;
          letter-spacing: 1px;
        }
        .video-sidebar-item {
          display: flex;
          flex-direction: column;
          gap: 4px;
        }
        .video-sidebar-item dt {
          font-size: 11px;
          color: #6B4E3D;
        }
        .video-sidebar-item dd {
          font-size: 14px;
          font-weight: bold;
        }
      ` : `
        /* Mobile Layout: simple header at the top */
        body {
          display: flex !important;
          flex-direction: column !important;
          width: 100vw !important;
          height: 100vh !important;
          margin: 0 !important;
          padding: 0 !important;
          overflow: hidden !important;
          background: #FAF9F6 !important;
        }
        #root {
          flex: 1 !important;
          overflow: auto !important;
        }
        .video-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: 0 15px;
          height: 40px;
          border-bottom: 1.5px solid #E24E1B;
          color: #E24E1B;
          background: #FAF9F6;
          font-family: 'Courier Prime', monospace;
          z-index: 99999;
        }
        .video-masthead {
          font-family: 'EB Garamond', serif;
          font-weight: bold;
          font-size: 18px;
        }
        .video-kicker {
          font-size: 11px;
        }
      `}

      /* Virtual Cursor styling */
      #virtual-cursor {
        position: absolute;
        width: 12px;
        height: 12px;
        background: #E24E1B;
        border-radius: 50%;
        z-index: 1000000;
        pointer-events: none;
        transform: translate(-50%, -50%);
        transition: left 0.15s cubic-bezier(0.16, 1, 0.3, 1), top 0.15s cubic-bezier(0.16, 1, 0.3, 1);
        box-shadow: 0 0 0 2px rgba(255, 255, 255, 0.9), 0 2px 10px rgba(0,0,0,0.15);
        left: 200px;
        top: 200px;
      }
      .click-pulse {
        animation: pulse-ring 0.4s ease-out forwards;
      }
      @keyframes pulse-ring {
        0% {
          box-shadow: 0 0 0 0px rgba(226, 78, 27, 0.7);
        }
        100% {
          box-shadow: 0 0 0 24px rgba(226, 78, 27, 0);
        }
      }
    `;
    document.head.appendChild(style);

    // Create header element
    const header = document.createElement('header');
    header.className = 'video-header';
    header.innerHTML = `
      <span class="video-kicker">[ISSUE ${p.issue} · ${p.kicker}]</span>
      <span class="video-masthead">kernel.chat</span>
    `;
    document.body.appendChild(header);

    if (p.isDesktop) {
      // Create sidebar element
      const sidebar = document.createElement('aside');
      sidebar.className = 'video-sidebar';
      sidebar.innerHTML = `
        <span class="video-sidebar-title">Forensic Receipts</span>
        <div class="video-sidebar-item">
          <dt>Agent Speciality</dt>
          <dd>${p.agent}</dd>
        </div>
        <div class="video-sidebar-item">
          <dt>LLM Engine</dt>
          <dd>${p.model}</dd>
        </div>
        <div class="video-sidebar-item">
          <dt>Verification</dt>
          <dd>${p.verify}</dd>
        </div>
        <div class="video-sidebar-item">
          <dt>Tally Data</dt>
          <dd id="video-sidebar-tally">${p.tally}</dd>
        </div>
      `;
      document.body.appendChild(sidebar);
    }

    // Create custom cursor element
    const cursor = document.createElement('div');
    cursor.id = 'virtual-cursor';
    document.body.appendChild(cursor);
  }, params);
}

// ─────────────────────────────────────────────────────────────
//  Features Configuration
// ─────────────────────────────────────────────────────────────

interface FeatureSpec {
  name: string
  path: string
  automate: (page: any, slowMo: number) => Promise<void>
}

const FEATURES: FeatureSpec[] = [
  {
    name: 'dial',
    path: '/issues/399',
    automate: async (page, delay) => {
      console.log('  └─ Automating Dial...')
      const radioButtons = page.locator('.pop-instrument-dial button[role="radio"]')
      const count = await radioButtons.count()
      console.log(`     Found ${count} stops on the dial.`)
      
      for (let i = 0; i < count; i++) {
        await page.waitForTimeout(delay)
        console.log(`     - Hovering & selecting stop ${i + 1}...`)
        const opt = radioButtons.nth(i)
        await visualClick(page, opt)
      }
      await page.waitForTimeout(delay * 2)
    }
  },
  {
    name: 'compare',
    path: '/issues/406',
    automate: async (page, delay) => {
      console.log('  └─ Automating Compare switch...')
      const toggle = page.locator('button[role="switch"]')
      
      for (let i = 0; i < 4; i++) {
        await page.waitForTimeout(delay)
        console.log(`     - Toggling switch (cycle ${i + 1})...`)
        await visualClick(page, toggle)
      }
      await page.waitForTimeout(delay * 2)
    }
  },
  {
    name: 'sequence',
    path: '/issues/408',
    automate: async (page, delay) => {
      console.log('  └─ Automating Sequence rail...')
      const tabs = page.locator('.pop-sequence-rail button[role="tab"]')
      const count = await tabs.count()
      console.log(`     Found ${count} sequence stages.`)

      for (let i = 0; i < count; i++) {
        await page.waitForTimeout(delay)
        console.log(`     - Navigating to stage ${i + 1}...`)
        const tab = tabs.nth(i)
        await visualClick(page, tab)
      }
      await page.waitForTimeout(delay * 2)
    }
  },
  {
    name: 'galley',
    path: '/issues/410',
    automate: async (page, delay) => {
      console.log('  └─ Automating Galley edit...')
      const knifes = page.locator('.pop-galley-knife')
      const count = await knifes.count()
      console.log(`     Found ${count} passages available for striking.`)

      const targets = [1, 3, 6]
      for (const idx of targets) {
        if (idx < count) {
          await page.waitForTimeout(delay)
          console.log(`     - Striking passage ${idx + 1}...`)
          const knife = knifes.nth(idx)
          await visualClick(page, knife)
        }
      }
      
      if (count > 3) {
        await page.waitForTimeout(delay)
        console.log('     - Stet/reverting passage 4...')
        const knife = knifes.nth(3)
        await visualClick(page, knife)
      }
      
      await page.waitForTimeout(delay * 2)
    }
  },
  {
    name: 'tutor',
    path: '/issues/411',
    automate: async (page, delay) => {
      console.log('  └─ Automating Tutor teaching spread...')
      const buttons = page.locator('.pop-tutor button, .pop-tutor [role="radio"]')
      const count = await buttons.count()
      console.log(`     Found ${count} tutor interaction targets.`)
      
      for (let i = 0; i < Math.min(count, 6); i++) {
        await page.waitForTimeout(delay)
        console.log(`     - Clicking tutor item ${i + 1}...`)
        const btn = buttons.nth(i)
        await visualClick(page, btn)
      }
      await page.waitForTimeout(delay * 2)
    }
  },
  {
    name: 'margin',
    path: '/issues/412',
    automate: async (page, delay) => {
      console.log('  └─ Automating Margin marginalia...')
      const textareas = page.locator('.pop-margin-field')
      const count = await textareas.count()
      console.log(`     Found ${count} margin notes fields.`)

      if (count > 0) {
        await page.waitForTimeout(delay)
        console.log('     - Focusing margin field 1...')
        const area = textareas.nth(0)
        await visualClick(page, area)
        await page.waitForTimeout(200)

        console.log('     - Typing note...')
        await visualFill(page, area, 'Fermat wrote in this margin: we built a tool so we can make better videos!')
        await page.waitForTimeout(delay)
      }

      if (count > 1) {
        await page.waitForTimeout(delay)
        console.log('     - Focusing margin field 2...')
        const area = textareas.nth(1)
        await visualClick(page, area)
        await page.waitForTimeout(200)

        console.log('     - Typing second note...')
        await visualFill(page, area, 'Counting words on the client session, keeping nothing.')
        await page.waitForTimeout(delay * 2)
      }
    }
  },
  {
    name: 'press',
    path: '/issues/413',
    automate: async (page, delay) => {
      console.log('  └─ Automating Press composer...')
      
      // 1. Cycle through stock types (CREAM -> BUTTER -> KRAFT -> LEDGER)
      const stockOptions = page.locator('[aria-label="STOCK"] button[role="radio"]')
      const targetStocks = [1, 2, 5]
      for (const idx of targetStocks) {
        if (idx < await stockOptions.count()) {
          await page.waitForTimeout(delay)
          const opt = stockOptions.nth(idx)
          console.log(`     - Changing stock to ${await opt.innerText()}...`)
          await visualClick(page, opt)
        }
      }

      // 2. Cycle Ink Seeds (TOMATO -> COBALT / POOL / AMETHYST)
      const inkOptions = page.locator('[aria-label="INK"] button[role="radio"]')
      const targetInks = [1, 3, 5]
      for (const idx of targetInks) {
        if (idx < await inkOptions.count()) {
          await page.waitForTimeout(delay)
          const opt = inkOptions.nth(idx)
          console.log(`     - Changing ink accent to ${await opt.innerText()}...`)
          await visualClick(page, opt)
        }
      }

      // 3. Cycle Layouts (CLASSIC -> MONUMENT -> ASYM-LEFT)
      const layoutOptions = page.locator('[aria-label="LAYOUT"] button[role="radio"]')
      const layoutCount = await layoutOptions.count()
      for (let i = 1; i < layoutCount; i++) {
        await page.waitForTimeout(delay)
        const opt = layoutOptions.nth(i)
        console.log(`     - Changing layout to ${await opt.innerText()}...`)
        await visualClick(page, opt)
      }

      // 4. Fill in custom input texts
      const textInputs = page.locator('.pop-press-fields input')
      const inputCount = await textInputs.count()
      if (inputCount > 1) {
        await page.waitForTimeout(delay)
        console.log('     - Editing Emphasis text field...')
        const input = textInputs.nth(1)
        await visualFill(page, input, 'TOUCH A PAGE')
      }

      if (inputCount > 3) {
        await page.waitForTimeout(delay)
        console.log('     - Editing Seal text field...')
        const input = textInputs.nth(3)
        await visualFill(page, input, 'HANDED OVER')
      }

      if (inputCount > 4) {
        await page.waitForTimeout(delay)
        console.log('     - Editing Issue Number...')
        const input = textInputs.nth(4)
        await visualFill(page, input, '413')
      }

      await page.waitForTimeout(delay * 3)
    }
  }
]

// Filter features list based on CLI arguments
const targetFeatures = onlyFeature
  ? FEATURES.filter((f) => f.name === onlyFeature)
  : FEATURES

if (targetFeatures.length === 0) {
  console.error(`❌ Error: Feature "${onlyFeature}" is not recognized. Please choose from: dial, compare, sequence, galley, margin, press, tutor`)
  process.exit(1)
}

// ─────────────────────────────────────────────────────────────
//  Main Recording Loop
// ─────────────────────────────────────────────────────────────

async function main() {
  console.log('🚀 Starting Browser Video Recorder...')
  console.log(`🔗 Target URL: ${baseUrl}`)
  console.log(`📁 Outputs: ${OUTPUT_DIR}`)
  console.log(`⚡ Extra Delay: ${slowMo}ms\n`)

  const browser = await chromium.launch({ headless: true })

  try {
    for (const vpName of activeViewports) {
      const vpSize = VIEWPORTS[vpName]
      console.log(`📦 VIEWPORT: ${vpName.toUpperCase()} (${vpSize.width}x${vpSize.height})`)

      for (const feature of targetFeatures) {
        console.log(`🎬 Feature: ${feature.name.toUpperCase()}`)
        const targetUrl = `${baseUrl}${feature.path}`
        
        // Define clean file name and path
        const cleanFileName = `broll-${feature.name}-${vpName}.webm`
        const finalPath = path.join(OUTPUT_DIR, cleanFileName)

        // Set up video record path in context
        const context = await browser.newContext({
          viewport: vpSize,
          recordVideo: {
            dir: OUTPUT_DIR,
            size: vpSize
          }
        })

        const page = await context.newPage()

        // Navigate to url
        console.log(`   Navigating to: ${targetUrl}`)
        await page.goto(targetUrl, { waitUntil: 'networkidle' })

        // Initialize design overlay and custom cursor
        await initVisualOverlays(page, feature.name, vpName)

        // Wait a brief moment to settle animations
        await page.waitForTimeout(1000)

        // Perform automated interactions
        await feature.automate(page, slowMo)

        // Close page and context to finish video writing
        const video = page.video()
        await page.close()
        await context.close()

        if (video) {
          const rawVideoPath = await video.path()
          if (rawVideoPath && fs.existsSync(rawVideoPath)) {
            // Rename to human-readable target
            if (fs.existsSync(finalPath)) {
              fs.unlinkSync(finalPath)
            }
            fs.renameSync(rawVideoPath, finalPath)
            console.log(`   ✅ Video saved: ${cleanFileName}\n`)
          } else {
            console.log('   ❌ Error: Playwright video path was not resolved or file is missing.\n')
          }
        } else {
          console.log('   ❌ Error: Playwright video recording was not initiated.\n')
        }
      }
    }
  } catch (err) {
    console.error('❌ Fatal recording execution failure:', err)
  } finally {
    await browser.close()
    console.log('🏁 Recording session finished.')
  }
}

main()
