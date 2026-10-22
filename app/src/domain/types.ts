export type ProjectStatus = 'active' | 'finished' | 'hibernating' | 'frogged'

export type Project = {
  id: string
  title: string
  status: ProjectStatus
  /**
   * Deliberately unstructured prose. Yarn is an entity, never a string —
   * when the yarn database arrives it sits ALONGSIDE this field rather than
   * trying to parse it. See DECISIONS.md section 13.
   */
  yarn_notes: string
  created_at: string
  updated_at: string
  deleted_at: string | null
}

export type Section = {
  id: string
  project_id: string
  name: string
  position: number
  /** Cache of the folded event log. Never written without its event. */
  count: number
  target: number | null
  created_at: string
  updated_at: string
  deleted_at: string | null
}

export type Reminder = {
  id: string
  section_id: string
  /** Fire every N rows. Must be >= 1. */
  every_n: number
  /** First row this fires on. "Decrease every 6th row from row 12" => offset 12, every_n 6. */
  offset: number
  message: string
  active: boolean
}

export type CounterEventType = 'increment' | 'decrement' | 'set'

/**
 * Append-only. Increments commute, so two devices merge to the right total
 * with no conflict resolution — which is why counts are never synced as
 * state. 'set' is the deliberate exception: a correction is last-write-wins
 * because the user is asserting a value, not adding to one.
 */
export type CounterEvent = {
  client_event_id: string
  section_id: string
  type: CounterEventType
  delta: number | null
  value: number | null
  occurred_at: string
}
