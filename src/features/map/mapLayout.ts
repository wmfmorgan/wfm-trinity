import type { Direction, MapEdge, RoomNode } from '../../domain/types'
import { deltaForDir, reverseDir } from '../../domain/directions'

/** Grid spacing between rooms — keep larger than MapView NODE_W so labels don't collide. */
export const DEFAULT_CELL_SIZE = 120

const PLANAR_DIRS = new Set<Direction>([
  'north',
  'south',
  'east',
  'west',
  'northeast',
  'northwest',
  'southeast',
  'southwest',
])

export function isPlanarDir(
  dir: Direction | null | undefined,
): dir is Direction {
  return dir != null && PLANAR_DIRS.has(dir)
}

/** Preferred placement relative to previous room for a move direction. */
export function preferredPosition(
  prev: { x: number; y: number },
  movedDir: Direction | null | undefined,
  cellSize: number,
): { x: number; y: number } {
  if (!movedDir || !isPlanarDir(movedDir)) {
    return { x: prev.x, y: prev.y }
  }
  const { dx, dy } = deltaForDir(movedDir)
  return {
    x: prev.x + dx * cellSize,
    y: prev.y + dy * cellSize,
  }
}

export function cellKey(x: number, y: number): string {
  const nx = Object.is(x, -0) ? 0 : x
  const ny = Object.is(y, -0) ? 0 : y
  return `${nx},${ny}`
}

/**
 * True if `to` lies in direction `dir` from `from`.
 * Cardinals require matching column/row; all require at least one cell of progress.
 */
export function satisfiesDirection(
  from: { x: number; y: number },
  to: { x: number; y: number },
  dir: Direction,
  cellSize: number,
): boolean {
  const { dx, dy } = deltaForDir(dir)
  const rx = to.x - from.x
  const ry = to.y - from.y

  if (dx === 0 && dy === 0) return true

  if (dx === 0) {
    // Pure N/S: same column, correct vertical side, at least one cell away
    if (rx !== 0) return false
    if (Math.sign(ry) !== Math.sign(dy)) return false
    return Math.abs(ry) >= cellSize
  }
  if (dy === 0) {
    // Pure E/W
    if (ry !== 0) return false
    if (Math.sign(rx) !== Math.sign(dx)) return false
    return Math.abs(rx) >= cellSize
  }
  // Diagonal: both axes must advance correctly
  if (Math.sign(rx) !== Math.sign(dx) || Math.sign(ry) !== Math.sign(dy)) {
    return false
  }
  return Math.abs(rx) >= cellSize && Math.abs(ry) >= cellSize
}

/**
 * Free cell near preferred, biased to preserve `dir` from `origin`.
 * For a north move, only accepts cells still north of origin until exhausted.
 */
export function findFreeCell(
  preferred: { x: number; y: number },
  occupied: Set<string>,
  cellSize: number,
  opts?: {
    origin?: { x: number; y: number }
    dir?: Direction | null
  },
): { x: number; y: number } {
  const origin = opts?.origin
  const dir = opts?.dir

  const tryPos = (x: number, y: number): { x: number; y: number } | null => {
    if (occupied.has(cellKey(x, y))) return null
    if (origin && dir && isPlanarDir(dir)) {
      if (!satisfiesDirection(origin, { x, y }, dir, cellSize)) return null
    }
    return { x, y }
  }

  const direct = tryPos(preferred.x, preferred.y)
  if (direct) return direct

  for (const off of directionBiasedOffsets(dir, cellSize)) {
    const hit = tryPos(preferred.x + off.x, preferred.y + off.y)
    if (hit) return hit
  }

  for (let radius = 1; radius < 40; radius++) {
    for (let step = -radius; step <= radius; step++) {
      const candidates = [
        { x: preferred.x + step * cellSize, y: preferred.y - radius * cellSize },
        { x: preferred.x + step * cellSize, y: preferred.y + radius * cellSize },
        { x: preferred.x - radius * cellSize, y: preferred.y + step * cellSize },
        { x: preferred.x + radius * cellSize, y: preferred.y + step * cellSize },
      ]
      for (const c of candidates) {
        const hit = tryPos(c.x, c.y)
        if (hit) return hit
      }
    }
  }

  // Last resort: ignore direction
  for (let radius = 0; radius < 40; radius++) {
    for (let step = -radius; step <= radius; step++) {
      const candidates =
        radius === 0
          ? [preferred]
          : [
              {
                x: preferred.x + step * cellSize,
                y: preferred.y - radius * cellSize,
              },
              {
                x: preferred.x + step * cellSize,
                y: preferred.y + radius * cellSize,
              },
              {
                x: preferred.x - radius * cellSize,
                y: preferred.y + step * cellSize,
              },
              {
                x: preferred.x + radius * cellSize,
                y: preferred.y + step * cellSize,
              },
            ]
      for (const c of candidates) {
        if (!occupied.has(cellKey(c.x, c.y))) return c
      }
    }
  }

  return { x: preferred.x + cellSize, y: preferred.y }
}

function directionBiasedOffsets(
  dir: Direction | null | undefined,
  cellSize: number,
): Array<{ x: number; y: number }> {
  if (!dir || !isPlanarDir(dir)) {
    return [
      { x: cellSize, y: 0 },
      { x: -cellSize, y: 0 },
      { x: 0, y: cellSize },
      { x: 0, y: -cellSize },
    ]
  }
  const { dx, dy } = deltaForDir(dir)
  if (dx === 0 && dy !== 0) {
    return [
      { x: cellSize, y: 0 },
      { x: -cellSize, y: 0 },
      { x: 2 * cellSize, y: 0 },
      { x: -2 * cellSize, y: 0 },
      { x: 0, y: dy * cellSize },
      { x: cellSize, y: dy * cellSize },
      { x: -cellSize, y: dy * cellSize },
    ]
  }
  if (dy === 0 && dx !== 0) {
    return [
      { x: 0, y: cellSize },
      { x: 0, y: -cellSize },
      { x: 0, y: 2 * cellSize },
      { x: 0, y: -2 * cellSize },
      { x: dx * cellSize, y: 0 },
      { x: dx * cellSize, y: cellSize },
      { x: dx * cellSize, y: -cellSize },
    ]
  }
  return [
    { x: dx * cellSize, y: 0 },
    { x: 0, y: dy * cellSize },
    { x: -dx * cellSize, y: dy * cellSize },
    { x: dx * cellSize, y: -dy * cellSize },
  ]
}

export function occupiedKeys(
  nodes: Record<string, { x: number; y: number }>,
  excludeId?: string,
): Set<string> {
  const set = new Set<string>()
  for (const [id, n] of Object.entries(nodes)) {
    if (excludeId && id === excludeId) continue
    set.add(cellKey(n.x, n.y))
  }
  return set
}

/**
 * Rebuild node coordinates from directional edges so N/S/E/W order stays true.
 * Nodes with `manual: true` keep their coordinates and act as fixed anchors.
 */
export function relayoutPositions(
  nodes: Record<string, RoomNode>,
  edges: MapEdge[],
  cellSize: number,
): Record<string, RoomNode> {
  const ids = Object.keys(nodes)
  if (ids.length === 0) return nodes

  const isManual = (id: string) => nodes[id]?.manual === true

  type Link = { to: string; dir: Direction }
  const out = new Map<string, Link[]>()
  const undirected = new Map<string, string[]>()

  function addUndirected(a: string, b: string) {
    if (!undirected.has(a)) undirected.set(a, [])
    if (!undirected.has(b)) undirected.set(b, [])
    if (!undirected.get(a)!.includes(b)) undirected.get(a)!.push(b)
    if (!undirected.get(b)!.includes(a)) undirected.get(b)!.push(a)
  }

  for (const e of edges) {
    if (!nodes[e.fromId] || !nodes[e.toId]) continue
    addUndirected(e.fromId, e.toId)
    if (isPlanarDir(e.dir)) {
      if (!out.has(e.fromId)) out.set(e.fromId, [])
      out.get(e.fromId)!.push({ to: e.toId, dir: e.dir })
    }
  }

  const root = ids.reduce((best, id) =>
    nodes[id]!.firstVisitTurn < nodes[best]!.firstVisitTurn ? id : best,
  )

  const positions = new Map<string, { x: number; y: number }>()
  const occupied = new Set<string>()

  function place(id: string, x: number, y: number) {
    positions.set(id, { x, y })
    occupied.add(cellKey(x, y))
  }

  // Seed all user-pinned rooms first (override auto arrangement)
  for (const id of ids) {
    if (!isManual(id)) continue
    const n = nodes[id]!
    // If two manuals collide on same cell, keep first; nudge later ones
    if (occupied.has(cellKey(n.x, n.y))) {
      const nudged = findFreeCell({ x: n.x, y: n.y }, occupied, cellSize)
      place(id, nudged.x, nudged.y)
    } else {
      place(id, n.x, n.y)
    }
  }

  const queue: string[] = []
  const seen = new Set<string>()

  // Start BFS from manual nodes and earliest root
  for (const id of ids) {
    if (isManual(id)) {
      seen.add(id)
      queue.push(id)
    }
  }
  if (!seen.has(root)) {
    if (isManual(root)) {
      // already queued
    } else {
      place(root, 0, 0)
      seen.add(root)
      queue.push(root)
    }
  }
  if (queue.length === 0) {
    place(root, 0, 0)
    seen.add(root)
    queue.push(root)
  }

  const placeNeighbor = (
    fromId: string,
    toId: string,
    dir: Direction | null,
  ) => {
    if (seen.has(toId)) return
    // Manual rooms already fixed
    if (isManual(toId)) {
      seen.add(toId)
      queue.push(toId)
      return
    }
    const fromPos = positions.get(fromId)
    if (!fromPos) return
    const preferred = preferredPosition(fromPos, dir, cellSize)
    const fallback = dir
      ? preferred
      : { x: fromPos.x + cellSize, y: fromPos.y }
    const pos = findFreeCell(fallback, occupied, cellSize, {
      origin: fromPos,
      dir,
    })
    place(toId, pos.x, pos.y)
    seen.add(toId)
    queue.push(toId)
  }

  while (queue.length > 0) {
    const id = queue.shift()!

    for (const { to, dir } of out.get(id) ?? []) {
      placeNeighbor(id, to, dir)
    }

    for (const e of edges) {
      if (e.toId !== id || !isPlanarDir(e.dir)) continue
      const dirFromHere = reverseDir(e.dir)
      placeNeighbor(id, e.fromId, dirFromHere)
    }

    for (const nb of undirected.get(id) ?? []) {
      if (seen.has(nb)) continue
      const forward = edges.find(
        (e) => e.fromId === id && e.toId === nb && isPlanarDir(e.dir),
      )
      const backward = edges.find(
        (e) => e.fromId === nb && e.toId === id && isPlanarDir(e.dir),
      )
      let dir: Direction | null = null
      if (forward?.dir) dir = forward.dir
      else if (backward?.dir) dir = reverseDir(backward.dir)
      placeNeighbor(id, nb, dir)
    }
  }

  // Disconnected auto components
  for (const id of ids) {
    if (seen.has(id)) continue
    if (isManual(id)) {
      seen.add(id)
      continue
    }
    const pos = findFreeCell({ x: 0, y: 0 }, occupied, cellSize)
    place(id, pos.x, pos.y)
    seen.add(id)
    queue.push(id)
    while (queue.length > 0) {
      const cur = queue.shift()!
      for (const { to, dir } of out.get(cur) ?? []) {
        placeNeighbor(cur, to, dir)
      }
      for (const nb of undirected.get(cur) ?? []) {
        if (seen.has(nb)) continue
        placeNeighbor(cur, nb, null)
      }
    }
  }

  repairDirectionalConstraints(positions, edges, cellSize, occupied, isManual)

  const next: Record<string, RoomNode> = {}
  for (const id of ids) {
    const p = positions.get(id) ?? { x: nodes[id]!.x, y: nodes[id]!.y }
    if (isManual(id)) {
      // Keep pinned; use placed coords if we had to nudge for collisions
      next[id] = {
        ...nodes[id]!,
        x: p.x,
        y: p.y,
        manual: true,
      }
    } else {
      next[id] = { ...nodes[id]!, x: p.x, y: p.y, manual: false }
    }
  }
  return next
}

function repairDirectionalConstraints(
  positions: Map<string, { x: number; y: number }>,
  edges: MapEdge[],
  cellSize: number,
  occupied: Set<string>,
  isManual: (id: string) => boolean,
): void {
  for (let pass = 0; pass < 12; pass++) {
    let moved = false
    for (const e of edges) {
      if (!isPlanarDir(e.dir)) continue
      // Never move user-pinned rooms
      if (isManual(e.toId)) continue
      const from = positions.get(e.fromId)
      const to = positions.get(e.toId)
      if (!from || !to) continue
      if (satisfiesDirection(from, to, e.dir, cellSize)) continue

      const ideal = preferredPosition(from, e.dir, cellSize)
      occupied.delete(cellKey(to.x, to.y))
      const placed = findFreeCell(ideal, occupied, cellSize, {
        origin: from,
        dir: e.dir,
      })
      positions.set(e.toId, placed)
      occupied.add(cellKey(placed.x, placed.y))
      moved = true
    }
    if (!moved) break
  }
}
