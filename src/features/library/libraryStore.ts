import { create } from 'zustand'
import type { GameMetadata, LibraryGame } from '../../domain/types'
import { hashStoryBytes } from '../../domain/gameId'
import { blobToArrayBuffer } from '../../persistence/blobUtil'
import {
  deleteGameCascade,
  listGames,
  putCover,
  putGame,
  updateMetadata,
} from '../../persistence/libraryRepo'

export interface LibraryState {
  games: LibraryGame[]
  loading: boolean
  error: string | null
  refresh: () => Promise<void>
  importFiles: (files: FileList | File[]) => Promise<void>
  removeGame: (gameId: string) => Promise<void>
  updateMeta: (gameId: string, metadata: GameMetadata) => Promise<void>
  setCover: (gameId: string, file: File) => Promise<void>
  clearError: () => void
}

/** Strip last extension for default title (e.g. zork1.z5 → zork1). */
export function titleFromFileName(fileName: string): string {
  const base = fileName.split(/[/\\]/).pop() ?? fileName
  const stripped = base.replace(/\.[^/.]+$/, '')
  return stripped.length > 0 ? stripped : base
}

/** Read file bytes; works when `File.arrayBuffer` is missing (jsdom). */
export async function readFileBytes(file: Blob): Promise<ArrayBuffer> {
  return blobToArrayBuffer(file)
}

export const useLibraryStore = create<LibraryState>((set, get) => ({
  games: [],
  loading: false,
  error: null,

  clearError: () => set({ error: null }),

  refresh: async () => {
    set({ loading: true, error: null })
    try {
      const games = await listGames()
      // Most recently played / imported first
      games.sort((a, b) => {
        const aTime = a.lastPlayedAt ?? a.importedAt
        const bTime = b.lastPlayedAt ?? b.importedAt
        return bTime - aTime
      })
      set({ games, loading: false })
    } catch (err) {
      const message =
        err instanceof Error ? err.message : 'Failed to load library'
      set({ loading: false, error: message })
    }
  },

  importFiles: async (files) => {
    const list = Array.from(files)
    if (list.length === 0) return

    set({ loading: true, error: null })
    try {
      for (const file of list) {
        const bytes = await readFileBytes(file)
        if (bytes.byteLength === 0) {
          throw new Error(
            `Empty or unreadable story file: ${file.name || 'unknown'}`,
          )
        }
        const gameId = await hashStoryBytes(bytes)
        const now = Date.now()
        const game: LibraryGame = {
          gameId,
          fileName: file.name,
          importedAt: now,
          metadata: { title: titleFromFileName(file.name) },
          hasCover: false,
        }
        await putGame(game, bytes)
      }
      await get().refresh()
    } catch (err) {
      const message =
        err instanceof Error ? err.message : 'Failed to import story file(s)'
      set({ loading: false, error: message })
    }
  },

  removeGame: async (gameId) => {
    set({ loading: true, error: null })
    try {
      await deleteGameCascade(gameId)
      await get().refresh()
    } catch (err) {
      const message =
        err instanceof Error ? err.message : 'Failed to remove game'
      set({ loading: false, error: message })
    }
  },

  updateMeta: async (gameId, metadata) => {
    set({ error: null })
    try {
      await updateMetadata(gameId, metadata)
      await get().refresh()
    } catch (err) {
      const message =
        err instanceof Error ? err.message : 'Failed to update metadata'
      set({ error: message })
    }
  },

  setCover: async (gameId, file) => {
    set({ error: null })
    try {
      // putCover accepts Blob; File extends Blob
      await putCover(gameId, file)
      await get().refresh()
    } catch (err) {
      const message =
        err instanceof Error ? err.message : 'Failed to set cover'
      set({ error: message })
    }
  },
}))
