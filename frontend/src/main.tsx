import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
// Design Systems
import './styles/rubin-tokens.css'
import './styles/rubin-base.css'
// RTS Theme
import './styles/rts-tokens.css'
import './styles/rts-components.css'
import App from './App.tsx'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
