import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  applyPhosphorTheme,
  DEFAULT_PHOSPHOR_THEME,
  DEFAULT_UI_SCALE,
  isPhosphorTheme,
  isUiScale,
  PHOSPHOR_STORAGE_KEY,
  readPhosphorTheme,
  stepUiScale,
  UI_SCALE_STEPS,
  writePhosphorTheme,
} from './uiPrefs'

describe('uiPrefs', () => {
  it('accepts only known scale steps', () => {
    expect(isUiScale(1)).toBe(true)
    expect(isUiScale(1.15)).toBe(true)
    expect(isUiScale(0.9)).toBe(false)
  })

  it('steps up and down within bounds', () => {
    expect(stepUiScale(DEFAULT_UI_SCALE, 1)).toBe(1.15)
    expect(stepUiScale(DEFAULT_UI_SCALE, -1)).toBe(0.85)
    expect(stepUiScale(UI_SCALE_STEPS[0]!, -1)).toBe(UI_SCALE_STEPS[0])
    expect(stepUiScale(UI_SCALE_STEPS[UI_SCALE_STEPS.length - 1]!, 1)).toBe(
      UI_SCALE_STEPS[UI_SCALE_STEPS.length - 1],
    )
  })
})

describe('phosphor theme', () => {
  afterEach(() => {
    localStorage.clear()
    delete document.documentElement.dataset.phosphor
    vi.restoreAllMocks()
  })

  it('defaults to green phosphor', () => {
    expect(DEFAULT_PHOSPHOR_THEME).toBe('green')
    expect(isPhosphorTheme('green')).toBe(true)
    expect(isPhosphorTheme('amber')).toBe(true)
    expect(isPhosphorTheme('blue')).toBe(false)
    expect(isPhosphorTheme(null)).toBe(false)
    expect(readPhosphorTheme()).toBe('green')
  })

  it('persists a theme and ignores unknown values', () => {
    writePhosphorTheme('amber')
    expect(localStorage.getItem(PHOSPHOR_STORAGE_KEY)).toBe('amber')
    expect(readPhosphorTheme()).toBe('amber')

    localStorage.setItem(PHOSPHOR_STORAGE_KEY, 'blue')
    expect(readPhosphorTheme()).toBe('green')
  })

  it('applies the theme as a data-phosphor attribute', () => {
    applyPhosphorTheme('amber')
    expect(document.documentElement.dataset.phosphor).toBe('amber')
    applyPhosphorTheme('green')
    expect(document.documentElement.dataset.phosphor).toBe('green')
  })

  it('falls back when storage is unavailable', () => {
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('denied')
    })
    expect(readPhosphorTheme()).toBe('green')

    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('quota')
    })
    expect(() => writePhosphorTheme('amber')).not.toThrow()
  })
})

