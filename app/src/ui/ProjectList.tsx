import { useState } from 'react'
import type { Project } from '../domain/types'

export type ProjectSummary = {
  project: Project
  sectionCount: number
  totalRows: number
}

type Props = {
  summaries: ProjectSummary[]
  onOpen: (id: string) => void
  onCreate: (input: { title: string; yarn_notes: string }) => void
}

export function ProjectList({ summaries, onOpen, onCreate }: Props) {
  const [adding, setAdding] = useState(false)
  const [title, setTitle] = useState('')
  const [yarnNotes, setYarnNotes] = useState('')

  function submit(event: React.FormEvent) {
    event.preventDefault()
    if (!title.trim()) return
    onCreate({ title, yarn_notes: yarnNotes })
    setTitle('')
    setYarnNotes('')
    setAdding(false)
  }

  return (
    <section className="panel">
      <h2 className="panel-title">Your projects</h2>

      {summaries.length === 0 && !adding && (
        <p className="muted">
          Nothing on the needles yet. Start a project and YarnTŷ will keep count,
          with or without signal.
        </p>
      )}

      {summaries.length > 0 && (
        <ul className="project-list">
          {summaries.map(({ project, sectionCount, totalRows }) => (
            <li key={project.id}>
              <button className="project-card" onClick={() => onOpen(project.id)}>
                <span className="project-title">{project.title}</span>
                <span className="project-meta">
                  {sectionCount === 0
                    ? 'No sections yet'
                    : `${sectionCount} ${sectionCount === 1 ? 'section' : 'sections'} · ${totalRows} ${totalRows === 1 ? 'row' : 'rows'}`}
                </span>
                {project.yarn_notes && <span className="project-yarn">{project.yarn_notes}</span>}
              </button>
            </li>
          ))}
        </ul>
      )}

      {adding ? (
        <form className="stacked-form" onSubmit={submit}>
          <label htmlFor="project-title">What are you making?</label>
          <input
            id="project-title"
            value={title}
            autoFocus
            placeholder="Raglan cardigan"
            onChange={(event) => setTitle(event.target.value)}
          />

          <label htmlFor="project-yarn">Yarn (optional)</label>
          <input
            id="project-yarn"
            value={yarnNotes}
            placeholder="Drops Paris, 4 balls, dye lot 4472"
            onChange={(event) => setYarnNotes(event.target.value)}
          />

          <div className="form-actions">
            <button type="submit" className="btn" disabled={!title.trim()}>
              Start project
            </button>
            <button type="button" className="link-button" onClick={() => setAdding(false)}>
              Cancel
            </button>
          </div>
        </form>
      ) : (
        <button className="btn" onClick={() => setAdding(true)}>
          New project
        </button>
      )}
    </section>
  )
}
