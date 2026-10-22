import { describe, expect, it } from 'vitest'
import { IDBFactory } from 'fake-indexeddb'
import { openDatabase } from './open'
import { STORES } from './schema'
import { migrationsBetween } from './migrations'
import { request, transactionDone } from './request'

/** A fresh, isolated in-memory IndexedDB per test. */
function freshFactory(): IDBFactory {
  return new IDBFactory()
}

async function put(db: IDBDatabase, store: string, value: unknown): Promise<void> {
  const tx = db.transaction(store, 'readwrite')
  tx.objectStore(store).put(value)
  await transactionDone(tx)
}

async function getAll<T>(db: IDBDatabase, store: string): Promise<T[]> {
  const tx = db.transaction(store, 'readonly')
  return request<T[]>(tx.objectStore(store).getAll())
}

describe('local schema', () => {
  it('creates every phase 1 store at v1', async () => {
    const db = await openDatabase({ version: 1, factory: freshFactory() })
    expect([...db.objectStoreNames].sort()).toEqual(
      Object.values(STORES).slice().sort(),
    )
    db.close()
  })

  it('indexes sections by project and position', async () => {
    const db = await openDatabase({ version: 1, factory: freshFactory() })
    const tx = db.transaction(STORES.sections, 'readonly')
    const names = [...tx.objectStore(STORES.sections).indexNames]
    expect(names).toContain('by_project')
    expect(names).toContain('by_project_position')
    db.close()
  })

  /**
   * The point of week 1. A device holding unsynced offline work must come
   * through a version bump with that work intact. Proven here while the
   * v1 -> v2 migration is still a no-op and the cost of being wrong is zero.
   */
  it('preserves unsynced work across the v1 -> v2 upgrade', async () => {
    const factory = freshFactory()

    const v1 = await openDatabase({ version: 1, factory })
    await put(v1, STORES.projects, {
      id: 'project-1',
      title: 'Nothing yet, just proving the mechanism',
      updated_at: '2026-10-22T00:00:00.000Z',
    })
    await put(v1, STORES.pendingEvents, {
      client_event_id: 'event-1',
      section_id: 'section-1',
      type: 'increment',
      delta: 1,
      occurred_at: '2026-10-22T00:00:01.000Z',
    })
    v1.close()

    const applied: number[] = []
    const v2 = await openDatabase({
      version: 2,
      factory,
      onMigrate: (info) => applied.push(info.to),
    })

    expect(v2.version).toBe(2)
    expect(applied).toEqual([2])
    expect(await getAll(v2, STORES.projects)).toHaveLength(1)

    const events = await getAll<{ client_event_id: string }>(v2, STORES.pendingEvents)
    expect(events.map((e) => e.client_event_id)).toEqual(['event-1'])

    v2.close()
  })

  it('runs every outstanding migration when a device skips a version', async () => {
    const factory = freshFactory()
    const applied: number[] = []
    const db = await openDatabase({
      version: 2,
      factory,
      onMigrate: (info) => applied.push(info.to),
    })
    expect(applied).toEqual([1, 2])
    db.close()
  })

  it('refuses a version with no matching migration', async () => {
    await expect(
      openDatabase({ version: 99, factory: freshFactory() }),
    ).rejects.toThrow(/highest migration/)
  })

  it('selects only the migrations a device still needs', () => {
    expect(migrationsBetween(1, 2).map((m) => m.to)).toEqual([2])
    expect(migrationsBetween(2, 2)).toEqual([])
    expect(migrationsBetween(0, 2).map((m) => m.to)).toEqual([1, 2])
  })
})
