// kbot ComfyUI Plugin — Local AI image generation via ComfyUI
// Connects to a locally-running ComfyUI instance at http://127.0.0.1:8188
// for txt2img, img2img, model listing, and queue management.

import { readFileSync } from 'node:fs'
import { basename } from 'node:path'
import { registerTool } from './index.js'

const COMFYUI_BASE = 'http://127.0.0.1:8188'

/** Build a minimal txt2img workflow for ComfyUI */
function buildTxt2ImgWorkflow(opts: {
  prompt: string
  negative_prompt: string
  width: number
  height: number
  steps: number
  cfg_scale: number
  seed: number
  model: string
}): Record<string, unknown> {
  return {
    '3': {
      class_type: 'KSampler',
      inputs: {
        seed: opts.seed,
        steps: opts.steps,
        cfg: opts.cfg_scale,
        sampler_name: 'euler',
        scheduler: 'normal',
        denoise: 1.0,
        model: ['4', 0],
        positive: ['6', 0],
        negative: ['7', 0],
        latent_image: ['5', 0],
      },
    },
    '4': {
      class_type: 'CheckpointLoaderSimple',
      inputs: {
        ckpt_name: opts.model,
      },
    },
    '5': {
      class_type: 'EmptyLatentImage',
      inputs: {
        width: opts.width,
        height: opts.height,
        batch_size: 1,
      },
    },
    '6': {
      class_type: 'CLIPTextEncode',
      inputs: {
        text: opts.prompt,
        clip: ['4', 1],
      },
    },
    '7': {
      class_type: 'CLIPTextEncode',
      inputs: {
        text: opts.negative_prompt,
        clip: ['4', 1],
      },
    },
    '8': {
      class_type: 'VAEDecode',
      inputs: {
        samples: ['3', 0],
        vae: ['4', 2],
      },
    },
    '9': {
      class_type: 'SaveImage',
      inputs: {
        filename_prefix: 'kbot',
        images: ['8', 0],
      },
    },
  }
}

/** Build an img2img workflow for ComfyUI */
function buildImg2ImgWorkflow(opts: {
  prompt: string
  negative_prompt: string
  width: number
  height: number
  steps: number
  cfg_scale: number
  seed: number
  model: string
  image_name: string
  denoise: number
}): Record<string, unknown> {
  return {
    '3': {
      class_type: 'KSampler',
      inputs: {
        seed: opts.seed,
        steps: opts.steps,
        cfg: opts.cfg_scale,
        sampler_name: 'euler',
        scheduler: 'normal',
        denoise: opts.denoise,
        model: ['4', 0],
        positive: ['6', 0],
        negative: ['7', 0],
        latent_image: ['10', 0],
      },
    },
    '4': {
      class_type: 'CheckpointLoaderSimple',
      inputs: {
        ckpt_name: opts.model,
      },
    },
    '6': {
      class_type: 'CLIPTextEncode',
      inputs: {
        text: opts.prompt,
        clip: ['4', 1],
      },
    },
    '7': {
      class_type: 'CLIPTextEncode',
      inputs: {
        text: opts.negative_prompt,
        clip: ['4', 1],
      },
    },
    '8': {
      class_type: 'VAEDecode',
      inputs: {
        samples: ['3', 0],
        vae: ['4', 2],
      },
    },
    '9': {
      class_type: 'SaveImage',
      inputs: {
        filename_prefix: 'kbot',
        images: ['8', 0],
      },
    },
    '10': {
      class_type: 'VAEEncode',
      inputs: {
        pixels: ['11', 0],
        vae: ['4', 2],
      },
    },
    '11': {
      class_type: 'LoadImage',
      inputs: {
        image: opts.image_name,
        upload: 'image',
      },
    },
  }
}

/** Poll ComfyUI history until a prompt completes or times out */
async function pollForCompletion(promptId: string, timeoutMs: number = 120_000): Promise<Record<string, unknown>> {
  const start = Date.now()
  while (Date.now() - start < timeoutMs) {
    await new Promise(resolve => setTimeout(resolve, 1000))
    try {
      const res = await fetch(`${COMFYUI_BASE}/history/${promptId}`, {
        signal: AbortSignal.timeout(5000),
      })
      if (!res.ok) continue
      const history = await res.json() as Record<string, unknown>
      const entry = history[promptId] as Record<string, unknown> | undefined
      if (entry) {
        return entry
      }
    } catch {
      // Connection error or timeout — keep polling
    }
  }
  throw new Error(`ComfyUI generation timed out after ${timeoutMs / 1000}s`)
}

/** Extract output filenames from a completed history entry */
function extractOutputFiles(historyEntry: Record<string, unknown>): string[] {
  const filenames: string[] = []
  try {
    const outputs = (historyEntry as Record<string, Record<string, Record<string, unknown[]>>>).outputs
    for (const nodeId of Object.keys(outputs || {})) {
      const nodeOutput = outputs[nodeId]
      if (nodeOutput?.images) {
        for (const img of nodeOutput.images as Array<{ filename?: string; subfolder?: string; type?: string }>) {
          if (img.filename) {
            const subfolder = img.subfolder || ''
            const type = img.type || 'output'
            filenames.push(`${img.filename} (subfolder: ${subfolder}, type: ${type})`)
          }
        }
      }
    }
  } catch {
    // Malformed output — return empty
  }
  return filenames
}

export function registerComfyUITools(): void {
  // 1. comfyui_status — Check if ComfyUI is running
  registerTool({
    name: 'comfyui_status',
    description: 'Check if a local ComfyUI instance is running and return system stats including GPU info and queue length. ComfyUI must be running at http://127.0.0.1:8188.',
    parameters: {},
    tier: 'free',
    async execute() {
      try {
        const res = await fetch(`${COMFYUI_BASE}/system_stats`, {
          signal: AbortSignal.timeout(5000),
        })
        if (!res.ok) {
          return `Error: ComfyUI responded with HTTP ${res.status}`
        }
        const stats = await res.json() as Record<string, unknown>

        const parts: string[] = ['**ComfyUI is running**\n']

        // System info
        const system = stats.system as Record<string, unknown> | undefined
        if (system) {
          parts.push(`**System**: OS=${system.os || 'unknown'}, Python=${system.python_version || 'unknown'}`)
          if (system.embedded_python !== undefined) parts.push(`Embedded Python: ${system.embedded_python}`)
        }

        // GPU/device info
        const devices = stats.devices as Array<Record<string, unknown>> | undefined
        if (devices && devices.length > 0) {
          parts.push('\n**Devices:**')
          for (const dev of devices) {
            const name = dev.name || 'unknown'
            const type = dev.type || 'unknown'
            const vramTotal = typeof dev.vram_total === 'number' ? `${(dev.vram_total / (1024 * 1024 * 1024)).toFixed(1)}GB` : 'unknown'
            const vramFree = typeof dev.vram_free === 'number' ? `${(dev.vram_free / (1024 * 1024 * 1024)).toFixed(1)}GB` : 'unknown'
            parts.push(`- ${name} (${type}): VRAM ${vramFree} free / ${vramTotal} total`)
          }
        }

        return parts.join('\n')
      } catch (err) {
        return `Error: ComfyUI is not reachable at ${COMFYUI_BASE}. Make sure ComfyUI is running locally.\n${err instanceof Error ? err.message : String(err)}`
      }
    },
  })

  // 2. comfyui_generate — Text-to-image generation
  registerTool({
    name: 'comfyui_generate',
    description: 'Generate an image from a text prompt using ComfyUI (txt2img). Builds and queues a Stable Diffusion workflow, polls until completion, and returns the output filename. ComfyUI must be running locally.',
    parameters: {
      prompt: { type: 'string', description: 'The text prompt describing the image to generate', required: true },
      negative_prompt: { type: 'string', description: 'Things to exclude from the image (default: empty)' },
      width: { type: 'number', description: 'Image width in pixels (default: 512)' },
      height: { type: 'number', description: 'Image height in pixels (default: 512)' },
      steps: { type: 'number', description: 'Number of sampling steps (default: 20)' },
      cfg_scale: { type: 'number', description: 'CFG scale / guidance strength (default: 7)' },
      seed: { type: 'number', description: 'Random seed for reproducibility (default: random)' },
      model: { type: 'string', description: 'Checkpoint model name (default: v1-5-pruned-emaonly.safetensors)' },
    },
    tier: 'free',
    timeout: 180_000, // 3 min for generation
    async execute(args) {
      const prompt = String(args.prompt || '')
      if (!prompt) return 'Error: prompt is required'

      const negative_prompt = String(args.negative_prompt || '')
      const width = typeof args.width === 'number' ? args.width : 512
      const height = typeof args.height === 'number' ? args.height : 512
      const steps = typeof args.steps === 'number' ? args.steps : 20
      const cfg_scale = typeof args.cfg_scale === 'number' ? args.cfg_scale : 7
      const seed = typeof args.seed === 'number' ? args.seed : Math.floor(Math.random() * 2147483647)
      const model = String(args.model || 'v1-5-pruned-emaonly.safetensors')

      const workflow = buildTxt2ImgWorkflow({ prompt, negative_prompt, width, height, steps, cfg_scale, seed, model })
      const clientId = crypto.randomUUID()

      // Queue the prompt
      let promptId: string
      try {
        const res = await fetch(`${COMFYUI_BASE}/prompt`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ prompt: workflow, client_id: clientId }),
          signal: AbortSignal.timeout(10000),
        })
        if (!res.ok) {
          const errorText = await res.text()
          return `Error: ComfyUI rejected the workflow (HTTP ${res.status}): ${errorText}`
        }
        const data = await res.json() as Record<string, unknown>
        promptId = String(data.prompt_id || '')
        if (!promptId) return 'Error: No prompt_id returned from ComfyUI'
      } catch (err) {
        return `Error: Could not connect to ComfyUI at ${COMFYUI_BASE}.\n${err instanceof Error ? err.message : String(err)}`
      }

      // Poll for completion
      try {
        const historyEntry = await pollForCompletion(promptId)
        const files = extractOutputFiles(historyEntry)

        if (files.length === 0) {
          return `Generation completed (prompt_id: ${promptId}) but no output images were found. Check ComfyUI logs for errors.`
        }

        const parts = [
          '**Image generated successfully**\n',
          `**Prompt ID**: ${promptId}`,
          `**Seed**: ${seed}`,
          `**Settings**: ${width}x${height}, ${steps} steps, CFG ${cfg_scale}`,
          `**Model**: ${model}`,
          `\n**Output files**:`,
          ...files.map(f => `- ${f}`),
          `\nView at: ${COMFYUI_BASE}/view?filename=<filename>&type=output`,
        ]
        return parts.join('\n')
      } catch (err) {
        return `Error during generation: ${err instanceof Error ? err.message : String(err)}\nPrompt ID: ${promptId}`
      }
    },
  })

  // 3. comfyui_img2img — Image-to-image generation
  registerTool({
    name: 'comfyui_img2img',
    description: 'Generate an image from an existing source image and text prompt using ComfyUI (img2img). Uploads the source image to ComfyUI, then runs a Stable Diffusion workflow. ComfyUI must be running locally.',
    parameters: {
      image_path: { type: 'string', description: 'Absolute path to the source image file', required: true },
      prompt: { type: 'string', description: 'The text prompt describing the desired output', required: true },
      negative_prompt: { type: 'string', description: 'Things to exclude from the image (default: empty)' },
      width: { type: 'number', description: 'Output image width in pixels (default: 512)' },
      height: { type: 'number', description: 'Output image height in pixels (default: 512)' },
      steps: { type: 'number', description: 'Number of sampling steps (default: 20)' },
      cfg_scale: { type: 'number', description: 'CFG scale / guidance strength (default: 7)' },
      denoise: { type: 'number', description: 'Denoise strength 0.0-1.0 — lower preserves more of original (default: 0.75)' },
      seed: { type: 'number', description: 'Random seed for reproducibility (default: random)' },
      model: { type: 'string', description: 'Checkpoint model name (default: v1-5-pruned-emaonly.safetensors)' },
    },
    tier: 'free',
    timeout: 180_000,
    async execute(args) {
      const imagePath = String(args.image_path || '')
      const prompt = String(args.prompt || '')
      if (!imagePath) return 'Error: image_path is required'
      if (!prompt) return 'Error: prompt is required'

      const negative_prompt = String(args.negative_prompt || '')
      const width = typeof args.width === 'number' ? args.width : 512
      const height = typeof args.height === 'number' ? args.height : 512
      const steps = typeof args.steps === 'number' ? args.steps : 20
      const cfg_scale = typeof args.cfg_scale === 'number' ? args.cfg_scale : 7
      const denoise = typeof args.denoise === 'number' ? args.denoise : 0.75
      const seed = typeof args.seed === 'number' ? args.seed : Math.floor(Math.random() * 2147483647)
      const model = String(args.model || 'v1-5-pruned-emaonly.safetensors')

      // Read and upload the source image
      let imageData: Buffer
      try {
        imageData = readFileSync(imagePath) as Buffer
      } catch (err) {
        return `Error: Could not read image file: ${imagePath}\n${err instanceof Error ? err.message : String(err)}`
      }

      const filename = basename(imagePath)

      // Determine MIME type from extension
      const ext = filename.split('.').pop()?.toLowerCase() || 'png'
      const mimeMap: Record<string, string> = { png: 'image/png', jpg: 'image/jpeg', jpeg: 'image/jpeg', webp: 'image/webp', bmp: 'image/bmp', gif: 'image/gif' }
      const mimeType = mimeMap[ext] || 'image/png'

      // Build multipart form body manually (no FormData dependency issues)
      const boundary = `----KBotBoundary${Date.now()}`
      const header = [
        `--${boundary}`,
        `Content-Disposition: form-data; name="image"; filename="${filename}"`,
        `Content-Type: ${mimeType}`,
        '',
        '',
      ].join('\r\n')
      const footer = `\r\n--${boundary}--\r\n`

      const headerBuf = Buffer.from(header, 'utf-8')
      const footerBuf = Buffer.from(footer, 'utf-8')
      const body = Buffer.concat([headerBuf, imageData, footerBuf])

      let uploadedName: string
      try {
        const res = await fetch(`${COMFYUI_BASE}/upload/image`, {
          method: 'POST',
          headers: {
            'Content-Type': `multipart/form-data; boundary=${boundary}`,
          },
          body,
          signal: AbortSignal.timeout(30000),
        })
        if (!res.ok) {
          const errorText = await res.text()
          return `Error: Failed to upload image to ComfyUI (HTTP ${res.status}): ${errorText}`
        }
        const data = await res.json() as Record<string, unknown>
        uploadedName = String(data.name || filename)
      } catch (err) {
        return `Error: Could not connect to ComfyUI for image upload.\n${err instanceof Error ? err.message : String(err)}`
      }

      // Build and queue the img2img workflow
      const workflow = buildImg2ImgWorkflow({
        prompt, negative_prompt, width, height, steps, cfg_scale, seed, model,
        image_name: uploadedName,
        denoise,
      })
      const clientId = crypto.randomUUID()

      let promptId: string
      try {
        const res = await fetch(`${COMFYUI_BASE}/prompt`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ prompt: workflow, client_id: clientId }),
          signal: AbortSignal.timeout(10000),
        })
        if (!res.ok) {
          const errorText = await res.text()
          return `Error: ComfyUI rejected the img2img workflow (HTTP ${res.status}): ${errorText}`
        }
        const data = await res.json() as Record<string, unknown>
        promptId = String(data.prompt_id || '')
        if (!promptId) return 'Error: No prompt_id returned from ComfyUI'
      } catch (err) {
        return `Error: Could not connect to ComfyUI at ${COMFYUI_BASE}.\n${err instanceof Error ? err.message : String(err)}`
      }

      // Poll for completion
      try {
        const historyEntry = await pollForCompletion(promptId)
        const files = extractOutputFiles(historyEntry)

        if (files.length === 0) {
          return `Generation completed (prompt_id: ${promptId}) but no output images were found. Check ComfyUI logs.`
        }

        const parts = [
          '**Img2Img generated successfully**\n',
          `**Prompt ID**: ${promptId}`,
          `**Source**: ${filename} (uploaded as ${uploadedName})`,
          `**Seed**: ${seed}`,
          `**Settings**: ${width}x${height}, ${steps} steps, CFG ${cfg_scale}, denoise ${denoise}`,
          `**Model**: ${model}`,
          `\n**Output files**:`,
          ...files.map(f => `- ${f}`),
          `\nView at: ${COMFYUI_BASE}/view?filename=<filename>&type=output`,
        ]
        return parts.join('\n')
      } catch (err) {
        return `Error during img2img generation: ${err instanceof Error ? err.message : String(err)}\nPrompt ID: ${promptId}`
      }
    },
  })

  // 4. comfyui_list_models — List available checkpoint models
  registerTool({
    name: 'comfyui_list_models',
    description: 'List all available Stable Diffusion checkpoint models installed in ComfyUI. Useful for choosing which model to use with comfyui_generate.',
    parameters: {},
    tier: 'free',
    async execute() {
      try {
        const res = await fetch(`${COMFYUI_BASE}/object_info/CheckpointLoaderSimple`, {
          signal: AbortSignal.timeout(10000),
        })
        if (!res.ok) {
          return `Error: ComfyUI responded with HTTP ${res.status}`
        }
        const data = await res.json() as Record<string, unknown>

        // Navigate: CheckpointLoaderSimple → input → required → ckpt_name → [0] (list of model names)
        const node = data.CheckpointLoaderSimple as Record<string, unknown> | undefined
        const input = node?.input as Record<string, unknown> | undefined
        const required = input?.required as Record<string, unknown> | undefined
        const ckptNameDef = required?.ckpt_name as unknown[] | undefined
        const modelList = ckptNameDef?.[0] as string[] | undefined

        if (!modelList || modelList.length === 0) {
          return 'No checkpoint models found. Make sure models are placed in ComfyUI\'s models/checkpoints/ directory.'
        }

        const parts = [`**Available Checkpoint Models** (${modelList.length}):\n`]
        for (const m of modelList) {
          parts.push(`- ${m}`)
        }
        return parts.join('\n')
      } catch (err) {
        return `Error: Could not connect to ComfyUI at ${COMFYUI_BASE}.\n${err instanceof Error ? err.message : String(err)}`
      }
    },
  })

  // 5. comfyui_queue — Show current queue status
  registerTool({
    name: 'comfyui_queue',
    description: 'Show the current ComfyUI queue status — how many prompts are running and how many are pending.',
    parameters: {},
    tier: 'free',
    async execute() {
      try {
        const res = await fetch(`${COMFYUI_BASE}/queue`, {
          signal: AbortSignal.timeout(5000),
        })
        if (!res.ok) {
          return `Error: ComfyUI responded with HTTP ${res.status}`
        }
        const data = await res.json() as Record<string, unknown>

        const running = data.queue_running as unknown[] | undefined
        const pending = data.queue_pending as unknown[] | undefined

        const runningCount = running?.length ?? 0
        const pendingCount = pending?.length ?? 0

        const parts = [
          '**ComfyUI Queue Status**\n',
          `**Running**: ${runningCount} prompt${runningCount !== 1 ? 's' : ''}`,
          `**Pending**: ${pendingCount} prompt${pendingCount !== 1 ? 's' : ''}`,
        ]

        if (runningCount === 0 && pendingCount === 0) {
          parts.push('\nQueue is empty — ready for new generations.')
        }

        // Show details for running prompts
        if (running && running.length > 0) {
          parts.push('\n**Currently running:**')
          for (const item of running) {
            if (Array.isArray(item) && item.length >= 2) {
              parts.push(`- Prompt ID: ${item[1]}`)
            }
          }
        }

        // Show details for pending prompts
        if (pending && pending.length > 0) {
          parts.push('\n**Pending:**')
          for (const item of pending.slice(0, 10)) {
            if (Array.isArray(item) && item.length >= 2) {
              parts.push(`- Prompt ID: ${item[1]}`)
            }
          }
          if (pending.length > 10) {
            parts.push(`- ... and ${pending.length - 10} more`)
          }
        }

        return parts.join('\n')
      } catch (err) {
        return `Error: Could not connect to ComfyUI at ${COMFYUI_BASE}.\n${err instanceof Error ? err.message : String(err)}`
      }
    },
  })
}
