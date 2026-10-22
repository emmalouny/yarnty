import { beforeEach, describe, expect, it } from 'vitest'
import { IDBFactory } from 'fake-indexeddb'
import { openDatabase } from '../db/open'
import {
  decrementSection,
  foldEvents,
  incrementSection,
  pendingEventsFor,
  setSectionCount,
} from './counters'
import { addSection, createProject, getSection } from './projects'
import type { Clock } from './clock'
import type { CounterEvent } from './types'

/** Deterministic, strictly increasing timestamps. */
function testClock(): Clock {
  let tick = 0
  return () => new Date(Date.UTC(2026, 0, 1, 0, 0, tick++)).toISOString()
}

let db: IDBDatabase
let sectionId: string
let clock: Clock

const cachedCount = async () => (await getSection(db, sectionId))?.count

beforeEach(async () => {
  db = await openDatabase({ factory: new IDBFactory() })
  clock = testClock()
  const project = await createProject(db, { title: 'Cardigan' }, clock)
  const section = await addSection(db, { projectId: project.id, name: 'Body' }, clock)
  sectionId = section.id
})

describe('counting rows', () => {
  it('increments and records one event per row', async () => {
    expect(await incrementSection(db, sectionId, clock)).toBe(1)
    expect(await incrementSection(db, sectionId, clock)).toBe(2)
    expect(await incrementSection(db, sectionId, clock)).toBe(3)

    const events = await pendingEventsFor(db, sectionId)
    expect(events).toHaveLength(3)
    expect(events.every((e) => e.type === 'increment' && e.delta === 1)).toBe(true)
  })

  /**
   * The invariant the whole design rests on: the cached count must always be
   * exactly what replaying the log produces. If these can drift, the user
   * loses rows at sync time and never sees an error.
   */
  it('keeps the cached count identical to the folded event log', async () => {
    await incrementSection(db, sectionId, clock)
    await incrementSection(db, sectionId, clock)
    await decrementSection(db, sectionId, clock)
    await incrementSection(db, sectionId, clock)
    await setSectionCount(db, sectionId, 40, clock)
    await incrementSection(db, sectionId, clock)

    const events = await pendingEventsFor(db, sectionId)
    expect(foldEvents(events)).toBe(41)
    expect(await cachedCount()).toBe(foldEvents(events))
  })

  it('never goes below zero', async () => {
    expect(await decrementSection(db, sectionId, clock)).toBe(0)
    await incrementSection(db, sectionId, clock)
    expect(await decrementSection(db, sectionId, clock)).toBe(0)
    expect(await decrementSection(db, sectionId, clock)).toBe(0)
    expect(await cachedCount()).toBe(0)
  })

  it('records a correction as a set event, not an adjustment', async () => {
    await incrementSection(db, sectionId, clock)
    expect(await setSectionCount(db, sectionId, 47, clock)).toBe(47)

    const events = await pendingEventsFor(db, sectionId)
    const last = events[events.length - 1]
    expect(last?.type).toBe('set')
    expect(last?.value).toBe(47)
    expect(last?.delta).toBeNull()
  })

  it('keeps each section counting independently', async () => {
    const project = await createProject(db, { title: 'Socks' }, clock)
    const sleeve = await addSection(db, { projectId: project.id, name: 'Sleeve' }, clock)

    await incrementSection(db, sectionId, clock)
    await incrementSection(db, sectionId, clock)
    await incrementSection(db, sleeve.id, clock)

    expect(await cachedCount()).toBe(2)
    expect((await getSection(db, sleeve.id))?.count).toBe(1)
    expect(await pendingEventsFor(db, sleeve.id)).toHaveLength(1)
  })

  it('refuses to touch a section that does not exist', async () => {
    await expect(incrementSection(db, 'nope', clock)).rejects.toThrow(/no section/)
  })

  it('writes no event when the section is missing', async () => {
    await incrementSection(db, sectionId, clock)
    await expect(incrementSection(db, 'nope', clock)).rejects.toThrow()
    // The aborted transaction must not have left a stray event behind.
    expect(await pendingEventsFor(db, sectionId)).toHaveLength(1)
  })
})

describe('foldEvents', () => {
  const event = (over: Partial<CounterEvent>): CounterEvent => ({
    client_event_id: 'e',
    section_id: 's',
    type: 'increment',
    delta: 1,
    value: null,
    occurred_at: '2026-01-01T00:00:00.000Z',
    ...over,
  })

  it('is order-independent for increments, which is why they are what gets synced', () => {
    const a = event({ client_event_id: 'a', occurred_at: '2026-01-01T00:00:01.000Z' })
    const b = event({ client_event_id: 'b', occurred_at: '2026-01-01T00:00:02.000Z' })
    const c = event({ client_event_id: 'c', occurred_at: '2026-01-01T00:00:03.000Z' })

    expect(foldEvents([a, b, c])).toBe(3)
    expect(foldEvents([c, a, b])).toBe(3)
    expect(foldEvents([b, c, a])).toBe(3)
  })

  it('applies a later set as a correction', () => {
    const inc = event({ client_event_id: 'a', occurred_at: '2026-01-01T00:00:01.000Z' })
    const set = event({
      client_event_id: 'b',
      type: 'set',
      delta: null,
      value: 30,
      occurred_at: '2026-01-01T00:00:02.000Z',
    })
    const after = event({ client_event_id: 'c', occurred_at: '2026-01-01T00:00:03.000Z' })

    expect(foldEvents([inc, set, after])).toBe(31)
  })

  it('breaks identical timestamps deterministically', () => {
    const same = '2026-01-01T00:00:01.000Z'
    const a = event({ client_event_id: 'a', occurred_at: same })
    const b = event({ client_event_id: 'b', type: 'set', delta: null, value: 9, occurred_at: same })

    expect(foldEvents([a, b])).toBe(9)
    expect(foldEvents([b, a])).toBe(9)
  })

  it('is empty-safe', () => {
    expect(foldEvents([])).toBe(0)
  })
})
