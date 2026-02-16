import { createHashRouter, Navigate, useRouteError } from 'react-router-dom'
import { Layout } from './components/Layout'
import { ErrorBoundary } from './components/ErrorBoundary'
import { EnginePage } from './pages/EnginePage'

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
      { index: true, element: withErrorBoundary(<EnginePage />) },
      { path: '*', element: <Navigate to="/" replace /> },
    ],
  },
])
