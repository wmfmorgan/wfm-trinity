import type { Direction } from './types'

export const CARDINAL_DIRS: Direction[] = ['north', 'south', 'east', 'west']

export const ALL_DIRS: Direction[] = [
  'north',
  'south',
  'east',
  'west',
  'northeast',
  'northwest',
  'southeast',
  'southwest',
  'up',
  'down',
  'in',
  'out',
]

const REVERSE: Record<Direction, Direction> = {
  north: 'south',
  south: 'north',
  east: 'west',
  west: 'east',
  northeast: 'southwest',
  southwest: 'northeast',
  northwest: 'southeast',
  southeast: 'northwest',
  up: 'down',
  down: 'up',
  in: 'out',
  out: 'in',
}

/**
 * Screen-space grid steps: +x east, +y south (north = −y).
 * Up/down use the same vertical axis as N/S so stairs/ladders stack
 * above/below on the 2D map. In/out are non-layout (teleport-like).
 */
const DELTA: Record<Direction, { dx: number; dy: number }> = {
  north: { dx: 0, dy: -1 },
  south: { dx: 0, dy: 1 },
  east: { dx: 1, dy: 0 },
  west: { dx: -1, dy: 0 },
  northeast: { dx: 1, dy: -1 },
  northwest: { dx: -1, dy: -1 },
  southeast: { dx: 1, dy: 1 },
  southwest: { dx: -1, dy: 1 },
  /** Vertical stack: up sits above (same visual as north). */
  up: { dx: 0, dy: -1 },
  /** Vertical stack: down sits below (same visual as south). */
  down: { dx: 0, dy: 1 },
  in: { dx: 0, dy: 0 },
  out: { dx: 0, dy: 0 },
}

export function reverseDir(d: Direction): Direction {
  return REVERSE[d]
}

export function deltaForDir(d: Direction): { dx: number; dy: number } {
  return DELTA[d]
}

export function commandForDir(d: Direction): string {
  return d
}
