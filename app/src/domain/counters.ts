import { STORES } from '../db/schema'
import { request, transactionDone } from '../db/request'
import { newId, systemClock, type Clock } from './clock'
import type { CounterEvent, Section } from './types'

/**
 * Replay an event log into a count.
 *
 * Counts are clamped at zero: a row count below zero is not a thing, and a
 * stray decrement should not poison every later increment.
 */
export function byOccurredAt(a: CounterEvent, b: CounterEvent): number {
  return a.occurred_at === b.occurred_at
    ? a.client_event_id.localeCompare(b.client_event_id)
    : a.occurred_at.localeCompare(b.occurred_at)
}

export function foldEvents(events: CounterEvent[]): number {
  const ordered = [...events].sort(byOccurredAt)

  let count = 0
  for (const event of ordered) {
    if (event.type === 'set') count = Math.max(0, event.value ?? 0)
    else count = Math.max(0, count + (event.delta ?? 0))
  }
  return count
}

type Change =
  | { type: 'increment' | 'decrement'; delta: number }
  | { type: 'set'; value: number }

/**
 * Apply a change to a section's count.
 *
 * The event and the cached count are written in ONE transaction. If they
 * could diverge, the cache would silently disagree with the log that is
 * about to become the server's source of truth — and the user would lose
 * rows at sync time without ever seeing an error.
 */
async function applyChange(
  db: IDBDatabase,
  sectionId: string,
  change: Change,
  clock: Clock,
): Promise<number> {
  const tx = db.transaction([STORES.sections, STORES.pendingEvents], 'readwrite')
  const sections = tx.objectStore(STORES.sections)

  const section = await request<Section | undefined>(sections.get(sectionId))
  if (!section) {
    tx.abort()
    throw new Error(`no section ${sectionId}`)
  }

  const next =
    change.type === 'set'
      ? Math.max(0, change.value)
      : Math.max(0, section.count + change.delta)

  const occurred_at = clock()

  const event: CounterEvent = {
    client_event_id: newId(),
    section_id: sectionId,
    type: change.type,
    delta: change.type === 'set' ? null : change.delta,
    value: change.type === 'set' ? next : null,
    occurred_at,
  }

  tx.objectStore(STORES.pendingEvents).put(event)
  sections.put({ ...section, count: next, updated_at: occurred_at })

  await transactionDone(tx)
  return next
}

export function incrementSection(db: IDBDatabase, sectionId: string, clock: Clock = systemClock) {
  return applyChange(db, sectionId, { type: 'increment', delta: 1 }, clock)
}

export function decrementSection(db: IDBDatabase, sectionId: string, clock: Clock = systemClock) {
  return applyChange(db, sectionId, { type: 'decrement', delta: -1 }, clock)
}

/** A correction, not an adjustment — recorded as last-write-wins. */
export function setSectionCount(
  db: IDBDatabase,
  sectionId: string,
  value: number,
  clock: Clock = systemClock,
) {
  return applyChange(db, sectionId, { type: 'set', value }, clock)
}

/**
 * A section's event log, in log order.
 *
 * IndexedDB returns rows in key order, and the key here is a random UUID —
 * so without the sort this hands back a shuffled log, which is a trap for
 * anything that reasonably assumes "last element is the latest event".
 */
export async function pendingEventsFor(
  db: IDBDatabase,
  sectionId: string,
): Promise<CounterEvent[]> {
  const tx = db.transaction(STORES.pendingEvents, 'readonly')
  const all = await request<CounterEvent[]>(tx.objectStore(STORES.pendingEvents).getAll())
  return all.filter((event) => event.section_id === sectionId).sort(byOccurredAt)
}

export async function countPendingEvents(db: IDBDatabase): Promise<number> {
  const tx = db.transaction(STORES.pendingEvents, 'readonly')
  return request<number>(tx.objectStore(STORES.pendingEvents).count())
}
