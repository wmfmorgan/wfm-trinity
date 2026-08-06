import { describe, it, expect } from 'vitest'
import {
  DEFAULT_UI_SCALE,
  isUiScale,
  stepUiScale,
  UI_SCALE_STEPS,
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

