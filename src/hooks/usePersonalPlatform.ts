// ─── Personal Platform Hook ─────────────────────────────────────
//
// Fetches the public data that composes a user's personal platform page:
// profile, influences, timeline events, music sessions, and a unified feed.
// Reads from Supabase directly (public-readable tables under RLS).

import { useCallback, useEffect, useState } from 'react'
import { supabase } from '../engine/SupabaseClient'

export type InfluenceKind =
  | 'person' | 'book' | 'track' | 'album' | 'essay'
  | 'repo' | 'film' | 'artwork' | 'idea' | 'place'

export type TimelineKind =
  | 'milestone' | 'note' | 'ship' | 'talk' | 'release'
  | 'trip' | 'idea' | 'encounter' | 'publication'

export type MusicKind =
  | 'session' | 'track' | 'dj_set' | 'preset' | 'remix' | 'sketch' | 'live'

export interface Influence {
  id: string
  user_id: string
  kind: InfluenceKind
  title: string
  creator: string | null
  url: string | null
  note: string | null
  weight: number
  tags: string[]
  added_at: string
}

export interface TimelineEvent {
  id: string
  user_id: string
  kind: TimelineKind
  title: string
  body: string | null
  url: string | null
  tags: string[]
  occurred_at: string
}

export interface MusicSession {
  id: string
  user_id: string
  title: string
  kind: MusicKind | null
  duration_min: number | null
  bpm: number | null
  musical_key: string | null
  genre: string | null
  note: string | null
  artifact_url: string | null
  tags: string[]
  occurred_at: string
}

export interface PlatformProfile {
  user_id: string
  display_name: string | null
  bio: string | null
  avatar_url: string | null
  follower_count: number
  following_count: number
}

export interface SocialPostLite {
  id: string
  platform: string
  body: string
  platform_url: string | null
  published_at: string | null
}

export interface FeedItem {
  item_type: 'influence' | 'timeline' | 'music'
  id: string
  user_id: string
  at: string
  title: string
  body: string | null
  url: string | null
  kind: string
  tags: string[]
}

export interface PersonalPlatformData {
  profile: PlatformProfile | null
  influences: Influence[]
  timeline: TimelineEvent[]
  music: MusicSession[]
  posts: SocialPostLite[]
  feed: FeedItem[]
  loading: boolean
  error: string | null
}

export function usePersonalPlatform(userId: string | undefined) {
  const [data, setData] = useState<PersonalPlatformData>({
    profile: null,
    influences: [],
    timeline: [],
    music: [],
    posts: [],
    feed: [],
    loading: true,
    error: null,
  })

  const load = useCallback(async () => {
    if (!userId) return
    setData(d => ({ ...d, loading: true, error: null }))
    try {
      const [profileRes, infRes, tlRes, mxRes, postsRes, feedRes] = await Promise.all([
        supabase
          .from('author_profiles')
          .select('user_id, display_name, bio, avatar_url, follower_count, following_count')
          .eq('user_id', userId)
          .eq('is_public', true)
          .maybeSingle(),
        supabase
          .from('influences')
          .select('*')
          .eq('user_id', userId)
          .eq('is_public', true)
          .order('weight', { ascending: false })
          .order('added_at', { ascending: false })
          .limit(60),
        supabase
          .from('timeline_events')
          .select('*')
          .eq('user_id', userId)
          .eq('is_public', true)
          .order('occurred_at', { ascending: false })
          .limit(80),
        supabase
          .from('music_sessions')
          .select('*')
          .eq('user_id', userId)
          .eq('is_public', true)
          .order('occurred_at', { ascending: false })
          .limit(40),
        supabase
          .from('social_posts')
          .select('id, platform, body, platform_url, published_at')
          .eq('user_id', userId)
          .eq('status', 'published')
          .order('published_at', { ascending: false })
          .limit(20),
        supabase
          .from('personal_feed')
          .select('*')
          .eq('user_id', userId)
          .order('at', { ascending: false })
          .limit(50),
      ])

      setData({
        profile: (profileRes.data as PlatformProfile) ?? null,
        influences: (infRes.data as Influence[]) ?? [],
        timeline: (tlRes.data as TimelineEvent[]) ?? [],
        music: (mxRes.data as MusicSession[]) ?? [],
        posts: (postsRes.data as SocialPostLite[]) ?? [],
        feed: (feedRes.data as FeedItem[]) ?? [],
        loading: false,
        error: null,
      })
    } catch (err) {
      setData(d => ({
        ...d,
        loading: false,
        error: err instanceof Error ? err.message : 'Failed to load platform',
      }))
    }
  }, [userId])

  useEffect(() => {
    load()
  }, [load])

  return { ...data, reload: load }
}
