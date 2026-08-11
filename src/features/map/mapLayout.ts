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

const VERTICAL_DIRS = new Set<Direction>(['up', 'down'])

/** Compass / diagonal directions that constrain planar map geometry. */
export function isPlanarDir(
  dir: Direction | null | undefined,
): dir is Direction {
  return dir != null && PLANAR_DIRS.has(dir)
}

/** Stairs/ladders — stacked vertically on the 2D map. */
export function isVerticalDir(
  dir: Direction | null | undefined,
): dir is Direction {
  return dir != null && VERTICAL_DIRS.has(dir)
}

/**
 * Directions that participate in layout (edges + geometric constraints).
 * Excludes null (teleports), in/out (unconventional non-cardinal links).
 */
export function isLayoutDir(
  dir: Direction | null | undefined,
): dir is Direction {
  return isPlanarDir(dir) || isVerticalDir(dir)
}

/** Preferred placement relative to previous room for a move direction. */
export function preferredPosition(
  prev: { x: number; y: number },
  movedDir: Direction | null | undefined,
  cellSize: number,
): { x: number; y: number } {
  if (!movedDir || !isLayoutDir(movedDir)) {
    // Free-place islands (teleport / in / out): park away from origin so
    // unconventional arrivals do not stack on top of the previous room.
    return { x: prev.x + cellSize * 2, y: prev.y }
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
 * Cardinals/verticals require matching column/row; all require at least one cell of progress.
 */
export function satisfiesDirection(
  from: { x: number; y: number },
  to: { x: number; y: number },
  dir: Direction,
  cellSize: number,
): boolean {
  if (!isLayoutDir(dir)) return true

  const { dx, dy } = deltaForDir(dir)
  const rx = to.x - from.x
  const ry = to.y - from.y

  if (dx === 0 && dy === 0) return true

  if (dx === 0) {
    // Pure N/S or up/down: same column, correct vertical side, ≥1 cell away
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
    if (origin && dir && isLayoutDir(dir)) {
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
  if (!dir || !isLayoutDir(dir)) {
    return [
      { x: cellSize, y: 0 },
      { x: -cellSize, y: 0 },
      { x: 0, y: cellSize },
      { x: 0, y: -cellSize },
      { x: cellSize * 2, y: cellSize },
      { x: cellSize * 2, y: -cellSize },
      { x: -cellSize * 2, y: 0 },
    ]
  }
  const { dx, dy } = deltaForDir(dir)
  if (dx === 0 && dy !== 0) {
    // N/S or up/down: slide sideways when preferred cell is taken
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
 * Walk further along `dir` from `start` until a free cell is found (map expansion).
 */
function freeCellAlongDir(
  start: { x: number; y: number },
  dir: Direction,
  occupied: Set<string>,
  cellSize: number,
  maxSteps = 40,
): { x: number; y: number } {
  let pos = start
  for (let i = 0; i < maxSteps; i++) {
    if (!occupied.has(cellKey(pos.x, pos.y))) return pos
    pos = preferredPosition(pos, dir, cellSize)
  }
  return findFreeCell(start, occupied, cellSize)
}

/**
 * Rebuild node coordinates from directional edges so N/S/E/W/up/down order stays true.
 * Nodes with `manual: true` keep their coordinates and act as fixed anchors.
 * Teleport / in / out edges are ignored for connectivity (no forced links).
 *
 * After initial placement, iteratively:
 *  1. Enforces directional min-spacing (expanding further along the edge if needed)
 *  2. Separates same-cell collisions by expanding north (then along free dirs)
 * so new rooms claim space without stacking on existing ones.
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
    if (!isLayoutDir(e.dir)) continue
    addUndirected(e.fromId, e.toId)
    if (!out.has(e.fromId)) out.set(e.fromId, [])
    out.get(e.fromId)!.push({ to: e.toId, dir: e.dir })
  }

  const root = ids.reduce((best, id) =>
    nodes[id]!.firstVisitTurn < nodes[best]!.firstVisitTurn ? id : best,
  )

  const positions = new Map<string, { x: number; y: number }>()
  const occupied = new Set<string>()

  function place(id: string, x: number, y: number) {
    const prev = positions.get(id)
    if (prev) occupied.delete(cellKey(prev.x, prev.y))
    positions.set(id, { x, y })
    occupied.add(cellKey(x, y))
  }

  // Seed user-pinned rooms first
  for (const id of ids) {
    if (!isManual(id)) continue
    const n = nodes[id]!
    if (occupied.has(cellKey(n.x, n.y))) {
      const nudged = findFreeCell({ x: n.x, y: n.y }, occupied, cellSize)
      place(id, nudged.x, nudged.y)
    } else {
      place(id, n.x, n.y)
    }
  }

  const queue: string[] = []
  const seen = new Set<string>()

  for (const id of ids) {
    if (isManual(id)) {
      seen.add(id)
      queue.push(id)
    }
  }
  if (!seen.has(root)) {
    if (!isManual(root)) {
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
    if (isManual(toId)) {
      seen.add(toId)
      queue.push(toId)
      return
    }
    const fromPos = positions.get(fromId)
    if (!fromPos) return
    const preferred = preferredPosition(fromPos, dir, cellSize)
    // Prefer free cell along dir; if preferred is taken, expand further along
    // dir first (map grows) before sliding sideways.
    let pos: { x: number; y: number }
    if (dir && isLayoutDir(dir) && occupied.has(cellKey(preferred.x, preferred.y))) {
      const expanded = freeCellAlongDir(
        preferredPosition(preferred, dir, cellSize),
        dir,
        occupied,
        cellSize,
      )
      // Also try pure findFreeCell — pick the one that still satisfies dir
      // and is closest to preferred (prefer expansion along dir)
      if (!occupied.has(cellKey(expanded.x, expanded.y))) {
        pos = expanded
      } else {
        pos = findFreeCell(preferred, occupied, cellSize, {
          origin: fromPos,
          dir,
        })
      }
    } else {
      pos = findFreeCell(preferred, occupied, cellSize, {
        origin: fromPos,
        dir,
      })
    }
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
      if (e.toId !== id || !isLayoutDir(e.dir)) continue
      placeNeighbor(id, e.fromId, reverseDir(e.dir))
    }

    for (const nb of undirected.get(id) ?? []) {
      if (seen.has(nb)) continue
      const forward = edges.find(
        (e) => e.fromId === id && e.toId === nb && isLayoutDir(e.dir),
      )
      const backward = edges.find(
        (e) => e.fromId === nb && e.toId === id && isLayoutDir(e.dir),
      )
      let dir: Direction | null = null
      if (forward?.dir) dir = forward.dir
      else if (backward?.dir) dir = reverseDir(backward.dir)
      placeNeighbor(id, nb, dir)
    }
  }

  // Disconnected islands
  for (const id of ids) {
    if (seen.has(id)) continue
    if (isManual(id)) {
      seen.add(id)
      continue
    }
    const pos = findFreeCell({ x: cellSize * 2, y: 0 }, occupied, cellSize)
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
        const forward = edges.find(
          (e) => e.fromId === cur && e.toId === nb && isLayoutDir(e.dir),
        )
        const backward = edges.find(
          (e) => e.fromId === nb && e.toId === cur && isLayoutDir(e.dir),
        )
        let dir: Direction | null = null
        if (forward?.dir) dir = forward.dir
        else if (backward?.dir) dir = reverseDir(backward.dir)
        placeNeighbor(cur, nb, dir)
      }
    }
  }

  improveLayout(positions, occupied, edges, nodes, cellSize, isManual)

  const next: Record<string, RoomNode> = {}
  for (const id of ids) {
    const p = positions.get(id) ?? { x: nodes[id]!.x, y: nodes[id]!.y }
    if (isManual(id)) {
      next[id] = { ...nodes[id]!, x: p.x, y: p.y, manual: true }
    } else {
      next[id] = { ...nodes[id]!, x: p.x, y: p.y, manual: false }
    }
  }
  return next
}

/**
 * Iteratively enforce directional constraints and eliminate same-cell overlaps.
 * Collisions expand the map (prefer north, then along the edge dir) rather than
 * stacking rooms.
 */
function improveLayout(
  positions: Map<string, { x: number; y: number }>,
  occupied: Set<string>,
  edges: MapEdge[],
  nodes: Record<string, RoomNode>,
  cellSize: number,
  isManual: (id: string) => boolean,
): void {
  const rebuildOccupied = () => {
    occupied.clear()
    for (const [, p] of positions) {
      occupied.add(cellKey(p.x, p.y))
    }
  }

  const moveTo = (id: string, x: number, y: number) => {
    const prev = positions.get(id)
    if (prev) occupied.delete(cellKey(prev.x, prev.y))
    positions.set(id, { x, y })
    occupied.add(cellKey(x, y))
  }

  for (let pass = 0; pass < 40; pass++) {
    let changed = false
    rebuildOccupied()

    // 1) Directional constraints: pull target to ideal / further along dir
    for (const e of edges) {
      if (!isLayoutDir(e.dir)) continue
      if (isManual(e.toId)) continue
      const from = positions.get(e.fromId)
      const to = positions.get(e.toId)
      if (!from || !to) continue
      if (satisfiesDirection(from, to, e.dir, cellSize)) continue

      const ideal = preferredPosition(from, e.dir, cellSize)
      // Free current cell, then expand along dir until free
      occupied.delete(cellKey(to.x, to.y))
      let pos = ideal
      if (occupied.has(cellKey(pos.x, pos.y))) {
        pos = freeCellAlongDir(
          preferredPosition(ideal, e.dir, cellSize),
          e.dir,
          occupied,
          cellSize,
        )
      }
      if (occupied.has(cellKey(pos.x, pos.y))) {
        pos = findFreeCell(ideal, occupied, cellSize, {
          origin: from,
          dir: e.dir,
        })
      }
      moveTo(e.toId, pos.x, pos.y)
      changed = true
    }

    // 2) Same-cell collisions: keep earliest (or manual), expand the rest north
    rebuildOccupied()
    const byCell = new Map<string, string[]>()
    for (const [id, p] of positions) {
      const k = cellKey(p.x, p.y)
      const list = byCell.get(k) ?? []
      list.push(id)
      byCell.set(k, list)
    }

    for (const [, group] of byCell) {
      if (group.length < 2) continue
      group.sort((a, b) => {
        const ma = isManual(a) ? 0 : 1
        const mb = isManual(b) ? 0 : 1
        if (ma !== mb) return ma - mb
        return (
          (nodes[a]?.firstVisitTurn ?? 0) - (nodes[b]?.firstVisitTurn ?? 0)
        )
      })

      const keeper = group[0]!
      const keepPos = positions.get(keeper)!
      // Re-register keeper as sole occupant; movers will re-place
      for (let i = 1; i < group.length; i++) {
        const mover = group[i]!
        if (isManual(mover)) {
          occupied.delete(cellKey(keepPos.x, keepPos.y))
          // Two manuals: nudge later one
          const free = findFreeCell(keepPos, occupied, cellSize)
          // Put keeper back
          occupied.add(cellKey(keepPos.x, keepPos.y))
          moveTo(mover, free.x, free.y)
          changed = true
          continue
        }

        // Expand north first (user expectation: northern rooms shift up),
        // then west / east / south along free cells.
        const tryDirs: Direction[] = ['north', 'west', 'east', 'south']
        let placed: { x: number; y: number } | null = null
        for (const d of tryDirs) {
          occupied.delete(cellKey(positions.get(mover)!.x, positions.get(mover)!.y))
          // Prefer starting from keeper and going out, not from mover's old cell
          const start = preferredPosition(keepPos, d, cellSize)
          const candidate = freeCellAlongDir(start, d, occupied, cellSize)
          if (!occupied.has(cellKey(candidate.x, candidate.y))) {
            placed = candidate
            break
          }
        }
        if (!placed) {
          occupied.delete(
            cellKey(positions.get(mover)!.x, positions.get(mover)!.y),
          )
          placed = findFreeCell(keepPos, occupied, cellSize)
        }
        moveTo(mover, placed.x, placed.y)
        changed = true
      }
    }

    if (!changed) break
  }

  // Final direction pass after separations
  rebuildOccupied()
  for (let pass = 0; pass < 12; pass++) {
    let moved = false
    for (const e of edges) {
      if (!isLayoutDir(e.dir) || isManual(e.toId)) continue
      const from = positions.get(e.fromId)
      const to = positions.get(e.toId)
      if (!from || !to) continue
      if (satisfiesDirection(from, to, e.dir, cellSize)) continue

      const ideal = preferredPosition(from, e.dir, cellSize)
      occupied.delete(cellKey(to.x, to.y))
      let pos = ideal
      if (occupied.has(cellKey(pos.x, pos.y))) {
        pos = freeCellAlongDir(
          preferredPosition(ideal, e.dir, cellSize),
          e.dir,
          occupied,
          cellSize,
        )
      }
      if (occupied.has(cellKey(pos.x, pos.y))) {
        pos = findFreeCell(ideal, occupied, cellSize, {
          origin: from,
          dir: e.dir,
        })
      }
      moveTo(e.toId, pos.x, pos.y)
      moved = true
    }
    if (!moved) break
  }
}
