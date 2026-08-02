import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import type { ExitInfo, MapGraphState } from '../../domain/types'
import { MapView } from './MapView'

function graphWithRooms(
  rooms: Array<{ id: string; name: string; x: number; y: number }>,
  edges: MapGraphState['edges'] = [],
): MapGraphState {
  const nodes: MapGraphState['nodes'] = {}
  for (const r of rooms) {
    nodes[r.id] = {
      id: r.id,
      name: r.name,
      x: r.x,
      y: r.y,
      firstVisitTurn: 0,
      lastVisitTurn: 0,
    }
  }
  return { gameId: 'g1', nodes, edges }
}

const oneRoom = graphWithRooms([{ id: 'meadow', name: 'Meadow', x: 0, y: 0 }])

describe('MapView', () => {
  it('renders room name for a single node', () => {
    render(
      <MapView
        graph={oneRoom}
        currentRoomId="meadow"
        exits={[]}
        onSelectRoom={vi.fn()}
      />,
    )
    expect(
      screen.getByRole('button', { name: /Current room: Meadow/i }),
    ).toBeInTheDocument()
    expect(screen.getAllByText('Meadow').length).toBeGreaterThan(0)
  })

  it('shows empty state when graph has no nodes', () => {
    render(
      <MapView
        graph={{ gameId: 'g1', nodes: {}, edges: [] }}
        currentRoomId=""
        exits={[]}
        onSelectRoom={vi.fn()}
      />,
    )
    expect(screen.getByRole('status')).toHaveTextContent(
      'Explore to chart the map.',
    )
  })

  it('clicking a room selects it only (does not walk)', async () => {
    const user = userEvent.setup()
    const onSelectRoom = vi.fn()
    const graph = graphWithRooms([
      { id: 'meadow', name: 'Meadow', x: 0, y: 0 },
      { id: 'woods', name: 'Woods', x: 0, y: -80 },
    ])

    render(
      <MapView
        graph={graph}
        currentRoomId="meadow"
        exits={[{ dir: 'north', toId: 'woods' }]}
        onSelectRoom={onSelectRoom}
      />,
    )

    await user.click(screen.getByRole('button', { name: /Room: Woods/i }))
    expect(onSelectRoom).toHaveBeenCalledTimes(1)
    expect(onSelectRoom).toHaveBeenCalledWith('woods')
  })

  it('marks current room with data-current', () => {
    const graph = graphWithRooms([
      { id: 'meadow', name: 'Meadow', x: 0, y: 0 },
      { id: 'woods', name: 'Woods', x: 0, y: -80 },
    ])
    const { container } = render(
      <MapView
        graph={graph}
        currentRoomId="woods"
        exits={[]}
        onSelectRoom={vi.fn()}
      />,
    )
    const current = container.querySelector('[data-current="true"]')
    expect(current).toHaveAttribute('data-room-id', 'woods')
    expect(
      screen.getByRole('button', { name: /Current room: Woods/i }),
    ).toBeInTheDocument()
  })

  it('draws exit stubs for dirs without known edge target', () => {
    const graph = graphWithRooms([
      { id: 'meadow', name: 'Meadow', x: 0, y: 0 },
    ])
    const exits: ExitInfo[] = [
      { dir: 'north' }, // unknown destination
      { dir: 'east' },
    ]
    const { container } = render(
      <MapView
        graph={graph}
        currentRoomId="meadow"
        exits={exits}
        onSelectRoom={vi.fn()}
      />,
    )
    expect(container.querySelector('[data-stub-dir="north"]')).toBeTruthy()
    expect(container.querySelector('[data-stub-dir="east"]')).toBeTruthy()
  })

  it('does not stub dirs that already have a known edge target', () => {
    const graph = graphWithRooms(
      [
        { id: 'meadow', name: 'Meadow', x: 0, y: 0 },
        { id: 'woods', name: 'Woods', x: 0, y: -80 },
      ],
      [
        {
          fromId: 'meadow',
          toId: 'woods',
          dir: 'north',
          bidirectional: false,
        },
      ],
    )
    const exits: ExitInfo[] = [
      { dir: 'north', toId: 'woods' },
      { dir: 'east' }, // still unknown
    ]
    const { container } = render(
      <MapView
        graph={graph}
        currentRoomId="meadow"
        exits={exits}
        onSelectRoom={vi.fn()}
      />,
    )
    expect(container.querySelector('[data-stub-dir="north"]')).toBeNull()
    expect(container.querySelector('[data-stub-dir="east"]')).toBeTruthy()
  })

  it('wheel zoom clamps between 0.4 and 2.5', () => {
    render(
      <MapView
        graph={oneRoom}
        currentRoomId="meadow"
        exits={[]}
        onSelectRoom={vi.fn()}
      />,
    )
    const svg = screen.getByRole('img', { name: 'Game map' })

    // Zoom in hard
    for (let i = 0; i < 40; i++) {
      fireEvent.wheel(svg, { deltaY: -120, clientX: 100, clientY: 100 })
    }
    let k = Number(svg.getAttribute('data-zoom'))
    expect(k).toBeLessThanOrEqual(2.5)
    expect(k).toBeGreaterThanOrEqual(0.4)

    // Zoom out hard
    for (let i = 0; i < 80; i++) {
      fireEvent.wheel(svg, { deltaY: 120, clientX: 100, clientY: 100 })
    }
    k = Number(svg.getAttribute('data-zoom'))
    expect(k).toBeGreaterThanOrEqual(0.4)
    expect(k).toBeLessThanOrEqual(2.5)
    expect(k).toBeCloseTo(0.4, 1)
  })

  it('recenter button centers camera and calls onRecenter', async () => {
    const user = userEvent.setup()
    const onRecenter = vi.fn()
    render(
      <MapView
        graph={oneRoom}
        currentRoomId="meadow"
        exits={[]}
        onSelectRoom={vi.fn()}
        onRecenter={onRecenter}
      />,
    )
    await user.click(
      screen.getByRole('button', { name: /Recenter map on current room/i }),
    )
    expect(onRecenter).toHaveBeenCalledTimes(1)
  })

  it('reflects selectedRoomId on the node', () => {
    const graph = graphWithRooms([
      { id: 'meadow', name: 'Meadow', x: 0, y: 0 },
      { id: 'woods', name: 'Woods', x: 0, y: -80 },
    ])
    const { container } = render(
      <MapView
        graph={graph}
        currentRoomId="meadow"
        selectedRoomId="woods"
        exits={[]}
        onSelectRoom={vi.fn()}
      />,
    )
    const selected = container.querySelector('[data-selected="true"]')
    expect(selected).toHaveAttribute('data-room-id', 'woods')
  })
})
