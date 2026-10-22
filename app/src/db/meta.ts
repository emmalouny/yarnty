import { STORES } from './schema'
import { request, transactionDone } from './request'

/**
 * The meta store is small key/value bookkeeping -- schema notes, and later
 * the sync cursor. It is NOT where product data lives.
 */

export async function getMeta<T>(db: IDBDatabase, key: string): Promise<T | undefined> {
  const tx = db.transaction(STORES.meta, 'readonly')
  const row = await request<{ key: string; value: T } | undefined>(
    tx.objectStore(STORES.meta).get(key),
  )
  return row?.value
}

export async function setMeta<T>(db: IDBDatabase, key: string, value: T): Promise<void> {
  const tx = db.transaction(STORES.meta, 'readwrite')
  tx.objectStore(STORES.meta).put({ key, value })
  await transactionDone(tx)
}
