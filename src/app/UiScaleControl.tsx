import { useCallback, useEffect, useState } from 'react'
import {
  applyUiScale,
  DEFAULT_UI_SCALE,
  readUiScale,
  stepUiScale,
  writeUiScale,
  type UiScale,
} from './uiPrefs'
import styles from './UiScaleControl.module.css'

export interface UiScaleControlProps {
  /** Compact toolbar styling for status bars */
  className?: string
}

/**
 * A− / A+ control for whole-UI font scale (persisted in localStorage).
 */
export function UiScaleControl({ className }: UiScaleControlProps) {
  const [scale, setScale] = useState<UiScale>(DEFAULT_UI_SCALE)

  useEffect(() => {
    const initial = readUiScale()
    setScale(initial)
    applyUiScale(initial)
  }, [])

  const change = useCallback((direction: 1 | -1) => {
    setScale((prev) => {
      const next = stepUiScale(prev, direction)
      writeUiScale(next)
      applyUiScale(next)
      return next
    })
  }, [])

  const pct = Math.round(scale * 100)

  return (
    <div
      className={[styles.root, className].filter(Boolean).join(' ')}
      role="group"
      aria-label="Interface text size"
      data-testid="ui-scale-control"
    >
      <button
        type="button"
        className={styles.btn}
        onClick={() => change(-1)}
        disabled={scale <= 0.85}
        aria-label="Decrease text size"
        data-testid="ui-scale-down"
      >
        A−
      </button>
      <span className={styles.label} data-testid="ui-scale-label" title="Text size">
        {pct}%
      </span>
      <button
        type="button"
        className={styles.btn}
        onClick={() => change(1)}
        disabled={scale >= 1.5}
        aria-label="Increase text size"
        data-testid="ui-scale-up"
      >
        A+
      </button>
    </div>
  )
}
