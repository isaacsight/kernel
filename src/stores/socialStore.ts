// ─── Social Store — Account & Post State ────────────────────────

import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { SocialAccount, SocialPost, DashboardData } from '../engine/social/types'

interface SocialState {
  accounts: SocialAccount[]
  posts: SocialPost[]
  dashboard: DashboardData | null
  isLoading: boolean
}

interface SocialActions {
  setAccounts: (accounts: SocialAccount[]) => void
  addAccount: (account: SocialAccount) => void
  removeAccount: (accountId: string) => void
  setPosts: (posts: SocialPost[]) => void
  addPost: (post: SocialPost) => void
  updatePost: (postId: string, updates: Partial<SocialPost>) => void
  setDashboard: (data: DashboardData) => void
  setLoading: (loading: boolean) => void
  clearAll: () => void
}

type SocialStore = SocialState & SocialActions

export const useSocialStore = create<SocialStore>()(
  persist(
    (set, get) => ({
      accounts: [],
      posts: [],
      dashboard: null,
      isLoading: false,

      setAccounts: (accounts) => set({ accounts }),

      addAccount: (account) => set(s => ({
        accounts: [...s.accounts.filter(a => a.id !== account.id), account],
      })),

      removeAccount: (accountId) => set(s => ({
        accounts: s.accounts.filter(a => a.id !== accountId),
      })),

      setPosts: (posts) => set({ posts }),

      addPost: (post) => set(s => ({
        posts: [post, ...s.posts.filter(p => p.id !== post.id)],
      })),

      updatePost: (postId, updates) => set(s => ({
        posts: s.posts.map(p => p.id === postId ? { ...p, ...updates } : p),
      })),

      setDashboard: (data) => set({ dashboard: data }),

      setLoading: (loading) => set({ isLoading: loading }),

      clearAll: () => set({ accounts: [], posts: [], dashboard: null }),
    }),
    {
      name: 'kernel-social',
      partialize: (state) => ({
        accounts: state.accounts,
        posts: state.posts.slice(0, 20), // keep last 20 posts
      }),
    },
  ),
)
