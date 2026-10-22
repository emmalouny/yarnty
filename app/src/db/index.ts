import { openDatabase } from './open'

export { STORES, DB_NAME, DB_VERSION } from './schema'
export { getMeta, setMeta } from './meta'
export { request, transactionDone } from './request'

let connection: Promise<IDBDatabase> | null = null

/**
 * The app's single database connection, opened once per page.
 *
 * Memoised deliberately. React StrictMode runs effects twice in development,
 * and two live connections on an old version are exactly what makes a later
 * version bump fire `onblocked` -- a bug that would only ever show up on the
 * day a migration ships. One connection, no close on unmount.
 */
export function getDatabase(): Promise<IDBDatabase> {
  connection ??= openDatabase({
    onMigrate: (info) =>
      console.info(`[yarnty] local schema ${info.from} -> ${info.to}: ${info.describe}`),
  }).catch((error: unknown) => {
    connection = null // let a later attempt retry rather than cache the failure
    throw error
  })
  return connection
}
