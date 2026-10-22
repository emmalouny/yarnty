import { useState } from 'react'
import { SectionCounter } from './SectionCounter'
import type { Project, Reminder, Section } from '../domain/types'

type Props = {
  project: Project
  sections: Section[]
  activeSectionId: string | null
  remindersForActive: Reminder[]
  onSelectSection: (id: string) => void
  onAddSection: (input: { name: string; target: number | null }) => void
  onDeleteSection: (id: string) => void
  onIncrement: () => void
  onDecrement: () => void
  onSet: (value: number) => void
  onAddReminder: (input: { every_n: number; offset: number; message: string }) => void
  onDeleteReminder: (id: string) => void
  onDeleteProject: () => void
  onBack: () => void
}

export function ProjectView(props: Props) {
  const {
    project,
    sections,
    activeSectionId,
    remindersForActive,
    onSelectSection,
    onAddSection,
    onDeleteSection,
    onAddReminder,
    onDeleteReminder,
    onDeleteProject,
    onBack,
  } = props

  const active = sections.find((section) => section.id === activeSectionId) ?? null
  const [addingSection, setAddingSection] = useState(sections.length === 0)
  const [addingReminder, setAddingReminder] = useState(false)
  const [confirmingDelete, setConfirmingDelete] = useState(false)

  return (
    <section className="panel">
      <button className="link-button back" onClick={onBack}>
        ← All projects
      </button>

      <h2 className="panel-title">{project.title}</h2>
      {project.yarn_notes && <p className="muted">{project.yarn_notes}</p>}

      {active && (
        <SectionCounter
          section={active}
          reminders={remindersForActive}
          onIncrement={props.onIncrement}
          onDecrement={props.onDecrement}
          onSet={props.onSet}
        />
      )}

      {sections.length > 1 && (
        <ul className="section-switcher">
          {sections.map((section) => (
            <li key={section.id}>
              <button
                className={section.id === activeSectionId ? 'chip active' : 'chip'}
                onClick={() => onSelectSection(section.id)}
              >
                {section.name}
                <span className="chip-count">{section.count}</span>
              </button>
            </li>
          ))}
        </ul>
      )}

      {active && (
        <div className="sub-panel">
          <h3 className="sub-title">Reminders on {active.name}</h3>

          {remindersForActive.length === 0 && !addingReminder && (
            <p className="muted">
              No reminders. Add one for a repeat you keep losing your place in —
              decreases, cable rows, buttonholes.
            </p>
          )}

          {remindersForActive.length > 0 && (
            <ul className="reminder-list">
              {remindersForActive.map((reminder) => (
                <li key={reminder.id}>
                  <span>
                    {reminder.message} — every {reminder.every_n}
                    {reminder.every_n === 1 ? ' row' : ' rows'} from row {reminder.offset}
                  </span>
                  <button className="link-button" onClick={() => onDeleteReminder(reminder.id)}>
                    Remove
                  </button>
                </li>
              ))}
            </ul>
          )}

          {addingReminder ? (
            <ReminderForm
              onCancel={() => setAddingReminder(false)}
              onSubmit={(input) => {
                onAddReminder(input)
                setAddingReminder(false)
              }}
            />
          ) : (
            <button className="btn small" onClick={() => setAddingReminder(true)}>
              Add reminder
            </button>
          )}
        </div>
      )}

      <div className="sub-panel">
        <h3 className="sub-title">Sections</h3>

        {sections.length > 0 && (
          <ul className="reminder-list">
            {sections.map((section) => (
              <li key={section.id}>
                <span>
                  {section.name} — {section.count}
                  {section.target ? ` of ${section.target}` : ''} rows
                </span>
                {sections.length > 1 && (
                  <button className="link-button" onClick={() => onDeleteSection(section.id)}>
                    Remove
                  </button>
                )}
              </li>
            ))}
          </ul>
        )}

        {addingSection ? (
          <SectionForm
            onCancel={() => setAddingSection(false)}
            onSubmit={(input) => {
              onAddSection(input)
              setAddingSection(false)
            }}
          />
        ) : (
          <button className="btn small" onClick={() => setAddingSection(true)}>
            Add section
          </button>
        )}
      </div>

      <div className="danger">
        {confirmingDelete ? (
          <div className="form-actions">
            <button className="btn danger-btn" onClick={onDeleteProject}>
              Delete “{project.title}” for good
            </button>
            <button className="link-button" onClick={() => setConfirmingDelete(false)}>
              Keep it
            </button>
          </div>
        ) : (
          <button className="link-button" onClick={() => setConfirmingDelete(true)}>
            Delete project
          </button>
        )}
      </div>
    </section>
  )
}

function SectionForm({
  onSubmit,
  onCancel,
}: {
  onSubmit: (input: { name: string; target: number | null }) => void
  onCancel: () => void
}) {
  const [name, setName] = useState('')
  const [target, setTarget] = useState('')

  return (
    <form
      className="stacked-form"
      onSubmit={(event) => {
        event.preventDefault()
        if (!name.trim()) return
        const parsed = Number.parseInt(target, 10)
        onSubmit({ name, target: Number.isFinite(parsed) && parsed > 0 ? parsed : null })
      }}
    >
      <label htmlFor="section-name">Section name</label>
      <input
        id="section-name"
        value={name}
        autoFocus
        placeholder="Body, Sleeve 1, Yoke"
        onChange={(event) => setName(event.target.value)}
      />

      <label htmlFor="section-target">Rows to work (optional)</label>
      <input
        id="section-target"
        type="number"
        inputMode="numeric"
        min={1}
        value={target}
        placeholder="84"
        onChange={(event) => setTarget(event.target.value)}
      />

      <div className="form-actions">
        <button type="submit" className="btn small" disabled={!name.trim()}>
          Add
        </button>
        <button type="button" className="link-button" onClick={onCancel}>
          Cancel
        </button>
      </div>
    </form>
  )
}

function ReminderForm({
  onSubmit,
  onCancel,
}: {
  onSubmit: (input: { every_n: number; offset: number; message: string }) => void
  onCancel: () => void
}) {
  const [message, setMessage] = useState('')
  const [everyN, setEveryN] = useState('6')
  const [offset, setOffset] = useState('12')

  const everyNumber = Number.parseInt(everyN, 10)
  const offsetNumber = Number.parseInt(offset, 10)
  const valid = message.trim() !== '' && everyNumber >= 1 && offsetNumber >= 0

  return (
    <form
      className="stacked-form"
      onSubmit={(event) => {
        event.preventDefault()
        if (!valid) return
        onSubmit({ every_n: everyNumber, offset: offsetNumber, message })
      }}
    >
      <label htmlFor="reminder-message">Remind me to…</label>
      <input
        id="reminder-message"
        value={message}
        autoFocus
        placeholder="Decrease"
        onChange={(event) => setMessage(event.target.value)}
      />

      <div className="field-row">
        <div>
          <label htmlFor="reminder-every">Every</label>
          <input
            id="reminder-every"
            type="number"
            inputMode="numeric"
            min={1}
            value={everyN}
            onChange={(event) => setEveryN(event.target.value)}
          />
          <span className="field-suffix">rows</span>
        </div>
        <div>
          <label htmlFor="reminder-offset">Starting at row</label>
          <input
            id="reminder-offset"
            type="number"
            inputMode="numeric"
            min={0}
            value={offset}
            onChange={(event) => setOffset(event.target.value)}
          />
        </div>
      </div>

      <div className="form-actions">
        <button type="submit" className="btn small" disabled={!valid}>
          Add reminder
        </button>
        <button type="button" className="link-button" onClick={onCancel}>
          Cancel
        </button>
      </div>
    </form>
  )
}
