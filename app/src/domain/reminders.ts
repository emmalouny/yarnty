import type { Reminder } from './types'

/**
 * Is this reminder due at the current row?
 *
 * "Decrease every 6th row from row 12" is offset 12, every_n 6 — due at
 * rows 12, 18, 24. This is the whole feature: losing your place in a repeat
 * is the actual moment of pain while knitting, and solving it needs only
 * arithmetic the user configures once. No pattern parsing involved.
 */
export function isReminderDue(reminder: Reminder, count: number): boolean {
  if (!reminder.active) return false
  if (reminder.every_n < 1) return false
  if (count < reminder.offset) return false
  return (count - reminder.offset) % reminder.every_n === 0
}

/** The next row this reminder fires on, or null if it is already due now. */
export function nextReminderRow(reminder: Reminder, count: number): number | null {
  if (!reminder.active || reminder.every_n < 1) return null
  if (isReminderDue(reminder, count)) return null
  if (count < reminder.offset) return reminder.offset

  const since = count - reminder.offset
  const stepsDone = Math.floor(since / reminder.every_n)
  return reminder.offset + (stepsDone + 1) * reminder.every_n
}

export function dueReminders(reminders: Reminder[], count: number): Reminder[] {
  return reminders.filter((reminder) => isReminderDue(reminder, count))
}
