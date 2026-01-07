import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './design-system/design-tokens.css'
import './design-system/components.css'
import './index.css'
import App from './App.jsx'

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
