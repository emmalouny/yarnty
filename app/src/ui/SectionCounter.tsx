import { useState } from 'react'
import { dueReminders, nextReminderRow } from '../domain/reminders'
import type { Reminder, Section } from '../domain/types'

type Props = {
  section: Section
  reminders: Reminder[]
  onIncrement: () => void
  onDecrement: () => void
  onSet: (value: number) => void
}

export function SectionCounter({ section, reminders, onIncrement, onDecrement, onSet }: Props) {
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState(String(section.count))

  const due = dueReminders(reminders, section.count)
  const upcoming = reminders
    .map((reminder) => ({ reminder, row: nextReminderRow(reminder, section.count) }))
    .filter((entry): entry is { reminder: Reminder; row: number } => entry.row !== null)
    .sort((a, b) => a.row - b.row)
    .slice(0, 1)

  function save(event: React.FormEvent) {
    event.preventDefault()
    const value = Number.parseInt(draft, 10)
    if (Number.isFinite(value) && value >= 0) onSet(value)
    setEditing(false)
  }

  return (
    <section className="active-section">
      <h2 className="section-name">{section.name}</h2>

      <button className="counter" onClick={onIncrement} aria-label={`Count a row on ${section.name}`}>
        <span className="counter-value">{section.count}</span>
        <span className="counter-label">
          {section.target ? `of ${section.target}` : 'tap to count rows'}
        </span>
      </button>

      {section.target !== null && (
        <div className="progress" aria-hidden="true">
          <div
            className="progress-fill"
            style={{ width: `${Math.min(100, (section.count / Math.max(1, section.target)) * 100)}%` }}
          />
        </div>
      )}

      {/*
        Below the counter, never above it. When this sat above, the banner
        appearing on the firing row shoved the tap target 60px down — so the
        one row you most need to count moves out from under your thumb.
        The slot keeps a fixed minimum height for the same reason.
      */}
      <div className="reminder-slot">
        {due.length > 0 ? (
          <div className="reminder-due" role="status">
            {due.map((reminder) => (
              <p key={reminder.id}>{reminder.message}</p>
            ))}
          </div>
        ) : (
          upcoming.map(({ reminder, row }) => (
            <p key={reminder.id} className="muted">
              Next: {reminder.message.toLowerCase()} on row {row}
            </p>
          ))
        )}
      </div>

      <div className="counter-actions">
        <button className="link-button" onClick={onDecrement} disabled={section.count === 0}>
          Undo a row
        </button>
        {!editing && (
          <button
            className="link-button"
            onClick={() => {
              setDraft(String(section.count))
              setEditing(true)
            }}
          >
            Set count
          </button>
        )}
      </div>

      {editing && (
        <form className="inline-form" onSubmit={save}>
          <label className="sr-only" htmlFor="set-count">
            Set the row count
          </label>
          <input
            id="set-count"
            type="number"
            inputMode="numeric"
            min={0}
            value={draft}
            autoFocus
            onChange={(event) => setDraft(event.target.value)}
          />
          <button type="submit" className="btn small">
            Save
          </button>
          <button type="button" className="link-button" onClick={() => setEditing(false)}>
            Cancel
          </button>
        </form>
      )}
    </section>
  )
}
