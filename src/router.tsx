import { Suspense } from 'react'
import { createHashRouter, Navigate, useRouteError } from 'react-router-dom'
import { Layout } from './components/Layout'
import { ErrorBoundary } from './components/ErrorBoundary'
import { KernelLoading } from './components/KernelLoading'
import { lazyRetry } from './utils/lazyRetry'

// Lazy-load ALL pages — lazyRetry reloads once on stale-cache 404
const LandingPage = lazyRetry(() => import('./pages/LandingPage').then(m => ({ default: m.LandingPage })))
const EnginePage = lazyRetry(() => import('./pages/EnginePage').then(m => ({ default: m.EnginePage })))
const AdminPage = lazyRetry(() => import('./pages/AdminPage').then(m => ({ default: m.AdminPage })))
const SharedConversationPage = lazyRetry(() => import('./pages/SharedConversationPage').then(m => ({ default: m.SharedConversationPage })))
const BriefingPage = lazyRetry(() => import('./pages/BriefingPage').then(m => ({ default: m.BriefingPage })))
const PrivacyPage = lazyRetry(() => import('./pages/PrivacyPage').then(m => ({ default: m.PrivacyPage })))
const TermsPage = lazyRetry(() => import('./pages/TermsPage').then(m => ({ default: m.TermsPage })))
const PublishedContentPage = lazyRetry(() => import('./pages/PublishedContentPage').then(m => ({ default: m.PublishedContentPage })))
const SocialCallbackPage = lazyRetry(() => import('./components/SocialCallbackPage').then(m => ({ default: m.SocialCallbackPage })))
const ExplorePage = lazyRetry(() => import('./pages/ExplorePage').then(m => ({ default: m.ExplorePage })))
const AuthorProfilePage = lazyRetry(() => import('./pages/AuthorProfilePage').then(m => ({ default: m.AuthorProfilePage })))
const LiveSharePage = lazyRetry(() => import('./pages/LiveSharePage').then(m => ({ default: m.LiveSharePage })))
const WorkspaceAdminPage = lazyRetry(() => import('./pages/WorkspaceAdminPage').then(m => ({ default: m.WorkspaceAdminPage })))
const PlayPage = lazyRetry(() => import('./pages/PlayPage').then(m => ({ default: m.PlayPage })))
const SecurityPage = lazyRetry(() => import('./pages/SecurityPage').then(m => ({ default: m.SecurityPage })))

function withErrorBoundary(element: React.ReactNode) {
  return <ErrorBoundary>{element}</ErrorBoundary>
}

function LazyAdmin() {
  return (
    <Suspense fallback={
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh', fontFamily: 'Courier Prime, monospace', opacity: 0.4 }}>
        Loading dashboard...
      </div>
    }>
      <AdminPage />
    </Suspense>
  )
}

function RootErrorPage() {
  const error = useRouteError() as any
  const message = error?.statusText || error?.message || String(error)
  return (
    <div style={{ padding: 40, fontFamily: 'Courier Prime, monospace', color: '#1F1E1D', background: '#FAF9F6', minHeight: '100vh' }}>
      <h1 style={{ fontSize: 24, marginBottom: 16 }}>Something went wrong</h1>
      <pre style={{ whiteSpace: 'pre-wrap', opacity: 0.7, fontSize: 14, marginBottom: 24 }}>{message}</pre>
      <pre style={{ whiteSpace: 'pre-wrap', opacity: 0.5, fontSize: 12 }}>{error?.stack || JSON.stringify(error, null, 2)}</pre>
      <button onClick={() => window.location.hash = '#/'} style={{ marginTop: 24, padding: '8px 24px', cursor: 'pointer' }}>
        Go Home
      </button>
    </div>
  )
}

export const router = createHashRouter([
  {
    path: '/',
    element: <Layout />,
    errorElement: <RootErrorPage />,
    children: [
      { index: true, element: withErrorBoundary(
        <Suspense fallback={<KernelLoading />}>
          <LandingPage />
        </Suspense>
      ) },
      { path: 'admin', element: withErrorBoundary(<LazyAdmin />) },
      { path: 'briefing/:id', element: withErrorBoundary(
        <Suspense fallback={<div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh', fontFamily: 'Courier Prime, monospace', opacity: 0.4 }}>Loading...</div>}>
          <BriefingPage />
        </Suspense>
      ) },
      { path: 'shared/:id', element: withErrorBoundary(
        <Suspense fallback={<div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh', fontFamily: 'Courier Prime, monospace', opacity: 0.4 }}>Loading...</div>}>
          <SharedConversationPage />
        </Suspense>
      ) },
      { path: 'privacy', element: withErrorBoundary(
        <Suspense fallback={<div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh', fontFamily: 'Courier Prime, monospace', opacity: 0.4 }}>Loading...</div>}>
          <PrivacyPage />
        </Suspense>
      ) },
      { path: 'terms', element: withErrorBoundary(
        <Suspense fallback={<div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh', fontFamily: 'Courier Prime, monospace', opacity: 0.4 }}>Loading...</div>}>
          <TermsPage />
        </Suspense>
      ) },
      { path: 'p/:slug', element: withErrorBoundary(
        <Suspense fallback={<div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh', fontFamily: 'Courier Prime, monospace', opacity: 0.4 }}>Loading...</div>}>
          <PublishedContentPage />
        </Suspense>
      ) },
      { path: 'social/callback/:platform', element: withErrorBoundary(
        <Suspense fallback={<div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh', fontFamily: 'Courier Prime, monospace', opacity: 0.4 }}>Loading...</div>}>
          <SocialCallbackPage />
        </Suspense>
      ) },
      { path: 'explore', element: withErrorBoundary(
        <Suspense fallback={<div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh', fontFamily: 'Courier Prime, monospace', opacity: 0.4 }}>Loading...</div>}>
          <ExplorePage />
        </Suspense>
      ) },
      { path: 'author/:id', element: withErrorBoundary(
        <Suspense fallback={<div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh', fontFamily: 'Courier Prime, monospace', opacity: 0.4 }}>Loading...</div>}>
          <AuthorProfilePage />
        </Suspense>
      ) },
      { path: 'workspace/:id', element: withErrorBoundary(
        <Suspense fallback={<div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh', fontFamily: 'Courier Prime, monospace', opacity: 0.4 }}>Loading...</div>}>
          <WorkspaceAdminPage />
        </Suspense>
      ) },
      { path: 'live/:code', element: withErrorBoundary(
        <Suspense fallback={<div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh', fontFamily: 'Courier Prime, monospace', opacity: 0.4 }}>Joining...</div>}>
          <LiveSharePage />
        </Suspense>
      ) },
      { path: 'play', element: withErrorBoundary(
        <Suspense fallback={<div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh', fontFamily: 'Courier Prime, monospace', opacity: 0.4, color: '#fff', background: '#0a0a0a' }}>Loading synthesis...</div>}>
          <PlayPage />
        </Suspense>
      ) },
      { path: 'security', element: withErrorBoundary(
        <Suspense fallback={<div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh', fontFamily: 'Courier Prime, monospace', opacity: 0.4 }}>Loading...</div>}>
          <SecurityPage />
        </Suspense>
      ) },
      { path: '*', element: <Navigate to="/" replace /> },
    ],
  },
])
