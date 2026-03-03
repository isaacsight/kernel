// ─── Social Media Adapter Types ─────────────────────────────────
// Shared types for platform adapters, OAuth, and publishing.

export interface TokenResponse {
  access_token: string
  refresh_token?: string
  expires_in?: number
  scope?: string
  token_type: string
}

export interface PlatformProfile {
  id: string
  username: string
  displayName: string
  avatarUrl?: string
}

export interface PublishResult {
  platformPostId: string
  platformUrl: string
}

export interface PostAnalytics {
  impressions: number
  likes: number
  reposts: number
  replies: number
  clicks: number
  saves: number
  reach: number
  engagementRate: number
}

export interface AdaptedPost {
  body: string
  hashtags: string[]
  threadParts?: string[]
  mediaUrls?: string[]
}

export interface PlatformAdapter {
  platform: string
  charLimit: number
  supportsThreads: boolean

  // OAuth
  buildAuthUrl(state: string, codeChallenge?: string): string
  exchangeCode(code: string, codeVerifier?: string): Promise<TokenResponse>
  refreshToken(refreshToken: string): Promise<TokenResponse>
  getUserProfile(accessToken: string): Promise<PlatformProfile>

  // Publishing
  publishPost(accessToken: string, body: string, mediaUrls?: string[]): Promise<PublishResult>
  publishThread?(accessToken: string, parts: string[]): Promise<PublishResult>

  // Analytics
  getPostAnalytics(accessToken: string, platformPostId: string): Promise<PostAnalytics>
}
