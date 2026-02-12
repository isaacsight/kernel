import { createHashRouter } from 'react-router-dom'
import { Layout } from './components/Layout'
import { ErrorBoundary } from './components/ErrorBoundary'
import { Home } from './pages/Home'
import { Blog } from './pages/Blog'
import { BlogPost } from './pages/BlogPost'
import { Dash } from './pages/Dash'
import { ClaudePhysicsPage } from './pages/ClaudePhysicsPage'
import { PrototypePage } from './pages/PrototypePage'
import { TheoPage } from './pages/TheoPage'
import { DecidePage } from './pages/DecidePage'
import { CheckoutSuccessPage } from './pages/CheckoutSuccessPage'

function withErrorBoundary(element: React.ReactNode) {
  return <ErrorBoundary>{element}</ErrorBoundary>
}

export const router = createHashRouter([
  {
    path: '/',
    element: <Layout />,
    children: [
      { index: true, element: withErrorBoundary(<Home />) },
      { path: 'blog', element: withErrorBoundary(<Blog />) },
      { path: 'blog/:slug', element: withErrorBoundary(<BlogPost />) },
      { path: 'dash', element: withErrorBoundary(<Dash />) },
      { path: 'claude-physics', element: withErrorBoundary(<ClaudePhysicsPage />) },
      { path: 'prototype', element: withErrorBoundary(<PrototypePage />) },
      { path: 'theo', element: withErrorBoundary(<TheoPage />) },
      { path: 'decide', element: withErrorBoundary(<DecidePage />) },
      { path: 'checkout-success', element: withErrorBoundary(<CheckoutSuccessPage />) },
    ],
  },
])
