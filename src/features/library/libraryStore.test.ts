import 'fake-indexeddb/auto'
import { describe, it, expect, beforeEach } from 'vitest'
import { deleteDB } from 'idb'
import { DB_NAME, closeDb } from '../../persistence/db'
import { getGame, getStoryBytes, getCover } from '../../persistence/libraryRepo'
import { hashStoryBytes } from '../../domain/gameId'
import { blobToText } from '../../persistence/blobUtil'
import {
  readFileBytes,
  titleFromFileName,
  useLibraryStore,
} from './libraryStore'

async function resetDb() {
  await closeDb()
  await deleteDB(DB_NAME)
}

function resetStore() {
  useLibraryStore.setState({
    games: [],
    loading: false,
    error: null,
  })
}

function makeFile(name: string, contents: string): File {
  return new File([contents], name, { type: 'application/octet-stream' })
}

describe('titleFromFileName', () => {
  it('strips last extension', () => {
    expect(titleFromFileName('zork1.z5')).toBe('zork1')
    expect(titleFromFileName('trinity.zblorb')).toBe('trinity')
  })

  it('keeps name without extension', () => {
    expect(titleFromFileName('story')).toBe('story')
  })
})

describe('libraryStore', () => {
  beforeEach(async () => {
    await resetDb()
    resetStore()
  })

  it('refresh loads empty list', async () => {
    await useLibraryStore.getState().refresh()
    expect(useLibraryStore.getState().games).toEqual([])
    expect(useLibraryStore.getState().loading).toBe(false)
    expect(useLibraryStore.getState().error).toBeNull()
  })

  it('importFiles hashes bytes, puts game, title from filename', async () => {
    const file = makeFile('advent.z5', 'fake-z-story-bytes')
    await useLibraryStore.getState().importFiles([file])

    const { games, loading, error } = useLibraryStore.getState()
    expect(error).toBeNull()
    expect(loading).toBe(false)
    expect(games).toHaveLength(1)
    expect(games[0].metadata.title).toBe('advent')
    expect(games[0].fileName).toBe('advent.z5')

    const expectedId = await hashStoryBytes(await readFileBytes(file))
    expect(games[0].gameId).toBe(expectedId)

    const stored = await getStoryBytes(expectedId)
    expect(stored).toBeDefined()
    expect(new TextDecoder().decode(stored)).toBe('fake-z-story-bytes')
  })

  it('importFiles accepts FileList-like multiple files', async () => {
    const files = [
      makeFile('a.z3', 'story-a'),
      makeFile('b.z5', 'story-b'),
    ]
    await useLibraryStore.getState().importFiles(files)

    expect(useLibraryStore.getState().games).toHaveLength(2)
    const titles = useLibraryStore
      .getState()
      .games.map((g) => g.metadata.title)
      .sort()
    expect(titles).toEqual(['a', 'b'])
  })

  it('removeGame deletes cascade and refreshes', async () => {
    await useLibraryStore.getState().importFiles([makeFile('gone.z5', 'bye')])
    const gameId = useLibraryStore.getState().games[0].gameId

    await useLibraryStore.getState().removeGame(gameId)

    expect(useLibraryStore.getState().games).toHaveLength(0)
    expect(await getGame(gameId)).toBeUndefined()
    expect(await getStoryBytes(gameId)).toBeUndefined()
  })

  it('updateMeta writes metadata and refreshes', async () => {
    await useLibraryStore
      .getState()
      .importFiles([makeFile('meta.z5', 'meta-bytes')])
    const gameId = useLibraryStore.getState().games[0].gameId

    await useLibraryStore.getState().updateMeta(gameId, {
      title: 'Renamed',
      author: 'Infocom',
    })

    expect(useLibraryStore.getState().games[0].metadata).toEqual({
      title: 'Renamed',
      author: 'Infocom',
    })
  })

  it('setCover stores cover and sets hasCover', async () => {
    await useLibraryStore
      .getState()
      .importFiles([makeFile('cover.z5', 'cover-bytes')])
    const gameId = useLibraryStore.getState().games[0].gameId

    const coverFile = new File(['png-data'], 'art.png', { type: 'image/png' })
    await useLibraryStore.getState().setCover(gameId, coverFile)

    expect(useLibraryStore.getState().games[0].hasCover).toBe(true)
    const cover = await getCover(gameId)
    expect(cover).toBeInstanceOf(Blob)
    expect(await blobToText(cover!)).toBe('png-data')
  })
})
