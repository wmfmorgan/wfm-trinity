import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import App from './App'
import { applyUiScale, readUiScale } from './app/uiPrefs'
import './styles/global.css'

// Restore UI zoom before first paint so layout doesn't jump.
applyUiScale(readUiScale())

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
