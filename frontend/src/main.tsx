import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './styles/rubin-tokens.css'
import './styles/rubin-base.css'
import App from './App.tsx'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
