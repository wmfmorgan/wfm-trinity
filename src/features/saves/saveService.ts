import type { ZMachineAdapter } from '../../zmachine/types'
import {
  deleteSave,
  getSave,
  putSave,
  type SaveRecord,
} from '../../persistence/saveRepo'
import {
  startFromSave,
  type SessionState,
} from '../play/gameSession'

/** Latest continuous autosave (always overwritten). */
export const AUTOSAVE_SLOT = 'autosave'
const AUTOSAVE_NAME_PREFIX = 'Autosave'

/**
 * Room-entry checkpoints: newest is room-0, then room-1, room-2.
 * Rotated only when the player enters a new room.
 */
export const ROOM_CHECKPOINT_COUNT = 3
export const ROOM_CHECKPOINT_SLOT_PREFIX = 'autosave-room-'

export function roomCheckpointSlotId(index: number): string {
  return `${ROOM_CHECKPOINT_SLOT_PREFIX}${index}`
}

export function isRoomCheckpointSlot(slotId: string): boolean {
  return slotId.startsWith(ROOM_CHECKPOINT_SLOT_PREFIX)
}

export function isAutosaveFamilySlot(slotId: string): boolean {
  return (
    slotId === AUTOSAVE_SLOT ||
    slotId.startsWith('autosave-') ||
    isRoomCheckpointSlot(slotId)
  )
}

function autosaveName(locationName: string): string {
  return `${AUTOSAVE_NAME_PREFIX} — ${locationName}`
}

function roomCheckpointName(locationName: string): string {
  return `Room: ${locationName}`
}

/** Cap stored transcript so IDB stays bounded. */
const TRANSCRIPT_TAIL_CHARS = 12_000

function shellFromSession(session: SessionState): SaveRecord['shell'] {
  const transcript =
    session.fullTranscript.length > TRANSCRIPT_TAIL_CHARS
      ? session.fullTranscript.slice(-TRANSCRIPT_TAIL_CHARS)
      : session.fullTranscript
  return {
    map: session.map,
    history: session.history,
    transcript,
    locationId: session.snapshot.location.id,
  }
}

export async function saveSlot(
  session: SessionState,
  adapter: ZMachineAdapter,
  slotId: string,
  name: string,
): Promise<void> {
  const zmachineSave = await adapter.save()
  await putSave({
    gameId: session.gameId,
    slotId,
    name,
    updatedAt: Date.now(),
    locationName: session.snapshot.location.name,
    zmachineSave,
    shell: shellFromSession(session),
  })
}

/**
 * Write the latest autosave always. When `roomChanged` is true, also push a
 * room-entry checkpoint and keep only the past {@link ROOM_CHECKPOINT_COUNT}.
 */
export async function autosave(
  session: SessionState,
  adapter: ZMachineAdapter,
  opts?: { roomChanged?: boolean },
): Promise<void> {
  const locName = session.snapshot.location.name || 'Unknown'

  // Always refresh the primary "Continue" slot.
  await saveSlot(session, adapter, AUTOSAVE_SLOT, autosaveName(locName))

  if (opts?.roomChanged) {
    await pushRoomCheckpoint(session, adapter, locName)
  }
}

/**
 * Rotate room checkpoints (0 = newest) and write the current state as room-0.
 * Copies older blobs into higher indices, then drops anything beyond the ring.
 */
export async function pushRoomCheckpoint(
  session: SessionState,
  adapter: ZMachineAdapter,
  locationName?: string,
): Promise<void> {
  const gameId = session.gameId
  const locName =
    locationName || session.snapshot.location.name || 'Unknown'

  // Shift room-(n-2) ... room-0 upward (highest index first to avoid clobber).
  for (let i = ROOM_CHECKPOINT_COUNT - 2; i >= 0; i--) {
    const fromId = roomCheckpointSlotId(i)
    const toId = roomCheckpointSlotId(i + 1)
    const existing = await getSave(gameId, fromId)
    if (existing) {
      await putSave({
        ...existing,
        slotId: toId,
        // Keep original updatedAt so list order by time still makes sense
        // after we write the new room-0 with a fresher timestamp.
      })
    }
  }

  await saveSlot(
    session,
    adapter,
    roomCheckpointSlotId(0),
    roomCheckpointName(locName),
  )

  // Ensure we never keep more than ROOM_CHECKPOINT_COUNT room slots
  // (defensive if older builds used different ids).
  for (let i = ROOM_CHECKPOINT_COUNT; i < ROOM_CHECKPOINT_COUNT + 5; i++) {
    await deleteSave(gameId, roomCheckpointSlotId(i))
  }
}

export async function loadSlot(
  gameId: string,
  slotId: string,
  story: ArrayBuffer,
  adapter: ZMachineAdapter,
): Promise<SessionState> {
  const save = await getSave(gameId, slotId)
  if (!save) {
    throw new Error(`No save slot '${slotId}' for game '${gameId}'`)
  }
  return startFromSave(save, story, adapter)
}
