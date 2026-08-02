import type {
  Direction,
  StatusInfo,
  TurnSnapshot,
} from '../domain/types'
import { ALL_DIRS } from '../domain/directions'

/** Common IF direction abbreviations → canonical Direction. */
const ABBREV: Record<string, Direction> = {
  n: 'north',
  s: 'south',
  e: 'east',
  w: 'west',
  ne: 'northeast',
  nw: 'northwest',
  se: 'southeast',
  sw: 'southwest',
  u: 'up',
  d: 'down',
}

const FULL_NAMES = new Set<string>(ALL_DIRS)

/**
 * Normalize a raw exit token (full name or abbreviation) to a Direction.
 * Returns null when the token is not a known direction.
 */
export function normalizeExitDir(raw: string): Direction | null {
  const key = raw.trim().toLowerCase()
  if (!key) return null
  if (FULL_NAMES.has(key)) return key as Direction
  return ABBREV[key] ?? null
}

/**
 * Drop undefined fields from status so the UI only sees exposed values.
 * Preserves explicit zeros.
 */
export function filterStatus(s: StatusInfo): StatusInfo {
  const out: StatusInfo = {}
  if (s.score !== undefined) out.score = s.score
  if (s.moves !== undefined) out.moves = s.moves
  if (s.hours !== undefined) out.hours = s.hours
  if (s.minutes !== undefined) out.minutes = s.minutes
  if (s.locationName !== undefined) out.locationName = s.locationName
  return out
}

/** Build a clean StatusInfo from a partial (undefined fields omitted). */
export function buildStatus(partial: Partial<StatusInfo>): StatusInfo {
  return filterStatus(partial)
}

/**
 * Shallow-merge a partial snapshot onto a base.
 * Nested `status` is field-merged then filtered; other object fields replace.
 * Does not mutate `base`.
 */
export function mergeSnapshot(
  base: TurnSnapshot,
  overlay: Partial<TurnSnapshot>,
): TurnSnapshot {
  const status =
    overlay.status !== undefined
      ? filterStatus({ ...base.status, ...overlay.status })
      : filterStatus(base.status)

  return {
    transcriptDelta:
      overlay.transcriptDelta !== undefined
        ? overlay.transcriptDelta
        : base.transcriptDelta,
    location:
      overlay.location !== undefined ? { ...overlay.location } : { ...base.location },
    inventory:
      overlay.inventory !== undefined
        ? overlay.inventory.map((i) => ({ ...i }))
        : base.inventory.map((i) => ({ ...i })),
    exits:
      overlay.exits !== undefined
        ? overlay.exits.map((e) => ({ ...e }))
        : base.exits.map((e) => ({ ...e })),
    status,
    waitingFor:
      overlay.waitingFor !== undefined ? overlay.waitingFor : base.waitingFor,
  }
}
