import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { App } from './App'
import './app.css'

const root = document.getElementById('root')
if (!root) throw new Error('#root is missing from index.html')

createRoot(root).render(
  <StrictMode>
    <App />
  </StrictMode>,
)

// Only in a production build. In dev, Vite serves unbundled modules and a
// caching service worker makes every change a mystery. Offline behaviour is
// therefore verified with `npm run build && npm run preview`, not `npm run dev`.
if (import.meta.env.PROD && 'serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').catch((error) => {
      console.error('[yarnty] service worker registration failed', error)
    })
  })
}
