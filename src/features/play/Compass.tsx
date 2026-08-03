import { ALL_DIRS } from '../../domain/directions'
import type { Direction, ExitInfo } from '../../domain/types'
import styles from './panels.module.css'

export interface CompassProps {
  exits: ExitInfo[]
  onMove: (dir: Direction) => void
  /** When true, all direction buttons are disabled (e.g. submit in flight). */
  disabled?: boolean
}

/** Short labels for compact compass buttons. */
const LABEL: Record<Direction, string> = {
  north: 'N',
  south: 'S',
  east: 'E',
  west: 'W',
  northeast: 'NE',
  northwest: 'NW',
  southeast: 'SE',
  southwest: 'SW',
  up: 'U',
  down: 'D',
  in: 'IN',
  out: 'OUT',
}

/** 3×3 grid slots: NW N NE / W · E / SW S SE */
const GRID: (Direction | null)[] = [
  'northwest',
  'north',
  'northeast',
  'west',
  null,
  'east',
  'southwest',
  'south',
  'southeast',
]

const EXTRAS: Direction[] = ['up', 'down', 'in', 'out']

/** All directions rendered by compass (must match ALL_DIRS). */
const RENDERED: Direction[] = [
  ...GRID.filter((d): d is Direction => d != null),
  ...EXTRAS,
]

function enabledDirs(exits: ExitInfo[]): Set<Direction> {
  return new Set(exits.map((e) => e.dir))
}

export function Compass({ exits, onMove, disabled = false }: CompassProps) {
  const available = enabledDirs(exits)

  function renderBtn(dir: Direction) {
    const enabled = !disabled && available.has(dir)
    return (
      <button
        key={dir}
        type="button"
        className={`${styles.compassBtn}${enabled ? '' : ` ${styles.compassBtnDim}`}`}
        aria-label={dir}
        aria-disabled={!enabled}
        disabled={!enabled}
        onClick={() => {
          if (enabled) onMove(dir)
        }}
      >
        {LABEL[dir]}
      </button>
    )
  }

  return (
    <section className={styles.panel} aria-label="Compass">
      <header className={styles.panelHeader}>Exits</header>
      <div className={styles.compass}>
        <div className={styles.compassGrid} role="group" aria-label="Directions">
          {GRID.map((dir) =>
            dir == null ? (
              <span key="center" className={styles.compassCenter} aria-hidden>
                ·
              </span>
            ) : (
              renderBtn(dir)
            ),
          )}
        </div>
        <div
          className={styles.compassExtras}
          role="group"
          aria-label="Vertical and portal"
        >
          {EXTRAS.map((dir) => renderBtn(dir))}
        </div>
      </div>
    </section>
  )
}

/** Dev/test invariant: compass exposes every Direction in ALL_DIRS. */
export function compassCoversAllDirs(): boolean {
  if (RENDERED.length !== ALL_DIRS.length) return false
  const set = new Set(RENDERED)
  return ALL_DIRS.every((d) => set.has(d))
}
