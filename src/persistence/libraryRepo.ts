import type { GameMetadata, LibraryGame } from '../domain/types'
import { blobToArrayBuffer } from './blobUtil'
import { openDb } from './db'

export async function listGames(): Promise<LibraryGame[]> {
  const db = await openDb()
  return db.getAll('games')
}

export async function getGame(gameId: string): Promise<LibraryGame | undefined> {
  const db = await openDb()
  return db.get('games', gameId)
}

export async function putGame(
  game: LibraryGame,
  story: ArrayBuffer,
): Promise<void> {
  const db = await openDb()
  const tx = db.transaction(['games', 'storyBytes'], 'readwrite')
  await Promise.all([
    tx.objectStore('games').put(game),
    tx.objectStore('storyBytes').put(story, game.gameId),
    tx.done,
  ])
}

export async function getStoryBytes(
  gameId: string,
): Promise<ArrayBuffer | undefined> {
  const db = await openDb()
  return db.get('storyBytes', gameId)
}

export async function deleteGameCascade(gameId: string): Promise<void> {
  const db = await openDb()
  const tx = db.transaction(
    ['games', 'storyBytes', 'covers', 'saves', 'maps', 'feelies'],
    'readwrite',
  )

  const savesStore = tx.objectStore('saves')
  const saveKeys = await savesStore.index('by-gameId').getAllKeys(gameId)
  await Promise.all(saveKeys.map((key) => savesStore.delete(key)))

  const feeliesStore = tx.objectStore('feelies')
  const feelieKeys = await feeliesStore.index('by-gameId').getAllKeys(gameId)
  await Promise.all(feelieKeys.map((key) => feeliesStore.delete(key)))

  await Promise.all([
    tx.objectStore('games').delete(gameId),
    tx.objectStore('storyBytes').delete(gameId),
    tx.objectStore('covers').delete(gameId),
    tx.objectStore('maps').delete(gameId),
    tx.done,
  ])
}

export async function putCover(gameId: string, blob: Blob): Promise<void> {
  const db = await openDb()
  const data = await blobToArrayBuffer(blob)
  const tx = db.transaction(['covers', 'games'], 'readwrite')
  await tx.objectStore('covers').put({ mime: blob.type || '', data }, gameId)
  const game = await tx.objectStore('games').get(gameId)
  if (game) {
    await tx.objectStore('games').put({ ...game, hasCover: true })
  }
  await tx.done
}

export async function getCover(gameId: string): Promise<Blob | undefined> {
  const db = await openDb()
  const record = await db.get('covers', gameId)
  if (!record) return undefined
  return new Blob([record.data], { type: record.mime })
}

export async function updateMetadata(
  gameId: string,
  metadata: GameMetadata,
): Promise<void> {
  const db = await openDb()
  const game = await db.get('games', gameId)
  if (!game) return
  await db.put('games', { ...game, metadata })
}

export async function touchLastPlayed(
  gameId: string,
  when: number = Date.now(),
): Promise<void> {
  const db = await openDb()
  const game = await db.get('games', gameId)
  if (!game) return
  await db.put('games', { ...game, lastPlayedAt: when })
}
