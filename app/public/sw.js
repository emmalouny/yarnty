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

/*
 * Both constants below are rewritten at build time by the
 * `yarnty:precache-manifest` plugin in vite.config.ts, which knows the
 * fingerprinted filenames that this file cannot.
 *
 * The fallbacks only apply if that plugin did not run.
 */
const PRECACHE = self.__PRECACHE__ || ['/', '/index.html']
const BUILD_ID = self.__BUILD_ID__ || 'dev'
const CACHE = `yarnty-${BUILD_ID}`

/*
 * ignoreVary is essential, not a tidy-up.
 *
 * Vite marks its JS and CSS tags `crossorigin`, so the browser sends an
 * Origin header for those two requests and no others. Cloudflare and Vite's
 * preview server both answer with `Vary: Origin`, and cache.match() honours
 * Vary by default — so the precached entry (stored without an Origin) did
 * not match the request (made with one). The two files the app cannot boot
 * without were the only two that missed the cache, fell through to a network
 * that was not there, and left a white screen. Every other asset matched
 * fine, which is what made it look like anything but a caching bug.
 */
const MATCH = { ignoreVary: true }

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches
      .open(CACHE)
      // Everything the app needs to boot, cached before the worker is ever
      // asked to serve anything — so the very first offline load works,
      // not just the second.
      .then((cache) => cache.addAll(PRECACHE))
      .then(() => self.skipWaiting()),
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
        return (await cache.match('/index.html', MATCH)) ?? Response.error()
      }),
    )
    return
  }

  event.respondWith(
    (async () => {
      const cache = await caches.open(CACHE)

      const hit = await cache.match(request, MATCH)
      if (hit) return hit

      try {
        const response = await fetch(request)
        if (response.ok) cache.put(request, response.clone())
        return response
      } catch (error) {
        // Offline and not matched above. Try the bare path before giving up,
        // so a query string or a header mismatch cannot turn into a blank app.
        const fallback = await cache.match(new URL(request.url).pathname, MATCH)
        if (fallback) return fallback
        throw error
      }
    })(),
  )
})
