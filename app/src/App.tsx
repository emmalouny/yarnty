import { useEffect, useState } from 'react'
import { DB_VERSION, getDatabase, getMeta, setMeta } from './db'
import { useOnline } from './useOnline'

/**
 * Week 1 is the shell, not the product. The counter below is a throwaway
 * probe that answers one question: does a value written on this device
 * survive an offline reload? It is deleted in week 2, when real projects
 * and sections arrive. See DECISIONS.md section 12.
 */
const PROBE_KEY = 'week1_probe_count'

type State =
  | { status: 'loading' }
  | { status: 'ready'; db: IDBDatabase; count: number }
  | { status: 'error'; message: string }

export function App() {
  const [state, setState] = useState<State>({ status: 'loading' })
  const online = useOnline()

  useEffect(() => {
    let cancelled = false

    getDatabase()
      .then(async (db) => {
        const count = (await getMeta<number>(db, PROBE_KEY)) ?? 0
        if (cancelled) return
        setState({ status: 'ready', db, count })
      })
      .catch((error: unknown) => {
        if (cancelled) return
        setState({
          status: 'error',
          message: error instanceof Error ? error.message : String(error),
        })
      })

    return () => {
      cancelled = true
    }
  }, [])

  async function increment() {
    if (state.status !== 'ready') return
    const next = state.count + 1
    // Written before the UI updates: if the write fails the number must not
    // move. Getting this habit right now matters more than it looks -- in
    // week 2 the same shape persists counter events a user cannot afford
    // to lose.
    await setMeta(state.db, PROBE_KEY, next)
    setState({ ...state, count: next })
  }

  if (state.status === 'loading') {
    return <main className="shell" aria-busy="true"><p>Opening your local database…</p></main>
  }

  if (state.status === 'error') {
    return (
      <main className="shell">
        <h1>YarnTŷ</h1>
        <p className="error" role="alert">{state.message}</p>
      </main>
    )
  }

  return (
    <main className="shell">
      <header className="lockup">
        <img className="icon" src="/icon.svg" alt="" width="56" height="56" />
        <h1>YarnTŷ</h1>
      </header>

      <p className="tagline">
        Week 1: the shell. No tracker yet — on purpose.
      </p>

      <button className="counter" onClick={increment}>
        <span className="counter-value">{state.count}</span>
        <span className="counter-label">tap to count</span>
      </button>

      <p className="proof">
        Reload with the wifi off. The number should still be {state.count}.
      </p>

      <footer className="status">
        <span className={online ? 'dot online' : 'dot offline'} aria-hidden="true" />
        <span>{online ? 'online' : 'offline — still working'}</span>
        <span className="sep">·</span>
        <span>local schema v{DB_VERSION}</span>
      </footer>
    </main>
  )
}
