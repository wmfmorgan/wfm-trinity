import { useEffect, useState } from 'react'
import {
  applyPhosphorTheme,
  readPhosphorTheme,
  writePhosphorTheme,
  type PhosphorTheme,
} from './uiPrefs'
import styles from './PhosphorThemeControl.module.css'

const OPTIONS: { id: PhosphorTheme; label: string }[] = [
  { id: 'green', label: 'Green' },
  { id: 'amber', label: 'Amber' },
]

/**
 * Green / Amber phosphor switch for the CRT palette.
 * Choice is stored in localStorage and applied on <html data-phosphor>.
 */
export function PhosphorThemeControl() {
  const [theme, setTheme] = useState<PhosphorTheme>(() => readPhosphorTheme())

  useEffect(() => {
    applyPhosphorTheme(theme)
  }, [theme])

  function select(next: PhosphorTheme) {
    setTheme(next)
    writePhosphorTheme(next)
    applyPhosphorTheme(next)
  }

  return (
    <fieldset
      className={styles.root}
      role="radiogroup"
      aria-label="Phosphor color"
      data-testid="phosphor-theme-control"
    >
      {OPTIONS.map((option) => {
        const checked = theme === option.id
        return (
          <label
            key={option.id}
            className={
              checked ? `${styles.option} ${styles.optionChecked}` : styles.option
            }
          >
            <input
              className={styles.input}
              type="radio"
              name="phosphor-theme"
              value={option.id}
              checked={checked}
              onChange={() => select(option.id)}
              data-testid={`phosphor-theme-${option.id}`}
            />
            <span
              className={
                option.id === 'green' ? styles.swatchGreen : styles.swatchAmber
              }
              aria-hidden="true"
            />
            {option.label}
          </label>
        )
      })}
    </fieldset>
  )
}
