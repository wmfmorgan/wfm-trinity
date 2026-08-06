import 'fake-indexeddb/auto'
import { describe, it, expect, beforeEach } from 'vitest'
import { deleteDB } from 'idb'
import {
  putSave,
  getSave,
  listSaves,
  deleteSave,
  getLatestAutosave,
  type SaveRecord,
} from './saveRepo'
import type { MapGraphState } from '../domain/types'
import { DB_NAME, closeDb } from './db'

async function resetDb() {
  await closeDb()
  await deleteDB(DB_NAME)
}

function makeMap(gameId: string): MapGraphState {
  return { gameId, nodes: {}, edges: [] }
}

function makeSave(
  gameId: string,
  slotId: string,
  overrides: Partial<SaveRecord> = {},
): SaveRecord {
  return {
    gameId,
    slotId,
    name: slotId,
    updatedAt: Date.now(),
    locationName: 'West of House',
    zmachineSave: new TextEncoder().encode(`save-${slotId}`).buffer,
    shell: { map: makeMap(gameId), history: ['look', 'n'] },
    ...overrides,
  }
}

describe('saveRepo', () => {
  beforeEach(async () => {
    await resetDb()
  })

  it('puts, gets, and lists saves per game', async () => {
    const gameA = 'game-a'
    const gameB = 'game-b'

    await putSave(makeSave(gameA, 'slot-1', { name: 'Start', updatedAt: 10 }))
    await putSave(makeSave(gameA, 'slot-2', { name: 'Later', updatedAt: 20 }))
    await putSave(makeSave(gameB, 'slot-1', { name: 'Other', updatedAt: 30 }))

    const got = await getSave(gameA, 'slot-1')
    expect(got?.name).toBe('Start')
    expect(got?.locationName).toBe('West of House')
    expect(got?.shell.history).toEqual(['look', 'n'])
    expect(new TextDecoder().decode(got!.zmachineSave)).toBe('save-slot-1')

    const listA = await listSaves(gameA)
    expect(listA).toHaveLength(2)
    expect(listA.map((s) => s.slotId).sort()).toEqual(['slot-1', 'slot-2'])
    expect(listA.every((s) => s.gameId === gameA)).toBe(true)
    // list returns SaveSlotMeta (no payload)
    expect(listA[0]).not.toHaveProperty('zmachineSave')
    expect(listA[0]).not.toHaveProperty('shell')

    const listB = await listSaves(gameB)
    expect(listB).toHaveLength(1)
    expect(listB[0].name).toBe('Other')
  })

  it('deletes a save slot', async () => {
    const gameId = 'game-del'
    await putSave(makeSave(gameId, 'keep'))
    await putSave(makeSave(gameId, 'drop'))
    await deleteSave(gameId, 'drop')

    expect(await getSave(gameId, 'drop')).toBeUndefined()
    expect(await getSave(gameId, 'keep')).toBeDefined()
    expect(await listSaves(gameId)).toHaveLength(1)
  })

  it('prefers primary autosave slot for Continue', async () => {
    const gameId = 'game-auto'
    await putSave(
      makeSave(gameId, 'autosave', { name: 'Autosave', updatedAt: 100 }),
    )
    await putSave(
      makeSave(gameId, 'autosave-room-0', {
        name: 'Room: Woods',
        updatedAt: 300,
      }),
    )
    await putSave(
      makeSave(gameId, 'manual', { name: 'Manual', updatedAt: 999 }),
    )

    // Continue always uses the dedicated latest slot when present
    const latest = await getLatestAutosave(gameId)
    expect(latest?.slotId).toBe('autosave')
    expect(latest?.updatedAt).toBe(100)

    // Without primary, fall back to newest autosave-family slot
    await deleteSave(gameId, 'autosave')
    const fallback = await getLatestAutosave(gameId)
    expect(fallback?.slotId).toBe('autosave-room-0')

    expect(await getLatestAutosave('missing')).toBeUndefined()
  })
})

