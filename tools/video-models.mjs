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

export function extractVideoUrl(payload) {
  if (!payload || typeof payload !== 'object') return null
  return payload.video?.url ?? payload.data?.video?.url ?? payload.videos?.[0]?.url ?? null
}
