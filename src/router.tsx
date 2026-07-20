import { Suspense } from 'react'
import { createBrowserRouter, Navigate, useRouteError } from 'react-router-dom'
import { Layout } from './components/Layout'
import { ErrorBoundary } from './components/ErrorBoundary'
import { KernelLoading } from './components/KernelLoading'
import { lazyRetry } from './utils/lazyRetry'
import { resolveLegacyHash } from './utils/legacyHashRedirect'

// Lazy-load pages
const LandingPage = lazyRetry(() => import('./pages/LandingPage').then(m => ({ default: m.LandingPage })))
const PrivacyPage = lazyRetry(() => import('./pages/PrivacyPage').then(m => ({ default: m.PrivacyPage })))
const TermsPage = lazyRetry(() => import('./pages/TermsPage').then(m => ({ default: m.TermsPage })))
const IssuesPage = lazyRetry(() => import('./pages/IssuesPage').then(m => ({ default: m.IssuesPage })))
const IssueDetailPage = lazyRetry(() => import('./pages/IssueDetailPage').then(m => ({ default: m.IssueDetailPage })))
const IssueBackCoverPage = lazyRetry(() => import('./pages/IssueBackCoverPage').then(m => ({ default: m.IssueBackCoverPage })))
const LaunchPage = lazyRetry(() => import('./pages/LaunchPage').then(m => ({ default: m.LaunchPage })))
const RefusalsPage = lazyRetry(() => import('./pages/RefusalsPage').then(m => ({ default: m.RefusalsPage })))
const PressroomPage = lazyRetry(() => import('./pages/PressroomPage').then(m => ({ default: m.PressroomPage })))
const AboutPage = lazyRetry(() => import('./pages/AboutPage').then(m => ({ default: m.AboutPage })))
const FigmaPage = lazyRetry(() => import('./pages/FigmaPage').then(m => ({ default: m.FigmaPage })))
const PrototypePage = lazyRetry(() => import('./pages/PrototypePage').then(m => ({ default: m.PrototypePage })))
const CreativeCanvasPage = lazyRetry(() => import('./pages/CreativeCanvasPage').then(m => ({ default: m.CreativeCanvasPage })))
const MotionSheetPage = lazyRetry(() => import('./pages/MotionSheetPage').then(m => ({ default: m.MotionSheetPage })))
const PalmierSuitePage = lazyRetry(() => import('./pages/PalmierSuitePage').then(m => ({ default: m.PalmierSuitePage })))
const AtelierPage = lazyRetry(() => import('./pages/AtelierPage').then(m => ({ default: m.AtelierPage })))

function withErrorBoundary(element: React.ReactNode) {
  return <ErrorBoundary>{element}</ErrorBoundary>
}

function RootErrorPage() {
  const error = useRouteError() as any
  const message = error?.statusText || error?.message || String(error)
  return (
    <div className="pop-error-page">
      <h1>Something went wrong</h1>
      <pre>{message}</pre>
      <pre className="pop-error-stack">{error?.stack || JSON.stringify(error, null, 2)}</pre>
      <button onClick={() => window.location.assign('/')}>
        Go Home
      </button>
    </div>
  )
}

// Legacy hash citations (/#/issues/421) must resolve BEFORE the
// router captures location — module scope runs at import time, ahead
// of main.tsx's boot sequence. Auth hashes (#access_token=…) are
// ignored by the resolver and left for the OAuth interceptor.
const legacyPath = resolveLegacyHash(window.location)
if (legacyPath) {
  window.history.replaceState({}, '', legacyPath)
}

export const router = createBrowserRouter([
  {
    path: '/palmier-suite',
    element: withErrorBoundary(
      <Suspense fallback={<div className="ka-page-loading">Loading production suite...</div>}>
        <PalmierSuitePage />
      </Suspense>
    ),
  },
  {
    path: '/motion-sheet',
    element: withErrorBoundary(
      <Suspense fallback={<div className="ka-page-loading">Loading motion studies...</div>}>
        <MotionSheetPage />
      </Suspense>
    ),
  },
  {
    path: '/canvas-creative',
    element: withErrorBoundary(
      <Suspense fallback={<div className="ka-page-loading">Loading creative studio...</div>}>
        <CreativeCanvasPage />
      </Suspense>
    ),
  },
  { path: '/studio', element: <Navigate to="/canvas-creative" replace /> },
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
      { path: 'issues/:number/back', element: withErrorBoundary(
        <Suspense fallback={<div className="ka-page-loading">Loading verso...</div>}>
          <IssueBackCoverPage />
        </Suspense>
      ) },
      { path: 'launch/:number', element: withErrorBoundary(
        <Suspense fallback={<div className="ka-page-loading">Loading the launch...</div>}>
          <LaunchPage />
        </Suspense>
      ) },
      { path: 'refusals', element: withErrorBoundary(
        <Suspense fallback={<div className="ka-page-loading">Loading the refusals...</div>}>
          <RefusalsPage />
        </Suspense>
      ) },
      { path: 'pressroom', element: withErrorBoundary(
        <Suspense fallback={<div className="ka-page-loading">Loading the pressroom...</div>}>
          <PressroomPage />
        </Suspense>
      ) },
      { path: 'atelier', element: withErrorBoundary(
        <Suspense fallback={<div className="ka-page-loading">Loading the atelier...</div>}>
          <AtelierPage />
        </Suspense>
      ) },
      { path: 'about', element: withErrorBoundary(
        <Suspense fallback={<div className="ka-page-loading">Loading...</div>}>
          <AboutPage />
        </Suspense>
      ) },
      { path: 'figma', element: withErrorBoundary(
        <Suspense fallback={<div className="ka-page-loading">Loading figma spec...</div>}>
          <FigmaPage />
        </Suspense>
      ) },
      { path: 'prototype', element: withErrorBoundary(
        <Suspense fallback={<div className="ka-page-loading">Loading prototype workspace...</div>}>
          <PrototypePage />
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
