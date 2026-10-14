import { afterEach, describe, expect, it } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { PhosphorThemeControl } from './PhosphorThemeControl'
import { PHOSPHOR_STORAGE_KEY } from './uiPrefs'

describe('PhosphorThemeControl', () => {
  afterEach(() => {
    localStorage.clear()
    delete document.documentElement.dataset.phosphor
  })

  it('selects green phosphor by default', () => {
    render(<PhosphorThemeControl />)

    expect(screen.getByRole('radio', { name: 'Green' })).toBeChecked()
    expect(screen.getByRole('radio', { name: 'Amber' })).not.toBeChecked()
    expect(document.documentElement.dataset.phosphor).toBe('green')
  })

  it('switches to amber and persists the choice', async () => {
    const user = userEvent.setup()
    render(<PhosphorThemeControl />)

    await user.click(screen.getByRole('radio', { name: 'Amber' }))

    expect(screen.getByRole('radio', { name: 'Amber' })).toBeChecked()
    expect(screen.getByRole('radio', { name: 'Green' })).not.toBeChecked()
    expect(document.documentElement.dataset.phosphor).toBe('amber')
    expect(localStorage.getItem(PHOSPHOR_STORAGE_KEY)).toBe('amber')
  })

  it('restores the stored theme after a reload', () => {
    localStorage.setItem(PHOSPHOR_STORAGE_KEY, 'amber')

    render(<PhosphorThemeControl />)

    expect(screen.getByRole('radio', { name: 'Amber' })).toBeChecked()
    expect(document.documentElement.dataset.phosphor).toBe('amber')
  })

  it('can switch back to green', async () => {
    const user = userEvent.setup()
    localStorage.setItem(PHOSPHOR_STORAGE_KEY, 'amber')
    render(<PhosphorThemeControl />)

    await user.click(screen.getByRole('radio', { name: 'Green' }))

    expect(screen.getByRole('radio', { name: 'Green' })).toBeChecked()
    expect(document.documentElement.dataset.phosphor).toBe('green')
    expect(localStorage.getItem(PHOSPHOR_STORAGE_KEY)).toBe('green')
  })
})