import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { RouterProvider } from 'react-router-dom'
import { router } from './router'
import { AuthProvider } from './providers/AuthProvider'
import { KernelAgentProvider } from './components/kernel-agent'
import './index.css'

createRoot(document.getElementById('root')!).render(
    <StrictMode>
        <AuthProvider>
            <KernelAgentProvider>
                <RouterProvider router={router} />
            </KernelAgentProvider>
        </AuthProvider>
    </StrictMode>,
)
