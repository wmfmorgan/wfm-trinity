import type { Direction, MapGraphState, TurnSnapshot } from '../../domain/types'
import type { SaveRecord } from '../../persistence/saveRepo'
import type { ZMachineAdapter } from '../../zmachine/types'
import { normalizeExitDir } from '../../zmachine/worldView'
import { applyVisit, emptyMap } from '../map/mapGraph'

export interface SessionState {
  gameId: string
  snapshot: TurnSnapshot
  fullTranscript: string
  map: MapGraphState
  history: string[]
  turn: number
  prevLocationId?: string
  lastMoveDir?: Direction | null
  selectedRoomId?: string | null
}

/** Detect movement direction from a submitted command line. */
export function detectMoveDir(line: string): Direction | null {
  return normalizeExitDir(line)
}

export async function startNewSession(
  gameId: string,
  story: ArrayBuffer,
  adapter: ZMachineAdapter,
): Promise<SessionState> {
  const snapshot = await adapter.load(story)
  const turn = 0
  const map = applyVisit(emptyMap(gameId), {
    location: snapshot.location,
    turn,
  })

  return {
    gameId,
    snapshot,
    fullTranscript: snapshot.transcriptDelta,
    map,
    history: [],
    turn,
    prevLocationId: snapshot.location.id,
    lastMoveDir: null,
    selectedRoomId: snapshot.location.id,
  }
}

export async function startFromSave(
  save: SaveRecord,
  _story: ArrayBuffer,
  adapter: ZMachineAdapter,
): Promise<SessionState> {
  // Real zvm saves embed story bytes; mock restores state alone.
  // `story` is reserved for engines that require load-before-restore.
  const snapshot = await adapter.restore(save.zmachineSave)
  const turn = save.shell.history.length
  const map = applyVisit(save.shell.map, {
    location: snapshot.location,
    turn,
  })

  return {
    gameId: save.gameId,
    snapshot,
    fullTranscript: snapshot.transcriptDelta,
    map,
    history: [...save.shell.history],
    turn,
    prevLocationId: snapshot.location.id,
    lastMoveDir: null,
    selectedRoomId: snapshot.location.id,
  }
}

export async function submitCommand(
  session: SessionState,
  adapter: ZMachineAdapter,
  line: string,
): Promise<SessionState> {
  const trimmed = line.trim()
  const prevLocationId = session.snapshot.location.id
  const lastMoveDir = detectMoveDir(trimmed)
  const snapshot = await adapter.submit(trimmed)
  const turn = session.turn + 1
  const map = applyVisit(session.map, {
    location: snapshot.location,
    prevLocationId,
    movedDir: lastMoveDir,
    turn,
  })
  const history =
    trimmed.length > 0 ? [...session.history, trimmed] : session.history

  return {
    gameId: session.gameId,
    snapshot,
    fullTranscript: session.fullTranscript + snapshot.transcriptDelta,
    map,
    history,
    turn,
    prevLocationId,
    lastMoveDir,
    selectedRoomId: snapshot.location.id,
  }
}
