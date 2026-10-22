import { useEffect, useState } from 'react'
import { DB_VERSION, getDatabase, getMeta, setMeta } from './db'
import { SocialLinks } from './SocialLinks'
import { useOnline } from './useOnline'

/**
 * This page is yarnty.com, so it is written for a knitter arriving from
 * TikTok rather than for whoever is building it. The counter stays because
 * it is genuinely usable and it is how the offline behaviour gets tested on
 * a real phone — but it is framed as the first piece of the tracker, not as
 * a development probe.
 */
const COUNT_KEY = 'week1_probe_count'

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
        const count = (await getMeta<number>(db, COUNT_KEY)) ?? 0
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
    // move. The same shape persists counter events in week 2, where losing
    // one costs somebody a row of knitting.
    await setMeta(state.db, COUNT_KEY, next)
    setState({ ...state, count: next })
  }

  async function reset() {
    if (state.status !== 'ready') return
    await setMeta(state.db, COUNT_KEY, 0)
    setState({ ...state, count: 0 })
  }

  return (
    <main className="shell">
      <header className="lockup">
        <img className="icon" src="/icon.svg" alt="" width="52" height="52" />
        <h1>YarnTŷ</h1>
      </header>

      <p className="tagline">
        A knitting and crochet project tracker that works without signal.
      </p>

      <p className="early">
        Early build — made in Wales, for knitters and crocheters everywhere.
        The full project tracker is on its way. Here's the first piece of it.
      </p>

      {state.status === 'loading' && <p className="muted" aria-busy="true">Loading…</p>}

      {state.status === 'error' && (
        <p className="error" role="alert">
          Something went wrong starting up: {state.message}
        </p>
      )}

      {state.status === 'ready' && (
        <>
          <button className="counter" onClick={increment} aria-label="Count a row">
            <span className="counter-value">{state.count}</span>
            <span className="counter-label">tap to count rows</span>
          </button>

          <div className="counter-actions">
            <button className="link-button" onClick={reset} disabled={state.count === 0}>
              Reset
            </button>
          </div>

          <p className="muted">
            Your count is saved on this device and keeps working with no signal.
            Add YarnTŷ to your home screen and take it on the bus.
          </p>
        </>
      )}

      <SocialLinks />

      <footer className="status" title={`local schema v${DB_VERSION}`}>
        <span className={online ? 'dot online' : 'dot offline'} aria-hidden="true" />
        <span>{online ? 'Online' : 'Offline — still counting'}</span>
      </footer>
    </main>
  )
}
