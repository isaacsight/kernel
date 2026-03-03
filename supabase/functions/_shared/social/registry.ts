// ─── Platform Adapter Registry ──────────────────────────────────
// Central registry for all social media platform adapters.

import type { PlatformAdapter } from './types.ts'
import { TwitterAdapter } from './twitter.ts'
import { LinkedInAdapter } from './linkedin.ts'

const adapters: Record<string, PlatformAdapter> = {
  twitter: new TwitterAdapter(),
  linkedin: new LinkedInAdapter(),
}

export function getAdapter(platform: string): PlatformAdapter {
  const adapter = adapters[platform]
  if (!adapter) {
    throw new Error(`Unsupported platform: ${platform}. Available: ${Object.keys(adapters).join(', ')}`)
  }
  return adapter
}

export function getSupportedPlatforms(): string[] {
  return Object.keys(adapters)
}
