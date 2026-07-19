// Curated fal.ai video model registry for the Creative Canvas video node.
// Prices are USD per output second as listed on fal.ai model pages —
// re-verify against https://fal.ai/models when adding or bumping a model.

export const MODELS = [
  {
    id: 'veo-3-fast',
    label: 'Veo 3.1 Fast',
    textEndpoint: 'fal-ai/veo3/fast',
    imageEndpoint: 'fal-ai/veo3/fast/image-to-video',
    usdPerSecond: 0.4, // audio-on rate; fal generates audio by default ($0.25/s audio off)
    defaultDurationSeconds: 8,
    maxDurationSeconds: 8,
    durationParam: null, // fixed-length model; fal ignores duration
  },
  {
    id: 'kling-pro',
    label: 'Kling (Pro)',
    textEndpoint: 'fal-ai/kling-video/v2.5-turbo/pro/text-to-video',
    imageEndpoint: 'fal-ai/kling-video/v2.5-turbo/pro/image-to-video',
    usdPerSecond: 0.07,
    defaultDurationSeconds: 5,
    maxDurationSeconds: 10,
    durationParam: 'duration',
  },
  {
    id: 'seedance-lite',
    label: 'Seedance (Lite)',
    textEndpoint: 'fal-ai/bytedance/seedance/v1/lite/text-to-video',
    imageEndpoint: 'fal-ai/bytedance/seedance/v1/lite/image-to-video',
    usdPerSecond: 0.04,
    defaultDurationSeconds: 5,
    maxDurationSeconds: 10,
    durationParam: 'duration',
  },
  {
    id: 'luma-ray',
    label: 'Luma Ray',
    textEndpoint: 'fal-ai/luma-dream-machine/ray-2',
    imageEndpoint: null,
    usdPerSecond: 0.1,
    defaultDurationSeconds: 5,
    maxDurationSeconds: 9,
    durationParam: 'duration',
  },
]

export function getModel(id) {
  return MODELS.find(m => m.id === id) ?? null
}

// Seconds fal will actually bill: fixed-length models (durationParam null)
// always render their full defaultDurationSeconds no matter what is requested.
export function effectiveSeconds(modelId, durationSeconds) {
  const model = getModel(modelId)
  if (!model) return null
  if (!model.durationParam) return model.defaultDurationSeconds
  const requested = Number(durationSeconds)
  const seconds = Number.isFinite(requested) && requested > 0 ? requested : model.defaultDurationSeconds
  return Math.min(seconds, model.maxDurationSeconds)
}

export function estimateUsd(modelId, durationSeconds) {
  const model = getModel(modelId)
  if (!model) return null
  return Math.round(model.usdPerSecond * effectiveSeconds(modelId, durationSeconds) * 100) / 100
}

export function pickEndpoint(modelId, hasImage) {
  const model = getModel(modelId)
  if (!model) return null
  return hasImage && model.imageEndpoint ? model.imageEndpoint : model.textEndpoint
}

export function buildInput(modelId, prompt, durationSeconds, imageUrl) {
  const model = getModel(modelId)
  if (!model) return null
  const input = { prompt }
  if (model.durationParam) {
    const seconds = effectiveSeconds(modelId, durationSeconds)
    input[model.durationParam] = String(seconds)
  }
  if (imageUrl && model.imageEndpoint) input.image_url = imageUrl
  return input
}

// Parse fal's human-written pricing copy into a USD-per-second rate.
// Conservative by design: with several listed rates (resolution tiers) it
// returns the highest, and returns null rather than guess — the confirm
// dialog then shows fal's own pricing text instead of a fabricated number.
export function parsePricingText(text) {
  if (!text || typeof text !== 'string') return null
  const plain = text.replace(/\*\*/g, '')
  const perSecond = [...plain.matchAll(/\$(\d+(?:\.\d+)?)\s*(?:\/|\s*per\s+)\s*(?:output\s+)?second/gi)]
    .map(m => Number(m[1]))
  if (perSecond.length) return Math.max(...perSecond)
  const perVideo = plain.match(/for\s+(?:a\s+)?(\d+)\s*s(?:econd)?s?\s+video[^$]*\$(\d+(?:\.\d+)?)/i)
  if (perVideo) {
    const seconds = Number(perVideo[1])
    const usd = Number(perVideo[2])
    if (seconds > 0) return Math.round((usd / seconds) * 10000) / 10000
  }
  return null
}

export function mapCatalogItem(item) {
  const pricingText = (item.pricingInfoOverride || '').replace(/\*\*/g, '').trim()
  return {
    endpointId: item.id,
    title: item.title,
    category: item.category,
    thumbnailUrl: item.thumbnailUrl || '',
    pricingText,
    usdPerSecond: parsePricingText(item.pricingInfoOverride),
    usdPerImage: parsePerImageUsd(item.pricingInfoOverride),
  }
}

export function extractVideoUrl(payload) {
  if (!payload || typeof payload !== 'object') return null
  return payload.video?.url ?? payload.data?.video?.url ?? payload.videos?.[0]?.url ?? null
}

export function extractImageUrl(payload) {
  if (!payload || typeof payload !== 'object') return null
  return payload.images?.[0]?.url ?? payload.data?.images?.[0]?.url ?? payload.image?.url ?? null
}

// Per-image price ("$0.15 per image") for still-image catalog entries —
// separate from the per-second video rate so neither shape mislabels the other.
export function parsePerImageUsd(text) {
  if (!text || typeof text !== 'string') return null
  const match = text.replace(/\*\*/g, '').match(/\$(\d+(?:\.\d+)?)\s*(?:\/|\s*per\s+)\s*image/i)
  return match ? Number(match[1]) : null
}

// Voiceover providers served through fal. Prices are USD per 1000 characters
// as listed on each model page (re-verify when bumping). Each provider builds
// its own input shape; voice is the caller-facing selector.
export const TTS_PROVIDERS = {
  'elevenlabs-turbo': {
    endpoint: 'fal-ai/elevenlabs/tts/turbo-v2.5',
    usdPer1kChars: 0.05,
    buildInput: (text, voice) => ({ text, ...(voice ? { voice } : {}) }),
  },
  'minimax-hd': {
    endpoint: 'fal-ai/minimax/speech-2.8-hd',
    usdPer1kChars: 0.1,
    buildInput: (text, voice) => ({ prompt: text, ...(voice ? { voice_setting: { voice_id: voice } } : {}) }),
  },
  // Directable: voice preset + natural-language delivery instruction,
  // passed as "voice|instruction" in the caller-facing voice field.
  'seed-speech': {
    endpoint: 'fal-ai/bytedance/seed-speech/tts/v2',
    usdPer1kChars: 0.03,
    buildInput: (text, voice) => {
      const [preset, ...direction] = (voice ?? '').split('|')
      return {
        text,
        ...(preset ? { voice: preset } : {}),
        ...(direction.length ? { voice_instruction: direction.join('|') } : {}),
      }
    },
  },
  // ElevenLabs premium tier, called directly (not via fal). Costs no fal
  // dollars — it consumes the user's ElevenLabs subscription credits —
  // so usdPer1kChars is 0 and the server routes it around the fal queue.
  'elevenlabs-v2': {
    direct: 'elevenlabs',
    modelId: 'eleven_multilingual_v2',
    usdPer1kChars: 0,
    buildInput: (text, voice) => ({ text, voice }),
  },
  'gemini-tts': {
    endpoint: 'fal-ai/gemini-3.1-flash-tts',
    usdPer1kChars: 0.15,
    buildInput: (text, voice) => {
      const [preset, ...direction] = (voice ?? '').split('|')
      return {
        prompt: text,
        ...(preset ? { voice: preset } : {}),
        ...(direction.length ? { style_instructions: direction.join('|') } : {}),
      }
    },
  },
}
export const DEFAULT_TTS_PROVIDER = 'elevenlabs-turbo'

// Back-compat aliases (older callers/tests)
export const TTS_ENDPOINT = TTS_PROVIDERS[DEFAULT_TTS_PROVIDER].endpoint
export const TTS_USD_PER_1K_CHARS = TTS_PROVIDERS[DEFAULT_TTS_PROVIDER].usdPer1kChars

export function getTtsProvider(name) {
  return TTS_PROVIDERS[name ?? DEFAULT_TTS_PROVIDER] ?? null
}

export function estimateSpeechUsd(text, provider = DEFAULT_TTS_PROVIDER) {
  if (typeof text !== 'string' || text.length === 0) return null
  const spec = getTtsProvider(provider)
  if (!spec) return null
  return Math.round((text.length / 1000) * spec.usdPer1kChars * 10000) / 10000
}

// Sound-design providers served through fal. SFX bills per generation;
// music bills per started output minute (fal rounds up) — the estimate
// mirrors that so quotes never undershoot the invoice.
export const SFX_PROVIDERS = {
  'elevenlabs-sfx': {
    endpoint: 'fal-ai/elevenlabs/sound-effects/v2',
    usdPerGeneration: 0.1,
    maxDurationSeconds: 22,
    buildInput: (text, seconds) => ({
      text,
      ...(seconds ? { duration_seconds: Math.min(Number(seconds), 22) } : {}),
    }),
  },
  'elevenlabs-music': {
    endpoint: 'fal-ai/elevenlabs/music',
    usdPerMinute: 0.8,
    maxDurationSeconds: 300,
    buildInput: (text, seconds) => ({
      prompt: text,
      ...(seconds ? { music_length_ms: Math.min(Number(seconds), 300) * 1000 } : {}),
    }),
  },
}

// Direct-API variants: consume the user's ElevenLabs subscription credits
// (zero fal spend), mirroring the elevenlabs-v2 TTS pattern. The server
// routes these around the fal queue to api.elevenlabs.io.
SFX_PROVIDERS['elevenlabs-sfx-direct'] = {
  direct: 'elevenlabs',
  path: '/v1/sound-generation',
  usdPerGeneration: 0,
  maxDurationSeconds: 22,
  buildInput: (text, seconds) => ({
    text,
    ...(seconds ? { duration_seconds: Math.min(Number(seconds), 22) } : {}),
  }),
}
SFX_PROVIDERS['elevenlabs-music-direct'] = {
  direct: 'elevenlabs',
  path: '/v1/music',
  usdPerGeneration: 0,
  maxDurationSeconds: 300,
  buildInput: (text, seconds) => ({
    prompt: text,
    ...(seconds ? { music_length_ms: Math.min(Number(seconds), 300) * 1000 } : {}),
  }),
}

export function getSfxProvider(name) {
  return SFX_PROVIDERS[name ?? 'elevenlabs-sfx'] ?? null
}

export function estimateSfxUsd(seconds, provider = 'elevenlabs-sfx') {
  const spec = SFX_PROVIDERS[provider] ?? null
  if (!spec) return null
  if (spec.usdPerMinute != null) {
    const s = Number(seconds)
    if (!Number.isFinite(s) || s <= 0) return null
    return Math.round(Math.ceil(s / 60) * spec.usdPerMinute * 100) / 100
  }
  return spec.usdPerGeneration
}

export function extractAudioUrl(payload) {
  if (!payload || typeof payload !== 'object') return null
  return payload.audio?.url ?? payload.data?.audio?.url ?? null
}
