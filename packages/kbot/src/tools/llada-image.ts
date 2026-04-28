// kbot Local Image Thoughtful Tool — LLaDA2.0-Uni route
//
// Mirrors `image-thoughtful.ts` (which uses OpenAI gpt-image-2) but routes
// every call — plan, refine, generate — through a local LLaDA2.0-Uni server.
// LLaDA is a *unified* discrete-diffusion model: the same model that does
// chat reasoning also does the final image generation, so this tool is the
// $0 / no-API-key path to thoughtful image gen.
//
// SPEC: refine when LLaDA's API stabilizes — currently assumes OpenAI-compatible
// shape on http://localhost:8000. See `src/providers/llada.ts` for details.

import { z } from 'zod'
import type { ToolDefinition } from './index.js'
import { LLaDAClient } from '../providers/llada.js'

// ─────────────────────────────────────────────────────────────────────────
// Schema (kept in lockstep with image-thoughtful.ts)
// ─────────────────────────────────────────────────────────────────────────

const AspectRatio = z.enum(['1:1', '16:9', '9:16', '4:3', '3:4'])

export const lladaImageInputSchema = z.object({
  prompt: z.string().min(1, 'prompt is required'),
  aspect_ratio: AspectRatio.optional().default('1:1'),
  thinking_steps: z.number().int().min(1).max(5).optional().default(3),
  style_hints: z.string().optional(),
  reference_image_url: z.string().url().optional(),
})

export type LLaDAImageInput = z.infer<typeof lladaImageInputSchema>

export interface LLaDAImageThoughtfulOutput {
  url: string
  plan: string
  refinements: string[]
  final_prompt: string
  /** Optional reasoning trace surfaced by LLaDA's `thinking` mode. */
  thinking?: string
}

// LLaDA's image_h/image_w map cleanly off these aspect-ratio sizes.
const SIZE_MAP: Record<z.infer<typeof AspectRatio>, string> = {
  '1:1': '1024x1024',
  '16:9': '1792x1024',
  '9:16': '1024x1792',
  '4:3': '1408x1056',
  '3:4': '1056x1408',
}

// ─────────────────────────────────────────────────────────────────────────
// Prompts (intentionally identical wording to image-thoughtful for parity)
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

function buildPlanUserText(input: LLaDAImageInput): string {
  return [
    `Brief: ${input.prompt}`,
    `Aspect ratio: ${input.aspect_ratio}`,
    input.style_hints ? `Style hints: ${input.style_hints}` : null,
    input.reference_image_url ? `Reference image URL: ${input.reference_image_url}` : null,
  ]
    .filter(Boolean)
    .join('\n')
}

// ─────────────────────────────────────────────────────────────────────────
// Runner
// ─────────────────────────────────────────────────────────────────────────

export interface RunLLaDAImageOptions {
  /** Inject a client (for tests). Defaults to a fresh LLaDAClient(). */
  client?: LLaDAClient
}

export async function runLLaDAImageThoughtful(
  rawInput: unknown,
  opts: RunLLaDAImageOptions = {}
): Promise<LLaDAImageThoughtfulOutput> {
  const input = lladaImageInputSchema.parse(rawInput)
  const client = opts.client ?? new LLaDAClient()

  // 1. Plan
  const planResp = await client.chat({
    messages: [
      { role: 'system', content: planSystemPrompt() },
      { role: 'user', content: buildPlanUserText(input) },
    ],
    temperature: 0.5,
  })
  const plan = planResp.text

  // 2. Refine — thinking_steps - 1 critique passes (1 = no refinement)
  const refinements: string[] = []
  let currentPlan = plan
  for (let i = 1; i < input.thinking_steps; i++) {
    const next = await client.chat({
      messages: [
        { role: 'system', content: critiqueSystemPrompt() },
        {
          role: 'user',
          content: `Brief: ${input.prompt}\nCurrent plan: ${currentPlan}`,
        },
      ],
      temperature: 0.5,
    })
    refinements.push(next.text)
    currentPlan = next.text
  }

  // 3. Compose final prompt
  const finalResp = await client.chat({
    messages: [
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
    temperature: 0.4,
  })
  const finalPromptText = finalResp.text

  // 4. Generate (LLaDA-native call — same model, diffusion decoder).
  const img = await client.generateImage({
    prompt: finalPromptText,
    size: SIZE_MAP[input.aspect_ratio],
    refImage: input.reference_image_url,
  })

  return {
    url: img.url,
    plan,
    refinements,
    final_prompt: finalPromptText,
    thinking: img.thinking,
  }
}

// ─────────────────────────────────────────────────────────────────────────
// Tool definition
// ─────────────────────────────────────────────────────────────────────────

export const lladaImageTool: ToolDefinition = {
  name: 'local_image_thoughtful',
  description:
    'Local plan/refine/generate image tool routed through a LLaDA2.0-Uni server (default http://localhost:8000). The same unified diffusion LLM does both the planning and the final image generation, so no OpenAI key is required. Returns the image URL plus the full reasoning trail.',
  tier: 'free',
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
      description:
        'Optional URL of a reference image. Forwarded to LLaDA as the editing source (input_image).',
    },
  },
  async execute(args) {
    try {
      const out = await runLLaDAImageThoughtful(args)
      return JSON.stringify(out, null, 2)
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err)
      return `Error: ${message}`
    }
  },
}
