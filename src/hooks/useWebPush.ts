import { useState, useEffect, useCallback } from 'react'
import { supabase } from '../engine/SupabaseClient'

const VAPID_PUBLIC_KEY = import.meta.env.VITE_VAPID_PUBLIC_KEY as string | undefined

function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4)
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/')
  const rawData = atob(base64)
  const out = new Uint8Array(rawData.length)
  for (let i = 0; i < rawData.length; ++i) out[i] = rawData.charCodeAt(i)
  return out
}

export function useWebPush() {
  const [isSupported, setIsSupported] = useState(false)
  const [isSubscribed, setIsSubscribed] = useState(false)
  const [isLoading, setIsLoading] = useState(false)

  // Check support + current subscription on mount
  useEffect(() => {
    const ok = 'serviceWorker' in navigator && 'PushManager' in window && !!VAPID_PUBLIC_KEY
    setIsSupported(ok)
    if (!ok) return

    navigator.serviceWorker.ready.then(reg =>
      reg.pushManager.getSubscription().then(sub => setIsSubscribed(!!sub))
    )
  }, [])

  const subscribe = useCallback(async () => {
    if (!VAPID_PUBLIC_KEY) return false
    setIsLoading(true)
    try {
      const permission = await Notification.requestPermission()
      if (permission !== 'granted') return false

      const reg = await navigator.serviceWorker.ready
      const subscription = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY) as BufferSource,
      })

      // Save subscription to Supabase
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) return false

      const { error } = await supabase.from('push_subscriptions').upsert(
        {
          user_id: session.user.id,
          endpoint: subscription.endpoint,
          subscription: subscription.toJSON(),
        },
        { onConflict: 'user_id' }
      )

      if (error) throw error
      setIsSubscribed(true)
      return true
    } catch (err) {
      console.error('Push subscribe failed:', err)
      return false
    } finally {
      setIsLoading(false)
    }
  }, [])

  const unsubscribe = useCallback(async () => {
    setIsLoading(true)
    try {
      const reg = await navigator.serviceWorker.ready
      const sub = await reg.pushManager.getSubscription()
      if (sub) await sub.unsubscribe()

      const { data: { session } } = await supabase.auth.getSession()
      if (session) {
        await supabase.from('push_subscriptions').delete().eq('user_id', session.user.id)
      }
      setIsSubscribed(false)
    } catch (err) {
      console.error('Push unsubscribe failed:', err)
    } finally {
      setIsLoading(false)
    }
  }, [])

  const toggle = useCallback(async () => {
    if (isSubscribed) await unsubscribe()
    else await subscribe()
  }, [isSubscribed, subscribe, unsubscribe])

  return { isSupported, isSubscribed, isLoading, toggle }
}
