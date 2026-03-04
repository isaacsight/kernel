import { StrictMode, Suspense } from 'react'
import { createRoot } from 'react-dom/client'
import { RouterProvider } from 'react-router-dom'
import { router } from './router'
import { AuthProvider } from './providers/AuthProvider'
import { KernelAgentProvider } from './components/kernel-agent'
import { KernelLoading } from './components/KernelLoading'
import { supabase } from './engine/SupabaseClient'
import './i18n'
import './index.css'

// ─── Boot sequence ──────────────────────────────────────────────
// Auth tokens must be fully processed BEFORE React renders.
// Otherwise useAuth sees no session → LoginGate flashes.
;(async () => {

// ─── Intercept OAuth tokens BEFORE the hash router loads ────────
// Supabase implicit flow puts tokens in the hash fragment:
//   #access_token=xxx&refresh_token=yyy&...
// The hash router would overwrite this with #/, losing the tokens.
// We catch them here, set the session, then clean the URL.

const hash = window.location.hash
if (hash && hash.includes('access_token=')) {
  const params = new URLSearchParams(hash.substring(1))
  const access_token = params.get('access_token')
  const refresh_token = params.get('refresh_token')

  if (access_token && refresh_token) {
    console.log('[Auth] Intercepted OAuth tokens from hash fragment')
    await supabase.auth.setSession({ access_token, refresh_token })
  }

  // Replace hash with clean route so the router works
  window.history.replaceState({}, '', window.location.pathname + '#/')
}

// Also handle PKCE ?code= in query params
const searchParams = new URLSearchParams(window.location.search)
if (searchParams.has('code')) {
  const code = searchParams.get('code')!
  console.log('[Auth] Intercepted PKCE code from query params')
  try {
    const { error } = await supabase.auth.exchangeCodeForSession(code)
    if (error) {
      console.error('[Auth] PKCE exchange failed:', error.message)
      // Don't clean URL on failure — useAuth.ts will retry
    } else {
      console.log('[Auth] PKCE exchange success')
      // Only clean URL on success
      window.history.replaceState({}, '', window.location.pathname + (window.location.hash || '#/'))
    }
  } catch (err) {
    console.error('[Auth] PKCE exchange threw:', err)
    // Don't clean URL — let useAuth.ts have a second chance
  }
}

// Clean error params from failed OAuth
if (searchParams.has('error')) {
  console.warn('[Auth] OAuth error:', searchParams.get('error'))
  window.history.replaceState({}, '', window.location.pathname + window.location.hash)
}

// ─── iOS Safari: disable service worker ─────────────────────────
// WebKit has a bug where the SW fetch handler causes cross-origin
// requests to Supabase edge functions to fail with "Load failed".
// Unregister the SW on iOS/iPadOS to prevent this.
if ('serviceWorker' in navigator && /iPhone|iPad|iPod/.test(navigator.userAgent)) {
  navigator.serviceWorker.getRegistrations().then(regs => {
    for (const reg of regs) reg.unregister()
  })
} else if ('serviceWorker' in navigator) {
  // Auto-reload when a new SW takes control (e.g. after deploy).
  // Must be global — not inside a React component that may not render
  // (LoginGate doesn't mount useServiceWorkerUpdate).
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    window.location.reload()
  })
}

// ─── Render App ─────────────────────────────────────────────────

createRoot(document.getElementById('root')!).render(
    <StrictMode>
        <Suspense fallback={<KernelLoading />}>
            <AuthProvider>
                <KernelAgentProvider>
                    <RouterProvider router={router} />
                </KernelAgentProvider>
            </AuthProvider>
        </Suspense>
    </StrictMode>,
)

// ─── Periodic SW update check ───────────────────────────────────
// SPAs rarely navigate, so the browser won't check for SW updates.
// Poll every 30 minutes so users get new versions without a hard refresh.
if ('serviceWorker' in navigator && !/iPhone|iPad|iPod/.test(navigator.userAgent)) {
  navigator.serviceWorker.getRegistration().then(reg => {
    if (reg) setInterval(() => reg.update(), 30 * 60 * 1000)
  })
}

// ─── Deferred Analytics (load after first paint) ────────────────
// Sentry + PostHog are ~172KB combined. Loading them after render
// shaves that off the critical path.
const deferLoad = window.requestIdleCallback ?? ((cb: () => void) => setTimeout(cb, 1))
deferLoad(() => {
  const POSTHOG_KEY = import.meta.env.VITE_POSTHOG_KEY || ''
  if (POSTHOG_KEY) {
    import('posthog-js').then(({ default: posthog }) => {
      posthog.init(POSTHOG_KEY, {
        api_host: 'https://us.i.posthog.com',
        autocapture: true,
        capture_pageview: true,
        persistence: 'localStorage',
      })
    })
  }

  const SENTRY_DSN = import.meta.env.VITE_SENTRY_DSN || ''
  if (SENTRY_DSN) {
    import('@sentry/react').then((Sentry) => {
      Sentry.init({
        dsn: SENTRY_DSN,
        integrations: [
          Sentry.browserTracingIntegration(),
        ],
        tracesSampleRate: 0.1,
        environment: import.meta.env.MODE,
        beforeSend(event) {
          if (event.exception?.values) {
            for (const ex of event.exception.values) {
              if (ex.value) {
                ex.value = ex.value.replace(/(?:relation|table|column|constraint|index)\s+"[^"]+"/gi, '[db-object]')
                ex.value = ex.value.replace(/(?:INSERT|UPDATE|DELETE|SELECT)\s+.*?(?:FROM|INTO|SET)\s+\w+/gi, '[sql-query]')
                ex.value = ex.value.replace(/row\s*\(.*?\)/gi, '[row-data]')
                ex.value = ex.value.replace(/(?:key|token|secret|password|authorization)[=:\s]+\S{8,}/gi, '[redacted-credential]')
                ex.value = ex.value.replace(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g, '[redacted-email]')
                ex.value = ex.value.replace(/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/gi, '[redacted-uuid]')
                ex.value = ex.value.replace(/eyJ[A-Za-z0-9_-]+\.eyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+/g, '[redacted-jwt]')
              }
            }
          }
          if (event.breadcrumbs) {
            for (const crumb of event.breadcrumbs) {
              if (crumb.data?.url) {
                try {
                  const url = new URL(crumb.data.url)
                  url.searchParams.delete('apikey')
                  url.searchParams.delete('token')
                  url.searchParams.delete('key')
                  crumb.data.url = url.toString()
                } catch { /* non-URL, skip */ }
              }
            }
          }
          return event
        },
      })
    })
  }
})

})() // end async boot
