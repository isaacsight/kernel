import { createHashRouter } from 'react-router-dom'
import { Layout } from './components/Layout'
import { ErrorBoundary } from './components/ErrorBoundary'
import { EnginePage } from './pages/EnginePage'

function withErrorBoundary(element: React.ReactNode) {
  return <ErrorBoundary>{element}</ErrorBoundary>
}

export const router = createHashRouter([
  {
    path: '/',
    element: <Layout />,
    children: [
      { index: true, element: withErrorBoundary(<EnginePage />) },
    ],
  },
])
