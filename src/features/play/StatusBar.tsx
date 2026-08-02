import type { StatusInfo } from '../../domain/types'
import styles from './panels.module.css'

export interface StatusBarProps {
  title: string
  status: StatusInfo
}

function formatTime(hours: number, minutes: number): string {
  const h = String(hours).padStart(2, '0')
  const m = String(minutes).padStart(2, '0')
  return `${h}:${m}`
}

export function StatusBar({ title, status }: StatusBarProps) {
  const hasTime = status.hours != null && status.minutes != null

  return (
    <div className={styles.statusBar} role="status" aria-label="Game status">
      <span className={styles.statusTitle}>{title}</span>
      {status.locationName != null && status.locationName !== '' && (
        <span className={styles.statusField}>
          <span className={styles.statusLabel}>Loc</span>
          {status.locationName}
        </span>
      )}
      {status.score != null && (
        <span className={styles.statusField}>
          <span className={styles.statusLabel}>Score</span>
          {status.score}
        </span>
      )}
      {status.moves != null && (
        <span className={styles.statusField}>
          <span className={styles.statusLabel}>Moves</span>
          {status.moves}
        </span>
      )}
      {hasTime && (
        <span className={styles.statusField}>
          <span className={styles.statusLabel}>Time</span>
          {formatTime(status.hours!, status.minutes!)}
        </span>
      )}
    </div>
  )
}
