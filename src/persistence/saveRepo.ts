import type { MapGraphState, SaveSlotMeta } from '../domain/types'
import { openDb } from './db'

export interface SaveRecord {
  gameId: string
  slotId: string
  name: string
  updatedAt: number
  locationName?: string
  zmachineSave: ArrayBuffer
  shell: { map: MapGraphState; history: string[] }
}

function toMeta(record: SaveRecord): SaveSlotMeta {
  return {
    gameId: record.gameId,
    slotId: record.slotId,
    name: record.name,
    updatedAt: record.updatedAt,
    locationName: record.locationName,
  }
}

export async function putSave(record: SaveRecord): Promise<void> {
  const db = await openDb()
  await db.put('saves', record)
}

export async function getSave(
  gameId: string,
  slotId: string,
): Promise<SaveRecord | undefined> {
  const db = await openDb()
  return db.get('saves', [gameId, slotId])
}

export async function listSaves(gameId: string): Promise<SaveSlotMeta[]> {
  const db = await openDb()
  const records = await db.getAllFromIndex('saves', 'by-gameId', gameId)
  return records.map(toMeta)
}

export async function deleteSave(
  gameId: string,
  slotId: string,
): Promise<void> {
  const db = await openDb()
  await db.delete('saves', [gameId, slotId])
}

function isAutosaveSlot(slotId: string): boolean {
  return slotId === 'autosave' || slotId.startsWith('autosave-')
}

export async function getLatestAutosave(
  gameId: string,
): Promise<SaveRecord | undefined> {
  const db = await openDb()
  const records = await db.getAllFromIndex('saves', 'by-gameId', gameId)
  const autosaves = records.filter((r) => isAutosaveSlot(r.slotId))
  if (autosaves.length === 0) return undefined
  return autosaves.reduce((best, cur) =>
    cur.updatedAt > best.updatedAt ? cur : best,
  )
}
