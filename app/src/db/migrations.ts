import { STORES } from './schema'

export type Migration = {
  /** The version this migration brings the database *to*. */
  to: number
  /** Human-readable, shown in logs and bug reports. */
  describe: string
  run: (db: IDBDatabase, tx: IDBTransaction) => void
}

/**
 * Ordered, append-only list of migrations. Never edit a shipped entry --
 * add a new one. A device may be on any previous version.
 */
export const migrations: Migration[] = [
  {
    to: 1,
    describe: 'create the phase 1 stores',
    run: (db) => {
      const projects = db.createObjectStore(STORES.projects, { keyPath: 'id' })
      projects.createIndex('by_updated_at', 'updated_at')

      const sections = db.createObjectStore(STORES.sections, { keyPath: 'id' })
      sections.createIndex('by_project', 'project_id')
      sections.createIndex('by_project_position', ['project_id', 'position'])

      const reminders = db.createObjectStore(STORES.reminders, { keyPath: 'id' })
      reminders.createIndex('by_section', 'section_id')

      const pending = db.createObjectStore(STORES.pendingEvents, {
        keyPath: 'client_event_id',
      })
      pending.createIndex('by_occurred_at', 'occurred_at')

      db.createObjectStore(STORES.meta, { keyPath: 'key' })
    },
  },
  {
    to: 2,
    describe: 'no-op: proves the upgrade path end to end before anything depends on it',
    run: () => {
      // Deliberately empty. See DECISIONS.md section 7: the first upgrade path
      // is a tested no-op so the mechanism is proven while the cost of it being
      // broken is zero. `migrations.test.ts` opens a real v1 database, writes
      // rows, upgrades to v2, and asserts the rows survived.
    },
  },
  {
    to: 3,
    describe: 'remove the week 1 probe counter from meta',
    run: (_db, tx) => {
      // The week 1 shell stored a throwaway count under this key. Every
      // device that visited yarnty.com has one. Deleting it here is the
      // first migration that does real work, which is the point of having
      // proven the mechanism on a no-op first.
      tx.objectStore(STORES.meta).delete('week1_probe_count')
    },
  },
]

/** Migrations needed to go from `fromVersion` up to `toVersion`, in order. */
export function migrationsBetween(fromVersion: number, toVersion: number): Migration[] {
  return migrations
    .filter((m) => m.to > fromVersion && m.to <= toVersion)
    .sort((a, b) => a.to - b.to)
}
