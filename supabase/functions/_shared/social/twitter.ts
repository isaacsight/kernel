// ─── Twitter/X Platform Adapter ─────────────────────────────────
// OAuth 2.0 PKCE, API v2, 280 char limit, thread support.

import type { PlatformAdapter, TokenResponse, PlatformProfile, PublishResult, PostAnalytics } from './types.ts'

const TWITTER_AUTH_URL = 'https://twitter.com/i/oauth2/authorize'
const TWITTER_TOKEN_URL = 'https://api.twitter.com/2/oauth2/token'
const TWITTER_API = 'https://api.twitter.com/2'

export class TwitterAdapter implements PlatformAdapter {
  platform = 'twitter'
  charLimit = 280
  supportsThreads = true

  private clientId: string
  private clientSecret: string
  private redirectUri: string

  constructor() {
    this.clientId = Deno.env.get('TWITTER_CLIENT_ID') || ''
    this.clientSecret = Deno.env.get('TWITTER_CLIENT_SECRET') || ''
    this.redirectUri = Deno.env.get('TWITTER_REDIRECT_URI') || 'https://kernel.chat/#/social/callback/twitter'
  }

  buildAuthUrl(state: string, codeChallenge?: string): string {
    const params = new URLSearchParams({
      response_type: 'code',
      client_id: this.clientId,
      redirect_uri: this.redirectUri,
      scope: 'tweet.read tweet.write users.read offline.access',
      state,
      code_challenge_method: 'S256',
      code_challenge: codeChallenge || '',
    })
    return `${TWITTER_AUTH_URL}?${params.toString()}`
  }

  async exchangeCode(code: string, codeVerifier?: string): Promise<TokenResponse> {
    const body = new URLSearchParams({
      grant_type: 'authorization_code',
      code,
      redirect_uri: this.redirectUri,
      code_verifier: codeVerifier || '',
    })

    const res = await fetch(TWITTER_TOKEN_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Authorization': `Basic ${btoa(`${this.clientId}:${this.clientSecret}`)}`,
      },
      body: body.toString(),
    })

    if (!res.ok) {
      const err = await res.text()
      throw new Error(`Twitter token exchange failed: ${err}`)
    }

    return await res.json()
  }

  async refreshToken(refreshToken: string): Promise<TokenResponse> {
    const body = new URLSearchParams({
      grant_type: 'refresh_token',
      refresh_token: refreshToken,
    })

    const res = await fetch(TWITTER_TOKEN_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Authorization': `Basic ${btoa(`${this.clientId}:${this.clientSecret}`)}`,
      },
      body: body.toString(),
    })

    if (!res.ok) {
      const err = await res.text()
      throw new Error(`Twitter token refresh failed: ${err}`)
    }

    return await res.json()
  }

  async getUserProfile(accessToken: string): Promise<PlatformProfile> {
    const res = await fetch(`${TWITTER_API}/users/me?user.fields=profile_image_url,name,username`, {
      headers: { 'Authorization': `Bearer ${accessToken}` },
    })

    if (!res.ok) {
      throw new Error(`Twitter profile fetch failed: ${res.status}`)
    }

    const { data } = await res.json()
    return {
      id: data.id,
      username: data.username,
      displayName: data.name,
      avatarUrl: data.profile_image_url,
    }
  }

  async publishPost(accessToken: string, body: string): Promise<PublishResult> {
    const res = await fetch(`${TWITTER_API}/tweets`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ text: body }),
    })

    if (!res.ok) {
      const err = await res.text()
      throw new Error(`Twitter publish failed: ${err}`)
    }

    const { data } = await res.json()
    return {
      platformPostId: data.id,
      platformUrl: `https://x.com/i/status/${data.id}`,
    }
  }

  async publishThread(accessToken: string, parts: string[]): Promise<PublishResult> {
    let previousId: string | null = null
    let firstId = ''
    let firstUrl = ''

    for (const part of parts) {
      const payload: Record<string, unknown> = { text: part }
      if (previousId) {
        payload.reply = { in_reply_to_tweet_id: previousId }
      }

      const res = await fetch(`${TWITTER_API}/tweets`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      })

      if (!res.ok) {
        const err = await res.text()
        throw new Error(`Twitter thread publish failed at part ${parts.indexOf(part) + 1}: ${err}`)
      }

      const { data } = await res.json()
      previousId = data.id

      if (!firstId) {
        firstId = data.id
        firstUrl = `https://x.com/i/status/${data.id}`
      }
    }

    return { platformPostId: firstId, platformUrl: firstUrl }
  }

  async getPostAnalytics(accessToken: string, platformPostId: string): Promise<PostAnalytics> {
    const fields = 'public_metrics,non_public_metrics,organic_metrics'
    const res = await fetch(
      `${TWITTER_API}/tweets/${platformPostId}?tweet.fields=${fields}`,
      { headers: { 'Authorization': `Bearer ${accessToken}` } },
    )

    if (!res.ok) {
      // Fall back to public_metrics only
      const pubRes = await fetch(
        `${TWITTER_API}/tweets/${platformPostId}?tweet.fields=public_metrics`,
        { headers: { 'Authorization': `Bearer ${accessToken}` } },
      )
      if (!pubRes.ok) throw new Error(`Twitter analytics failed: ${pubRes.status}`)
      const { data } = await pubRes.json()
      const m = data.public_metrics || {}
      return {
        impressions: m.impression_count || 0,
        likes: m.like_count || 0,
        reposts: m.retweet_count || 0,
        replies: m.reply_count || 0,
        clicks: 0,
        saves: m.bookmark_count || 0,
        reach: 0,
        engagementRate: 0,
      }
    }

    const { data } = await res.json()
    const pub = data.public_metrics || {}
    const nonPub = data.non_public_metrics || {}
    const organic = data.organic_metrics || {}

    const impressions = organic.impression_count || nonPub.impression_count || pub.impression_count || 0
    const likes = pub.like_count || 0
    const reposts = pub.retweet_count || 0
    const replies = pub.reply_count || 0
    const clicks = nonPub.url_link_clicks || 0
    const saves = pub.bookmark_count || 0

    const totalEngagement = likes + reposts + replies + clicks + saves
    const engagementRate = impressions > 0 ? totalEngagement / impressions : 0

    return { impressions, likes, reposts, replies, clicks, saves, reach: impressions, engagementRate }
  }
}
