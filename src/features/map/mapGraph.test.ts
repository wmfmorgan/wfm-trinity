import { describe, it, expect } from 'vitest'
import { emptyMap, applyVisit, moveRoom, selectRoom } from './mapGraph'
import { satisfiesDirection } from './mapLayout'

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
    expect(g.nodes['r2'].y).toBeLessThan(g.nodes['r1'].y)
    expect(
      satisfiesDirection(g.nodes['r1'], g.nodes['r2'], 'north', 80),
    ).toBe(true)
    expect(
      g.edges.some((e) => e.fromId === 'r1' && e.toId === 'r2' && e.dir === 'north'),
    ).toBe(true)
  })

  it('does not create unvisited destination nodes from exits alone', () => {
    let g = emptyMap('g1')
    g = applyVisit(g, { location: { id: 'r1', name: 'Meadow' }, turn: 0 })
    expect(Object.keys(g.nodes)).toHaveLength(1)
  })

  it('keeps rooms north of a hub after multi-path discovery (relayout)', () => {
    // Mirrors Trinity: Bottom of Stairs with Halfway + Vertex north of it,
    // even when those rooms were also linked via other paths.
    let g = emptyMap('g1')
    const cs = 80
    g = applyVisit(g, {
      location: { id: 'stairs', name: 'Bottom of Stairs' },
      turn: 0,
      cellSize: cs,
    })
    g = applyVisit(g, {
      location: { id: 'halfway', name: 'Halfway' },
      prevLocationId: 'stairs',
      movedDir: 'north',
      turn: 1,
      cellSize: cs,
    })
    g = applyVisit(g, {
      location: { id: 'vertex', name: 'Vertex' },
      prevLocationId: 'halfway',
      movedDir: 'northwest',
      turn: 2,
      cellSize: cs,
    })
    // Return and also connect vertex via another route that might confuse sticky layout
    g = applyVisit(g, {
      location: { id: 'stairs', name: 'Bottom of Stairs' },
      prevLocationId: 'halfway',
      movedDir: 'south',
      turn: 3,
      cellSize: cs,
    })
    g = applyVisit(g, {
      location: { id: 'bog', name: 'North Bog' },
      prevLocationId: 'stairs',
      movedDir: 'northeast',
      turn: 4,
      cellSize: cs,
    })
    g = applyVisit(g, {
      location: { id: 'vertex', name: 'Vertex' },
      prevLocationId: 'bog',
      movedDir: 'northwest',
      turn: 5,
      cellSize: cs,
    })

    const stairs = g.nodes['stairs']!
    const halfway = g.nodes['halfway']!
    const vertex = g.nodes['vertex']!
    expect(halfway.y).toBeLessThan(stairs.y)
    expect(vertex.y).toBeLessThan(stairs.y)
    expect(satisfiesDirection(stairs, halfway, 'north', cs)).toBe(true)
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

  it('places second north neighbor still north of hub (no south spill)', () => {
    let g = emptyMap('g1')
    const cs = 80
    g = applyVisit(g, { location: { id: 'hub', name: 'Hub' }, turn: 0, cellSize: cs })
    g = applyVisit(g, {
      location: { id: 'a', name: 'A' },
      prevLocationId: 'hub',
      movedDir: 'north',
      turn: 1,
      cellSize: cs,
    })
    g = applyVisit(g, {
      location: { id: 'b', name: 'B' },
      prevLocationId: 'hub',
      movedDir: 'north',
      turn: 2,
      cellSize: cs,
    })
    const hub = g.nodes['hub']!
    expect(g.nodes['a'].y).toBeLessThan(hub.y)
    expect(g.nodes['b'].y).toBeLessThan(hub.y)
    expect(`${g.nodes['a'].x},${g.nodes['a'].y}`).not.toBe(
      `${g.nodes['b'].x},${g.nodes['b'].y}`,
    )
  })

  it('places east room east of previous', () => {
    let g = emptyMap('g1')
    g = applyVisit(g, { location: { id: 'r1', name: 'A' }, turn: 0 })
    g = applyVisit(g, {
      location: { id: 'r2', name: 'B' },
      prevLocationId: 'r1',
      movedDir: 'east',
      turn: 1,
      cellSize: 80,
    })
    expect(g.nodes['r2'].x).toBeGreaterThan(g.nodes['r1'].x)
    expect(satisfiesDirection(g.nodes['r1'], g.nodes['r2'], 'east', 80)).toBe(
      true,
    )
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

  it('updates name on revisit', () => {
    let g = emptyMap('g1')
    g = applyVisit(g, { location: { id: 'r1', name: 'Dark' }, turn: 0 })
    g = applyVisit(g, { location: { id: 'r1', name: 'Kitchen' }, turn: 3 })
    expect(g.nodes['r1']).toMatchObject({
      name: 'Kitchen',
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

describe('moveRoom', () => {
  it('pins room at manual coordinates and survives relayout', () => {
    let g = emptyMap('g1')
    const cs = 80
    g = applyVisit(g, {
      location: { id: 'hub', name: 'Hub' },
      turn: 0,
      cellSize: cs,
    })
    g = applyVisit(g, {
      location: { id: 'north', name: 'North' },
      prevLocationId: 'hub',
      movedDir: 'north',
      turn: 1,
      cellSize: cs,
    })

    g = moveRoom(g, 'north', 400, 200)
    expect(g.nodes['north']).toMatchObject({
      x: 400,
      y: 200,
      manual: true,
    })

    // Discover another room — relayout must not move the pinned node
    g = applyVisit(g, {
      location: { id: 'east', name: 'East' },
      prevLocationId: 'hub',
      movedDir: 'east',
      turn: 2,
      cellSize: cs,
    })
    expect(g.nodes['north']).toMatchObject({ x: 400, y: 200, manual: true })
    expect(g.nodes['east']).toBeDefined()
  })
})
