import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { ALL_DIRS } from '../../domain/directions'
import type { ExitInfo } from '../../domain/types'
import { Compass, compassCoversAllDirs } from './Compass'

describe('Compass', () => {
  it('enables north when exit is in snapshot and submits on click', async () => {
    const user = userEvent.setup()
    const onMove = vi.fn()
    const exits: ExitInfo[] = [{ dir: 'north' }, { dir: 'east' }]

    render(<Compass exits={exits} onMove={onMove} />)

    const north = screen.getByRole('button', { name: 'north' })
    expect(north).toBeEnabled()
    expect(north).toHaveAttribute('aria-disabled', 'false')

    await user.click(north)
    expect(onMove).toHaveBeenCalledWith('north')
  })

  it('disables directions not present in exits', () => {
    const onMove = vi.fn()
    render(<Compass exits={[{ dir: 'north' }]} onMove={onMove} />)

    const south = screen.getByRole('button', { name: 'south' })
    expect(south).toBeDisabled()
    expect(south).toHaveAttribute('aria-disabled', 'true')
  })

  it('exposes a button for every ALL_DIRS direction', () => {
    expect(compassCoversAllDirs()).toBe(true)
    render(<Compass exits={[]} onMove={vi.fn()} />)
    for (const dir of ALL_DIRS) {
      expect(screen.getByRole('button', { name: dir })).toBeInTheDocument()
    }
  })
})
