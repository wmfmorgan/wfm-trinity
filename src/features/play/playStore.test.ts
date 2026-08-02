import 'fake-indexeddb/auto'
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { deleteDB } from 'idb'
import { DB_NAME, closeDb } from '../../persistence/db'
import { putGame } from '../../persistence/libraryRepo'
import { getSave, getLatestAutosave } from '../../persistence/saveRepo'
import { hashStoryBytes } from '../../domain/gameId'
import * as saveService from '../saves/saveService'
import {
  getPlayAdapterKind,
  setPlayAdapterKind,
  usePlayStore,
} from './playStore'

async function resetDb() {
  await closeDb()
  await deleteDB(DB_NAME)
}

function resetStore() {
  usePlayStore.setState({
    screen: 'library',
    session: null,
    adapter: null,
    error: null,
    pendingInsert: null,
    pendingInsertId: 0,
  })
}

async function seedGame(
  contents: string,
  fileName = 'test.z5',
): Promise<string> {
  const bytes = new TextEncoder().encode(contents).buffer
  const gameId = await hashStoryBytes(bytes)
  await putGame(
    {
      gameId,
      fileName,
      importedAt: Date.now(),
      metadata: { title: fileName.replace(/\.[^.]+$/, '') },
      hasCover: false,
    },
    bytes,
  )
  return gameId
}

describe('playStore', () => {
  const previousKind = getPlayAdapterKind()

  beforeEach(async () => {
    await resetDb()
    resetStore()
    setPlayAdapterKind('mock')
  })

  afterEach(() => {
    setPlayAdapterKind(previousKind)
    vi.restoreAllMocks()
  })

  it('openGame new starts session at meadow with mock adapter', async () => {
    const gameId = await seedGame('play-new')
    await usePlayStore.getState().openGame(gameId, 'new')

    const state = usePlayStore.getState()
    expect(state.error).toBeNull()
    expect(state.screen).toBe('play')
    expect(state.adapter).not.toBeNull()
    expect(state.session).not.toBeNull()
    expect(state.session!.gameId).toBe(gameId)
    expect(state.session!.snapshot.location.id).toBe('meadow')
    expect(state.session!.map.nodes['meadow']).toBeTruthy()
    expect(state.session!.history).toEqual([])
  })

  it('openGame continue fails with error when no autosave', async () => {
    const gameId = await seedGame('no-auto')
    await usePlayStore.getState().openGame(gameId, 'continue')

    const state = usePlayStore.getState()
    expect(state.screen).toBe('library')
    expect(state.session).toBeNull()
    expect(state.error).toMatch(/no autosave/i)
  })

  it('openGame continue restores from latest autosave', async () => {
    const gameId = await seedGame('with-auto')
    await usePlayStore.getState().openGame(gameId, 'new')
    await usePlayStore.getState().submit('north')

    // Ensure autosave written
    const auto = await getLatestAutosave(gameId)
    expect(auto).toBeDefined()
    expect(auto!.locationName).toBe('Woods')

    usePlayStore.getState().returnToLibrary()
    expect(usePlayStore.getState().screen).toBe('library')

    await usePlayStore.getState().openGame(gameId, 'continue')
    const state = usePlayStore.getState()
    expect(state.error).toBeNull()
    expect(state.screen).toBe('play')
    expect(state.session!.snapshot.location.id).toBe('woods')
    expect(state.session!.history).toEqual(['north'])
    expect(state.session!.map.nodes['woods']).toBeTruthy()
  })

  it('openGame with slotId loads that slot', async () => {
    const gameId = await seedGame('slot-load')
    await usePlayStore.getState().openGame(gameId, 'new')
    await usePlayStore.getState().submit('north')

    // Manual slot via saveService
    const { session, adapter } = usePlayStore.getState()
    await saveService.saveSlot(session!, adapter!, 'manual-1', 'Checkpoint')

    usePlayStore.getState().returnToLibrary()
    await usePlayStore.getState().openGame(gameId, { slotId: 'manual-1' })

    const state = usePlayStore.getState()
    expect(state.session!.snapshot.location.id).toBe('woods')
    expect(state.session!.history).toEqual(['north'])
  })

  it('submit updates session and writes autosave', async () => {
    const gameId = await seedGame('submit-auto')
    await usePlayStore.getState().openGame(gameId, 'new')
    await usePlayStore.getState().submit('north')

    const state = usePlayStore.getState()
    expect(state.session!.snapshot.location.id).toBe('woods')
    expect(state.session!.history).toEqual(['north'])
    expect(state.session!.turn).toBe(1)

    const record = await getSave(gameId, 'autosave')
    expect(record).toBeDefined()
    expect(record!.name).toBe('Autosave')
    expect(record!.shell.history).toEqual(['north'])
  })

  it('submit soft-fails autosave without losing session', async () => {
    const gameId = await seedGame('soft-auto')
    await usePlayStore.getState().openGame(gameId, 'new')

    vi.spyOn(saveService, 'autosave').mockRejectedValueOnce(
      new Error('quota exceeded'),
    )

    await usePlayStore.getState().submit('look')

    const state = usePlayStore.getState()
    expect(state.session!.history).toEqual(['look'])
    expect(state.screen).toBe('play')
    expect(state.error).toMatch(/autosave failed/i)
    expect(state.error).toMatch(/quota exceeded/i)
  })

  it('selectMapRoom updates selectedRoomId', async () => {
    const gameId = await seedGame('select-room')
    await usePlayStore.getState().openGame(gameId, 'new')
    await usePlayStore.getState().submit('north')

    usePlayStore.getState().selectMapRoom('meadow')
    expect(usePlayStore.getState().session!.selectedRoomId).toBe('meadow')

    usePlayStore.getState().selectMapRoom(null)
    expect(usePlayStore.getState().session!.selectedRoomId).toBeNull()
  })

  it('returnToLibrary clears session and adapter', async () => {
    const gameId = await seedGame('return')
    await usePlayStore.getState().openGame(gameId, 'new')
    usePlayStore.getState().returnToLibrary()

    const state = usePlayStore.getState()
    expect(state.screen).toBe('library')
    expect(state.session).toBeNull()
    expect(state.adapter).toBeNull()
    expect(state.error).toBeNull()
  })

  it('openGame missing game sets error', async () => {
    await usePlayStore.getState().openGame('does-not-exist', 'new')
    const state = usePlayStore.getState()
    expect(state.screen).toBe('library')
    expect(state.error).toMatch(/not found/i)
  })

  it('saveToSlot writes manual named slot', async () => {
    const gameId = await seedGame('manual-save')
    await usePlayStore.getState().openGame(gameId, 'new')
    await usePlayStore.getState().submit('north')

    await usePlayStore.getState().saveToSlot('slot-1', 'Checkpoint')

    const record = await getSave(gameId, 'slot-1')
    expect(record).toBeDefined()
    expect(record!.name).toBe('Checkpoint')
    expect(record!.locationName).toBe('Woods')
  })

  it('flushAutosave writes autosave without throwing when no session', async () => {
    await expect(
      usePlayStore.getState().flushAutosave(),
    ).resolves.toBeUndefined()

    const gameId = await seedGame('flush-auto')
    await usePlayStore.getState().openGame(gameId, 'new')
    await usePlayStore.getState().submit('look')

    await usePlayStore.getState().flushAutosave()
    const record = await getSave(gameId, 'autosave')
    expect(record).toBeDefined()
  })
})
