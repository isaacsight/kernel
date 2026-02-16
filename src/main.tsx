import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { RouterProvider } from 'react-router-dom'
import { router } from './router'
import { AuthProvider } from './providers/AuthProvider'
import { KernelAgentProvider } from './components/kernel-agent'
import { supabase } from './engine/SupabaseClient'
import './index.css'

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

// ─── Render App ─────────────────────────────────────────────────

createRoot(document.getElementById('root')!).render(
    <StrictMode>
        <AuthProvider>
            <KernelAgentProvider>
                <RouterProvider router={router} />
            </KernelAgentProvider>
        </AuthProvider>
    </StrictMode>,
)
