import { openDb, type RoomNoteRecord } from './db'

export type { RoomNoteRecord }

export async function getRoomNote(
  gameId: string,
  roomId: string,
): Promise<RoomNoteRecord | undefined> {
  const db = await openDb()
  return db.get('roomNotes', [gameId, roomId])
}

export async function putRoomNote(
  gameId: string,
  roomId: string,
  text: string,
): Promise<RoomNoteRecord> {
  const db = await openDb()
  const record: RoomNoteRecord = {
    gameId,
    roomId,
    text,
    updatedAt: Date.now(),
  }
  await db.put('roomNotes', record)
  return record
}

export async function deleteRoomNote(
  gameId: string,
  roomId: string,
): Promise<void> {
  const db = await openDb()
  await db.delete('roomNotes', [gameId, roomId])
}

/** All room ids that have non-empty notes for a game. */
export async function listNotedRoomIds(gameId: string): Promise<string[]> {
  const db = await openDb()
  const records = await db.getAllFromIndex('roomNotes', 'by-gameId', gameId)
  return records.filter((r) => r.text.trim().length > 0).map((r) => r.roomId)
}

export async function deleteRoomNotesForGame(gameId: string): Promise<void> {
  const db = await openDb()
  const tx = db.transaction('roomNotes', 'readwrite')
  const keys = await tx.store.index('by-gameId').getAllKeys(gameId)
  await Promise.all(keys.map((key) => tx.store.delete(key)))
  await tx.done
}
