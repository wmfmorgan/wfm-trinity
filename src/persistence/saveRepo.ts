import type { MapGraphState, SaveSlotMeta } from '../domain/types'
import { openDb } from './db'

export interface SaveRecord {
  gameId: string
  slotId: string
  name: string
  updatedAt: number
  locationName?: string
  /** Engine quasistatic (IWZ2 binary or legacy IWZ1 JSON). */
  zmachineSave: ArrayBuffer
  shell: {
    map: MapGraphState
    history: string[]
    /** Optional transcript snapshot for restore continuity. */
    transcript?: string
    locationId?: string
  }
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
  // Primary continue slot, room checkpoints (autosave-room-N), and legacy autosave-*
  return slotId === 'autosave' || slotId.startsWith('autosave')
}

export async function getLatestAutosave(
  gameId: string,
): Promise<SaveRecord | undefined> {
  const db = await openDb()
  const records = await db.getAllFromIndex('saves', 'by-gameId', gameId)
  // Prefer the dedicated latest slot when present
  const primary = records.find((r) => r.slotId === 'autosave')
  if (primary) return primary
  const autosaves = records.filter((r) => isAutosaveSlot(r.slotId))
  if (autosaves.length === 0) return undefined
  return autosaves.reduce((best, cur) =>
    cur.updatedAt > best.updatedAt ? cur : best,
  )
}
