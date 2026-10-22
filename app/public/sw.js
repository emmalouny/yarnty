/*
 * Hand-written service worker, deliberately small enough to read in one sitting.
 *
 * Week 1's only job: after one online visit, a reload with no signal must
 * still boot the app. Nothing here touches IndexedDB -- user data lives there
 * and is never evicted by this cache.
 *
 * Strategy:
 *   - navigations: network first, fall back to the cached shell when offline
 *   - same-origin GETs: cache first, then network, caching what comes back
 *     (works with Vite's content-hashed filenames without a precache manifest)
 */

const CACHE = 'yarnty-shell-v1'
const SHELL = ['/', '/index.html', '/icon.svg', '/manifest.webmanifest']

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE).then((cache) => cache.addAll(SHELL)).then(() => self.skipWaiting()),
  )
})

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  )
})

self.addEventListener('fetch', (event) => {
  const { request } = event
  if (request.method !== 'GET') return

  const url = new URL(request.url)
  if (url.origin !== self.location.origin) return

  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request).catch(async () => {
        const cache = await caches.open(CACHE)
        return (await cache.match('/index.html')) ?? Response.error()
      }),
    )
    return
  }

  event.respondWith(
    caches.open(CACHE).then(async (cache) => {
      const hit = await cache.match(request)
      if (hit) return hit
      const response = await fetch(request)
      if (response.ok) cache.put(request, response.clone())
      return response
    }),
  )
})
