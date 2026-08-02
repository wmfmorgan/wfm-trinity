import { blobToArrayBuffer } from './blobUtil'
import { openDb } from './db'

export interface FeelieMeta {
  id: string
  gameId: string
  name: string
  mime: string
  addedAt: number
}

export async function listFeelies(gameId: string): Promise<FeelieMeta[]> {
  const db = await openDb()
  const records = await db.getAllFromIndex('feelies', 'by-gameId', gameId)
  return records.map(({ id, gameId: g, name, mime, addedAt }) => ({
    id,
    gameId: g,
    name,
    mime,
    addedAt,
  }))
}

export async function putFeelie(meta: FeelieMeta, blob: Blob): Promise<void> {
  const db = await openDb()
  const data = await blobToArrayBuffer(blob)
  await db.put('feelies', {
    ...meta,
    mime: meta.mime || blob.type || '',
    data,
  })
}

export async function getFeelieBlob(id: string): Promise<Blob | undefined> {
  const db = await openDb()
  const record = await db.get('feelies', id)
  if (!record) return undefined
  return new Blob([record.data], { type: record.mime })
}

export async function deleteFeelie(id: string): Promise<void> {
  const db = await openDb()
  await db.delete('feelies', id)
}
