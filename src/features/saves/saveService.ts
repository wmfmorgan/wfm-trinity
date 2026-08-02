import type { ZMachineAdapter } from '../../zmachine/types'
import { getSave, putSave } from '../../persistence/saveRepo'
import {
  startFromSave,
  type SessionState,
} from '../play/gameSession'

const AUTOSAVE_SLOT = 'autosave'
const AUTOSAVE_NAME = 'Autosave'

export async function autosave(
  session: SessionState,
  adapter: ZMachineAdapter,
): Promise<void> {
  await saveSlot(session, adapter, AUTOSAVE_SLOT, AUTOSAVE_NAME)
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
    shell: {
      map: session.map,
      history: session.history,
    },
  })
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
