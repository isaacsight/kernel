/**
 * Platform detection utilities for Capacitor native wrapper.
 */

/** Check if running inside Capacitor native shell (iOS/Android) */
export function isNativePlatform(): boolean {
  return typeof (window as any).Capacitor !== 'undefined'
    && (window as any).Capacitor.isNativePlatform?.() === true
}

/** Get the native platform name: 'ios', 'android', or 'web' */
export function getPlatform(): 'ios' | 'android' | 'web' {
  if (!isNativePlatform()) return 'web'
  return (window as any).Capacitor.getPlatform?.() || 'web'
}

/** Check if running on iOS (native or Safari PWA) */
export function isIOS(): boolean {
  return getPlatform() === 'ios' || /iPhone|iPad|iPod/.test(navigator.userAgent)
}

/** Check if running on Android (native or Chrome PWA) */
export function isAndroid(): boolean {
  return getPlatform() === 'android' || /Android/.test(navigator.userAgent)
}
