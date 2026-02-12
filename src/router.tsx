import { createHashRouter } from 'react-router-dom'
import { Layout } from './components/Layout'
import { ErrorBoundary } from './components/ErrorBoundary'
import { Home } from './pages/Home'
import { Blog } from './pages/Blog'
import { BlogPost } from './pages/BlogPost'
import { Dash } from './pages/Dash'

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
    ],
  },
])
