import { describe, it, expect } from 'vitest'
import { emptyMap, applyVisit, selectRoom } from './mapGraph'

describe('emptyMap', () => {
  it('creates empty graph for gameId', () => {
    const g = emptyMap('g1')
    expect(g).toEqual({ gameId: 'g1', nodes: {}, edges: [] })
  })
})

describe('applyVisit', () => {
  it('adds first room at origin', () => {
    let g = emptyMap('g1')
    g = applyVisit(g, { location: { id: 'r1', name: 'Meadow' }, turn: 0 })
    expect(g.nodes['r1']).toMatchObject({
      id: 'r1',
      x: 0,
      y: 0,
      name: 'Meadow',
      firstVisitTurn: 0,
      lastVisitTurn: 0,
    })
  })

  it('places north room at dy -cellSize and adds edge', () => {
    let g = emptyMap('g1')
    g = applyVisit(g, { location: { id: 'r1', name: 'Meadow' }, turn: 0 })
    g = applyVisit(g, {
      location: { id: 'r2', name: 'Woods' },
      prevLocationId: 'r1',
      movedDir: 'north',
      turn: 1,
      cellSize: 80,
    })
    expect(g.nodes['r2'].y).toBe(-80)
    expect(g.nodes['r2'].x).toBe(0)
    expect(
      g.edges.some((e) => e.fromId === 'r1' && e.toId === 'r2' && e.dir === 'north'),
    ).toBe(true)
  })

  it('does not create unvisited destination nodes from exits alone', () => {
    // applyVisit only — no exit-table room creation API
    let g = emptyMap('g1')
    g = applyVisit(g, { location: { id: 'r1', name: 'Meadow' }, turn: 0 })
    expect(Object.keys(g.nodes)).toHaveLength(1)
  })

  it('does not reflow existing node coordinates', () => {
    let g = emptyMap('g1')
    g = applyVisit(g, { location: { id: 'r1', name: 'Meadow' }, turn: 0 })
    g = applyVisit(g, {
      location: { id: 'r2', name: 'Woods' },
      prevLocationId: 'r1',
      movedDir: 'north',
      turn: 1,
      cellSize: 80,
    })
    const r1Before = { ...g.nodes['r1'] }
    g = applyVisit(g, {
      location: { id: 'r1', name: 'Meadow' },
      prevLocationId: 'r2',
      movedDir: 'south',
      turn: 2,
      cellSize: 80,
    })
    expect(g.nodes['r1'].x).toBe(r1Before.x)
    expect(g.nodes['r1'].y).toBe(r1Before.y)
    expect(g.nodes['r1'].lastVisitTurn).toBe(2)
    expect(g.nodes['r1'].firstVisitTurn).toBe(0)
  })

  it('marks edges bidirectional when reverse exists', () => {
    let g = emptyMap('g1')
    g = applyVisit(g, { location: { id: 'r1', name: 'Meadow' }, turn: 0 })
    g = applyVisit(g, {
      location: { id: 'r2', name: 'Woods' },
      prevLocationId: 'r1',
      movedDir: 'north',
      turn: 1,
      cellSize: 80,
    })
    g = applyVisit(g, {
      location: { id: 'r1', name: 'Meadow' },
      prevLocationId: 'r2',
      movedDir: 'south',
      turn: 2,
      cellSize: 80,
    })
    const north = g.edges.find((e) => e.fromId === 'r1' && e.toId === 'r2')
    const south = g.edges.find((e) => e.fromId === 'r2' && e.toId === 'r1')
    expect(north?.bidirectional).toBe(true)
    expect(south?.bidirectional).toBe(true)
    expect(south?.dir).toBe('south')
  })

  it('spiral-nudges when preferred cell is occupied', () => {
    let g = emptyMap('g1')
    g = applyVisit(g, { location: { id: 'r1', name: 'Hub' }, turn: 0 })
    // Place A north of hub
    g = applyVisit(g, {
      location: { id: 'a', name: 'A' },
      prevLocationId: 'r1',
      movedDir: 'north',
      turn: 1,
      cellSize: 80,
    })
    // Teleport/back: place B also claiming north of hub → collision with A
    g = applyVisit(g, {
      location: { id: 'b', name: 'B' },
      prevLocationId: 'r1',
      movedDir: 'north',
      turn: 2,
      cellSize: 80,
    })
    expect(g.nodes['a']).toMatchObject({ x: 0, y: -80 })
    // B must not share A's cell
    expect(`${g.nodes['b'].x},${g.nodes['b'].y}`).not.toBe('0,-80')
    // Still on grid multiples of cellSize (Object.is treats -0 ≠ 0)
    expect(g.nodes['b'].x % 80 === 0).toBe(true)
    expect(g.nodes['b'].y % 80 === 0).toBe(true)
  })

  it('places east room at +cellSize x', () => {
    let g = emptyMap('g1')
    g = applyVisit(g, { location: { id: 'r1', name: 'A' }, turn: 0 })
    g = applyVisit(g, {
      location: { id: 'r2', name: 'B' },
      prevLocationId: 'r1',
      movedDir: 'east',
      turn: 1,
      cellSize: 80,
    })
    expect(g.nodes['r2']).toMatchObject({ x: 80, y: 0 })
  })

  it('adds undirected edge when move has no direction', () => {
    let g = emptyMap('g1')
    g = applyVisit(g, { location: { id: 'r1', name: 'A' }, turn: 0 })
    g = applyVisit(g, {
      location: { id: 'r2', name: 'B' },
      prevLocationId: 'r1',
      movedDir: null,
      turn: 1,
    })
    expect(g.nodes['r2']).toBeDefined()
    expect(
      g.edges.some((e) => e.fromId === 'r1' && e.toId === 'r2' && e.dir === null),
    ).toBe(true)
  })

  it('does not duplicate an existing same-direction edge', () => {
    let g = emptyMap('g1')
    g = applyVisit(g, { location: { id: 'r1', name: 'A' }, turn: 0 })
    g = applyVisit(g, {
      location: { id: 'r2', name: 'B' },
      prevLocationId: 'r1',
      movedDir: 'east',
      turn: 1,
    })
    g = applyVisit(g, {
      location: { id: 'r2', name: 'B' },
      prevLocationId: 'r1',
      movedDir: 'east',
      turn: 2,
    })
    const matches = g.edges.filter(
      (e) => e.fromId === 'r1' && e.toId === 'r2' && e.dir === 'east',
    )
    expect(matches).toHaveLength(1)
  })

  it('updates name on revisit without changing layout', () => {
    let g = emptyMap('g1')
    g = applyVisit(g, { location: { id: 'r1', name: 'Dark' }, turn: 0 })
    g = applyVisit(g, { location: { id: 'r1', name: 'Kitchen' }, turn: 3 })
    expect(g.nodes['r1']).toMatchObject({
      name: 'Kitchen',
      x: 0,
      y: 0,
      firstVisitTurn: 0,
      lastVisitTurn: 3,
    })
  })

  it('is non-mutating', () => {
    const g0 = emptyMap('g1')
    const g1 = applyVisit(g0, { location: { id: 'r1', name: 'A' }, turn: 0 })
    expect(g0.nodes).toEqual({})
    expect(g1.nodes['r1']).toBeDefined()
  })
})

describe('selectRoom', () => {
  it('returns roomId when present', () => {
    let g = emptyMap('g1')
    g = applyVisit(g, { location: { id: 'r1', name: 'Meadow' }, turn: 0 })
    expect(selectRoom(g, 'r1')).toBe('r1')
  })

  it('returns null for unknown or null id', () => {
    const g = emptyMap('g1')
    expect(selectRoom(g, null)).toBeNull()
    expect(selectRoom(g, 'missing')).toBeNull()
  })
})
