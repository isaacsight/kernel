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
  return Math.min(Number(durationSeconds) || model.defaultDurationSeconds, model.maxDurationSeconds)
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
    const seconds = Math.min(Number(durationSeconds) || model.defaultDurationSeconds, model.maxDurationSeconds)
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

// Voiceover: ElevenLabs Turbo v2.5 served through fal — $0.05 per 1000
// characters as listed on the model page (re-verify when bumping).
export const TTS_ENDPOINT = 'fal-ai/elevenlabs/tts/turbo-v2.5'
export const TTS_USD_PER_1K_CHARS = 0.05

export function estimateSpeechUsd(text) {
  if (typeof text !== 'string' || text.length === 0) return null
  return Math.round((text.length / 1000) * TTS_USD_PER_1K_CHARS * 10000) / 10000
}

export function extractAudioUrl(payload) {
  if (!payload || typeof payload !== 'object') return null
  return payload.audio?.url ?? payload.data?.audio?.url ?? null
}
