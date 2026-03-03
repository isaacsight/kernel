// ─── LinkedIn Platform Adapter ──────────────────────────────────
// OAuth 2.0 Authorization Code, Marketing API, 3000 char limit.

import type { PlatformAdapter, TokenResponse, PlatformProfile, PublishResult, PostAnalytics } from './types.ts'

const LINKEDIN_AUTH_URL = 'https://www.linkedin.com/oauth/v2/authorization'
const LINKEDIN_TOKEN_URL = 'https://www.linkedin.com/oauth/v2/accessToken'
const LINKEDIN_API = 'https://api.linkedin.com/v2'

export class LinkedInAdapter implements PlatformAdapter {
  platform = 'linkedin'
  charLimit = 3000
  supportsThreads = false

  private clientId: string
  private clientSecret: string
  private redirectUri: string

  constructor() {
    this.clientId = Deno.env.get('LINKEDIN_CLIENT_ID') || ''
    this.clientSecret = Deno.env.get('LINKEDIN_CLIENT_SECRET') || ''
    this.redirectUri = Deno.env.get('LINKEDIN_REDIRECT_URI') || 'https://kernel.chat/#/social/callback/linkedin'
  }

  buildAuthUrl(state: string): string {
    const params = new URLSearchParams({
      response_type: 'code',
      client_id: this.clientId,
      redirect_uri: this.redirectUri,
      scope: 'w_member_social r_basicprofile openid',
      state,
    })
    return `${LINKEDIN_AUTH_URL}?${params.toString()}`
  }

  async exchangeCode(code: string): Promise<TokenResponse> {
    const body = new URLSearchParams({
      grant_type: 'authorization_code',
      code,
      redirect_uri: this.redirectUri,
      client_id: this.clientId,
      client_secret: this.clientSecret,
    })

    const res = await fetch(LINKEDIN_TOKEN_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: body.toString(),
    })

    if (!res.ok) {
      const err = await res.text()
      throw new Error(`LinkedIn token exchange failed: ${err}`)
    }

    return await res.json()
  }

  async refreshToken(refreshToken: string): Promise<TokenResponse> {
    const body = new URLSearchParams({
      grant_type: 'refresh_token',
      refresh_token: refreshToken,
      client_id: this.clientId,
      client_secret: this.clientSecret,
    })

    const res = await fetch(LINKEDIN_TOKEN_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: body.toString(),
    })

    if (!res.ok) {
      const err = await res.text()
      throw new Error(`LinkedIn token refresh failed: ${err}`)
    }

    return await res.json()
  }

  async getUserProfile(accessToken: string): Promise<PlatformProfile> {
    const res = await fetch(`${LINKEDIN_API}/userinfo`, {
      headers: { 'Authorization': `Bearer ${accessToken}` },
    })

    if (!res.ok) throw new Error(`LinkedIn profile fetch failed: ${res.status}`)

    const data = await res.json()
    return {
      id: data.sub,
      username: data.email || data.sub,
      displayName: data.name || `${data.given_name || ''} ${data.family_name || ''}`.trim(),
      avatarUrl: data.picture,
    }
  }

  async publishPost(accessToken: string, body: string): Promise<PublishResult> {
    // Get user URN first
    const profile = await this.getUserProfile(accessToken)
    const authorUrn = `urn:li:person:${profile.id}`

    const payload = {
      author: authorUrn,
      lifecycleState: 'PUBLISHED',
      specificContent: {
        'com.linkedin.ugc.ShareContent': {
          shareCommentary: { text: body },
          shareMediaCategory: 'NONE',
        },
      },
      visibility: {
        'com.linkedin.ugc.MemberNetworkVisibility': 'PUBLIC',
      },
    }

    const res = await fetch(`${LINKEDIN_API}/ugcPosts`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
        'X-Restli-Protocol-Version': '2.0.0',
      },
      body: JSON.stringify(payload),
    })

    if (!res.ok) {
      const err = await res.text()
      throw new Error(`LinkedIn publish failed: ${err}`)
    }

    const postId = res.headers.get('x-restli-id') || ''
    return {
      platformPostId: postId,
      platformUrl: `https://www.linkedin.com/feed/update/${postId}`,
    }
  }

  async getPostAnalytics(accessToken: string, platformPostId: string): Promise<PostAnalytics> {
    // LinkedIn analytics are limited — basic engagement stats
    const res = await fetch(
      `${LINKEDIN_API}/socialActions/${encodeURIComponent(platformPostId)}`,
      { headers: { 'Authorization': `Bearer ${accessToken}` } },
    )

    if (!res.ok) {
      return { impressions: 0, likes: 0, reposts: 0, replies: 0, clicks: 0, saves: 0, reach: 0, engagementRate: 0 }
    }

    const data = await res.json()
    return {
      impressions: 0, // LinkedIn doesn't provide this via basic API
      likes: data.likesSummary?.totalLikes || 0,
      reposts: data.sharesSummary?.totalShares || 0,
      replies: data.commentsSummary?.totalFirstLevelComments || 0,
      clicks: 0,
      saves: 0,
      reach: 0,
      engagementRate: 0,
    }
  }
}
