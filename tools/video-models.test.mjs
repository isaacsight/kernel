import { describe, it, expect } from 'vitest'
import { MODELS, getModel, estimateUsd, effectiveSeconds, buildInput, pickEndpoint, extractVideoUrl, extractImageUrl, parsePricingText, parsePerImageUsd, mapCatalogItem, estimateSpeechUsd, extractAudioUrl, TTS_ENDPOINT } from './video-models.mjs'

describe('video model registry', () => {
  it('every model has the required fields', () => {
    expect(MODELS.length).toBeGreaterThanOrEqual(3)
    for (const m of MODELS) {
      expect(typeof m.id).toBe('string')
      expect(typeof m.label).toBe('string')
      expect(typeof m.textEndpoint).toBe('string')
      expect(m.textEndpoint.startsWith('fal-ai/')).toBe(true)
      expect(typeof m.usdPerSecond).toBe('number')
      expect(m.maxDurationSeconds).toBeGreaterThanOrEqual(m.defaultDurationSeconds)
    }
  })
  it('getModel returns null for unknown ids', () => {
    expect(getModel('nope')).toBeNull()
  })
})

describe('estimateUsd', () => {
  it('multiplies per-second price by duration, rounded to cents', () => {
    const m = MODELS.find(x => x.durationParam)
    expect(estimateUsd(m.id, 5)).toBeCloseTo(Math.round(m.usdPerSecond * 5 * 100) / 100, 2)
  })
  it('returns null for unknown model (never fabricates a price)', () => {
    expect(estimateUsd('nope', 5)).toBeNull()
  })
  it('clamps duration to the model max', () => {
    const m = MODELS.find(x => x.durationParam)
    expect(estimateUsd(m.id, 9999)).toBeCloseTo(Math.round(m.usdPerSecond * m.maxDurationSeconds * 100) / 100, 2)
  })
  it('prices the full fixed length for fixed-duration models (fal ignores requested duration)', () => {
    const m = MODELS.find(x => !x.durationParam)
    expect(estimateUsd(m.id, 5)).toBeCloseTo(Math.round(m.usdPerSecond * m.defaultDurationSeconds * 100) / 100, 2)
  })
})

describe('effectiveSeconds', () => {
  it('returns the clamped requested duration for variable-length models', () => {
    const m = MODELS.find(x => x.durationParam)
    expect(effectiveSeconds(m.id, 5)).toBe(5)
    expect(effectiveSeconds(m.id, 9999)).toBe(m.maxDurationSeconds)
  })
  it('returns the fixed length for fixed-duration models regardless of request', () => {
    const m = MODELS.find(x => !x.durationParam)
    expect(effectiveSeconds(m.id, 5)).toBe(m.defaultDurationSeconds)
  })
  it('returns null for unknown models', () => {
    expect(effectiveSeconds('nope', 5)).toBeNull()
  })
  it('never returns zero or negative billable time', () => {
    const m = MODELS.find(x => x.durationParam)
    expect(effectiveSeconds(m.id, -5)).toBe(m.defaultDurationSeconds)
    expect(effectiveSeconds(m.id, 0)).toBe(m.defaultDurationSeconds)
  })
})

describe('buildInput / pickEndpoint', () => {
  it('text-to-video input carries prompt and duration', () => {
    const m = MODELS[0]
    const input = buildInput(m.id, 'a city after midnight', 5)
    expect(input.prompt).toBe('a city after midnight')
    expect(input).not.toHaveProperty('image_url')
  })
  it('image input adds image_url and switches endpoint when supported', () => {
    const m = MODELS.find(x => x.imageEndpoint)
    const input = buildInput(m.id, 'p', 5, 'data:image/png;base64,AAAA')
    expect(input.image_url).toBe('data:image/png;base64,AAAA')
    expect(pickEndpoint(m.id, true)).toBe(m.imageEndpoint)
    expect(pickEndpoint(m.id, false)).toBe(m.textEndpoint)
  })
})

describe('parsePricingText', () => {
  it('parses a plain per-second rate', () => {
    expect(parsePricingText('Your request will cost $0.25 per second.')).toBe(0.25)
  })
  it('takes the highest rate when several resolutions are listed (never understates)', () => {
    const text = 'For every second of 720p video you will be charged **$0.3034/second** and for 1080p you will be charged **$0.682/second**.'
    expect(parsePricingText(text)).toBe(0.682)
  })
  it('derives a per-second rate from a fixed-length video price', () => {
    expect(parsePricingText('For 5s video your request will cost $0.35.')).toBe(0.07)
  })
  it('returns null when no confident rate is present', () => {
    expect(parsePricingText('Pricing depends on machine time.')).toBeNull()
    expect(parsePricingText('')).toBeNull()
    expect(parsePricingText(undefined)).toBeNull()
  })
})

describe('mapCatalogItem', () => {
  it('maps fal catalog items to the canvas shape with parsed pricing', () => {
    const mapped = mapCatalogItem({
      id: 'bytedance/seedance-2.0/text-to-video',
      title: 'Seedance 2.0 Text to Video API',
      category: 'text-to-video',
      thumbnailUrl: 'https://x/t.jpg',
      pricingInfoOverride: 'You will be charged **$0.30/second**.',
    })
    expect(mapped.endpointId).toBe('bytedance/seedance-2.0/text-to-video')
    expect(mapped.title).toBe('Seedance 2.0 Text to Video API')
    expect(mapped.usdPerSecond).toBe(0.3)
    expect(mapped.pricingText).toBe('You will be charged $0.30/second.')
  })
  it('leaves usdPerSecond null when pricing is unparseable', () => {
    const mapped = mapCatalogItem({ id: 'a/b', title: 'B', category: 'text-to-video', thumbnailUrl: '', pricingInfoOverride: 'Contact us.' })
    expect(mapped.usdPerSecond).toBeNull()
    expect(mapped.pricingText).toBe('Contact us.')
  })
})

describe('extractVideoUrl', () => {
  it('finds the url in the common fal result shapes', () => {
    expect(extractVideoUrl({ video: { url: 'https://x/v.mp4' } })).toBe('https://x/v.mp4')
    expect(extractVideoUrl({ data: { video: { url: 'https://y/v.mp4' } } })).toBe('https://y/v.mp4')
    expect(extractVideoUrl({ videos: [{ url: 'https://z/v.mp4' }] })).toBe('https://z/v.mp4')
    expect(extractVideoUrl({})).toBeNull()
  })
})

describe('extractImageUrl', () => {
  it('finds the url in fal image result shapes', () => {
    expect(extractImageUrl({ images: [{ url: 'https://x/i.png' }] })).toBe('https://x/i.png')
    expect(extractImageUrl({ data: { images: [{ url: 'https://y/i.png' }] } })).toBe('https://y/i.png')
    expect(extractImageUrl({ image: { url: 'https://z/i.png' } })).toBe('https://z/i.png')
    expect(extractImageUrl({})).toBeNull()
  })
})

describe('parsePricingText per-image rates', () => {
  it('parses a per-image price into usdPerUnit', () => {
    expect(parsePricingText('Your request will cost $0.15 per image.')).toBeNull()
    expect(parsePerImageUsd('Your request will cost $0.15 per image.')).toBe(0.15)
    expect(parsePerImageUsd('$0.039 per image for 1MP')).toBe(0.039)
    expect(parsePerImageUsd('machine time only')).toBeNull()
  })
})

describe('speech (ElevenLabs via fal)', () => {
  it('exposes the verified TTS endpoint slug', () => {
    expect(TTS_ENDPOINT).toBe('fal-ai/elevenlabs/tts/turbo-v2.5')
  })
  it('prices speech at the listed rate per 1000 characters', () => {
    expect(estimateSpeechUsd('a'.repeat(1000))).toBe(0.05)
    expect(estimateSpeechUsd('a'.repeat(950))).toBeCloseTo(0.0475, 4)
  })
  it('returns null for empty or non-string text (never fabricates a price)', () => {
    expect(estimateSpeechUsd('')).toBeNull()
    expect(estimateSpeechUsd(undefined)).toBeNull()
  })
  it('prices per provider and rejects unknown providers', () => {
    expect(estimateSpeechUsd('a'.repeat(1000), 'minimax-hd')).toBe(0.1)
    expect(estimateSpeechUsd('a'.repeat(1000), 'nope')).toBeNull()
  })
  it('finds the audio url in fal result shapes', () => {
    expect(extractAudioUrl({ audio: { url: 'https://x/a.mp3' } })).toBe('https://x/a.mp3')
    expect(extractAudioUrl({ data: { audio: { url: 'https://y/a.mp3' } } })).toBe('https://y/a.mp3')
    expect(extractAudioUrl({})).toBeNull()
  })
})
