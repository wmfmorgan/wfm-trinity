import { describe, it, expect } from 'vitest'
import { createMockAdapter } from './mockAdapter'
import { createAdapter } from './createAdapter'

describe('mockAdapter', () => {
  it('loads into meadow and moves north', async () => {
    const a = createMockAdapter()
    const s0 = await a.load(new ArrayBuffer(8))
    expect(s0.location.name).toBe('Meadow')
    expect(s0.location.id).toBe('meadow')
    expect(s0.inventory).toEqual([])
    expect(s0.status.score).toBe(0)
    expect(s0.status.moves).toBe(0)
    expect(s0.waitingFor).toBe('line')
    expect(s0.exits.some((e) => e.dir === 'north' && e.toId === 'woods')).toBe(
      true,
    )
    expect(s0.transcriptDelta).toContain('Mock Zorkian Adventure')
    expect(s0.transcriptDelta).toContain('Meadow')

    const s1 = await a.submit('north')
    expect(s1.location.name).toBe('Woods')
    expect(s1.status.moves).toBe(1)
  })

  it('save restore roundtrips location', async () => {
    const a = createMockAdapter()
    await a.load(new ArrayBuffer(8))
    await a.submit('north')
    const blob = await a.save()
    await a.submit('south')
    const s = await a.restore(blob)
    expect(s.location.name).toBe('Woods')
  })

  it('take lamp adds to inventory when in Woods', async () => {
    const a = createMockAdapter()
    await a.load(new ArrayBuffer(8))
    await a.submit('north')
    const s = await a.submit('take lamp')
    expect(s.inventory.some((i) => i.id === 'lamp')).toBe(true)
    expect(s.transcriptDelta.toLowerCase()).toMatch(/taken|lamp/)
  })

  it('inventory and look produce appropriate text', async () => {
    const a = createMockAdapter()
    await a.load(new ArrayBuffer(8))
    const look = await a.submit('look')
    expect(look.transcriptDelta).toContain('Meadow')
    expect(look.location.name).toBe('Meadow')

    await a.submit('north')
    await a.submit('take lamp')
    const inv = await a.submit('inventory')
    expect(inv.transcriptDelta.toLowerCase()).toMatch(/lamp/)
  })

  it('getSnapshot returns current state', async () => {
    const a = createMockAdapter()
    await a.load(new ArrayBuffer(8))
    await a.submit('north')
    expect(a.getSnapshot().location.name).toBe('Woods')
  })
})

describe('createAdapter', () => {
  it('returns mock adapter for kind mock', async () => {
    const a = createAdapter('mock')
    const s = await a.load(new ArrayBuffer(0))
    expect(s.location.name).toBe('Meadow')
  })
})
