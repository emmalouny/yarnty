import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { App } from './App'

// Self-hosted, bundled and fingerprinted by Vite. Deliberately not Google
// Fonts: an offline-first app cannot fetch a stylesheet from another origin,
// so the brand would break in exactly the places this app is meant to work.
// latin-only: the full package also ships Devanagari, which trebles the
// font payload for glyphs this app will never render.
import '@fontsource/poppins/latin-400.css'
import '@fontsource/poppins/latin-600.css'
import '@fontsource/poppins/latin-700.css'

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
