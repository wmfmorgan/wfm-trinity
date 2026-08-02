import { describe, it, expect } from 'vitest'
import type { StatusInfo, TurnSnapshot } from '../domain/types'
import {
  buildStatus,
  filterStatus,
  mergeSnapshot,
  normalizeExitDir,
} from './worldView'

describe('normalizeExitDir', () => {
  it('accepts full direction names case-insensitively', () => {
    expect(normalizeExitDir('north')).toBe('north')
    expect(normalizeExitDir('NORTH')).toBe('north')
    expect(normalizeExitDir(' NorthEast ')).toBe('northeast')
    expect(normalizeExitDir('up')).toBe('up')
    expect(normalizeExitDir('IN')).toBe('in')
  })

  it('accepts common compass abbreviations', () => {
    expect(normalizeExitDir('n')).toBe('north')
    expect(normalizeExitDir('s')).toBe('south')
    expect(normalizeExitDir('e')).toBe('east')
    expect(normalizeExitDir('w')).toBe('west')
    expect(normalizeExitDir('ne')).toBe('northeast')
    expect(normalizeExitDir('nw')).toBe('northwest')
    expect(normalizeExitDir('se')).toBe('southeast')
    expect(normalizeExitDir('sw')).toBe('southwest')
    expect(normalizeExitDir('u')).toBe('up')
    expect(normalizeExitDir('d')).toBe('down')
  })

  it('returns null for unknown or empty tokens', () => {
    expect(normalizeExitDir('')).toBeNull()
    expect(normalizeExitDir('   ')).toBeNull()
    expect(normalizeExitDir('xyz')).toBeNull()
    expect(normalizeExitDir('forward')).toBeNull()
  })
})

describe('filterStatus', () => {
  it('drops undefined fields', () => {
    const raw: StatusInfo = {
      score: 10,
      moves: undefined,
      hours: 9,
      minutes: undefined,
      locationName: 'West of House',
    }
    expect(filterStatus(raw)).toEqual({
      score: 10,
      hours: 9,
      locationName: 'West of House',
    })
  })

  it('returns empty object when all fields are undefined', () => {
    expect(filterStatus({})).toEqual({})
    expect(
      filterStatus({
        score: undefined,
        moves: undefined,
      }),
    ).toEqual({})
  })

  it('preserves zero values', () => {
    expect(filterStatus({ score: 0, moves: 0 })).toEqual({
      score: 0,
      moves: 0,
    })
  })
})

describe('buildStatus', () => {
  it('builds a clean StatusInfo from a partial', () => {
    expect(buildStatus({ score: 5, moves: undefined })).toEqual({ score: 5 })
  })
})

describe('mergeSnapshot', () => {
  const base: TurnSnapshot = {
    transcriptDelta: 'You are in a meadow.\n',
    location: { id: 'meadow', name: 'Meadow' },
    inventory: [{ id: 'lamp', name: 'brass lamp' }],
    exits: [{ dir: 'north', toId: 'woods' }],
    status: { score: 0, moves: 1, locationName: 'Meadow' },
    waitingFor: 'line',
  }

  it('overlays top-level fields and merges status', () => {
    const next = mergeSnapshot(base, {
      transcriptDelta: 'Woods.\n',
      location: { id: 'woods', name: 'Woods' },
      status: { moves: 2, locationName: 'Woods' },
    })

    expect(next.transcriptDelta).toBe('Woods.\n')
    expect(next.location).toEqual({ id: 'woods', name: 'Woods' })
    expect(next.inventory).toEqual(base.inventory)
    expect(next.exits).toEqual(base.exits)
    expect(next.status).toEqual({
      score: 0,
      moves: 2,
      locationName: 'Woods',
    })
    expect(next.waitingFor).toBe('line')
  })

  it('replaces inventory and exits when provided', () => {
    const next = mergeSnapshot(base, {
      inventory: [],
      exits: [{ dir: 'south' }],
    })
    expect(next.inventory).toEqual([])
    expect(next.exits).toEqual([{ dir: 'south' }])
  })

  it('does not mutate the base snapshot', () => {
    const copy = structuredClone(base)
    mergeSnapshot(base, {
      status: { score: 99 },
      inventory: [],
    })
    expect(base).toEqual(copy)
  })
})
