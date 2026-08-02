import type { Direction } from '../../domain/types'
import { deltaForDir } from '../../domain/directions'

export const DEFAULT_CELL_SIZE = 80

/** Preferred placement relative to previous room for a move direction. */
export function preferredPosition(
  prev: { x: number; y: number },
  movedDir: Direction | null | undefined,
  cellSize: number,
): { x: number; y: number } {
  if (!movedDir) {
    return { x: prev.x, y: prev.y }
  }
  const { dx, dy } = deltaForDir(movedDir)
  return {
    x: prev.x + dx * cellSize,
    y: prev.y + dy * cellSize,
  }
}

/**
 * Spiral search on the cell grid for a free cell near `preferred`.
 * Ring 0 = preferred; then radius 1, 2, ... walking ring perimeter.
 */
export function findFreeCell(
  preferred: { x: number; y: number },
  occupied: Set<string>,
  cellSize: number,
): { x: number; y: number } {
  const key = (x: number, y: number) => `${x},${y}`

  if (!occupied.has(key(preferred.x, preferred.y))) {
    return preferred
  }

  // Normalize to grid origin relative to preferred
  for (let radius = 1; radius < 10_000; radius++) {
    // Walk ring: right, down, left, up (clockwise from top-left-ish)
    // Standard Ulam spiral offsets in grid steps
    for (let step = -radius; step <= radius; step++) {
      const candidates: Array<{ x: number; y: number }> = [
        { x: preferred.x + step * cellSize, y: preferred.y - radius * cellSize }, // top
        { x: preferred.x + step * cellSize, y: preferred.y + radius * cellSize }, // bottom
        { x: preferred.x - radius * cellSize, y: preferred.y + step * cellSize }, // left
        { x: preferred.x + radius * cellSize, y: preferred.y + step * cellSize }, // right
      ]
      for (const c of candidates) {
        if (!occupied.has(key(c.x, c.y))) {
          return c
        }
      }
    }
  }

  // Unreachable for practical maps
  return {
    x: preferred.x + cellSize,
    y: preferred.y,
  }
}

/** Build occupied position set from existing nodes (grid keys). */
export function occupiedKeys(
  nodes: Record<string, { x: number; y: number }>,
  excludeId?: string,
): Set<string> {
  const set = new Set<string>()
  for (const [id, n] of Object.entries(nodes)) {
    if (excludeId && id === excludeId) continue
    set.add(`${n.x},${n.y}`)
  }
  return set
}
