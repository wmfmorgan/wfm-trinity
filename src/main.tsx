import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import App from './App'
import {
  applyPhosphorTheme,
  applyUiScale,
  readPhosphorTheme,
  readUiScale,
} from './app/uiPrefs'
import './styles/global.css'

// Restore UI zoom and phosphor before first paint so layout and color don't jump.
applyUiScale(readUiScale())
applyPhosphorTheme(readPhosphorTheme())

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
