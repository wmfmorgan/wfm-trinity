import { create } from 'zustand'
import {
  getGame,
  getStoryBytes,
  touchLastPlayed,
} from '../../persistence/libraryRepo'
import { getLatestAutosave } from '../../persistence/saveRepo'
import { createAdapter } from '../../zmachine/createAdapter'
import type { AdapterKind, ZMachineAdapter } from '../../zmachine/types'
import { autosave, loadSlot, saveSlot } from '../saves/saveService'
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
   * True while a command turn (submit) is in flight.
   * Used to ignore concurrent submits and disable input/compass.
   */
  busy: boolean
  /**
   * One-shot insert for Terminal (inventory click).
   * Terminal applies via insertText prop and clears with clearPendingInsert.
   */
  pendingInsert: string | null
  /** Monotonic id paired with pendingInsert for Terminal consumption. */
  pendingInsertId: number
  openGame: (gameId: string, mode: OpenGameMode) => Promise<void>
  submit: (line: string) => Promise<void>
  /** Manual named slot write (Save new / Overwrite). */
  saveToSlot: (slotId: string, name: string) => Promise<void>
  /** Best-effort autosave for pagehide / visibilitychange. */
  flushAutosave: () => Promise<void>
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
  busy: false,
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
      busy: false,
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
      const raw =
        err instanceof Error ? err.message : 'Failed to open game'
      const message = raw.startsWith('Failed to open')
        ? raw
        : `Failed to open game: ${raw}`
      set({ error: message, screen: 'library', session: null, adapter: null })
    }
  },

  submit: async (line) => {
    const { session, adapter, busy } = get()
    if (!session || !adapter) {
      set({ error: 'No active game session' })
      return
    }
    // Ignore concurrent submits while a turn is in flight (no throw).
    if (busy) return

    set({ busy: true })
    try {
      const prevLocationId = session.snapshot.location.id
      const next = await submitCommand(session, adapter, line)
      set({ session: next, error: null })

      // Soft-fail autosave: keep playing if persistence fails.
      // Room-entry checkpoints rotate when location changes (past 3 rooms).
      try {
        const roomChanged =
          next.snapshot.location.id !== prevLocationId &&
          next.snapshot.location.id !== 'unknown'
        await autosave(next, adapter, { roomChanged })
      } catch (err) {
        const message =
          err instanceof Error ? err.message : 'Autosave failed'
        set({ error: `Autosave failed: ${message}` })
      }
    } catch (err) {
      const raw =
        err instanceof Error ? err.message : 'Command failed'
      const message = raw.startsWith('Interpreter error')
        ? raw
        : `Interpreter error: ${raw}`
      // Keep session so the user can dismiss or return to library from the banner.
      set({ error: message })
    } finally {
      set({ busy: false })
    }
  },

  saveToSlot: async (slotId, name) => {
    const { session, adapter } = get()
    if (!session || !adapter) {
      set({ error: 'No active game session' })
      throw new Error('No active game session')
    }
    try {
      await saveSlot(session, adapter, slotId, name)
      set({ error: null })
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Save failed'
      set({ error: `Save failed: ${message}` })
      throw err instanceof Error ? err : new Error(message)
    }
  },

  flushAutosave: async () => {
    const { session, adapter } = get()
    if (!session || !adapter) return
    try {
      await autosave(session, adapter)
    } catch {
      // Best-effort only — do not surface errors on page hide
    }
  },
}))
