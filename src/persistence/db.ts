import { openDB, type DBSchema, type IDBPDatabase } from 'idb'
import type { LibraryGame, MapGraphState } from '../domain/types'
import type { SaveRecord } from './saveRepo'
import type { FeelieMeta } from './feeliesRepo'

export const DB_NAME = 'infocom-workbench'
export const DB_VERSION = 1

export interface WorkbenchDB extends DBSchema {
  games: {
    key: string
    value: LibraryGame
  }
  storyBytes: {
    key: string
    value: ArrayBuffer
  }
  covers: {
    key: string
    /** Stored as bytes + mime so structured-clone is reliable (fake-idb / Safari). */
    value: { mime: string; data: ArrayBuffer }
  }
  saves: {
    key: [string, string] // [gameId, slotId]
    value: SaveRecord
    indexes: { 'by-gameId': string }
  }
  maps: {
    key: string
    value: MapGraphState
  }
  feelies: {
    key: string // feelie id
    value: FeelieMeta & { mime: string; data: ArrayBuffer }
    indexes: { 'by-gameId': string }
  }
}

let dbPromise: Promise<IDBPDatabase<WorkbenchDB>> | null = null

export async function openDb(): Promise<IDBPDatabase<WorkbenchDB>> {
  if (!dbPromise) {
    dbPromise = openDB<WorkbenchDB>(DB_NAME, DB_VERSION, {
      upgrade(db) {
        if (!db.objectStoreNames.contains('games')) {
          db.createObjectStore('games', { keyPath: 'gameId' })
        }
        if (!db.objectStoreNames.contains('storyBytes')) {
          db.createObjectStore('storyBytes')
        }
        if (!db.objectStoreNames.contains('covers')) {
          db.createObjectStore('covers')
        }
        if (!db.objectStoreNames.contains('saves')) {
          const saves = db.createObjectStore('saves', {
            keyPath: ['gameId', 'slotId'],
          })
          saves.createIndex('by-gameId', 'gameId')
        }
        if (!db.objectStoreNames.contains('maps')) {
          db.createObjectStore('maps', { keyPath: 'gameId' })
        }
        if (!db.objectStoreNames.contains('feelies')) {
          const feelies = db.createObjectStore('feelies', { keyPath: 'id' })
          feelies.createIndex('by-gameId', 'gameId')
        }
      },
      blocking() {
        // Allow version upgrades / deleteDB by closing our connection.
        void closeDb()
      },
    })
  }
  return dbPromise
}

/** Close and drop the cached connection (for tests / deleteDB). */
export async function closeDb(): Promise<void> {
  if (!dbPromise) return
  try {
    const db = await dbPromise
    db.close()
  } catch {
    // ignore open failures
  } finally {
    dbPromise = null
  }
}
