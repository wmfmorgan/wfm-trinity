import type { Direction, MapEdge, MapGraphState, RoomNode } from '../../domain/types'
import { reverseDir } from '../../domain/directions'
import {
  DEFAULT_CELL_SIZE,
  findFreeCell,
  occupiedKeys,
  preferredPosition,
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

  const existing = graph.nodes[id]
  let nodes: Record<string, RoomNode>

  if (existing) {
    nodes = {
      ...graph.nodes,
      [id]: {
        ...existing,
        name,
        lastVisitTurn: turn,
      },
    }
  } else {
    const pos = placeNewRoom(graph, args.prevLocationId, args.movedDir, cellSize)
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

  let edges = graph.edges
  if (args.prevLocationId && args.prevLocationId !== id) {
    edges = addEdge(edges, args.prevLocationId, id, args.movedDir ?? null)
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

function placeNewRoom(
  graph: MapGraphState,
  prevLocationId: string | undefined,
  movedDir: Direction | null | undefined,
  cellSize: number,
): { x: number; y: number } {
  const occupied = occupiedKeys(graph.nodes)

  if (!prevLocationId || !graph.nodes[prevLocationId]) {
    // First room (or orphan visit): origin, or spiral if origin taken
    return findFreeCell({ x: 0, y: 0 }, occupied, cellSize)
  }

  const prev = graph.nodes[prevLocationId]
  const preferred = preferredPosition(prev, movedDir, cellSize)
  return findFreeCell(preferred, occupied, cellSize)
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
