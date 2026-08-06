/**
 * UI preferences persisted in localStorage (font scale / zoom).
 */

export const UI_SCALE_STEPS = [0.85, 1, 1.15, 1.3, 1.5] as const
export type UiScale = (typeof UI_SCALE_STEPS)[number]

export const UI_SCALE_STORAGE_KEY = 'infocom-workbench.uiScale'
export const DEFAULT_UI_SCALE: UiScale = 1

export function isUiScale(n: number): n is UiScale {
  return (UI_SCALE_STEPS as readonly number[]).includes(n)
}

export function readUiScale(): UiScale {
  try {
    const raw = localStorage.getItem(UI_SCALE_STORAGE_KEY)
    if (raw == null) return DEFAULT_UI_SCALE
    const n = Number(raw)
    if (isUiScale(n)) return n
  } catch {
    /* private mode / SSR */
  }
  return DEFAULT_UI_SCALE
}

export function writeUiScale(scale: UiScale): void {
  try {
    localStorage.setItem(UI_SCALE_STORAGE_KEY, String(scale))
  } catch {
    /* ignore quota / private mode */
  }
}

/** Apply scale to the document root (drives rem-based layout + text). */
export function applyUiScale(scale: UiScale): void {
  if (typeof document === 'undefined') return
  document.documentElement.style.setProperty('--ui-scale', String(scale))
  document.documentElement.dataset.uiScale = String(scale)
}

export function stepUiScale(
  current: UiScale,
  direction: 1 | -1,
): UiScale {
  const idx = UI_SCALE_STEPS.indexOf(current)
  const next = Math.min(
    UI_SCALE_STEPS.length - 1,
    Math.max(0, idx + direction),
  )
  return UI_SCALE_STEPS[next]!
}
