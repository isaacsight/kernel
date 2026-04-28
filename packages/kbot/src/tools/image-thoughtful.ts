// kbot Image Thoughtful Tool
// Mirrors OpenAI's "Images 2.0 with thinking": plan → refine (1..N) → generate.
// The thinking phase uses gpt-4o-mini chat completions; the final generation
// hits the OpenAI Images API (gpt-image-2). Reference images are forwarded as
// input_image when supplied.

import { z } from 'zod'
import type { ToolDefinition } from './index.js'

// ─────────────────────────────────────────────────────────────────────────
// Schema
// ─────────────────────────────────────────────────────────────────────────

const AspectRatio = z.enum(['1:1', '16:9', '9:16', '4:3', '3:4'])

export const imageThoughtfulInputSchema = z.object({
  prompt: z.string().min(1, 'prompt is required'),
  aspect_ratio: AspectRatio.optional().default('1:1'),
  thinking_steps: z.number().int().min(1).max(5).optional().default(3),
  style_hints: z.string().optional(),
  reference_image_url: z.string().url().optional(),
})

export type ImageThoughtfulInput = z.infer<typeof imageThoughtfulInputSchema>

export interface ImageThoughtfulOutput {
  url: string
  plan: string
  refinements: string[]
  final_prompt: string
}

// ─────────────────────────────────────────────────────────────────────────
// Aspect ratio → image API "size"
// ─────────────────────────────────────────────────────────────────────────

const SIZE_MAP: Record<z.infer<typeof AspectRatio>, string> = {
  '1:1': '1024x1024',
  '16:9': '1792x1024',
  '9:16': '1024x1792',
  '4:3': '1408x1056',
  '3:4': '1056x1408',
}

// ─────────────────────────────────────────────────────────────────────────
// OpenAI helpers (built-in fetch, no SDK)
// ─────────────────────────────────────────────────────────────────────────

const OPENAI_CHAT_URL = 'https://api.openai.com/v1/chat/completions'
const OPENAI_IMAGE_URL = 'https://api.openai.com/v1/images/generations'
const PLANNING_MODEL = 'gpt-4o-mini'
const IMAGE_MODEL = 'gpt-image-2'

interface ChatMessageContentText {
  type: 'text'
  text: string
}
interface ChatMessageContentImage {
  type: 'input_image'
  image_url: string
}
type ChatMessageContent = string | Array<ChatMessageContentText | ChatMessageContentImage>

interface ChatMessage {
  role: 'system' | 'user' | 'assistant'
  content: ChatMessageContent
}

async function openaiChat(
  apiKey: string,
  messages: ChatMessage[],
  opts: { temperature?: number; jsonMode?: boolean } = {}
): Promise<string> {
  const body: Record<string, unknown> = {
    model: PLANNING_MODEL,
    messages,
    temperature: opts.temperature ?? 0.4,
  }
  if (opts.jsonMode) {
    body.response_format = { type: 'json_object' }
  }

  const res = await fetch(OPENAI_CHAT_URL, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  })

  if (!res.ok) {
    const text = await res.text().catch(() => '')
    throw new Error(`OpenAI chat failed: ${res.status} ${res.statusText} ${text}`.trim())
  }

  const data = (await res.json()) as {
    choices?: Array<{ message?: { content?: string } }>
  }
  const content = data.choices?.[0]?.message?.content
  if (!content) {
    throw new Error('OpenAI chat returned no content')
  }
  return content
}

async function openaiImage(
  apiKey: string,
  prompt: string,
  size: string,
  referenceImageUrl?: string
): Promise<string> {
  const body: Record<string, unknown> = {
    model: IMAGE_MODEL,
    prompt,
    size,
    n: 1,
  }
  if (referenceImageUrl) {
    body.input_image = referenceImageUrl
  }

  const res = await fetch(OPENAI_IMAGE_URL, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  })

  if (!res.ok) {
    const text = await res.text().catch(() => '')
    throw new Error(`OpenAI image failed: ${res.status} ${res.statusText} ${text}`.trim())
  }

  const data = (await res.json()) as {
    data?: Array<{ url?: string; b64_json?: string }>
  }
  const url = data.data?.[0]?.url
  if (!url) {
    // gpt-image-* sometimes returns b64; surface that as a data URL
    const b64 = data.data?.[0]?.b64_json
    if (b64) return `data:image/png;base64,${b64}`
    throw new Error('OpenAI image returned no url')
  }
  return url
}

// ─────────────────────────────────────────────────────────────────────────
// Plan + refine loop
// ─────────────────────────────────────────────────────────────────────────

function planSystemPrompt(): string {
  return [
    'You are an expert art director planning an image before generation.',
    'Return a JSON object with keys: composition, palette, key_elements, mood, lighting, style.',
    'Keep each value to one or two sentences. Be concrete and visual.',
  ].join(' ')
}

function critiqueSystemPrompt(): string {
  return [
    'You are a critic refining an image plan. Read the prompt and the current plan,',
    'identify the single weakest element, and return an improved JSON plan with the',
    'same keys (composition, palette, key_elements, mood, lighting, style).',
    'Do not restate the brief — produce the next iteration of the plan only.',
  ].join(' ')
}

function finalPromptSystemPrompt(): string {
  return [
    'You compose the final image-generation prompt. Combine the brief, plan, and any',
    'style hints into a single cohesive paragraph (no JSON, no headings, no lists).',
    'Lead with subject and composition, then palette, lighting, mood, and style.',
  ].join(' ')
}

function buildPlanUserContent(
  input: ImageThoughtfulInput
): ChatMessageContent {
  const parts: Array<ChatMessageContentText | ChatMessageContentImage> = [
    {
      type: 'text',
      text: [
        `Brief: ${input.prompt}`,
        `Aspect ratio: ${input.aspect_ratio}`,
        input.style_hints ? `Style hints: ${input.style_hints}` : null,
      ]
        .filter(Boolean)
        .join('\n'),
    },
  ]
  if (input.reference_image_url) {
    parts.push({ type: 'input_image', image_url: input.reference_image_url })
  }
  return parts
}

// ─────────────────────────────────────────────────────────────────────────
// Tool definition
// ─────────────────────────────────────────────────────────────────────────

export async function runImageThoughtful(
  rawInput: unknown,
  env: NodeJS.ProcessEnv = process.env
): Promise<ImageThoughtfulOutput> {
  const input = imageThoughtfulInputSchema.parse(rawInput)

  const apiKey = env.OPENAI_API_KEY
  if (!apiKey) {
    throw new Error('OPENAI_API_KEY is not set')
  }

  // 1. Plan
  const plan = await openaiChat(
    apiKey,
    [
      { role: 'system', content: planSystemPrompt() },
      { role: 'user', content: buildPlanUserContent(input) },
    ],
    { jsonMode: true, temperature: 0.5 }
  )

  // 2. Refine (thinking_steps - 1 critiques; thinking_steps=1 means no refinement)
  const refinements: string[] = []
  let currentPlan = plan
  for (let i = 1; i < input.thinking_steps; i++) {
    const next = await openaiChat(
      apiKey,
      [
        { role: 'system', content: critiqueSystemPrompt() },
        {
          role: 'user',
          content: [
            { type: 'text', text: `Brief: ${input.prompt}` },
            { type: 'text', text: `Current plan: ${currentPlan}` },
          ],
        },
      ],
      { jsonMode: true, temperature: 0.5 }
    )
    refinements.push(next)
    currentPlan = next
  }

  // 3. Compose final prompt
  const finalPromptText = await openaiChat(
    apiKey,
    [
      { role: 'system', content: finalPromptSystemPrompt() },
      {
        role: 'user',
        content: [
          `Brief: ${input.prompt}`,
          input.style_hints ? `Style hints: ${input.style_hints}` : '',
          `Plan: ${currentPlan}`,
        ]
          .filter(Boolean)
          .join('\n\n'),
      },
    ],
    { temperature: 0.4 }
  )

  // 4. Generate
  const url = await openaiImage(
    apiKey,
    finalPromptText,
    SIZE_MAP[input.aspect_ratio],
    input.reference_image_url
  )

  return {
    url,
    plan,
    refinements,
    final_prompt: finalPromptText,
  }
}

export const imageThoughtfulTool: ToolDefinition = {
  name: 'image_thoughtful',
  description:
    'Generate an image with an explicit plan/refine loop. Plans the image (composition, palette, key elements), critiques and refines the plan, then issues the final OpenAI image generation. Returns the image URL plus the full reasoning trail.',
  tier: 'pro',
  parameters: {
    prompt: {
      type: 'string',
      description: 'What to draw — the brief.',
      required: true,
    },
    aspect_ratio: {
      type: 'string',
      description: 'One of "1:1", "16:9", "9:16", "4:3", "3:4". Default "1:1".',
      default: '1:1',
    },
    thinking_steps: {
      type: 'number',
      description: 'How many plan iterations to run (1..5). Default 3. 1 skips refinement.',
      default: 3,
    },
    style_hints: {
      type: 'string',
      description: 'Optional style guidance ("oil painting", "ukiyo-e", "isometric vector").',
    },
    reference_image_url: {
      type: 'string',
      description: 'Optional URL of a reference image. Passed to the planning model and forwarded to the image API as input_image.',
    },
  },
  async execute(args) {
    try {
      const out = await runImageThoughtful(args)
      return JSON.stringify(out, null, 2)
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err)
      return `Error: ${message}`
    }
  },
}
