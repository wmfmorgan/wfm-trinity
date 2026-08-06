import 'fake-indexeddb/auto'
import { beforeEach, describe, expect, it } from 'vitest'
import { deleteDB } from 'idb'
import { closeDb, DB_NAME } from './db'
import {
  deleteRoomNotesForGame,
  getRoomNote,
  listNotedRoomIds,
  putRoomNote,
} from './roomNotesRepo'

async function resetDb() {
  await closeDb()
  await deleteDB(DB_NAME)
}

describe('roomNotesRepo', () => {
  beforeEach(async () => {
    await resetDb()
  })

  it('saves and loads a room note', async () => {
    await putRoomNote('g1', 'room-a', 'watch the bird')
    const rec = await getRoomNote('g1', 'room-a')
    expect(rec?.text).toBe('watch the bird')
    expect(rec?.gameId).toBe('g1')
    expect(rec?.roomId).toBe('room-a')
  })

  it('lists only non-empty noted room ids', async () => {
    await putRoomNote('g1', 'a', 'hello')
    await putRoomNote('g1', 'b', '   ')
    await putRoomNote('g1', 'c', 'world')
    await putRoomNote('g2', 'a', 'other game')
    const ids = await listNotedRoomIds('g1')
    expect(ids.sort()).toEqual(['a', 'c'])
  })

  it('deletes all notes for a game', async () => {
    await putRoomNote('g1', 'a', 'x')
    await putRoomNote('g1', 'b', 'y')
    await deleteRoomNotesForGame('g1')
    expect(await listNotedRoomIds('g1')).toEqual([])
  })
})
