import { STORES } from '../db/schema'
import { request, transactionDone } from '../db/request'
import { newId, systemClock, type Clock } from './clock'
import type { Project, ProjectStatus, Reminder, Section } from './types'

const notDeleted = <T extends { deleted_at: string | null }>(row: T) => row.deleted_at === null

export async function listProjects(db: IDBDatabase): Promise<Project[]> {
  const tx = db.transaction(STORES.projects, 'readonly')
  const all = await request<Project[]>(tx.objectStore(STORES.projects).getAll())
  return all
    .filter(notDeleted)
    .sort((a, b) => b.updated_at.localeCompare(a.updated_at))
}

export async function getProject(db: IDBDatabase, id: string): Promise<Project | undefined> {
  const tx = db.transaction(STORES.projects, 'readonly')
  return request<Project | undefined>(tx.objectStore(STORES.projects).get(id))
}

export async function createProject(
  db: IDBDatabase,
  input: { title: string; yarn_notes?: string },
  clock: Clock = systemClock,
): Promise<Project> {
  const now = clock()
  const project: Project = {
    id: newId(),
    title: input.title.trim() || 'Untitled project',
    status: 'active',
    yarn_notes: input.yarn_notes?.trim() ?? '',
    created_at: now,
    updated_at: now,
    deleted_at: null,
  }

  const tx = db.transaction(STORES.projects, 'readwrite')
  tx.objectStore(STORES.projects).put(project)
  await transactionDone(tx)
  return project
}

export async function updateProject(
  db: IDBDatabase,
  id: string,
  changes: Partial<Pick<Project, 'title' | 'status' | 'yarn_notes'>>,
  clock: Clock = systemClock,
): Promise<Project> {
  const tx = db.transaction(STORES.projects, 'readwrite')
  const store = tx.objectStore(STORES.projects)
  const existing = await request<Project | undefined>(store.get(id))
  if (!existing) {
    tx.abort()
    throw new Error(`no project ${id}`)
  }
  const updated: Project = { ...existing, ...changes, updated_at: clock() }
  store.put(updated)
  await transactionDone(tx)
  return updated
}

export function setProjectStatus(db: IDBDatabase, id: string, status: ProjectStatus) {
  return updateProject(db, id, { status })
}

/**
 * Soft delete. The row stays so a later sync can tell the server it went,
 * rather than the server re-creating it from an older device.
 */
export async function deleteProject(
  db: IDBDatabase,
  id: string,
  clock: Clock = systemClock,
): Promise<void> {
  const now = clock()
  const tx = db.transaction([STORES.projects, STORES.sections], 'readwrite')
  const projects = tx.objectStore(STORES.projects)
  const sections = tx.objectStore(STORES.sections)

  const project = await request<Project | undefined>(projects.get(id))
  if (!project) {
    tx.abort()
    throw new Error(`no project ${id}`)
  }
  projects.put({ ...project, deleted_at: now, updated_at: now })

  const owned = await request<Section[]>(sections.index('by_project').getAll(id))
  for (const section of owned.filter(notDeleted)) {
    sections.put({ ...section, deleted_at: now, updated_at: now })
  }

  await transactionDone(tx)
}

export async function listSections(db: IDBDatabase, projectId: string): Promise<Section[]> {
  const tx = db.transaction(STORES.sections, 'readonly')
  const all = await request<Section[]>(
    tx.objectStore(STORES.sections).index('by_project').getAll(projectId),
  )
  return all.filter(notDeleted).sort((a, b) => a.position - b.position)
}

export async function getSection(db: IDBDatabase, id: string): Promise<Section | undefined> {
  const tx = db.transaction(STORES.sections, 'readonly')
  return request<Section | undefined>(tx.objectStore(STORES.sections).get(id))
}

export async function addSection(
  db: IDBDatabase,
  input: { projectId: string; name: string; target?: number | null },
  clock: Clock = systemClock,
): Promise<Section> {
  const existing = await listSections(db, input.projectId)
  const now = clock()

  const section: Section = {
    id: newId(),
    project_id: input.projectId,
    name: input.name.trim() || `Section ${existing.length + 1}`,
    position: existing.length,
    count: 0,
    target: input.target ?? null,
    created_at: now,
    updated_at: now,
    deleted_at: null,
  }

  const tx = db.transaction(STORES.sections, 'readwrite')
  tx.objectStore(STORES.sections).put(section)
  await transactionDone(tx)
  return section
}

export async function updateSection(
  db: IDBDatabase,
  id: string,
  changes: Partial<Pick<Section, 'name' | 'target'>>,
  clock: Clock = systemClock,
): Promise<Section> {
  const tx = db.transaction(STORES.sections, 'readwrite')
  const store = tx.objectStore(STORES.sections)
  const existing = await request<Section | undefined>(store.get(id))
  if (!existing) {
    tx.abort()
    throw new Error(`no section ${id}`)
  }
  const updated: Section = { ...existing, ...changes, updated_at: clock() }
  store.put(updated)
  await transactionDone(tx)
  return updated
}

export async function deleteSection(
  db: IDBDatabase,
  id: string,
  clock: Clock = systemClock,
): Promise<void> {
  const tx = db.transaction(STORES.sections, 'readwrite')
  const store = tx.objectStore(STORES.sections)
  const existing = await request<Section | undefined>(store.get(id))
  if (!existing) {
    tx.abort()
    throw new Error(`no section ${id}`)
  }
  const now = clock()
  store.put({ ...existing, deleted_at: now, updated_at: now })
  await transactionDone(tx)
}

export async function listReminders(db: IDBDatabase, sectionId: string): Promise<Reminder[]> {
  const tx = db.transaction(STORES.reminders, 'readonly')
  const all = await request<Reminder[]>(
    tx.objectStore(STORES.reminders).index('by_section').getAll(sectionId),
  )
  return all.sort((a, b) => a.offset - b.offset)
}

export async function addReminder(
  db: IDBDatabase,
  input: { sectionId: string; every_n: number; offset: number; message: string },
): Promise<Reminder> {
  const reminder: Reminder = {
    id: newId(),
    section_id: input.sectionId,
    every_n: Math.max(1, Math.floor(input.every_n)),
    offset: Math.max(0, Math.floor(input.offset)),
    message: input.message.trim() || 'Reminder',
    active: true,
  }
  const tx = db.transaction(STORES.reminders, 'readwrite')
  tx.objectStore(STORES.reminders).put(reminder)
  await transactionDone(tx)
  return reminder
}

export async function deleteReminder(db: IDBDatabase, id: string): Promise<void> {
  const tx = db.transaction(STORES.reminders, 'readwrite')
  tx.objectStore(STORES.reminders).delete(id)
  await transactionDone(tx)
}
