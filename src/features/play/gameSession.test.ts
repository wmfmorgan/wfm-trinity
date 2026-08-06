import { describe, it, expect } from 'vitest'
import { createMockAdapter } from '../../zmachine/mockAdapter'
import {
  startNewSession,
  startFromSave,
  submitCommand,
} from './gameSession'
import type { SaveRecord } from '../../persistence/saveRepo'
import { emptyMap, applyVisit } from '../map/mapGraph'

describe('startNewSession', () => {
  it('loads story, seeds map at first room, and starts transcript', async () => {
    const adapter = createMockAdapter()
    const s = await startNewSession('g', new ArrayBuffer(8), adapter)

    expect(s.gameId).toBe('g')
    expect(s.snapshot.location.name).toBe('Meadow')
    expect(s.snapshot.location.id).toBe('meadow')
    expect(s.map.nodes['meadow']).toBeTruthy()
    expect(s.map.nodes['meadow'].x).toBe(0)
    expect(s.map.nodes['meadow'].y).toBe(0)
    expect(s.fullTranscript.toLowerCase()).toContain('meadow')
    expect(s.history).toEqual([])
    expect(s.turn).toBe(0)
    expect(s.prevLocationId).toBe('meadow')
    expect(s.lastMoveDir).toBeNull()
    expect(s.selectedRoomId).toBe('meadow')
  })
})

describe('submitCommand', () => {
  it('submit north updates map and transcript', async () => {
    const adapter = createMockAdapter()
    let s = await startNewSession('g', new ArrayBuffer(8), adapter)
    s = await submitCommand(s, adapter, 'north')
    expect(s.snapshot.location.name).toBe('Woods')
    expect(s.map.nodes[s.snapshot.location.id]).toBeTruthy()
    expect(s.fullTranscript.toLowerCase()).toContain('wood')
    // Command is echoed into the transcript before game output
    expect(s.fullTranscript).toContain('> north\n')
    expect(s.history).toEqual(['north'])
    expect(s.turn).toBe(1)
    expect(s.lastMoveDir).toBe('north')
    expect(s.prevLocationId).toBe('meadow')
    expect(
      s.map.edges.some(
        (e) => e.fromId === 'meadow' && e.toId === 'woods' && e.dir === 'north',
      ),
    ).toBe(true)
  })

  it('echoes typed command before game output in transcript', async () => {
    const adapter = createMockAdapter()
    let s = await startNewSession('g', new ArrayBuffer(8), adapter)
    const before = s.fullTranscript
    s = await submitCommand(s, adapter, 'look')
    const added = s.fullTranscript.slice(before.length)
    expect(added.startsWith('> look\n')).toBe(true)
    expect(added.toLowerCase()).toContain('meadow')
  })

  it('trims input and records trimmed line in history', async () => {
    const adapter = createMockAdapter()
    let s = await startNewSession('g', new ArrayBuffer(8), adapter)
    s = await submitCommand(s, adapter, '  look  ')
    expect(s.history).toEqual(['look'])
    expect(s.fullTranscript.toLowerCase()).toContain('meadow')
    expect(s.lastMoveDir).toBeNull()
  })

  it('detects direction abbreviations via normalizeExitDir', async () => {
    const adapter = createMockAdapter()
    let s = await startNewSession('g', new ArrayBuffer(8), adapter)
    // mock only accepts full words for movement, but dir detection still normalizes
    s = await submitCommand(s, adapter, 'n')
    expect(s.lastMoveDir).toBe('north')
  })

  it('ignores empty / whitespace-only commands in history', async () => {
    const adapter = createMockAdapter()
    let s = await startNewSession('g', new ArrayBuffer(8), adapter)
    s = await submitCommand(s, adapter, '   ')
    expect(s.history).toEqual([])
    expect(s.turn).toBe(1)
  })

  it('appends transcript deltas across turns', async () => {
    const adapter = createMockAdapter()
    let s = await startNewSession('g', new ArrayBuffer(8), adapter)
    const bootLen = s.fullTranscript.length
    s = await submitCommand(s, adapter, 'look')
    expect(s.fullTranscript.length).toBeGreaterThan(bootLen)
    expect(s.fullTranscript.startsWith('Mock')).toBe(true)
  })

  it('failed move does not create edge but still records dir', async () => {
    const adapter = createMockAdapter()
    let s = await startNewSession('g', new ArrayBuffer(8), adapter)
    s = await submitCommand(s, adapter, 'east')
    expect(s.snapshot.location.id).toBe('meadow')
    expect(s.lastMoveDir).toBe('east')
    expect(s.map.edges).toHaveLength(0)
    expect(Object.keys(s.map.nodes)).toHaveLength(1)
  })
})

describe('startFromSave', () => {
  it('restores adapter state and shell map/history', async () => {
    const adapter = createMockAdapter()
    let s = await startNewSession('g', new ArrayBuffer(8), adapter)
    s = await submitCommand(s, adapter, 'north')
    s = await submitCommand(s, adapter, 'look')

    const zmachineSave = await adapter.save()
    const save: SaveRecord = {
      gameId: 'g',
      slotId: 'manual-1',
      name: 'In Woods',
      updatedAt: 123,
      locationName: s.snapshot.location.name,
      zmachineSave,
      shell: { map: s.map, history: s.history },
    }

    const adapter2 = createMockAdapter()
    // load fresh (meadow), then restore from save
    await adapter2.load(new ArrayBuffer(8))
    const restored = await startFromSave(save, new ArrayBuffer(8), adapter2)

    expect(restored.gameId).toBe('g')
    expect(restored.snapshot.location.id).toBe('woods')
    expect(restored.history).toEqual(['north', 'look'])
    expect(restored.map.nodes['woods']).toBeTruthy()
    expect(restored.map.nodes['meadow']).toBeTruthy()
    expect(restored.selectedRoomId).toBe('woods')
    expect(restored.turn).toBe(2)
  })

  it('uses empty map from save shell when provided', async () => {
    const adapter = createMockAdapter()
    await adapter.load(new ArrayBuffer(8))
    // move then save without going through session
    await adapter.submit('north')
    const zmachineSave = await adapter.save()

    let map = emptyMap('g')
    map = applyVisit(map, {
      location: { id: 'meadow', name: 'Meadow' },
      turn: 0,
    })
    map = applyVisit(map, {
      location: { id: 'woods', name: 'Woods' },
      prevLocationId: 'meadow',
      movedDir: 'north',
      turn: 1,
    })

    const save: SaveRecord = {
      gameId: 'g',
      slotId: 'autosave',
      name: 'Autosave',
      updatedAt: 1,
      locationName: 'Woods',
      zmachineSave,
      shell: { map, history: ['north'] },
    }

    const restored = await startFromSave(save, new ArrayBuffer(8), createMockAdapter())
    expect(restored.map.edges).toHaveLength(1)
    expect(restored.history).toEqual(['north'])
  })
})
