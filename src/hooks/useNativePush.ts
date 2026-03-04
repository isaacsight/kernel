import { useState, useEffect, useCallback } from 'react'
import { isNativePlatform } from '../utils/platform'

/**
 * Native push notification hook for Capacitor.
 * Falls back to web push when running in browser.
 * Uses dynamic import to avoid bundling Capacitor plugins for web users.
 */
export function useNativePush() {
  const [isSupported, setIsSupported] = useState(false)
  const [isRegistered, setIsRegistered] = useState(false)
  const [token, setToken] = useState<string | null>(null)

  useEffect(() => {
    if (!isNativePlatform()) return

    const setup = async () => {
      try {
        const { PushNotifications } = await import('@capacitor/push-notifications')

        // Check permission status
        const permStatus = await PushNotifications.checkPermissions()
        setIsSupported(true)

        if (permStatus.receive === 'granted') {
          setIsRegistered(true)
          await PushNotifications.register()
        }

        // Listen for registration
        PushNotifications.addListener('registration', (t) => {
          setToken(t.value)
          setIsRegistered(true)
        })

        // Listen for push received
        PushNotifications.addListener('pushNotificationReceived', (notification) => {
          console.log('[NativePush] Received:', notification)
        })

        // Listen for push action (tap)
        PushNotifications.addListener('pushNotificationActionPerformed', (notification) => {
          const url = notification.notification.data?.url
          if (url) window.location.hash = url
        })
      } catch {
        // Plugin not available
        setIsSupported(false)
      }
    }

    setup()
  }, [])

  const requestPermission = useCallback(async () => {
    if (!isNativePlatform()) return false
    try {
      const { PushNotifications } = await import('@capacitor/push-notifications')
      const result = await PushNotifications.requestPermissions()
      if (result.receive === 'granted') {
        await PushNotifications.register()
        return true
      }
      return false
    } catch {
      return false
    }
  }, [])

  return { isSupported, isRegistered, token, requestPermission }
}
