import { createHashRouter, Navigate } from 'react-router-dom'
import { Layout } from './components/Layout'
import { ErrorBoundary } from './components/ErrorBoundary'
import { ClientPage } from './pages/ClientPage'
import { ObserverPage } from './pages/ObserverPage'
import { DashboardPage } from './pages/DashboardPage'
import { TradingPage } from './pages/TradingPage'
import { Blog } from './pages/Blog'
import { BlogPost } from './pages/BlogPost'

function withErrorBoundary(element: React.ReactNode) {
  return <ErrorBoundary>{element}</ErrorBoundary>
}

export const router = createHashRouter([
  {
    path: '/',
    element: <Layout />,
    children: [
      { index: true, element: <Navigate to="/client" replace /> },
      { path: 'client', element: withErrorBoundary(<ClientPage />) },
      { path: 'observer', element: withErrorBoundary(<ObserverPage />) },
      { path: 'dashboard', element: withErrorBoundary(<DashboardPage />) },
      { path: 'trading', element: withErrorBoundary(<TradingPage />) },
      { path: 'blog', element: withErrorBoundary(<Blog />) },
      { path: 'blog/:slug', element: withErrorBoundary(<BlogPost />) },
    ],
  },
])
