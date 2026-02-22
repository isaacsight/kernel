import { StrictMode, Suspense } from 'react'
import { createRoot } from 'react-dom/client'
import { RouterProvider } from 'react-router-dom'
import * as Sentry from '@sentry/react'
import posthog from 'posthog-js'
import { router } from './router'
import { AuthProvider } from './providers/AuthProvider'
import { KernelAgentProvider } from './components/kernel-agent'
import { KernelLoading } from './components/KernelLoading'
import { supabase } from './engine/SupabaseClient'
import './i18n'
import './index.css'

// ─── Analytics (Posthog) ────────────────────────────────────────
const POSTHOG_KEY = import.meta.env.VITE_POSTHOG_KEY || ''
if (POSTHOG_KEY) {
  posthog.init(POSTHOG_KEY, {
    api_host: 'https://us.i.posthog.com',
    autocapture: true,
    capture_pageview: true,
    persistence: 'localStorage',
  })
}

// ─── Error Monitoring (Sentry) ──────────────────────────────────
const SENTRY_DSN = import.meta.env.VITE_SENTRY_DSN || ''
if (SENTRY_DSN) {
  Sentry.init({
    dsn: SENTRY_DSN,
    integrations: [
      Sentry.browserTracingIntegration(),
    ],
    tracesSampleRate: 0.1,
    environment: import.meta.env.MODE,
    beforeSend(event) {
      // Scrub sensitive data from error reports
      if (event.exception?.values) {
        for (const ex of event.exception.values) {
          if (ex.value) {
            // Strip Postgres/Supabase internal details (table names, columns, constraints, row data)
            ex.value = ex.value.replace(/(?:relation|table|column|constraint|index)\s+"[^"]+"/gi, '[db-object]')
            ex.value = ex.value.replace(/(?:INSERT|UPDATE|DELETE|SELECT)\s+.*?(?:FROM|INTO|SET)\s+\w+/gi, '[sql-query]')
            ex.value = ex.value.replace(/row\s*\(.*?\)/gi, '[row-data]')
            // Strip potential API keys / tokens leaked in error messages
            ex.value = ex.value.replace(/(?:key|token|secret|password|authorization)[=:\s]+\S{8,}/gi, '[redacted-credential]')
            // Strip email addresses
            ex.value = ex.value.replace(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g, '[redacted-email]')
            // Strip UUIDs (user IDs, row IDs)
            ex.value = ex.value.replace(/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/gi, '[redacted-uuid]')
            // Strip JWT tokens
            ex.value = ex.value.replace(/eyJ[A-Za-z0-9_-]+\.eyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+/g, '[redacted-jwt]')
          }
        }
      }
      // Strip sensitive query params and headers from breadcrumbs
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
}

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
    supabase.auth.setSession({ access_token, refresh_token })
  }

  // Replace hash with clean route so the router works
  window.history.replaceState({}, '', window.location.pathname + '#/')
}

// Also handle PKCE ?code= in query params
const searchParams = new URLSearchParams(window.location.search)
if (searchParams.has('code')) {
  const code = searchParams.get('code')!
  console.log('[Auth] Intercepted PKCE code from query params')
  supabase.auth.exchangeCodeForSession(code).then(({ error }) => {
    if (error) console.error('[Auth] PKCE exchange failed:', error.message)
    else console.log('[Auth] PKCE exchange success')
  })
  // Clean URL
  window.history.replaceState({}, '', window.location.pathname + window.location.hash)
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
