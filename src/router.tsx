import { Suspense } from 'react'
import { createHashRouter, Navigate, useRouteError } from 'react-router-dom'
import { Layout } from './components/Layout'
import { ErrorBoundary } from './components/ErrorBoundary'
import { KernelLoading } from './components/KernelLoading'
import { lazyRetry } from './utils/lazyRetry'

// Lazy-load pages
const LandingPage = lazyRetry(() => import('./pages/LandingPage').then(m => ({ default: m.LandingPage })))
const PrivacyPage = lazyRetry(() => import('./pages/PrivacyPage').then(m => ({ default: m.PrivacyPage })))
const TermsPage = lazyRetry(() => import('./pages/TermsPage').then(m => ({ default: m.TermsPage })))
const SecurityPage = lazyRetry(() => import('./pages/SecurityPage').then(m => ({ default: m.SecurityPage })))
const BenchPage = lazyRetry(() => import('./pages/BenchPage'))
const IssuesPage = lazyRetry(() => import('./pages/IssuesPage').then(m => ({ default: m.IssuesPage })))
const IssueDetailPage = lazyRetry(() => import('./pages/IssueDetailPage').then(m => ({ default: m.IssueDetailPage })))

function withErrorBoundary(element: React.ReactNode) {
  return <ErrorBoundary>{element}</ErrorBoundary>
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
      { path: 'security', element: withErrorBoundary(
        <Suspense fallback={<div className="ka-page-loading">Loading...</div>}>
          <SecurityPage />
        </Suspense>
      ) },
      { path: 'bench', element: withErrorBoundary(
        <Suspense fallback={<div className="ka-page-loading">Loading benchmarks...</div>}>
          <BenchPage />
        </Suspense>
      ) },
      { path: 'issues', element: withErrorBoundary(
        <Suspense fallback={<div className="ka-page-loading">Loading back catalog...</div>}>
          <IssuesPage />
        </Suspense>
      ) },
      { path: 'issues/:number', element: withErrorBoundary(
        <Suspense fallback={<div className="ka-page-loading">Loading issue...</div>}>
          <IssueDetailPage />
        </Suspense>
      ) },
      { path: 'privacy', element: withErrorBoundary(
        <Suspense fallback={<div className="ka-page-loading">Loading...</div>}>
          <PrivacyPage />
        </Suspense>
      ) },
      { path: 'terms', element: withErrorBoundary(
        <Suspense fallback={<div className="ka-page-loading">Loading...</div>}>
          <TermsPage />
        </Suspense>
      ) },
      { path: '*', element: <Navigate to="/" replace /> },
    ],
  },
])
