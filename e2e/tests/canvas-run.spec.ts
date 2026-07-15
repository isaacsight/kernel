import { test, expect } from '@playwright/test'
import { join } from 'path'

test.describe('Agentic Workflow Canvas E2E Run', () => {
  test('should load graph, trigger run, and output results', async ({ page }) => {
    // Listen to console events from the browser
    page.on('console', (msg) => {
      console.log(`[BROWSER CONSOLE] ${msg.type().toUpperCase()}: ${msg.text()}`)
    })

    // Navigate to canvas route
    await page.goto('/#/canvas')

    // Expect nodes to be rendered
    await expect(page.locator('.ka-canvas-node').first()).toBeVisible()
    
    // Check that we have nodes
    const nodeCount = await page.locator('.ka-canvas-node').count()
    console.log(`Detected ${nodeCount} nodes on the canvas.`)

    // Click "Run Graph" button
    const runBtn = page.getByRole('button', { name: 'Run Graph' })
    await expect(runBtn).toBeVisible()
    await runBtn.click()

    // Switch to Pipeline Log tab to view logs
    await page.getByRole('button', { name: 'Pipeline Log' }).click()

    // Wait for console log sidebar to show completion
    const consoleBox = page.locator('.ka-canvas-sidebar-output-box')
    await expect(consoleBox).toContainText('[RESOLVED] Visual pipeline execution complete.', { timeout: 15000 })

    // Wait a brief moment for final rendering
    await page.waitForTimeout(1000)

    // Capture screenshot and save to the conversation artifacts directory
    const screenshotPath = join(
      '/Users/isaachernandez/.gemini/antigravity-ide/brain/e8abce94-5ca7-419b-8b2e-7d836176af06',
      'canvas_run_result.png'
    )
    await page.screenshot({ path: screenshotPath, fullPage: true })
    console.log(`Screenshot saved to ${screenshotPath}`)

    // Verify output node has compiled results
    const outputNode = page.locator('.ka-canvas-node--output .ka-canvas-node-text-preview')
    await expect(outputNode).not.toContainText('*Result will render here...*')
    const outputText = await outputNode.innerText()
    console.log('Output node content:\n', outputText)
  })
})
