import { DB_NAME, DB_VERSION } from './schema'
import { migrations, migrationsBetween } from './migrations'

export type OpenOptions = {
  name?: string
  version?: number
  /** Injectable so tests can use a fresh in-memory factory per test. */
  factory?: IDBFactory
  /** Called for each migration applied, for logging and bug reports. */
  onMigrate?: (info: { from: number; to: number; describe: string }) => void
}

/**
 * Open the local database, applying any outstanding migrations.
 *
 * Uses IndexedDB's own `onupgradeneeded` versioning rather than a bare
 * key/value blob, so an upgrade is a transaction that either commits whole
 * or rolls back -- a half-migrated device is not a reachable state.
 */
export function openDatabase(options: OpenOptions = {}): Promise<IDBDatabase> {
  const {
    name = DB_NAME,
    version = DB_VERSION,
    factory = globalThis.indexedDB,
    onMigrate,
  } = options

  const highest = migrations.reduce((max, m) => Math.max(max, m.to), 0)
  if (version > highest) {
    return Promise.reject(
      new Error(
        `DB_VERSION is ${version} but the highest migration is ${highest}. ` +
          `Add a migration before bumping the version.`,
      ),
    )
  }

  return new Promise((resolve, reject) => {
    const req = factory.open(name, version)

    req.onupgradeneeded = (event) => {
      const db = req.result
      const tx = req.transaction
      if (!tx) {
        reject(new Error('upgrade started without a transaction'))
        return
      }
      try {
        for (const migration of migrationsBetween(event.oldVersion, version)) {
          migration.run(db, tx)
          onMigrate?.({
            from: event.oldVersion,
            to: migration.to,
            describe: migration.describe,
          })
        }
      } catch (error) {
        // Abort so the device stays on its old version rather than
        // ending up half-migrated with unsynced data in two shapes.
        tx.abort()
        reject(error)
      }
    }

    req.onsuccess = () => resolve(req.result)
    req.onerror = () => reject(req.error ?? new Error('failed to open database'))

    // Another tab holds an older version open. Surfaced rather than hung on,
    // because a silent hang here looks to the user like a dead app.
    req.onblocked = () =>
      reject(
        new Error(
          'The database is open in another tab on an older version. ' +
            'Close other YarnTy tabs and reload.',
        ),
      )
  })
}
