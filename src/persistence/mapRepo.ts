import type { MapGraphState } from '../domain/types'
import { openDb } from './db'

export async function putMap(graph: MapGraphState): Promise<void> {
  const db = await openDb()
  await db.put('maps', graph)
}

export async function getMap(
  gameId: string,
): Promise<MapGraphState | undefined> {
  const db = await openDb()
  return db.get('maps', gameId)
}
