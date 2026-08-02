import 'fake-indexeddb/auto'
import { describe, it, expect, beforeEach } from 'vitest'
import { deleteDB } from 'idb'
import {
  putGame,
  listGames,
  getGame,
  getStoryBytes,
  deleteGameCascade,
  putCover,
  getCover,
  updateMetadata,
  touchLastPlayed,
} from './libraryRepo'
import { putSave, listSaves } from './saveRepo'
import { putMap, getMap } from './mapRepo'
import { putFeelie, listFeelies } from './feeliesRepo'
import { hashStoryBytes } from '../domain/gameId'
import { DB_NAME, closeDb } from './db'
import { blobToText } from './blobUtil'
import type { MapGraphState } from '../domain/types'

async function resetDb() {
  await closeDb()
  await deleteDB(DB_NAME)
}

describe('libraryRepo', () => {
  beforeEach(async () => {
    await resetDb()
  })

  it('stores and lists a game', async () => {
    const bytes = new TextEncoder().encode('fake-z-story').buffer
    const gameId = await hashStoryBytes(bytes)
    await putGame(
      {
        gameId,
        fileName: 'test.z5',
        importedAt: Date.now(),
        metadata: { title: 'Test' },
        hasCover: false,
      },
      bytes,
    )
    const list = await listGames()
    expect(list.some((g) => g.gameId === gameId)).toBe(true)
    const round = await getStoryBytes(gameId)
    expect(new Uint8Array(round!)[0]).toBe(new Uint8Array(bytes)[0])
    await deleteGameCascade(gameId)
    expect(await listGames()).toHaveLength(0)
  })

  it('gets a single game and updates metadata / lastPlayed', async () => {
    const bytes = new TextEncoder().encode('meta-game').buffer
    const gameId = await hashStoryBytes(bytes)
    await putGame(
      {
        gameId,
        fileName: 'meta.z5',
        importedAt: 1000,
        metadata: { title: 'Meta' },
        hasCover: false,
      },
      bytes,
    )

    const game = await getGame(gameId)
    expect(game?.metadata.title).toBe('Meta')

    await updateMetadata(gameId, { title: 'Updated', author: 'Infocom' })
    expect((await getGame(gameId))?.metadata).toEqual({
      title: 'Updated',
      author: 'Infocom',
    })

    await touchLastPlayed(gameId, 9999)
    expect((await getGame(gameId))?.lastPlayedAt).toBe(9999)
  })

  it('stores and retrieves cover images', async () => {
    const bytes = new TextEncoder().encode('cover-game').buffer
    const gameId = await hashStoryBytes(bytes)
    await putGame(
      {
        gameId,
        fileName: 'cover.z5',
        importedAt: 1,
        metadata: { title: 'Cover' },
        hasCover: false,
      },
      bytes,
    )

    const blob = new Blob(['png-bytes'], { type: 'image/png' })
    await putCover(gameId, blob)

    const game = await getGame(gameId)
    expect(game?.hasCover).toBe(true)

    const cover = await getCover(gameId)
    expect(cover).toBeInstanceOf(Blob)
    expect(await blobToText(cover!)).toBe('png-bytes')
  })

  it('deleteGameCascade removes story, cover, saves, map, and feelies', async () => {
    const bytes = new TextEncoder().encode('cascade-game').buffer
    const gameId = await hashStoryBytes(bytes)
    await putGame(
      {
        gameId,
        fileName: 'cascade.z5',
        importedAt: 1,
        metadata: { title: 'Cascade' },
        hasCover: false,
      },
      bytes,
    )

    await putCover(gameId, new Blob(['c'], { type: 'image/png' }))

    const emptyMap: MapGraphState = { gameId, nodes: {}, edges: [] }
    await putMap(emptyMap)
    await putSave({
      gameId,
      slotId: 'slot-1',
      name: 'Manual',
      updatedAt: 1,
      zmachineSave: new ArrayBuffer(4),
      shell: { map: emptyMap, history: [] },
    })
    await putFeelie(
      {
        id: 'feelie-1',
        gameId,
        name: 'map.pdf',
        mime: 'application/pdf',
        addedAt: 1,
      },
      new Blob(['pdf']),
    )

    // other game stays isolated
    const otherBytes = new TextEncoder().encode('other-game').buffer
    const otherId = await hashStoryBytes(otherBytes)
    await putGame(
      {
        gameId: otherId,
        fileName: 'other.z5',
        importedAt: 1,
        metadata: { title: 'Other' },
        hasCover: false,
      },
      otherBytes,
    )

    await deleteGameCascade(gameId)

    expect(await getGame(gameId)).toBeUndefined()
    expect(await getStoryBytes(gameId)).toBeUndefined()
    expect(await getCover(gameId)).toBeUndefined()
    expect(await getMap(gameId)).toBeUndefined()
    expect(await listSaves(gameId)).toHaveLength(0)
    expect(await listFeelies(gameId)).toHaveLength(0)
    expect(await getGame(otherId)).toBeDefined()
    expect(await getStoryBytes(otherId)).toBeDefined()
  })
})
