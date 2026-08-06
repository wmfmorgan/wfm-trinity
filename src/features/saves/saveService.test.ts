import 'fake-indexeddb/auto'
import { describe, it, expect, beforeEach } from 'vitest'
import { deleteDB } from 'idb'
import { DB_NAME, closeDb } from '../../persistence/db'
import { getSave, listSaves } from '../../persistence/saveRepo'
import { createMockAdapter } from '../../zmachine/mockAdapter'
import { startNewSession, submitCommand } from '../play/gameSession'
import {
  AUTOSAVE_SLOT,
  ROOM_CHECKPOINT_COUNT,
  autosave,
  loadSlot,
  roomCheckpointSlotId,
  saveSlot,
} from './saveService'

async function resetDb() {
  await closeDb()
  await deleteDB(DB_NAME)
}

describe('saveService', () => {
  beforeEach(async () => {
    await resetDb()
  })

  it('autosave writes primary slot with location in the name', async () => {
    const adapter = createMockAdapter()
    let s = await startNewSession('game-1', new ArrayBuffer(8), adapter)
    s = await submitCommand(s, adapter, 'north')

    await autosave(s, adapter)

    const record = await getSave('game-1', AUTOSAVE_SLOT)
    expect(record).toBeDefined()
    expect(record!.name).toMatch(/Autosave/i)
    expect(record!.name).toMatch(/Woods/i)
    expect(record!.slotId).toBe(AUTOSAVE_SLOT)
    expect(record!.locationName).toBe('Woods')
    expect(record!.shell.history).toEqual(['north'])
    expect(record!.shell.map.nodes['woods']).toBeTruthy()
    expect(record!.shell.transcript).toBeTruthy()
    expect(record!.zmachineSave.byteLength).toBeGreaterThan(0)
  })

  it('autosave roundtrip restores location, map, and history', async () => {
    const adapter = createMockAdapter()
    let s = await startNewSession('game-rt', new ArrayBuffer(8), adapter)
    s = await submitCommand(s, adapter, 'north')
    s = await submitCommand(s, adapter, 'take lamp')

    await autosave(s, adapter)

    const adapter2 = createMockAdapter()
    const loaded = await loadSlot(
      'game-rt',
      AUTOSAVE_SLOT,
      new ArrayBuffer(8),
      adapter2,
    )

    expect(loaded.snapshot.location.id).toBe('woods')
    expect(loaded.snapshot.inventory.some((i) => i.id === 'lamp')).toBe(true)
    expect(loaded.history).toEqual(['north', 'take lamp'])
    expect(loaded.map.nodes['meadow']).toBeTruthy()
    expect(loaded.map.nodes['woods']).toBeTruthy()
    expect(loaded.gameId).toBe('game-rt')
  })

  it('saveSlot writes custom slot id and name', async () => {
    const adapter = createMockAdapter()
    let s = await startNewSession('game-2', new ArrayBuffer(8), adapter)
    s = await submitCommand(s, adapter, 'look')

    await saveSlot(s, adapter, 'slot-a', 'Before woods')

    const record = await getSave('game-2', 'slot-a')
    expect(record?.name).toBe('Before woods')
    expect(record?.locationName).toBe('Meadow')

    const list = await listSaves('game-2')
    expect(list).toHaveLength(1)
    expect(list[0].slotId).toBe('slot-a')
  })

  it('loadSlot throws when slot missing', async () => {
    const adapter = createMockAdapter()
    await expect(
      loadSlot('missing', AUTOSAVE_SLOT, new ArrayBuffer(8), adapter),
    ).rejects.toThrow(/no save/i)
  })

  it('overwrites primary autosave on subsequent calls', async () => {
    const adapter = createMockAdapter()
    let s = await startNewSession('game-3', new ArrayBuffer(8), adapter)
    await autosave(s, adapter)
    s = await submitCommand(s, adapter, 'north')
    await autosave(s, adapter)

    const primary = await getSave('game-3', AUTOSAVE_SLOT)
    expect(primary?.locationName).toBe('Woods')
  })

  it('keeps past 3 room checkpoints when roomChanged', async () => {
    const adapter = createMockAdapter()
    // meadow
    let s = await startNewSession('game-rooms', new ArrayBuffer(8), adapter)
    await autosave(s, adapter, { roomChanged: true })

    // woods
    s = await submitCommand(s, adapter, 'north')
    await autosave(s, adapter, { roomChanged: true })

    // back to meadow
    s = await submitCommand(s, adapter, 'south')
    await autosave(s, adapter, { roomChanged: true })

    // woods again
    s = await submitCommand(s, adapter, 'north')
    await autosave(s, adapter, { roomChanged: true })

    const list = await listSaves('game-rooms')
    const roomSlots = list.filter((r) =>
      r.slotId.startsWith('autosave-room-'),
    )
    expect(roomSlots.length).toBeLessThanOrEqual(ROOM_CHECKPOINT_COUNT)

    // Newest room checkpoint is woods
    const newest = await getSave('game-rooms', roomCheckpointSlotId(0))
    expect(newest?.locationName).toBe('Woods')
    expect(newest?.name).toMatch(/Room:/i)

    // Primary continue slot is also woods
    const primary = await getSave('game-rooms', AUTOSAVE_SLOT)
    expect(primary?.locationName).toBe('Woods')

    // Loading an older room checkpoint restores that location
    const older = await getSave('game-rooms', roomCheckpointSlotId(1))
    expect(older).toBeDefined()
    const adapter2 = createMockAdapter()
    const loaded = await loadSlot(
      'game-rooms',
      roomCheckpointSlotId(1),
      new ArrayBuffer(8),
      adapter2,
    )
    expect(loaded.snapshot.location.name).toBe(older!.locationName)
  })

  it('does not rotate room checkpoints when room is unchanged', async () => {
    const adapter = createMockAdapter()
    let s = await startNewSession('game-same', new ArrayBuffer(8), adapter)
    s = await submitCommand(s, adapter, 'north')
    await autosave(s, adapter, { roomChanged: true })
    s = await submitCommand(s, adapter, 'look')
    await autosave(s, adapter, { roomChanged: false })

    const list = await listSaves('game-same')
    const roomSlots = list.filter((r) =>
      r.slotId.startsWith('autosave-room-'),
    )
    expect(roomSlots).toHaveLength(1)
  })
})
