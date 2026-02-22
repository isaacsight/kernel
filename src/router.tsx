import { Suspense } from 'react'
import { createHashRouter, Navigate, useRouteError } from 'react-router-dom'
import { Layout } from './components/Layout'
import { ErrorBoundary } from './components/ErrorBoundary'
import { EnginePage } from './pages/EnginePage'
import { KernelLoading } from './components/KernelLoading'
import { lazyRetry } from './utils/lazyRetry'

// Lazy-load pages — lazyRetry reloads once on stale-cache 404
const AdminPage = lazyRetry(() => import('./pages/AdminPage').then(m => ({ default: m.AdminPage })))
const SharedConversationPage = lazyRetry(() => import('./pages/SharedConversationPage').then(m => ({ default: m.SharedConversationPage })))
const BriefingPage = lazyRetry(() => import('./pages/BriefingPage').then(m => ({ default: m.BriefingPage })))

function withErrorBoundary(element: React.ReactNode) {
  return <ErrorBoundary>{element}</ErrorBoundary>
}

function LazyAdmin() {
  return (
    <Suspense fallback={<KernelLoading />}>
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
      { index: true, element: withErrorBoundary(<EnginePage />) },
      { path: 'admin', element: withErrorBoundary(<LazyAdmin />) },
      { path: 'briefing/:id', element: withErrorBoundary(
        <Suspense fallback={<KernelLoading />}>
          <BriefingPage />
        </Suspense>
      ) },
      { path: 'shared/:id', element: withErrorBoundary(
        <Suspense fallback={<KernelLoading />}>
          <SharedConversationPage />
        </Suspense>
      ) },
      { path: '*', element: <Navigate to="/" replace /> },
    ],
  },
])
