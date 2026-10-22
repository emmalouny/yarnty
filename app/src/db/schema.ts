/**
 * The local (on-device) schema.
 *
 * This file is the single source of truth for what version of the local
 * database the app expects. Bumping DB_VERSION without adding a matching
 * entry to `migrations` is a bug the migration runner will throw on.
 *
 * Why this is carefully built in week 1, before there are any features:
 * a phone can hold a week of unsynced rows. A naive local upgrade drops
 * them silently -- the exact failure mode the server-side event log exists
 * to prevent. See DECISIONS.md section 7.
 */

export const DB_NAME = 'yarnty'

/** Current expected local schema version. */
export const DB_VERSION = 3

export const STORES = {
  projects: 'projects',
  sections: 'sections',
  reminders: 'reminders',
  /** Counter events written offline, awaiting sync. Append-only. */
  pendingEvents: 'pending_events',
  /** Small key/value store: schema bookkeeping, sync cursor. */
  meta: 'meta',
} as const

export type StoreName = (typeof STORES)[keyof typeof STORES]
