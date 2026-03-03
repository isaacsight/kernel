// ─── Communication Store — Message & Preference State ─────────────

import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type {
  CommunicationMessage,
  BroadcastMessage,
  ChannelPreferences,
  CommunicationAnalytics,
} from '../engine/communication/types'

interface CommunicationState {
  messages: CommunicationMessage[]
  broadcasts: BroadcastMessage[]
  preferences: ChannelPreferences | null
  analytics: CommunicationAnalytics | null
  isLoading: boolean
}

interface CommunicationActions {
  setMessages: (messages: CommunicationMessage[]) => void
  addMessage: (message: CommunicationMessage) => void
  updateMessage: (id: string, updates: Partial<CommunicationMessage>) => void
  addBroadcast: (broadcast: BroadcastMessage) => void
  setBroadcasts: (broadcasts: BroadcastMessage[]) => void
  setPreferences: (prefs: ChannelPreferences) => void
  setAnalytics: (analytics: CommunicationAnalytics) => void
  setLoading: (loading: boolean) => void
  clearAll: () => void
}

type CommunicationStore = CommunicationState & CommunicationActions

export const useCommunicationStore = create<CommunicationStore>()(
  persist(
    (set) => ({
      messages: [],
      broadcasts: [],
      preferences: null,
      analytics: null,
      isLoading: false,

      setMessages: (messages) => set({ messages }),

      addMessage: (message) => set(s => ({
        messages: [message, ...s.messages.filter(m => m.id !== message.id)].slice(0, 200),
      })),

      updateMessage: (id, updates) => set(s => ({
        messages: s.messages.map(m => m.id === id ? { ...m, ...updates } : m),
      })),

      addBroadcast: (broadcast) => set(s => ({
        broadcasts: [broadcast, ...s.broadcasts.filter(b => b.id !== broadcast.id)],
      })),

      setBroadcasts: (broadcasts) => set({ broadcasts }),

      setPreferences: (prefs) => set({ preferences: prefs }),

      setAnalytics: (analytics) => set({ analytics }),

      setLoading: (loading) => set({ isLoading: loading }),

      clearAll: () => set({
        messages: [],
        broadcasts: [],
        preferences: null,
        analytics: null,
      }),
    }),
    {
      name: 'kernel-communications',
      partialize: (state) => ({
        messages: state.messages.slice(0, 50),
        broadcasts: state.broadcasts.slice(0, 10),
        preferences: state.preferences,
        // Exclude isLoading and analytics from persistence
      }),
    },
  ),
)
