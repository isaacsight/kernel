import { createHashRouter, Navigate } from 'react-router-dom'
import { Layout } from './components/Layout'
import { ErrorBoundary } from './components/ErrorBoundary'
import { Blog } from './pages/Blog'
import { BlogPost } from './pages/BlogPost'
import { EnginePage } from './pages/EnginePage'

function withErrorBoundary(element: React.ReactNode) {
  return <ErrorBoundary>{element}</ErrorBoundary>
}

export const router = createHashRouter([
  {
    path: '/',
    element: <Layout />,
    children: [
      { index: true, element: <Navigate to="/blog" replace /> },
      { path: 'blog', element: withErrorBoundary(<Blog />) },
      { path: 'blog/:slug', element: withErrorBoundary(<BlogPost />) },
      { path: 'engine', element: withErrorBoundary(<EnginePage />) },
    ],
  },
])
