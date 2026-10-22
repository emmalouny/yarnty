import { useCallback, useEffect, useState } from 'react'

export type Route = { name: 'home' } | { name: 'project'; id: string }

function parse(pathname: string): Route {
  const match = pathname.match(/^\/project\/([^/]+)\/?$/)
  const id = match?.[1]
  return id ? { name: 'project', id } : { name: 'home' }
}

/**
 * A ~25-line router rather than a routing library. There are two screens,
 * and the back button is the only navigation a phone user reaches for.
 * Real paths (not hashes) because the Worker already falls back to
 * index.html for unknown paths, so deep links work.
 */
export function useRoute() {
  const [route, setRoute] = useState<Route>(() => parse(window.location.pathname))

  useEffect(() => {
    const onPopState = () => setRoute(parse(window.location.pathname))
    window.addEventListener('popstate', onPopState)
    return () => window.removeEventListener('popstate', onPopState)
  }, [])

  const navigate = useCallback((to: string) => {
    window.history.pushState(null, '', to)
    setRoute(parse(to))
    window.scrollTo(0, 0)
  }, [])

  return { route, navigate }
}
