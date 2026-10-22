import { useCallback, useEffect, useState } from 'react'
import { getDatabase } from './db'
import {
  decrementSection,
  incrementSection,
  setSectionCount,
} from './domain/counters'
import {
  addReminder,
  addSection,
  createProject,
  deleteProject,
  deleteReminder,
  deleteSection,
  listProjects,
  listReminders,
  listSections,
} from './domain/projects'
import type { Project, Reminder, Section } from './domain/types'
import { ProjectList, type ProjectSummary } from './ui/ProjectList'
import { ProjectView } from './ui/ProjectView'
import { SocialLinks } from './SocialLinks'
import { useOnline } from './useOnline'
import { useRoute } from './useRoute'

type Data = {
  summaries: ProjectSummary[]
  project: Project | null
  sections: Section[]
  reminders: Reminder[]
}

const EMPTY: Data = { summaries: [], project: null, sections: [], reminders: [] }

export function App() {
  const { route, navigate } = useRoute()
  const online = useOnline()

  const [db, setDb] = useState<IDBDatabase | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [data, setData] = useState<Data>(EMPTY)
  const [activeSectionId, setActiveSectionId] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    getDatabase()
      .then((opened) => {
        if (!cancelled) setDb(opened)
      })
      .catch((cause: unknown) => {
        if (!cancelled) setError(cause instanceof Error ? cause.message : String(cause))
      })
    return () => {
      cancelled = true
    }
  }, [])

  /**
   * Reloads everything the current screen needs. Deliberately simple —
   * at this size, re-reading is cheaper to reason about than keeping a
   * cache in sync, and reasoning about it is the scarce resource here.
   */
  const reload = useCallback(
    async (sectionIdHint?: string | null) => {
      if (!db) return

      const projects = await listProjects(db)
      const summaries: ProjectSummary[] = []
      for (const project of projects) {
        const sections = await listSections(db, project.id)
        summaries.push({
          project,
          sectionCount: sections.length,
          totalRows: sections.reduce((sum, section) => sum + section.count, 0),
        })
      }

      if (route.name !== 'project') {
        setData({ summaries, project: null, sections: [], reminders: [] })
        return
      }

      const project = projects.find((candidate) => candidate.id === route.id) ?? null
      if (!project) {
        setData({ summaries, project: null, sections: [], reminders: [] })
        return
      }

      const sections = await listSections(db, project.id)
      const chosen =
        sectionIdHint !== undefined
          ? sectionIdHint
          : sections.some((section) => section.id === activeSectionId)
            ? activeSectionId
            : (sections[0]?.id ?? null)

      const reminders = chosen ? await listReminders(db, chosen) : []
      setActiveSectionId(chosen)
      setData({ summaries, project, sections, reminders })
    },
    [db, route, activeSectionId],
  )

  useEffect(() => {
    void reload()
    // reload is recreated when db or route change, which is exactly when a
    // reload is wanted. activeSectionId is handled inside.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [db, route])

  const withDb = (run: (database: IDBDatabase) => Promise<unknown>) => async () => {
    if (!db) return
    await run(db)
    await reload()
  }

  if (error) {
    return (
      <Shell online={online} onHome={() => navigate('/')}>
        <p className="error" role="alert">
          Something went wrong starting up: {error}
        </p>
      </Shell>
    )
  }

  if (!db) {
    return (
      <Shell online={online} onHome={() => navigate('/')}>
        <p className="muted" aria-busy="true">
          Loading…
        </p>
      </Shell>
    )
  }

  if (route.name === 'project' && data.project) {
    const { project } = data
    return (
      <Shell online={online} onHome={() => navigate('/')}>
        <ProjectView
          project={project}
          sections={data.sections}
          activeSectionId={activeSectionId}
          remindersForActive={data.reminders}
          onBack={() => navigate('/')}
          onSelectSection={(id) => {
            setActiveSectionId(id)
            void reload(id)
          }}
          onAddSection={async (input) => {
            const section = await addSection(db, {
              projectId: project.id,
              name: input.name,
              target: input.target,
            })
            await reload(section.id)
          }}
          onDeleteSection={async (id) => {
            await deleteSection(db, id)
            await reload(null)
          }}
          onIncrement={withDb((database) =>
            activeSectionId ? incrementSection(database, activeSectionId) : Promise.resolve(),
          )}
          onDecrement={withDb((database) =>
            activeSectionId ? decrementSection(database, activeSectionId) : Promise.resolve(),
          )}
          onSet={async (value) => {
            if (!activeSectionId) return
            await setSectionCount(db, activeSectionId, value)
            await reload()
          }}
          onAddReminder={async (input) => {
            if (!activeSectionId) return
            await addReminder(db, { sectionId: activeSectionId, ...input })
            await reload()
          }}
          onDeleteReminder={async (id) => {
            await deleteReminder(db, id)
            await reload()
          }}
          onDeleteProject={async () => {
            await deleteProject(db, project.id)
            navigate('/')
          }}
        />
      </Shell>
    )
  }

  return (
    <Shell online={online} onHome={() => navigate('/')} showIntro={data.summaries.length === 0}>
      <ProjectList
        summaries={data.summaries}
        onOpen={(id) => navigate(`/project/${id}`)}
        onCreate={async (input) => {
          const project = await createProject(db, input)
          navigate(`/project/${project.id}`)
        }}
      />
    </Shell>
  )
}

function Shell({
  children,
  online,
  onHome,
  showIntro = false,
}: {
  children: React.ReactNode
  online: boolean
  onHome: () => void
  showIntro?: boolean
}) {
  return (
    <div className="app">
      <header className="app-header">
        <button className="lockup" onClick={onHome} aria-label="YarnTŷ home">
          <img className="icon" src="/icon.svg" alt="" width="40" height="40" />
          <span className="wordmark">YarnTŷ</span>
        </button>
      </header>

      {showIntro && (
        <p className="tagline">
          A knitting and crochet project tracker that works without signal.
        </p>
      )}

      <main className="app-main">{children}</main>

      <footer className="app-footer">
        <p className="status">
          <span className={online ? 'dot online' : 'dot offline'} aria-hidden="true" />
          <span>{online ? 'Saved on this device' : 'Offline — still counting'}</span>
        </p>
        <SocialLinks />
        <p className="muted small">
          Early build, made in Wales. Add YarnTŷ to your home screen to use it anywhere.
        </p>
      </footer>
    </div>
  )
}
