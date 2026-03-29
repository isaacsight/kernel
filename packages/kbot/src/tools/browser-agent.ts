// kbot Browser Agent — Autonomous browser agent mode
// The model sees the page, decides actions, and executes them in a loop.
// Requires: npx playwright install (run once)
//
// Usage: kbot "go to hackernews and find the top 3 stories about AI"
//
// Flow: navigate → screenshot → model analyzes → action → repeat → result

import { registerTool } from './index.js'
import {
  getByokKey, getByokProvider, getProviderModel, getProvider,
  type ByokProvider,
} from '../auth.js'

// ── Types ──

/** Discriminated union of all browser agent actions */
export type BrowserAction =
  | { action: 'click'; selector: string; description?: string }
  | { action: 'type'; selector: string; text: string; description?: string }
  | { action: 'navigate'; url: string; description?: string }
  | { action: 'scroll'; direction: 'up' | 'down'; amount?: number; description?: string }
  | { action: 'extract'; selector: string; description?: string }
  | { action: 'screenshot'; description?: string }
  | { action: 'done'; result: string }

/** A single step in the agent execution log */
export interface AgentStep {
  step: number
  action: BrowserAction
  outcome: string
  timestamp: string
}

/** Final result from the browser agent */
export interface BrowserAgentResult {
  success: boolean
  result: string
  steps: AgentStep[]
  totalSteps: number
  url: string
}

// ── Playwright management ──

let browserInstance: any = null
let contextInstance: any = null
let pageInstance: any = null

async function ensureBrowser(): Promise<any> {
  if (pageInstance) return pageInstance

  // Try playwright, then playwright-core
  let chromium: any
  try {
    const pw = await import('playwright')
    chromium = pw.chromium
  } catch {
    try {
      const pwCore = await import('playwright-core' as string)
      chromium = pwCore.chromium
    } catch {
      throw new Error(
        'Browser agent requires playwright. Install with: npm i -g playwright && npx playwright install chromium'
      )
    }
  }

  browserInstance = await chromium.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
  })
  contextInstance = await browserInstance.newContext({
    viewport: { width: 1280, height: 720 },
    userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36',
  })
  pageInstance = await contextInstance.newPage()
  return pageInstance
}

async function closeBrowserAgent(): Promise<void> {
  if (browserInstance) {
    await browserInstance.close().catch(() => {})
    browserInstance = null
    contextInstance = null
    pageInstance = null
  }
}

// ── Screenshot capture ──

async function takeScreenshot(page: any): Promise<string> {
  const buffer: Buffer = await page.screenshot({ type: 'png' })
  return buffer.toString('base64')
}

// ── Action executors ──

async function executeAction(page: any, action: BrowserAction): Promise<string> {
  switch (action.action) {
    case 'click': {
      try {
        // Try CSS selector first
        await page.click(action.selector, { timeout: 5_000 })
        return `Clicked: ${action.selector}`
      } catch {
        // Fall back to text-based click
        try {
          await page.getByText(action.selector, { exact: false }).first().click({ timeout: 5_000 })
          return `Clicked text: ${action.selector}`
        } catch {
          return `Failed to click: ${action.selector} — element not found`
        }
      }
    }

    case 'type': {
      try {
        await page.fill(action.selector, action.text, { timeout: 5_000 })
        return `Typed "${action.text}" into ${action.selector}`
      } catch {
        try {
          // Try clicking first, then typing
          await page.click(action.selector, { timeout: 3_000 })
          await page.keyboard.type(action.text, { delay: 30 })
          return `Typed "${action.text}" into ${action.selector} (via keyboard)`
        } catch {
          return `Failed to type into: ${action.selector} — element not found`
        }
      }
    }

    case 'navigate': {
      try {
        await page.goto(action.url, { waitUntil: 'domcontentloaded', timeout: 30_000 })
        const title = await page.title()
        return `Navigated to: ${action.url} — Title: ${title}`
      } catch (err) {
        return `Navigation failed: ${err instanceof Error ? err.message : String(err)}`
      }
    }

    case 'scroll': {
      const amount = action.amount ?? 500
      const delta = action.direction === 'down' ? amount : -amount
      await page.mouse.wheel(0, delta)
      // Brief wait for scroll to settle and lazy-loaded content
      await page.waitForTimeout(500)
      return `Scrolled ${action.direction} by ${amount}px`
    }

    case 'extract': {
      try {
        const elements = await page.$$(action.selector)
        if (elements.length === 0) {
          // Try getting full body text as fallback
          if (action.selector === 'body' || action.selector === '*') {
            const text = await page.innerText('body').catch(() => '')
            const truncated = text.length > 3000 ? text.slice(0, 3000) + '\n...(truncated)' : text
            return `Extracted body text:\n${truncated}`
          }
          return `No elements found for: ${action.selector}`
        }

        const texts: string[] = []
        for (const el of elements.slice(0, 20)) {
          const text = await el.innerText().catch(() => '')
          if (text.trim()) texts.push(text.trim())
        }
        const combined = texts.join('\n---\n')
        const truncated = combined.length > 3000 ? combined.slice(0, 3000) + '\n...(truncated)' : combined
        return `Extracted ${texts.length} elements from "${action.selector}":\n${truncated}`
      } catch {
        return `Extraction failed for: ${action.selector}`
      }
    }

    case 'screenshot': {
      return 'Screenshot taken for analysis'
    }

    case 'done': {
      return action.result
    }

    default:
      return `Unknown action: ${(action as BrowserAction).action}`
  }
}

// ── Model interaction ──

/** Build the system prompt for the browser agent */
function buildBrowserAgentPrompt(task: string): string {
  return `You are a browser automation agent. Your task is to interact with web pages to accomplish the user's goal.

TASK: ${task}

You can see a screenshot of the current page. Analyze it and decide the next action.

Respond with EXACTLY ONE JSON object (no markdown, no backticks) choosing one of these actions:

{"action":"click","selector":"CSS selector or visible text","description":"why"}
{"action":"type","selector":"CSS selector for input","text":"text to type","description":"why"}
{"action":"navigate","url":"https://...","description":"why"}
{"action":"scroll","direction":"up|down","amount":500,"description":"why"}
{"action":"extract","selector":"CSS selector","description":"what to extract"}
{"action":"screenshot","description":"why I need a fresh look"}
{"action":"done","result":"Final answer or extracted information"}

Guidelines:
- Use CSS selectors when possible (e.g., "input[name=q]", "button.submit", "#search")
- For clicks, you can also use visible text content as the selector
- Always extract information before marking as done
- If the page hasn't loaded or you need to see the current state, use "screenshot"
- When the task is complete, use "done" with the full result
- If stuck after several attempts, use "done" with a partial result and explanation
- Keep descriptions brief — they are for logging only`
}

/** Send screenshot to model and get next action */
async function getNextAction(
  screenshotBase64: string,
  task: string,
  history: AgentStep[],
  provider: ByokProvider,
  apiKey: string,
  model: string,
): Promise<BrowserAction> {
  const providerConfig = getProvider(provider)
  const systemPrompt = buildBrowserAgentPrompt(task)

  // Build history context
  const historyText = history.length > 0
    ? '\n\nPrevious actions:\n' + history.map(s =>
        `Step ${s.step}: ${s.action.action}${s.action.action !== 'done' ? ` → ${s.outcome}` : ''}`
      ).join('\n')
    : ''

  const userMessage = `Here is the current page screenshot. What should I do next?${historyText}`

  let responseText: string

  if (providerConfig.apiStyle === 'anthropic') {
    responseText = await callAnthropicVision(
      apiKey, providerConfig.apiUrl, model,
      systemPrompt, userMessage, screenshotBase64,
    )
  } else if (providerConfig.apiStyle === 'openai') {
    responseText = await callOpenAIVision(
      apiKey, providerConfig.apiUrl, model,
      systemPrompt, userMessage, screenshotBase64,
    )
  } else if (providerConfig.apiStyle === 'google') {
    responseText = await callGoogleVision(
      apiKey, model,
      systemPrompt, userMessage, screenshotBase64,
    )
  } else {
    // Fallback: text-only mode using page text instead of screenshot
    responseText = await callTextOnly(
      apiKey, providerConfig, model,
      systemPrompt, userMessage,
    )
  }

  return parseAction(responseText)
}

/** Parse the model's response into a BrowserAction */
function parseAction(text: string): BrowserAction {
  // Strip markdown code fences if present
  const cleaned = text.replace(/^```(?:json)?\s*/m, '').replace(/\s*```\s*$/m, '').trim()

  // Try to find a JSON object in the response
  const jsonMatch = cleaned.match(/\{[\s\S]*\}/)
  if (!jsonMatch) {
    // If no JSON found, treat the whole response as a "done" result
    return { action: 'done', result: `Model returned non-JSON response: ${text.slice(0, 500)}` }
  }

  try {
    const parsed = JSON.parse(jsonMatch[0])

    // Validate action type
    const validActions = ['click', 'type', 'navigate', 'scroll', 'extract', 'screenshot', 'done']
    if (!parsed.action || !validActions.includes(parsed.action)) {
      return { action: 'done', result: `Invalid action: ${parsed.action}. Response: ${text.slice(0, 300)}` }
    }

    // Type-specific validation
    switch (parsed.action) {
      case 'click':
        if (!parsed.selector) return { action: 'done', result: 'Click action missing selector' }
        return { action: 'click', selector: String(parsed.selector), description: parsed.description }

      case 'type':
        if (!parsed.selector || parsed.text === undefined)
          return { action: 'done', result: 'Type action missing selector or text' }
        return { action: 'type', selector: String(parsed.selector), text: String(parsed.text), description: parsed.description }

      case 'navigate':
        if (!parsed.url) return { action: 'done', result: 'Navigate action missing url' }
        return { action: 'navigate', url: String(parsed.url), description: parsed.description }

      case 'scroll':
        return {
          action: 'scroll',
          direction: parsed.direction === 'up' ? 'up' : 'down',
          amount: typeof parsed.amount === 'number' ? parsed.amount : 500,
          description: parsed.description,
        }

      case 'extract':
        if (!parsed.selector) return { action: 'done', result: 'Extract action missing selector' }
        return { action: 'extract', selector: String(parsed.selector), description: parsed.description }

      case 'screenshot':
        return { action: 'screenshot', description: parsed.description }

      case 'done':
        return { action: 'done', result: String(parsed.result || 'Task completed (no result provided)') }

      default:
        return { action: 'done', result: `Unknown action: ${parsed.action}` }
    }
  } catch {
    return { action: 'done', result: `Failed to parse action JSON: ${text.slice(0, 300)}` }
  }
}

// ── Provider-specific vision calls ──

/** Anthropic Messages API with vision */
async function callAnthropicVision(
  apiKey: string, apiUrl: string, model: string,
  system: string, userText: string, screenshotBase64: string,
): Promise<string> {
  const res = await fetch(apiUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model,
      max_tokens: 1024,
      system,
      messages: [{
        role: 'user',
        content: [
          {
            type: 'image',
            source: { type: 'base64', media_type: 'image/png', data: screenshotBase64 },
          },
          { type: 'text', text: userText },
        ],
      }],
    }),
  })

  if (!res.ok) {
    const body = await res.text().catch(() => '')
    throw new Error(`Anthropic API error ${res.status}: ${body.slice(0, 200)}`)
  }

  const data = await res.json() as { content?: Array<{ type: string; text?: string }> }
  const blocks = data.content || []
  return blocks.filter(b => b.type === 'text').map(b => b.text || '').join('')
}

/** OpenAI-compatible vision API */
async function callOpenAIVision(
  apiKey: string, apiUrl: string, model: string,
  system: string, userText: string, screenshotBase64: string,
): Promise<string> {
  const res = await fetch(apiUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model,
      max_tokens: 1024,
      messages: [
        { role: 'system', content: system },
        {
          role: 'user',
          content: [
            {
              type: 'image_url',
              image_url: { url: `data:image/png;base64,${screenshotBase64}`, detail: 'low' },
            },
            { type: 'text', text: userText },
          ],
        },
      ],
    }),
  })

  if (!res.ok) {
    const body = await res.text().catch(() => '')
    throw new Error(`OpenAI API error ${res.status}: ${body.slice(0, 200)}`)
  }

  const data = await res.json() as { choices?: Array<{ message?: { content?: string } }> }
  return data.choices?.[0]?.message?.content || ''
}

/** Google Gemini vision API */
async function callGoogleVision(
  apiKey: string, model: string,
  system: string, userText: string, screenshotBase64: string,
): Promise<string> {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`

  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-goog-api-key': apiKey },
    body: JSON.stringify({
      systemInstruction: { parts: [{ text: system }] },
      contents: [{
        parts: [
          { inlineData: { mimeType: 'image/png', data: screenshotBase64 } },
          { text: userText },
        ],
      }],
      generationConfig: { maxOutputTokens: 1024 },
    }),
  })

  if (!res.ok) {
    const body = await res.text().catch(() => '')
    throw new Error(`Google API error ${res.status}: ${body.slice(0, 200)}`)
  }

  const data = await res.json() as { candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }> }
  return data.candidates?.[0]?.content?.parts?.map(p => p.text || '').join('') || ''
}

/** Text-only fallback for providers without vision */
async function callTextOnly(
  apiKey: string, providerConfig: { apiUrl: string; apiStyle: string },
  model: string, system: string, userText: string,
): Promise<string> {
  // OpenAI-compatible text-only
  const res = await fetch(providerConfig.apiUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model,
      max_tokens: 1024,
      messages: [
        { role: 'system', content: system },
        { role: 'user', content: userText + '\n\n(Note: screenshot not available — using text-only mode. Describe what you need to do based on context.)' },
      ],
    }),
  })

  if (!res.ok) {
    const body = await res.text().catch(() => '')
    throw new Error(`API error ${res.status}: ${body.slice(0, 200)}`)
  }

  const data = await res.json() as { choices?: Array<{ message?: { content?: string } }> }
  return data.choices?.[0]?.message?.content || ''
}

// ── Main agent loop ──

async function runBrowserAgent(
  task: string,
  startUrl?: string,
  maxSteps: number = 10,
): Promise<BrowserAgentResult> {
  const provider = getByokProvider()
  const apiKey = getByokKey()
  if (!apiKey) {
    return {
      success: false,
      result: 'No API key configured. Run: kbot auth',
      steps: [],
      totalSteps: 0,
      url: '',
    }
  }

  const model = getProviderModel(provider, 'default', 'browser vision analysis')
  const steps: AgentStep[] = []
  let page: any

  try {
    page = await ensureBrowser()
  } catch (err) {
    return {
      success: false,
      result: err instanceof Error ? err.message : String(err),
      steps: [],
      totalSteps: 0,
      url: '',
    }
  }

  try {
    // Navigate to starting URL if provided
    if (startUrl) {
      await page.goto(startUrl, { waitUntil: 'domcontentloaded', timeout: 30_000 })
    }

    for (let step = 1; step <= maxSteps; step++) {
      // Take screenshot for model analysis
      const screenshot = await takeScreenshot(page)

      // Ask model what to do next
      const action = await getNextAction(screenshot, task, steps, provider, apiKey, model)

      // Execute the action
      const outcome = await executeAction(page, action)

      steps.push({
        step,
        action,
        outcome,
        timestamp: new Date().toISOString(),
      })

      // If done, return the result
      if (action.action === 'done') {
        return {
          success: true,
          result: action.result,
          steps,
          totalSteps: step,
          url: page.url(),
        }
      }
    }

    // Max steps reached — take a final screenshot and extract what we can
    const finalUrl = page.url()
    const bodyText = await page.innerText('body').catch(() => '')
    const truncBody = bodyText.length > 2000 ? bodyText.slice(0, 2000) + '...' : bodyText

    return {
      success: false,
      result: `Reached maximum steps (${maxSteps}). Last page: ${finalUrl}\n\nPage content:\n${truncBody}`,
      steps,
      totalSteps: maxSteps,
      url: finalUrl,
    }
  } catch (err) {
    return {
      success: false,
      result: `Browser agent error: ${err instanceof Error ? err.message : String(err)}`,
      steps,
      totalSteps: steps.length,
      url: page?.url?.() || '',
    }
  } finally {
    await closeBrowserAgent()
  }
}

// ── Tool registration ──

export function registerBrowserAgentTools(): void {
  registerTool({
    name: 'browser_agent',
    description:
      'Autonomous browser agent — give it a task in natural language and it will open a browser, ' +
      'navigate pages, click, type, scroll, and extract information to accomplish the goal. ' +
      'The agent sees screenshots of the page and decides actions in a loop until the task is done. ' +
      'Requires playwright to be installed.',
    parameters: {
      task: {
        type: 'string',
        description: 'Natural language description of what to accomplish (e.g., "Go to Hacker News and find the top 3 AI stories")',
        required: true,
      },
      url: {
        type: 'string',
        description: 'Starting URL to navigate to (optional — agent can navigate on its own)',
      },
      max_steps: {
        type: 'number',
        description: 'Maximum number of interaction steps before stopping (default: 10)',
        default: 10,
      },
    },
    tier: 'free',
    timeout: 600_000, // 10 min — browser tasks can be slow
    maxResultSize: 100_000, // 100KB — browser results can be large
    async execute(args) {
      const task = String(args.task)
      const url = args.url ? String(args.url) : undefined
      const maxSteps = typeof args.max_steps === 'number' ? args.max_steps : 10

      const result = await runBrowserAgent(task, url, maxSteps)

      // Format output
      const lines: string[] = []
      lines.push(`Browser Agent — ${result.success ? 'SUCCESS' : 'INCOMPLETE'}`)
      lines.push(`Steps: ${result.totalSteps}`)
      if (result.url) lines.push(`Final URL: ${result.url}`)
      lines.push('')

      // Action log
      if (result.steps.length > 0) {
        lines.push('Action Log:')
        for (const step of result.steps) {
          const desc = step.action.action !== 'done' && 'description' in step.action && step.action.description
            ? ` — ${step.action.description}`
            : ''
          lines.push(`  [${step.step}] ${step.action.action}${desc}`)
          lines.push(`       → ${step.outcome.split('\n')[0]}`)
        }
        lines.push('')
      }

      lines.push('Result:')
      lines.push(result.result)

      return lines.join('\n')
    },
  })
}
