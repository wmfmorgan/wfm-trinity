import 'fake-indexeddb/auto'
import { describe, it, expect, beforeEach } from 'vitest'
import { deleteDB } from 'idb'
import { DB_NAME, closeDb } from '../../persistence/db'
import { getSave, listSaves } from '../../persistence/saveRepo'
import { createMockAdapter } from '../../zmachine/mockAdapter'
import { startNewSession, submitCommand } from '../play/gameSession'
import { autosave, saveSlot, loadSlot } from './saveService'

async function resetDb() {
  await closeDb()
  await deleteDB(DB_NAME)
}

describe('saveService', () => {
  beforeEach(async () => {
    await resetDb()
  })

  it('autosave writes slotId autosave and name Autosave', async () => {
    const adapter = createMockAdapter()
    let s = await startNewSession('game-1', new ArrayBuffer(8), adapter)
    s = await submitCommand(s, adapter, 'north')

    await autosave(s, adapter)

    const record = await getSave('game-1', 'autosave')
    expect(record).toBeDefined()
    expect(record!.name).toBe('Autosave')
    expect(record!.slotId).toBe('autosave')
    expect(record!.locationName).toBe('Woods')
    expect(record!.shell.history).toEqual(['north'])
    expect(record!.shell.map.nodes['woods']).toBeTruthy()
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
      'autosave',
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
      loadSlot('missing', 'autosave', new ArrayBuffer(8), adapter),
    ).rejects.toThrow(/no save/i)
  })

  it('overwrites autosave on subsequent calls', async () => {
    const adapter = createMockAdapter()
    let s = await startNewSession('game-3', new ArrayBuffer(8), adapter)
    await autosave(s, adapter)
    s = await submitCommand(s, adapter, 'north')
    await autosave(s, adapter)

    const list = await listSaves('game-3')
    expect(list).toHaveLength(1)
    expect(list[0].locationName).toBe('Woods')
  })
})
