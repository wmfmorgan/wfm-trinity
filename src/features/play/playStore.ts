import { create } from 'zustand'
import {
  getGame,
  getStoryBytes,
  touchLastPlayed,
} from '../../persistence/libraryRepo'
import { getLatestAutosave } from '../../persistence/saveRepo'
import { createAdapter } from '../../zmachine/createAdapter'
import type { AdapterKind, ZMachineAdapter } from '../../zmachine/types'
import { autosave, loadSlot } from '../saves/saveService'
import {
  startFromSave,
  startNewSession,
  submitCommand,
  type SessionState,
} from './gameSession'

export type OpenGameMode = 'new' | 'continue' | { slotId: string }

export interface PlayState {
  screen: 'library' | 'play'
  session: SessionState | null
  adapter: ZMachineAdapter | null
  error: string | null
  /**
   * One-shot insert for Terminal (inventory click).
   * Terminal applies via insertText prop and clears with clearPendingInsert.
   */
  pendingInsert: string | null
  /** Monotonic id paired with pendingInsert for Terminal consumption. */
  pendingInsertId: number
  openGame: (gameId: string, mode: OpenGameMode) => Promise<void>
  submit: (line: string) => Promise<void>
  returnToLibrary: () => void
  selectMapRoom: (roomId: string | null) => void
  queueInsert: (text: string) => void
  clearPendingInsert: () => void
  clearError: () => void
}

/**
 * Adapter kind used by `openGame`.
 * Production default is `zvm`; tests set to `mock` via `setPlayAdapterKind`.
 */
let playAdapterKind: AdapterKind = 'zvm'

export function setPlayAdapterKind(kind: AdapterKind): void {
  playAdapterKind = kind
}

export function getPlayAdapterKind(): AdapterKind {
  return playAdapterKind
}

export const usePlayStore = create<PlayState>((set, get) => ({
  screen: 'library',
  session: null,
  adapter: null,
  error: null,
  pendingInsert: null,
  pendingInsertId: 0,

  clearError: () => set({ error: null }),

  queueInsert: (text) => {
    const t = text.trim()
    if (!t) return
    set((s) => ({
      pendingInsert: t,
      pendingInsertId: s.pendingInsertId + 1,
    }))
  },

  clearPendingInsert: () => set({ pendingInsert: null }),

  returnToLibrary: () =>
    set({
      screen: 'library',
      session: null,
      adapter: null,
      error: null,
      pendingInsert: null,
    }),

  selectMapRoom: (roomId) => {
    const { session } = get()
    if (!session) return
    set({
      session: { ...session, selectedRoomId: roomId },
    })
  },

  openGame: async (gameId, mode) => {
    set({ error: null })
    try {
      const game = await getGame(gameId)
      if (!game) {
        set({ error: `Game not found: ${gameId}` })
        return
      }
      const story = await getStoryBytes(gameId)
      if (!story) {
        set({ error: `Story bytes missing for game: ${gameId}` })
        return
      }

      const adapter = createAdapter(playAdapterKind)
      let session: SessionState

      if (mode === 'new') {
        session = await startNewSession(gameId, story, adapter)
      } else if (mode === 'continue') {
        const save = await getLatestAutosave(gameId)
        if (!save) {
          set({
            error: 'No autosave found. Start a new game instead.',
          })
          return
        }
        session = await startFromSave(save, story, adapter)
      } else {
        session = await loadSlot(gameId, mode.slotId, story, adapter)
      }

      await touchLastPlayed(gameId)
      set({
        screen: 'play',
        session,
        adapter,
        error: null,
      })
    } catch (err) {
      const message =
        err instanceof Error ? err.message : 'Failed to open game'
      set({ error: message, screen: 'library', session: null, adapter: null })
    }
  },

  submit: async (line) => {
    const { session, adapter } = get()
    if (!session || !adapter) {
      set({ error: 'No active game session' })
      return
    }

    try {
      const next = await submitCommand(session, adapter, line)
      set({ session: next, error: null })

      // Soft-fail autosave: keep playing if persistence fails
      try {
        await autosave(next, adapter)
      } catch (err) {
        const message =
          err instanceof Error ? err.message : 'Autosave failed'
        set({ error: `Autosave failed: ${message}` })
      }
    } catch (err) {
      const message =
        err instanceof Error ? err.message : 'Command failed'
      set({ error: message })
    }
  },
}))
