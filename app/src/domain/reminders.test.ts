import { describe, expect, it } from 'vitest'
import { isReminderDue, nextReminderRow } from './reminders'
import type { Reminder } from './types'

const reminder = (over: Partial<Reminder> = {}): Reminder => ({
  id: 'r1',
  section_id: 's1',
  every_n: 6,
  offset: 12,
  message: 'Decrease',
  active: true,
  ...over,
})

describe('reminders', () => {
  it('fires on the offset row and every N rows after', () => {
    const r = reminder()
    const due = [10, 11, 12, 13, 17, 18, 19, 24].filter((n) => isReminderDue(r, n))
    expect(due).toEqual([12, 18, 24])
  })

  it('never fires before the offset', () => {
    const r = reminder({ offset: 12, every_n: 6 })
    // 6 would satisfy the modulo if offset were ignored — it must not fire.
    expect(isReminderDue(r, 6)).toBe(false)
    expect(isReminderDue(r, 0)).toBe(false)
  })

  it('fires every row when every_n is 1', () => {
    const r = reminder({ every_n: 1, offset: 3 })
    expect([3, 4, 5].every((n) => isReminderDue(r, n))).toBe(true)
    expect(isReminderDue(r, 2)).toBe(false)
  })

  it('does not fire when inactive', () => {
    expect(isReminderDue(reminder({ active: false }), 12)).toBe(false)
  })

  it('refuses a zero or negative interval instead of dividing by it', () => {
    expect(isReminderDue(reminder({ every_n: 0 }), 12)).toBe(false)
    expect(isReminderDue(reminder({ every_n: -2 }), 12)).toBe(false)
  })

  describe('nextReminderRow', () => {
    it('is the offset before the first fire', () => {
      expect(nextReminderRow(reminder(), 0)).toBe(12)
      expect(nextReminderRow(reminder(), 11)).toBe(12)
    })

    it('is null while it is due right now', () => {
      expect(nextReminderRow(reminder(), 12)).toBeNull()
      expect(nextReminderRow(reminder(), 18)).toBeNull()
    })

    it('steps forward between fires', () => {
      expect(nextReminderRow(reminder(), 13)).toBe(18)
      expect(nextReminderRow(reminder(), 17)).toBe(18)
      expect(nextReminderRow(reminder(), 19)).toBe(24)
    })
  })
})
