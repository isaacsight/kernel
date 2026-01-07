import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './carbon-theme.scss'
import './index-upgraded.css'
import '../../static/design-system/components.css'
import App from './App.tsx'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
