import type { Direction, MapEdge, MapGraphState, RoomNode } from '../../domain/types'
import { reverseDir } from '../../domain/directions'
import {
  DEFAULT_CELL_SIZE,
  findFreeCell,
  isLayoutDir,
  occupiedKeys,
  preferredPosition,
  relayoutPositions,
} from './mapLayout'

export function emptyMap(gameId: string): MapGraphState {
  return { gameId, nodes: {}, edges: [] }
}

export function applyVisit(
  graph: MapGraphState,
  args: {
    location: { id: string; name: string }
    prevLocationId?: string
    movedDir?: Direction | null
    turn: number
    cellSize?: number
  },
): MapGraphState {
  const cellSize = args.cellSize ?? DEFAULT_CELL_SIZE
  const { id, name } = args.location
  const turn = args.turn
  const movedDir = args.movedDir ?? null

  const existing = graph.nodes[id]
  let nodes: Record<string, RoomNode>
  let edges = graph.edges

  if (existing) {
    nodes = {
      ...graph.nodes,
      [id]: {
        ...existing,
        name,
        lastVisitTurn: turn,
        // preserve existing.manual pin
      },
    }
  } else {
    const pos = placeNewRoom(
      graph,
      args.prevLocationId,
      movedDir,
      cellSize,
    )
    nodes = {
      ...graph.nodes,
      [id]: {
        id,
        name,
        firstVisitTurn: turn,
        lastVisitTurn: turn,
        x: pos.x,
        y: pos.y,
      },
    }
  }

  // Only link rooms when the move is a layout direction (cardinals/diagonals/up/down).
  // Teleports and in/out place the room freely with no connecting edge.
  if (
    args.prevLocationId &&
    args.prevLocationId !== id &&
    isLayoutDir(movedDir)
  ) {
    edges = addEdge(edges, args.prevLocationId, id, movedDir)
  }

  // Re-solve coordinates only when a layout edge was involved so N/S/E/W/up/down
  // stay geometrically consistent. Teleports free-place without reshuffling.
  const shouldRelayout =
    args.prevLocationId != null &&
    args.prevLocationId !== id &&
    isLayoutDir(movedDir)

  if (shouldRelayout && Object.keys(nodes).length > 1) {
    nodes = relayoutPositions(nodes, edges, cellSize)
  }

  return { gameId: graph.gameId, nodes, edges }
}

export function selectRoom(
  graph: MapGraphState,
  roomId: string | null,
): string | null {
  if (roomId == null) return null
  return graph.nodes[roomId] ? roomId : null
}

/**
 * User-drag a room to a new world position. Marks the node as `manual` so
 * subsequent auto-relayout will not move it.
 */
export function moveRoom(
  graph: MapGraphState,
  roomId: string,
  x: number,
  y: number,
): MapGraphState {
  const node = graph.nodes[roomId]
  if (!node) return graph
  return {
    ...graph,
    nodes: {
      ...graph.nodes,
      [roomId]: {
        ...node,
        x,
        y,
        manual: true,
      },
    },
  }
}

/** Clear manual pin so auto-layout may move the room again. */
export function clearRoomManual(
  graph: MapGraphState,
  roomId: string,
): MapGraphState {
  const node = graph.nodes[roomId]
  if (!node || !node.manual) return graph
  const { manual: _m, ...rest } = node
  return {
    ...graph,
    nodes: {
      ...graph.nodes,
      [roomId]: { ...rest, manual: false },
    },
  }
}

function placeNewRoom(
  graph: MapGraphState,
  prevLocationId: string | undefined,
  movedDir: Direction | null | undefined,
  cellSize: number,
): { x: number; y: number } {
  const occupied = occupiedKeys(graph.nodes)

  if (!prevLocationId || !graph.nodes[prevLocationId]) {
    return findFreeCell({ x: 0, y: 0 }, occupied, cellSize)
  }

  const prev = graph.nodes[prevLocationId]!
  const preferred = preferredPosition(prev, movedDir, cellSize)
  return findFreeCell(preferred, occupied, cellSize, {
    origin: prev,
    dir: movedDir,
  })
}

function isReverseEdge(
  e: MapEdge,
  fromId: string,
  toId: string,
  dir: Direction | null,
): boolean {
  if (e.fromId !== toId || e.toId !== fromId) return false
  if (dir === null) return e.dir === null
  const rev = reverseDir(dir)
  return e.dir === rev || e.dir === null
}

function addEdge(
  edges: MapEdge[],
  fromId: string,
  toId: string,
  dir: Direction | null,
): MapEdge[] {
  if (edges.some((e) => e.fromId === fromId && e.toId === toId && e.dir === dir)) {
    return edges
  }

  const hasReverse = edges.some((e) => isReverseEdge(e, fromId, toId, dir))
  const newEdge: MapEdge = {
    fromId,
    toId,
    dir,
    bidirectional: hasReverse,
  }

  if (!hasReverse) {
    return [...edges, newEdge]
  }

  return [
    ...edges.map((e) =>
      isReverseEdge(e, fromId, toId, dir) ? { ...e, bidirectional: true } : e,
    ),
    newEdge,
  ]
}
